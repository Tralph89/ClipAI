/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AIProviderId,
  AppSettings,
  AspectRatioType,
  LocalVideoClusterStatus,
  LocalVideoEngineId,
  Project,
  Scene,
  ScheduledPost,
  SocialChannel,
  SocialPlatformId,
  StockVideoCandidate,
  SystemStatus,
  TrendItem,
  TrendScanTelemetry,
  VideoMetadata,
  VisualModeType,
  WordTiming,
} from '../types';

export interface BootstrapPayload {
  settings: AppSettings;
  channels: SocialChannel[];
  projects: Project[];
  scheduledPosts: ScheduledPost[];
  trends: TrendItem[];
  systemStatus: SystemStatus;
}

export async function fetchBootstrap(): Promise<BootstrapPayload> {
  const response = await fetch('/api/bootstrap');
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'No se pudo cargar la configuración inicial del servidor.');
  }
  return data;
}

export async function fetchSystemStatus(): Promise<SystemStatus> {
  const response = await fetch('/api/system/status');
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'No se pudo consultar el estado de herramientas locales.');
  }
  return data;
}

export async function testAIMotorConnection(
  provider?: AIProviderId,
  model?: string
): Promise<{
  ok: boolean;
  providerUsed: AIProviderId;
  modelUsed: string;
  latencyMs: number;
  sampleOutput: string;
}> {
  const response = await fetch('/api/system/test-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, model }),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.error || 'Fallo al probar el motor de IA.');
  }
  return data;
}

export async function saveAppSettings(
  partial: Partial<AppSettings>
): Promise<AppSettings> {
  const response = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(partial),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'No se pudieron guardar los ajustes.');
  }
  return data.settings;
}

export async function saveChannelsToDisk(
  channels: SocialChannel[]
): Promise<SocialChannel[]> {
  const response = await fetch('/api/channels', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channels }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Error al guardar canales en disco.');
  }
  return data.channels;
}

export async function saveProjectToDisk(project: Project): Promise<Project> {
  const response = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Error al guardar el proyecto en disco.');
  }
  return data.project;
}

export async function deleteProjectFromDisk(projectId: string): Promise<void> {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Error al eliminar el proyecto.');
  }
}

export async function saveScheduledPostsToDisk(
  scheduledPosts: ScheduledPost[]
): Promise<ScheduledPost[]> {
  const response = await fetch('/api/scheduled-posts', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scheduledPosts }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Error al guardar calendario en disco.');
  }
  return data.scheduledPosts;
}

export async function saveTrendsToDisk(trends: TrendItem[]): Promise<TrendItem[]> {
  const response = await fetch('/api/trends', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trends }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Error al persistir tendencias.');
  }
  return data.trends;
}

export async function uploadBlobUrlToDisk(
  blobOrDataUrl: string,
  subfolder: 'audio' | 'images' | 'videos' | 'thumbnails' = 'videos',
  prefix: string = 'clipai'
): Promise<string> {
  let dataUrl = blobOrDataUrl;

  if (blobOrDataUrl.startsWith('blob:')) {
    const blobRes = await fetch(blobOrDataUrl);
    const blob = await blobRes.blob();
    dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  if (!dataUrl.startsWith('data:')) {
    return blobOrDataUrl;
  }

  const response = await fetch('/api/media/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataUrl, subfolder, prefix }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'No se pudo guardar el archivo multimedia en el servidor.');
  }
  return data.mediaUrl;
}

// ============================================================================
// AI & PRODUCTION CALLS
// ============================================================================

export async function searchLiveTrends(params: {
  query?: string;
  niche?: string;
  region?: string;
  platforms?: SocialPlatformId[];
  mode?: 'niche' | 'breaking';
}): Promise<{
  trends: TrendItem[];
  sources: Array<{ title: string; uri: string }>;
  telemetry?: TrendScanTelemetry;
}> {
  const response = await fetch('/api/trends/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'No se pudieron obtener las tendencias.');
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
): Promise<{
  hook?: string;
  scenes?: Scene[];
  script: string;
  providerUsed?: string;
  modelUsed?: string;
}> {
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
  return data;
}

export async function generateSpeechClip(params: {
  text: string;
  voice?: string;
  language?: string;
  speed?: number;
  filenamePrefix?: string;
}): Promise<{
  audioDataUrl: string;
  durationSec: number;
  wordTimings: WordTiming[];
  engine: string;
  voiceUsed: string;
}> {
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'No se pudo generar el audio de narración.');
  }
  return data;
}

