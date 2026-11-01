/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AspectRatioType = '9:16' | '16:9' | '1:1';

export type SocialPlatformId =
  | 'tiktok'
  | 'youtube_shorts'
  | 'facebook_reels'
  | 'youtube_long'
  | 'instagram_reels'
  | 'linkedin';

export type AIProviderId = 'ollama' | 'gemini' | 'groq';

export type PublishAutoMode = 'review_first' | 'auto_publish';

export type CameraMotionType = 'zoom_in' | 'zoom_out' | 'pan_right' | 'pan_left' | 'pulse';

export type SubtitleStyleType = 'hormozi' | 'neon' | 'minimal' | 'boxed';

export type LocalVideoEngineId = 'ltx_local' | 'wan_comfyui';

export type VisualModeType =
  | 'ltx_local'
  | 'wan_comfyui'
  | 'hybrid'
  | 'stock_broll'
  | 'ai_images';

export interface LocalVideoEngineInfo {
  id: LocalVideoEngineId;
  name: string;
  port: number;
  baseUrl: string;
  installed: boolean;
  modelSummary: string;
  status: 'online' | 'starting' | 'offline';
  managedByClipAI: boolean;
  busy?: boolean;
  progressPct?: number;
  progressPhase?: string;
  recentLogs: string[];
}

export interface LocalVideoClusterStatus {
  gpuName: string;
  vramTotalMb: number;
  vramUsedMb: number;
  vramFreeMb: number;
  engines: {
    wan_comfyui: LocalVideoEngineInfo;
    ltx_local: LocalVideoEngineInfo;
  };
}

export interface StockVideoCandidate {
  id: string;
  provider: 'pexels' | 'pixabay' | 'wikimedia' | 'nasa';
  title: string;
  previewImageUrl?: string;
  downloadUrl: string;
  durationSec?: number;
  width?: number;
  height?: number;
  author?: string;
}

export interface AppSettings {
  primaryProvider: AIProviderId;
  fallbackProvider: AIProviderId | 'none';
  ollamaBaseUrl: string;
  ollamaModel: string;
  ollamaKeepAlive: string;
  geminiApiKey?: string;
  geminiModel: string;
  groqApiKey?: string;
  groqModel: string;
  pexelsApiKey?: string;
  pixabayApiKey?: string;
  localSdUrl?: string;
  comfyUiUrl?: string;
  ltxLocalUrl?: string;
  preferredLocalVideoEngine?: LocalVideoEngineId;
  publishAutoMode: PublishAutoMode;
  defaultVoiceEngine: 'edge-tts' | 'piper' | 'gemini-tts';
}

export interface OllamaModelInfo {
  name: string;
  sizeBytes: number;
  parameterSize?: string;
  family?: string;
  capabilities?: string[];
}

export interface LocalToolStatus {
  id: string;
  name: string;
  available: boolean;
  path?: string;
  role: string;
}

export interface SystemStatus {
  ollamaReachable: boolean;
  ollamaVersion?: string;
  ollamaModels: OllamaModelInfo[];
  tools: LocalToolStatus[];
  storageDir: string;
  mediaCount: number;
}

export interface WordTiming {
  word: string;
  startSec: number;
  endSec: number;
}

export interface Scene {
  title: string;
  dialogue: string;
  hookText?: string;
  imagePrompt?: string;
  stockKeywords?: string[];
  imageUrl?: string;
  videoClipUrl?: string;
  animatedUrl?: string;
  visualSource?: 'local_wan_video' | 'local_ltx_video' | 'stock_video' | 'ai_image';
  visualProvider?: string;
  voiceAudioUrl?: string;
  durationSec?: number;
  startSec?: number;
  endSec?: number;
  wordTimings?: WordTiming[];
  cameraMotion?: CameraMotionType;
  isGeneratingImage?: boolean;
  isGeneratingVoice?: boolean;
  isAnimating?: boolean;
}

export interface PlatformSpecificCopy {
  title: string;
  caption: string;
  hashtags: string[];
  cta: string;
}

