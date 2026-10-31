/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AspectRatioType = '9:16' | '16:9' | '1:1';

export type SocialPlatformId =
  | 'tiktok'
  | 'youtube_shorts'
  | 'instagram_reels'
  | 'linkedin'
  | 'facebook_reels'
  | 'youtube_long';

export type CameraMotionType = 'zoom_in' | 'zoom_out' | 'pan_right' | 'pan_left' | 'pulse';

export type SubtitleStyleType = 'hormozi' | 'neon' | 'minimal' | 'boxed';

export interface Scene {
  title: string;
  dialogue: string;
  imageUrl?: string;
  animatedUrl?: string;
  cameraMotion?: CameraMotionType;
  isGeneratingImage?: boolean;
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
  platformCopy?: Record<SocialPlatformId, PlatformSpecificCopy>;
}

export interface VideoState {
  step: number;
  videoType: string;
  genre: string;
  subgenre: string;
  duration: string;
  script: string;
  style: string;
  aspectRatio: AspectRatioType;
  language: string;
  voice: string;
  music: string;
  voiceAudioUrl?: string;
  musicAudioUrl?: string;
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
  detectedAt: number;
}

export interface ScheduledPost {
  id: string;
  projectId: string;
  projectTitle: string;
  channelId: string;
  platforms: SocialPlatformId[];
  scheduledAt: string; // ISO string or YYYY-MM-DDTHH:mm
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
}> = [
  {
    id: 'tiktok',
    name: 'TikTok',
    shortName: 'TikTok',
    recommendedRatio: '9:16',
    maxDurationLabel: '15s - 10m (9:16)',
    badgeColor: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
  },
  {
    id: 'youtube_shorts',
    name: 'YouTube Shorts',
    shortName: 'YT Shorts',
    recommendedRatio: '9:16',
    maxDurationLabel: 'Hasta 60s (9:16)',
    badgeColor: 'bg-red-500/15 text-red-400 border-red-500/30',
  },
  {
    id: 'instagram_reels',
    name: 'Instagram Reels',
    shortName: 'IG Reels',
    recommendedRatio: '9:16',
    maxDurationLabel: 'Hasta 90s (9:16)',
    badgeColor: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn Video',
    shortName: 'LinkedIn',
    recommendedRatio: '9:16',
    maxDurationLabel: 'Vertical 9:16 / 1:1 / 16:9',
    badgeColor: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  },
  {
    id: 'facebook_reels',
    name: 'Facebook Reels',
    shortName: 'FB Reels',
    recommendedRatio: '9:16',
    maxDurationLabel: 'Hasta 90s (9:16)',
    badgeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  },
  {
    id: 'youtube_long',
    name: 'YouTube Largo (16:9)',
    shortName: 'YouTube 16:9',
    recommendedRatio: '16:9',
    maxDurationLabel: '3m - 15m+ (16:9)',
    badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
];

export const DEFAULT_CHANNELS: SocialChannel[] = [
  {
    id: 'channel-tech-ai',
    name: 'Futuro & IA Hoy',
    handle: '@futuroiahoy',
    niche: 'Tecnología, Inteligencia Artificial y Startups',
    tone: 'Dinámico, revelador, con datos concretos y ganchos disruptivos',
    defaultAspectRatio: '9:16',
    platforms: ['tiktok', 'youtube_shorts', 'instagram_reels', 'linkedin'],
    webhookUrl: '',
    accentColor: '#7C3AED',
    subscribersCount: '128.4K',
  },
  {
    id: 'channel-finanzas',
    name: 'Capital Inteligente',
    handle: '@capitalinteligente',
    niche: 'Finanzas Personales, Economía Global y Negocios',
    tone: 'Autoridad accesible, analítico, directo al grano',
    defaultAspectRatio: '9:16',
    platforms: ['youtube_shorts', 'instagram_reels', 'linkedin', 'youtube_long'],
    webhookUrl: '',
    accentColor: '#10B981',
    subscribersCount: '84.2K',
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
    subscribersCount: '215.9K',
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
  { id: '30s', name: '30 Segundos (Reel/Short)', type: 'short' },
  { id: '60s', name: '60 Segundos (Viral Completo)', type: 'short' },
  { id: '3m', name: '3 Minutos (Análisis)', type: 'long' },
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

export const VOICES = [
  { id: 'Kore', name: 'Kore', tags: ['Femenina', 'Clara', 'Autoridad Viral'] },
  { id: 'Puck', name: 'Puck', tags: ['Masculina', 'Dinámica', 'Alto Ritmo'] },
  { id: 'Charon', name: 'Charon', tags: ['Masculina', 'Profunda', 'Documental'] },
  { id: 'Fenrir', name: 'Fenrir', tags: ['Masculina', 'Intensa', 'Storytelling'] },
  { id: 'Zephyr', name: 'Zephyr', tags: ['Femenina', 'Cálida', 'Educativa'] },
];

export const STUDIO_MUSIC_PRESETS = [
  { id: 'cyber-pulse', name: 'Cyber Pulse (Tech & Noticias)', tempo: 124, mood: 'Futurista y energético' },
  { id: 'cinematic-rise', name: 'Horizonte Épico (Documental)', tempo: 96, mood: 'Orquestal e intrigante' },
  { id: 'lofi-focus', name: 'Lo-Fi Ejecutivo (Finanzas & Negocios)', tempo: 88, mood: 'Elegante y enfocado' },
  { id: 'viral-phonk', name: 'High Retention Beat (Shorts / TikTok)', tempo: 132, mood: 'Impacto rápido' },
  { id: 'dark-mystery', name: 'Archivo Secreto (Misterio)', tempo: 76, mood: 'Suspenso atmosférico' },
];
