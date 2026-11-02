import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { DATA_DIR, MEDIA_DIR, resolveMediaUrlToDiskPath } from '../storage/localDb.ts';
import { resolveLocalToolPath } from './systemTools.ts';
import { probeAudioDurationSec } from './voiceEngine.ts';

const execFileAsync = promisify(execFile);

interface MusicPresetSpec {
  bpm: number;
  chords: number[][]; // frequencies in Hz per bar
  kickLevel: number;
  hatLevel: number;
  padWarmth: number; // 0..1 lowpass smoothing
  arpActive: boolean;
}

const PRESET_SPECS: Record<string, MusicPresetSpec> = {
  'cyber-pulse': {
    bpm: 124,
    chords: [
      [110.0, 164.81, 220.0, 261.63], // Am
      [87.31, 130.81, 174.61, 220.0], // Fmaj7
      [130.81, 196.0, 261.63, 329.63], // C
      [98.0, 146.83, 196.0, 246.94], // G
    ],
    kickLevel: 0.28,
    hatLevel: 0.06,
    padWarmth: 0.18,
    arpActive: true,
  },
  'cinematic-rise': {
    bpm: 94,
    chords: [
      [73.42, 146.83, 220.0, 261.63], // Dm7
      [58.27, 116.54, 174.61, 220.0], // Bbmaj7
      [87.31, 174.61, 220.0, 261.63], // F
      [65.41, 130.81, 196.0, 246.94], // C
    ],
    kickLevel: 0.18,
    hatLevel: 0.02,
    padWarmth: 0.09,
    arpActive: false,
  },
  'lofi-focus': {
    bpm: 86,
    chords: [
      [130.81, 155.56, 196.0, 233.08, 293.66], // Cm9
      [87.31, 130.81, 155.56, 207.65, 261.63], // Fm9
      [116.54, 146.83, 174.61, 220.0, 261.63], // Bbmaj9
      [98.0, 146.83, 185.0, 233.08], // Gm7
    ],
    kickLevel: 0.22,
    hatLevel: 0.045,
    padWarmth: 0.08,
    arpActive: true,
  },
  'viral-phonk': {
    bpm: 132,
    chords: [
      [82.41, 123.47, 164.81, 196.0], // Em
      [87.31, 130.81, 174.61, 207.65], // Fm (Phrygian tension)
      [82.41, 123.47, 164.81, 246.94], // Em
      [73.42, 110.0, 146.83, 220.0], // Dm
    ],
    kickLevel: 0.34,
    hatLevel: 0.08,
    padWarmth: 0.22,
    arpActive: true,
  },
  'dark-mystery': {
    bpm: 76,
    chords: [
      [73.42, 110.0, 174.61, 220.0], // Dm
      [69.3, 103.83, 164.81, 207.65], // C#m / A7alt
      [58.27, 116.54, 174.61, 233.08], // Bb
      [55.0, 110.0, 164.81, 207.65], // A
    ],
    kickLevel: 0.14,
    hatLevel: 0.02,
    padWarmth: 0.07,
    arpActive: true,
  },
};

function writeStereoWavFile(
  filePath: string,
  left: Float32Array,
  right: Float32Array,
  sampleRate: number
): void {
  const numFrames = left.length;
  const numChannels = 2;
  const dataBytes = numFrames * numChannels * 2;
  const buffer = Buffer.alloc(44 + dataBytes);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * 2, 28);
  buffer.writeUInt16LE(numChannels * 2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataBytes, 40);

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    const l = Math.max(-0.98, Math.min(0.98, left[i]));
    const r = Math.max(-0.98, Math.min(0.98, right[i]));
    buffer.writeInt16LE(l < 0 ? Math.round(l * 32768) : Math.round(l * 32767), offset);
    offset += 2;
    buffer.writeInt16LE(r < 0 ? Math.round(r * 32768) : Math.round(r * 32767), offset);
    offset += 2;
  }

  fs.writeFileSync(filePath, buffer);
}

/**
 * Generates a rich stereo royalty-free studio instrumental track (pads + sub bass + subtle arp + soft percussion)
 * saved permanently in `data/media/audio/`.
 */