export interface VideoMetadata {
  title: string;
  description: string;
  hashtags: string[];
  thumbnailText?: string;
  thumbnailUrl?: string;
  isGenerating?: boolean;
  platformCopy?: Partial<Record<SocialPlatformId, PlatformSpecificCopy>>;
}

export interface VideoState {
  step: number;
  videoType: string;
  genre: string;
  subgenre: string;
  duration: string;
  script: string;
  style: string;
  visualMode?: VisualModeType;
  preferredLocalVideoEngine?: LocalVideoEngineId;
  visualSeed?: number;
  aspectRatio: AspectRatioType;
  language: string;
  voice: string;
  music: string;
  voiceAudioUrl?: string;
  musicAudioUrl?: string;
  mixedAudioUrl?: string;
  voiceSpeed?: number;
  musicVolume?: number;
  duckingEnabled?: boolean;
  totalDurationSec?: number;
  renderedVideoUrl?: string;
  subtitleStyle?: SubtitleStyleType;
  metadata?: VideoMetadata;
  subtitles?: string;
}

export interface Project {
  id: string;
  name: string;
  channelId?: string;
  sourceTrendId?: string;
  sourceTrendTitle?: string;
  createdAt: number;
  updatedAt: number;
  state: VideoState;
  scenes: Scene[];
  prompt: string;
}

export interface SocialChannel {
  id: string;
  name: string;
  handle: string;
  niche: string;
  tone: string;
  defaultAspectRatio: AspectRatioType;
  platforms: SocialPlatformId[];
  webhookUrl?: string;
  accentColor: string;
  subscribersCount?: string;
}

export interface TrendItem {
  id: string;
  title: string;
  summary: string;
  viralScore: number;
  category: string;
  whyTrending: string;
  suggestedHook: string;
  angle: string;
  recommendedFormats: AspectRatioType[];
  recommendedPlatforms: SocialPlatformId[];
  keywords: string[];
  sources: Array<{ title: string; uri: string }>;
  trafficBadge?: string;
  sourceTypes?: string[];
  detectedAt: number;
}

export interface TrendScanTelemetry {
  providerUsed: string;
  modelUsed: string;
  latencyMs: number;
  rawSignalsCount: number;
  breakdown: Record<string, number>;
}

export interface ScheduledPost {
  id: string;
  projectId: string;
  projectTitle: string;
  channelId: string;
  platforms: SocialPlatformId[];
  scheduledAt: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  aspectRatio: AspectRatioType;
  thumbnailUrl?: string;
  renderedVideoUrl?: string;
  webhookLog?: string;
}

export const SOCIAL_PLATFORMS: Array<{
  id: SocialPlatformId;
  name: string;
  shortName: string;
  recommendedRatio: AspectRatioType;
  maxDurationLabel: string;
  badgeColor: string;
  v1Priority: boolean;
}> = [
    {
      id: 'youtube_shorts',
      name: 'YouTube Shorts',
      shortName: 'YT Shorts',
      recommendedRatio: '9:16',
      maxDurationLabel: 'Hasta 60s (9:16)',
      badgeColor: 'bg-red-500/15 text-red-400 border-red-500/30',
      v1Priority: true,
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      shortName: 'TikTok',
      recommendedRatio: '9:16',
      maxDurationLabel: '15s - 10m (9:16)',
      badgeColor: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
      v1Priority: true,
    },
    {
      id: 'facebook_reels',
      name: 'Facebook Reels / Video',
      shortName: 'Facebook',
      recommendedRatio: '9:16',
      maxDurationLabel: '9:16 Reels / 16:9 Página',
      badgeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
      v1Priority: true,
    },
    {
      id: 'youtube_long',
      name: 'YouTube Largo (16:9)',
      shortName: 'YouTube 16:9',
      recommendedRatio: '16:9',
      maxDurationLabel: '3m - 15m+ (16:9)',
      badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      v1Priority: true,
    },
    {
      id: 'instagram_reels',
      name: 'Instagram Reels',
      shortName: 'IG Reels',
      recommendedRatio: '9:16',
      maxDurationLabel: 'Hasta 90s (Fase 2)',
      badgeColor: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30',
      v1Priority: false,
    },
    {
      id: 'linkedin',
      name: 'LinkedIn Video',
      shortName: 'LinkedIn',
      recommendedRatio: '9:16',
      maxDurationLabel: '9:16 / 1:1 (Fase 2)',
      badgeColor: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
      v1Priority: false,
    },
  ];

