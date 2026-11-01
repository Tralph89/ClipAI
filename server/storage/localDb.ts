import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  AppSettings,
  DEFAULT_CHANNELS,
  DEFAULT_SETTINGS,
  Project,
  ScheduledPost,
  SocialChannel,
  TrendItem,
} from '../../src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT_DIR = path.resolve(__dirname, '../..');
export const DATA_DIR = path.join(ROOT_DIR, 'data');
export const MEDIA_DIR = path.join(DATA_DIR, 'media');
export const DB_FILE = path.join(DATA_DIR, 'db.json');

const MEDIA_SUBDIRS = ['audio', 'images', 'videos', 'thumbnails'] as const;
export type MediaSubfolder = (typeof MEDIA_SUBDIRS)[number];

export interface LocalDatabaseSchema {
  version: number;
  settings: AppSettings;
  channels: SocialChannel[];
  projects: Project[];
  scheduledPosts: ScheduledPost[];
  trends: TrendItem[];
}

const INITIAL_TRENDS: TrendItem[] = [
  {
    id: 'trend-init-1',
    title: 'Agentes de IA Locales y Automatización Sin Código Dominan Redes',
    summary:
      'Creadores y negocios están migrando a modelos locales y flujos de 1 clic para producir contenido diario sin depender de suscripciones costosas.',
    viralScore: 96,
    category: 'Inteligencia Artificial & Tech',
    whyTrending: 'Adopción acelerada de herramientas abiertas como Ollama, FFmpeg y voces neurales.',
    suggestedHook:
      'El 90% sigue pagando cientos de dólares al mes por IA cuando tu propia PC puede hacer esto gratis...',
    angle: 'Comparativa directa de ahorro + demostración real en menos de 60 segundos.',
    recommendedFormats: ['9:16', '16:9'],
    recommendedPlatforms: ['youtube_shorts', 'tiktok', 'facebook_reels', 'youtube_long'],
    keywords: ['IALocal', 'Ollama', 'Automatizacion', 'Productividad'],
    sources: [
      { title: 'Ollama Blog', uri: 'https://ollama.com/blog' },
      { title: 'TechCrunch AI', uri: 'https://techcrunch.com/category/artificial-intelligence/' },
    ],
    detectedAt: Date.now(),
  },
  {
    id: 'trend-init-2',
    title: 'El Nuevo Hábito Financiero de Automatización Semanal que Reemplaza al 50/30/20',
    summary:
      'Videos cortos de finanzas personales con ejemplos visuales claros superan millones de reproducciones en YouTube Shorts, TikTok y Facebook Reels.',
    viralScore: 92,
    category: 'Finanzas & Negocios',
    whyTrending: 'Búsqueda masiva de métodos simples para proteger ahorros frente a gastos hormiga digitales.',
    suggestedHook:
      'Si todavía intentas ahorrar lo que te sobra a fin de mes, este cambio de 5 minutos te abrirá los ojos.',
    angle: 'Explicación paso a paso con cifras reales y cierre accionable.',
    recommendedFormats: ['9:16', '16:9'],
    recommendedPlatforms: ['youtube_shorts', 'tiktok', 'facebook_reels'],
    keywords: ['FinanzasPersonales', 'Ahorro', 'DineroInteligente', 'Habitos'],
    sources: [{ title: 'Bloomberg Línea', uri: 'https://www.bloomberglinea.com/' }],
    detectedAt: Date.now(),
  },
  {
    id: 'trend-init-3',
    title: 'Hallazgo del Telescopio James Webb Desafía lo que Sabíamos del Universo Temprano',
    summary:
      'Galaxias supermasivas detectadas en etapas tempranas del cosmos generan millones de vistas en formatos documentales cortos y largos.',
    viralScore: 89,
    category: 'Ciencia & Documental',
    whyTrending: 'Nuevas imágenes espaciales de alta resolución compartidas globalmente.',
    suggestedHook:
      'El telescopio James Webb acaba de fotografiar algo en el espacio profundo que rompe todas las reglas...',
    angle: 'Narrativa de misterio científico con atmósfera cinematográfica.',
    recommendedFormats: ['16:9', '9:16'],
    recommendedPlatforms: ['youtube_long', 'youtube_shorts', 'facebook_reels', 'tiktok'],
    keywords: ['JamesWebb', 'Ciencia', 'Espacio', 'Documental'],
    sources: [{ title: 'NASA Webb Mission', uri: 'https://science.nasa.gov/mission/webb/' }],
    detectedAt: Date.now(),
  },
];

