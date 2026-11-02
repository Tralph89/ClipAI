import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { GoogleGenAI } from '@google/genai';
import {
  AspectRatioType,
  CameraMotionType,
  LocalVideoEngineId,
  Scene,
  StockVideoCandidate,
  VisualBible,
  VisualModeType,
} from '../../src/types.ts';
import {
  DATA_DIR,
  loadDb,
  MEDIA_DIR,
  MediaSubfolder,
  resolveMediaUrlToDiskPath,
  saveBufferToMedia,
  saveDataUrlToMedia,
} from '../storage/localDb.ts';
import { resolveLocalToolPath } from './systemTools.ts';
import { probeAudioDurationSec } from './voiceEngine.ts';
import {
  COMFYUI_ROOT,
  getEngineBaseUrls,
  isComfyUIInstalled,
  isLtxLocalInstalled,
  startLocalVideoEngine,
  unloadOllamaFromVram,
} from './localVideoServiceManager.ts';

const execFileAsync = promisify(execFile);

const STUDIO_USER_AGENT =
  'ClipAIStudio/1.0 (https://localhost:3001; local-open-source-video-studio)';

const STYLE_DESCRIPTIONS: Record<string, string> = {
  anime:
    'Makoto Shinkai and Studio Ghibli inspired anime film still, CoMix Wave quality, exquisite painted background, vibrant lighting, emotional atmosphere, 8k masterpiece',
  biblia:
    'museum quality historical oil painting, Rembrandt chiaroscuro masterwork, dramatic golden hour god rays, rich textured brushstrokes, epic classical composition',
  cartoon:
    'Pixar Disney 3D animated film render, expressive character design, subsurface scattering, soft studio lighting, octane render, vivid colors, depth of field',
  cinematic:
    'Hollywood blockbuster cinematography, shot on ARRI Alexa 65 with 35mm anamorphic lens, volumetric rim lighting, shallow depth of field, color graded filmic masterpiece',
  comic:
    'vintage American graphic novel art, bold dynamic ink line work, pop art halftone dot patterns, vibrant saturated colors, dramatic action perspective',
  fantasy:
    'epic dark fantasy digital masterpiece, Frank Frazetta and Greg Rutkowski aesthetic, glowing magical particles, ancient ruins, intricate ornate details, Unreal Engine 5 render',
  horror:
    'atmospheric gothic horror cinema, Guillermo del Toro aesthetic, eerie creeping fog, high contrast dark shadows, cold muted color palette, suspenseful framing',
  photorealistic:
    'award-winning National Geographic documentary 8k photography, Sony A7R V, 85mm f/1.4 lens, razor sharp focus, natural skin pores and surface textures, photorealistic raytracing',
  scifi:
    'Blade Runner 2049 futuristic sci-fi concept art, neon drenched cyberpunk city, rain reflections, holographic displays, volumetric smog, Syd Mead aesthetic',
  pixelart:
    'masterpiece 16-bit arcade pixel art, detailed nostalgic sprite work, vibrant color palette, crisp pixel grid, high-definition retro video game screenshot',
  lego:
    'macro tilt-shift photography of authentic glossy LEGO bricks, realistic plastic reflections, shallow depth of field, soft studio lightbox illumination',
  minecraft:
    'voxel cubic block world with realistic RTX raytracing shaders, volumetric morning sunbeams, lush water reflections, hyper-detailed high-res voxel textures',
};

export function getTargetDimensions(aspectRatio: AspectRatioType): {
  width: number;
  height: number;
  videoWidth: number;
  videoHeight: number;
  orientation: 'portrait' | 'landscape' | 'square';
} {
  if (aspectRatio === '16:9') {
    return {
      width: 1280,
      height: 720,
      videoWidth: 1280,
      videoHeight: 720,
      orientation: 'landscape',
    };
  }
  if (aspectRatio === '1:1') {
    return {
      width: 1024,
      height: 1024,
      videoWidth: 720,
      videoHeight: 720,
      orientation: 'square',
    };
  }
  return {
    width: 720,
    height: 1280,
    videoWidth: 720,
    videoHeight: 1280,
    orientation: 'portrait',
  };
}

/**
 * Normalizes any downloaded image buffer (.webp, .png, .jpg) to an exact W x H high-quality .jpg in `/media/<subfolder>/`
 * using local FFmpeg so Canvas and FFmpeg video renders never encounter format or aspect mismatches.
 */
async function saveNormalizedImageBuffer(
  rawBuffer: Buffer,
  subfolder: MediaSubfolder,
  prefix: string,
  width: number,
  height: number
): Promise<string> {
  const dir = path.join(MEDIA_DIR, subfolder);
  fs.mkdirSync(dir, { recursive: true });
  const tag = `${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const outName = `${prefix}_${tag}.jpg`;
  const outPath = path.join(dir, outName);

  const ffmpegPath = resolveLocalToolPath('ffmpeg');
  if (!ffmpegPath) {
    return saveBufferToMedia(rawBuffer, subfolder, outName);
  }

  const tmpInPath = path.join(dir, `tmp_${tag}.img`);
  fs.writeFileSync(tmpInPath, rawBuffer);

  try {
    await execFileAsync(
      ffmpegPath,
      [
        '-y',
        '-i',
        tmpInPath,
        '-vf',
        `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1`,
        '-frames:v',
        '1',
        '-q:v',
        '2',
        outPath,
      ],
      { timeout: 15_000 }
    );
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1500) {
      return `/media/${subfolder}/${outName}`;
    }
  } catch {
    // Fallback to raw save
  } finally {
    if (fs.existsSync(tmpInPath)) fs.unlinkSync(tmpInPath);
  }

  return saveBufferToMedia(rawBuffer, subfolder, outName);
}

/**
 * Generates a fast keyframe image via local LTX Desktop backend (Z-Image-Turbo, 100% local GPU, ~1.5s).
 */
async function tryLtxLocalImageGen(
  fullPrompt: string,
  width: number,
  height: number
): Promise<Buffer | null> {
  const { ltxLocalUrl } = getEngineBaseUrls();
  try {
    const res = await fetch(`${ltxLocalUrl}/api/generate-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: fullPrompt,
        width: Math.min(1280, Math.max(512, Math.round(width / 16) * 16)),
        height: Math.min(1280, Math.max(512, Math.round(height / 16) * 16)),
        numSteps: 4,
        numImages: 1,
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as { status?: string; image_paths?: string[] };
    if (data.status === 'complete' && data.image_paths?.[0]) {
      const diskPath = data.image_paths[0];
      if (fs.existsSync(diskPath)) {
        return fs.readFileSync(diskPath);
      }
    }
  } catch (err) {
    // LTX desktop backend offline or busy
  }
  return null;
}

/**
 * Searches Wikimedia Commons high-resolution photography ($0, zero API key) as a factual visual fallback.
 */
async function tryWikimediaPhotoSearch(keywords: string): Promise<Buffer | null> {
  const cleanQ = keywords
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 4)
    .join(' ');

  if (!cleanQ) return null;

  const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
    `filetype:bitmap ${cleanQ}`
  )}&gsrlimit=5&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=1280&format=json`;

  const res = await fetch(apiUrl, {
    headers: { 'User-Agent': STUDIO_USER_AGENT },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;

  const data = (await res.json()) as any;
  const pages = Object.values(data?.query?.pages || {}) as any[];
  for (const p of pages) {
    const info = p?.imageinfo?.[0];
    const imgUrl = info?.thumburl || info?.url;
    if (!imgUrl) continue;
    try {
      const dl = await fetch(imgUrl, {
        headers: { 'User-Agent': STUDIO_USER_AGENT },
        signal: AbortSignal.timeout(10_000),
      });
      if (!dl.ok) continue;
      const ct = dl.headers.get('content-type') || '';
      if (!ct.startsWith('image/')) continue;
      const buf = Buffer.from(await dl.arrayBuffer());
      if (buf.length > 8000) return buf;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * High-quality zero-API-key Flux image fallback via Pollinations.ai ($0, no watermark)
 */
async function tryPollinationsImageGen(
  prompt: string,
  width: number,
  height: number,
  seed: number
): Promise<Buffer | null> {
  try {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
      prompt
    )}?width=${width}&height=${height}&seed=${seed}&model=flux&enhance=true&nologo=true`;
    const res = await fetch(url, { signal: AbortSignal.timeout(18_000) });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) return null;
    const arr = await res.arrayBuffer();
    const buf = Buffer.from(arr);
    return buf.length > 5000 ? buf : null;
  } catch {
    return null;
  }
}