export const DEFAULT_SETTINGS: AppSettings = {
  primaryProvider: 'ollama',
  fallbackProvider: 'gemini',
  ollamaBaseUrl: 'http://127.0.0.1:11434',
  ollamaModel: 'gemma4:12b',
  ollamaKeepAlive: '10m',
  geminiApiKey: '',
  geminiModel: 'gemini-2.5-flash',
  groqApiKey: '',
  groqModel: 'llama-3.3-70b-versatile',
  pexelsApiKey: '',
  pixabayApiKey: '',
  comfyUiUrl: 'http://127.0.0.1:8188',
  ltxLocalUrl: 'http://127.0.0.1:41954',
  preferredLocalVideoEngine: 'ltx_local',
  publishAutoMode: 'review_first',
  defaultVoiceEngine: 'edge-tts',
};

export const DEFAULT_CHANNELS: SocialChannel[] = [
  {
    id: 'channel-tech-ai',
    name: 'Futuro & IA Hoy',
    handle: '@futuroiahoy',
    niche: 'Tecnología, Inteligencia Artificial y Startups',
    tone: 'Dinámico, revelador, con datos concretos y ganchos disruptivos',
    defaultAspectRatio: '9:16',
    platforms: ['youtube_shorts', 'tiktok', 'facebook_reels'],
    webhookUrl: '',
    accentColor: '#7C3AED',
    subscribersCount: 'Canal Principal V1',
  },
  {
    id: 'channel-finanzas',
    name: 'Capital Inteligente',
    handle: '@capitalinteligente',
    niche: 'Finanzas Personales, Economía Global y Negocios',
    tone: 'Autoridad accesible, analítico, directo al grano',
    defaultAspectRatio: '9:16',
    platforms: ['youtube_shorts', 'tiktok', 'facebook_reels', 'youtube_long'],
    webhookUrl: '',
    accentColor: '#10B981',
    subscribersCount: 'Canal Secundario V1',
  },
  {
    id: 'channel-curiosidades',
    name: 'Archivo Oculto Documental',
    handle: '@archivooculto',
    niche: 'Historia, Ciencia, Misterios y Documentales Cortos',
    tone: 'Cinematográfico, intrigante, narración inmersiva',
    defaultAspectRatio: '16:9',
    platforms: ['youtube_long', 'youtube_shorts', 'facebook_reels', 'tiktok'],
    webhookUrl: '',
    accentColor: '#F59E0B',
    subscribersCount: 'Documental V1',
  },
];

export const GENRES = [
  { id: 'educational', name: 'Educativo & Tech' },
  { id: 'marketing', name: 'Negocios & Marketing' },
  { id: 'documentary', name: 'Documental & Noticias' },
  { id: 'motivational', name: 'Motivacional & Hábitos' },
  { id: 'fiction', name: 'Ficción & Storytelling' },
  { id: 'religious', name: 'Histórico & Espiritual' },
  { id: 'comedy', name: 'Entretenimiento & Humor' },
  { id: 'horror', name: 'Misterio & Terror' },
];

export const SUBGENRES: Record<string, string[]> = {
  educational: ['Tendencia IA', 'Tutorial Express', 'Curiosidades', 'Ciencia'],
  marketing: ['Caso de Éxito', 'Noticia de Mercado', 'Marca Personal', 'Demo de Producto'],
  documentary: ['Investigación Viral', 'Biografía', 'Geopolítica', 'Naturaleza'],
  motivational: ['Productividad', 'Mentalidad', 'Hábitos Atómicos', 'Liderazgo'],
  fiction: ['Sci-Fi', 'Misterio', 'Drama', 'Acción'],
  religious: ['Historia Antigua', 'Reflexión', 'Sabiduría Clásica', 'Relato Bíblico'],
  comedy: ['Sátira Viral', 'Sketch', 'Parodia', 'Observacional'],
  horror: ['Caso Misterioso', 'Paranormal', 'Psicológico', 'Leyenda Urbana'],
};

