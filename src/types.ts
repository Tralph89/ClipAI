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

export type ComfyArchitectureType = 'flux1' | 'sdxl' | 'custom_json';

export interface ComfyUIConfig {
  enabled: boolean;
  autoFallbackToCloud: boolean;
  serverUrl: string;
  connectionMode: 'browser_direct' | 'server_proxy';
  architecture: ComfyArchitectureType;
  checkpointName: string;
  loraName: string;
  loraStrength: number;
  steps: number;
  cfg: number;
  fluxGuidance: number;
  samplerName: string;
  scheduler: string;
  seedLock: boolean;
  masterSeed: number;
  customWorkflowJson?: string;
}

export interface VisualBible {
  characterAnchor: string;
  environmentAnchor: string;
  colorPalette: string;
  lightingDirective: string;
  lastSyncedStyle?: string;
}

export interface StyleTechnicalProfile {
  id: string;
  name: string;
  description: string;
  image: string;
  badge?: string;
  fluxPrefix: string;
  sdxlTags: string;
  cameraAndLighting: string;
  negativePrompt: string;
  recommendedLoraHint: string;
}

export interface Scene {
  title: string;
  dialogue: string;
  hookText?: string;
  imagePrompt?: string;
  stockKeywords?: string[];
  visualMode?: VisualModeType;
  sourceType?: 'local_ai' | 'cloud_ai' | 'stock' | 'user_upload';
  imageUrl?: string;
  videoUrl?: string;
  animatedUrl?: string;
  cameraMotion?: CameraMotionType;
  durationSec?: number;
  startSec?: number;
  endSec?: number;
  audioClipUrl?: string;
  voiceAudioUrl?: string;
  audioTimings?: WordTiming[];
  wordTimings?: WordTiming[];
  isGeneratingImage?: boolean;
  isAnimating?: boolean;
  isGeneratingAudio?: boolean;
  isGeneratingVoice?: boolean;
  sfxPresetId?: string;
  visualSeed?: number;
  renderedWithEngine?: string;
  // ComfyUI & Visual Coherence metadata
  comfyPositivePrompt?: string;
  comfyNegativePrompt?: string;
  seed?: number;
  renderedBy?: 'comfyui_flux' | 'comfyui_sdxl' | 'comfyui_custom' | 'cloud_fallback';
  renderTimeMs?: number;
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
  voiceSpeed?: number;
  music: string;
  musicAudioUrl?: string;
  musicVolume?: number;
  duckingPreset?: 'subtle' | 'balanced' | 'aggressive' | 'none';
  ambientPresetId?: string;
  ambientAudioUrl?: string;
  ambientVolume?: number;
  voiceAudioUrl?: string;
  mixedAudioUrl?: string;
  renderedVideoUrl?: string;
  subtitleStyle?: SubtitleStyleType;
  metadata?: VideoMetadata;
  subtitles?: string;
  visualBible?: VisualBible;
  comfyConfig?: ComfyUIConfig;
}


export interface MusicLibraryItem {
  id: string;
  name: string;
  category: 'terror' | 'suspenso' | 'documental' | 'tech' | 'phonk' | 'custom';
  url: string;
  durationSec: number;
  mood?: string;
  author?: string;
}

export interface AmbientPreset {
  id: string;
  name: string;
  description: string;
  category: 'terror' | 'suspenso' | 'naturaleza';
  url: string;
}

export interface SfxPreset {
  id: string;
  name: string;
  description: string;
  category: 'impact' | 'suspense' | 'creepy';
  url: string;
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
  detailedContent?: string;
  contentType?: 'video_transcript' | 'news_dossier' | 'community_debate';
  evidencePoints?: string[];
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
  fullTranscript?: string;
  isSaved?: boolean;
}