export async function generateSpeech(
  text: string,
  voiceName: string = 'Kore',
  language: string = 'es',
  speed: number = 1.08
): Promise<string> {
  const clip = await generateSpeechClip({
    text,
    voice: voiceName,
    language,
    speed,
  });
  return clip.audioDataUrl;
}

export async function generateScenesVoiceover(params: {
  scenes: Scene[];
  voice: string;
  language: string;
  speed?: number;
}): Promise<{
  scenes: Scene[];
  voiceAudioUrl: string;
  totalDurationSec: number;
  subtitlesSrt: string;
  engine: string;
  voiceUsed: string;
}> {
  const response = await fetch('/api/tts/scenes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Error al sintetizar las voces por escena.');
  }
  return data;
}

export async function rebuildMasterVoiceTrack(scenes: Scene[]): Promise<{
  scenes: Scene[];
  voiceAudioUrl: string;
  totalDurationSec: number;
  subtitlesSrt: string;
}> {
  const response = await fetch('/api/tts/rebuild-master', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenes }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Error al reconstruir la pista maestra.');
  }
  return data;
}

export async function previewVoiceSample(
  voice: string,
  customText?: string
): Promise<{
  sampleAudioUrl: string;
  engine: string;
  voiceUsed: string;
  cached: boolean;
}> {
  const response = await fetch('/api/tts/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voice, customText }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'No se pudo cargar la muestra de voz.');
  }
  return data;
}

export type VisualInitialSource = 'local' | 'gemini' | 'pixabay';

export async function generateSceneInitialImage(params: {
  sceneIndex: number;
  prompt: string;
  style: string;
  aspectRatio?: AspectRatioType;
  engineSource?: VisualInitialSource;
  stockKeywords?: string[];
  seed?: number;
}): Promise<{
  sceneIndex: number;
  imageUrl: string;
  provider: string;
  seedUsed: number;
}> {
  const response = await fetch('/api/visuals/scene-initial-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'No se pudo generar la imagen inicial de la escena.');
  }
  return data;
}

export async function generateBatchInitialImages(params: {
  scenes: Scene[];
  style: string;
  aspectRatio?: AspectRatioType;
  engineSource?: VisualInitialSource;
  visualSeed?: number;
}): Promise<{
  scenes: Scene[];
  visualSeed: number;
}> {
  const response = await fetch('/api/visuals/batch-initial-images', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'No se pudieron generar las imágenes iniciales en lote.');
  }
  return data;
}

export async function generateSceneImageDetailed(params: {
  prompt: string;
  style: string;
  aspectRatio?: AspectRatioType;
  isThumbnail?: boolean;
  seed?: number;
  stockKeywords?: string[];
  engineSource?: VisualInitialSource;
}): Promise<{ imageUrl: string; provider: string; seedUsed: number }> {
  const response = await fetch('/api/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'No se pudo generar la imagen de la escena.');
  }
  return data;
}

export async function generateSceneImage(
  scenePrompt: string,
  style: string,
  aspectRatio: AspectRatioType = '9:16',
  isThumbnail: boolean = false,
  seed?: number,
  stockKeywords?: string[],
  engineSource?: VisualInitialSource
): Promise<string> {
  const res = await generateSceneImageDetailed({
    prompt: scenePrompt,
    style,
    aspectRatio,
    isThumbnail,
    seed,
    stockKeywords,
    engineSource,
  });
  return res.imageUrl;
}

export async function fetchLocalVideoClusterStatus(): Promise<LocalVideoClusterStatus> {
  const response = await fetch('/api/visuals/local-engines/status');
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'No se pudo consultar el estado de motores de video local.');
  }
  return data;
}

