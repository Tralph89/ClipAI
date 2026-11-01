import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { AspectRatioType, Scene, SubtitleStyleType, WordTiming } from '../../src/types.ts';
import { MEDIA_DIR, resolveMediaUrlToDiskPath } from '../storage/localDb.ts';
import { resolveLocalToolPath } from './systemTools.ts';
import { probeAudioDurationSec, computeSceneWordTimings } from './voiceEngine.ts';
import { mixVoiceAndMusicWithDucking } from './audioMixer.ts';

const execFileAsync = promisify(execFile);

export interface RenderJobProgress {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number; // 0 to 100
  stage: string;
  videoUrl?: string;
  durationSec?: number;
  fileSizeMb?: number;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

const activeJobs = new Map<string, RenderJobProgress>();

export function getRenderJobStatus(jobId: string): RenderJobProgress | undefined {
  return activeJobs.get(jobId);
}

export function listRecentRenderJobs(): RenderJobProgress[] {
  return Array.from(activeJobs.values()).sort((a, b) => b.createdAt - a.createdAt);
}

function getDimensions(aspectRatio: AspectRatioType): { width: number; height: number } {
  switch (aspectRatio) {
    case '16:9':
      return { width: 1920, height: 1080 };
    case '1:1':
      return { width: 1080, height: 1080 };
    case '9:16':
    default:
      return { width: 1080, height: 1920 };
  }
}

function formatAssTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/**
 * Escapes Windows path for FFmpeg filter arguments:
 * Converts backslashes to forward slashes and escapes colons (e.g. C\:).
 */
function escapeFilterPath(fullPath: string): string {
  return fullPath.replace(/\\/g, '/').replace(':', '\\:');
}

/**
 * Generates an Advanced SubStation Alpha (.ass) subtitle file formatted
 * specifically for high-retention vertical/horizontal shorts with dynamic styles.
 */
export function generateAssSubtitlesFile(params: {
  scenes: Scene[];
  outputPath: string;
  width: number;
  height: number;
  style?: SubtitleStyleType;
}): void {
  const { scenes, outputPath, width, height, style = 'hormozi' } = params;

  // Margin from bottom safe zone: 340px for 1920p height, proportional for others
  const marginV = Math.round(height * (height >= 1920 ? 0.177 : 0.14));
  const fontSize = Math.round(width * (width > height ? 0.046 : 0.068));

  // Style configurations
  // Colors in ASS format: &HAABBGGRR&
  let styleLine = '';
  switch (style) {
    case 'neon':
      // Primary: Electric Cyan (&H00F8BD38&), Outline: Deep Purple/Magenta (&H00640F64&)
      styleLine = `Style: Default,Impact,${fontSize},&H00F8BD38,&H00FFFFFF,&H00640F64,&H80000000,-1,0,0,0,100,100,0,0,1,5,3,2,40,40,${marginV},1`;
      break;
    case 'boxed':
      // White text on rounded violet opaque box (&H00ED3A7C&)
      styleLine = `Style: Default,Arial Black,${fontSize},&H00FFFFFF,&H00FFFFFF,&H00ED3A7C,&H90000000,-1,0,0,0,100,100,0,0,3,6,0,2,40,40,${marginV},1`;
      break;
    case 'minimal':
      // Clean white text with subtle dark shadow
      styleLine = `Style: Default,Arial,${Math.round(fontSize * 0.82)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H60000000,-1,0,0,0,100,100,0,0,1,2,1,2,40,40,${marginV},1`;
      break;
    case 'hormozi':
    default:
      // Alex Hormozi signature style: Impact font, thick black stroke, deep shadow, yellow punch
      styleLine = `Style: Default,Impact,${fontSize},&H0015CCFA,&H00FFFFFF,&H00000000,&H90000000,-1,0,0,0,100,100,0,0,1,5,3,2,40,40,${marginV},1`;
      break;
  }

  const activeColorCode = style === 'neon' ? '\\c&H00F8BD38&' : '\\c&H0015CCFA&';
  const inactiveColorCode = '\\c&H00FFFFFF&';

  const events: string[] = [];
  let globalCursor = 0;

  for (let sIdx = 0; sIdx < scenes.length; sIdx++) {
    const scene = scenes[sIdx];
    const sStart = typeof scene.startSec === 'number' ? scene.startSec : globalCursor;
    const sDur = typeof scene.durationSec === 'number' && scene.durationSec > 0 ? scene.durationSec : 4.0;
    const sEnd = sStart + sDur;
    globalCursor = sEnd + 0.14;

    const dialogue = (scene.dialogue || '').trim();
    if (!dialogue) continue;

    const timings: WordTiming[] =
      scene.wordTimings && scene.wordTimings.length > 0
        ? scene.wordTimings
        : computeSceneWordTimings(dialogue, sDur);

    // Group words into punchy short phrases of 3 to 4 words
    const chunkSize = 4;
    for (let c = 0; c < timings.length; c += chunkSize) {
      const chunk = timings.slice(c, c + chunkSize);
      if (chunk.length === 0) continue;

      const chunkStartSec = sStart + chunk[0].startSec;
      const chunkEndSec = sStart + chunk[chunk.length - 1].endSec;

      if (style === 'minimal') {
        const lineText = chunk.map((w) => w.word).join(' ');
        events.push(
          `Dialogue: 0,${formatAssTimestamp(chunkStartSec)},${formatAssTimestamp(
            chunkEndSec
          )},Default,,0,0,0,,${lineText}`
        );
      } else {
        // Karaoke active-word highlight for Hormozi / Neon
        for (let wIdx = 0; wIdx < chunk.length; wIdx++) {
          const w = chunk[wIdx];
          const wStart = sStart + w.startSec;
          const wEnd =
            wIdx === chunk.length - 1 ? chunkEndSec : Math.min(chunkEndSec, sStart + chunk[wIdx + 1].startSec);

          const formattedWords = chunk.map((cw, i) => {
            const upper = cw.word.toUpperCase();
            if (i === wIdx) {
              return `{${activeColorCode}}${upper}{${inactiveColorCode}}`;
            }
            return upper;
          });

          events.push(
            `Dialogue: 0,${formatAssTimestamp(wStart)},${formatAssTimestamp(
              wEnd
            )},Default,,0,0,0,,{${inactiveColorCode}}${formattedWords.join(' ')}`
          );
        }
      }
    }
  }

  const assContent = [
    '[Script Info]',
    'Title: ClipAI High-Retention Master Subtitles',
    'ScriptType: v4.00+',
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    styleLine,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...events,
    '',
  ].join('\r\n');

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, assContent, 'utf-8');
}

