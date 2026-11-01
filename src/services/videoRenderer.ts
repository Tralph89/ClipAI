/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AspectRatioType, CameraMotionType, Scene, SubtitleStyleType } from '../types';

/**
 * Generates a real playable WAV data URL for built-in studio background music presets
 * using Web Audio API OfflineAudioContext so users always have instant royalty-free music
 * that mixes cleanly into the rendered video.
 */
export async function synthesizeStudioMusicTrack(
  presetId: string,
  durationSeconds: number = 20
): Promise<string> {
  const sampleRate = 22050;
  const length = sampleRate * durationSeconds;
  const offlineCtx = new OfflineAudioContext(1, length, sampleRate);

  const presets: Record<
    string,
    { baseFreq: number; chords: number[]; bpm: number; wave: OscillatorType }
  > = {
    'cyber-pulse': { baseFreq: 110, chords: [110, 130.81, 164.81, 146.83], bpm: 124, wave: 'sawtooth' },
    'cinematic-rise': { baseFreq: 98, chords: [98, 123.47, 146.83, 164.81], bpm: 92, wave: 'triangle' },
    'lofi-focus': { baseFreq: 130.81, chords: [130.81, 164.81, 196.0, 174.61], bpm: 86, wave: 'sine' },
    'viral-phonk': { baseFreq: 82.41, chords: [82.41, 98.0, 123.47, 110.0], bpm: 132, wave: 'sawtooth' },
    'dark-mystery': { baseFreq: 73.42, chords: [73.42, 87.31, 110.0, 69.3], bpm: 76, wave: 'triangle' },
  };

  const config = presets[presetId] || presets['cyber-pulse'];
  const beatDuration = 60 / config.bpm;

  // Pad layer
  const filter = offlineCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 650;
  filter.connect(offlineCtx.destination);

  for (let t = 0; t < durationSeconds; t += beatDuration * 4) {
    const chordIdx = Math.floor(t / (beatDuration * 4)) % config.chords.length;
    const root = config.chords[chordIdx];

    [root, root * 1.5, root * 2].forEach((freq) => {
      const osc = offlineCtx.createOscillator();
      const gain = offlineCtx.createGain();
      osc.type = config.wave;
      osc.frequency.setValueAtTime(freq, t);

      const end = Math.min(durationSeconds, t + beatDuration * 4);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.06, t + 0.25);
      gain.gain.setValueAtTime(0.05, Math.max(t + 0.26, end - 0.3));
      gain.gain.linearRampToValueAtTime(0.001, end);

      osc.connect(gain);
      gain.connect(filter);
      osc.start(t);
      osc.stop(end);
    });
  }

  // Rhythmic pulse
  for (let t = 0; t < durationSeconds; t += beatDuration) {
    const kickOsc = offlineCtx.createOscillator();
    const kickGain = offlineCtx.createGain();
    kickOsc.type = 'sine';
    kickOsc.frequency.setValueAtTime(115, t);
    kickOsc.frequency.exponentialRampToValueAtTime(38, t + 0.14);

    kickGain.gain.setValueAtTime(0.18, t);
    kickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    kickOsc.connect(kickGain);
    kickGain.connect(offlineCtx.destination);
    kickOsc.start(t);
    kickOsc.stop(Math.min(durationSeconds, t + 0.17));
  }

  const renderedBuffer = await offlineCtx.startRendering();
  return audioBufferToWavDataUrl(renderedBuffer);
}

function audioBufferToWavDataUrl(buffer: AudioBuffer): string {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const out = new ArrayBuffer(length);
  const view = new DataView(out);
  const sampleRate = buffer.sampleRate;
  let pos = 0;

  const setUint16 = (data: number) => {
    view.setUint16(pos, data, true);
    pos += 2;
  };
  const setUint32 = (data: number) => {
    view.setUint32(pos, data, true);
    pos += 4;
  };

  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8);
  setUint32(0x45564157); // "WAVE"
  setUint32(0x20746d66); // "fmt "
  setUint32(16);
  setUint16(1);
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2);
  setUint16(16);
  setUint32(0x61746164); // "data"
  setUint32(length - pos - 4);

  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < channelData.length; i++) {
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(pos, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    pos += 2;
  }

  const bytes = new Uint8Array(out);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

async function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

async function loadVideoElement(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const vid = document.createElement('video');
    vid.crossOrigin = 'anonymous';
    vid.muted = true;
    vid.loop = true;
    vid.playsInline = true;
    vid.preload = 'auto';
    vid.onloadeddata = () => resolve(vid);
    vid.onerror = (err) => reject(err);
    vid.src = src;
    vid.load();
  });
}