export interface SavedTrendIdea extends TrendItem {
  channelId: string;
  savedAt: number;
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

export const DEFAULT_COMFY_CONFIG: ComfyUIConfig = {
  enabled: true,
  autoFallbackToCloud: true,
  serverUrl: 'http://127.0.0.1:8188',
  connectionMode: 'browser_direct',
  architecture: 'flux1',
  checkpointName: 'flux1-dev-fp8.safetensors',
  loraName: 'None',
  loraStrength: 0.85,
  steps: 20,
  cfg: 1.0,
  fluxGuidance: 3.5,
  samplerName: 'euler',
  scheduler: 'simple',
  seedLock: true,
  masterSeed: 84920411,
};

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
    id: 'channel-archivo-clasificado',
    name: 'Archivo Clasificado',
    handle: '@archivoclasificado01',
    niche: 'Historias de Terror, Casos Paranormales y Expedientes Sin Resolver',
    tone: 'Inquietante, sombrío, inmersivo, voz de expediente desclasificado',
    defaultAspectRatio: '9:16',
    platforms: ['youtube_shorts', 'tiktok', 'facebook_reels', 'youtube_long'],
    webhookUrl: '',
    accentColor: '#DC2626',
    subscribersCount: 'Canal Principal V1',
  },
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
  { id: 'horror', name: 'Misterio & Terror (Archivo Clasificado)' },
  { id: 'documentary', name: 'Documental & Investigaciones' },
  { id: 'fiction', name: 'Ficción & Storytelling' },
  { id: 'educational', name: 'Educativo & Tech' },
  { id: 'marketing', name: 'Negocios & Marketing' },
  { id: 'motivational', name: 'Motivacional & Hábitos' },
  { id: 'comedy', name: 'Entretenimiento & Humor' },
];

export const SUBGENRES: Record<string, string[]> = {
  horror: [
    'Leyendas Urbanas & Encuentros Reales',
    'Expedientes Desclasificados & Sin Resolver',
    'Llamadas al 911 / Grabaciones Inquietantes',
    'Lugares Malditos & Exploración Paranormal',
    'Relatos de la Noche & Testimonios',
    'Creepypastas & Folclore Oscuro',
    'Misterios Inexplicables & Dross Style',
  ],
  documentary: ['Investigación Viral', 'Expediente Histórico', 'Misterios de Archivo', 'Caso Criminal'],
  fiction: ['Terror Psicológico', 'Sci-Fi Oscuro', 'Suspenso', 'Fantasía Oscura'],
  educational: ['Curiosidades Oscuras', 'Ciencia del Terror', 'Psicología del Miedo'],
  marketing: ['Estrategia Viral', 'Storytelling de Impacto'],
  motivational: ['Superación', 'Resiliencia'],
  comedy: ['Comedia Negra', 'Parodia'],
};

export const DURATIONS = [
  { id: '60s', name: '60s — Short / TikTok / Reel (9:16)', type: 'short' },
  { id: '90s', name: '90s — Short Extendido (9:16)', type: 'short' },
  { id: '3m', name: '3 Minutos — Documental YouTube (16:9)', type: 'long' },
  { id: '5m', name: '5 Minutos — Expediente Largo (16:9)', type: 'long' },
  { id: '8m', name: '8 Minutos — Historia Completa (16:9)', type: 'long' },
];

