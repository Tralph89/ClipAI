/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AspectRatioType,
  ComfyArchitectureType,
  Scene,
  SocialPlatformId,
  StyleTechnicalProfile,
  TrendItem,
  VideoMetadata,
  VisualBible,
} from '../types';

export async function searchLiveTrends(params: {
  query?: string;
  niche?: string;
  region?: string;
  platforms?: SocialPlatformId[];
}): Promise<{ trends: TrendItem[]; sources: Array<{ title: string; uri: string }> }> {
  const response = await fetch('/api/trends/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'No se pudieron obtener las tendencias en vivo.');
  }
  return data;
}

export async function generateScript(
  prompt: string,
  genre: string,
  subgenre: string,
  duration: string,
  language: string = 'es',
  aspectRatio: AspectRatioType = '9:16',
  channelTone?: string,
  trendContext?: string
): Promise<string> {
  const response = await fetch('/api/script', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      genre,
      subgenre,
      duration,
      language,
      aspectRatio,
      channelTone,
      trendContext,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Error al generar el guion.');
  }
  return data.script;
}

export async function craftVisualBibleAndPrompts(params: {
  scenes: Scene[];
  styleProfile: StyleTechnicalProfile;
  architecture: ComfyArchitectureType;
  aspectRatio: AspectRatioType;
  existingVisualBible?: VisualBible;
}): Promise<{
  visualBible: VisualBible;
  scenePrompts: Array<{
    sceneIndex: number;
    comfyPositivePrompt: string;
    comfyNegativePrompt: string;
  }>;
}> {
  const response = await fetch('/api/visuals/craft-prompts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'No se pudieron construir los prompts coherentes con IA.');
  }
  return data;
}

export async function generateSpeech(
  text: string,
  voiceName: string = 'es-MX-DaliaNeural',
  language: string = 'es'
): Promise<string> {
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice: voiceName, language }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'No se pudo generar el audio de narración.');
  }
  return data.audioDataUrl;
}

export async function generateSceneImage(
  scenePrompt: string,
  style: string,
  aspectRatio: AspectRatioType = '9:16',
  isThumbnail: boolean = false,
  extraOptions?: {
    comfyPositivePrompt?: string;
    comfyNegativePrompt?: string;
    visualBible?: VisualBible;
    seed?: number;
  }
): Promise<string> {
  const response = await fetch('/api/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: scenePrompt,
      style,
      aspectRatio,
      isThumbnail,
      ...(extraOptions || {}),
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'No se pudo generar la imagen de la escena.');
  }
  return data.imageUrl;
}

export async function animateSceneWithAI(
  prompt: string,
  imageUrl?: string,
  aspectRatio: AspectRatioType = '9:16'
): Promise<string> {
  const response = await fetch('/api/video/animate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, imageUrl, aspectRatio }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'No se pudo animar la escena con Veo.');
  }
  return data.videoDataUrl;
}

export async function generateMusicWithLyria(
  prompt: string,
  genre: string,
  mood?: string
): Promise<string> {
  const response = await fetch('/api/music', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, genre, mood }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'No se pudo generar música con Lyria.');
  }
  return data.audioDataUrl;
}

export async function generateSubtitles(script: string, duration: string = '60s'): Promise<string> {
  const response = await fetch('/api/subtitles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ script, duration }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'No se pudieron generar los subtítulos.');
  }
  return data.subtitles;
}

export async function generateMarketingData(
  script: string,
  genre: string,
  channelName?: string,
  trendTitle?: string
): Promise<VideoMetadata> {
  const response = await fetch('/api/marketing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ script, genre, channelName, trendTitle }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'No se pudo generar el paquete de marketing.');
  }
  return data;
}

export async function dispatchChannelWebhook(
  webhookUrl: string,
  payload: Record<string, any>
): Promise<{ success: boolean; status: number; responsePreview: string }> {
  const response = await fetch('/api/channels/publish-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ webhookUrl, payload }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Error al enviar al Webhook.');
  }
  return data;
}