/**
 * Direct ComfyUI Text-to-Image Generation using any checkpoint in `ComfyUI/models/checkpoints/`
 * Intelligently pairs the best model (e.g. Juggernaut XL for cinematic/realism vs Animagine for anime).
 */
async function tryComfyUiImageGen(
  prompt: string,
  width: number,
  height: number,
  seed: number,
  style?: string
): Promise<Buffer | null> {
  try {
    const { comfyUiUrl } = getEngineBaseUrls();
    const statsRes = await fetch(`${comfyUiUrl}/system_stats`, {
      signal: AbortSignal.timeout(2000),
    }).catch(() => null);
    if (!statsRes || !statsRes.ok) return null;

    const checkpointsDir = path.join(COMFYUI_ROOT, 'ComfyUI', 'models', 'checkpoints');
    if (!fs.existsSync(checkpointsDir)) return null;

    const findCheckpoints = (dir: string, base: string = ''): string[] => {
      let list: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const rel = base ? `${base}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && entry.name !== 'diffusion_models' && entry.name !== '.cache') {
            list = list.concat(findCheckpoints(path.join(dir, entry.name), rel));
          }
        } else if (
          entry.isFile() &&
          (entry.name.endsWith('.safetensors') || entry.name.endsWith('.ckpt'))
        ) {
          if (!entry.name.toLowerCase().includes('ltx') && !entry.name.toLowerCase().includes('wan')) {
            list.push(rel);
          }
        }
      }
      return list;
    };

    const ckptCandidates = findCheckpoints(checkpointsDir);
    if (ckptCandidates.length === 0) return null;

    // Intelligent Checkpoint Selection based on selected visual style
    const normStyle = (style || 'cinematic').toLowerCase();
    const isAnime = normStyle === 'anime';
    const isRealistic = [
      'cinematic',
      'photorealistic',
      'horror',
      'biblia',
      'scifi',
      'lego',
      'minecraft',
    ].includes(normStyle);

    let chosenCkpt = ckptCandidates[0];

    if (isAnime) {
      const animeMatch = ckptCandidates.find((c) => /anime|animagine|waifu|manga/i.test(c));
      if (animeMatch) chosenCkpt = animeMatch;
    } else if (isRealistic) {
      const realMatch = ckptCandidates.find((c) =>
        /juggernaut|realistic|photo|realvis|epicrealism|cinematic/i.test(c)
      );
      if (realMatch) chosenCkpt = realMatch;
      else {
        const nonAnime = ckptCandidates.find((c) => !/anime|animagine/i.test(c));
        if (nonAnime) chosenCkpt = nonAnime;
      }
    } else {
      // General artistic styles (fantasy, cartoon, comic, pixelart)
      const artMatch =
        ckptCandidates.find((c) => /dreamshaper|fantasy|art/i.test(c)) ||
        ckptCandidates.find((c) => /juggernaut/i.test(c));
      if (artMatch) chosenCkpt = artMatch;
    }

    // Dynamic sampling steps and CFG based on model type (Lightning vs Standard SDXL)
    const isLightning = /lightning/i.test(chosenCkpt);
    const steps = isLightning ? 8 : 26;
    const cfg = isLightning ? 2.0 : 6.5;
    const samplerName = isLightning ? 'dpmpp_sde' : 'dpmpp_2m';

    // Strict style-enforcing negative prompt
    let negativePromptText =
      'worst quality, low quality, normal quality, lowres, bad anatomy, bad hands, missing fingers, extra digit, fewer digits, cropped, signature, watermark, username, blurry, artist name, deformed, disfigured, text, title, logo';
    if (!isAnime) {
      negativePromptText = `anime, cartoon, illustration, drawing, 3d render, sketch, cgi, painting, ${negativePromptText}`;
    } else {
      negativePromptText = `photorealistic, realistic photo, 3d photograph, real life, ${negativePromptText}`;
    }

    // Compute optimal SDXL native latent dimensions (multiples of 64)
    let latentW = width;
    let latentH = height;
    if (height > width) {
      latentW = 768;
      latentH = 1344;
    } else if (width > height) {
      latentW = 1344;
      latentH = 768;
    } else {
      latentW = 1024;
      latentH = 1024;
    }

    const workflowPrompt = {
      '3': {
        class_type: 'KSampler',
        inputs: {
          cfg,
          denoise: 1.0,
          latent_image: ['5', 0],
          model: ['4', 0],
          negative: ['7', 0],
          positive: ['6', 0],
          sampler_name: samplerName,
          scheduler: 'karras',
          seed,
          steps,
        },
      },
      '4': {
        class_type: 'CheckpointLoaderSimple',
        inputs: {
          ckpt_name: chosenCkpt,
        },
      },
      '5': {
        class_type: 'EmptyLatentImage',
        inputs: {
          batch_size: 1,
          height: latentH,
          width: latentW,
        },
      },
      '6': {
        class_type: 'CLIPTextEncode',
        inputs: {
          clip: ['4', 1],
          text: prompt,
        },
      },
      '7': {
        class_type: 'CLIPTextEncode',
        inputs: {
          clip: ['4', 1],
          text: negativePromptText,
        },
      },
      '8': {
        class_type: 'VAEDecode',
        inputs: {
          samples: ['3', 0],
          vae: ['4', 2],
        },
      },
      '9': {
        class_type: 'SaveImage',
        inputs: {
          filename_prefix: 'clipai_sd',
          images: ['8', 0],
        },
      },
    };

    const queueRes = await fetch(`${comfyUiUrl}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflowPrompt }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!queueRes.ok) return null;
    const { prompt_id } = (await queueRes.json()) as { prompt_id?: string };
    if (!prompt_id) return null;

    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1500));
      const histRes = await fetch(`${comfyUiUrl}/history/${prompt_id}`, {
        signal: AbortSignal.timeout(5000),
      }).catch(() => null);
      if (!histRes || !histRes.ok) continue;

      const histData = (await histRes.json()) as Record<string, any>;
      const runInfo = histData[prompt_id];
      if (runInfo) {
        if (runInfo.status?.status_str === 'error') return null;
        const outputs = runInfo.outputs || {};
        const node9Out = outputs['9'];
        const images = node9Out?.images || [];
        if (images.length > 0 && images[0]?.filename) {
          const imgObj = images[0];
          const dlRes = await fetch(
            `${comfyUiUrl}/view?filename=${encodeURIComponent(imgObj.filename)}&type=${encodeURIComponent(
              imgObj.type || 'output'
            )}&subfolder=${encodeURIComponent(imgObj.subfolder || '')}`,
            { signal: AbortSignal.timeout(15_000) }
          );
          if (dlRes.ok) {
            const arr = await dlRes.arrayBuffer();
            return Buffer.from(arr);
          }
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Offline fail-safe: renders a sleek cinematic gradient backdrop via local FFmpeg so no scene is ever broken.
 */
async function renderOfflineFallbackBackdrop(
  subfolder: MediaSubfolder,
  prefix: string,
  width: number,
  height: number
): Promise<string> {
  const ffmpegPath = resolveLocalToolPath('ffmpeg');
  const dir = path.join(MEDIA_DIR, subfolder);
  fs.mkdirSync(dir, { recursive: true });
  const outName = `${prefix}_studio_${Date.now()}.jpg`;
  const outPath = path.join(dir, outName);

  if (ffmpegPath) {
    try {
      await execFileAsync(
        ffmpegPath,
        [
          '-y',
          '-f',
          'lavfi',
          '-i',
          `gradients=s=${width}x${height}:c0=#1e1b4b:c1=#090a0f:c2=#4c1d95:n=3:duration=0.1`,
          '-frames:v',
          '1',
          '-q:v',
          '2',
          outPath,
        ],
        { timeout: 8000 }
      );
      if (fs.existsSync(outPath)) {
        return `/media/${subfolder}/${outName}`;
      }
    } catch {
      // Fallback solid color
      try {
        await execFileAsync(
          ffmpegPath,
          [
            '-y',
            '-f',
            'lavfi',
            '-i',
            `color=c=#161332:s=${width}x${height}:d=0.1`,
            '-frames:v',
            '1',
            outPath,
          ],
          { timeout: 6000 }
        );
        if (fs.existsSync(outPath)) return `/media/${subfolder}/${outName}`;
      } catch {}
    }
  }
  throw new Error('No se pudo generar ni descargar imagen visual.');
}

export type VisualInitialSource = 'local' | 'gemini' | 'pixabay';

/**
 * Searches and downloads HD stock imagery from Pixabay, strictly matching
 * the scene dialogue/keywords AND the selected artistic/visual style.
 */
export async function fetchPixabayStockImage(params: {
  query: string;
  style?: string;
  aspectRatio?: AspectRatioType;
  stockKeywords?: string[];
}): Promise<{
  imageUrl: string;
  provider: string;
  seedUsed: number;
}> {
  const db = loadDb();
  const apiKey = db.settings.pixabayApiKey?.trim() || process.env.PIXABAY_API_KEY || '';
  const aspectRatio: AspectRatioType = params.aspectRatio || '9:16';
  const { width, height } = getTargetDimensions(aspectRatio);

  const style = (params.style || 'cinematic').toLowerCase();
  let imageType: 'photo' | 'illustration' | 'all' = 'photo';
  let styleKeyword = 'cinematic';

  switch (style) {
    case 'anime':
      imageType = 'illustration';
      styleKeyword = 'anime';
      break;
    case 'cartoon':
      imageType = 'illustration';
      styleKeyword = 'cartoon 3d';
      break;
    case 'comic':
      imageType = 'illustration';
      styleKeyword = 'comic pop art';
      break;
    case 'pixelart':
      imageType = 'illustration';
      styleKeyword = 'pixel art 8bit';
      break;
    case 'fantasy':
      imageType = 'illustration';
      styleKeyword = 'fantasy mythical';
      break;
    case 'minecraft':
      imageType = 'illustration';
      styleKeyword = 'voxel blocks';
      break;
    case 'lego':
      imageType = 'photo';
      styleKeyword = 'toy building bricks blocks';
      break;
    case 'photorealistic':
      imageType = 'photo';
      styleKeyword = 'realistic photography';
      break;
    case 'scifi':
      imageType = 'photo';
      styleKeyword = 'futuristic scifi cyber';
      break;
    case 'horror':
      imageType = 'photo';
      styleKeyword = 'dark moody eerie';
      break;
    case 'biblia':
      imageType = 'photo';
      styleKeyword = 'ancient historical biblical';
      break;
    case 'cinematic':
    default:
      imageType = 'photo';
      styleKeyword = 'cinematic dramatic';
      break;
  }

  // Keywords to search: prioritize English stockKeywords, then prompt/query
  const rawTerms =
    params.stockKeywords && params.stockKeywords.length > 0
      ? params.stockKeywords.slice(0, 2).join(' ')
      : params.query.replace(/\[Escena\s*\d+:?\]/gi, '').slice(0, 50);

  const cleanSubject = rawTerms.replace(/[^\w\s]/gi, ' ').trim();
  const fullSearchQuery = `${cleanSubject} ${styleKeyword}`.trim().slice(0, 95);
  const orientation =
    aspectRatio === '9:16' ? 'vertical' : aspectRatio === '16:9' ? 'horizontal' : 'all';

  if (apiKey) {
    const trySearch = async (q: string, type: string) => {
      try {
        const url = `https://pixabay.com/api/?key=${encodeURIComponent(
          apiKey
        )}&q=${encodeURIComponent(q)}&image_type=${type}&orientation=${orientation}&safesearch=true&per_page=6`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        const data = (await res.json()) as { hits?: any[] };
        return data.hits && data.hits.length > 0 ? data.hits : null;
      } catch {
        return null;
      }
    };

    let hits = await trySearch(fullSearchQuery, imageType);
    if (!hits && cleanSubject) {
      hits = await trySearch(cleanSubject, imageType);
    }
    if (!hits) {
      hits = await trySearch(styleKeyword, imageType);
    }

    if (hits && hits[0]) {
      const chosen = hits[0];
      const downloadUrl =
        chosen.largeImageURL || chosen.webformatURL || chosen.previewURL;
      if (downloadUrl) {
        try {
          const imgRes = await fetch(downloadUrl, { signal: AbortSignal.timeout(15_000) });
          if (imgRes.ok) {
            const arrBuf = await imgRes.arrayBuffer();
            const buf = Buffer.from(arrBuf);
            const imageUrl = await saveNormalizedImageBuffer(
              buf,
              'images',
              'scene_pixabay',
              width,
              height
            );
            return { imageUrl, provider: 'pixabay', seedUsed: 0 };
          }
        } catch (downloadErr) {
          console.warn('[visualEngine] Error descargando imagen de Pixabay:', (downloadErr as Error).message);
        }
      }
    }
  }

  // Fallback 1: Wikimedia Commons
  try {
    const wikiBuf = await tryWikimediaPhotoSearch(`${cleanSubject} ${styleKeyword}`);
    if (wikiBuf) {
      const imageUrl = await saveNormalizedImageBuffer(
        wikiBuf,
        'images',
        'scene_wiki',
        width,
        height
      );
      return { imageUrl, provider: 'wikimedia-photo', seedUsed: 0 };
    }
  } catch {}

  // Fallback 2: Offline elegant backdrop
  const fallbackUrl = await renderOfflineFallbackBackdrop(
    'images',
    'scene_fallback',
    width,
    height
  );
  return { imageUrl: fallbackUrl, provider: 'studio-backdrop', seedUsed: 0 };
}

/**
 * Multi-tier $0 AI Image Generator with local disk caching and consistent project visual seed.
 * Supports explicit engine source: 'local' (GPU RTX 5090), 'gemini' (Gemini Image API), or 'pixabay' (Stock HD).
 * Enforces Golden Anchor Formula: Style Prefix + Character Anchor + Visual Scene Action + Environment Anchor + Lighting.
 */
export async function generateAndCacheSceneImage(params: {
  prompt: string;
  style?: string;
  aspectRatio?: AspectRatioType;
  isThumbnail?: boolean;
  seed?: number;
  stockKeywords?: string[];
  engineSource?: VisualInitialSource;
  imagePrompt?: string;
  comfyPositivePrompt?: string;
  comfyNegativePrompt?: string;
  visualBible?: VisualBible;
  characterAnchor?: string;
  environmentAnchor?: string;
  colorPalette?: string;
  lightingDirective?: string;
}): Promise<{
  imageUrl: string;
  provider: string;
  seedUsed: number;
}> {
  const db = loadDb();
  const aspectRatio: AspectRatioType = params.aspectRatio || '9:16';
  const { width, height } = getTargetDimensions(aspectRatio);
  const subfolder: MediaSubfolder = params.isThumbnail ? 'thumbnails' : 'images';
  const prefix = params.isThumbnail ? 'thumb' : 'scene';

  const seed =
    typeof params.seed === 'number' && params.seed > 0
      ? Math.floor(params.seed) % 2_147_483_000
      : Math.floor(100_000 + Math.random() * 899_999);

  // Character Anchor & Environment Anchor Extraction
  const charAnchor = (
    params.characterAnchor ||
    params.visualBible?.characterAnchor ||
    ''
  ).trim();
  const envAnchor = (
    params.environmentAnchor ||
    params.visualBible?.environmentAnchor ||
    ''
  ).trim();
  const colorPalette = (
    params.colorPalette ||
    params.visualBible?.colorPalette ||
    ''
  ).trim();
  const lightingDir = (
    params.lightingDirective ||
    params.visualBible?.lightingDirective ||
    ''
  ).trim();

  // Core visual action (decouple from spoken audio dialogue)
  let coreVisualAction = '';
  if (params.comfyPositivePrompt && params.comfyPositivePrompt.trim().length > 15) {
    coreVisualAction = params.comfyPositivePrompt.trim();
  } else if (params.imagePrompt && params.imagePrompt.trim().length > 10) {
    coreVisualAction = params.imagePrompt.trim();
  } else {
    const cleaned = params.prompt
      .replace(/^(Narrador|Voz|Locutor|Host):\s*/i, '')
      .replace(/\[Escena\s*\d+:?\]/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    coreVisualAction = `cinematic scene depicting ${cleaned}`;
  }

  const stylePrompt =
    STYLE_DESCRIPTIONS[params.style || 'cinematic'] || STYLE_DESCRIPTIONS.cinematic;

  let fullPrompt = '';
  if (params.comfyPositivePrompt && params.comfyPositivePrompt.trim().length > 15) {
    // Exact technical prompt generated by Visual Bible Director
    fullPrompt = params.comfyPositivePrompt.trim();
  } else if (params.isThumbnail) {
    const parts = [
      'Masterpiece viral video thumbnail, high contrast focal subject',
      charAnchor && charAnchor.toLowerCase() !== 'none' ? `Subject: ${charAnchor}` : '',
      coreVisualAction,
      envAnchor && envAnchor.toLowerCase() !== 'none' ? `Setting: ${envAnchor}` : '',
      `Artistic direction: ${stylePrompt}`,
      colorPalette ? `Color grading: ${colorPalette}` : '',
      lightingDir ? `Lighting: ${lightingDir}` : '',
      'Hyper-detailed, crisp focus, 8k resolution, photorealistic, no watermark, no text',
    ].filter(Boolean);
    fullPrompt = parts.join('. ');
  } else {
    // Golden Anchor Formula composition
    const parts = [
      'Masterpiece cinematic film still',
      charAnchor && charAnchor.toLowerCase() !== 'none' ? `Subject: ${charAnchor}` : '',
      coreVisualAction,
      envAnchor && envAnchor.toLowerCase() !== 'none' ? `Setting: ${envAnchor}` : '',
      `Artistic direction: ${stylePrompt}`,
      colorPalette ? `Color grading: ${colorPalette}` : '',
      lightingDir ? `Lighting: ${lightingDir}` : 'Volumetric cinematic lighting',
      'Sharp detailed focus, 8k resolution, cinematic composition, photorealistic, no watermark, no text',
    ].filter(Boolean);
    fullPrompt = parts.join('. ');
  }

  const engineSource: VisualInitialSource =
    params.engineSource ||
    (db.settings.primaryProvider === 'gemini' ? 'gemini' : 'local');

  // SOURCE 1: PIXABAY STOCK HD
  if (engineSource === 'pixabay') {
    return fetchPixabayStockImage({
      query: params.prompt,
      style: params.style,
      aspectRatio,
      stockKeywords: params.stockKeywords,
    });
  }

  // SOURCE 2: GEMINI IMAGE API
  if (engineSource === 'gemini') {
    const geminiKey =
      db.settings.geminiApiKey?.trim() ||
      (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
        ? process.env.GEMINI_API_KEY
        : '') ||
      process.env.API_KEY;

    if (!geminiKey) {
      throw new Error(
        'No has configurado tu clave API de Gemini. Ve a Configuración de Motores e ingresa tu clave de Google AI Studio.'
      );
    }

    try {
      const gemini = new GoogleGenAI({ apiKey: geminiKey });
      const geminiImageModels = ['gemini-2.5-flash-image', 'gemini-3.1-flash-lite-image'];
      let lastGeminiErr: Error | null = null;

      for (const modelName of geminiImageModels) {
        try {
          const response = await gemini.models.generateContent({
            model: modelName,
            contents: { parts: [{ text: fullPrompt }] },
            config: {
              imageConfig: {
                aspectRatio:
                  aspectRatio === '16:9' ? '16:9' : aspectRatio === '1:1' ? '1:1' : '9:16',
              },
            },
          });
          for (const part of response.candidates?.[0]?.content?.parts ?? []) {
            if (part.inlineData?.data) {
              const mime = part.inlineData.mimeType ?? 'image/png';
              const imageUrl = saveDataUrlToMedia(
                `data:${mime};base64,${part.inlineData.data}`,
                subfolder,
                prefix
              );
              return { imageUrl, provider: 'gemini-image', seedUsed: seed };
            }
          }
        } catch (mErr: any) {
          lastGeminiErr = mErr;
          if (mErr?.status === 429 || mErr?.message?.includes('429') || mErr?.message?.includes('quota')) {
            break; // No need to retry if quota limit: 0
          }
        }
      }

      if (lastGeminiErr) {
        const msg = lastGeminiErr.message || '';
        if (lastGeminiErr.status === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('limit: 0')) {
          throw new Error(
            'Google AI Studio Free Tier tiene límite 0 para generación de imágenes (Error 429: Quota Exceeded). Para usar Gemini Image debes habilitar facturación en tu proyecto de Google Cloud, o usar "GPU Local" / "Pixabay HD" ($0).'
          );
        }
        throw new Error(`Error en Gemini Image API: ${msg.slice(0, 160)}`);
      }
    } catch (err: any) {
      console.warn('[visualEngine] Gemini image error:', err.message);
      throw err;
    }
  }

  // SOURCE 3: LOCAL AI (ComfyUI SD / LTX Z-Image-Turbo / SD Local WebUI / Pollinations Flux / Wikimedia)
  // A. Local ComfyUI SD / SDXL Checkpoint (on port 8188)
  const comfyImgBuf = await tryComfyUiImageGen(fullPrompt, width, height, seed, params.style);
  if (comfyImgBuf) {
    const imageUrl = await saveNormalizedImageBuffer(
      comfyImgBuf,
      subfolder,
      prefix,
      width,
      height
    );
    return { imageUrl, provider: 'comfyui-sd', seedUsed: seed };
  }

  // B. Local LTX Desktop (Z-Image-Turbo on RTX 5090)
  const ltxImgBuf = await tryLtxLocalImageGen(fullPrompt, width, height);
  if (ltxImgBuf) {
    const imageUrl = await saveNormalizedImageBuffer(
      ltxImgBuf,
      subfolder,
      prefix,
      width,
      height
    );
    return { imageUrl, provider: 'ltx-z-image', seedUsed: seed };
  }

  // C. Local Stable Diffusion WebUI / Forge
  const localSdUrl = db.settings.localSdUrl?.trim();
  if (localSdUrl) {
    try {
      const sdRes = await fetch(`${localSdUrl.replace(/\/+$/, '')}/sdapi/v1/txt2img`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: fullPrompt,
          negative_prompt: 'blurry, watermark, ugly, text, deformed, low quality',
          seed,
          steps: 20,
          width,
          height,
        }),
        signal: AbortSignal.timeout(45_000),
      });
      if (sdRes.ok) {
        const sdData = (await sdRes.json()) as { images?: string[] };
        if (sdData.images?.[0]) {
          const buf = Buffer.from(sdData.images[0], 'base64');
          const imageUrl = await saveNormalizedImageBuffer(buf, subfolder, prefix, width, height);
          return { imageUrl, provider: 'sd-local', seedUsed: seed };
        }
      }
    } catch (err) {
      console.warn('[visualEngine] Local SD WebUI no respondió:', (err as Error).message);
    }
  }

  // C. Pollinations Flux AI Generation ($0, high-res)
  const polliBuf = await tryPollinationsImageGen(fullPrompt, width, height, seed);
  if (polliBuf) {
    const imageUrl = await saveNormalizedImageBuffer(
      polliBuf,
      subfolder,
      prefix,
      width,
      height
    );
    return { imageUrl, provider: 'pollinations-flux', seedUsed: seed };
  }

  // D. Factual High-Res Wikimedia Fallback
  try {
    const kwString =
      params.stockKeywords && params.stockKeywords.length > 0
        ? params.stockKeywords.join(' ')
        : params.prompt.slice(0, 70);
    const wikiBuf = await tryWikimediaPhotoSearch(kwString);
    if (wikiBuf) {
      const imageUrl = await saveNormalizedImageBuffer(wikiBuf, subfolder, prefix, width, height);
      return { imageUrl, provider: 'wikimedia-photo', seedUsed: seed };
    }
  } catch {}

  const fallbackUrl = await renderOfflineFallbackBackdrop(subfolder, prefix, width, height);
  return { imageUrl: fallbackUrl, provider: 'studio-backdrop', seedUsed: seed };
}