export async function generateStudioMusicTrackOnServer(params: {
  presetId: string;
  durationSec?: number;
}): Promise<{
  musicAudioUrl: string;
  durationSec: number;
  presetId: string;
}> {
  const presetId = PRESET_SPECS[params.presetId] ? params.presetId : 'cyber-pulse';
  const spec = PRESET_SPECS[presetId];
  const durationSec = Math.min(180, Math.max(18, Math.ceil(Number(params.durationSec) || 36)));

  const sampleRate = 44100;
  const totalSamples = sampleRate * durationSec;
  const left = new Float32Array(totalSamples);
  const right = new Float32Array(totalSamples);

  const beatSec = 60 / spec.bpm;
  const barSec = beatSec * 4;
  let lpL = 0;
  let lpR = 0;

  // Deterministic pseudo-noise state for crisp hi-hats
  let rng = 0x12345678;
  const nextNoise = () => {
    rng ^= rng << 13;
    rng ^= rng >>> 17;
    rng ^= rng << 5;
    return ((rng >>> 0) / 0xffffffff) * 2 - 1;
  };

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const barIndex = Math.floor(t / barSec);
    const barPos = (t % barSec) / barSec;
    const beatPos = (t % beatSec) / beatSec;
    const eighthPos = (t % (beatSec / 2)) / (beatSec / 2);

    const chord = spec.chords[barIndex % spec.chords.length];

    // Smooth chord envelope
    const padEnv =
      Math.min(1, barPos * 8) * Math.min(1, (1 - barPos) * 6) * 0.22;

    let rawPadL = 0;
    let rawPadR = 0;
    for (let n = 0; n < chord.length; n++) {
      const f = chord[n];
      // Slight stereo chorus detuning
      const detune = n % 2 === 0 ? 1.0025 : 0.9975;
      rawPadL += Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * f * 2 * t);
      rawPadR +=
        Math.sin(2 * Math.PI * f * detune * t) +
        0.35 * Math.sin(2 * Math.PI * f * 2 * (2 - detune) * t);
    }
    rawPadL = (rawPadL / chord.length) * padEnv;
    rawPadR = (rawPadR / chord.length) * padEnv;

    // One-pole warm lowpass filter on pad
    lpL += spec.padWarmth * (rawPadL - lpL);
    lpR += spec.padWarmth * (rawPadR - lpR);

    // Warm sub-bass following root note
    const rootFreq = chord[0];
    const sidechainPump = 0.45 + 0.55 * Math.min(1, beatPos * 2.4);
    const subBass = Math.sin(2 * Math.PI * rootFreq * t) * 0.24 * sidechainPump;

    // Optional melodic plucks / arpeggio
    let arpL = 0;
    let arpR = 0;
    if (spec.arpActive) {
      const stepIdx = Math.floor((t % barSec) / (beatSec / 2));
      const noteFreq = chord[stepIdx % chord.length] * 2;
      const pluckEnv = Math.exp(-eighthPos * 6.5) * 0.085;
      const pan = stepIdx % 2 === 0 ? 0.7 : 0.3;
      const sig = Math.sin(2 * Math.PI * noteFreq * t) * pluckEnv;
      arpL = sig * pan;
      arpR = sig * (1 - pan);
    }

    // Soft studio kick on every beat
    const kickTime = t % beatSec;
    let kick = 0;
    if (kickTime < 0.16) {
      const pitchSweep = 46 * kickTime + 0.012 * (1 - Math.exp(-kickTime * 45));
      const kickEnv = Math.exp(-kickTime * 22);
      kick = Math.sin(2 * Math.PI * pitchSweep) * kickEnv * spec.kickLevel;
    }

    // Off-beat subtle hi-hat
    let hat = 0;
    const offBeatTime = (t + beatSec / 2) % beatSec;
    if (offBeatTime < 0.045) {
      hat = nextNoise() * Math.exp(-offBeatTime * 85) * spec.hatLevel;
    }

    // Master fade-in & fade-out
    const fadeIn = Math.min(1, t / 0.8);
    const fadeOut = Math.min(1, (durationSec - t) / 1.5);
    const masterGain = fadeIn * fadeOut;

    left[i] = (lpL * 1.35 + subBass + arpL + kick + hat * 0.85) * masterGain;
    right[i] = (lpR * 1.35 + subBass + arpR + kick + hat * 1.15) * masterGain;
  }

  const audioDir = path.join(MEDIA_DIR, 'audio');
  fs.mkdirSync(audioDir, { recursive: true });
  const tag = `${presetId}_${durationSec}s_${crypto.randomBytes(2).toString('hex')}`;
  const wavPath = path.join(audioDir, `music_${tag}.wav`);
  const mp3Name = `music_${tag}.mp3`;
  const mp3Path = path.join(audioDir, mp3Name);

  writeStereoWavFile(wavPath, left, right, sampleRate);

  const ffmpegPath = resolveLocalToolPath('ffmpeg');
  if (ffmpegPath) {
    try {
      await execFileAsync(
        ffmpegPath,
        ['-y', '-i', wavPath, '-c:a', 'libmp3lame', '-b:a', '192k', mp3Path],
        { timeout: 25_000 }
      );
      if (fs.existsSync(mp3Path) && fs.statSync(mp3Path).size > 1000) {
        fs.unlinkSync(wavPath);
        return {
          musicAudioUrl: `/media/audio/${mp3Name}`,
          durationSec,
          presetId,
        };
      }
    } catch {
      // Keep WAV if MP3 encode failed
    }
  }

  return {
    musicAudioUrl: `/media/audio/${path.basename(wavPath)}`,
    durationSec,
    presetId,
  };
}