export const DURATIONS = [
  { id: '30s', name: '30 Segundos (Short / TikTok / FB)', type: 'short' },
  { id: '60s', name: '60 Segundos (Viral Completo)', type: 'short' },
  { id: '3m', name: '3 Minutos (Análisis / FB / YT)', type: 'long' },
  { id: '5m', name: '5 Minutos (YouTube 16:9)', type: 'long' },
  { id: '10m', name: '10 Minutos (Documental)', type: 'long' },
];

export const VIDEO_STYLES = [
  {
    id: 'cinematic',
    name: 'Cinematográfico',
    description: 'Iluminación dramática 35mm, lente anamórfico',
    image: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=400&h=300&q=80',
  },
  {
    id: 'photorealistic',
    name: 'Fotorrealista 8K',
    description: 'Fotografía documental hiperrealista',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&h=300&q=80',
  },
  {
    id: 'anime',
    name: 'Estilo Anime',
    description: 'Ilustración japonesa vibrante tipo Makoto Shinkai',
    image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=400&h=300&q=80',
  },
  {
    id: 'scifi',
    name: 'Ciencia Ficción / Cyber',
    description: 'Neón futurista, hologramas y alta tecnología',
    image: 'https://images.unsplash.com/photo-1535223289827-42f1e9919769?auto=format&fit=crop&w=400&h=300&q=80',
  },
  {
    id: 'cartoon',
    name: 'Animación 3D Pixar',
    description: 'Personajes expresivos y renderizado suave 3D',
    image: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=400&h=300&q=80',
  },
  {
    id: 'comic',
    name: 'Cómic & Novela Gráfica',
    description: 'Tinta audaz, viñetas dinámicas y colores pop',
    image: 'https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?auto=format&fit=crop&w=400&h=300&q=80',
  },
  {
    id: 'biblia',
    name: 'Bíblico / Histórico',
    description: 'Pintura clásica épica con claroscuro antiguo',
    image: 'https://images.unsplash.com/photo-1548625361-16800b32f09c?auto=format&fit=crop&w=400&h=300&q=80',
    badge: 'POPULAR',
  },
  {
    id: 'fantasy',
    name: 'Fantasía Épica',
    description: 'Mundos mágicos, castillos y luz etérea',
    image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=400&h=300&q=80',
  },
  {
    id: 'horror',
    name: 'Misterio / Oscuro',
    description: 'Atmósfera densa, niebla y alto suspenso',
    image: 'https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&w=400&h=300&q=80',
  },
  {
    id: 'pixelart',
    name: 'Arte Pixelado Retro',
    description: 'Estética arcade 16-bits y estética retro-gaming',
    image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=400&h=300&q=80',
  },
  {
    id: 'lego',
    name: 'Mundo Bloques Lego',
    description: 'Escenas macro construidas con piezas plásticas',
    image: 'https://images.unsplash.com/photo-1585366119957-e9730b6d0f60?auto=format&fit=crop&w=400&h=300&q=80',
  },
  {
    id: 'minecraft',
    name: 'Voxel / Minecraft RTX',
    description: 'Mundos cúbicos con iluminación volumétrica',
    image: 'https://images.unsplash.com/photo-1607853202273-797f1c22a38e?auto=format&fit=crop&w=400&h=300&q=80',
  },
];

export interface VoiceOption {
  id: string;
  name: string;
  engine: 'edge' | 'piper';
  accent: string;
  gender: 'Femenina' | 'Masculina';
  tags: string[];
  sampleText: string;
}