// ============================================================================
// STOCK B-ROLL HD VIDEO SEARCH & LOCAL FFMPEG NORMALIZATION ($0)
// ============================================================================

async function searchPexelsVideos(
  query: string,
  orientation: 'portrait' | 'landscape' | 'square',
  apiKey: string
): Promise<StockVideoCandidate[]> {
  if (!apiKey) return [];
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(
    query
  )}&orientation=${orientation}&per_page=6&size=medium`;

  const res = await fetch(url, {
    headers: { Authorization: apiKey },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];

  const data = (await res.json()) as { videos?: any[] };
  const results: StockVideoCandidate[] = [];

  for (const v of data.videos || []) {
    const files: any[] = Array.isArray(v.video_files) ? v.video_files : [];
    const mp4Files = files.filter(
      (f) => String(f.file_type || '').includes('mp4') && f.link
    );
    if (mp4Files.length === 0) continue;

    // Prefer HD 720p-1080p file to keep downloads fast and crisp
    mp4Files.sort((a, b) => {
      const aScore = Math.abs((a.height || 720) - 1080);
      const bScore = Math.abs((b.height || 720) - 1080);
      return aScore - bScore;
    });
    const chosen = mp4Files[0];

    results.push({
      id: `pexels-${v.id}`,
      provider: 'pexels',
      title: `Pexels HD #${v.id} (${query})`,
      previewImageUrl: v.image,
      downloadUrl: chosen.link,
      durationSec: v.duration,
      width: chosen.width || v.width,
      height: chosen.height || v.height,
      author: v.user?.name || 'Pexels',
    });
  }

  return results;
}