export const VIDEO_STYLES: StyleTechnicalProfile[] = [
  {
    id: 'cinematic',
    name: 'Cinematográfico',
    description: 'Iluminación dramática 35mm, lente anamórfico',
    image: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=400&h=300&q=80',
    fluxPrefix: 'Cinematic movie still shot on ARRI Alexa 65 with anamorphic Panavision lens, dramatic teal and amber color grading,',
    sdxlTags: '(masterpiece, cinematic film still:1.3), anamorphic lens flare, shallow depth of field, volumetric lighting, 35mm film grain,',
    cameraAndLighting: 'dramatic rim lighting, moody atmospheric shadows, high dynamic range, 8k cinema grade',
    negativePrompt: 'anime, cartoon, 2d illustration, sketch, lowres, flat lighting, overexposed, watermark, text, deformed hands',
    recommendedLoraHint: 'Cinematic_Film_Grain_XL.safetensors',
  },
  {
    id: 'photorealistic',
    name: 'Fotorrealista 8K',
    description: 'Fotografía documental hiperrealista',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&h=300&q=80',
    fluxPrefix: 'Ultra-detailed editorial photograph captured on Sony A7R V 85mm f/1.4 GM lens, natural skin pores and lifelike surface textures,',
    sdxlTags: '(RAW photo, photorealistic, hyperrealistic:1.35), Sony A7R V, 85mm f/1.4, natural lighting, subsurface scattering, ultra sharp focus,',
    cameraAndLighting: 'physically accurate global illumination, crisp micro-contrast, National Geographic documentary realism',
    negativePrompt: 'cgi, 3d render, painting, anime, illustration, plastic skin, airbrushed, doll, blurry, watermark, text',
    recommendedLoraHint: 'Realism_Engine_SDXL.safetensors',
  },
  {
    id: 'anime',
    name: 'Estilo Anime',
    description: 'Ilustración japonesa vibrante tipo Makoto Shinkai',
    image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=400&h=300&q=80',
    fluxPrefix: '2D Japanese anime feature film key visual in the style of Makoto Shinkai and Ufotable, crisp cel-shaded linework, vibrant sky and luminous reflections,',
    sdxlTags: '(anime artwork, makoto shinkai style, ufotable:1.35), 2d cel shading, vibrant anime colors, expressive anime eyes, dramatic anime sky,',
    cameraAndLighting: 'blooming light rays, sakura and atmospheric particles, hand-drawn anime background art',
    negativePrompt: 'photorealistic, real life photo, 3d render, western comic, live action, uncanny valley, bad anatomy, watermark',
    recommendedLoraHint: 'Anime_Shinkai_Style_XL.safetensors',
  },
  {
    id: 'scifi',
    name: 'Ciencia Ficción / Cyber',
    description: 'Neón futurista, hologramas y alta tecnología',
    image: 'https://images.unsplash.com/photo-1535223289827-42f1e9919769?auto=format&fit=crop&w=400&h=300&q=80',
    fluxPrefix: 'Futuristic cyberpunk sci-fi concept art, Blade Runner 2049 aesthetic, glowing cyan and magenta neon holograms, rain-slicked carbon fiber surfaces,',
    sdxlTags: '(cyberpunk, futuristic sci-fi:1.3), neon holographic interfaces, bioluminescent circuitry, dystopian megacity, volumetric neon fog,',
    cameraAndLighting: 'wide-angle cybernetic perspective, high-contrast neon reflections, Octane Render 8k',
    negativePrompt: 'medieval, historical, rustic, vintage, low contrast, blurry, watermark, text',
    recommendedLoraHint: 'Cyberpunk_Neon_SciFi_XL.safetensors',
  },
  {
    id: 'cartoon',
    name: 'Animación 3D Pixar',
    description: 'Personajes expresivos y renderizado suave 3D',
    image: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=400&h=300&q=80',
    fluxPrefix: '3D Pixar and Disney feature animation style render, expressive stylized character proportions, soft subsurface scattering, warm whimsical lighting,',
    sdxlTags: '(pixar 3d animation style, disney 3d render:1.35), cute expressive stylized proportions, smooth Arnold render, soft global illumination,',
    cameraAndLighting: 'vibrant saturated color script, warm rim light, tactile fabric and hair shaders',
    negativePrompt: '2d flat, photorealistic real human, horror, gritty, dark noisy, creepy, low poly, watermark',
    recommendedLoraHint: 'Pixar_3D_Animation_XL.safetensors',
  },
  {
    id: 'comic',
    name: 'Cómic & Novela Gráfica',
    description: 'Tinta audaz, viñetas dinámicas y colores pop',
    image: 'https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?auto=format&fit=crop&w=400&h=300&q=80',
    fluxPrefix: 'Graphic novel comic book illustration in Spider-Verse and Jim Lee style, bold black ink crosshatching, Ben-Day halftone dots, vibrant pop art palette,',
    sdxlTags: '(american comic book art, graphic novel illustration:1.35), heavy black ink outlines, halftone dot shading, dynamic foreshortening,',
    cameraAndLighting: 'dramatic comic panel angle, high-impact chromatic contrast, hand-inked texture',
    negativePrompt: 'photorealistic photograph, blurry, soft uninked edges, 3d clay, washed out colors, watermark',
    recommendedLoraHint: 'Comic_Book_Ink_XL.safetensors',
  },
  {
    id: 'biblia',
    name: 'Bíblico / Histórico',
    description: 'Pintura clásica épica con claroscuro antiguo',
    image: 'https://images.unsplash.com/photo-1548625361-16800b32f09c?auto=format&fit=crop&w=400&h=300&q=80',
    badge: 'POPULAR',
    fluxPrefix: 'Epic classical biblical historical painting in the style of Caravaggio and Gustave Doré, dramatic chiaroscuro candlelight and divine sunbeams, authentic ancient robes and stone architecture,',
    sdxlTags: '(classical oil painting, biblical historical epic, caravaggio chiaroscuro:1.35), ancient Jerusalem and desert robes, golden divine rays, oil on canvas texture,',
    cameraAndLighting: 'renaissance master composition, rich warm umber and gold palette, museum masterpiece quality',
    negativePrompt: 'modern clothing, modern technology, neon, anime, cartoon, sci-fi, plastic, wristwatch, glasses, watermark',
    recommendedLoraHint: 'Classical_Oil_Chiaroscuro_XL.safetensors',
  },
  {
    id: 'fantasy',
    name: 'Fantasía Épica',
    description: 'Mundos mágicos, castillos y luz etérea',
    image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=400&h=300&q=80',
    fluxPrefix: 'High fantasy digital painting in Weta Workshop and Magic the Gathering art style, ethereal arcane glow, intricate elven and medieval craftsmanship,',
    sdxlTags: '(epic high fantasy art, greg rutkowski style, d&d concept art:1.3), magical runes, mystical fog, majestic fantasy citadel, god rays,',
    cameraAndLighting: 'sweeping cinematic vista, luminous magical particles, rich jewel-toned palette',
    negativePrompt: 'modern cars, skyscrapers, streetwear, mundane office, flat lighting, lowres, watermark',
    recommendedLoraHint: 'Dark_Fantasy_Epic_XL.safetensors',
  },
  {
    id: 'horror',
    name: 'Misterio / Oscuro',
    description: 'Atmósfera densa, niebla y alto suspenso',
    image: 'https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&w=400&h=300&q=80',
    fluxPrefix: 'A24 psychological horror cinematography, eerie volumetric mist, oppressive shadows, cold desaturated moonlight, unsettling liminal atmosphere,',
    sdxlTags: '(dark eerie horror atmosphere, psychological thriller cinematography:1.35), heavy fog, silhouette in shadows, cold cyan and charcoal grading,',
    cameraAndLighting: 'low-key suspense lighting, claustrophobic framing, 35mm grainy night stock',
    negativePrompt: 'bright sunny, cheerful, vibrant rainbow, cute cartoon, smiling comedy, saturated pink, watermark',
    recommendedLoraHint: 'Gothic_Horror_Atmosphere_XL.safetensors',
  },
  {
    id: 'pixelart',
    name: 'Arte Pixelado Retro',
    description: 'Estética arcade 16-bits y estética retro-gaming',
    image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=400&h=300&q=80',
    fluxPrefix: 'Authentic 16-bit SNES and Neo-Geo pixel art scene, crisp pixel grid alignment, hand-crafted dithering and limited retro color palette,',
    sdxlTags: '(pixel art, 16-bit retro game sprite art:1.4), crisp pixel grid, dithering shading, isometric or side-scroller arcade aesthetic,',
    cameraAndLighting: 'vibrant CRT phosphor glow, sharp nearest-neighbor pixel edges, zero anti-aliasing blur',
    negativePrompt: 'photorealistic, smooth gradients, 3d render, blurry edges, vector art, oil painting, watermark',
    recommendedLoraHint: 'Pixel_Art_16Bit_XL.safetensors',
  },
  {
    id: 'lego',
    name: 'Mundo Bloques Lego',
    description: 'Escenas macro construidas con piezas plásticas',
    image: 'https://images.unsplash.com/photo-1585366119957-e9730b6d0f60?auto=format&fit=crop&w=400&h=300&q=80',
    fluxPrefix: 'Macro tilt-shift photograph of a miniature diorama built 100% from glossy ABS plastic LEGO bricks and official LEGO minifigures with claw hands and cylindrical yellow heads,',
    sdxlTags: '(LEGO brick world, LEGO minifigure style, The LEGO Movie:1.4), shiny ABS plastic studs, macro tilt-shift depth of field, studio toy lighting,',
    cameraAndLighting: 'realistic plastic reflections, miniature macro lens f/2.8, playful stop-motion aesthetic',
    negativePrompt: 'real human skin, organic trees, non-lego objects, 2d drawing, blurry, watermark',
    recommendedLoraHint: 'Lego_Minifigure_Brick_XL.safetensors',
  },
  {
    id: 'minecraft',
    name: 'Voxel / Minecraft RTX',
    description: 'Mundos cúbicos con iluminación volumétrica',
    image: 'https://images.unsplash.com/photo-1607853202273-797f1c22a38e?auto=format&fit=crop&w=400&h=300&q=80',
    fluxPrefix: 'Minecraft voxel world rendered with Complementary RTX Raytracing Shaders, everything constructed from 1x1 meter pixelated cubic blocks and blocky voxel characters,',
    sdxlTags: '(minecraft voxel style, blocky cubic world, minecraft RTX shaders:1.4), voxel terrain, pixelated block textures, volumetric blocky sunbeams,',
    cameraAndLighting: 'raytraced water reflections, warm torchlight and atmospheric voxel clouds',
    negativePrompt: 'smooth curves, spheres, realistic human anatomy, high-poly organic mesh, watermark',
    recommendedLoraHint: 'Minecraft_Voxel_RTX_XL.safetensors',
  },
];