let cachedDb: LocalDatabaseSchema | null = null;

export function ensureStorageDirectories(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  for (const sub of MEDIA_SUBDIRS) {
    const dir = path.join(MEDIA_DIR, sub);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

function buildDefaultDb(): LocalDatabaseSchema {
  return {
    version: 1,
    settings: {
      ...DEFAULT_SETTINGS,
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL || DEFAULT_SETTINGS.ollamaBaseUrl,
      ollamaModel: process.env.OLLAMA_MODEL || DEFAULT_SETTINGS.ollamaModel,
      geminiApiKey: process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
        ? process.env.GEMINI_API_KEY
        : '',
      groqApiKey: process.env.GROQ_API_KEY || '',
      pexelsApiKey: process.env.PEXELS_API_KEY || '',
      pixabayApiKey: process.env.PIXABAY_API_KEY || '',
    },
    channels: DEFAULT_CHANNELS,
    projects: [],
    scheduledPosts: [],
    trends: INITIAL_TRENDS,
  };
}

export function loadDb(): LocalDatabaseSchema {
  ensureStorageDirectories();
  if (cachedDb) return cachedDb;

  if (!fs.existsSync(DB_FILE)) {
    cachedDb = buildDefaultDb();
    saveDb(cachedDb);
    return cachedDb;
  }

  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<LocalDatabaseSchema>;
    const defaults = buildDefaultDb();
    cachedDb = {
      version: 1,
      settings: { ...defaults.settings, ...(parsed.settings || {}) },
      channels: Array.isArray(parsed.channels) && parsed.channels.length > 0 ? parsed.channels : defaults.channels,
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      scheduledPosts: Array.isArray(parsed.scheduledPosts) ? parsed.scheduledPosts : [],
      trends: Array.isArray(parsed.trends) && parsed.trends.length > 0 ? parsed.trends : defaults.trends,
    };
    return cachedDb;
  } catch (err) {
    console.error('[localDb] Error reading db.json, initializing fresh copy:', err);
    cachedDb = buildDefaultDb();
    saveDb(cachedDb);
    return cachedDb;
  }
}

export function saveDb(nextDb: LocalDatabaseSchema): void {
  ensureStorageDirectories();
  cachedDb = nextDb;
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(nextDb, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);
}

function extensionFromMime(mime: string): string {
  const lower = mime.toLowerCase();
  if (lower.includes('wav')) return 'wav';
  if (lower.includes('mpeg') || lower.includes('mp3')) return 'mp3';
  if (lower.includes('ogg')) return 'ogg';
  if (lower.includes('mp4')) return 'mp4';
  if (lower.includes('webm')) return 'webm';
  if (lower.includes('jpeg') || lower.includes('jpg')) return 'jpg';
  if (lower.includes('webp')) return 'webp';
  return 'png';
}

export function saveDataUrlToMedia(
  dataUrl: string,
  subfolder: MediaSubfolder,
  prefix: string = 'asset'
): string {
  ensureStorageDirectories();
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return dataUrl;
  }

  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return dataUrl;

  const header = dataUrl.slice(0, commaIdx);
  const base64Payload = dataUrl.slice(commaIdx + 1);
  const mimeMatch = header.match(/data:([^;]+);base64/i);
  const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const ext = extensionFromMime(mimeType);

  const buffer = Buffer.from(base64Payload, 'base64');
  const hash = crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 12);
  const filename = `${prefix}_${hash}.${ext}`;
  const fullPath = path.join(MEDIA_DIR, subfolder, filename);

  if (!fs.existsSync(fullPath)) {
    fs.writeFileSync(fullPath, buffer);
  }

  return `/media/${subfolder}/${filename}`;
}