async function searchPixabayVideos(
  query: string,
  apiKey: string
): Promise<StockVideoCandidate[]> {
  if (!apiKey) return [];
  const url = `https://pixabay.com/api/videos/?key=${encodeURIComponent(
    apiKey
  )}&q=${encodeURIComponent(query)}&per_page=6&safesearch=true`;

  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];

  const data = (await res.json()) as { hits?: any[] };
  const results: StockVideoCandidate[] = [];

  for (const hit of data.hits || []) {
    const medium = hit.videos?.medium || hit.videos?.small || hit.videos?.large;
    if (!medium?.url) continue;

    results.push({
      id: `pixabay-${hit.id}`,
      provider: 'pixabay',
      title: hit.tags ? `Pixabay: ${hit.tags}` : `Pixabay #${hit.id}`,
      previewImageUrl: medium.thumbnail,
      downloadUrl: medium.url,
      durationSec: hit.duration,
      width: medium.width,
      height: medium.height,
      author: hit.user || 'Pixabay',
    });
  }

  return results;
}

async function searchWikimediaVideos(query: string): Promise<StockVideoCandidate[]> {
  const cleanTokens = query
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const queriesToTry = [
    cleanTokens.slice(0, 3).join(' '),
    cleanTokens[0] || 'technology',
  ].filter(Boolean);

  for (const q of queriesToTry) {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
      `filetype:video ${q}`
    )}&gsrlimit=8&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=640&format=json`;

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': STUDIO_USER_AGENT },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;

      const data = (await res.json()) as any;
      const pages = Object.values(data?.query?.pages || {}) as any[];
      const candidates: StockVideoCandidate[] = [];

      for (const p of pages) {
        const info = p?.imageinfo?.[0];
        if (!info?.url) continue;
        // Keep clips between 2s and 60s and < 32 MB for fast download & transcoding
        if (info.size && info.size > 32_000_000) continue;
        if (typeof info.duration === 'number' && info.duration < 2) continue;

        candidates.push({
          id: `wiki-${p.pageid}`,
          provider: 'wikimedia',
          title: String(p.title || 'Clip Commons').replace(/^File:/i, '').replace(/\.\w+$/, ''),
          previewImageUrl: info.thumburl,
          downloadUrl: info.url,
          durationSec: info.duration ? Math.round(info.duration) : undefined,
          width: info.width,
          height: info.height,
          author: 'Wikimedia Commons (CC)',
        });
      }

      if (candidates.length > 0) return candidates;
    } catch {
      continue;
    }
  }

  return [];
}

async function searchNasaVideos(query: string): Promise<StockVideoCandidate[]> {
  const q = query.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
  if (!q) return [];

  try {
    const res = await fetch(
      `https://images-api.nasa.gov/search?q=${encodeURIComponent(q)}&media_type=video&page_size=4`,
      { signal: AbortSignal.timeout(7000) }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as any;
    const items: any[] = data?.collection?.items || [];
    const results: StockVideoCandidate[] = [];

    for (const item of items.slice(0, 3)) {
      const meta = item?.data?.[0];
      const collectionHref: string | undefined = item?.href;
      if (!meta || !collectionHref) continue;

      const colRes = await fetch(collectionHref, { signal: AbortSignal.timeout(5000) });
      if (!colRes.ok) continue;
      const urls = (await colRes.json()) as string[];
      const mp4Url =
        urls.find((u) => u.endsWith('~medium.mp4') || u.endsWith('~mobile.mp4')) ||
        urls.find((u) => u.endsWith('.mp4'));
      if (!mp4Url) continue;

      const thumbLink = (item.links || []).find((l: any) => l.rel === 'preview')?.href;
      results.push({
        id: `nasa-${meta.nasa_id}`,
        provider: 'nasa',
        title: String(meta.title || 'NASA Public Domain Clip').slice(0, 75),
        previewImageUrl: thumbLink,
        downloadUrl: mp4Url.replace(/^http:/, 'https:'),
        author: 'NASA Public Domain',
      });
    }

    return results;
  } catch {
    return [];
  }
}