export const VOICES: VoiceOption[] = [
  {
    id: 'xtts-hugo-m',
    name: 'Hugo M (Ultra Grave & Misterio)',
    engine: 'xtts',
    accent: 'Hispanoamérica',
    gender: 'Masculina',
    tags: ['Voz Clonada', 'Ultra Grave', 'Archivo Clasificado', 'Terror'],
    sampleText: 'Eran las tres y cuarto de la madrugada... cuando aquel sonido bajo la cama comenzó a respirar. Si estás solo escuchando esto... no te des la vuelta.',
    previewUrl: '/samples/xtts_hugo_misterio_lento.wav',
  },
  {
    id: 'xtts-benji',
    name: 'Benji (Storyteller Cálido & Grave)',
    engine: 'xtts',
    accent: 'Hispanoamérica',
    gender: 'Masculina',
    tags: ['Voz Clonada', 'Documental', 'Misterio', 'Crónicas'],
    sampleText: 'En los archivos clasificados de la policía hay un reporte que fue borrado en mil novecientos noventa y cuatro. Hoy revelaremos lo que ocultaron.',
    previewUrl: '/samples/xtts_benji_storyteller_lento.wav',
  },
  {
    id: 'xtts-relatos',
    name: 'Relatos de la Noche (Narrador Original)',
    engine: 'xtts',
    accent: 'México',
    gender: 'Masculina',
    tags: ['Voz Clonada', 'Relatos de la Noche', 'Atmosférica', 'Terror Real'],
    sampleText: 'Me gusta saber que esta historia la va a escuchar la comunidad relatos de la noche.',
    previewUrl: '/samples/xtts_relatos_de_la_noche_lento.wav',
  },
  {
    id: 'xtts-sky',
    name: 'Sky (Misterio Femenino)',
    engine: 'xtts',
    accent: 'Hispanoamérica',
    gender: 'Femenina',
    tags: ['Voz Clonada', 'Femenina', 'Suspenso Psicológico', 'Creepypastas'],
    sampleText: 'Dicen que si miras fijamente a la niebla por más de diez segundos... la figura que ves a lo lejos comenzará a caminar hacia ti.',
    previewUrl: '/samples/xtts_sky_femenina_toma1_lento.wav',
  },
  {
    id: 'es-MX-DaliaNeural',
    name: 'Dalia (México)',
    engine: 'edge',
    accent: 'México',
    gender: 'Femenina',
    tags: ['Femenina', 'México', 'Viral & Cercana', 'TikTok/Shorts #1'],
    sampleText: 'Hola, soy Dalia. Mi voz es natural y cercana, perfecta para conectar con tu audiencia en TikTok y Shorts.',
  },
  {
    id: 'es-MX-JorgeNeural',
    name: 'Jorge (México)',
    engine: 'edge',
    accent: 'México',
    gender: 'Masculina',
    tags: ['Masculina', 'México', 'Dinámica & Tech', 'Alto Ritmo'],
    sampleText: 'Qué tal, soy Jorge. Tengo el ritmo y la energía ideales para videos dinámicos sobre tecnología, finanzas y noticias virales.',
  },
  {
    id: 'es-CO-SalomeNeural',
    name: 'Salomé (Colombia)',
    engine: 'edge',
    accent: 'Colombia',
    gender: 'Femenina',
    tags: ['Femenina', 'Colombia', 'Cálida & Storytelling', 'Empática'],
    sampleText: 'Hola, soy Salomé. Con un tono cálido y empático, doy vida a historias de superación personal, bienestar y curiosidades.',
  },
  {
    id: 'es-CO-GonzaloNeural',
    name: 'Gonzalo (Colombia)',
    engine: 'edge',
    accent: 'Colombia',
    gender: 'Masculina',
    tags: ['Masculina', 'Colombia', 'Neutral & Educativa', 'Finanzas'],
    sampleText: 'Hola a todos, soy Gonzalo. Mi acento neutro y pausado es perfecto para tutoriales, negocios y explicaciones paso a paso.',
  },
  {
    id: 'es-ES-AlvaroNeural',
    name: 'Álvaro (España)',
    engine: 'edge',
    accent: 'España',
    gender: 'Masculina',
    tags: ['Masculina', 'España', 'Documental & Misterio', 'Voz Grave'],
    sampleText: 'Saludos, soy Álvaro. Aporto una narración profunda y envolvente para documentales históricos, misterios y relatos épicos.',
  },
  {
    id: 'es-ES-ElviraNeural',
    name: 'Elvira (España)',
    engine: 'edge',
    accent: 'España',
    gender: 'Femenina',
    tags: ['Femenina', 'España', 'Elegante & Corporativa', 'Premium'],
    sampleText: 'Hola, soy Elvira. Una locución elegante, clara y profesional diseñada para contenidos educativos y comerciales premium.',
  },
  {
    id: 'es-AR-TomasNeural',
    name: 'Tomás (Argentina)',
    engine: 'edge',
    accent: 'Argentina',
    gender: 'Masculina',
    tags: ['Masculina', 'Argentina', 'Apasionada & Deportes', 'Cercana'],
    sampleText: 'Qué hacés, soy Tomás. Un tono fresco, apasionado y directo, genial para deportes, opinión y entretenimiento viral.',
  },
  {
    id: 'es-AR-ElenaNeural',
    name: 'Elena (Argentina)',
    engine: 'edge',
    accent: 'Argentina',
    gender: 'Femenina',
    tags: ['Femenina', 'Argentina', 'Moderna & Vlogs', 'Espontánea'],
    sampleText: 'Hola, soy Elena. Voz moderna y espontánea, pensada para vlogs de tendencias y contenido de estilo de vida.',
  },
  {
    id: 'es-US-AlonsoNeural',
    name: 'Alonso (Hispano Neutro)',
    engine: 'edge',
    accent: 'Hispanoamérica',
    gender: 'Masculina',
    tags: ['Masculina', 'Neutro', 'Locutor Internacional', 'Comercial'],
    sampleText: 'Hola, soy Alonso. Voz con impacto comercial y dicción impecable para ganchos virales de alta retención.',
  },
  {
    id: 'es-US-PalomaNeural',
    name: 'Paloma (Hispano Neutro)',
    engine: 'edge',
    accent: 'Hispanoamérica',
    gender: 'Femenina',
    tags: ['Femenina', 'Neutro', 'Enérgica & Hooks', 'Alta Conversión'],
    sampleText: 'Hola, soy Paloma. Entusiasta y brillante, ideal para captar la atención en los primeros tres segundos de tu video.',
  },
];

