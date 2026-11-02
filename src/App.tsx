/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Flame,
  Sparkles,
  Film,
  Calendar,
  Radio,
  Play,
  Pause,
  Volume2,
  Mic,
  Music,
  Wand2,
  Image as ImageIcon,
  Subtitles,
  Download,
  Share2,
  Check,
  Copy,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  FolderOpen,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Send,
  Clock,
} from 'lucide-react';
import {
  AspectRatioType,
  CameraMotionType,
  ComfyUIConfig,
  DEFAULT_CHANNELS,
  DEFAULT_COMFY_CONFIG,
  DURATIONS,
  GENRES,
  Project,
  Scene,
  ScheduledPost,
  SOCIAL_PLATFORMS,
  SocialChannel,
  SocialPlatformId,
  STUDIO_MUSIC_PRESETS,
  SUBGENRES,
  SubtitleStyleType,
  TrendItem,
  VIDEO_STYLES,
  VideoState,
  VisualBible,
  VOICES,
} from './types';
import {
  animateSceneWithAI,
  craftVisualBibleAndPrompts,
  dispatchChannelWebhook,
  generateMarketingData,
  generateMusicWithLyria,
  generateSceneImage,
  generateScript,
  generateSpeech,
  generateSubtitles,
} from './services/geminiService';
import {
  buildStyleCoherentScenePrompt,
  generateImageWithComfyUI,
} from './services/comfyService';
import {
  drawSceneFrameOnCanvas,
  renderRealVideoInBrowser,
  synthesizeStudioMusicTrack,
} from './services/videoRenderer';
import { TrendRadarView } from './components/TrendRadarView';
import { ChannelsManagerView } from './components/ChannelsManagerView';
import { CalendarHubView } from './components/CalendarHubView';
import { VisualsStudioStep } from './components/VisualsStudioStep';
import { VoiceStudioStep } from './components/VoiceStudioStep';
import { MusicAndSfxStep } from './components/MusicAndSfxStep';
import { renderMasterVideoOnServer } from './services/apiService';

type WorkspaceTab = 'trends' | 'studio' | 'calendar' | 'channels';

const INITIAL_CURATED_TRENDS: TrendItem[] = [
  {
    id: 'trend-init-1',
    title: 'Agentes de IA Autónomos que Operan Navegadores y Flujos de Trabajo',
    summary:
      'Las búsquedas sobre agentes capaces de ejecutar tareas completas de software y automatización empresarial crecen más de un 320% esta semana.',
    viralScore: 96,
    category: 'Inteligencia Artificial & Tech',
    whyTrending: 'Lanzamiento de nuevos modelos multimodales y adopción masiva en equipos remotos.',
    suggestedHook:
      'El trabajo de oficina acaba de cambiar para siempre: mira lo que este agente IA hace en 15 segundos...',
    angle: 'Demostración rápida de antes vs. después con impacto en empleos y productividad.',
    recommendedFormats: ['9:16', '16:9'],
    recommendedPlatforms: ['tiktok', 'youtube_shorts', 'linkedin', 'youtube_long'],
    keywords: ['Agentes IA', 'Automatización', 'Productividad', 'FuturoDelTrabajo'],
    sources: [
      { title: 'Google AI Blog', uri: 'https://blog.google/technology/ai/' },
      { title: 'TechCrunch AI', uri: 'https://techcrunch.com/category/artificial-intelligence/' },
    ],
    detectedAt: Date.now(),
  },
  {
    id: 'trend-init-2',
    title: 'La Regla Financiera del 50/30/20 Reemplazada por el Método de Flujo Automatizado',
    summary:
      'Creadores financieros en TikTok, Reels y LinkedIn debaten por qué los presupuestos tradicionales fallan frente a la inflación de servicios digitales.',
    viralScore: 91,
    category: 'Finanzas & Negocios',
    whyTrending: 'Viralización de plantillas de ahorro automático entre profesionales jóvenes.',
    suggestedHook:
      'Si sigues ahorrando con la regla del 50/30/20, estás perdiendo dinero cada mes sin darte cuenta.',
    angle: 'Explicación visual en 3 pasos claros con ejemplo numérico real.',
    recommendedFormats: ['9:16', '1:1'],
    recommendedPlatforms: ['tiktok', 'instagram_reels', 'linkedin', 'youtube_shorts'],
    keywords: ['FinanzasPersonales', 'AhorroInteligente', 'Inversiones', 'Hábitos'],
    sources: [{ title: 'Bloomberg Línea', uri: 'https://www.bloomberglinea.com/' }],
    detectedAt: Date.now(),
  },
  {
    id: 'trend-init-3',
    title: 'Descubrimiento Astronómico con el Telescopio James Webb Desconcierta a Científicos',
    summary:
      'Nuevas observaciones de galaxias tempranas muestran estructuras mucho más masivas de lo previsto por los modelos cosmológicos actuales.',
    viralScore: 89,
    category: 'Ciencia & Documental',
    whyTrending: 'Publicación científica reciente compartida masivamente en comunidades de ciencia.',
    suggestedHook:
      'El telescopio James Webb acaba de captar algo en el espacio profundo que no debería existir...',
    angle: 'Narrativa cinematográfica de misterio científico con visuales espaciales épicos.',
    recommendedFormats: ['16:9', '9:16'],
    recommendedPlatforms: ['youtube_long', 'youtube_shorts', 'tiktok', 'facebook_reels'],
    keywords: ['JamesWebb', 'Espacio', 'CienciaViral', 'Astronomía'],
    sources: [{ title: 'NASA Webb Mission', uri: 'https://science.nasa.gov/mission/webb/' }],
    detectedAt: Date.now(),
  },
];

const STUDIO_STEPS = [
  { num: 1, label: '1. Guion Viral', icon: Sparkles },
  { num: 2, label: '2. Locución por Escenas', icon: Mic },
  { num: 3, label: '3. Música & SFX', icon: Music },
  { num: 4, label: '4. Visuales (ComfyUI)', icon: ImageIcon },
  { num: 5, label: '5. Animación', icon: Film },
  { num: 6, label: '6. Subtítulos', icon: Subtitles },
  { num: 7, label: '7. Render & Exportar', icon: Download },
  { num: 8, label: '8. Publicar Multi-Red', icon: Share2 },
];

function parseScriptIntoScenes(
  scriptText: string,
  styleId: string = 'cinematic',
  comfyConfig: ComfyUIConfig = DEFAULT_COMFY_CONFIG,
  visualBible?: VisualBible
): Scene[] {
  const regex = /\[Escena\s*\d+:\s*([^\]]+)\]\s*([\s\S]*?)(?=\[Escena\s*\d+:|$)/gi;
  const parsed: Scene[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(scriptText)) !== null) {
    const visualTitle = match[1].trim();
    const spokenDialogue = match[2]
      .replace(/^(Narrador|Locutor|Voz en off|Host):\s*/gim, '')
      .trim();
    const builtPrompt = buildStyleCoherentScenePrompt(
      visualTitle,
      spokenDialogue,
      styleId,
      comfyConfig.architecture,
      visualBible
    );
    parsed.push({
      title: visualTitle,
      dialogue: spokenDialogue,
      cameraMotion: 'zoom_in',
      comfyPositivePrompt: builtPrompt.positive,
      comfyNegativePrompt: builtPrompt.negative,
      seed: comfyConfig.seedLock
        ? comfyConfig.masterSeed
        : Math.floor(10000000 + Math.random() * 90000000),
    });
  }

  if (parsed.length === 0 && scriptText.trim()) {
    const paragraphs = scriptText
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
    paragraphs.slice(0, 6).forEach((p, idx) => {
      const title = `Escena ${idx + 1}: Visual cinematográfico sobre ${p.slice(0, 60)}`;
      const dialogue = p.replace(/\[.*?\]/g, '').trim();
      const builtPrompt = buildStyleCoherentScenePrompt(
        title,
        dialogue,
        styleId,
        comfyConfig.architecture,
        visualBible
      );
      parsed.push({
        title,
        dialogue,
        cameraMotion: idx % 2 === 0 ? 'zoom_in' : 'pan_right',
        comfyPositivePrompt: builtPrompt.positive,
        comfyNegativePrompt: builtPrompt.negative,
        seed: comfyConfig.seedLock
          ? comfyConfig.masterSeed
          : Math.floor(10000000 + Math.random() * 90000000),
      });
    });
  }

  return parsed;
}