export async function searchFreeStockVideos(params: {
  query: string;
  aspectRatio?: AspectRatioType;
}): Promise<{
  candidates: StockVideoCandidate[];
  usedApiKeys: { pexels: boolean; pixabay: boolean };
}> {
  const db = loadDb();
  const aspectRatio: AspectRatioType = params.aspectRatio || '9:16';
  const { orientation } = getTargetDimensions(aspectRatio);
  const pexelsKey = db.settings.pexelsApiKey?.trim() || process.env.PEXELS_API_KEY || '';
  const pixabayKey = db.settings.pixabayApiKey?.trim() || process.env.PIXABAY_API_KEY || '';
  const cleanQuery = params.query.trim() || 'technology futuristic';

  const [pexelsRes, pixabayRes, wikiRes, nasaRes] = await Promise.allSettled([
    searchPexelsVideos(cleanQuery, orientation, pexelsKey),
    searchPixabayVideos(cleanQuery, pixabayKey),
    searchWikimediaVideos(cleanQuery),
    searchNasaVideos(cleanQuery),
  ]);

  const all: StockVideoCandidate[] = [
    ...(pexelsRes.status === 'fulfilled' ? pexelsRes.value : []),
    ...(pixabayRes.status === 'fulfilled' ? pixabayRes.value : []),
    ...(wikiRes.status === 'fulfilled' ? wikiRes.value : []),
    ...(nasaRes.status === 'fulfilled' ? nasaRes.value : []),
  ];

  // Fallback general query on zero-key sources if niche query returned 0 clips
  if (all.length === 0) {
    const fallbackWiki = await searchWikimediaVideos('technology abstract motion');
    all.push(...fallbackWiki);
  }

  return {
    candidates: all.slice(0, 10),
    usedApiKeys: {
      pexels: Boolean(pexelsKey),
      pixabay: Boolean(pixabayKey),
    },
  };
}

/**
 * Downloads a stock B-Roll clip and normalizes it with local FFmpeg into an exact-aspect-ratio
 * H.264 `.mp4` in `data/media/videos/` + extracts a `.jpg` poster frame in `data/media/images/`.
 */