/**
 * Mixes the master voiceover and background music using FFmpeg `sidechaincompress` (Audio Ducking),
 * automatically lowering the music while the narrator speaks and raising it gently during pauses/outro.
 */
export async function mixVoiceAndMusicWithDucking(params: {
  voiceAudioUrl: string;
  musicAudioUrl: string;
  musicVolume?: number;
  duckingEnabled?: boolean;
}): Promise<{
  mixedAudioUrl: string;
  durationSec: number;
  duckingApplied: boolean;
}> {
  const voicePath = resolveMediaUrlToDiskPath(params.voiceAudioUrl);
  const musicPath = resolveMediaUrlToDiskPath(params.musicAudioUrl);

  if (!voicePath) {
    throw new Error('No se encontró el archivo de locución en disco para mezclar.');
  }
  if (!musicPath) {
    return {
      mixedAudioUrl: params.voiceAudioUrl,
      durationSec: await probeAudioDurationSec(voicePath),
      duckingApplied: false,
    };
  }

  const ffmpegPath = resolveLocalToolPath('ffmpeg');
  if (!ffmpegPath) {
    return {
      mixedAudioUrl: params.voiceAudioUrl,
      durationSec: await probeAudioDurationSec(voicePath),
      duckingApplied: false,
    };
  }

  const voiceDur = await probeAudioDurationSec(voicePath);
  const tailSec = 1.1;
  const totalDur = Number((voiceDur + tailSec).toFixed(2));
  const fadeOutStart = Math.max(0.2, Number((totalDur - 1.4).toFixed(2)));
  const baseVol = Math.min(0.65, Math.max(0.04, Number(params.musicVolume) || 0.22));
  const ducking = params.duckingEnabled !== false;

  const audioDir = path.join(MEDIA_DIR, 'audio');
  const outName = `mix_ducked_${Date.now()}_${crypto.randomBytes(3).toString('hex')}.mp3`;
  const outPath = path.join(audioDir, outName);

  const filterComplex = ducking
    ? [
        `[0:a]aresample=44100,aformat=sample_rates=44100:channel_layouts=stereo,apad=pad_dur=${tailSec},asplit=2[v_main][v_sc]`,
        `[1:a]aresample=44100,aformat=sample_rates=44100:channel_layouts=stereo,atrim=0:${totalDur},afade=t=in:st=0:d=0.6,afade=t=out:st=${fadeOutStart}:d=1.4,volume=${baseVol}[bgm]`,
        `[bgm][v_sc]sidechaincompress=threshold=0.022:ratio=6:attack=35:release=380:makeup=1[bgm_ducked]`,
        `[v_main][bgm_ducked]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.96[aout]`,
      ].join(';')
    : [
        `[0:a]aresample=44100,aformat=sample_rates=44100:channel_layouts=stereo,apad=pad_dur=${tailSec}[v_main]`,
        `[1:a]aresample=44100,aformat=sample_rates=44100:channel_layouts=stereo,atrim=0:${totalDur},afade=t=in:st=0:d=0.6,afade=t=out:st=${fadeOutStart}:d=1.4,volume=${(
          baseVol * 0.65
        ).toFixed(3)}[bgm]`,
        `[v_main][bgm]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.96[aout]`,
      ].join(';');

  await execFileAsync(
    ffmpegPath,
    [
      '-y',
      '-i',
      voicePath,
      '-stream_loop',
      '-1',
      '-i',
      musicPath,
      '-filter_complex',
      filterComplex,
      '-map',
      '[aout]',
      '-ar',
      '44100',
      '-ac',
      '2',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '192k',
      outPath,
    ],
    { timeout: 45_000 }
  );

  const measuredDur = await probeAudioDurationSec(outPath);
  return {
    mixedAudioUrl: `/media/audio/${outName}`,
    durationSec: measuredDur,
    duckingApplied: ducking,
  };
}