export const STUDIO_MUSIC_PRESETS = [
  { id: 'cyber-pulse', name: 'Cyber Pulse (Tech & Noticias)', tempo: 124, mood: 'Futurista y energético' },
  { id: 'cinematic-rise', name: 'Horizonte Épico (Documental)', tempo: 96, mood: 'Orquestal e intrigante' },
  { id: 'lofi-focus', name: 'Lo-Fi Ejecutivo (Finanzas & Negocios)', tempo: 88, mood: 'Elegante y enfocado' },
  { id: 'viral-phonk', name: 'High Retention Beat (Shorts / TikTok)', tempo: 132, mood: 'Impacto rápido' },
  { id: 'dark-mystery', name: 'Archivo Secreto (Misterio)', tempo: 76, mood: 'Suspenso atmosférico' },
];

// ==================== Local Platform & Engine Infrastructure ====================
export type AIProviderId = 'ollama' | 'gemini' | 'groq';
export type PublishAutoMode = 'review_first' | 'auto_publish';
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

export interface TrendScanTelemetry {
  providerUsed: string;
  modelUsed: string;
  latencyMs: number;
  rawSignalsCount: number;
  breakdown: Record<string, number>;
}

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

export interface VoiceOption {
  id: string;
  name: string;
  engine: 'edge' | 'piper' | 'xtts';
  previewUrl?: string;
  accent: string;
  gender: 'Femenina' | 'Masculina';
  tags: string[];
  sampleText: string;
}