/**
 * Renders an individual scene to a standardized intermediate MP4 segment
 * (1080x1920 or target dimensions, 30 fps, YUV420P) ready for lossless concatenation.
 */
async function renderSceneSegment(params: {
  scene: Scene;
  sceneIndex: number;
  targetWidth: number;
  targetHeight: number;
  outputPath: string;
  ffmpegPath: string;
}): Promise<void> {
  const { scene, targetWidth, targetHeight, outputPath, ffmpegPath } = params;
  const duration = typeof scene.durationSec === 'number' && scene.durationSec > 0 ? scene.durationSec : 4.0;
  const totalFrames = Math.max(30, Math.round(duration * 30));

  // Determine media source
  const videoSrc = scene.videoClipUrl || scene.animatedUrl;
  const videoPath = videoSrc ? resolveMediaUrlToDiskPath(videoSrc) : null;
  const imagePath = scene.imageUrl ? resolveMediaUrlToDiskPath(scene.imageUrl) : null;

  if (videoPath && fs.existsSync(videoPath)) {
    // Scene with video clip (Wan 2.1, LTX 2.3 or Stock B-Roll)
    // Scale and crop to fit target aspect ratio, looping if shorter than dialogue
    const filter = `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight},setsar=1,fps=30`;
    const args = [
      '-y',
      '-stream_loop',
      '-1',
      '-i',
      videoPath,
      '-t',
      String(duration),
      '-vf',
      filter,
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-crf',
      '18',
      '-pix_fmt',
      'yuv420p',
      '-an',
      outputPath,
    ];
    await execFileAsync(ffmpegPath, args, { timeout: 60_000 });
    return;
  }

  if (imagePath && fs.existsSync(imagePath)) {
    // Scene with static image: Apply smooth Ken Burns zoompan motion
    const motion = scene.cameraMotion || 'zoom_in';
    let zoomExpr = `min(zoom+0.0016,1.22)`;
    let xExpr = `iw/2-(iw/zoom/2)`;
    let yExpr = `ih/2-(ih/zoom/2)`;

    if (motion === 'zoom_out') {
      zoomExpr = `if(lte(zoom,1.0),1.22,max(1.001,zoom-0.0016))`;
    } else if (motion === 'pan_right') {
      zoomExpr = `1.15`;
      xExpr = `if(lte(on,1),(iw-iw/zoom)/2,min(iw-iw/zoom,x+1.4))`;
    } else if (motion === 'pan_left') {
      zoomExpr = `1.15`;
      xExpr = `if(lte(on,1),(iw-iw/zoom)/2,max(0,x-1.4))`;
    } else if (motion === 'pulse') {
      zoomExpr = `1.08+0.05*sin(2*PI*on/${totalFrames})`;
    }

    const filter = `zoompan=z='${zoomExpr}':x='${xExpr}':y='${yExpr}':d=${totalFrames}:s=${targetWidth}x${targetHeight}:fps=30`;
    const args = [
      '-y',
      '-loop',
      '1',
      '-i',
      imagePath,
      '-t',
      String(duration),
      '-vf',
      filter,
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-crf',
      '18',
      '-pix_fmt',
      'yuv420p',
      '-an',
      outputPath,
    ];
    await execFileAsync(ffmpegPath, args, { timeout: 60_000 });
    return;
  }

  // Fallback: Elegant dark gradient color canvas
  const args = [
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=0x0F172A:s=${targetWidth}x${targetHeight}:d=${duration}:r=30`,
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-pix_fmt',
    'yuv420p',
    '-an',
    outputPath,
  ];
  await execFileAsync(ffmpegPath, args, { timeout: 30_000 });
}

/**
 * Master Server Video Compiler
 * Compiles scenes, high-res audio with sidechain ducking, and styled .ass subtitles
 * into a production-grade 1080p MP4 using local FFmpeg and RTX 5090 hardware acceleration.
 */
export async function compileMasterVideo(params: {
  jobId?: string;
  scenes: Scene[];
  aspectRatio?: AspectRatioType;
  voiceAudioUrl?: string;
  musicAudioUrl?: string;
  mixedAudioUrl?: string;
  subtitleStyle?: SubtitleStyleType;
  subtitlesEnabled?: boolean;
  channelWatermark?: string;
  onProgress?: (progress: number, stage: string) => void;
}): Promise<RenderJobProgress> {
  const jobId = params.jobId || `master_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const ffmpegPath = resolveLocalToolPath('ffmpeg');
  if (!ffmpegPath) {
    throw new Error('No se encontró el ejecutable FFmpeg en el sistema local.');
  }

  const tempDir = path.join(MEDIA_DIR, 'temp', jobId);
  const videosDir = path.join(MEDIA_DIR, 'videos');
  fs.mkdirSync(tempDir, { recursive: true });
  fs.mkdirSync(videosDir, { recursive: true });

  const job: RenderJobProgress = {
    jobId,
    status: 'processing',
    progress: 5,
    stage: 'Inicializando renderizado en servidor...',
    createdAt: Date.now(),
  };
  activeJobs.set(jobId, job);
  params.onProgress?.(5, job.stage);

  try {
    const aspectRatio = params.aspectRatio || '9:16';
    const { width: targetWidth, height: targetHeight } = getDimensions(aspectRatio);

    // 1. Prepare Audio Master Track (Locución + Música con Ducking)
    job.stage = 'Preparando pista de audio master con Ducking...';
    job.progress = 15;
    params.onProgress?.(15, job.stage);

    let masterAudioPath: string | null = null;
    if (params.mixedAudioUrl) {
      masterAudioPath = resolveMediaUrlToDiskPath(params.mixedAudioUrl);
    }

    if (!masterAudioPath && params.voiceAudioUrl) {
      if (params.musicAudioUrl) {
        const duckedResult = await mixVoiceAndMusicWithDucking({
          voiceAudioUrl: params.voiceAudioUrl,
          musicAudioUrl: params.musicAudioUrl,
          musicVolume: 0.22,
          duckingEnabled: true,
        });
        masterAudioPath = resolveMediaUrlToDiskPath(duckedResult.mixedAudioUrl);
      } else {
        masterAudioPath = resolveMediaUrlToDiskPath(params.voiceAudioUrl);
      }
    }

    // 2. Render each scene into a standardized 30fps MP4 segment
    const segmentPaths: string[] = [];
    const totalScenes = Math.max(1, params.scenes.length);

    for (let i = 0; i < params.scenes.length; i++) {
      const scene = params.scenes[i];
      const segPercent = Math.round(20 + (i / totalScenes) * 45);
      job.stage = `Compilando escena visual ${i + 1} de ${totalScenes}...`;
      job.progress = segPercent;
      params.onProgress?.(segPercent, job.stage);

      const segPath = path.join(tempDir, `seg_${i}.mp4`);
      await renderSceneSegment({
        scene,
        sceneIndex: i,
        targetWidth,
        targetHeight,
        outputPath: segPath,
        ffmpegPath,
      });
      segmentPaths.push(segPath);
    }

    // 3. Concatenate visual segments using FFmpeg concat demuxer
    job.stage = 'Ensamblando secuencia de video continua...';
    job.progress = 70;
    params.onProgress?.(70, job.stage);

    const concatListPath = path.join(tempDir, 'concat_list.txt');
    const concatContent = segmentPaths
      .map((p) => `file '${p.replace(/\\/g, '/')}'`)
      .join('\r\n');
    fs.writeFileSync(concatListPath, concatContent, 'utf-8');

    const mergedVisualPath = path.join(tempDir, 'merged_visual.mp4');
    await execFileAsync(
      ffmpegPath,
      [
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        concatListPath,
        '-c',
        'copy',
        mergedVisualPath,
      ],
      { timeout: 60_000 }
    );

    // 4. Generate ASS Subtitles file
    job.stage = 'Generando subtítulos dinámicos de alta retención (.ASS)...';
    job.progress = 80;
    params.onProgress?.(80, job.stage);

    const assFilePath = path.join(tempDir, 'subtitles.ass');
    const subtitlesEnabled = params.subtitlesEnabled !== false;

    if (subtitlesEnabled) {
      generateAssSubtitlesFile({
        scenes: params.scenes,
        outputPath: assFilePath,
        width: targetWidth,
        height: targetHeight,
        style: params.subtitleStyle || 'hormozi',
      });
    }

    // 5. Burn subtitles, add audio, apply channel watermark and encode Master MP4
    job.stage = 'Renderizando Master MP4 1080p final con aceleración GPU...';
    job.progress = 88;
    params.onProgress?.(88, job.stage);

    const outputFileName = `master_${Date.now()}_${crypto.randomBytes(3).toString('hex')}.mp4`;
    const finalOutputPath = path.join(videosDir, outputFileName);

    // Build FFmpeg Filter Chain
    const filterParts: string[] = [];

    // Watermark overlay
    if (params.channelWatermark) {
      const safeWatermark = params.channelWatermark.replace(/[:\\']/g, '');
      const wmFontSize = Math.round(targetWidth * 0.028);
      filterParts.push(
        `drawtext=text='${safeWatermark}':x=${Math.round(targetWidth * 0.05)}:y=${Math.round(
          targetHeight * 0.055
        )}:fontsize=${wmFontSize}:fontcolor=white@0.85:shadowcolor=black@0.6:shadowx=2:shadowy=2`
      );
    }

    // ASS subtitles filter (Windows path escaped: C\:/path/to/subtitles.ass)
    if (subtitlesEnabled && fs.existsSync(assFilePath)) {
      const escapedAss = escapeFilterPath(assFilePath);
      filterParts.push(`ass='${escapedAss}'`);
    }

    const finalArgs: string[] = ['-y', '-i', mergedVisualPath];

    if (masterAudioPath && fs.existsSync(masterAudioPath)) {
      finalArgs.push('-i', masterAudioPath);
    }

    if (filterParts.length > 0) {
      finalArgs.push('-vf', filterParts.join(','));
    }

    // Try GPU hardware encoding (NVENC on RTX 5090) with instant fallback to libx264
    finalArgs.push(
      '-c:v',
      'h264_nvenc',
      '-preset',
      'p4',
      '-b:v',
      '8M',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart'
    );

    if (masterAudioPath && fs.existsSync(masterAudioPath)) {
      finalArgs.push('-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-shortest');
    } else {
      finalArgs.push('-an');
    }

    finalArgs.push(finalOutputPath);

    try {
      await execFileAsync(ffmpegPath, finalArgs, { timeout: 120_000 });
    } catch (nvencErr) {
      // Graceful fallback to CPU libx264
      console.warn('NVENC failed, falling back to libx264:', (nvencErr as Error).message);
      const nvencIdx = finalArgs.indexOf('h264_nvenc');
      if (nvencIdx >= 0) {
        finalArgs[nvencIdx] = 'libx264';
        const presetIdx = finalArgs.indexOf('-preset');
        if (presetIdx >= 0) {
          finalArgs[presetIdx + 1] = 'fast';
        }
        finalArgs.push('-crf', '20');
        await execFileAsync(ffmpegPath, finalArgs, { timeout: 180_000 });
      } else {
        throw nvencErr;
      }
    }

    // Measure final video properties
    let measuredDurationSec = 0;
    try {
      measuredDurationSec = await probeAudioDurationSec(finalOutputPath);
    } catch {
      // ignore
    }

    const fileStat = fs.statSync(finalOutputPath);
    const fileSizeMb = Number((fileStat.size / (1024 * 1024)).toFixed(2));

    job.status = 'completed';
    job.progress = 100;
    job.stage = '¡Renderizado completado exitosamente!';
    job.videoUrl = `/media/videos/${outputFileName}`;
    job.durationSec = measuredDurationSec;
    job.fileSizeMb = fileSizeMb;
    job.completedAt = Date.now();
    params.onProgress?.(100, job.stage);

    // Clean up temporary segment files asynchronously
    fs.rm(tempDir, { recursive: true, force: true }, () => {});

    return job;
  } catch (err: any) {
    job.status = 'error';
    job.stage = 'Error en el renderizado';
    job.error = err.message || String(err);
    params.onProgress?.(job.progress, `Error: ${job.error}`);
    // Clean up temp dir on error
    fs.rm(tempDir, { recursive: true, force: true }, () => {});
    throw err;
  }
}

