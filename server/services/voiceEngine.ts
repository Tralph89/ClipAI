import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { Scene, VOICES, WordTiming } from '../../src/types.ts';
import {
  DATA_DIR,
  loadDb,
  MEDIA_DIR,
  resolveMediaUrlToDiskPath,
} from '../storage/localDb.ts';
import { resolveLocalToolPath } from './systemTools.ts';

const execFileAsync = promisify(execFile);

export const PIPER_MODELS_DIR = path.join(DATA_DIR, 'models', 'piper');

interface PiperVoiceCatalogEntry {
  modelId: string;
  hfSubpath: string;
  speakerId?: number;
  language: 'es' | 'en' | 'pt';
  label: string;
}

const PIPER_CATALOG: Record<string, PiperVoiceCatalogEntry> = {
  'es_MX-claude-high': {
    modelId: 'es_MX-claude-high',
    hfSubpath: 'es/es_MX/claude/high/es_MX-claude-high',
    language: 'es',
    label: 'Claude MX Neural HD (Femenina)',
  },
  'es_MX-ald-medium': {
    modelId: 'es_MX-ald-medium',
    hfSubpath: 'es/es_MX/ald/medium/es_MX-ald-medium',
    language: 'es',
    label: 'Ald MX Neural (Masculina Dinámica)',
  },
  'es_ES-davefx-medium': {
    modelId: 'es_ES-davefx-medium',
    hfSubpath: 'es/es_ES/davefx/medium/es_ES-davefx-medium',
    language: 'es',
    label: 'Dave ES Neural (Documental)',
  },
  'es_ES-sharvard-medium': {
    modelId: 'es_ES-sharvard-medium',
    hfSubpath: 'es/es_ES/sharvard/medium/es_ES-sharvard-medium',
    speakerId: 0,
    language: 'es',
    label: 'Sharvard ES Neural (Storytelling)',
  },
  'es_AR-daniela-high': {
    modelId: 'es_AR-daniela-high',
    hfSubpath: 'es/es_AR/daniela/high/es_AR-daniela-high',
    language: 'es',
    label: 'Daniela AR Neural HD (Cálida)',
  },
  'en_US-lessac-medium': {
    modelId: 'en_US-lessac-medium',
    hfSubpath: 'en/en_US/lessac/medium/en_US-lessac-medium',
    language: 'en',
    label: 'Lessac US Neural (Female)',
  },
  'en_US-bryce-medium': {
    modelId: 'en_US-bryce-medium',
    hfSubpath: 'en/en_US/bryce/medium/en_US-bryce-medium',
    language: 'en',
    label: 'Bryce US Neural (Male)',
  },
  'pt_BR-faber-medium': {
    modelId: 'pt_BR-faber-medium',
    hfSubpath: 'pt/pt_BR/faber/medium/pt_BR-faber-medium',
    language: 'pt',
    label: 'Faber BR Neural',
  },
};

function resolvePiperEntryForProfile(voiceId: string, language: string): PiperVoiceCatalogEntry {
  if (PIPER_CATALOG[voiceId]) {
    return PIPER_CATALOG[voiceId];
  }

  if (language === 'en') {
    const enMap: Record<string, string> = {
      Kore: 'en_US-lessac-medium',
      Zephyr: 'en_US-lessac-medium',
      Puck: 'en_US-bryce-medium',
      Charon: 'en_US-bryce-medium',
      Fenrir: 'en_US-bryce-medium',
    };
    return PIPER_CATALOG[enMap[voiceId] || 'en_US-lessac-medium'];
  }

  if (language === 'pt') {
    return PIPER_CATALOG['pt_BR-faber-medium'];
  }

  const esMap: Record<string, string> = {
    Kore: 'es_MX-claude-high',
    Puck: 'es_MX-ald-medium',
    Charon: 'es_ES-davefx-medium',
    Fenrir: 'es_ES-sharvard-medium',
    Zephyr: 'es_AR-daniela-high',
    'es-ES-AlvaroNeural': 'es_ES-davefx-medium',
    'es-AR-TomasNeural': 'es_ES-sharvard-medium',
    'es-AR-ElenaNeural': 'es_AR-daniela-high',
    'es-ES-ElviraNeural': 'es_AR-daniela-high',
    'es-ES-XimenaNeural': 'es_AR-daniela-high',
  };
  if (esMap[voiceId]) {
    return PIPER_CATALOG[esMap[voiceId]];
  }
  if (/Jorge|Gonzalo|Alonso|Alex/i.test(voiceId)) {
    return PIPER_CATALOG['es_MX-ald-medium'];
  }
  return PIPER_CATALOG['es_MX-claude-high'];
}

