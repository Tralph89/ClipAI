/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Flame,
  Sparkles,
  Film,
  Calendar,
  Radio,
  Cpu,
  FolderOpen,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  Send,
} from 'lucide-react';
import {
  AppSettings,
  AspectRatioType,
  DEFAULT_CHANNELS,
  DEFAULT_SETTINGS,
  LocalVideoEngineId,
  Project,
  PublishAutoMode,
  Scene,
  ScheduledPost,
  SocialChannel,
  SocialPlatformId,
  StockVideoCandidate,
  STUDIO_MUSIC_PRESETS,
  SystemStatus,
  TrendItem,
  VideoState,
} from './types';
import {
  acquireSceneStockBrollOnServer,
  animateSceneWithAI,
  deleteProjectFromDisk,
  dispatchChannelWebhook,
  downloadStockVideoClipOnServer,
  fetchBootstrap,
  generateBatchInitialImages,
  generateBatchSceneVisualsOnServer,
  generateMarketingData,
  generateSceneImage,
  generateSceneImageDetailed,
  generateSceneInitialImage,
  generateSceneLocalVideoClip,
  generateScenesVoiceover,
  generateScript,
  generateSpeech,
  generateSpeechClip,
  generateStudioMusicOnServer,
  generateSubtitles,
  mixStudioAudioWithDucking,
  rebuildMasterVoiceTrack,
  renderMasterVideoOnServer,
  saveAppSettings,
  saveChannelsToDisk,
  saveProjectToDisk,
  saveScheduledPostsToDisk,
  saveTrendsToDisk,
  uploadBlobUrlToDisk,
  VisualInitialSource,
} from './services/apiService';
import {
  renderRealVideoInBrowser,
  synthesizeStudioMusicTrack,
} from './services/videoRenderer';
import { TrendRadarView } from './components/TrendRadarView';
import { ChannelsManagerView } from './components/ChannelsManagerView';
import { CalendarHubView } from './components/CalendarHubView';
import { StudioWizardView } from './components/StudioWizardView';
import { EngineSettingsView } from './components/EngineSettingsView';

type WorkspaceTab = 'trends' | 'studio' | 'calendar' | 'channels' | 'settings';

function parseScriptIntoScenes(scriptText: string): Scene[] {
  const regex = /\[Escena\s*\d+:\s*([^\]]+)\]\s*([\s\S]*?)(?=\[Escena\s*\d+:|$)/gi;
  const parsed: Scene[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(scriptText)) !== null) {
    const visualTitle = match[1].trim();
    const spokenDialogue = match[2]
      .replace(/^(Narrador|Locutor|Voz en off|Host):\s*/gim, '')
      .trim();
    parsed.push({
      title: visualTitle,
      dialogue: spokenDialogue,
      cameraMotion: 'zoom_in',
    });
  }

  if (parsed.length === 0 && scriptText.trim()) {
    const paragraphs = scriptText
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
    paragraphs.slice(0, 6).forEach((p, idx) => {
      parsed.push({
        title: `Escena ${idx + 1}: Visual cinematográfico impactante sobre ${p.slice(0, 60)}`,
        dialogue: p.replace(/\[.*?\]/g, '').trim(),
        cameraMotion: idx % 2 === 0 ? 'zoom_in' : 'pan_right',
      });
    });
  }

  return parsed;
}