export async function toggleLocalVideoEngine(
  engine: LocalVideoEngineId,
  action: 'start' | 'stop'
): Promise<LocalVideoClusterStatus> {
  const response = await fetch('/api/visuals/local-engines/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ engine, action }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Error al ${action === 'start' ? 'iniciar' : 'detener'} ${engine}.`);
  }
  return data;
}

export async function generateSceneLocalVideoClip(params: {
  scene: Scene;
  aspectRatio?: AspectRatioType;
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
  const response = await fetch('/api/visuals/scene-local-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Error al generar video local para la escena.');
  }
  return data;
}

export async function searchStockVideosOnServer(
  query: string,
  aspectRatio: AspectRatioType = '9:16'
): Promise<{
  candidates: StockVideoCandidate[];
  usedApiKeys: { pexels: boolean; pixabay: boolean };
}> {
  const response = await fetch('/api/visuals/stock-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, aspectRatio }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'No se pudieron buscar videos stock.');
  }
  return data;
}

export async function downloadStockVideoClipOnServer(params: {
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
  const response = await fetch('/api/visuals/stock-download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Error al descargar y normalizar clip B-Roll.');
  }
  return data;
}

export async function acquireSceneStockBrollOnServer(
  scene: Scene,
  aspectRatio: AspectRatioType = '9:16'
): Promise<{
  videoClipUrl: string;
  posterImageUrl: string;
  provider: string;
}> {
  const response = await fetch('/api/visuals/scene-broll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scene, aspectRatio }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'No se encontró clip B-Roll disponible.');
  }
  return data;
}

export async function generateBatchSceneVisualsOnServer(params: {
  scenes: Scene[];
  style: string;
  aspectRatio: AspectRatioType;
  visualMode?: VisualModeType;
  visualSeed?: number;
}): Promise<{ scenes: Scene[]; visualSeed: number }> {
  const response = await fetch('/api/visuals/generate-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Error al generar lote de visuales.');
  }
  return data;
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
    throw new Error(data.error || 'Se aplicará movimiento de cámara Ken Burns.');
  }
  return data.videoDataUrl;
}

export async function generateStudioMusicOnServer(
  presetId: string,
  durationSec: number = 36
): Promise<{ audioDataUrl: string; durationSec: number; presetId: string }> {
  const response = await fetch('/api/music', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ presetId, durationSec }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Error al generar música instrumental en el servidor.');
  }
  return data;
}

export async function mixStudioAudioWithDucking(params: {
  voiceAudioUrl: string;
  musicAudioUrl: string;
  musicVolume?: number;
  duckingEnabled?: boolean;
}): Promise<{ mixedAudioUrl: string; durationSec: number; duckingApplied: boolean }> {
  const response = await fetch('/api/audio/mix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Error al mezclar locución y música con ducking.');
  }
  return data;
}

export async function generateMusicWithLyria(
  prompt: string,
  genre: string,
  mood?: string,
  presetId: string = 'cyber-pulse',
  durationSec: number = 36
): Promise<string> {
  const response = await fetch('/api/music', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, genre, mood, presetId, durationSec }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Usando sintetizador local libre de derechos.');
  }
  return data.audioDataUrl;
}

export async function generateSubtitles(
  script: string,
  duration: string = '60s',
  scenes?: Scene[]
): Promise<string> {
  const response = await fetch('/api/subtitles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ script, duration, scenes }),
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

export async function renderMasterVideoOnServer(params: {
  scenes: Scene[];
  aspectRatio: AspectRatioType;
  voiceAudioUrl?: string;
  musicAudioUrl?: string;
  mixedAudioUrl?: string;
  subtitleStyle?: SubtitleStyleType;
  subtitlesEnabled?: boolean;
  channelWatermark?: string;
}): Promise<{
  jobId: string;
  status: string;
  progress: number;
  stage: string;
  videoUrl?: string;
  durationSec?: number;
  fileSizeMb?: number;
}> {
  const response = await fetch('/api/render/master-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Error al renderizar el video master en el servidor.');
  }
  return data;
}

export async function fetchRenderJobStatus(jobId: string) {
  const response = await fetch(`/api/render/status/${encodeURIComponent(jobId)}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Error al consultar estado de renderizado.');
  }
  return data;
}