const activeDownloads = new Map<string, Promise<string>>();

async function ensurePiperModelOnDisk(entry: PiperVoiceCatalogEntry): Promise<{
  onnxPath: string;
  modelUsed: string;
  speakerId?: number;
}> {
  fs.mkdirSync(PIPER_MODELS_DIR, { recursive: true });
  const onnxPath = path.join(PIPER_MODELS_DIR, `${entry.modelId}.onnx`);
  const jsonPath = path.join(PIPER_MODELS_DIR, `${entry.modelId}.onnx.json`);

  if (fs.existsSync(onnxPath) && fs.existsSync(jsonPath) && fs.statSync(onnxPath).size > 1_000_000) {
    return { onnxPath, modelUsed: entry.modelId, speakerId: entry.speakerId };
  }

  // Download from official open-source HuggingFace rhasspy/piper-voices repository
  const baseUrl = `https://huggingface.co/rhasspy/piper-voices/resolve/main/${entry.hfSubpath}`;

  try {
    let dlPromise = activeDownloads.get(entry.modelId);
    if (!dlPromise) {
      dlPromise = (async () => {
        for (const ext of ['.onnx.json', '.onnx']) {
          const target = path.join(PIPER_MODELS_DIR, `${entry.modelId}${ext}`);
          if (fs.existsSync(target) && fs.statSync(target).size > 1000) continue;
          const tmpTarget = `${target}.part`;
          const res = await fetch(`${baseUrl}${ext}`, {
            signal: AbortSignal.timeout(90_000),
          });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status} al descargar ${entry.modelId}${ext}`);
          }
          const buf = Buffer.from(await res.arrayBuffer());
          fs.writeFileSync(tmpTarget, buf);
          fs.renameSync(tmpTarget, target);
        }
        return onnxPath;
      })();
      activeDownloads.set(entry.modelId, dlPromise);
    }

    try {
      await dlPromise;
    } finally {
      activeDownloads.delete(entry.modelId);
    }

    return { onnxPath, modelUsed: entry.modelId, speakerId: entry.speakerId };
  } catch (downloadErr) {
    // Offline resilience: fall back to any locally cached ONNX voice for the same language (or any ONNX model)
    const files = fs.readdirSync(PIPER_MODELS_DIR).filter((f) => f.endsWith('.onnx'));
    const sameLang = files.find((f) => f.startsWith(`${entry.language}_`));
    const fallbackFile = sameLang || files[0];
    if (fallbackFile) {
      const fbModelId = fallbackFile.replace(/\.onnx$/, '');
      console.warn(
        `[voiceEngine] Sin red para descargar ${entry.modelId}, usando modelo local en caché ${fbModelId}`
      );
      return {
        onnxPath: path.join(PIPER_MODELS_DIR, fallbackFile),
        modelUsed: fbModelId,
      };
    }
    throw downloadErr;
  }
}

export function sanitizeTextForSpeech(raw: string): string {
  return String(raw || '')
    .replace(/\[Escena\s*\d+:[^\]]*\]/gi, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[*_#`~>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function probeAudioDurationSec(filePath: string): Promise<number> {
  const ffprobePath = resolveLocalToolPath('ffprobe');
  if (ffprobePath && fs.existsSync(filePath)) {
    try {
      const { stdout } = await execFileAsync(
        ffprobePath,
        ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', filePath],
        { timeout: 8000 }
      );
      const parsed = JSON.parse(stdout);
      const dur = parseFloat(parsed?.format?.duration);
      if (Number.isFinite(dur) && dur > 0) {
        return Number(dur.toFixed(3));
      }
    } catch {
      // Fallback below
    }
  }

  // WAV header fallback if ffprobe failed
  try {
    const stat = fs.statSync(filePath);
    if (filePath.endsWith('.wav') && stat.size > 44) {
      const fd = fs.openSync(filePath, 'r');
      const header = Buffer.alloc(44);
      fs.readSync(fd, header, 0, 44, 0);
      fs.closeSync(fd);
      const byteRate = header.readUInt32LE(28);
      if (byteRate > 0) {
        return Number(((stat.size - 44) / byteRate).toFixed(3));
      }
    }
  } catch {
    // Ignore
  }

  return 4.0;
}

/**
 * Normalizes any raw TTS WAV/MP3 to broadcast -16 LUFS 44.1kHz mono MP3 so every scene sounds studio-balanced
 * and takes 10x less disk space than uncompressed WAV.
 */
async function normalizeSpeechToMp3(rawAudioPath: string, outMp3Path: string): Promise<boolean> {
  const ffmpegPath = resolveLocalToolPath('ffmpeg');
  if (!ffmpegPath) return false;

  try {
    await execFileAsync(
      ffmpegPath,
      [
        '-y',
        '-i',
        rawAudioPath,
        '-af',
        'highpass=f=75,loudnorm=I=-16:TP=-1.5:LRA=11',
        '-ar',
        '44100',
        '-ac',
        '1',
        '-c:a',
        'libmp3lame',
        '-b:a',
        '160k',
        outMp3Path,
      ],
      { timeout: 25_000 }
    );
    return fs.existsSync(outMp3Path) && fs.statSync(outMp3Path).size > 500;
  } catch {
    return false;
  }
}

/**
 * Computes frame-accurate word-level timings proportional to syllable/character weight + punctuation pauses
 * anchored to the exact `ffprobe`-measured duration of the scene audio clip.
 */
export function computeSceneWordTimings(
  dialogue: string,
  durationSec: number
): WordTiming[] {
  const words = sanitizeTextForSpeech(dialogue)
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return [];

  // Leave tiny leading/trailing margin matching natural speech onset/release
  const leadPad = Math.min(0.06, durationSec * 0.03);
  const tailPad = Math.min(0.1, durationSec * 0.05);
  const activeSpan = Math.max(0.2, durationSec - leadPad - tailPad);

  const weights = words.map((w) => {
    const cleanLen = w.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9]/g, '').length || 1;
    let pauseBonus = 0;
    if (/[.!?…]$/.test(w)) pauseBonus = 3.2;
    else if (/[,;:—-]$/.test(w)) pauseBonus = 1.6;
    return Math.max(1.8, Math.pow(cleanLen, 0.78) + pauseBonus);
  });

  const totalWeight = weights.reduce((acc, v) => acc + v, 0) || 1;
  let cursor = leadPad;

  return words.map((word, idx) => {
    const slice = (weights[idx] / totalWeight) * activeSpan;
    const startSec = Number(cursor.toFixed(3));
    cursor += slice;
    const endSec = Number(
      (idx === words.length - 1 ? durationSec - tailPad / 2 : cursor).toFixed(3)
    );
    return {
      word,
      startSec,
      endSec: Math.max(startSec + 0.05, endSec),
    };
  });
}

function formatSrtTimestamp(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const hrs = Math.floor(clamped / 3600);
  const mins = Math.floor((clamped % 3600) / 60);
  const secs = Math.floor(clamped % 60);
  const ms = Math.round((clamped - Math.floor(clamped)) * 1000);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(
    secs
  ).padStart(2, '0')},${String(Math.min(999, ms)).padStart(3, '0')}`;
}

/**
 * Builds a high-retention dynamic `.SRT` subtitle track (4-6 words per block)
 * aligned to the exact measured scene start/end and word timestamps!
 */
export function buildSyncedSrtFromScenes(scenes: Scene[], maxWordsPerCue = 5): string {
  const blocks: string[] = [];
  let cueIndex = 1;
  let runningOffset = 0;

  for (const scene of scenes) {
    const sceneStart = typeof scene.startSec === 'number' ? scene.startSec : runningOffset;
    const sceneDur = typeof scene.durationSec === 'number' && scene.durationSec > 0 ? scene.durationSec : 4;
    const timings =
      scene.wordTimings && scene.wordTimings.length > 0
        ? scene.wordTimings
        : computeSceneWordTimings(scene.dialogue, sceneDur);

    for (let i = 0; i < timings.length; i += maxWordsPerCue) {
      const group = timings.slice(i, i + maxWordsPerCue);
      if (group.length === 0) continue;

      const absStart = sceneStart + group[0].startSec;
      const absEnd = sceneStart + group[group.length - 1].endSec;
      const text = group.map((g) => g.word).join(' ');

      blocks.push(
        `${cueIndex}\n${formatSrtTimestamp(absStart)} --> ${formatSrtTimestamp(absEnd)}\n${text}`
      );
      cueIndex++;
    }

    runningOffset = sceneStart + sceneDur + 0.14;
  }

  return blocks.join('\n\n');
}

export async function synthesizeSingleVoiceClip(params: {
  text: string;
  voice?: string;
  language?: string;
  speed?: number;
  filenamePrefix?: string;
}): Promise<{
  audioUrl: string;
  diskPath: string;
  mimeType: string;
  durationSec: number;
  wordTimings: WordTiming[];
  engine: string;
  voiceUsed: string;
}> {
  const cleanText = sanitizeTextForSpeech(params.text);
  if (!cleanText) {
    throw new Error('Se requiere texto hablado válido para generar la voz.');
  }

  const voice = params.voice || 'Kore';
  const language = params.language || 'es';
  const speed = Math.min(1.35, Math.max(0.8, Number(params.speed) || 1.08));
  const prefix = params.filenamePrefix || 'tts';
  const audioDir = path.join(MEDIA_DIR, 'audio');
  fs.mkdirSync(audioDir, { recursive: true });

  const db = loadDb();
  const preferredEngine = db.settings.defaultVoiceEngine || 'piper';
  const piperPath = resolveLocalToolPath('piper');
  const edgeTtsPath = resolveLocalToolPath('edge-tts');

  const uniqueTag = `${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

  const isExplicitEdgeVoice = /^[a-z]{2}-[A-Z]{2}-.+Neural$/i.test(voice);
  const isExplicitPiperProfile =
    Boolean(PIPER_CATALOG[voice]) || ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'].includes(voice);

  // 1. Microsoft Edge Neural TTS (Direct Spanish/Multilingual Neural Voice when an Edge voice is selected, or when Edge-TTS is default engine)
  if (edgeTtsPath && (isExplicitEdgeVoice || (preferredEngine === 'edge-tts' && !isExplicitPiperProfile))) {
    const voiceMapEs: Record<string, string> = {
      Kore: 'es-MX-DaliaNeural',
      Puck: 'es-MX-JorgeNeural',
      Charon: 'es-ES-AlvaroNeural',
      Fenrir: 'es-AR-TomasNeural',
      Zephyr: 'es-CO-SalomeNeural',
    };
    const voiceMapEn: Record<string, string> = {
      Kore: 'en-US-AriaNeural',
      Puck: 'en-US-ChristopherNeural',
      Charon: 'en-US-GuyNeural',
      Fenrir: 'en-US-EricNeural',
      Zephyr: 'en-US-JennyNeural',
    };
    const mappedEdge = isExplicitEdgeVoice
      ? voice
      : language === 'en'
      ? voiceMapEn[voice] || 'en-US-ChristopherNeural'
      : language === 'pt'
      ? 'pt-BR-AntonioNeural'
      : voiceMapEs[voice] || 'es-MX-DaliaNeural';

    const ratePct = `${speed >= 1 ? '+' : ''}${Math.round((speed - 1) * 100)}%`;
    const rawEdgePath = path.join(audioDir, `${prefix}_edge_raw_${uniqueTag}.mp3`);
    const mp3Name = `${prefix}_edge_${uniqueTag}.mp3`;
    const mp3Path = path.join(audioDir, mp3Name);

    try {
      let edgeOk = false;
      let lastEdgeErr: any = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await execFileAsync(
            edgeTtsPath,
            [
              '--voice',
              mappedEdge,
              `--rate=${ratePct}`,
              '--text',
              cleanText,
              '--write-media',
              rawEdgePath,
            ],
            {
              timeout: 35_000,
              env: { ...process.env, PYTHONUTF8: '1' },
            }
          );
          if (fs.existsSync(rawEdgePath) && fs.statSync(rawEdgePath).size > 500) {
            edgeOk = true;
            break;
          }
        } catch (retryErr) {
          lastEdgeErr = retryErr;
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 450));
          }
        }
      }
      if (!edgeOk && lastEdgeErr) {
        throw lastEdgeErr;
      }
      if (fs.existsSync(rawEdgePath) && fs.statSync(rawEdgePath).size > 500) {
        const normalizedOk = await normalizeSpeechToMp3(rawEdgePath, mp3Path);
        if (normalizedOk) {
          fs.unlinkSync(rawEdgePath);
        } else {
          fs.renameSync(rawEdgePath, mp3Path);
        }
        const durationSec = await probeAudioDurationSec(mp3Path);
        return {
          audioUrl: `/media/audio/${mp3Name}`,
          diskPath: mp3Path,
          mimeType: 'audio/mpeg',
          durationSec,
          wordTimings: computeSceneWordTimings(cleanText, durationSec),
          engine: 'edge-neural',
          voiceUsed: mappedEdge,
        };
      }
    } catch (err: any) {
      if (fs.existsSync(rawEdgePath)) {
        try {
          fs.unlinkSync(rawEdgePath);
        } catch {}
      }
      console.warn(
        '[voiceEngine] Edge-TTS no disponible, cambiando automáticamente a Piper Neural HD local:',
        err.message?.slice(0, 90)
      );
    }
  }

  // 2. Primary Local Studio Neural Engine: Piper ONNX HD (100% offline-capable, sub-second neural VITS)
  if (piperPath && preferredEngine !== 'gemini-tts') {
    try {
      const entry = resolvePiperEntryForProfile(voice, language);
      const { onnxPath, modelUsed, speakerId } = await ensurePiperModelOnDisk(entry);

      const tmpTxtPath = path.join(audioDir, `tmp_in_${uniqueTag}.txt`);
      const rawWavPath = path.join(audioDir, `${prefix}_raw_${uniqueTag}.wav`);
      const finalMp3Name = `${prefix}_piper_${uniqueTag}.mp3`;
      const finalMp3Path = path.join(audioDir, finalMp3Name);

      fs.writeFileSync(tmpTxtPath, cleanText, 'utf-8');

      // Piper length-scale is inverse of speed (0.92 => ~1.08x crisp viral narration pace)
      const lengthScale = (1 / speed).toFixed(3);
      const piperArgs = [
        '-m',
        onnxPath,
        '-i',
        tmpTxtPath,
        '-f',
        rawWavPath,
        '--length-scale',
        lengthScale,
        '--sentence-silence',
        '0.16',
      ];
      if (typeof speakerId === 'number') {
        piperArgs.push('-s', String(speakerId));
      }

      try {
        await execFileAsync(piperPath, piperArgs, {
          timeout: 45_000,
          env: { ...process.env, PYTHONUTF8: '1' },
        });
      } finally {
        if (fs.existsSync(tmpTxtPath)) fs.unlinkSync(tmpTxtPath);
      }

      if (fs.existsSync(rawWavPath) && fs.statSync(rawWavPath).size > 500) {
        const normalizedOk = await normalizeSpeechToMp3(rawWavPath, finalMp3Path);
        if (normalizedOk) {
          fs.unlinkSync(rawWavPath);
          const durationSec = await probeAudioDurationSec(finalMp3Path);
          return {
            audioUrl: `/media/audio/${finalMp3Name}`,
            diskPath: finalMp3Path,
            mimeType: 'audio/mpeg',
            durationSec,
            wordTimings: computeSceneWordTimings(cleanText, durationSec),
            engine: 'piper-neural-hd',
            voiceUsed: modelUsed,
          };
        }

        // If FFmpeg MP3 conversion wasn't available, keep raw WAV directly
        const wavName = path.basename(rawWavPath);
        const durationSec = await probeAudioDurationSec(rawWavPath);
        return {
          audioUrl: `/media/audio/${wavName}`,
          diskPath: rawWavPath,
          mimeType: 'audio/wav',
          durationSec,
          wordTimings: computeSceneWordTimings(cleanText, durationSec),
          engine: 'piper-neural-hd',
          voiceUsed: modelUsed,
        };
      }
    } catch (piperErr: any) {
      console.warn('[voiceEngine] Piper error, probando respaldo SAPI:', piperErr.message);
    }
  }

  // 3. Offline Windows System.Speech SAPI Fallback (Zero dependencies)
  if (process.platform === 'win32') {
    const rawWavName = `${prefix}_sapi_${uniqueTag}.wav`;
    const rawWavPath = path.join(audioDir, rawWavName);
    const culturePrefix = language === 'en' ? 'en-' : 'es-';
    const sapiRate = Math.max(-2, Math.min(4, Math.round((speed - 1) * 10)));
    const safePsText = cleanText.replace(/'/g, "''");
    const safePsOut = rawWavPath.replace(/'/g, "''");

    const psScript = `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate = ${sapiRate}; $v = $s.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -like '${culturePrefix}*' } | Select-Object -First 1; if ($v) { $s.SelectVoice($v.VoiceInfo.Name) }; $s.SetOutputToWaveFile('${safePsOut}'); $s.Speak('${safePsText}'); $s.Dispose()`;

    await execFileAsync('powershell.exe', ['-NoProfile', '-Command', psScript], {
      timeout: 45_000,
    });

    const finalMp3Name = `${prefix}_sapi_${uniqueTag}.mp3`;
    const finalMp3Path = path.join(audioDir, finalMp3Name);
    if (await normalizeSpeechToMp3(rawWavPath, finalMp3Path)) {
      fs.unlinkSync(rawWavPath);
      const durationSec = await probeAudioDurationSec(finalMp3Path);
      return {
        audioUrl: `/media/audio/${finalMp3Name}`,
        diskPath: finalMp3Path,
        mimeType: 'audio/mpeg',
        durationSec,
        wordTimings: computeSceneWordTimings(cleanText, durationSec),
        engine: 'windows-sapi',
        voiceUsed: `Windows ${culturePrefix}`,
      };
    }

    const durationSec = await probeAudioDurationSec(rawWavPath);
    return {
      audioUrl: `/media/audio/${rawWavName}`,
      diskPath: rawWavPath,
      mimeType: 'audio/wav',
      durationSec,
      wordTimings: computeSceneWordTimings(cleanText, durationSec),
      engine: 'windows-sapi',
      voiceUsed: `Windows ${culturePrefix}`,
    };
  }

  throw new Error('No se encontró ningún motor local de voz disponible.');
}

/**
 * Concatenates multiple per-scene audio files with a natural `gapSec` breath pause into a single master MP3
 * using local FFmpeg.
 */
export async function concatenateSceneAudios(
  sceneAudioPaths: string[],
  gapSec = 0.14
): Promise<{ masterAudioUrl: string; masterDiskPath: string; totalDurationSec: number }> {
  if (sceneAudioPaths.length === 0) {
    throw new Error('No hay pistas de escena para concatenar.');
  }
  if (sceneAudioPaths.length === 1) {
    const singlePath = sceneAudioPaths[0];
    const dur = await probeAudioDurationSec(singlePath);
    return {
      masterAudioUrl: `/media/audio/${path.basename(singlePath)}`,
      masterDiskPath: singlePath,
      totalDurationSec: dur,
    };
  }

  const ffmpegPath = resolveLocalToolPath('ffmpeg');
  if (!ffmpegPath) {
    const first = sceneAudioPaths[0];
    const dur = await probeAudioDurationSec(first);
    return {
      masterAudioUrl: `/media/audio/${path.basename(first)}`,
      masterDiskPath: first,
      totalDurationSec: dur,
    };
  }

  const audioDir = path.join(MEDIA_DIR, 'audio');
  const outName = `voice_master_${Date.now()}_${crypto.randomBytes(3).toString('hex')}.mp3`;
  const outPath = path.join(audioDir, outName);

  // Build filter_complex adding `apad=pad_dur=0.14` to scenes 0..N-2 and concatenating cleanly
  const inputArgs: string[] = [];
  const filterParts: string[] = [];
  const concatLabels: string[] = [];

  sceneAudioPaths.forEach((p, idx) => {
    inputArgs.push('-i', p);
    if (idx < sceneAudioPaths.length - 1 && gapSec > 0) {
      filterParts.push(`[${idx}:a]aresample=44100,apad=pad_dur=${gapSec}[s${idx}]`);
    } else {
      filterParts.push(`[${idx}:a]aresample=44100[s${idx}]`);
    }
    concatLabels.push(`[s${idx}]`);
  });

  filterParts.push(`${concatLabels.join('')}concat=n=${sceneAudioPaths.length}:v=0:a=1[aout]`);

  await execFileAsync(
    ffmpegPath,
    [
      '-y',
      ...inputArgs,
      '-filter_complex',
      filterParts.join(';'),
      '-map',
      '[aout]',
      '-ac',
      '1',
      '-ar',
      '44100',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '160k',
      outPath,
    ],
    { timeout: 45_000 }
  );

  const totalDurationSec = await probeAudioDurationSec(outPath);
  return {
    masterAudioUrl: `/media/audio/${outName}`,
    masterDiskPath: outPath,
    totalDurationSec,
  };
}

/**
 * Generates neural voiceover per scene, measures exact ffprobe durations, computes word-level timestamps,
 * concatenates the master voice track, and produces frame-accurate `.SRT` subtitles.
 */
export async function synthesizeScenesVoiceover(params: {
  scenes: Scene[];
  voice?: string;
  language?: string;
  speed?: number;
}): Promise<{
  scenes: Scene[];
  voiceAudioUrl: string;
  totalDurationSec: number;
  subtitlesSrt: string;
  engine: string;
  voiceUsed: string;
}> {
  if (!Array.isArray(params.scenes) || params.scenes.length === 0) {
    throw new Error('No hay escenas en el guion para sintetizar voz.');
  }

  const gapSec = 0.14;
  const updatedScenes: Scene[] = [];
  const diskPaths: string[] = [];
  let runningCursor = 0;
  let engineUsed = 'piper-neural-hd';
  let voiceModelUsed = params.voice || 'Kore';

  for (let i = 0; i < params.scenes.length; i++) {
    const scene = params.scenes[i];
    const spoken = sanitizeTextForSpeech(scene.dialogue) || scene.title;
    const clip = await synthesizeSingleVoiceClip({
      text: spoken,
      voice: params.voice,
      language: params.language,
      speed: params.speed,
      filenamePrefix: `scene${i + 1}`,
    });

    engineUsed = clip.engine;
    voiceModelUsed = clip.voiceUsed;
    diskPaths.push(clip.diskPath);

    const startSec = Number(runningCursor.toFixed(3));
    const endSec = Number((startSec + clip.durationSec).toFixed(3));

    updatedScenes.push({
      ...scene,
      voiceAudioUrl: clip.audioUrl,
      durationSec: clip.durationSec,
      startSec,
      endSec,
      wordTimings: clip.wordTimings,
      isGeneratingVoice: false,
    });

    runningCursor = endSec + (i < params.scenes.length - 1 ? gapSec : 0);
  }

  const master = await concatenateSceneAudios(diskPaths, gapSec);
  const subtitlesSrt = buildSyncedSrtFromScenes(updatedScenes);

  return {
    scenes: updatedScenes,
    voiceAudioUrl: master.masterAudioUrl,
    totalDurationSec: master.totalDurationSec,
    subtitlesSrt,
    engine: engineUsed,
    voiceUsed: voiceModelUsed,
  };
}

/**
 * Rebuilds the master concatenated voice track + synced SRT when a single scene's audio is regenerated.
 */
export async function rebuildMasterFromSceneAudios(scenes: Scene[]): Promise<{
  scenes: Scene[];
  voiceAudioUrl: string;
  totalDurationSec: number;
  subtitlesSrt: string;
}> {
  const gapSec = 0.14;
  const diskPaths: string[] = [];
  const recalcScenes: Scene[] = [];
  let cursor = 0;

  for (let i = 0; i < scenes.length; i++) {
    const sc = scenes[i];
    const p = resolveMediaUrlToDiskPath(sc.voiceAudioUrl);
    const dur =
      p ? await probeAudioDurationSec(p) : sc.durationSec && sc.durationSec > 0 ? sc.durationSec : 4;
    if (p) diskPaths.push(p);

    const startSec = Number(cursor.toFixed(3));
    const endSec = Number((startSec + dur).toFixed(3));
    const wordTimings =
      sc.wordTimings && sc.wordTimings.length > 0
        ? sc.wordTimings
        : computeSceneWordTimings(sc.dialogue, dur);

    recalcScenes.push({
      ...sc,
      durationSec: dur,
      startSec,
      endSec,
      wordTimings,
    });
    cursor = endSec + (i < scenes.length - 1 ? gapSec : 0);
  }

  if (diskPaths.length === 0) {
    throw new Error('Ninguna escena tiene audio generado todavía.');
  }

  const master = await concatenateSceneAudios(diskPaths, gapSec);
  const subtitlesSrt = buildSyncedSrtFromScenes(recalcScenes);

  return {
    scenes: recalcScenes,
    voiceAudioUrl: master.masterAudioUrl,
    totalDurationSec: master.totalDurationSec,
    subtitlesSrt,
  };
}

const activeSamplePromises = new Map<string, Promise<{ sampleAudioUrl: string; engine: string; voiceUsed: string; cached: boolean }>>();

/**
 * Generates (once) and caches on disk (`data/media/audio/samples/sample_<voiceId>.mp3`)
 * a crisp Spanish voice preview sample so clicking any voice plays immediately!
 */
export async function getOrCreateVoiceSample(params: {
  voice: string;
  customText?: string;
}): Promise<{
  sampleAudioUrl: string;
  engine: string;
  voiceUsed: string;
  cached: boolean;
}> {
  const voiceId = (params.voice || 'es-MX-DaliaNeural').trim();
  const safeId = voiceId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const samplesDir = path.join(MEDIA_DIR, 'audio', 'samples');
  fs.mkdirSync(samplesDir, { recursive: true });

  const cachedFileName = `sample_${safeId}.mp3`;
  const cachedFilePath = path.join(samplesDir, cachedFileName);

  if (!params.customText && fs.existsSync(cachedFilePath) && fs.statSync(cachedFilePath).size > 500) {
    return {
      sampleAudioUrl: `/media/audio/samples/${cachedFileName}`,
      engine: /^[a-z]{2}-[A-Z]{2}-.+Neural$/i.test(voiceId) ? 'edge-neural' : 'piper-neural-hd',
      voiceUsed: voiceId,
      cached: true,
    };
  }

  const inflight = !params.customText ? activeSamplePromises.get(safeId) : undefined;
  if (inflight) {
    return inflight;
  }

  const catalogMatch = VOICES.find((v) => v.id === voiceId);
  const sampleText =
    params.customText ||
    catalogMatch?.sampleText ||
    'Hola, esta es una muestra de mi voz lista para narrar tus próximos videos virales.';

  const task = (async () => {
    const generated = await synthesizeSingleVoiceClip({
      text: sampleText,
      voice: voiceId,
      language: 'es',
      speed: 1.04,
      filenamePrefix: `sample_tmp_${safeId}`,
    });

    if (!params.customText && fs.existsSync(generated.diskPath)) {
      fs.copyFileSync(generated.diskPath, cachedFilePath);
      try {
        fs.unlinkSync(generated.diskPath);
      } catch {}
      return {
        sampleAudioUrl: `/media/audio/samples/${cachedFileName}`,
        engine: generated.engine,
        voiceUsed: generated.voiceUsed,
        cached: false,
      };
    }

    return {
      sampleAudioUrl: generated.audioUrl,
      engine: generated.engine,
      voiceUsed: generated.voiceUsed,
      cached: false,
    };
  })();

  if (!params.customText) {
    activeSamplePromises.set(safeId, task);
  }
  try {
    return await task;
  } finally {
    activeSamplePromises.delete(safeId);
  }
}