export async function downloadAndNormalizeStockVideo(params: {
  downloadUrl: string;
  provider?: string;
  aspectRatio?: AspectRatioType;
  targetDurationSec?: number;
}): Promise<{
  videoClipUrl: string;
  posterImageUrl: string;
  durationSec: number;
  provider: string;
}> {
  const ffmpegPath = resolveLocalToolPath('ffmpeg');
  if (!ffmpegPath) {
    throw new Error('FFmpeg local es requerido para normalizar clips de video B-Roll.');
  }

  const aspectRatio: AspectRatioType = params.aspectRatio || '9:16';
  const { videoWidth, videoHeight } = getTargetDimensions(aspectRatio);
  const clipDur = Math.min(
    14,
    Math.max(5, Math.ceil((Number(params.targetDurationSec) || 6) + 1.5))
  );

  const videosDir = path.join(MEDIA_DIR, 'videos');
  const imagesDir = path.join(MEDIA_DIR, 'images');
  fs.mkdirSync(videosDir, { recursive: true });
  fs.mkdirSync(imagesDir, { recursive: true });

  const tag = `${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const tmpRawPath = path.join(videosDir, `tmp_raw_${tag}.bin`);
  const outMp4Name = `stock_${params.provider || 'broll'}_${tag}.mp4`;
  const outMp4Path = path.join(videosDir, outMp4Name);
  const posterName = `poster_${tag}.jpg`;
  const posterPath = path.join(imagesDir, posterName);

  // Download clip binary to disk with User-Agent
  const dlRes = await fetch(params.downloadUrl, {
    headers: { 'User-Agent': STUDIO_USER_AGENT },
    signal: AbortSignal.timeout(30_000),
  });
  if (!dlRes.ok) {
    throw new Error(`HTTP ${dlRes.status} al descargar clip de video stock.`);
  }
  const rawBuf = Buffer.from(await dlRes.arrayBuffer());
  fs.writeFileSync(tmpRawPath, rawBuf);

  try {
    const vf = `scale=${videoWidth}:${videoHeight}:force_original_aspect_ratio=increase,crop=${videoWidth}:${videoHeight},setsar=1,fps=30`;
    await execFileAsync(
      ffmpegPath,
      [
        '-y',
        '-i',
        tmpRawPath,
        '-t',
        String(clipDur),
        '-vf',
        vf,
        '-an',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '23',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        outMp4Path,
      ],
      { timeout: 35_000 }
    );

    // Extract clean poster frame for thumbnails & Canvas fallback
    await execFileAsync(
      ffmpegPath,
      [
        '-y',
        '-ss',
        '0.3',
        '-i',
        outMp4Path,
        '-frames:v',
        '1',
        '-q:v',
        '2',
        posterPath,
      ],
      { timeout: 10_000 }
    );
  } finally {
    if (fs.existsSync(tmpRawPath)) fs.unlinkSync(tmpRawPath);
  }

  const measuredDur = await probeAudioDurationSec(outMp4Path);
  return {
    videoClipUrl: `/media/videos/${outMp4Name}`,
    posterImageUrl: `/media/images/${posterName}`,
    durationSec: measuredDur,
    provider: params.provider || 'stock',
  };
}

export async function acquireStockVideoForScene(params: {
  scene: Scene;
  aspectRatio: AspectRatioType;
  usedUrls?: Set<string>;
}): Promise<{
  videoClipUrl: string;
  posterImageUrl: string;
  provider: string;
} | null> {
  const query =
    params.scene.stockKeywords && params.scene.stockKeywords.length > 0
      ? params.scene.stockKeywords.slice(0, 3).join(' ')
      : params.scene.imagePrompt?.split(/[,.]/)[0]?.slice(0, 45) || 'technology';

  const { candidates } = await searchFreeStockVideos({
    query,
    aspectRatio: params.aspectRatio,
  });

  for (const cand of candidates) {
    if (params.usedUrls?.has(cand.downloadUrl)) continue;
    try {
      const normalized = await downloadAndNormalizeStockVideo({
        downloadUrl: cand.downloadUrl,
        provider: cand.provider,
        aspectRatio: params.aspectRatio,
        targetDurationSec: params.scene.durationSec || 6,
      });
      params.usedUrls?.add(cand.downloadUrl);
      return {
        videoClipUrl: normalized.videoClipUrl,
        posterImageUrl: normalized.posterImageUrl,
        provider: cand.provider,
      };
    } catch (err) {
      console.warn('[visualEngine] Error normalizando candidato stock, probando siguiente:', (err as Error).message);
    }
  }

  return null;
}

// ============================================================================
// 100% LOCAL GPU VIDEO GENERATION: LTX 2.3 (22B FAST) & WAN 2.1 (14B COMFYUI)
// ============================================================================

function mapCameraMotionToLtx(
  motion?: CameraMotionType
): 'none' | 'dolly_in' | 'dolly_out' | 'dolly_left' | 'dolly_right' | 'focus_shift' {
  if (motion === 'zoom_in') return 'dolly_in';
  if (motion === 'zoom_out') return 'dolly_out';
  if (motion === 'pan_right') return 'dolly_right';
  if (motion === 'pan_left') return 'dolly_left';
  if (motion === 'pulse') return 'focus_shift';
  return 'dolly_in';
}

/**
 * Generates video for a scene using local LTX 2.3 Desktop backend (22B Distilled, ~18s on RTX 5090).
 */
export async function generateSceneWithLtxLocal(params: {
  scene: Scene;
  aspectRatio: AspectRatioType;
  style?: string;
  seed?: number;
  targetDurationSec?: number;
}): Promise<{
  videoClipUrl: string;
  posterImageUrl: string;
  durationSec: number;
  provider: string;
}> {
  const { ltxLocalUrl } = getEngineBaseUrls();
  const ffmpegPath = resolveLocalToolPath('ffmpeg');
  if (!ffmpegPath) throw new Error('FFmpeg es requerido para normalizar el video.');

  // Auto-boot LTX service if not already online
  await startLocalVideoEngine('ltx_local', true);

  const promptToUse =
    params.scene.imagePrompt ||
    `${params.scene.title || 'Escena'}. ${(params.scene.dialogue || '').slice(0, 110)}`;
  const stylePrompt =
    STYLE_DESCRIPTIONS[params.style || 'cinematic'] || STYLE_DESCRIPTIONS.cinematic;
  const fullPrompt = `${promptToUse}, ${stylePrompt}, cinematic 4k, crisp, photorealistic lighting`;

  const ltxRatio: '16:9' | '9:16' = params.aspectRatio === '16:9' ? '16:9' : '9:16';
  const cameraMotion = mapCameraMotionToLtx(params.scene.cameraMotion);

  // Set seed if provided
  if (typeof params.seed === 'number' && params.seed > 0) {
    await fetch(`${ltxLocalUrl}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seed_locked: true,
        locked_seed: Math.floor(params.seed) % 2_000_000_000,
      }),
      signal: AbortSignal.timeout(3000),
    }).catch(() => null);
  }

  const genRes = await fetch(`${ltxLocalUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: fullPrompt,
      resolution: '720p',
      model: 'fast',
      cameraMotion,
      negativePrompt: 'blurry, distorted, low quality, jitter, oversaturated',
      duration: 5,
      fps: 24,
      audio: false,
      aspectRatio: ltxRatio,
    }),
    signal: AbortSignal.timeout(180_000),
  });

  if (!genRes.ok) {
    const errText = await genRes.text().catch(() => '');
    throw new Error(`Error LTX 2.3 (${genRes.status}): ${errText.slice(0, 120)}`);
  }

  const genData = (await genRes.json()) as { status: string; video_path?: string };
  if (genData.status !== 'complete' || !genData.video_path || !fs.existsSync(genData.video_path)) {
    throw new Error('LTX 2.3 no generó el archivo de video esperado.');
  }

  // Copy and normalize into ClipAI media directory
  const videosDir = path.join(MEDIA_DIR, 'videos');
  const imagesDir = path.join(MEDIA_DIR, 'images');
  fs.mkdirSync(videosDir, { recursive: true });
  fs.mkdirSync(imagesDir, { recursive: true });

  const tag = `${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const outMp4Name = `ltx23_${tag}.mp4`;
  const outMp4Path = path.join(videosDir, outMp4Name);
  const posterName = `poster_ltx_${tag}.jpg`;
  const posterPath = path.join(imagesDir, posterName);

  const targetDur =
    typeof params.targetDurationSec === 'number' && params.targetDurationSec > 0
      ? params.targetDurationSec
      : typeof params.scene.durationSec === 'number' && params.scene.durationSec > 0
      ? params.scene.durationSec
      : null;

  const { videoWidth, videoHeight } = getTargetDimensions(params.aspectRatio);
  const vf = `scale=${videoWidth}:${videoHeight}:force_original_aspect_ratio=increase,crop=${videoWidth}:${videoHeight},setsar=1,fps=24`;

  const ffmpegArgs = ['-y'];
  if (targetDur && targetDur > 2.0) {
    ffmpegArgs.push('-stream_loop', '-1');
  }
  ffmpegArgs.push('-i', genData.video_path);
  if (targetDur) {
    ffmpegArgs.push('-t', String(targetDur));
  }
  ffmpegArgs.push(
    '-vf',
    vf,
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '22',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    outMp4Path
  );

  await execFileAsync(ffmpegPath, ffmpegArgs, { timeout: 35_000 });

  // Extract poster frame
  await execFileAsync(
    ffmpegPath,
    ['-y', '-ss', '0.2', '-i', outMp4Path, '-frames:v', '1', '-q:v', '2', posterPath],
    { timeout: 8000 }
  );

  const measuredDur = await probeAudioDurationSec(outMp4Path);
  return {
    videoClipUrl: `/media/videos/${outMp4Name}`,
    posterImageUrl: `/media/images/${posterName}`,
    durationSec: measuredDur || targetDur || 5,
    provider: 'ltx-2.3-local',
  };
}

/**
 * Generates video for a scene using local ComfyUI + Wan 2.1 I2V 14B.
 */
export async function generateSceneWithWanComfyUI(params: {
  scene: Scene;
  aspectRatio: AspectRatioType;
  style?: string;
  seed?: number;
  targetDurationSec?: number;
}): Promise<{
  videoClipUrl: string;
  posterImageUrl: string;
  durationSec: number;
  provider: string;
}> {
  const { comfyUiUrl } = getEngineBaseUrls();
  const ffmpegPath = resolveLocalToolPath('ffmpeg');
  if (!ffmpegPath) throw new Error('FFmpeg es requerido para normalizar el video.');

  // Auto-boot ComfyUI service if not already online
  await startLocalVideoEngine('wan_comfyui', true);

  // 1. Ensure reference start frame for Wan 2.1 I2V (use existing scene.imageUrl or generate reference)
  let refImagePath = '';
  if (params.scene.imageUrl && params.scene.imageUrl.startsWith('/media/')) {
    const candidate = resolveMediaUrlToDiskPath(params.scene.imageUrl);
    if (candidate && fs.existsSync(candidate)) refImagePath = candidate;
  }
  if (!refImagePath) {
    const imgGen = await generateAndCacheSceneImage({
      prompt: params.scene.imagePrompt || params.scene.title,
      style: params.style,
      aspectRatio: params.aspectRatio,
      seed: params.seed,
      imagePrompt: params.scene.imagePrompt,
      comfyPositivePrompt: params.scene.comfyPositivePrompt,
      comfyNegativePrompt: params.scene.comfyNegativePrompt,
    });
    const candidate = resolveMediaUrlToDiskPath(imgGen.imageUrl);
    refImagePath =
      candidate && fs.existsSync(candidate) ? candidate : path.join(DATA_DIR, imgGen.imageUrl);
  }

  // Upload image to ComfyUI /upload/image
  const imgBuffer = fs.readFileSync(refImagePath);
  const boundary = `----WebKitFormBoundary${crypto.randomBytes(8).toString('hex')}`;
  const uploadFilename = `clipai_ref_${Date.now()}.jpg`;

  const pre = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${uploadFilename}"\r\nContent-Type: image/jpeg\r\n\r\n`
  );
  const post = Buffer.from(`\r\n--${boundary}--\r\n`);
  const formBody = Buffer.concat([pre, imgBuffer, post]);

  const uploadRes = await fetch(`${comfyUiUrl}/upload/image`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: formBody,
    signal: AbortSignal.timeout(15_000),
  });
  if (!uploadRes.ok) {
    throw new Error('No se pudo subir la imagen de referencia a ComfyUI.');
  }

  const promptToUse =
    params.scene.imagePrompt ||
    `${params.scene.title || 'Escena'}. ${(params.scene.dialogue || '').slice(0, 110)}`;
  const stylePrompt =
    STYLE_DESCRIPTIONS[params.style || 'cinematic'] || STYLE_DESCRIPTIONS.cinematic;
  const fullPrompt = `${promptToUse}, ${stylePrompt}, cinematic 4k, smooth cinematic motion, masterpiece`;
  const seed =
    typeof params.seed === 'number' && params.seed > 0
      ? Math.floor(params.seed) % 2_000_000_000
      : Math.floor(100_000 + Math.random() * 899_999);

  const isPortrait = params.aspectRatio !== '16:9';
  const width = isPortrait ? 480 : 832;
  const height = isPortrait ? 832 : 480;

  // Complete ComfyUI Prompt Workflow for Wan 2.1 14B I2V
  const workflowPrompt = {
    '1': {
      class_type: 'LoadWanVideoT5TextEncoder',
      inputs: {
        model_name: 'umt5-xxl-enc-fp8_e4m3fn.safetensors',
        precision: 'bf16',
        load_device: 'offload_device',
        quantization: 'disabled',
      },
    },
    '2': {
      class_type: 'WanVideoTextEncode',
      inputs: {
        positive_prompt: fullPrompt,
        negative_prompt: 'blurry, low quality, jitter, flickering, text, watermark, deformed',
        t5: ['1', 0],
        force_offload: true,
        device: 'gpu',
      },
    },
    '3': {
      class_type: 'WanVideoVAELoader',
      inputs: {
        model_name: 'Wan2_1_VAE_bf16.safetensors',
        precision: 'bf16',
      },
    },
    '4': {
      class_type: 'CLIPVisionLoader',
      inputs: {
        clip_name: 'wan_image_encoder.safetensors',
      },
    },
    '5': {
      class_type: 'LoadImage',
      inputs: {
        image: uploadFilename,
      },
    },
    '6': {
      class_type: 'WanVideoClipVisionEncode',
      inputs: {
        clip_vision: ['4', 0],
        image_1: ['5', 0],
        strength_1: 1.0,
        strength_2: 1.0,
        crop: 'center',
        combine_embeds: 'average',
        force_offload: true,
      },
    },
    '7': {
      class_type: 'WanVideoImageToVideoEncode',
      inputs: {
        width,
        height,
        num_frames: 25,
        noise_aug_strength: 0.02,
        start_latent_strength: 1.0,
        end_latent_strength: 1.0,
        force_offload: true,
        vae: ['3', 0],
        clip_embeds: ['6', 0],
        start_image: ['5', 0],
        fun_or_fl2v_model: false,
      },
    },
    '8': {
      class_type: 'WanVideoBlockSwap',
      inputs: {
        blocks_to_swap: 0,
        offload_img_emb: false,
        offload_txt_emb: false,
        use_non_blocking: true,
        vace_blocks_to_swap: 0,
      },
    },
    '9': {
      class_type: 'WanVideoModelLoader',
      inputs: {
        model: 'wan2.1_i2v_480p_14B.safetensors',
        base_precision: 'bf16',
        quantization: 'fp8_e4m3fn',
        load_device: 'offload_device',
        attention_mode: 'comfy',
        block_swap_args: ['8', 0],
      },
    },
    '10': {
      class_type: 'WanVideoSampler',
      inputs: {
        model: ['9', 0],
        image_embeds: ['7', 0],
        text_embeds: ['2', 0],
        steps: 12,
        cfg: 3.5,
        shift: 5.0,
        seed,
        force_offload: true,
        scheduler: 'unipc',
        riflex_freq_index: 0,
      },
    },
    '11': {
      class_type: 'WanVideoDecode',
      inputs: {
        vae: ['3', 0],
        samples: ['10', 0],
        enable_vae_tiling: true,
        tile_x: 272,
        tile_y: 272,
        tile_stride_x: 144,
        tile_stride_y: 128,
      },
    },
    '12': {
      class_type: 'VHS_VideoCombine',
      inputs: {
        images: ['11', 0],
        frame_rate: 16,
        loop_count: 0,
        filename_prefix: 'wan21_clipai',
        format: 'video/h264-mp4',
        pingpong: false,
        save_output: true,
      },
    },
  };

  const queueRes = await fetch(`${comfyUiUrl}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflowPrompt }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!queueRes.ok) {
    const txt = await queueRes.text().catch(() => '');
    throw new Error(`Error en cola ComfyUI (${queueRes.status}): ${txt.slice(0, 120)}`);
  }
  const { prompt_id } = (await queueRes.json()) as { prompt_id?: string };
  if (!prompt_id) throw new Error('ComfyUI no devolvió prompt_id.');

  // Poll until prompt finishes in ComfyUI history
  const deadline = Date.now() + 600_000; // 10 min timeout
  let outputFilename = '';
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2500));
    const histRes = await fetch(`${comfyUiUrl}/history/${prompt_id}`, {
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);
    if (!histRes || !histRes.ok) continue;

    const histData = (await histRes.json()) as Record<string, any>;
    const runInfo = histData[prompt_id];
    if (runInfo) {
      if (runInfo.status?.status_str === 'error') {
        throw new Error(
          `ComfyUI Wan 2.1 reportó error: ${JSON.stringify(runInfo.status?.messages || '')}`
        );
      }
      const outputs = runInfo.outputs || {};
      const node12Out = outputs['12'];
      const vFiles = node12Out?.gifs || node12Out?.videos || node12Out?.images || [];
      if (vFiles.length > 0 && vFiles[0]?.filename) {
        outputFilename = vFiles[0].filename;
        break;
      }
    }
  }

  if (!outputFilename) {
    // Check fallback in ComfyUI output directory
    const comfyOutputDir = path.join(COMFYUI_ROOT, 'ComfyUI', 'output');
    if (fs.existsSync(comfyOutputDir)) {
      const candidates = fs
        .readdirSync(comfyOutputDir)
        .filter((f) => f.startsWith('wan21_clipai') && f.endsWith('.mp4'))
        .sort((a, b) => fs.statSync(path.join(comfyOutputDir, b)).mtimeMs - fs.statSync(path.join(comfyOutputDir, a)).mtimeMs);
      if (candidates[0]) {
        outputFilename = candidates[0];
      }
    }
  }

  if (!outputFilename) {
    throw new Error('ComfyUI completó la generación pero no se encontró el archivo MP4 de salida.');
  }

  // Download/copy generated video into ClipAI media
  const dlRes = await fetch(
    `${comfyUiUrl}/view?filename=${encodeURIComponent(outputFilename)}&type=output`,
    { signal: AbortSignal.timeout(20_000) }
  );
  if (!dlRes.ok) {
    throw new Error('No se pudo recuperar el video MP4 renderizado desde ComfyUI.');
  }

  const videosDir = path.join(MEDIA_DIR, 'videos');
  const imagesDir = path.join(MEDIA_DIR, 'images');
  fs.mkdirSync(videosDir, { recursive: true });
  fs.mkdirSync(imagesDir, { recursive: true });

  const tag = `${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const outMp4Name = `wan21_${tag}.mp4`;
  const outMp4Path = path.join(videosDir, outMp4Name);
  const posterName = `poster_wan_${tag}.jpg`;
  const posterPath = path.join(imagesDir, posterName);

  const rawMp4Buf = Buffer.from(await dlRes.arrayBuffer());
  const tmpRaw = path.join(videosDir, `tmp_wan_${tag}.mp4`);
  fs.writeFileSync(tmpRaw, rawMp4Buf);

  try {
    const targetDur =
      typeof params.targetDurationSec === 'number' && params.targetDurationSec > 0
        ? params.targetDurationSec
        : typeof params.scene.durationSec === 'number' && params.scene.durationSec > 0
        ? params.scene.durationSec
        : null;

    const { videoWidth, videoHeight } = getTargetDimensions(params.aspectRatio);
    const vf = `scale=${videoWidth}:${videoHeight}:force_original_aspect_ratio=increase,crop=${videoWidth}:${videoHeight},setsar=1,fps=24`;

    const ffmpegArgs = ['-y'];
    if (targetDur && targetDur > 1.8) {
      ffmpegArgs.push('-stream_loop', '-1');
    }
    ffmpegArgs.push('-i', tmpRaw);
    if (targetDur) {
      ffmpegArgs.push('-t', String(targetDur));
    }
    ffmpegArgs.push(
      '-vf',
      vf,
      '-an',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '22',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      outMp4Path
    );

    await execFileAsync(ffmpegPath, ffmpegArgs, { timeout: 35_000 });

    // Extract poster frame
    await execFileAsync(
      ffmpegPath,
      ['-y', '-ss', '0.2', '-i', outMp4Path, '-frames:v', '1', '-q:v', '2', posterPath],
      { timeout: 8000 }
    );
  } finally {
    if (fs.existsSync(tmpRaw)) fs.unlinkSync(tmpRaw);
  }

  const measuredDur = await probeAudioDurationSec(outMp4Path);
  return {
    videoClipUrl: `/media/videos/${outMp4Name}`,
    posterImageUrl: `/media/images/${posterName}`,
    durationSec: measuredDur || targetDur || 3,
    provider: 'wan-2.1-comfyui',
  };
}

/**
 * Unified Local Scene Video Generator: Dispatches to either LTX 2.3 Local or Wan 2.1 ComfyUI.
 */
export async function generateSceneLocalVideo(params: {
  scene: Scene;
  aspectRatio: AspectRatioType;
  engine?: LocalVideoEngineId;
  style?: string;
  seed?: number;
  targetDurationSec?: number;
}): Promise<{
  videoClipUrl: string;
  posterImageUrl: string;
  durationSec: number;
  provider: string;
}> {
  const db = loadDb();
  const engineToUse: LocalVideoEngineId =
    params.engine || db.settings.preferredLocalVideoEngine || 'wan_comfyui';
  const targetDurationSec =
    typeof params.targetDurationSec === 'number' && params.targetDurationSec > 0
      ? params.targetDurationSec
      : params.scene.durationSec;

  if (engineToUse === 'wan_comfyui') {
    return generateSceneWithWanComfyUI({
      scene: params.scene,
      aspectRatio: params.aspectRatio,
      style: params.style,
      seed: params.seed,
      targetDurationSec,
    });
  }

  return generateSceneWithLtxLocal({
    scene: params.scene,
    aspectRatio: params.aspectRatio,
    style: params.style,
    seed: params.seed,
    targetDurationSec,
  });
}

/**
 * Batch Hybrid Visual Orchestrator for all scenes in a project:
 * - `ltx_local`: 100% Local GPU Video via LTX 2.3 (22B Distilled)
 * - `wan_comfyui`: 100% Local GPU Video via ComfyUI (Wan 2.1 14B)
 * - `hybrid`: Alternates Local GPU Video (LTX 2.3 / Wan 2.1) with real HD Stock B-Roll clips!
 * - `stock_broll`: Real HD MP4 stock B-Roll clips per scene
 * - `ai_images`: Fast local keyframe images (LTX Z-Image-Turbo / Local SD)
 */
export async function generateVisualsForAllScenes(params: {
  scenes: Scene[];
  style: string;
  aspectRatio: AspectRatioType;
  visualMode?: VisualModeType;
  visualSeed?: number;
}): Promise<{
  scenes: Scene[];
  visualSeed: number;
}> {
  const db = loadDb();
  const mode: VisualModeType = params.visualMode || 'hybrid';
  const baseSeed =
    typeof params.visualSeed === 'number' && params.visualSeed > 0
      ? params.visualSeed
      : Math.floor(100_000 + Math.random() * 899_999);

  const preferredLocalEngine: LocalVideoEngineId =
    mode === 'wan_comfyui'
      ? 'wan_comfyui'
      : mode === 'ltx_local'
      ? 'ltx_local'
      : db.settings.preferredLocalVideoEngine || 'ltx_local';

  const usedStockUrls = new Set<string>();
  const updatedScenes: Scene[] = [];

  for (let i = 0; i < params.scenes.length; i++) {
    const sc = params.scenes[i];
    const wantStockVideo =
      mode === 'stock_broll' || (mode === 'hybrid' && i % 2 === 1);

    if (wantStockVideo) {
      const stockResult = await acquireStockVideoForScene({
        scene: sc,
        aspectRatio: params.aspectRatio,
        usedUrls: usedStockUrls,
      });

      if (stockResult) {
        updatedScenes.push({
          ...sc,
          imageUrl: stockResult.posterImageUrl,
          videoClipUrl: stockResult.videoClipUrl,
          animatedUrl: stockResult.videoClipUrl,
          visualSource: 'stock_video',
          visualProvider: stockResult.provider,
          isGeneratingImage: false,
        });
        continue;
      }
    }

    // Try Local GPU Video (LTX 2.3 or Wan 2.1)
    if (mode === 'ltx_local' || mode === 'wan_comfyui' || (mode === 'hybrid' && i % 2 === 0)) {
      try {
        const localVid = await generateSceneLocalVideo({
          scene: sc,
          aspectRatio: params.aspectRatio,
          engine: preferredLocalEngine,
          style: params.style,
          seed: baseSeed + i * 29,
        });

        updatedScenes.push({
          ...sc,
          imageUrl: localVid.posterImageUrl,
          videoClipUrl: localVid.videoClipUrl,
          animatedUrl: localVid.videoClipUrl,
          visualSource:
            preferredLocalEngine === 'wan_comfyui'
              ? 'local_wan_video'
              : 'local_ltx_video',
          visualProvider: localVid.provider,
          isGeneratingImage: false,
        });
        continue;
      } catch (err) {
        console.warn(
          `[visualEngine] Error en video local ${preferredLocalEngine} para escena ${i + 1}, usando respaldo:`,
          (err as Error).message
        );
      }
    }

    // Fast local keyframe image fallback (Z-Image-Turbo / SD / Wikimedia)
    const promptToUse = sc.imagePrompt || `${sc.title}. ${sc.dialogue.slice(0, 100)}`;
    const aiResult = await generateAndCacheSceneImage({
      prompt: promptToUse,
      style: params.style,
      aspectRatio: params.aspectRatio,
      isThumbnail: false,
      seed: baseSeed + i * 17,
      stockKeywords: sc.stockKeywords,
      imagePrompt: sc.imagePrompt,
      comfyPositivePrompt: sc.comfyPositivePrompt,
      comfyNegativePrompt: sc.comfyNegativePrompt,
    });

    updatedScenes.push({
      ...sc,
      imageUrl: aiResult.imageUrl,
      videoClipUrl: undefined,
      animatedUrl: undefined,
      visualSource: 'ai_image',
      visualProvider: aiResult.provider,
      isGeneratingImage: false,
    });
  }

  return {
    scenes: updatedScenes,
    visualSeed: baseSeed,
  };
}