export function saveBufferToMedia(
  buffer: Buffer,
  subfolder: MediaSubfolder,
  filename: string
): string {
  ensureStorageDirectories();
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fullPath = path.join(MEDIA_DIR, subfolder, safeName);
  fs.writeFileSync(fullPath, buffer);
  return `/media/${subfolder}/${safeName}`;
}

/**
 * Automatically extracts any embedded base64 data URLs inside a Project into `/media/...` files
 * so `db.json` always stays small, fast, and immune to browser storage limits.
 */
export function normalizeProjectMedia(project: Project): Project {
  const cloned: Project = JSON.parse(JSON.stringify(project));

  if (cloned.state.voiceAudioUrl?.startsWith('data:')) {
    cloned.state.voiceAudioUrl = saveDataUrlToMedia(
      cloned.state.voiceAudioUrl,
      'audio',
      `${cloned.id}_voice`
    );
  }
  if (cloned.state.musicAudioUrl?.startsWith('data:')) {
    cloned.state.musicAudioUrl = saveDataUrlToMedia(
      cloned.state.musicAudioUrl,
      'audio',
      `${cloned.id}_music`
    );
  }
  if (cloned.state.mixedAudioUrl?.startsWith('data:')) {
    cloned.state.mixedAudioUrl = saveDataUrlToMedia(
      cloned.state.mixedAudioUrl,
      'audio',
      `${cloned.id}_mix`
    );
  }
  if (cloned.state.renderedVideoUrl?.startsWith('data:')) {
    cloned.state.renderedVideoUrl = saveDataUrlToMedia(
      cloned.state.renderedVideoUrl,
      'videos',
      `${cloned.id}_render`
    );
  }
  if (cloned.state.metadata?.thumbnailUrl?.startsWith('data:')) {
    cloned.state.metadata.thumbnailUrl = saveDataUrlToMedia(
      cloned.state.metadata.thumbnailUrl,
      'thumbnails',
      `${cloned.id}_thumb`
    );
  }

  cloned.scenes = (cloned.scenes || []).map((scene, idx) => {
    const nextScene = { ...scene };
    if (nextScene.imageUrl?.startsWith('data:')) {
      nextScene.imageUrl = saveDataUrlToMedia(
        nextScene.imageUrl,
        'images',
        `${cloned.id}_s${idx + 1}`
      );
    }
    if (nextScene.videoClipUrl?.startsWith('data:')) {
      nextScene.videoClipUrl = saveDataUrlToMedia(
        nextScene.videoClipUrl,
        'videos',
        `${cloned.id}_broll_s${idx + 1}`
      );
    }
    if (nextScene.animatedUrl?.startsWith('data:')) {
      nextScene.animatedUrl = saveDataUrlToMedia(
        nextScene.animatedUrl,
        'videos',
        `${cloned.id}_anim_s${idx + 1}`
      );
    }
    if (nextScene.voiceAudioUrl?.startsWith('data:')) {
      nextScene.voiceAudioUrl = saveDataUrlToMedia(
        nextScene.voiceAudioUrl,
        'audio',
        `${cloned.id}_voice_s${idx + 1}`
      );
    }
    return nextScene;
  });

  return cloned;
}

export function resolveMediaUrlToDiskPath(mediaUrl?: string): string | null {
  if (!mediaUrl || !mediaUrl.startsWith('/media/')) return null;
  const rel = mediaUrl.replace(/^\/media\//, '').replace(/\.\./g, '');
  const fullPath = path.join(MEDIA_DIR, rel);
  return fs.existsSync(fullPath) ? fullPath : null;
}

export function countStoredMediaFiles(): number {
  ensureStorageDirectories();
  let count = 0;
  for (const sub of MEDIA_SUBDIRS) {
    const dir = path.join(MEDIA_DIR, sub);
    if (fs.existsSync(dir)) {
      count += fs.readdirSync(dir).length;
    }
  }
  return count;
}