export default function App() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceTab>('trends');

  // Channels state
  const [channels, setChannels] = useState<SocialChannel[]>(() => {
    try {
      const saved = localStorage.getItem('clipai_channels_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (!parsed.some((c: SocialChannel) => c.id === 'channel-archivo-clasificado')) {
            return [DEFAULT_CHANNELS[0], ...parsed];
          }
          return parsed;
        }
      }
      return DEFAULT_CHANNELS;
    } catch {
      return DEFAULT_CHANNELS;
    }
  });
  const [activeChannelId, setActiveChannelId] = useState<string>(
    () => channels[0]?.id || 'channel-archivo-clasificado'
  );
  const activeChannel = channels.find((c) => c.id === activeChannelId) || channels[0];

  // Trends state
  const [trends, setTrends] = useState<TrendItem[]>(INITIAL_CURATED_TRENDS);

  // Scheduled posts state
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>(() => {
    try {
      const saved = localStorage.getItem('clipai_scheduled_posts_v2');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Projects state
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem('clipai_projects_v2');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [showProjectsDrawer, setShowProjectsDrawer] = useState(false);

  // ComfyUI Configuration persisted in localStorage
  const [comfyConfig, setComfyConfig] = useState<ComfyUIConfig>(() => {
    try {
      const saved = localStorage.getItem('clipai_comfy_config_v1');
      return saved ? { ...DEFAULT_COMFY_CONFIG, ...JSON.parse(saved) } : DEFAULT_COMFY_CONFIG;
    } catch {
      return DEFAULT_COMFY_CONFIG;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('clipai_comfy_config_v1', JSON.stringify(comfyConfig));
    } catch {}
  }, [comfyConfig]);

  // Active Studio State
  const [prompt, setPrompt] = useState<string>(
    'El perturbador caso de la cabaña abandonada en el bosque negro y las cintas que la policía ocultó'
  );
  const [sourceTrendTitle, setSourceTrendTitle] = useState<string | undefined>(undefined);
  const [state, setState] = useState<VideoState>({
    step: 1,
    videoType: 'short',
    genre: 'horror',
    subgenre: 'Expedientes Desclasificados & Sin Resolver',
    duration: '60s',
    script: '',
    style: 'horror',
    aspectRatio: '9:16',
    language: 'es',
    voice: 'xtts-hugo-m',
    music: 'dark-mystery',
    subtitleStyle: 'hormozi',
    comfyConfig: DEFAULT_COMFY_CONFIG,
  });
  const [scenes, setScenes] = useState<Scene[]>([]);

  // Studio UI status states
  const [statusMessage, setStatusMessage] = useState<{
    type: 'info' | 'success' | 'error';
    text: string;
  } | null>(null);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [isGeneratingMusic, setIsGeneratingMusic] = useState(false);
  const [isCraftingPrompts, setIsCraftingPrompts] = useState(false);
  const [isGeneratingAllImages, setIsGeneratingAllImages] = useState(false);
  const [isGeneratingSubtitles, setIsGeneratingSubtitles] = useState(false);
  const [isRenderingVideo, setIsRenderingVideo] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [isGeneratingMarketing, setIsGeneratingMarketing] = useState(false);
  const [selectedMarketingPlatform, setSelectedMarketingPlatform] =
    useState<SocialPlatformId>('tiktok');
  const [scheduleDateTime, setScheduleDateTime] = useState<string>(() => {
    const tomorrow = new Date(Date.now() + 86400000);
    return tomorrow.toISOString().slice(0, 16);
  });
  const [selectedPublishPlatforms, setSelectedPublishPlatforms] = useState<SocialPlatformId[]>(
    activeChannel.platforms
  );
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Live Canvas Monitor Player in Step 6
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewSceneIndex, setPreviewSceneIndex] = useState(0);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);

  // Persist channels, scheduled posts, and projects
  useEffect(() => {
    try {
      localStorage.setItem('clipai_channels_v2', JSON.stringify(channels));
    } catch {}
  }, [channels]);

  useEffect(() => {
    try {
      localStorage.setItem('clipai_scheduled_posts_v2', JSON.stringify(scheduledPosts));
    } catch {}
  }, [scheduledPosts]);

  useEffect(() => {
    try {
      localStorage.setItem('clipai_projects_v2', JSON.stringify(projects));
    } catch {}
  }, [projects]);

  const saveCurrentProjectSnapshot = (
    nextState: VideoState = state,
    nextScenes: Scene[] = scenes,
    nextPrompt: string = prompt
  ) => {
    const id = currentProjectId || `proj-${Date.now()}`;
    if (!currentProjectId) setCurrentProjectId(id);

    const projectObj: Project = {
      id,
      name:
        nextState.metadata?.title ||
        sourceTrendTitle ||
        nextPrompt.slice(0, 48) ||
        'Proyecto Sin Título',
      channelId: activeChannel.id,
      sourceTrendTitle,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      state: { ...nextState, comfyConfig },
      scenes: nextScenes,
      prompt: nextPrompt,
    };

    setProjects((prev) => {
      const exists = prev.some((p) => p.id === id);
      if (exists) {
        return prev.map((p) => (p.id === id ? projectObj : p));
      }
      return [projectObj, ...prev];
    });
    return id;
  };

  // Draw live preview frame on Step 6 Canvas
  useEffect(() => {
    if (state.step !== 6 || !previewCanvasRef.current) return;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentScene = scenes[previewSceneIndex] || {
      title: 'Escena de Muestra',
      dialogue: prompt,
      cameraMotion: 'zoom_in',
    };

    let animFrameId: number;
    let imgEl: HTMLImageElement | null = null;

    if (currentScene.imageUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = currentScene.imageUrl;
      img.onload = () => {
        imgEl = img;
      };
    }

    const start = performance.now();
    const loop = () => {
      const elapsed = (performance.now() - start) % 4500;
      const progress = elapsed / 4500;
      drawSceneFrameOnCanvas(
        ctx,
        canvas.width,
        canvas.height,
        currentScene,
        imgEl,
        progress,
        state.subtitleStyle || 'hormozi',
        activeChannel.handle
      );
      if (isPlayingPreview) {
        animFrameId = requestAnimationFrame(loop);
      }
    };

    loop();
    return () => {
      if (animFrameId) cancelAnimationFrame(animFrameId);
    };
  }, [
    state.step,
    state.aspectRatio,
    state.subtitleStyle,
    scenes,
    previewSceneIndex,
    isPlayingPreview,
    activeChannel.handle,
    prompt,
  ]);

  // Workflow 1: Create Video from Trend Radar
  const handleCreateVideoFromTrend = async (trend: TrendItem, chosenRatio: AspectRatioType) => {
    const newPrompt = `${trend.title}. Enfoque: ${trend.angle}. Hook sugerido: "${trend.suggestedHook}". Datos clave: ${trend.summary}`;
    setPrompt(newPrompt);
    setSourceTrendTitle(trend.title);
    setSelectedPublishPlatforms(activeChannel.platforms);

    const nextDuration = chosenRatio === '16:9' ? '3m' : '60s';
    const nextState: VideoState = {
      ...state,
      step: 1,
      aspectRatio: chosenRatio,
      duration: nextDuration,
      videoType: chosenRatio === '16:9' ? 'long' : 'short',
      script: '',
      voiceAudioUrl: undefined,
      renderedVideoUrl: undefined,
    };
    setState(nextState);
    setScenes([]);
    setCurrentProjectId(null);
    setActiveWorkspace('studio');

    setIsGeneratingScript(true);
    setStatusMessage({
      type: 'info',
      text: `Redactando guion viral basado en la tendencia "${trend.title}"...`,
    });
    try {
      const generated = await generateScript(
        newPrompt,
        nextState.genre,
        nextState.subgenre,
        nextState.duration,
        nextState.language,
        chosenRatio,
        activeChannel.tone,
(() => {
          const richMaterial = trend.fullTranscript || trend.detailedContent;
          if (richMaterial) {
            const evidenceBlock = Array.isArray(trend.evidencePoints) && trend.evidencePoints.length > 0
              ? `\nEVIDENCIA Y DATOS COMPROBADOS:\n${trend.evidencePoints.map((p) => `- ${p}`).join('\n')}`
              : '';
            return `### MATERIAL DE INVESTIGACIÓN Y TRANSCRIPCIÓN REAL DEL CASO:
"""
${richMaterial.slice(0, 14000)}
"""
${evidenceBlock}

RESUMEN CENTRAL: ${trend.summary}
ÁNGULO NARRATIVO Y TONO: ${trend.angle || activeChannel.tone}
GANCHO EXPLOSIVO (0-3s): "${trend.suggestedHook}"`;
          }
          return `${trend.whyTrending} (${trend.summary}). Enfoque: ${trend.angle || activeChannel.tone}. Hook: "${trend.suggestedHook}"`;
        })()
      );
      const parsedScenes = parseScriptIntoScenes(
        generated,
        nextState.style,
        comfyConfig,
        nextState.visualBible
      );
      const updatedState = { ...nextState, script: generated };
      setState(updatedState);
      setScenes(parsedScenes);
      saveCurrentProjectSnapshot(updatedState, parsedScenes, newPrompt);
      setStatusMessage({
        type: 'success',
        text: `Guion generado con ${parsedScenes.length} escenas coherentes listas para producir.`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Error al generar el guion automático.',
      });
    } finally {
      setIsGeneratingScript(false);
    }
  };

  // Step 1: Generate Script
  const handleGenerateScript = async () => {
    if (!prompt.trim()) return;
    setIsGeneratingScript(true);
    setStatusMessage({ type: 'info', text: 'Generando estructura de guion con retención viral...' });
    try {
      const generated = await generateScript(
        prompt,
        state.genre,
        state.subgenre,
        state.duration,
        state.language,
        state.aspectRatio,
        activeChannel.tone
      );
      const parsedScenes = parseScriptIntoScenes(
        generated,
        state.style,
        comfyConfig,
        state.visualBible
      );
      const nextState = { ...state, script: generated };
      setState(nextState);
      setScenes(parsedScenes);
      saveCurrentProjectSnapshot(nextState, parsedScenes, prompt);
      setStatusMessage({
        type: 'success',
        text: `¡Guion completado con ${parsedScenes.length} escenas!`,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'No se pudo generar el guion.' });
    } finally {
      setIsGeneratingScript(false);
    }
  };

  // Step 2: Generate Voiceover (Gemini 3.8 TTS)
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlayVoiceSample = (e: React.MouseEvent, voiceId: string) => {
    e.stopPropagation();
    if (sampleAudioRef.current) {
      sampleAudioRef.current.pause();
      if (playingVoiceId === voiceId) {
        setPlayingVoiceId(null);
        return;
      }
    }
    const voiceObj = VOICES.find((v) => v.id === voiceId);
    const audioUrl = voiceObj?.previewUrl || `/media/audio/samples/sample_${voiceId}.mp3`;
    const audio = new Audio(audioUrl);
    sampleAudioRef.current = audio;
    setPlayingVoiceId(voiceId);
    audio.play().catch(() => setPlayingVoiceId(null));
    audio.onended = () => setPlayingVoiceId(null);
    audio.onerror = () => setPlayingVoiceId(null);
  };

  const handleGenerateVoiceover = async () => {
    const fullDialogue =
      scenes.length > 0 ? scenes.map((s) => s.dialogue).join(' ') : state.script;

    if (!fullDialogue.trim()) {
      setStatusMessage({
        type: 'error',
        text: 'Primero genera o escribe un guion en el Paso 1.',
      });
      return;
    }

    setIsGeneratingVoice(true);
    setStatusMessage({
      type: 'info',
      text: `Sintetizando narración con la voz "${state.voice}" en el servidor...`,
    });
    try {
      const audioDataUrl = await generateSpeech(fullDialogue, state.voice, state.language);
      let musicUrl = state.musicAudioUrl;
      if (!musicUrl) {
        musicUrl = await synthesizeStudioMusicTrack(state.music, 22);
      }
      const nextState = { ...state, voiceAudioUrl: audioDataUrl, musicAudioUrl: musicUrl };
      setState(nextState);
      saveCurrentProjectSnapshot(nextState, scenes, prompt);
      setStatusMessage({
        type: 'success',
        text: 'Locución generada en formato WAV de alta claridad y lista para mezcla.',
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'No se pudo generar el audio de voz.',
      });
    } finally {
      setIsGeneratingVoice(false);
    }
  };

  // Step 2: Synthesize Studio Music Preset or Lyria AI Music
  const handleSelectStudioMusic = async (presetId: string) => {
    setIsGeneratingMusic(true);
    try {
      const wavUrl = await synthesizeStudioMusicTrack(presetId, 22);
      const nextState = { ...state, music: presetId, musicAudioUrl: wavUrl };
      setState(nextState);
      saveCurrentProjectSnapshot(nextState, scenes, prompt);
      setStatusMessage({
        type: 'success',
        text: 'Pista musical de estudio sintetizada y sincronizada.',
      });
    } catch {
      setStatusMessage({ type: 'error', text: 'Error al sintetizar pista musical.' });
    } finally {
      setIsGeneratingMusic(false);
    }
  };

  const handleGenerateLyriaMusic = async () => {
    setIsGeneratingMusic(true);
    setStatusMessage({
      type: 'info',
      text: 'Generando pista instrumental original con Lyria 3...',
    });
    try {
      const preset = STUDIO_MUSIC_PRESETS.find((p) => p.id === state.music);
      const audioUrl = await generateMusicWithLyria(
        prompt,
        state.genre,
        preset?.mood || 'cinematic social media background'
      );
      const nextState = { ...state, musicAudioUrl: audioUrl };
      setState(nextState);
      saveCurrentProjectSnapshot(nextState, scenes, prompt);
      setStatusMessage({
        type: 'success',
        text: 'Música original generada con Lyria 3 exitosamente.',
      });
    } catch (err: any) {
      const wavUrl = await synthesizeStudioMusicTrack(state.music, 22);
      setState((prev) => ({ ...prev, musicAudioUrl: wavUrl }));
      setStatusMessage({
        type: 'info',
        text: `${err.message} Se activó la pista instrumental de estudio "${state.music}".`,
      });
    } finally {
      setIsGeneratingMusic(false);
    }
  };

  // Step 3: Change Style & Rebuild Style-Coherent Prompts
  const handleSelectVisualStyle = (newStyleId: string) => {
    const nextState = { ...state, style: newStyleId };
    setState(nextState);

    const rebuiltScenes = scenes.map((s) => {
      const built = buildStyleCoherentScenePrompt(
        s.title,
        s.dialogue,
        newStyleId,
        comfyConfig.architecture,
        state.visualBible
      );
      return {
        ...s,
        comfyPositivePrompt: built.positive,
        comfyNegativePrompt: built.negative,
      };
    });
    setScenes(rebuiltScenes);
    saveCurrentProjectSnapshot(nextState, rebuiltScenes, prompt);
  };

  // Step 3: AI Visual Bible & ComfyUI Prompt Director Sync
  const handleSyncVisualBibleWithAI = async () => {
    if (scenes.length === 0) return;
    setIsCraftingPrompts(true);
    const activeStyleProfile =
      VIDEO_STYLES.find((s) => s.id === state.style) || VIDEO_STYLES[0];

    setStatusMessage({
      type: 'info',
      text: `El Director de Fotografía IA está construyendo la Biblia Visual y los prompts ${comfyConfig.architecture.toUpperCase()} para el estilo "${activeStyleProfile.name}"...`,
    });

    try {
      const result = await craftVisualBibleAndPrompts({
        scenes,
        styleProfile: activeStyleProfile,
        architecture: comfyConfig.architecture,
        aspectRatio: state.aspectRatio,
        existingVisualBible: state.visualBible,
      });

      const updatedScenes = scenes.map((s, idx) => {
        const matched = result.scenePrompts?.find((sp) => sp.sceneIndex === idx);
        return {
          ...s,
          comfyPositivePrompt: matched?.comfyPositivePrompt || s.comfyPositivePrompt,
          comfyNegativePrompt: matched?.comfyNegativePrompt || activeStyleProfile.negativePrompt,
          seed: comfyConfig.seedLock ? comfyConfig.masterSeed : s.seed || comfyConfig.masterSeed,
        };
      });

      const nextState: VideoState = {
        ...state,
        visualBible: {
          ...result.visualBible,
          lastSyncedStyle: state.style,
        },
      };

      setState(nextState);
      setScenes(updatedScenes);
      saveCurrentProjectSnapshot(nextState, updatedScenes, prompt);
      setStatusMessage({
        type: 'success',
        text: `Biblia Visual y ${updatedScenes.length} prompts técnicos sincronizados al 100% con el estilo "${activeStyleProfile.name}".`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'No se pudo sincronizar la Biblia Visual con IA.',
      });
    } finally {
      setIsCraftingPrompts(false);
    }
  };

  // Step 3: Render Single Scene (ComfyUI Local GPU primary -> Cloud Coherent Fallback)
  const renderSceneVisual = async (scene: Scene, index: number): Promise<Scene> => {
    const built = buildStyleCoherentScenePrompt(
      scene.title,
      scene.dialogue,
      state.style,
      comfyConfig.architecture,
      state.visualBible
    );
    const positivePrompt = scene.comfyPositivePrompt || built.positive;
    const negativePrompt = scene.comfyNegativePrompt || built.negative;
    const sceneSeed = comfyConfig.seedLock
      ? comfyConfig.masterSeed
      : scene.seed || comfyConfig.masterSeed;

    if (comfyConfig.enabled) {
      try {
        const comfyRes = await generateImageWithComfyUI({
          config: comfyConfig,
          positivePrompt,
          negativePrompt,
          seed: sceneSeed,
          aspectRatio: state.aspectRatio,
        });
        return {
          ...scene,
          imageUrl: comfyRes.imageUrl,
          comfyPositivePrompt: positivePrompt,
          comfyNegativePrompt: negativePrompt,
          seed: sceneSeed,
          renderedBy:
            comfyConfig.architecture === 'flux1'
              ? 'comfyui_flux'
              : comfyConfig.architecture === 'sdxl'
              ? 'comfyui_sdxl'
              : 'comfyui_custom',
          renderTimeMs: comfyRes.renderTimeMs,
          isGeneratingImage: false,
        };
      } catch (comfyErr: any) {
        if (!comfyConfig.autoFallbackToCloud) {
          throw comfyErr;
        }
        console.warn('ComfyUI local no disponible, activando Cloud Fallback coherente:', comfyErr.message);
      }
    }

    // Cloud Coherent Fallback (uses the exact same Visual Bible, Style Profile & Locked Seed)
    const startCloud = performance.now();
    const cloudUrl = await generateSceneImage(
      `${scene.title}. ${scene.dialogue.slice(0, 100)}`,
      state.style,
      state.aspectRatio,
      false,
      {
        comfyPositivePrompt: positivePrompt,
        comfyNegativePrompt: negativePrompt,
        visualBible: state.visualBible,
        seed: sceneSeed,
      }
    );

    return {
      ...scene,
      imageUrl: cloudUrl,
      comfyPositivePrompt: positivePrompt,
      comfyNegativePrompt: negativePrompt,
      seed: sceneSeed,
      renderedBy: 'cloud_fallback',
      renderTimeMs: Math.round(performance.now() - startCloud),
      isGeneratingImage: false,
    };
  };

  const handleGenerateSingleSceneImage = async (index: number) => {
    const targetScene = scenes[index];
    if (!targetScene) return;

    setScenes((prev) =>
      prev.map((s, idx) => (idx === index ? { ...s, isGeneratingImage: true } : s))
    );
    try {
      const renderedScene = await renderSceneVisual(targetScene, index);
      setScenes((prev) => {
        const updated = prev.map((s, idx) => (idx === index ? renderedScene : s));
        saveCurrentProjectSnapshot(state, updated, prompt);
        return updated;
      });
      setStatusMessage({
        type: 'success',
        text:
          renderedScene.renderedBy === 'cloud_fallback'
            ? `Escena #${index + 1} generada con coherencia de estilo (${state.style}) vía Cloud.`
            : `Escena #${index + 1} renderizada en tu GPU local con ComfyUI (${comfyConfig.architecture.toUpperCase()}).`,
      });
    } catch (err: any) {
      setScenes((prev) =>
        prev.map((s, idx) => (idx === index ? { ...s, isGeneratingImage: false } : s))
      );
      setStatusMessage({
        type: 'error',
        text: err.message || `Error al generar visual de la escena ${index + 1}.`,
      });
    }
  };

  const handleGenerateAllSceneImages = async () => {
    if (scenes.length === 0) return;
    setIsGeneratingAllImages(true);
    const activeStyleProfile =
      VIDEO_STYLES.find((s) => s.id === state.style) || VIDEO_STYLES[0];

    setStatusMessage({
      type: 'info',
      text: `Renderizando ${scenes.length} escenas coherentes en estilo "${activeStyleProfile.name}" (${
        comfyConfig.enabled ? `ComfyUI ${comfyConfig.architecture.toUpperCase()}` : 'Cloud IA'
      })...`,
    });

    const updatedScenes = [...scenes];
    for (let i = 0; i < updatedScenes.length; i++) {
      setScenes((prev) =>
        prev.map((s, idx) => (idx === i ? { ...s, isGeneratingImage: true } : s))
      );
      try {
        const rendered = await renderSceneVisual(updatedScenes[i], i);
        updatedScenes[i] = rendered;
        setScenes([...updatedScenes]);
      } catch {
        updatedScenes[i] = { ...updatedScenes[i], isGeneratingImage: false };
        setScenes([...updatedScenes]);
      }
    }

    saveCurrentProjectSnapshot(state, updatedScenes, prompt);
    setIsGeneratingAllImages(false);
    setStatusMessage({
      type: 'success',
      text: `Todas las escenas fueron generadas con coherencia visual en estilo "${activeStyleProfile.name}".`,
    });
  };

  // Step 4: Animate Scene with AI (Veo / Omni Flash) or Camera Motion
  const handleAnimateSceneAI = async (index: number) => {
    const scene = scenes[index];
    if (!scene) return;

    setScenes((prev) => prev.map((s, i) => (i === index ? { ...s, isAnimating: true } : s)));
    setStatusMessage({
      type: 'info',
      text: `Solicitando animación IA con Veo (gemini-omni-1.1-flash) para Escena ${index + 1}...`,
    });

    try {
      const videoDataUrl = await animateSceneWithAI(
        scene.comfyPositivePrompt || scene.title,
        scene.imageUrl,
        state.aspectRatio
      );
      setScenes((prev) => {
        const next = prev.map((s, i) =>
          i === index ? { ...s, animatedUrl: videoDataUrl, isAnimating: false } : s
        );
        saveCurrentProjectSnapshot(state, next, prompt);
        return next;
      });
      setStatusMessage({
        type: 'success',
        text: `Escena ${index + 1} animada con Veo exitosamente.`,
      });
    } catch (err: any) {
      setScenes((prev) => prev.map((s, i) => (i === index ? { ...s, isAnimating: false } : s)));
      setStatusMessage({
        type: 'info',
        text: err.message || 'Se aplicó movimiento de cámara Ken Burns en alta definición.',
      });
    }
  };

  // Step 5: Generate Subtitles
  const handleGenerateSubtitles = async () => {
    setIsGeneratingSubtitles(true);
    setStatusMessage({
      type: 'info',
      text: 'Generando bloques de subtítulos sincronizados para retención...',
    });
    try {
      const srt = await generateSubtitles(state.script || prompt, state.duration);
      const nextState = { ...state, subtitles: srt };
      setState(nextState);
      saveCurrentProjectSnapshot(nextState, scenes, prompt);
      setStatusMessage({
        type: 'success',
        text: 'Subtítulos dinámicos generados y listos para quemar en el video.',
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error al generar subtítulos.' });
    } finally {
      setIsGeneratingSubtitles(false);
    }
  };

  // Step 6: Render Real Video in Browser (Canvas + Web Audio + MediaRecorder)
  const handleRenderFinalVideo = async () => {
    if (scenes.length === 0) {
      setStatusMessage({
        type: 'error',
        text: 'Asegúrate de tener escenas generadas antes de renderizar el video.',
      });
      return;
    }

    setIsRenderingVideo(true);
    setRenderProgress(0);
    setStatusMessage({
      type: 'info',
      text: 'Renderizando video real en navegador (Canvas 30fps + Voz + Música + Subtítulos)...',
    });

    try {
      let musicUrl = state.musicAudioUrl;
      if (!musicUrl) {
        musicUrl = await synthesizeStudioMusicTrack(state.music, 20);
      }

      const videoUrl = await renderRealVideoInBrowser({
        scenes,
        aspectRatio: state.aspectRatio,
        voiceAudioUrl: state.voiceAudioUrl,
        musicAudioUrl: musicUrl,
        mixedAudioUrl: state.mixedAudioUrl,
        subtitleStyle: state.subtitleStyle || 'hormozi',
        channelWatermark: activeChannel.handle,
        onProgress: (pct) => setRenderProgress(pct),
      });

      const nextState = { ...state, renderedVideoUrl: videoUrl, musicAudioUrl: musicUrl };
      setState(nextState);
      saveCurrentProjectSnapshot(nextState, scenes, prompt);
      setStatusMessage({
        type: 'success',
        text: '¡Video renderizado con éxito! Ya puedes reproducirlo, descargarlo o programarlo.',
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Error durante el renderizado del video.',
      });
    } finally {
      setIsRenderingVideo(false);
    }
  };

  const handleRenderMasterOnServer = async () => {
    if (scenes.length === 0) {
      setStatusMessage({
        type: 'error',
        text: 'Asegúrate de tener escenas generadas antes de compilar el video master.',
      });
      return;
    }

    setIsRenderingVideo(true);
    setRenderProgress(10);
    setStatusMessage({
      type: 'info',
      text: 'Compilando video master MP4 1080p en servidor local con FFmpeg y GPU NVENC...',
    });

    try {
      const job = await renderMasterVideoOnServer({
        scenes,
        aspectRatio: state.aspectRatio,
        voiceAudioUrl: state.voiceAudioUrl,
        musicAudioUrl: state.musicAudioUrl,
        mixedAudioUrl: state.mixedAudioUrl,
        ambientAudioUrl: state.ambientAudioUrl,
        musicVolume: state.musicVolume,
        ambientVolume: state.ambientVolume,
        duckingPreset: state.duckingPreset,
        subtitleStyle: state.subtitleStyle || 'hormozi',
        channelWatermark: activeChannel.handle,
      });

      if (job.videoUrl) {
        const nextState = { ...state, renderedVideoUrl: job.videoUrl };
        setState(nextState);
        saveCurrentProjectSnapshot(nextState, scenes, prompt);
        setStatusMessage({
          type: 'success',
          text: `¡Master MP4 1080p compilado exitosamente! Duración: ${job.durationSec || 0}s (${job.fileSizeMb || 0} MB).`,
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Error al compilar master en servidor.',
      });
    } finally {
      setIsRenderingVideo(false);
      setRenderProgress(100);
    }
  };

  // Step 7: Generate Multi-Platform Marketing Copy & Thumbnail
  const handleGenerateMarketingPackage = async () => {
    setIsGeneratingMarketing(true);
    setStatusMessage({
      type: 'info',
      text: 'Generando SEO, miniatura coherente y textos adaptados para TikTok, Shorts, Reels, LinkedIn y YouTube...',
    });

    try {
      const [marketingData, thumbUrl] = await Promise.all([
        generateMarketingData(
          state.script || prompt,
          state.genre,
          activeChannel.name,
          sourceTrendTitle
        ),
        generateSceneImage(
          sourceTrendTitle || prompt,
          state.style,
          state.aspectRatio,
          true,
          {
            visualBible: state.visualBible,
            seed: comfyConfig.masterSeed,
          }
        ),
      ]);

      const nextState: VideoState = {
        ...state,
        metadata: {
          ...marketingData,
          thumbnailUrl: thumbUrl,
        },
      };
      setState(nextState);
      saveCurrentProjectSnapshot(nextState, scenes, prompt);
      setStatusMessage({
        type: 'success',
        text: 'Paquete multi-red y miniatura viral generados correctamente.',
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Error al generar el paquete de marketing.',
      });
    } finally {
      setIsGeneratingMarketing(false);
    }
  };

  // Step 7: Schedule or Publish to Calendar Hub
  const handleScheduleOrPublish = async (publishImmediately: boolean) => {
    const projId = saveCurrentProjectSnapshot(state, scenes, prompt);
    const title =
      state.metadata?.title || sourceTrendTitle || prompt.slice(0, 55) || 'Video Viral IA';

    const newPost: ScheduledPost = {
      id: `post-${Date.now()}`,
      projectId: projId,
      projectTitle: title,
      channelId: activeChannel.id,
      platforms: selectedPublishPlatforms.length
        ? selectedPublishPlatforms
        : activeChannel.platforms,
      scheduledAt: publishImmediately ? new Date().toISOString() : scheduleDateTime,
      status: publishImmediately ? 'published' : 'scheduled',
      aspectRatio: state.aspectRatio,
      thumbnailUrl: state.metadata?.thumbnailUrl || scenes[0]?.imageUrl,
      renderedVideoUrl: state.renderedVideoUrl,
    };

    if (publishImmediately && activeChannel.webhookUrl) {
      try {
        const res = await dispatchChannelWebhook(activeChannel.webhookUrl, {
          postId: newPost.id,
          projectTitle: newPost.projectTitle,
          channelName: activeChannel.name,
          handle: activeChannel.handle,
          platforms: newPost.platforms,
          aspectRatio: newPost.aspectRatio,
          marketingMetadata: state.metadata,
        });
        newPost.webhookLog = `Enviado a Webhook (HTTP ${res.status})`;
      } catch (err: any) {
        newPost.status = 'failed';
        newPost.webhookLog = err.message;
      }
    }

    const updatedPosts = [newPost, ...scheduledPosts];
    setScheduledPosts(updatedPosts);
    setStatusMessage({
      type: 'success',
      text: publishImmediately
        ? 'Publicación enviada y registrada en el Centro de Publicación.'
        : 'Video programado exitosamente en el Calendario Editorial.',
    });
    setActiveWorkspace('calendar');
  };

  const handleCopyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#090A0F] text-zinc-100 flex flex-col">
      {/* Top Global Studio Navigation */}
      <header className="sticky top-0 z-30 bg-[#090A0F]/95 backdrop-blur-md border-b border-white/10 px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-600/30">
              <Film className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-white">ClipAI</span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/30 font-semibold">
                  Multi-Channel Studio
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 hidden sm:block">
                Tendencias en Vivo • ComfyUI Local GPU • Publicación Social
              </p>
            </div>
          </div>

          {/* Primary Workspace Switcher */}
          <nav className="flex items-center gap-1 bg-[#11131C] p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setActiveWorkspace('trends')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeWorkspace === 'trends'
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Flame className="w-4 h-4 text-emerald-400" />
              <span>Radar de Tendencias</span>
            </button>

            <button
              onClick={() => setActiveWorkspace('studio')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeWorkspace === 'studio'
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Estudio de Video (7 Pasos)</span>
            </button>

            <button
              onClick={() => setActiveWorkspace('calendar')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeWorkspace === 'calendar'
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Calendario & Publicación</span>
              {scheduledPosts.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] tabular-nums">
                  {scheduledPosts.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveWorkspace('channels')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeWorkspace === 'channels'
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Radio className="w-4 h-4" />
              <span>Canales ({channels.length})</span>
            </button>
          </nav>

          {/* Active Channel Selector & Projects Drawer Button */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 bg-[#11131C] border border-white/10 rounded-xl px-3 py-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: activeChannel.accentColor }}
              />
              <select
                value={activeChannel.id}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setActiveChannelId(nextId);
                  const found = channels.find((c) => c.id === nextId);
                  if (found) {
                    setSelectedPublishPlatforms(found.platforms);
                    setState((prev) => ({ ...prev, aspectRatio: found.defaultAspectRatio }));
                  }
                }}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
              >
                {channels.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#11131C] text-white">
                    {c.name} ({c.defaultAspectRatio})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowProjectsDrawer(!showProjectsDrawer)}
              className="px-3 py-2 rounded-xl bg-[#11131C] hover:bg-zinc-800 border border-white/10 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 cursor-pointer"
            >
              <FolderOpen className="w-4 h-4 text-violet-400" />
              <span className="hidden md:inline">Proyectos</span>
              <span className="font-mono text-[11px] text-zinc-400 tabular-nums">
                ({projects.length})
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Saved Projects Drawer */}
      {showProjectsDrawer && (
        <div className="bg-[#11131C] border-b border-white/10 px-4 lg:px-8 py-4">
          <div className="max-w-7xl mx-auto space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                Proyectos Guardados Recientemente
              </h3>
              <button
                onClick={() => {
                  setCurrentProjectId(null);
                  setSourceTrendTitle(undefined);
                  setPrompt('');
                  setScenes([]);
                  setState((prev) => ({
                    ...prev,
                    step: 1,
                    script: '',
                    voiceAudioUrl: undefined,
                    renderedVideoUrl: undefined,
                  }));
                  setShowProjectsDrawer(false);
                  setActiveWorkspace('studio');
                }}
                className="text-xs text-violet-400 hover:text-violet-300 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Crear Proyecto en Blanco
              </button>
            </div>

            {projects.length === 0 ? (
              <p className="text-xs text-zinc-500 py-2">No hay proyectos guardados todavía.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {projects.slice(0, 8).map((proj) => (
                  <div
                    key={proj.id}
                    className="bg-[#090A0F] border border-white/10 rounded-xl p-3 flex items-center justify-between gap-2"
                  >
                    <button
                      onClick={() => {
                        setCurrentProjectId(proj.id);
                        setPrompt(proj.prompt);
                        setState(proj.state);
                        setScenes(proj.scenes);
                        setSourceTrendTitle(proj.sourceTrendTitle);
                        if (proj.state.comfyConfig) {
                          setComfyConfig(proj.state.comfyConfig);
                        }
                        setActiveWorkspace('studio');
                        setShowProjectsDrawer(false);
                      }}
                      className="text-left flex-1 min-w-0 cursor-pointer"
                    >
                      <p className="text-xs font-bold text-white truncate">{proj.name}</p>
                      <p className="text-[10px] font-mono text-zinc-500">
                        {proj.state.aspectRatio} • Paso {proj.state.step}/7
                      </p>
                    </button>
                    <button
                      onClick={() =>
                        setProjects((prev) => prev.filter((item) => item.id !== proj.id))
                      }
                      className="p-1.5 text-zinc-500 hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6">
        {/* Status Banner */}
        {statusMessage && (
          <div
            className={`mb-6 rounded-xl px-4 py-3 border text-xs font-medium flex items-center justify-between gap-3 ${
              statusMessage.type === 'error'
                ? 'bg-red-500/10 border-red-500/30 text-red-300'
                : statusMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-violet-500/10 border-violet-500/30 text-violet-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0" />
              ) : statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-[11px] underline opacity-75 hover:opacity-100 cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* VIEW 1: LIVE TREND RADAR */}
        {activeWorkspace === 'trends' && (
          <TrendRadarView
            activeChannel={activeChannel}
            trends={trends}
            onUpdateTrends={setTrends}
            onCreateVideoFromTrend={handleCreateVideoFromTrend}
          />
        )}

        {/* VIEW 2: CHANNELS MANAGER */}
        {activeWorkspace === 'channels' && (
          <ChannelsManagerView
            channels={channels}
            activeChannelId={activeChannel.id}
            onSelectChannel={setActiveChannelId}
            onSaveChannels={setChannels}
          />
        )}

        {/* VIEW 3: CALENDAR & PUBLISHING HUB */}
        {activeWorkspace === 'calendar' && (
          <CalendarHubView
            channels={channels}
            activeChannel={activeChannel}
            projects={projects}
            scheduledPosts={scheduledPosts}
            onUpdateScheduledPosts={setScheduledPosts}
            onOpenProjectInStudio={(proj) => {
              setCurrentProjectId(proj.id);
              setPrompt(proj.prompt);
              setState(proj.state);
              setScenes(proj.scenes);
              setSourceTrendTitle(proj.sourceTrendTitle);
              setActiveWorkspace('studio');
            }}
          />
        )}

        {/* VIEW 4: 7-STEP AI VIDEO PRODUCTION STUDIO */}
        {activeWorkspace === 'studio' && (
          <div className="space-y-6">
            {/* Step Progress Bar */}
            <div className="bg-[#11131C] border border-white/10 rounded-2xl p-3 overflow-x-auto">
              <div className="flex items-center justify-between min-w-[740px] gap-1">
                {STUDIO_STEPS.map((st) => {
                  const Icon = st.icon;
                  const isActive = state.step === st.num;
                  const isDone = state.step > st.num;
                  return (
                    <button
                      key={st.num}
                      onClick={() => setState((prev) => ({ ...prev, step: st.num }))}
                      className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        isActive
                          ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25'
                          : isDone
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'text-zinc-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{st.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* STEP 1: GUION VIRAL & FORMATO */}
            {state.step === 1 && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 bg-[#11131C] border border-white/10 rounded-2xl p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-violet-400" /> Configuración del Video
                    </h2>
                    <span className="text-xs font-mono text-zinc-400">
                      Canal: {activeChannel.name}
                    </span>
                  </div>

                  {sourceTrendTitle && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-300">
                      <span className="font-mono uppercase text-[10px] block text-emerald-400 font-bold">
                        Tendencia Vinculada:
                      </span>
                      {sourceTrendTitle}
                    </div>
                  )}

                  {/* Aspect Ratio Selector */}
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-2">
                      Relación de Aspecto y Red Destino
                    </label>
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { id: '9:16', label: '9:16 Vertical', sub: 'TikTok / Shorts / Reels' },
                        { id: '16:9', label: '16:9 Horizontal', sub: 'YouTube Largo' },
                        { id: '1:1', label: '1:1 Cuadrado', sub: 'LinkedIn / Feed' },
                      ].map((fmt) => (
                        <button
                          key={fmt.id}
                          onClick={() =>
                            setState((prev) => ({
                              ...prev,
                              aspectRatio: fmt.id as AspectRatioType,
                            }))
                          }
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            state.aspectRatio === fmt.id
                              ? 'bg-violet-600/20 border-violet-500 text-white'
                              : 'bg-[#090A0F] border-white/10 text-zinc-400 hover:text-white'
                          }`}
                        >
                          <div className="font-mono font-bold text-xs">{fmt.label}</div>
                          <div className="text-[10px] text-zinc-400 mt-0.5">{fmt.sub}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Genre & Subgenre */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1.5">Categoría</label>
                      <select
                        value={state.genre}
                        onChange={(e) => {
                          const g = e.target.value;
                          setState((prev) => ({
                            ...prev,
                            genre: g,
                            subgenre: SUBGENRES[g]?.[0] || '',
                          }));
                        }}
                        className="w-full bg-[#090A0F] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white"
                      >
                        {GENRES.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1.5">Enfoque</label>
                      <select
                        value={state.subgenre}
                        onChange={(e) =>
                          setState((prev) => ({ ...prev, subgenre: e.target.value }))
                        }
                        className="w-full bg-[#090A0F] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white"
                      >
                        {(SUBGENRES[state.genre] || []).map((sg) => (
                          <option key={sg} value={sg}>
                            {sg}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Duration & Language */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1.5">Duración Objetivo</label>
                      <select
                        value={state.duration}
                        onChange={(e) =>
                          setState((prev) => ({ ...prev, duration: e.target.value }))
                        }
                        className="w-full bg-[#090A0F] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white font-mono"
                      >
                        {DURATIONS.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1.5">Idioma del Video</label>
                      <select
                        value={state.language}
                        onChange={(e) =>
                          setState((prev) => ({ ...prev, language: e.target.value }))
                        }
                        className="w-full bg-[#090A0F] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white"
                      >
                        <option value="es">Español</option>
                        <option value="en">Inglés (English)</option>
                        <option value="pt">Portugués</option>
                      </select>
                    </div>
                  </div>

                  {/* Idea / Prompt Input */}
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                      Tema, Tendencia o Idea del Video
                    </label>
                    <textarea
                      rows={4}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Describe la noticia, tendencia o tema sobre el que quieres generar el video..."
                      className="w-full bg-[#090A0F] border border-white/10 rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  <button
                    onClick={handleGenerateScript}
                    disabled={isGeneratingScript}
                    className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-violet-600/20"
                  >
                    {isGeneratingScript ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Estructurando Guion y Escenas...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4" />
                        Generar Guion con Estructura Viral
                      </>
                    )}
                  </button>
                </div>

                {/* Right Column: Script & Scene Editor */}
                <div className="lg:col-span-7 bg-[#11131C] border border-white/10 rounded-2xl p-6 flex flex-col justify-between space-y-5">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-white">
                        Escenas y Diálogos ({scenes.length} escenas)
                      </h3>
                      <button
                        onClick={() => {
                          const newIdx = scenes.length + 1;
                          const title = `Escena ${newIdx}: Plano cinematográfico detallado`;
                          const dialogue = 'Nueva línea de narración para el video.';
                          const built = buildStyleCoherentScenePrompt(
                            title,
                            dialogue,
                            state.style,
                            comfyConfig.architecture,
                            state.visualBible
                          );
                          setScenes((prev) => [
                            ...prev,
                            {
                              title,
                              dialogue,
                              cameraMotion: 'zoom_in',
                              comfyPositivePrompt: built.positive,
                              comfyNegativePrompt: built.negative,
                              seed: comfyConfig.masterSeed,
                            },
                          ]);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-violet-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Añadir Escena
                      </button>
                    </div>

                    {scenes.length === 0 ? (
                      <div className="bg-[#090A0F] border border-white/5 rounded-xl p-10 text-center space-y-2">
                        <Sparkles className="w-8 h-8 text-violet-400 mx-auto" />
                        <p className="text-sm font-semibold text-white">
                          Aún no has generado las escenas del guion
                        </p>
                        <p className="text-xs text-zinc-400 max-w-md mx-auto">
                          Haz clic en «Generar Guion con Estructura Viral» o selecciona una tendencia desde el Radar en Vivo.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                        {scenes.map((scene, idx) => (
                          <div
                            key={idx}
                            className="bg-[#090A0F] border border-white/10 rounded-xl p-4 space-y-2.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-mono font-bold text-violet-400 uppercase">
                                Escena #{idx + 1} (Descripción de Escena)
                              </span>
                              <button
                                onClick={() =>
                                  setScenes((prev) => prev.filter((_, i) => i !== idx))
                                }
                                className="text-zinc-500 hover:text-red-400 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <input
                              type="text"
                              value={scene.title}
                              onChange={(e) => {
                                const val = e.target.value;
                                setScenes((prev) =>
                                  prev.map((s, i) => (i === idx ? { ...s, title: val } : s))
                                );
                              }}
                              className="w-full bg-[#11131C] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-zinc-200"
                            />
                            <div>
                              <span className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">
                                Locución hablada:
                              </span>
                              <textarea
                                rows={2}
                                value={scene.dialogue}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setScenes((prev) =>
                                    prev.map((s, i) => (i === idx ? { ...s, dialogue: val } : s))
                                  );
                                }}
                                className="w-full bg-[#11131C] border border-white/10 rounded-lg p-2.5 text-xs text-white"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-white/10 flex justify-end">
                    <button
                      onClick={() => setState((prev) => ({ ...prev, step: 2 }))}
                      disabled={scenes.length === 0}
                      className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                    >
                      Siguiente: Locución por Escenas <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: LOCUCIÓN POR ESCENAS (VOICE STUDIO) */}
            {state.step === 2 && (
              <VoiceStudioStep
                scenes={scenes}
                state={state}
                onUpdateScenes={setScenes}
                onUpdateState={(patch) => setState((prev) => ({ ...prev, ...patch }))}
                onPrevStep={() => setState((prev) => ({ ...prev, step: 1 }))}
                onNextStep={() => setState((prev) => ({ ...prev, step: 3 }))}
                onSetStatus={setStatusMessage}
              />
            )}

            {/* STEP 3: BANDA SONORA & SFX (MUSIC & SOUND DESIGN) */}
            {state.step === 3 && (
              <MusicAndSfxStep
                scenes={scenes}
                state={state}
                onUpdateState={(patch) => setState((prev) => ({ ...prev, ...patch }))}
                onPrevStep={() => setState((prev) => ({ ...prev, step: 3 }))}
                onNextStep={() => setState((prev) => ({ ...prev, step: 5 }))}
                onSetStatus={setStatusMessage}
              />
            )}

            {/* STEP 4: COMFYUI LOCAL GPU + BIBLIA VISUAL & COHERENCIA DE ESTILO */}
            {state.step === 4 && (
              <VisualsStudioStep
                scenes={scenes}
                selectedStyleId={state.style}
                aspectRatio={state.aspectRatio}
                comfyConfig={comfyConfig}
                visualBible={state.visualBible}
                isGeneratingAllImages={isGeneratingAllImages}
                isCraftingPrompts={isCraftingPrompts}
                onSelectStyle={handleSelectVisualStyle}
                onUpdateComfyConfig={setComfyConfig}
                onUpdateVisualBible={(nextBible) =>
                  setState((prev) => ({ ...prev, visualBible: nextBible }))
                }
                onUpdateScene={(index, patch) =>
                  setScenes((prev) =>
                    prev.map((s, i) => (i === index ? { ...s, ...patch } : s))
                  )
                }
                onSyncVisualBibleWithAI={handleSyncVisualBibleWithAI}
                onGenerateSingleScene={handleGenerateSingleSceneImage}
                onGenerateAllScenes={handleGenerateAllSceneImages}
                onPrevStep={() => setState((prev) => ({ ...prev, step: 3 }))}
                onNextStep={() => setState((prev) => ({ ...prev, step: 5 }))}
              />
            )}

            {/* STEP 5: ANIMACIÓN DE ESCENAS (HÍBRIDO KEN BURNS + VEO) */}
            {state.step === 5 && (
              <div className="space-y-6">
                <div className="bg-[#11131C] border border-white/10 rounded-2xl p-6">
                  <h2 className="text-lg font-bold text-white">
                    Animación de Cámara y Generación de Clips IA (Veo / Omni Flash)
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Configura el movimiento cinemático que el motor Canvas aplicará a cada escena o anima escenas individuales con IA generativa.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {scenes.map((scene, idx) => (
                    <div
                      key={idx}
                      className="bg-[#11131C] border border-white/10 rounded-2xl p-4 space-y-4 flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="aspect-video bg-[#090A0F] rounded-xl overflow-hidden relative border border-white/10">
                          {scene.animatedUrl ? (
                            <video
                              src={scene.animatedUrl}
                              controls
                              loop
                              muted
                              className="w-full h-full object-cover"
                            />
                          ) : scene.imageUrl ? (
                            <img
                              src={scene.imageUrl}
                              alt={scene.title}
                              className="w-full h-full object-cover scale-105 transition-transform duration-1000"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500">
                              Sin imagen en Escena {idx + 1}
                            </div>
                          )}
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/75 text-[10px] font-mono text-white">
                            Escena #{idx + 1}
                          </span>
                        </div>

                        <div>
                          <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1.5">
                            Movimiento de Cámara en Render:
                          </label>
                          <select
                            value={scene.cameraMotion || 'zoom_in'}
                            onChange={(e) => {
                              const motion = e.target.value as CameraMotionType;
                              setScenes((prev) =>
                                prev.map((s, i) =>
                                  i === idx ? { ...s, cameraMotion: motion } : s
                                )
                              );
                            }}
                            className="w-full bg-[#090A0F] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                          >
                            <option value="zoom_in">Zoom In Dramático (Ken Burns)</option>
                            <option value="zoom_out">Zoom Out Revelador</option>
                            <option value="pan_right">Paneo Cinematográfico Derecha</option>
                            <option value="pan_left">Paneo Cinematográfico Izquierda</option>
                            <option value="pulse">Pulso Dinámico de Retención</option>
                          </select>
                        </div>
                      </div>

                      <button
                        onClick={() => handleAnimateSceneAI(idx)}
                        disabled={scene.isAnimating}
                        className="w-full py-2.5 rounded-xl bg-violet-600/20 hover:bg-violet-600 border border-violet-500/40 text-violet-300 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        <Film className="w-3.5 h-3.5" />
                        {scene.isAnimating
                          ? 'Generando Clip Veo...'
                          : 'Animar con Veo 3.1 / Omni Flash'}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => setState((prev) => ({ ...prev, step: 4 }))}
                    className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" /> Anterior
                  </button>
                  <button
                    onClick={() => setState((prev) => ({ ...prev, step: 6 }))}
                    className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                  >
                    Siguiente: Subtítulos <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 6: SUBTÍTULOS DINÁMICOS */}
            {state.step === 8 && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 bg-[#11131C] border border-white/10 rounded-2xl p-6 space-y-5">
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      Estilo de Subtítulos Quemados en Video
                    </h2>
                    <p className="text-xs text-zinc-400 mt-1">
                      Selecciona cómo se renderizarán los subtítulos dinámicos palabra por palabra durante la exportación.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {[
                      {
                        id: 'hormozi',
                        name: 'Impacto Viral (Amarillo / Blanco)',
                        desc: 'Resaltado de palabra activa en amarillo brillante con borde negro grueso',
                      },
                      {
                        id: 'neon',
                        name: 'Cyber Neón (Azul Eléctrico)',
                        desc: 'Ideal para canales de tecnología, IA, ciencia y negocios digitales',
                      },
                      {
                        id: 'boxed',
                        name: 'Caja Editorial Violeta',
                        desc: 'Pastilla de alto contraste para lectura rápida en LinkedIn y Reels',
                      },
                      {
                        id: 'minimal',
                        name: 'Documental Cinematográfico',
                        desc: 'Tipografía limpia con sombra suave para formatos 16:9',
                      },
                    ].map((st) => (
                      <button
                        key={st.id}
                        onClick={() =>
                          setState((prev) => ({
                            ...prev,
                            subtitleStyle: st.id as SubtitleStyleType,
                          }))
                        }
                        className={`w-full p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                          state.subtitleStyle === st.id
                            ? 'bg-violet-600/20 border-violet-500 text-white'
                            : 'bg-[#090A0F] border-white/10 text-zinc-300'
                        }`}
                      >
                        <div className="text-xs font-bold">{st.name}</div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">{st.desc}</div>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleGenerateSubtitles}
                    disabled={isGeneratingSubtitles}
                    className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Subtitles className="w-4 h-4" />
                    {isGeneratingSubtitles
                      ? 'Sincronizando Tiempos SRT...'
                      : 'Generar Archivo de Subtítulos (.SRT) con IA'}
                  </button>
                </div>

                <div className="lg:col-span-7 bg-[#11131C] border border-white/10 rounded-2xl p-6 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-white">
                        Transcripción y Código de Tiempo (.SRT)
                      </h3>
                      {state.subtitles && (
                        <button
                          onClick={() => handleCopyText('srt', state.subtitles || '')}
                          className="text-xs text-violet-400 hover:text-white flex items-center gap-1 cursor-pointer"
                        >
                          {copiedField === 'srt' ? (
                            <>
                              <Check className="w-3.5 h-3.5" /> Copiado
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" /> Copiar SRT
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <textarea
                      rows={12}
                      value={
                        state.subtitles ||
                        scenes
                          .map(
                            (s, i) =>
                              `${i + 1}\n00:00:${String(i * 4).padStart(2, '0')},000 --> 00:00:${String(
                                (i + 1) * 4
                              ).padStart(2, '0')},000\n${s.dialogue}`
                          )
                          .join('\n\n')
                      }
                      onChange={(e) =>
                        setState((prev) => ({ ...prev, subtitles: e.target.value }))
                      }
                      className="w-full bg-[#090A0F] border border-white/10 rounded-xl p-4 text-xs font-mono text-zinc-200"
                    />
                  </div>

                  <div className="pt-4 border-t border-white/10 flex justify-between">
                    <button
                      onClick={() => setState((prev) => ({ ...prev, step: 6 }))}
                      className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" /> Anterior
                    </button>
                    <button
                      onClick={() => setState((prev) => ({ ...prev, step: 8 }))}
                      className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                    >
                      Siguiente: Renderizar Video <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 7: EDITOR MASTER & EXPORTACIÓN DE VIDEO REAL */}
            {state.step === 8 && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Interactive Monitor & Real Video Player */}
                <div className="lg:col-span-6 bg-[#11131C] border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-between space-y-4">
                  <div className="w-full flex items-center justify-between">
                    <span className="text-xs font-mono uppercase text-violet-400 font-bold">
                      Monitor de Salida ({state.aspectRatio})
                    </span>
                    <div className="flex items-center gap-2">
                      {(['9:16', '16:9', '1:1'] as AspectRatioType[]).map((ratio) => (
                        <button
                          key={ratio}
                          onClick={() => setState((prev) => ({ ...prev, aspectRatio: ratio }))}
                          className={`px-2.5 py-1 rounded text-xs font-mono font-bold cursor-pointer ${
                            state.aspectRatio === ratio
                              ? 'bg-violet-600 text-white'
                              : 'bg-[#090A0F] text-zinc-400'
                          }`}
                        >
                          {ratio}
                        </button>
                      ))}
                    </div>
                  </div>

                  {state.renderedVideoUrl ? (
                    <div className="w-full flex flex-col items-center space-y-3">
                      <video
                        src={state.renderedVideoUrl}
                        controls
                        autoPlay
                        className={`rounded-xl border border-emerald-500/40 bg-black shadow-2xl ${
                          state.aspectRatio === '16:9'
                            ? 'w-full aspect-video'
                            : state.aspectRatio === '1:1'
                            ? 'w-80 aspect-square'
                            : 'w-64 aspect-[9/16]'
                        }`}
                      />
                      <span className="text-xs text-emerald-400 font-mono flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" /> Archivo de Video Real Compilado (.webm)
                      </span>
                    </div>
                  ) : (
                    <div className="w-full flex flex-col items-center space-y-3">
                      <canvas
                        ref={previewCanvasRef}
                        width={state.aspectRatio === '16:9' ? 640 : 360}
                        height={
                          state.aspectRatio === '16:9'
                            ? 360
                            : state.aspectRatio === '1:1'
                            ? 360
                            : 640
                        }
                        className={`rounded-xl border border-white/15 bg-black shadow-xl ${
                          state.aspectRatio === '16:9'
                            ? 'w-full aspect-video'
                            : state.aspectRatio === '1:1'
                            ? 'w-72 aspect-square'
                            : 'w-60 aspect-[9/16]'
                        }`}
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setIsPlayingPreview(!isPlayingPreview)}
                          className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
                        >
                          {isPlayingPreview ? (
                            <>
                              <Pause className="w-3.5 h-3.5" /> Pausar Vista Previa
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5" /> Animar Vista Previa
                            </>
                          )}
                        </button>
                        <span className="text-xs font-mono text-zinc-400">
                          Escena {previewSceneIndex + 1}/{Math.max(1, scenes.length)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Timeline & Real Export Engine Controls */}
                <div className="lg:col-span-6 bg-[#11131C] border border-white/10 rounded-2xl p-6 flex flex-col justify-between space-y-6">
                  <div className="space-y-4">
                    <div>
                      <span className="text-xs font-mono uppercase text-emerald-400">
                        Motor HTML5 Canvas + Web Audio + MediaRecorder
                      </span>
                      <h2 className="text-xl font-bold text-white mt-0.5">
                        Compilación y Exportación de Video Real
                      </h2>
                      <p className="text-xs text-zinc-400 mt-1">
                        Combina todas las escenas con movimiento de cámara, subtítulos quemados, locución IA y música de fondo en un archivo de video real.
                      </p>
                    </div>

                    {/* Scene Selector Strip */}
                    <div>
                      <span className="text-xs font-semibold text-zinc-300 block mb-2">
                        Línea de Tiempo de Escenas (Click para previsualizar en monitor):
                      </span>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {scenes.map((s, idx) => (
                          <button
                            key={idx}
                            onClick={() => setPreviewSceneIndex(idx)}
                            className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                              previewSceneIndex === idx
                                ? 'bg-violet-600/20 border-violet-500 text-white'
                                : 'bg-[#090A0F] border-white/10 text-zinc-400'
                            }`}
                          >
                            <div className="text-[10px] font-mono font-bold">
                              Escena #{idx + 1}
                            </div>
                            <div className="text-[10px] truncate mt-0.5">{s.dialogue}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Audio / Visual Readiness Checklist */}
                    <div className="bg-[#090A0F] border border-white/10 rounded-xl p-4 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400">Escenas del Guion:</span>
                        <span className="font-mono text-emerald-400 font-bold">
                          {scenes.length} escenas listas
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400">Locución Neural (TTS):</span>
                        <span
                          className={`font-mono font-bold ${
                            state.voiceAudioUrl ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {state.voiceAudioUrl ? 'Lista para mezclar' : 'Opcional (Sin voz)'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400">Pista Musical de Fondo:</span>
                        <span className="font-mono text-emerald-400 font-bold">
                          {state.music} (Sincronizada)
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400">Estilo de Subtítulos:</span>
                        <span className="font-mono text-violet-400 font-bold uppercase">
                          {state.subtitleStyle || 'hormozi'}
                        </span>
                      </div>
                    </div>

                    {isRenderingVideo && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-violet-300">
                            Grabando fotogramas y pista de audio...
                          </span>
                          <span className="text-white font-bold tabular-nums">
                            {renderProgress}%
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-violet-500 transition-all duration-200"
                            style={{ width: `${renderProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={handleRenderMasterOnServer}
                        disabled={isRenderingVideo}
                        className="flex-1 py-3.5 px-5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-violet-600/25 border border-violet-400/30"
                      >
                        {isRenderingVideo ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Compilando Master GPU ({renderProgress}%)...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-amber-300" />
                            Compilar Master MP4 1080p (GPU NVENC)
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleRenderFinalVideo}
                        disabled={isRenderingVideo}
                        className="py-3.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 hover:text-white font-medium text-xs flex items-center justify-center gap-2 cursor-pointer border border-white/10"
                        title="Renderizado alternativo en el navegador"
                      >
                        <Film className="w-4 h-4" />
                        WebM Navegador
                      </button>

                      {state.renderedVideoUrl && (
                        <a
                          href={state.renderedVideoUrl}
                          download={`clipai_${activeChannel.handle.replace('@', '')}_${Date.now()}.webm`}
                          className="py-3.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          Descargar Video
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/10 flex justify-between">
                    <button
                      onClick={() => setState((prev) => ({ ...prev, step: 6 }))}
                      className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" /> Anterior
                    </button>
                    <button
                      onClick={() => setState((prev) => ({ ...prev, step: 8 }))}
                      className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
                    >
                      Siguiente: Publicación Multi-Red <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 8: MINIATURA, SEO & PUBLICACIÓN MULTI-RED */}
            {state.step === 8 && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Thumbnail & Multi-Platform Copy Generator */}
                <div className="lg:col-span-7 bg-[#11131C] border border-white/10 rounded-2xl p-6 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-mono uppercase text-violet-400">
                        Kit de Distribución Multi-Red
                      </span>
                      <h2 className="text-lg font-bold text-white">
                        Miniatura, SEO & Copy Adaptado por Plataforma
                      </h2>
                    </div>
                    <button
                      onClick={handleGenerateMarketingPackage}
                      disabled={isGeneratingMarketing}
                      className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shrink-0"
                    >
                      <Wand2 className="w-4 h-4" />
                      {isGeneratingMarketing
                        ? 'Generando Copy Multi-Red...'
                        : 'Generar Miniatura y Copy IA'}
                    </button>
                  </div>

                  {/* Platform Copy Selector Tabs */}
                  <div className="flex flex-wrap gap-1.5 border-b border-white/10 pb-3">
                    {SOCIAL_PLATFORMS.map((plat) => (
                      <button
                        key={plat.id}
                        onClick={() => setSelectedMarketingPlatform(plat.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          selectedMarketingPlatform === plat.id
                            ? 'bg-violet-600 text-white'
                            : 'bg-[#090A0F] text-zinc-400 hover:text-white'
                        }`}
                      >
                        {plat.name}
                      </button>
                    ))}
                  </div>

                  {/* Active Platform Copy Box */}
                  {(() => {
                    const currentCopy =
                      state.metadata?.platformCopy?.[selectedMarketingPlatform];
                    const displayTitle =
                      currentCopy?.title ||
                      state.metadata?.title ||
                      sourceTrendTitle ||
                      prompt.slice(0, 60);
                    const displayCaption =
                      currentCopy?.caption ||
                      state.metadata?.description ||
                      'Haz clic en «Generar Miniatura y Copy IA» para adaptar el texto a cada red social.';
                    const displayTags =
                      currentCopy?.hashtags ||
                      state.metadata?.hashtags ||
                      ['viral', 'tendencias', 'ia'];

                    return (
                      <div className="bg-[#090A0F] border border-white/10 rounded-xl p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono uppercase text-emerald-400 font-bold">
                            Copy Optimizado para{' '}
                            {
                              SOCIAL_PLATFORMS.find((p) => p.id === selectedMarketingPlatform)
                                ?.name
                            }
                          </span>
                          <button
                            onClick={() =>
                              handleCopyText(
                                'plat-copy',
                                `${displayTitle}\n\n${displayCaption}\n\n${displayTags
                                  .map((t) => (t.startsWith('#') ? t : `#${t}`))
                                  .join(' ')}`
                              )
                            }
                            className="text-xs text-violet-400 hover:text-white flex items-center gap-1 cursor-pointer"
                          >
                            {copiedField === 'plat-copy' ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" /> Copiado
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" /> Copiar Todo
                              </>
                            )}
                          </button>
                        </div>

                        <div>
                          <label className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">
                            Título / Gancho Principal:
                          </label>
                          <input
                            type="text"
                            value={displayTitle}
                            onChange={(e) => {
                              const val = e.target.value;
                              setState((prev) => ({
                                ...prev,
                                metadata: {
                                  ...(prev.metadata || {
                                    title: val,
                                    description: '',
                                    hashtags: [],
                                  }),
                                  title: val,
                                },
                              }));
                            }}
                            className="w-full bg-[#11131C] border border-white/10 rounded-lg px-3 py-2 text-xs font-bold text-white"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">
                            Descripción / Cuerpo de la Publicación:
                          </label>
                          <textarea
                            rows={4}
                            value={displayCaption}
                            onChange={(e) => {
                              const val = e.target.value;
                              setState((prev) => ({
                                ...prev,
                                metadata: {
                                  ...(prev.metadata || {
                                    title: displayTitle,
                                    description: val,
                                    hashtags: [],
                                  }),
                                  description: val,
                                },
                              }));
                            }}
                            className="w-full bg-[#11131C] border border-white/10 rounded-lg p-3 text-xs text-zinc-200"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">
                            Hashtags de Alto Alcance:
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {displayTags.map((tag, i) => (
                              <span
                                key={i}
                                className="px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/30 text-violet-300 font-mono text-xs"
                              >
                                {tag.startsWith('#') ? tag : `#${tag}`}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Right: Thumbnail Preview & Multi-Channel Scheduling / Webhook Dispatch */}
                <div className="lg:col-span-5 bg-[#11131C] border border-white/10 rounded-2xl p-6 flex flex-col justify-between space-y-5">
                  <div className="space-y-4">
                    <h3 className="text-base font-bold text-white">
                      Miniatura & Programación en Canal
                    </h3>

                    {/* Thumbnail Preview */}
                    <div className="aspect-video bg-[#090A0F] border border-white/10 rounded-xl overflow-hidden relative flex items-center justify-center">
                      {state.metadata?.thumbnailUrl || scenes[0]?.imageUrl ? (
                        <>
                          <img
                            src={state.metadata?.thumbnailUrl || scenes[0]?.imageUrl}
                            alt="Thumbnail"
                            className="w-full h-full object-cover"
                          />
                          {state.metadata?.thumbnailText && (
                            <div className="absolute inset-x-4 bottom-4 bg-black/80 backdrop-blur-sm border border-white/15 px-3 py-2 rounded-lg text-center">
                              <span className="font-extrabold text-sm text-amber-400 uppercase tracking-wide">
                                {state.metadata.thumbnailText}
                              </span>
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-zinc-500">
                          Genera el paquete IA para crear la portada
                        </span>
                      )}
                    </div>

                    {/* Target Networks Selection */}
                    <div>
                      <label className="text-xs font-semibold text-zinc-300 block mb-2">
                        Redes donde se publicará ({activeChannel.name}):
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {SOCIAL_PLATFORMS.map((plat) => {
                          const active = selectedPublishPlatforms.includes(plat.id);
                          return (
                            <button
                              key={plat.id}
                              onClick={() =>
                                setSelectedPublishPlatforms((prev) =>
                                  prev.includes(plat.id)
                                    ? prev.filter((p) => p !== plat.id)
                                    : [...prev, plat.id]
                                )
                              }
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium border cursor-pointer ${
                                active
                                  ? plat.badgeColor
                                  : 'bg-[#090A0F] border-white/10 text-zinc-500'
                              }`}
                            >
                              {plat.shortName}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Schedule Date/Time Picker */}
                    <div>
                      <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 mb-1.5">
                        <Clock className="w-3.5 h-3.5 text-violet-400" /> Fecha y Hora de Programación:
                      </label>
                      <input
                        type="datetime-local"
                        value={scheduleDateTime}
                        onChange={(e) => setScheduleDateTime(e.target.value)}
                        className="w-full bg-[#090A0F] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono"
                      />
                    </div>

                    <div className="space-y-2.5 pt-2">
                      <button
                        onClick={() => handleScheduleOrPublish(false)}
                        className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-violet-600/20"
                      >
                        <Calendar className="w-4 h-4" />
                        Programar en Calendario Multi-Canal
                      </button>

                      <button
                        onClick={() => handleScheduleOrPublish(true)}
                        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Send className="w-4 h-4" />
                        Publicar Ahora (Despachar a Redes / Webhook)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