export const VOICES: VoiceOption[] = [
  // Microsoft Edge Neural Voices (Español — $0 Alta Expresividad)
  {
    id: 'es-MX-DaliaNeural',
    name: 'Dalia (México • Edge)',
    engine: 'edge',
    accent: 'México',
    gender: 'Femenina',
    tags: ['Femenina', 'México', 'Viral & Clara'],
    sampleText: 'Hola, soy Dalia. Lista para narrar tus videos virales con máxima retención.',
  },
  {
    id: 'es-MX-JorgeNeural',
    name: 'Jorge (México • Edge)',
    engine: 'edge',
    accent: 'México',
    gender: 'Masculina',
    tags: ['Masculina', 'México', 'Dinámica'],
    sampleText: 'Qué tal, soy Jorge. Mi voz tiene el ritmo ideal para Shorts, TikTok y Reels.',
  },
  {
    id: 'es-ES-AlvaroNeural',
    name: 'Álvaro (España • Edge)',
    engine: 'edge',
    accent: 'España',
    gender: 'Masculina',
    tags: ['Masculina', 'España', 'Documental'],
    sampleText: 'Hola, soy Álvaro. Perfecto para historias épicas, tecnología y documentales.',
  },
  {
    id: 'es-ES-ElviraNeural',
    name: 'Elvira (España • Edge)',
    engine: 'edge',
    accent: 'España',
    gender: 'Femenina',
    tags: ['Femenina', 'España', 'Educativa'],
    sampleText: 'Hola, soy Elvira. Explico temas complejos con claridad, elegancia y autoridad.',
  },
  {
    id: 'es-ES-XimenaNeural',
    name: 'Ximena (España • Edge)',
    engine: 'edge',
    accent: 'España',
    gender: 'Femenina',
    tags: ['Femenina', 'España', 'Storytelling'],
    sampleText: 'Hola, soy Ximena. Ideal para relatos envolventes y curiosidades sorprendentes.',
  },
  {
    id: 'es-CO-SalomeNeural',
    name: 'Salomé (Colombia • Edge)',
    engine: 'edge',
    accent: 'Colombia',
    gender: 'Femenina',
    tags: ['Femenina', 'Colombia', 'Cercana'],
    sampleText: 'Hola, soy Salomé. Una voz fresca, natural y muy cercana para conectar con tu audiencia.',
  },
  {
    id: 'es-CO-GonzaloNeural',
    name: 'Gonzalo (Colombia • Edge)',
    engine: 'edge',
    accent: 'Colombia',
    gender: 'Masculina',
    tags: ['Masculina', 'Colombia', 'Noticias'],
    sampleText: 'Hola, soy Gonzalo. Ideal para noticias de impacto, negocios e inteligencia artificial.',
  },
  {
    id: 'es-AR-ElenaNeural',
    name: 'Elena (Argentina • Edge)',
    engine: 'edge',
    accent: 'Argentina',
    gender: 'Femenina',
    tags: ['Femenina', 'Argentina', 'Carismática'],
    sampleText: 'Hola, soy Elena. Con un tono expresivo y auténtico que destaca en cualquier feed.',
  },
  {
    id: 'es-AR-TomasNeural',
    name: 'Tomás (Argentina • Edge)',
    engine: 'edge',
    accent: 'Argentina',
    gender: 'Masculina',
    tags: ['Masculina', 'Argentina', 'Análisis'],
    sampleText: 'Hola, soy Tomás. Excelente para análisis profundos, casos reales y misterio.',
  },
  {
    id: 'es-US-AlonsoNeural',
    name: 'Alonso (Latino Neutro • Edge)',
    engine: 'edge',
    accent: 'Latino Neutro',
    gender: 'Masculina',
    tags: ['Masculina', 'Neutro TV', 'Autoridad'],
    sampleText: 'Hola, soy Alonso. Voz neutra estilo televisión internacional para todo el mundo hispano.',
  },
  {
    id: 'es-US-PalomaNeural',
    name: 'Paloma (Latino Neutro • Edge)',
    engine: 'edge',
    accent: 'Latino Neutro',
    gender: 'Femenina',
    tags: ['Femenina', 'Neutro TV', 'Moderna'],
    sampleText: 'Hola, soy Paloma. Acento neutro profesional para marcas, tutoriales y contenido viral.',
  },
  {
    id: 'es-CL-CatalinaNeural',
    name: 'Catalina (Chile • Edge)',
    engine: 'edge',
    accent: 'Chile',
    gender: 'Femenina',
    tags: ['Femenina', 'Chile', 'Ágil'],
    sampleText: 'Hola, soy Catalina. Rápida, clara y perfecta para resumir tendencias del día.',
  },
  {
    id: 'es-PE-AlexNeural',
    name: 'Alex (Perú • Edge)',
    engine: 'edge',
    accent: 'Perú',
    gender: 'Masculina',
    tags: ['Masculina', 'Perú', 'Tutoriales'],
    sampleText: 'Hola, soy Alex. Mi dicción limpia facilita seguir cualquier guía paso a paso.',
  },
  {
    id: 'es-VE-PaolaNeural',
    name: 'Paola (Venezuela • Edge)',
    engine: 'edge',
    accent: 'Venezuela',
    gender: 'Femenina',
    tags: ['Femenina', 'Venezuela', 'Energética'],
    sampleText: 'Hola, soy Paola. Llena de energía para que nadie deslice tu próximo video.',
  },

  // Piper ONNX Local Voices (100% Offline en PC)
  {
    id: 'Kore',
    name: 'Kore (Claude MX • Piper Offline)',
    engine: 'piper',
    accent: 'México Offline',
    gender: 'Femenina',
    tags: ['Femenina', '100% Local', 'ONNX HD'],
    sampleText: 'Hola, soy Kore, voz neural cien por ciento local ejecutándose en tu computadora.',
  },
  {
    id: 'Puck',
    name: 'Puck (Ald MX • Piper Offline)',
    engine: 'piper',
    accent: 'México Offline',
    gender: 'Masculina',
    tags: ['Masculina', '100% Local', 'Alto Ritmo'],
    sampleText: 'Hola, soy Puck, motor neural local rápido y sin conexión a internet.',
  },
  {
    id: 'Charon',
    name: 'Charon (Dave ES • Piper Offline)',
    engine: 'piper',
    accent: 'España Offline',
    gender: 'Masculina',
    tags: ['Masculina', '100% Local', 'Documental'],
    sampleText: 'Hola, soy Charon, voz local en español de España para narración documental.',
  },
  {
    id: 'Fenrir',
    name: 'Fenrir (Sharvard • Piper Offline)',
    engine: 'piper',
    accent: 'España Offline',
    gender: 'Masculina',
    tags: ['Masculina', '100% Local', 'Intensa'],
    sampleText: 'Hola, soy Fenrir, voz local intensa diseñada para relatos de misterio.',
  },
  {
    id: 'Zephyr',
    name: 'Zephyr (Daniela AR • Piper Offline)',
    engine: 'piper',
    accent: 'Argentina Offline',
    gender: 'Femenina',
    tags: ['Femenina', '100% Local', 'Cálida'],
    sampleText: 'Hola, soy Zephyr, voz neural local argentina de alta definición.',
  },
];

export const STUDIO_MUSIC_PRESETS = [
  { id: 'cyber-pulse', name: 'Cyber Pulse (Tech & Noticias)', tempo: 124, mood: 'Futurista y energético' },
  { id: 'cinematic-rise', name: 'Horizonte Épico (Documental)', tempo: 96, mood: 'Orquestal e intrigante' },
  { id: 'lofi-focus', name: 'Lo-Fi Ejecutivo (Finanzas & Negocios)', tempo: 88, mood: 'Elegante y enfocado' },
  { id: 'viral-phonk', name: 'High Retention Beat (Shorts / TikTok)', tempo: 132, mood: 'Impacto rápido' },
  { id: 'dark-mystery', name: 'Archivo Secreto (Misterio)', tempo: 76, mood: 'Suspenso atmosférico' },
];