export function drawSceneFrameOnCanvas(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  scene: Scene,
  mediaElement: HTMLImageElement | HTMLVideoElement | null,
  sceneProgress: number, // 0 to 1
  subtitleStyle: SubtitleStyleType = 'hormozi',
  channelWatermark?: string
) {
  ctx.save();
  ctx.fillStyle = '#090A0F';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const isVideoClip =
    typeof HTMLVideoElement !== 'undefined' && mediaElement instanceof HTMLVideoElement;

  const motion: CameraMotionType = scene.cameraMotion || 'zoom_in';
  let scale = isVideoClip ? 1.02 : 1.08;
  let offsetX = 0;
  let offsetY = 0;

  if (!isVideoClip) {
    if (motion === 'zoom_in') {
      scale = 1.0 + sceneProgress * 0.16;
    } else if (motion === 'zoom_out') {
      scale = 1.18 - sceneProgress * 0.16;
    } else if (motion === 'pan_right') {
      scale = 1.15;
      offsetX = (sceneProgress - 0.5) * canvasWidth * 0.1;
    } else if (motion === 'pan_left') {
      scale = 1.15;
      offsetX = (0.5 - sceneProgress) * canvasWidth * 0.1;
    } else if (motion === 'pulse') {
      scale = 1.06 + Math.sin(sceneProgress * Math.PI * 2) * 0.05;
    }
  }

  if (mediaElement) {
    const sourceW = isVideoClip
      ? mediaElement.videoWidth || canvasWidth
      : (mediaElement as HTMLImageElement).width || canvasWidth;
    const sourceH = isVideoClip
      ? mediaElement.videoHeight || canvasHeight
      : (mediaElement as HTMLImageElement).height || canvasHeight;

    const imgRatio = sourceW / Math.max(1, sourceH);
    const canvasRatio = canvasWidth / canvasHeight;
    let drawW = canvasWidth;
    let drawH = canvasHeight;

    if (imgRatio > canvasRatio) {
      drawH = canvasHeight;
      drawW = canvasHeight * imgRatio;
    } else {
      drawW = canvasWidth;
      drawH = canvasWidth / imgRatio;
    }

    ctx.translate(canvasWidth / 2 + offsetX, canvasHeight / 2 + offsetY);
    ctx.scale(scale, scale);
    ctx.drawImage(mediaElement, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  } else {
    // Stylized gradient backdrop if scene has no image yet
    const grad = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
    grad.addColorStop(0, '#1E1B4B');
    grad.addColorStop(0.5, '#0F172A');
    grad.addColorStop(1, '#3B0764');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  // Cinematic vignette & bottom gradient for subtitle legibility
  const bottomGrad = ctx.createLinearGradient(0, canvasHeight * 0.45, 0, canvasHeight);
  bottomGrad.addColorStop(0, 'rgba(9, 10, 15, 0)');
  bottomGrad.addColorStop(0.7, 'rgba(9, 10, 15, 0.65)');
  bottomGrad.addColorStop(1, 'rgba(9, 10, 15, 0.92)');
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, canvasHeight * 0.45, canvasWidth, canvasHeight * 0.55);

  // Channel watermark badge
  if (channelWatermark) {
    ctx.font = `600 ${Math.round(canvasWidth * 0.028)}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.textAlign = 'left';
    ctx.fillText(channelWatermark, canvasWidth * 0.05, canvasHeight * 0.06);
  }

  // Dynamic Word-Chunked Subtitles (Synced to real `scene.wordTimings` when available)
  const dialogue = (scene.dialogue || '').trim();
  if (dialogue) {
    const words =
      scene.wordTimings && scene.wordTimings.length > 0
        ? scene.wordTimings.map((wt) => wt.word)
        : dialogue.split(/\s+/);
    const chunkSize = 5;
    const totalChunks = Math.max(1, Math.ceil(words.length / chunkSize));

    let globalWordIndex = Math.min(words.length - 1, Math.floor(sceneProgress * words.length));
    if (scene.wordTimings && scene.wordTimings.length > 0 && scene.durationSec) {
      const localSec = sceneProgress * scene.durationSec;
      const foundIdx = scene.wordTimings.findIndex(
        (wt, idx) =>
          localSec >= wt.startSec &&
          (localSec <= wt.endSec || idx === scene.wordTimings!.length - 1)
      );
      if (foundIdx >= 0) {
        globalWordIndex = foundIdx;
      }
    }

    const activeChunkIndex = Math.min(totalChunks - 1, Math.floor(globalWordIndex / chunkSize));
    const chunkWords = words.slice(
      activeChunkIndex * chunkSize,
      activeChunkIndex * chunkSize + chunkSize
    );
    const activeWordIdx = globalWordIndex - activeChunkIndex * chunkSize;

    const fontSize = Math.max(22, Math.round(canvasWidth * (canvasWidth > canvasHeight ? 0.042 : 0.062)));
    ctx.font = `800 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const subtitleY = canvasHeight * 0.8;
    const fullLine = chunkWords.join(' ').toUpperCase();

    if (subtitleStyle === 'boxed') {
      const textMetrics = ctx.measureText(fullLine);
      const padX = 24;
      const padY = 16;
      ctx.fillStyle = 'rgba(124, 58, 237, 0.92)';
      ctx.beginPath();
      ctx.roundRect(
        canvasWidth / 2 - textMetrics.width / 2 - padX,
        subtitleY - fontSize / 2 - padY,
        textMetrics.width + padX * 2,
        fontSize + padY * 2,
        12
      );
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(fullLine, canvasWidth / 2, subtitleY);
    } else if (subtitleStyle === 'hormozi' || subtitleStyle === 'neon') {
      // Draw word by word with active word highlight
      const spacing = fontSize * 0.32;
      const wordWidths = chunkWords.map((w) => ctx.measureText(w.toUpperCase()).width);
      const totalWidth =
        wordWidths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, chunkWords.length - 1);
      let cursorX = canvasWidth / 2 - totalWidth / 2;

      chunkWords.forEach((word, idx) => {
        const upper = word.toUpperCase();
        const wWidth = wordWidths[idx];
        const centerX = cursorX + wWidth / 2;

        ctx.lineWidth = Math.max(4, Math.round(fontSize * 0.16));
        ctx.strokeStyle = '#000000';
        ctx.strokeText(upper, centerX, subtitleY);

        if (idx === activeWordIdx) {
          ctx.fillStyle = subtitleStyle === 'neon' ? '#38BDF8' : '#FACC15';
        } else {
          ctx.fillStyle = '#FFFFFF';
        }
        ctx.fillText(upper, centerX, subtitleY);
        cursorX += wWidth + spacing;
      });
    } else {
      // Minimal style
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.strokeText(fullLine, canvasWidth / 2, subtitleY);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(fullLine, canvasWidth / 2, subtitleY);
    }
  }

  ctx.restore();
}