/**
 * Enhanced multi-track audio mixer:
 * Unifies Voice Track + Ducked Background Music + Continuous Ambient Foley Layer.
 */
export async function mixMultiTrackAudio(params: {
  voiceAudioUrl: string;
  musicAudioUrl?: string;
  musicVolume?: number;
  duckingPreset?: 'subtle' | 'balanced' | 'aggressive' | 'none';
  ambientAudioUrl?: string;
  ambientVolume?: number;
}): Promise<{
  mixedAudioUrl: string;
  durationSec: number;
  tracksMixed: number;
}> {
  const voicePath = resolveMediaUrlToDiskPath(params.voiceAudioUrl);
  if (!voicePath) {
    throw new Error('No se encontró el archivo de locución en disco para mezclar.');
  }

  const musicPath = resolveMediaUrlToDiskPath(params.musicAudioUrl);
  const ambientPath = resolveMediaUrlToDiskPath(params.ambientAudioUrl);

  const ffmpegPath = resolveLocalToolPath('ffmpeg');
  if (!ffmpegPath || (!musicPath && !ambientPath)) {
    return {
      mixedAudioUrl: params.voiceAudioUrl,
      durationSec: await probeAudioDurationSec(voicePath),
      tracksMixed: 1,
    };
  }

  const voiceDur = await probeAudioDurationSec(voicePath);
  const tailSec = 1.1;
  const totalDur = Number((voiceDur + tailSec).toFixed(2));
  const fadeOutStart = Math.max(0.2, Number((totalDur - 1.4).toFixed(2)));

  const musicVol = Math.min(0.65, Math.max(0.02, Number(params.musicVolume) || 0.18));
  const ambientVol = Math.min(0.50, Math.max(0.02, Number(params.ambientVolume) || 0.12));
  const ducking = params.duckingPreset !== 'none';

  const duckConfig = {
    subtle: { ratio: 3, attack: 50, release: 450, thresh: 0.035 },
    balanced: { ratio: 6, attack: 35, release: 380, thresh: 0.022 },
    aggressive: { ratio: 12, attack: 20, release: 300, thresh: 0.015 },
  }[params.duckingPreset || 'balanced'] || { ratio: 6, attack: 35, release: 380, thresh: 0.022 };

  const audioDir = path.join(MEDIA_DIR, 'audio');
  const outName = `multitrack_${Date.now()}_${crypto.randomBytes(3).toString('hex')}.mp3`;
  const outPath = path.join(audioDir, outName);

  const ffmpegArgs: string[] = ['-y', '-i', voicePath];
  let inputIdx = 1;
  const filterParts: string[] = [];
  const mixInputs: string[] = ['[v_main]'];

  if (musicPath && ducking) {
    filterParts.push(`[0:a]aresample=44100,aformat=sample_rates=44100:channel_layouts=stereo,apad=pad_dur=${tailSec},asplit=2[v_main][v_sc]`);
  } else {
    filterParts.push(`[0:a]aresample=44100,aformat=sample_rates=44100:channel_layouts=stereo,apad=pad_dur=${tailSec}[v_main]`);
  }

  if (musicPath) {
    ffmpegArgs.push('-stream_loop', '-1', '-i', musicPath);
    const mIdx = inputIdx++;
    if (ducking) {
      filterParts.push(
        `[${mIdx}:a]aresample=44100,aformat=sample_rates=44100:channel_layouts=stereo,atrim=0:${totalDur},afade=t=in:st=0:d=0.6,afade=t=out:st=${fadeOutStart}:d=1.4,volume=${musicVol}[bgm_raw]`,
        `[bgm_raw][v_sc]sidechaincompress=threshold=${duckConfig.thresh}:ratio=${duckConfig.ratio}:attack=${duckConfig.attack}:release=${duckConfig.release}:makeup=1[bgm_ducked]`
      );
      mixInputs.push('[bgm_ducked]');
    } else {
      filterParts.push(
        `[${mIdx}:a]aresample=44100,aformat=sample_rates=44100:channel_layouts=stereo,atrim=0:${totalDur},afade=t=in:st=0:d=0.6,afade=t=out:st=${fadeOutStart}:d=1.4,volume=${musicVol}[bgm_clean]`
      );
      mixInputs.push('[bgm_clean]');
    }
  }

  if (ambientPath) {
    ffmpegArgs.push('-stream_loop', '-1', '-i', ambientPath);
    const aIdx = inputIdx++;
    filterParts.push(
      `[${aIdx}:a]aresample=44100,aformat=sample_rates=44100:channel_layouts=stereo,atrim=0:${totalDur},afade=t=in:st=0:d=1.0,afade=t=out:st=${fadeOutStart}:d=1.5,volume=${ambientVol}[ambient_trk]`
    );
    mixInputs.push('[ambient_trk]');
  }

  filterParts.push(
    `${mixInputs.join('')}amix=inputs=${mixInputs.length}:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.96[aout]`
  );

  ffmpegArgs.push(
    '-filter_complex', filterParts.join(';'),
    '-map', '[aout]',
    '-ar', '44100',
    '-ac', '2',
    '-c:a', 'libmp3lame',
    '-b:a', '192k',
    outPath
  );

  await execFileAsync(ffmpegPath, ffmpegArgs, { timeout: 60_000 });
  const measuredDur = await probeAudioDurationSec(outPath);

  return {
    mixedAudioUrl: `/media/audio/${outName}`,
    durationSec: measuredDur,
    tracksMixed: mixInputs.length,
  };
}