export default function App() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceTab>('trends');
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  // Persistent state synchronized with local disk (`data/db.json` + `/media/*`)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [channels, setChannels] = useState<SocialChannel[]>(DEFAULT_CHANNELS);
  const [activeChannelId, setActiveChannelId] = useState<string>(
    DEFAULT_CHANNELS[0]?.id || 'channel-tech-ai'
  );
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const activeChannel =
    channels.find((c) => c.id === activeChannelId) || channels[0] || DEFAULT_CHANNELS[0];

  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [showProjectsDrawer, setShowProjectsDrawer] = useState(false);

  // Active Studio State
  const [prompt, setPrompt] = useState<string>(
    'Cómo automatizar videos virales para YouTube, TikTok y Facebook usando IA local'
  );
  const [sourceTrendTitle, setSourceTrendTitle] = useState<string | undefined>(undefined);
  const [state, setState] = useState<VideoState>({
    step: 1,
    videoType: 'short',
    genre: 'educational',
    subgenre: 'Tendencia IA',
    duration: '60s',
    script: '',
    style: 'cinematic',
    visualMode: 'hybrid',
    visualSeed: 424242,
    aspectRatio: '9:16',
    language: 'es',
    voice: 'es-MX-DaliaNeural',
    music: 'cyber-pulse',
    voiceSpeed: 1.08,
    musicVolume: 0.22,
    duckingEnabled: true,
    subtitleStyle: 'hormozi',
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
  const [isGeneratingAllImages, setIsGeneratingAllImages] = useState(false);
  const [isGeneratingSubtitles, setIsGeneratingSubtitles] = useState(false);
  const [isRenderingVideo, setIsRenderingVideo] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [isGeneratingMarketing, setIsGeneratingMarketing] = useState(false);
  const [initialImageSource, setInitialImageSource] = useState<VisualInitialSource>('local');
  const [scheduleDateTime, setScheduleDateTime] = useState<string>(() => {
    const tomorrow = new Date(Date.now() + 86400000);
    return tomorrow.toISOString().slice(0, 16);
  });
  const [selectedPublishPlatforms, setSelectedPublishPlatforms] = useState<SocialPlatformId[]>(
    activeChannel.platforms
  );

  // Bootstrap from server disk storage on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const boot = await fetchBootstrap();
        if (!mounted) return;
        setSettings(boot.settings);
        setSystemStatus(boot.systemStatus);
        setChannels(boot.channels);
        if (boot.channels[0]) {
          setActiveChannelId(boot.channels[0].id);
          setSelectedPublishPlatforms(boot.channels[0].platforms);
        }
        setProjects(boot.projects);
        setScheduledPosts(boot.scheduledPosts);
        setTrends(boot.trends);
      } catch (err: any) {
        if (mounted) {
          setStatusMessage({
            type: 'error',
            text: err.message || 'No se pudo cargar la base de datos local del servidor.',
          });
        }
      } finally {
        if (mounted) setIsBootstrapping(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Handlers for disk persistence
  const handleSaveChannels = async (nextChannels: SocialChannel[]) => {
    setChannels(nextChannels);
    try {
      const saved = await saveChannelsToDisk(nextChannels);
      setChannels(saved);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error guardando canales.' });
    }
  };

  const handleUpdateScheduledPosts = async (nextPosts: ScheduledPost[]) => {
    setScheduledPosts(nextPosts);
    try {
      await saveScheduledPostsToDisk(nextPosts);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error guardando calendario.' });
    }
  };

  const handleUpdateTrends = async (nextTrends: TrendItem[]) => {
    setTrends(nextTrends);
    try {
      await saveTrendsToDisk(nextTrends);
    } catch {}
  };

  const handleTogglePublishMode = async (mode: PublishAutoMode) => {
    if (settings.publishAutoMode === mode) return;
    const optimistic = { ...settings, publishAutoMode: mode };
    setSettings(optimistic);
    try {
      const saved = await saveAppSettings({ publishAutoMode: mode });
      setSettings(saved);
      setStatusMessage({
        type: 'success',
        text:
          mode === 'auto_publish'
            ? 'Interruptor activo: Publicación Directa Automática al finalizar.'
            : 'Interruptor activo: Modo 1-Clic con Vista Previa antes de publicar.',
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error al cambiar el modo.' });
    }
  };

  const saveCurrentProjectSnapshot = async (
    nextState: VideoState = state,
    nextScenes: Scene[] = scenes,
    nextPrompt: string = prompt
  ): Promise<string> => {
    const id = currentProjectId || `proj-${Date.now()}`;
    if (!currentProjectId) setCurrentProjectId(id);

    const existing = projects.find((p) => p.id === id);
    const projectObj: Project = {
      id,
      name:
        nextState.metadata?.title ||
        sourceTrendTitle ||
        nextPrompt.slice(0, 48) ||
        'Proyecto Sin Título',
      channelId: activeChannel.id,
      sourceTrendTitle,
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now(),
      state: nextState,
      scenes: nextScenes,
      prompt: nextPrompt,
    };

    try {
      const normalized = await saveProjectToDisk(projectObj);
      setState(normalized.state);
      setScenes(normalized.scenes);
      setProjects((prev) => {
        const has = prev.some((p) => p.id === id);
        return has
          ? prev.map((p) => (p.id === id ? normalized : p))
          : [normalized, ...prev];
      });
    } catch {
      setProjects((prev) => {
        const has = prev.some((p) => p.id === id);
        return has
          ? prev.map((p) => (p.id === id ? projectObj : p))
          : [projectObj, ...prev];
      });
    }
    return id;
  };

  const handleDeleteProject = async (id: string) => {
    setProjects((prev) => prev.filter((item) => item.id !== id));
    if (currentProjectId === id) setCurrentProjectId(null);
    try {
      await deleteProjectFromDisk(id);
    } catch {}
  };

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
      text: `Redactando guion viral con ${settings.primaryProvider.toUpperCase()} basado en "${trend.title}"...`,
    });
    try {
      const res = await generateScript(
        newPrompt,
        nextState.genre,
        nextState.subgenre,
        nextState.duration,
        nextState.language,
        chosenRatio,
        activeChannel.tone,
        `${trend.whyTrending} (${trend.summary})`
      );
      const parsedScenes =
        res.scenes && res.scenes.length > 0 ? res.scenes : parseScriptIntoScenes(res.script);
      const updatedState = { ...nextState, script: res.script };
      setState(updatedState);
      setScenes(parsedScenes);
      await saveCurrentProjectSnapshot(updatedState, parsedScenes, newPrompt);
      setStatusMessage({
        type: 'success',
        text: `Guion estructurado en JSON con ${parsedScenes.length} escenas (${res.providerUsed || settings.primaryProvider} • ${res.modelUsed || ''}).`,
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
    setStatusMessage({
      type: 'info',
      text: `Generando guion viral con ${settings.primaryProvider.toUpperCase()} (${
        settings.primaryProvider === 'ollama' ? settings.ollamaModel : ''
      })...`,
    });
    try {
      const res = await generateScript(
        prompt,
        state.genre,
        state.subgenre,
        state.duration,
        state.language,
        state.aspectRatio,
        activeChannel.tone
      );
      const parsedScenes =
        res.scenes && res.scenes.length > 0 ? res.scenes : parseScriptIntoScenes(res.script);
      const nextState = { ...state, script: res.script };
      setState(nextState);
      setScenes(parsedScenes);
      await saveCurrentProjectSnapshot(nextState, parsedScenes, prompt);
      setStatusMessage({
        type: 'success',
        text: `¡Guion estructurado listo (${parsedScenes.length} escenas con prompt visual + keywords B-Roll) vía ${res.providerUsed || settings.primaryProvider} (${res.modelUsed || ''})!`,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'No se pudo generar el guion.' });
    } finally {
      setIsGeneratingScript(false);
    }
  };

  // Step 2: Generate Per-Scene Neural Voiceover + FFprobe Durations + Word Timestamps + Ducked Mix
  const handleGenerateVoiceover = async () => {
    const activeScenes =
      scenes.length > 0 ? scenes : parseScriptIntoScenes(state.script);

    if (activeScenes.length === 0 && !state.script.trim()) {
      setStatusMessage({
        type: 'error',
        text: 'Primero genera o escribe un guion en el Paso 1.',
      });
      return;
    }

    setIsGeneratingVoice(true);
    setStatusMessage({
      type: 'info',
      text: `Sintetizando voz neural local escena por escena (${activeScenes.length} escenas • ${state.voice}) y midiendo tiempos exactos con FFprobe...`,
    });

    try {
      const speed = state.voiceSpeed || 1.08;
      if (activeScenes.length > 0) {
        const res = await generateScenesVoiceover({
          scenes: activeScenes,
          voice: state.voice,
          language: state.language,
          speed,
        });

        let musicUrl = state.musicAudioUrl;
        if (!musicUrl) {
          const track = await generateStudioMusicOnServer(
            state.music,
            Math.max(24, Math.ceil(res.totalDurationSec + 6))
          );
          musicUrl = track.audioDataUrl;
        }

        let mixedAudioUrl = res.voiceAudioUrl;
        if (musicUrl) {
          const mix = await mixStudioAudioWithDucking({
            voiceAudioUrl: res.voiceAudioUrl,
            musicAudioUrl: musicUrl,
            musicVolume: state.musicVolume ?? 0.22,
            duckingEnabled: state.duckingEnabled !== false,
          });
          mixedAudioUrl = mix.mixedAudioUrl;
        }

        const nextState: VideoState = {
          ...state,
          voiceAudioUrl: res.voiceAudioUrl,
          musicAudioUrl: musicUrl,
          mixedAudioUrl,
          totalDurationSec: res.totalDurationSec,
          subtitles: res.subtitlesSrt,
        };
        setScenes(res.scenes);
        setState(nextState);
        await saveCurrentProjectSnapshot(nextState, res.scenes, prompt);
        setStatusMessage({
          type: 'success',
          text: `¡Locución neural lista (${res.voiceUsed} • ${res.totalDurationSec.toFixed(
            1
          )}s reales)! Subtítulos y mezcla con Audio Ducking sincronizados.`,
        });
      } else {
        const audioUrl = await generateSpeech(state.script, state.voice, state.language, speed);
        const nextState = { ...state, voiceAudioUrl: audioUrl };
        setState(nextState);
        await saveCurrentProjectSnapshot(nextState, scenes, prompt);
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'No se pudo generar el audio de voz.',
      });
    } finally {
      setIsGeneratingVoice(false);
    }
  };

  const handleRegenerateSceneVoice = async (index: number) => {
    const target = scenes[index];
    if (!target || !target.dialogue.trim()) return;

    setScenes((prev) =>
      prev.map((s, i) => (i === index ? { ...s, isGeneratingVoice: true } : s))
    );

    try {
      const clip = await generateSpeechClip({
        text: target.dialogue,
        voice: state.voice,
        language: state.language,
        speed: state.voiceSpeed || 1.08,
        filenamePrefix: `scene${index + 1}`,
      });

      const partialScenes = scenes.map((s, i) =>
        i === index
          ? {
              ...s,
              voiceAudioUrl: clip.audioDataUrl,
              durationSec: clip.durationSec,
              wordTimings: clip.wordTimings,
              isGeneratingVoice: false,
            }
          : s
      );

      const rebuilt = await rebuildMasterVoiceTrack(partialScenes);
      let mixedAudioUrl = rebuilt.voiceAudioUrl;
      if (state.musicAudioUrl) {
        const mix = await mixStudioAudioWithDucking({
          voiceAudioUrl: rebuilt.voiceAudioUrl,
          musicAudioUrl: state.musicAudioUrl,
          musicVolume: state.musicVolume ?? 0.22,
          duckingEnabled: state.duckingEnabled !== false,
        });
        mixedAudioUrl = mix.mixedAudioUrl;
      }

      const nextState: VideoState = {
        ...state,
        voiceAudioUrl: rebuilt.voiceAudioUrl,
        mixedAudioUrl,
        totalDurationSec: rebuilt.totalDurationSec,
        subtitles: rebuilt.subtitlesSrt,
      };
      setScenes(rebuilt.scenes);
      setState(nextState);
      await saveCurrentProjectSnapshot(nextState, rebuilt.scenes, prompt);
      setStatusMessage({
        type: 'success',
        text: `Escena #${index + 1} actualizada (${clip.durationSec.toFixed(
          2
        )}s) y pista maestra + subtítulos resincronizados.`,
      });
    } catch (err: any) {
      setScenes((prev) =>
        prev.map((s, i) => (i === index ? { ...s, isGeneratingVoice: false } : s))
      );
      setStatusMessage({
        type: 'error',
        text: err.message || `Error al regenerar voz de la escena #${index + 1}.`,
      });
    }
  };

  const handleSelectStudioMusic = async (presetId: string) => {
    setIsGeneratingMusic(true);
    try {
      const targetDur = Math.max(28, Math.ceil((state.totalDurationSec || 30) + 6));
      let savedMusicUrl: string;
      try {
        const serverTrack = await generateStudioMusicOnServer(presetId, targetDur);
        savedMusicUrl = serverTrack.audioDataUrl;
      } catch {
        const wavDataUrl = await synthesizeStudioMusicTrack(presetId, 24);
        savedMusicUrl = await uploadBlobUrlToDisk(wavDataUrl, 'audio', `music_${presetId}`);
      }

      let mixedAudioUrl = state.mixedAudioUrl;
      if (state.voiceAudioUrl) {
        const mix = await mixStudioAudioWithDucking({
          voiceAudioUrl: state.voiceAudioUrl,
          musicAudioUrl: savedMusicUrl,
          musicVolume: state.musicVolume ?? 0.22,
          duckingEnabled: state.duckingEnabled !== false,
        });
        mixedAudioUrl = mix.mixedAudioUrl;
      }

      const nextState: VideoState = {
        ...state,
        music: presetId,
        musicAudioUrl: savedMusicUrl,
        mixedAudioUrl,
      };
      setState(nextState);
      await saveCurrentProjectSnapshot(nextState, scenes, prompt);
      setStatusMessage({
        type: 'success',
        text: state.voiceAudioUrl
          ? 'Pista estéreo generada y mezclada con Audio Ducking automático.'
          : 'Pista musical estéreo libre de derechos guardada en disco.',
      });
    } catch {
      setStatusMessage({ type: 'error', text: 'Error al sintetizar pista musical.' });
    } finally {
      setIsGeneratingMusic(false);
    }
  };

  const handleGenerateLyriaMusic = async () => {
    await handleSelectStudioMusic(state.music);
  };

  const handleRefreshAudioMix = async (
    nextMusicVolume: number,
    nextDuckingEnabled: boolean
  ) => {
    const updatedBase: VideoState = {
      ...state,
      musicVolume: nextMusicVolume,
      duckingEnabled: nextDuckingEnabled,
    };
    setState(updatedBase);

    if (!state.voiceAudioUrl || !state.musicAudioUrl) return;
    setIsGeneratingMusic(true);
    try {
      const mix = await mixStudioAudioWithDucking({
        voiceAudioUrl: state.voiceAudioUrl,
        musicAudioUrl: state.musicAudioUrl,
        musicVolume: nextMusicVolume,
        duckingEnabled: nextDuckingEnabled,
      });
      const finalState: VideoState = {
        ...updatedBase,
        mixedAudioUrl: mix.mixedAudioUrl,
      };
      setState(finalState);
      await saveCurrentProjectSnapshot(finalState, scenes, prompt);
      setStatusMessage({
        type: 'success',
        text: nextDuckingEnabled
          ? 'Mezcla actualizada con Audio Ducking (FFmpeg sidechaincompress).'
          : 'Mezcla actualizada con volumen musical fijo.',
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'No se pudo actualizar la mezcla de audio.',
      });
    } finally {
      setIsGeneratingMusic(false);
    }
  };

  // Step 3: Scene Initial Images (Local GPU RTX 5090 / Gemini Image API / Pixabay Stock HD)
  const handleGenerateSingleSceneImage = async (
    index: number,
    source?: VisualInitialSource
  ) => {
    const targetScene = scenes[index];
    if (!targetScene) return;
    const sourceToUse = source || initialImageSource;

    setScenes((prev) =>
      prev.map((s, idx) => (idx === index ? { ...s, isGeneratingImage: true } : s))
    );
    setStatusMessage({
      type: 'info',
      text: `Escena #${index + 1}: Obteniendo imagen inicial con ${sourceToUse.toUpperCase()} (${state.style})...`,
    });

    try {
      const baseSeed = state.visualSeed || 424242;
      const res = await generateSceneInitialImage({
        sceneIndex: index,
        prompt:
          targetScene.imagePrompt || `${targetScene.title}. ${(targetScene.dialogue || '').slice(0, 90)}`,
        style: state.style,
        aspectRatio: state.aspectRatio,
        engineSource: sourceToUse,
        stockKeywords: targetScene.stockKeywords,
        seed: baseSeed + index * 19,
      });

      const updated = scenes.map((s, idx) =>
        idx === index
          ? {
              ...s,
              imageUrl: res.imageUrl,
              videoClipUrl: undefined,
              animatedUrl: undefined,
              visualSource: 'ai_image' as const,
              visualProvider: res.provider,
              isGeneratingImage: false,
            }
          : s
      );
      setScenes(updated);
      await saveCurrentProjectSnapshot(state, updated, prompt);
      setStatusMessage({
        type: 'success',
        text: `Escena #${index + 1}: Imagen inicial generada con ${res.provider}.`,
      });
    } catch (err: any) {
      setScenes((prev) =>
        prev.map((s, idx) => (idx === index ? { ...s, isGeneratingImage: false } : s))
      );
      setStatusMessage({
        type: 'error',
        text: err.message || `Error al obtener imagen inicial de la escena #${index + 1}.`,
      });
    }
  };

  const handleAcquireSceneStockVideo = async (index: number) => {
    const targetScene = scenes[index];
    if (!targetScene) return;

    setScenes((prev) =>
      prev.map((s, idx) => (idx === index ? { ...s, isGeneratingImage: true } : s))
    );
    try {
      const broll = await acquireSceneStockBrollOnServer(targetScene, state.aspectRatio);
      const updated = scenes.map((s, idx) =>
        idx === index
          ? {
              ...s,
              videoClipUrl: broll.videoClipUrl,
              animatedUrl: broll.videoClipUrl,
              imageUrl: broll.posterImageUrl,
              visualSource: 'stock_video' as const,
              visualProvider: broll.provider,
              isGeneratingImage: false,
            }
          : s
      );
      setScenes(updated);
      await saveCurrentProjectSnapshot(state, updated, prompt);
      setStatusMessage({
        type: 'success',
        text: `Escena #${index + 1}: Video B-Roll HD descargado y normalizado en MP4 (${broll.provider}).`,
      });
    } catch (err: any) {
      setScenes((prev) =>
        prev.map((s, idx) => (idx === index ? { ...s, isGeneratingImage: false } : s))
      );
      setStatusMessage({
        type: 'error',
        text: err.message || `No se encontró clip B-Roll automático para la escena #${index + 1}.`,
      });
    }
  };

  const handleSelectStockCandidate = async (index: number, candidate: StockVideoCandidate) => {
    const targetScene = scenes[index];
    if (!targetScene) return;

    setScenes((prev) =>
      prev.map((s, idx) => (idx === index ? { ...s, isGeneratingImage: true } : s))
    );
    try {
      const clip = await downloadStockVideoClipOnServer({
        downloadUrl: candidate.downloadUrl,
        provider: `${candidate.provider}-stock`,
        aspectRatio: state.aspectRatio,
        targetDurationSec: Math.max(4, Math.ceil((targetScene.durationSec || 5) + 1.5)),
      });
      const updated = scenes.map((s, idx) =>
        idx === index
          ? {
              ...s,
              videoClipUrl: clip.videoClipUrl,
              animatedUrl: clip.videoClipUrl,
              imageUrl: clip.posterImageUrl,
              visualSource: 'stock_video' as const,
              visualProvider: clip.provider,
              isGeneratingImage: false,
            }
          : s
      );
      setScenes(updated);
      await saveCurrentProjectSnapshot(state, updated, prompt);
      setStatusMessage({
        type: 'success',
        text: `Escena #${index + 1}: Clip "${candidate.title}" recortado a ${state.aspectRatio} y guardado en disco.`,
      });
    } catch (err: any) {
      setScenes((prev) =>
        prev.map((s, idx) => (idx === index ? { ...s, isGeneratingImage: false } : s))
      );
      setStatusMessage({
        type: 'error',
        text: err.message || 'Error al descargar el clip seleccionado.',
      });
    }
  };

  const handleGenerateAllSceneImages = async (source?: VisualInitialSource) => {
    if (scenes.length === 0) return;
    const sourceToUse = source || initialImageSource;

    setIsGeneratingAllImages(true);
    setStatusMessage({
      type: 'info',
      text: `Generando imágenes iniciales con ${sourceToUse.toUpperCase()} (${state.style} • ${state.aspectRatio}) para ${scenes.length} escenas...`,
    });

    try {
      const batchRes = await generateBatchInitialImages({
        scenes,
        style: state.style,
        aspectRatio: state.aspectRatio,
        engineSource: sourceToUse,
        visualSeed: state.visualSeed,
      });

      setScenes(batchRes.scenes);
      await saveCurrentProjectSnapshot(state, batchRes.scenes, prompt);

      setStatusMessage({
        type: 'success',
        text: `¡${batchRes.scenes.length} imágenes iniciales generadas exitosamente con ${sourceToUse.toUpperCase()}!`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Error durante la generación de imágenes iniciales en lote.',
      });
    } finally {
      setIsGeneratingAllImages(false);
    }
  };

  // Step 4: Animate Scene (Synchronized to exact scene audio duration)
  const handleAnimateSceneAI = async (index: number, engine?: LocalVideoEngineId) => {
    const scene = scenes[index];
    if (!scene) return;
    const engineToUse: LocalVideoEngineId = engine || 'wan_comfyui';
    const durationLabel = scene.durationSec ? `${scene.durationSec.toFixed(1)}s` : '4.0s';

    setScenes((prev) => prev.map((s, i) => (i === index ? { ...s, isAnimating: true } : s)));
    setStatusMessage({
      type: 'info',
      text: `Escena #${index + 1}: Animando con ${
        engineToUse === 'wan_comfyui' ? 'Wan 2.1 (ComfyUI)' : 'LTX 2.3'
      } sincronizado a ${durationLabel}...`,
    });

    try {
      const clip = await generateSceneLocalVideoClip({
        scene,
        aspectRatio: state.aspectRatio,
        engine: engineToUse,
        style: state.style,
        targetDurationSec: scene.durationSec,
      });

      const next = scenes.map((s, i) =>
        i === index
          ? {
              ...s,
              videoClipUrl: clip.videoClipUrl,
              animatedUrl: clip.videoClipUrl,
              imageUrl: clip.posterImageUrl || s.imageUrl,
              visualSource:
                engineToUse === 'wan_comfyui'
                  ? ('local_wan_video' as const)
                  : ('local_ltx_video' as const),
              visualProvider: clip.provider,
              durationSec: clip.durationSec,
              isAnimating: false,
            }
          : s
      );
      setScenes(next);
      await saveCurrentProjectSnapshot(state, next, prompt);
      setStatusMessage({
        type: 'success',
        text: `Escena #${index + 1}: Video animado generado (${clip.durationSec.toFixed(1)}s) y sincronizado con el audio.`,
      });
    } catch (err: any) {
      setScenes((prev) => prev.map((s, i) => (i === index ? { ...s, isAnimating: false } : s)));
      setStatusMessage({
        type: 'error',
        text: err.message || 'Error al animar la escena con IA local.',
      });
    }
  };

  // Step 5: Subtitles (Synced to real FFprobe scene audio durations when available)
  const handleGenerateSubtitles = async () => {
    setIsGeneratingSubtitles(true);
    setStatusMessage({
      type: 'info',
      text: 'Sincronizando bloques dinámicos de subtítulos (.SRT) con tiempos reales de voz...',
    });
    try {
      const srt = await generateSubtitles(state.script || prompt, state.duration, scenes);
      const nextState = { ...state, subtitles: srt };
      setState(nextState);
      await saveCurrentProjectSnapshot(nextState, scenes, prompt);
      setStatusMessage({
        type: 'success',
        text: 'Subtítulos dinámicos sincronizados al milisegundo y guardados en el proyecto.',
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error al generar subtítulos.' });
    } finally {
      setIsGeneratingSubtitles(false);
    }
  };

  // Step 6: Master Render in Server with FFmpeg (MP4 1080p + .ASS Subtitles + Audio Ducking)
  const handleRenderFinalVideo = async () => {
    if (scenes.length === 0) {
      setStatusMessage({
        type: 'error',
        text: 'Asegúrate de tener escenas generadas antes de renderizar el video.',
      });
      return;
    }

    setIsRenderingVideo(true);
    setRenderProgress(10);
    setStatusMessage({
      type: 'info',
      text: 'Compilando video master en servidor con FFmpeg (MP4 1080p + Subtítulos .ASS + Ducking)...',
    });

    try {
      let musicUrl = state.musicAudioUrl;
      if (!musicUrl) {
        const wavDataUrl = await synthesizeStudioMusicTrack(state.music, 24);
        musicUrl = await uploadBlobUrlToDisk(wavDataUrl, 'audio', `music_${state.music}`);
      }

      setRenderProgress(30);

      // Server-side master render with GPU hardware acceleration
      try {
        const masterResult = await renderMasterVideoOnServer({
          scenes,
          aspectRatio: state.aspectRatio,
          voiceAudioUrl: state.voiceAudioUrl,
          musicAudioUrl: musicUrl,
          mixedAudioUrl: state.mixedAudioUrl,
          subtitleStyle: state.subtitleStyle || 'hormozi',
          subtitlesEnabled: true,
          channelWatermark: activeChannel.handle,
        });

        setRenderProgress(100);

        const nextState = {
          ...state,
          renderedVideoUrl: masterResult.videoUrl || '',
          musicAudioUrl: musicUrl,
        };
        setState(nextState);
        await saveCurrentProjectSnapshot(nextState, scenes, prompt);
        setStatusMessage({
          type: 'success',
          text: `¡Video master 1080p compilado y guardado en disco! (${masterResult.videoUrl}, ${masterResult.fileSizeMb || 0} MB)`,
        });
        return;
      } catch (serverErr: any) {
        console.warn('Master server render falló, probando fallback en navegador:', serverErr.message);
      }

      // Browser canvas fallback if server ffmpeg has an issue
      setRenderProgress(50);
      const blobVideoUrl = await renderRealVideoInBrowser({
        scenes,
        aspectRatio: state.aspectRatio,
        voiceAudioUrl: state.voiceAudioUrl,
        musicAudioUrl: musicUrl,
        mixedAudioUrl: state.mixedAudioUrl,
        subtitleStyle: state.subtitleStyle || 'hormozi',
        channelWatermark: activeChannel.handle,
        onProgress: (pct) => setRenderProgress(pct),
      });

      const persistentVideoUrl = await uploadBlobUrlToDisk(
        blobVideoUrl,
        'videos',
        `render_${activeChannel.handle.replace('@', '')}`
      );

      const nextState = {
        ...state,
        renderedVideoUrl: persistentVideoUrl,
        musicAudioUrl: musicUrl,
      };
      setState(nextState);
      await saveCurrentProjectSnapshot(nextState, scenes, prompt);
      setStatusMessage({
        type: 'success',
        text: '¡Video compilado y guardado en disco! No se perderá aunque cierres el navegador.',
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

  // Step 7: Marketing Copy & Thumbnail
  const handleGenerateMarketingPackage = async () => {
    setIsGeneratingMarketing(true);
    setStatusMessage({
      type: 'info',
      text: 'Generando SEO, miniatura y textos para YouTube, TikTok y Facebook...',
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
          true
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
      await saveCurrentProjectSnapshot(nextState, scenes, prompt);
      setStatusMessage({
        type: 'success',
        text: 'Paquete multi-red (YouTube, TikTok y Facebook) y miniatura guardados en disco.',
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

  const handleScheduleOrPublish = async (publishImmediately: boolean) => {
    const projId = await saveCurrentProjectSnapshot(state, scenes, prompt);
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
          renderedVideoUrl: state.renderedVideoUrl,
          thumbnailUrl: newPost.thumbnailUrl,
          marketingMetadata: state.metadata,
        });
        newPost.webhookLog = `Enviado a Webhook (HTTP ${res.status})`;
      } catch (err: any) {
        newPost.status = 'failed';
        newPost.webhookLog = err.message;
      }
    }

    const updatedPosts = [newPost, ...scheduledPosts];
    await handleUpdateScheduledPosts(updatedPosts);
    setStatusMessage({
      type: 'success',
      text: publishImmediately
        ? 'Publicación despachada y registrada en el Centro de Publicación.'
        : 'Video programado exitosamente en el Calendario Editorial.',
    });
    setActiveWorkspace('calendar');
  };

  const activeEngineBadge =
    settings.primaryProvider === 'ollama'
      ? `Ollama • ${settings.ollamaModel}`
      : settings.primaryProvider === 'groq'
      ? `Groq • ${settings.groqModel}`
      : `Gemini • ${settings.geminiModel}`;

  return (
    <div className="min-h-screen bg-[#090A0F] text-zinc-100 flex flex-col">
      {/* Top Global Studio Navigation */}
      <header className="sticky top-0 z-30 bg-[#090A0F]/95 backdrop-blur-md border-b border-white/10 px-4 lg:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Brand Logo + Active Engine Indicator */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-600/30">
              <Film className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-white">ClipAI</span>
                <button
                  onClick={() => setActiveWorkspace('settings')}
                  title="Configurar Motor IA Local y Herramientas"
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1.5 hover:bg-emerald-500/25 cursor-pointer"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      settings.primaryProvider !== 'ollama' || systemStatus?.ollamaReachable
                        ? 'bg-emerald-400'
                        : 'bg-red-400'
                    }`}
                  />
                  {activeEngineBadge}
                </button>
              </div>
              <p className="text-[11px] text-zinc-400 hidden xl:block">
                Automatización YouTube • TikTok • Facebook ($0 Local)
              </p>
            </div>
          </div>

          {/* Primary Workspace Switcher */}
          <nav className="flex items-center gap-1 bg-[#11131C] p-1 rounded-xl border border-white/10 overflow-x-auto">
            <button
              onClick={() => setActiveWorkspace('trends')}
              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                activeWorkspace === 'trends'
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tendencias</span>
            </button>

            <button
              onClick={() => setActiveWorkspace('studio')}
              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                activeWorkspace === 'studio'
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Estudio</span>
            </button>

            <button
              onClick={() => setActiveWorkspace('calendar')}
              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                activeWorkspace === 'calendar'
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Calendario</span>
              {scheduledPosts.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] tabular-nums">
                  {scheduledPosts.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveWorkspace('channels')}
              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                activeWorkspace === 'channels'
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Canales ({channels.length})</span>
            </button>

            <button
              onClick={() => setActiveWorkspace('settings')}
              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                activeWorkspace === 'settings'
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-violet-300" />
              <span>Motores & IA</span>
            </button>
          </nav>

          {/* Right Controls: 1-Click Mode Switcher + Channel + Projects */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Persistent Switch: 1-Click Preview vs Direct Auto-Publish */}
            <div
              className="flex items-center bg-[#11131C] border border-white/10 rounded-xl p-1"
              title="Alternar entre Revisión en 1 Clic o Publicación Directa Automática"
            >
              <button
                onClick={() => handleTogglePublishMode('review_first')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  settings.publishAutoMode === 'review_first'
                    ? 'bg-violet-600 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Eye className="w-3 h-3" />
                <span>1-Clic</span>
              </button>
              <button
                onClick={() => handleTogglePublishMode('auto_publish')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  settings.publishAutoMode === 'auto_publish'
                    ? 'bg-emerald-600 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Send className="w-3 h-3" />
                <span>Directo</span>
              </button>
            </div>

            <div className="flex items-center gap-2 bg-[#11131C] border border-white/10 rounded-xl px-2.5 py-1.5">
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
              className="px-2.5 py-1.5 rounded-xl bg-[#11131C] hover:bg-zinc-800 border border-white/10 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 cursor-pointer"
            >
              <FolderOpen className="w-4 h-4 text-violet-400" />
              <span className="font-mono text-[11px] text-zinc-400 tabular-nums">
                ({projects.length})
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Saved Projects Drawer (Disk-Persisted) */}
      {showProjectsDrawer && (
        <div className="bg-[#11131C] border-b border-white/10 px-4 lg:px-8 py-4">
          <div className="max-w-7xl mx-auto space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                Proyectos Guardados en Disco Local ({projects.length})
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
              <p className="text-xs text-zinc-500 py-2">
                No hay proyectos guardados en disco todavía.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {projects.slice(0, 12).map((proj) => (
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
                      onClick={() => handleDeleteProject(proj.id)}
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
        {isBootstrapping ? (
          <div className="bg-[#11131C] border border-white/10 rounded-2xl p-12 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 text-violet-400 animate-spin" />
            <p className="text-sm font-semibold text-white">
              Inicializando ClipAI Studio y verificando herramientas locales (Ollama, FFmpeg, Edge-TTS)...
            </p>
          </div>
        ) : (
          <>
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

            {activeWorkspace === 'trends' && (
              <TrendRadarView
                activeChannel={activeChannel}
                trends={trends}
                onUpdateTrends={handleUpdateTrends}
                onCreateVideoFromTrend={handleCreateVideoFromTrend}
              />
            )}

            {activeWorkspace === 'channels' && (
              <ChannelsManagerView
                channels={channels}
                activeChannelId={activeChannel.id}
                onSelectChannel={setActiveChannelId}
                onSaveChannels={handleSaveChannels}
              />
            )}

            {activeWorkspace === 'calendar' && (
              <CalendarHubView
                channels={channels}
                activeChannel={activeChannel}
                projects={projects}
                scheduledPosts={scheduledPosts}
                onUpdateScheduledPosts={handleUpdateScheduledPosts}
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

            {activeWorkspace === 'studio' && (
              <StudioWizardView
                activeChannel={activeChannel}
                prompt={prompt}
                onChangePrompt={setPrompt}
                sourceTrendTitle={sourceTrendTitle}
                state={state}
                setState={setState}
                scenes={scenes}
                setScenes={setScenes}
                publishAutoMode={settings.publishAutoMode}
                isGeneratingScript={isGeneratingScript}
                isGeneratingVoice={isGeneratingVoice}
                isGeneratingMusic={isGeneratingMusic}
                isGeneratingAllImages={isGeneratingAllImages}
                isGeneratingSubtitles={isGeneratingSubtitles}
                isRenderingVideo={isRenderingVideo}
                renderProgress={renderProgress}
                isGeneratingMarketing={isGeneratingMarketing}
                selectedPublishPlatforms={selectedPublishPlatforms}
                setSelectedPublishPlatforms={setSelectedPublishPlatforms}
                scheduleDateTime={scheduleDateTime}
                setScheduleDateTime={setScheduleDateTime}
                onGenerateScript={handleGenerateScript}
                onGenerateVoiceover={handleGenerateVoiceover}
                onRegenerateSceneVoice={handleRegenerateSceneVoice}
                onSelectStudioMusic={handleSelectStudioMusic}
                onGenerateLyriaMusic={handleGenerateLyriaMusic}
                onRefreshAudioMix={handleRefreshAudioMix}
                onGenerateSingleSceneImage={handleGenerateSingleSceneImage}
                onAcquireSceneStockVideo={handleAcquireSceneStockVideo}
                onSelectStockCandidate={handleSelectStockCandidate}
                initialImageSource={initialImageSource}
                setInitialImageSource={setInitialImageSource}
                onGenerateAllSceneImages={handleGenerateAllSceneImages}
                onAnimateSceneAI={handleAnimateSceneAI}
                onGenerateSubtitles={handleGenerateSubtitles}
                onRenderFinalVideo={handleRenderFinalVideo}
                onGenerateMarketingPackage={handleGenerateMarketingPackage}
                onScheduleOrPublish={handleScheduleOrPublish}
              />
            )}

            {activeWorkspace === 'settings' && (
              <EngineSettingsView
                settings={settings}
                systemStatus={systemStatus}
                onUpdateSettings={setSettings}
                onUpdateSystemStatus={setSystemStatus}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