export async function renderRealVideoInBrowser(options: {
  scenes: Scene[];
  aspectRatio: AspectRatioType;
  voiceAudioUrl?: string;
  musicAudioUrl?: string;
  mixedAudioUrl?: string;
  subtitleStyle?: SubtitleStyleType;
  channelWatermark?: string;
  onProgress?: (percent: number) => void;
}): Promise<string> {
  const {
    scenes,
    aspectRatio,
    voiceAudioUrl,
    musicAudioUrl,
    mixedAudioUrl,
    subtitleStyle = 'hormozi',
    channelWatermark,
    onProgress,
  } = options;

  const width = aspectRatio === '16:9' ? 1280 : aspectRatio === '1:1' ? 720 : 720;
  const height = aspectRatio === '16:9' ? 720 : aspectRatio === '1:1' ? 720 : 1280;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo inicializar el motor gráfico Canvas 2D.');
  }

  // Preload all scene B-Roll videos (if present) and static images
  const [loadedVideos, loadedImages] = await Promise.all([
    Promise.all(
      scenes.map(async (s) => {
        const clipSrc = s.videoClipUrl || s.animatedUrl;
        if (!clipSrc) return null;
        try {
          return await loadVideoElement(clipSrc);
        } catch {
          return null;
        }
      })
    ),
    Promise.all(
      scenes.map(async (s) => {
        if (!s.imageUrl) return null;
        try {
          return await loadImageElement(s.imageUrl);
        } catch {
          return null;
        }
      })
    ),
  ]);

  const audioCtx = new AudioContext();
  const destNode = audioCtx.createMediaStreamDestination();

  let totalDurationSec = Math.max(8, scenes.length * 4);

  const decodeAudioUrl = async (url?: string): Promise<AudioBuffer | null> => {
    if (!url) return null;
    try {
      const res = await fetch(url);
      const arr = await res.arrayBuffer();
      return await audioCtx.decodeAudioData(arr);
    } catch {
      return null;
    }
  };

  const [mixedBuffer, voiceBuffer, musicBuffer] = await Promise.all([
    decodeAudioUrl(mixedAudioUrl),
    mixedAudioUrl ? Promise.resolve(null) : decodeAudioUrl(voiceAudioUrl),
    mixedAudioUrl ? Promise.resolve(null) : decodeAudioUrl(musicAudioUrl),
  ]);

  if (mixedBuffer) {
    totalDurationSec = Math.max(4, mixedBuffer.duration);
    const mixSource = audioCtx.createBufferSource();
    mixSource.buffer = mixedBuffer;
    mixSource.connect(destNode);
    mixSource.start(0);
  } else {
    if (voiceBuffer) {
      totalDurationSec = Math.max(4, voiceBuffer.duration + 0.8);
      const voiceSource = audioCtx.createBufferSource();
      voiceSource.buffer = voiceBuffer;
      const voiceGain = audioCtx.createGain();
      voiceGain.gain.value = 1.0;
      voiceSource.connect(voiceGain);
      voiceGain.connect(destNode);
      voiceSource.start(0);
    }

    if (musicBuffer) {
      const musicSource = audioCtx.createBufferSource();
      musicSource.buffer = musicBuffer;
      musicSource.loop = true;
      const musicGain = audioCtx.createGain();
      musicGain.gain.value = voiceBuffer ? 0.22 : 0.65;
      musicSource.connect(musicGain);
      musicGain.connect(destNode);
      musicSource.start(0);
    }
  }

  const canvasStream = canvas.captureStream(30);
  const combinedTracks = [
    ...canvasStream.getVideoTracks(),
    ...destNode.stream.getAudioTracks(),
  ];
  const combinedStream = new MediaStream(combinedTracks);

  const mimeTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  const supportedMime = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || '';

  const recorder = new MediaRecorder(
    combinedStream,
    supportedMime ? { mimeType: supportedMime, videoBitsPerSecond: 4_000_000 } : undefined
  );

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  const cleanupVideos = () => {
    loadedVideos.forEach((v) => {
      if (v) {
        try {
          v.pause();
          v.removeAttribute('src');
        } catch {
          // ignore
        }
      }
    });
  };

  return new Promise((resolve, reject) => {
    recorder.onerror = (err) => {
      cleanupVideos();
      audioCtx.close().catch(() => {});
      reject(err);
    };

    recorder.onstop = () => {
      cleanupVideos();
      audioCtx.close().catch(() => {});
      const blob = new Blob(chunks, { type: supportedMime || 'video/webm' });
      const videoUrl = URL.createObjectURL(blob);
      resolve(videoUrl);
    };

    recorder.start(200);
    const startTime = performance.now();
    const durationMs = totalDurationSec * 1000;
    const sceneCount = Math.max(1, scenes.length);
    let activePlayingVideoIdx = -1;

    const renderLoop = () => {
      const elapsed = performance.now() - startTime;
      const overallProgress = Math.min(1, elapsed / durationMs);
      onProgress?.(Math.round(overallProgress * 100));

      const elapsedSec = elapsed / 1000;
      let sceneIndex = Math.min(sceneCount - 1, Math.floor(overallProgress * sceneCount));
      let sceneProgress = overallProgress * sceneCount - sceneIndex;

      if (scenes.some((s) => typeof s.durationSec === 'number' && s.durationSec > 0)) {
        let cursor = 0;
        for (let i = 0; i < scenes.length; i++) {
          const sDur = scenes[i].durationSec || 4;
          const sStart = typeof scenes[i].startSec === 'number' ? scenes[i].startSec! : cursor;
          const sEnd = sStart + sDur;
          if (elapsedSec <= sEnd + 0.14 || i === scenes.length - 1) {
            sceneIndex = i;
            sceneProgress = Math.max(0, Math.min(1, (elapsedSec - sStart) / Math.max(0.2, sDur)));
            break;
          }
          cursor = sEnd + 0.14;
        }
      }

      if (sceneIndex !== activePlayingVideoIdx) {
        if (activePlayingVideoIdx >= 0 && loadedVideos[activePlayingVideoIdx]) {
          loadedVideos[activePlayingVideoIdx]?.pause();
        }
        activePlayingVideoIdx = sceneIndex;
        const nextVid = loadedVideos[sceneIndex];
        if (nextVid) {
          nextVid.currentTime = 0;
          nextVid.play().catch(() => {});
        }
      }

      const activeMedia =
        (loadedVideos[sceneIndex] && loadedVideos[sceneIndex]!.readyState >= 2
          ? loadedVideos[sceneIndex]
          : null) ||
        loadedImages[sceneIndex] ||
        null;

      drawSceneFrameOnCanvas(
        ctx,
        width,
        height,
        scenes[sceneIndex] || { title: 'Escena', dialogue: '' },
        activeMedia,
        sceneProgress,
        subtitleStyle,
        channelWatermark
      );

      if (elapsed < durationMs) {
        requestAnimationFrame(renderLoop);
      } else {
        recorder.stop();
      }
    };

    requestAnimationFrame(renderLoop);
  });
}