export interface ScannedMusicItem {
  id: string;
  name: string;
  category: string;
  url: string;
  durationSec: number;
}

export async function scanMusicLibrary(): Promise<ScannedMusicItem[]> {
  const libraryBase = path.join(DATA_DIR, 'music');
  const items: ScannedMusicItem[] = [];

  const scanDir = async (dir: string, category: string) => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const full = path.join(dir, file);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        await scanDir(full, file);
      } else if (/\.(mp3|wav|ogg|m4a|aac)$/i.test(file)) {
        const id = `${category}_${file.replace(/\.[^.]+$/, '')}`;
        const name = file
          .replace(/\.[^.]+$/, '')
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());
        const dur = await probeAudioDurationSec(full);
        const relUrl = `/music/${path.relative(libraryBase, full).replace(/\\/g, '/')}`;
        items.push({
          id,
          name,
          category,
          url: relUrl,
          durationSec: dur,
        });
      }
    }
  };

  await scanDir(libraryBase, 'general');
  return items;
}

export interface ScannedSfxItem {
  id: string;
  name: string;
  category: 'ambient' | 'hits';
  url: string;
  durationSec: number;
}

export async function scanSfxLibrary(): Promise<ScannedSfxItem[]> {
  const sfxBase = path.join(DATA_DIR, 'sfx');
  const items: ScannedSfxItem[] = [];

  const scanDir = async (dir: string, category: 'ambient' | 'hits') => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const full = path.join(dir, file);
      if (fs.statSync(full).isFile() && /\.(mp3|wav|ogg|m4a)$/i.test(file)) {
        const id = `${category}_${file.replace(/\.[^.]+$/, '')}`;
        const name = file
          .replace(/\.[^.]+$/, '')
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());
        const dur = await probeAudioDurationSec(full);
        const relUrl = `/sfx/${path.relative(sfxBase, full).replace(/\\/g, '/')}`;
        items.push({
          id,
          name,
          category,
          url: relUrl,
          durationSec: dur,
        });
      }
    }
  };

  await scanDir(path.join(sfxBase, 'ambient'), 'ambient');
  await scanDir(path.join(sfxBase, 'hits'), 'hits');
  return items;
}


