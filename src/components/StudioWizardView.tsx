import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  Volume2,
  Image as ImageIcon,
  Film,
  Subtitles,
  Download,
  Share2,
  RefreshCw,
  Wand2,
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Music,
  Check,
  Copy,
  Pause,
  Play,
  Clock,
  Calendar,
  Send,
  Search,
  Video,
  Layers,
  Dices,
  Cpu,
  Power,
  Zap,
  Globe,
  Upload,
} from 'lucide-react';
import {
  AspectRatioType,
  CameraMotionType,
  DURATIONS,
  GENRES,
  LocalVideoClusterStatus,
  LocalVideoEngineId,
  PublishAutoMode,
  Scene,
  SOCIAL_PLATFORMS,
  SocialChannel,
  SocialPlatformId,
  StockVideoCandidate,
  STUDIO_MUSIC_PRESETS,
  SUBGENRES,
  SubtitleStyleType,
  VIDEO_STYLES,
  VideoState,
  VisualModeType,
  VOICES,
} from '../types';
import {
  drawSceneFrameOnCanvas,
} from '../services/videoRenderer';
import {
  fetchLocalVideoClusterStatus,
  generateSceneLocalVideoClip,
  previewVoiceSample,
  searchStockVideosOnServer,
  toggleLocalVideoEngine,
} from '../services/apiService';

const STUDIO_STEPS = [
  { num: 1, label: '1. Guion Viral', icon: Sparkles },
  { num: 2, label: '2. Voz & Música', icon: Volume2 },
  { num: 3, label: '3. Visuales', icon: ImageIcon },
  { num: 4, label: '4. Animación', icon: Film },
  { num: 5, label: '5. Subtítulos', icon: Subtitles },
  { num: 6, label: '6. Render & Exportar', icon: Download },
  { num: 7, label: '7. Publicar (YT/TT/FB)', icon: Share2 },
];

export interface StudioWizardViewProps {
  activeChannel: SocialChannel;
  prompt: string;
  onChangePrompt: (val: string) => void;
  sourceTrendTitle?: string;
  state: VideoState;
  setState: React.Dispatch<React.SetStateAction<VideoState>>;
  scenes: Scene[];
  setScenes: React.Dispatch<React.SetStateAction<Scene[]>>;
  publishAutoMode: PublishAutoMode;
  isGeneratingScript: boolean;
  isGeneratingVoice: boolean;
  isGeneratingMusic: boolean;
  isGeneratingAllImages: boolean;
  isGeneratingSubtitles: boolean;
  isRenderingVideo: boolean;
  renderProgress: number;
  isGeneratingMarketing: boolean;
  selectedPublishPlatforms: SocialPlatformId[];
  setSelectedPublishPlatforms: React.Dispatch<React.SetStateAction<SocialPlatformId[]>>;
  scheduleDateTime: string;
  setScheduleDateTime: (val: string) => void;
  onGenerateScript: () => void;
  onGenerateVoiceover: () => void;
  onRegenerateSceneVoice: (index: number) => void;
  onSelectStudioMusic: (presetId: string) => void;
  onGenerateLyriaMusic: () => void;
  onRefreshAudioMix: (musicVolume: number, duckingEnabled: boolean) => void;
  initialImageSource?: 'local' | 'gemini' | 'pixabay';
  setInitialImageSource?: (val: 'local' | 'gemini' | 'pixabay') => void;
  onGenerateSingleSceneImage: (index: number, source?: 'local' | 'gemini' | 'pixabay') => void;
  onAcquireSceneStockVideo: (index: number) => void;
  onSelectStockCandidate: (index: number, candidate: StockVideoCandidate) => void;
  onGenerateAllSceneImages: (source?: 'local' | 'gemini' | 'pixabay') => void;
  onAnimateSceneAI: (index: number, engine?: LocalVideoEngineId) => void;
  onGenerateSubtitles: () => void;
  onRenderFinalVideo: () => void;
  onGenerateMarketingPackage: () => void;
  onScheduleOrPublish: (publishImmediately: boolean) => void;
}

export const StudioWizardView: React.FC<StudioWizardViewProps> = ({
  activeChannel,
  prompt,
  onChangePrompt,
  sourceTrendTitle,
  state,
  setState,
  scenes,
  setScenes,
  publishAutoMode,
  isGeneratingScript,
  isGeneratingVoice,
  isGeneratingMusic,
  isGeneratingAllImages,
  isGeneratingSubtitles,
  isRenderingVideo,
  renderProgress,
  isGeneratingMarketing,
  selectedPublishPlatforms,
  setSelectedPublishPlatforms,
  scheduleDateTime,
  setScheduleDateTime,
  onGenerateScript,
  onGenerateVoiceover,
  onRegenerateSceneVoice,
  onSelectStudioMusic,
  onGenerateLyriaMusic,
  onRefreshAudioMix,
  initialImageSource,
  setInitialImageSource,
  onGenerateSingleSceneImage,
  onAcquireSceneStockVideo,
  onSelectStockCandidate,
  onGenerateAllSceneImages,
  onAnimateSceneAI,
  onGenerateSubtitles,
  onRenderFinalVideo,
  onGenerateMarketingPackage,
  onScheduleOrPublish,
}) => {
  const [internalInitialSource, setInternalInitialSource] = useState<'local' | 'gemini' | 'pixabay'>('local');
  const activeInitialSource = initialImageSource || internalInitialSource;
  const updateInitialSource = setInitialImageSource || setInternalInitialSource;

  const [animationMode, setAnimationMode] = useState<'camera_effects' | 'ai_local'>('camera_effects');

  const [selectedMarketingPlatform, setSelectedMarketingPlatform] =
    useState<SocialPlatformId>('youtube_shorts');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewSceneIndex, setPreviewSceneIndex] = useState(0);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Voice Preview Sample Playback State (Step 2)
  const [voiceEngineFilter, setVoiceEngineFilter] = useState<'all' | 'edge' | 'piper'>('all');
  const [loadingSampleVoiceId, setLoadingSampleVoiceId] = useState<string | null>(null);
  const [playingSampleVoiceId, setPlayingSampleVoiceId] = useState<string | null>(null);
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);
  const sampleReqSeqRef = useRef<number>(0);

  const stopVoiceSamplePlayback = () => {
    if (sampleAudioRef.current) {
      try {
        sampleAudioRef.current.pause();
        sampleAudioRef.current.currentTime = 0;
      } catch {}
      sampleAudioRef.current = null;
    }
    setPlayingSampleVoiceId(null);
  };

  const handleSelectAndPreviewVoice = async (voiceId: string) => {
    setState((prev) => ({ ...prev, voice: voiceId }));

    // If clicking the voice that is currently playing its sample, toggle pause/replay cleanly
    if (playingSampleVoiceId === voiceId && sampleAudioRef.current) {
      stopVoiceSamplePlayback();
      return;
    }

    stopVoiceSamplePlayback();
    const seq = ++sampleReqSeqRef.current;
    setLoadingSampleVoiceId(voiceId);

    try {
      const res = await previewVoiceSample(voiceId);
      if (sampleReqSeqRef.current !== seq) return;

      const audio = new Audio(res.sampleAudioUrl);
      sampleAudioRef.current = audio;
      setLoadingSampleVoiceId(null);
      setPlayingSampleVoiceId(voiceId);

      audio.onended = () => {
        if (sampleReqSeqRef.current === seq) {
          setPlayingSampleVoiceId(null);
        }
      };
      audio.onerror = () => {
        if (sampleReqSeqRef.current === seq) {
          setPlayingSampleVoiceId(null);
        }
      };

      await audio.play();
    } catch {
      if (sampleReqSeqRef.current === seq) {
        setLoadingSampleVoiceId(null);
        setPlayingSampleVoiceId(null);
      }
    }
  };

  useEffect(() => {
    if (state.step !== 2) {
      stopVoiceSamplePlayback();
    }
  }, [state.step]);

  // Local Video Cluster (ComfyUI Wan 2.1 & LTX 2.3) State (Step 3)
  const [clusterStatus, setClusterStatus] = useState<LocalVideoClusterStatus | null>(null);
  const [isRefreshingCluster, setIsRefreshingCluster] = useState(false);
  const [togglingEngine, setTogglingEngine] = useState<LocalVideoEngineId | null>(null);
  const [generatingLocalVideoIdx, setGeneratingLocalVideoIdx] = useState<number | null>(null);

  const refreshClusterStatus = async () => {
    setIsRefreshingCluster(true);
    try {
      const data = await fetchLocalVideoClusterStatus();
      setClusterStatus(data);
    } catch {
      // Offline fallback
    } finally {
      setIsRefreshingCluster(false);
    }
  };

  useEffect(() => {
    if (state.step === 3 || state.step === 4) {
      refreshClusterStatus();
      const interval = setInterval(refreshClusterStatus, 12000);
      return () => clearInterval(interval);
    }
  }, [state.step]);

  const handleToggleLocalEngine = async (engine: LocalVideoEngineId, action: 'start' | 'stop') => {
    setTogglingEngine(engine);
    try {
      const updated = await toggleLocalVideoEngine(engine, action);
      setClusterStatus(updated);
    } finally {
      setTogglingEngine(null);
    }
  };

  const handleGenerateSceneLocalVideo = async (index: number, engine: LocalVideoEngineId) => {
    const sc = scenes[index];
    if (!sc) return;
    setGeneratingLocalVideoIdx(index);
    setScenes((prev) =>
      prev.map((s, i) => (i === index ? { ...s, isGeneratingImage: true } : s))
    );
    try {
      const baseSeed = state.visualSeed || 424242;
      const res = await generateSceneLocalVideoClip({
        scene: sc,
        aspectRatio: state.aspectRatio,
        engine,
        style: state.style,
        seed: baseSeed + index * 29,
        targetDurationSec: sc.durationSec || 4,
      });
      setScenes((prev) =>
        prev.map((s, i) =>
          i === index
            ? {
                ...s,
                videoClipUrl: res.videoClipUrl,
                animatedUrl: res.videoClipUrl,
                imageUrl: res.posterImageUrl,
                visualSource:
                  engine === 'wan_comfyui' ? 'local_wan_video' : 'local_ltx_video',
                visualProvider: res.provider,
                isGeneratingImage: false,
              }
            : s
        )
      );
    } catch (err: any) {
      setScenes((prev) =>
        prev.map((s, i) => (i === index ? { ...s, isGeneratingImage: false } : s))
      );
      alert(err.message || 'Error al generar video local.');
    } finally {
      setGeneratingLocalVideoIdx(null);
    }
  };

  // Inline B-Roll Search Picker State (Step 3)
  const [openBrollSceneIdx, setOpenBrollSceneIdx] = useState<number | null>(null);
  const [brollSearchQuery, setBrollSearchQuery] = useState<string>('');
  const [brollCandidates, setBrollCandidates] = useState<StockVideoCandidate[]>([]);
  const [isSearchingBroll, setIsSearchingBroll] = useState<boolean>(false);

  const handleOpenBrollSearch = async (idx: number) => {
    if (openBrollSceneIdx === idx) {
      setOpenBrollSceneIdx(null);
      return;
    }
    const sc = scenes[idx];
    const defaultQuery =
      sc?.stockKeywords && sc.stockKeywords.length > 0
        ? sc.stockKeywords.slice(0, 2).join(' ')
        : sc?.title?.slice(0, 32) || 'technology';
    setOpenBrollSceneIdx(idx);
    setBrollSearchQuery(defaultQuery);
    setIsSearchingBroll(true);
    try {
      const res = await searchStockVideosOnServer(defaultQuery, state.aspectRatio);
      setBrollCandidates(res.candidates || []);
    } catch {
      setBrollCandidates([]);
    } finally {
      setIsSearchingBroll(false);
    }
  };

  const handleRunCustomBrollSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brollSearchQuery.trim()) return;
    setIsSearchingBroll(true);
    try {
      const res = await searchStockVideosOnServer(brollSearchQuery.trim(), state.aspectRatio);
      setBrollCandidates(res.candidates || []);
    } catch {
      setBrollCandidates([]);
    } finally {
      setIsSearchingBroll(false);
    }
  };

  const handleCopyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2000);
  };

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
    let vidEl: HTMLVideoElement | null = null;

    const clipSrc = currentScene.videoClipUrl || currentScene.animatedUrl;
    if (clipSrc) {
      const v = document.createElement('video');
      v.crossOrigin = 'anonymous';
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.src = clipSrc;
      v.onloadeddata = () => {
        vidEl = v;
        if (isPlayingPreview) v.play().catch(() => {});
      };
    }

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
        vidEl && vidEl.readyState >= 2 ? vidEl : imgEl,
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
      if (vidEl) {
        vidEl.pause();
        vidEl.removeAttribute('src');
      }
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

  return (
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
                Relación de Aspecto (YouTube, TikTok & Facebook)
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { id: '9:16', label: '9:16 Vertical', sub: 'YT Shorts / TikTok / FB' },
                  { id: '16:9', label: '16:9 Horizontal', sub: 'YouTube / FB Video' },
                  { id: '1:1', label: '1:1 Cuadrado', sub: 'Feed Social' },
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
                onChange={(e) => onChangePrompt(e.target.value)}
                placeholder="Describe la noticia, tendencia o tema sobre el que quieres generar el video..."
                className="w-full bg-[#090A0F] border border-white/10 rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-violet-500"
              />
            </div>

            <button
              onClick={onGenerateScript}
              disabled={isGeneratingScript}
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-violet-600/20"
            >
              {isGeneratingScript ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Estructurando Guion con Motor IA...
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
                  onClick={() =>
                    setScenes((prev) => [
                      ...prev,
                      {
                        title: `Escena ${prev.length + 1}: Plano cinematográfico detallado`,
                        dialogue: 'Nueva línea de narración para el video.',
                        cameraMotion: 'zoom_in',
                      },
                    ])
                  }
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
                    Haz clic en «Generar Guion con Estructura Viral» usando Ollama local o selecciona una tendencia desde el Radar.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                  {scenes.map((scene, idx) => (
                    <div
                      key={idx}
                      className="bg-[#090A0F] border border-white/10 rounded-xl p-4 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-mono font-bold text-violet-400 uppercase">
                            Escena #{idx + 1}
                          </span>
                          {idx === 0 && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              HOOK 0-3s
                            </span>
                          )}
                          {scene.cameraMotion && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-zinc-400">
                              {scene.cameraMotion}
                            </span>
                          )}
                          {typeof scene.durationSec === 'number' && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                              {scene.durationSec.toFixed(2)}s
                            </span>
                          )}
                        </div>
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
                        placeholder="Descripción visual en español"
                        className="w-full bg-[#11131C] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-zinc-200"
                      />
                      <div>
                        <span className="text-[10px] font-mono uppercase text-zinc-500 block mb-1">
                          Locución hablada (lista para voz neural):
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <div>
                          <span className="text-[10px] font-mono text-zinc-500 block mb-1">
                            Prompt IA (EN):
                          </span>
                          <input
                            type="text"
                            value={scene.imagePrompt || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setScenes((prev) =>
                                prev.map((s, i) =>
                                  i === idx ? { ...s, imagePrompt: val } : s
                                )
                              );
                            }}
                            placeholder="English visual prompt..."
                            className="w-full bg-[#11131C] border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-zinc-300 font-mono"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] font-mono text-zinc-500 block mb-1">
                            Keywords B-Roll (EN):
                          </span>
                          <input
                            type="text"
                            value={(scene.stockKeywords || []).join(', ')}
                            onChange={(e) => {
                              const kws = e.target.value
                                .split(',')
                                .map((k) => k.trim())
                                .filter(Boolean);
                              setScenes((prev) =>
                                prev.map((s, i) =>
                                  i === idx ? { ...s, stockKeywords: kws } : s
                                )
                              );
                            }}
                            placeholder="ai robot, server room..."
                            className="w-full bg-[#11131C] border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-emerald-300 font-mono"
                          />
                        </div>
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
                Siguiente: Voz & Música <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: VOZ NEURAL POR ESCENA & MÚSICA CON AUDIO DUCKING */}
      {state.step === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#11131C] border border-white/10 rounded-2xl p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-mono uppercase text-violet-400">
                  Microsoft Edge Neural Español + Piper ONNX Local • Muestra al Seleccionar
                </span>
                <h2 className="text-lg font-bold text-white mt-0.5">
                  Locución Neural por Escena ($0)
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Haz clic en cualquier voz para seleccionarla y escuchar su muestra al instante. Genera audio normalizado (-16 LUFS) y sincroniza cada palabra.
                </p>
              </div>
              {typeof state.totalDurationSec === 'number' && state.totalDurationSec > 0 && (
                <span className="shrink-0 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-xs font-bold">
                  {state.totalDurationSec.toFixed(1)}s reales
                </span>
              )}
            </div>

            {/* Filter Pills: Edge Español vs Piper Offline */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  {
                    id: 'all' as const,
                    label: `Todas (${VOICES.length})`,
                  },
                  {
                    id: 'edge' as const,
                    label: `Microsoft Edge Español (${VOICES.filter((v) => v.engine === 'edge').length})`,
                  },
                  {
                    id: 'piper' as const,
                    label: `Piper Offline PC (${VOICES.filter((v) => v.engine === 'piper').length})`,
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setVoiceEngineFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      voiceEngineFilter === tab.id
                        ? 'bg-violet-600 text-white shadow shadow-violet-600/30'
                        : 'bg-[#090A0F] border border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {playingSampleVoiceId && (
                <button
                  type="button"
                  onClick={stopVoiceSamplePlayback}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono flex items-center gap-1.5 cursor-pointer"
                >
                  <Pause className="w-3 h-3" /> Detener muestra
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[340px] overflow-y-auto pr-1">
              {VOICES.filter((v) =>
                voiceEngineFilter === 'all' ? true : v.engine === voiceEngineFilter
              ).map((v) => {
                const selected = state.voice === v.id;
                const isLoadingSample = loadingSampleVoiceId === v.id;
                const isPlayingSample = playingSampleVoiceId === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleSelectAndPreviewVoice(v.id)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      selected
                        ? 'bg-violet-600/20 border-violet-500 text-white ring-1 ring-violet-500/30'
                        : 'bg-[#090A0F] border-white/10 text-zinc-300 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs truncate">{v.name}</span>
                      <span className="shrink-0 flex items-center gap-1">
                        {isLoadingSample ? (
                          <span className="px-1.5 py-0.5 rounded bg-violet-500/25 text-violet-200 text-[10px] font-mono flex items-center gap-1">
                            <RefreshCw className="w-3 h-3 animate-spin" /> Muestra...
                          </span>
                        ) : isPlayingSample ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/25 text-emerald-300 text-[10px] font-mono flex items-center gap-1">
                            <Volume2 className="w-3 h-3 animate-pulse" /> Sonando
                          </span>
                        ) : selected ? (
                          <span className="px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 text-[10px] font-mono flex items-center gap-1">
                            <Play className="w-2.5 h-2.5" /> Escuchar
                          </span>
                        ) : (
                          <Volume2 className="w-3.5 h-3.5 text-zinc-500" />
                        )}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                          v.engine === 'edge'
                            ? 'bg-sky-500/15 text-sky-300 border border-sky-500/25'
                            : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                        }`}
                      >
                        {v.engine === 'edge' ? 'EDGE NEURAL' : 'LOCAL OFFLINE'}
                      </span>
                      {v.tags.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-zinc-400"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Narration Speed Control */}
            <div className="bg-[#090A0F] border border-white/10 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-zinc-200 block">
                  Ritmo de Locución Viral
                </span>
                <span className="text-[11px] text-zinc-400">
                  1.08x mantiene alta retención en Shorts, TikTok y Reels sin perder claridad.
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {[
                  { val: 1.0, label: '1.0x Natural' },
                  { val: 1.08, label: '1.08x Viral' },
                  { val: 1.16, label: '1.16x Rápido' },
                ].map((sp) => {
                  const active = Math.abs((state.voiceSpeed || 1.08) - sp.val) < 0.02;
                  return (
                    <button
                      key={sp.val}
                      onClick={() => setState((prev) => ({ ...prev, voiceSpeed: sp.val }))}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold cursor-pointer ${
                        active
                          ? 'bg-violet-600 text-white'
                          : 'bg-[#11131C] text-zinc-400 hover:text-white border border-white/10'
                      }`}
                    >
                      {sp.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={onGenerateVoiceover}
              disabled={isGeneratingVoice}
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-violet-600/20"
            >
              {isGeneratingVoice ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Sintetizando Escenas y Midiendo Tiempos con FFprobe...
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" />
                  Generar Voz Neural por Escena ({scenes.length || 1} escenas • {state.voice})
                </>
              )}
            </button>

            {state.voiceAudioUrl && (
              <div className="bg-[#090A0F] border border-emerald-500/30 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold">
                  <span>Pista Maestra de Voz Concatenada</span>
                  <a
                    href={state.voiceAudioUrl}
                    download="narracion_clipai.mp3"
                    className="underline hover:text-white"
                  >
                    Descargar MP3
                  </a>
                </div>
                <audio controls src={state.voiceAudioUrl} className="w-full h-9" />
              </div>
            )}

            {/* Per-Scene Audio Players & Individual Regeneration */}
            {scenes.length > 0 && (
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                <span className="text-[11px] font-mono uppercase text-zinc-400 block">
                  Clips Individuales y Timestamps por Escena:
                </span>
                {scenes.map((sc, idx) => (
                  <div
                    key={idx}
                    className="bg-[#090A0F] border border-white/10 rounded-xl p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-mono font-bold text-violet-400 shrink-0">
                          Escena #{idx + 1}
                        </span>
                        {typeof sc.durationSec === 'number' && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 shrink-0">
                            {sc.durationSec.toFixed(2)}s • {sc.wordTimings?.length || 0} palabras
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => onRegenerateSceneVoice(idx)}
                        disabled={sc.isGeneratingVoice || isGeneratingVoice}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-violet-600/30 text-[10px] font-semibold text-zinc-200 flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <RefreshCw
                          className={`w-3 h-3 ${sc.isGeneratingVoice ? 'animate-spin' : ''}`}
                        />
                        {sc.voiceAudioUrl ? 'Re-grabar' : 'Grabar'}
                      </button>
                    </div>
                    <p className="text-[11px] text-zinc-400 line-clamp-1">"{sc.dialogue}"</p>
                    {sc.voiceAudioUrl && (
                      <audio controls src={sc.voiceAudioUrl} className="w-full h-8" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[#11131C] border border-white/10 rounded-2xl p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div>
                <span className="text-xs font-mono uppercase text-emerald-400">
                  Música Estéreo Libre de Derechos + FFmpeg Audio Ducking
                </span>
                <h2 className="text-lg font-bold text-white mt-0.5">
                  Música de Fondo & Ducking Inteligente
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Sintetiza pistas instrumentales estéreo en MP3 y atenúa automáticamente la música cuando habla el narrador (<code className="text-zinc-200">sidechaincompress</code>).
                </p>
              </div>

              <div className="space-y-2">
                {STUDIO_MUSIC_PRESETS.map((track) => {
                  const active = state.music === track.id;
                  return (
                    <button
                      key={track.id}
                      onClick={() => onSelectStudioMusic(track.id)}
                      disabled={isGeneratingMusic}
                      className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        active
                          ? 'bg-emerald-500/15 border-emerald-500 text-white'
                          : 'bg-[#090A0F] border-white/10 text-zinc-300 hover:border-white/20'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold">{track.name}</div>
                        <div className="text-[11px] text-zinc-400">
                          {track.mood} • <span className="font-mono">{track.tempo} BPM</span>
                        </div>
                      </div>
                      <Music className="w-4 h-4 text-emerald-400 shrink-0" />
                    </button>
                  );
                })}
              </div>

              {/* Audio Ducking & Volume Controls */}
              <div className="bg-[#090A0F] border border-white/10 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-white block">
                      Audio Ducking Automático (Sidechain)
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      Reduce la música mientras suena la voz y sube suavemente en pausas.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nextDuck = state.duckingEnabled === false ? true : false;
                      onRefreshAudioMix(state.musicVolume ?? 0.22, nextDuck);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold cursor-pointer transition-all ${
                      state.duckingEnabled !== false
                        ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-300'
                        : 'bg-zinc-800 border border-white/10 text-zinc-400'
                    }`}
                  >
                    {state.duckingEnabled !== false ? 'ACTIVO' : 'APAGADO'}
                  </button>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">Volumen Base de Música</span>
                    <span className="font-mono text-emerald-300 font-bold">
                      {Math.round((state.musicVolume ?? 0.22) * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={8}
                      max={45}
                      step={2}
                      value={Math.round((state.musicVolume ?? 0.22) * 100)}
                      onChange={(e) => {
                        const vol = Number(e.target.value) / 100;
                        setState((prev) => ({ ...prev, musicVolume: vol }));
                      }}
                      className="flex-1 accent-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onRefreshAudioMix(
                          state.musicVolume ?? 0.22,
                          state.duckingEnabled !== false
                        )
                      }
                      disabled={isGeneratingMusic || !state.voiceAudioUrl}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-xs font-semibold text-white cursor-pointer"
                    >
                      Aplicar Mezcla
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={onGenerateLyriaMusic}
                disabled={isGeneratingMusic}
                className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-violet-400" />
                {isGeneratingMusic
                  ? 'Procesando Pista y Mezcla con FFmpeg...'
                  : 'Regenerar Pista Instrumental Estéreo'}
              </button>

              {state.mixedAudioUrl && (
                <div className="bg-[#090A0F] border border-violet-500/35 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-violet-300 font-bold">
                      Mezcla Final de Estudio (Voz + Música con Ducking):
                    </span>
                    <a
                      href={state.mixedAudioUrl}
                      download="mezcla_estudio_clipai.mp3"
                      className="text-violet-400 underline hover:text-white"
                    >
                      Descargar Mezcla
                    </a>
                  </div>
                  <audio controls src={state.mixedAudioUrl} className="w-full h-9" />
                </div>
              )}

              {state.musicAudioUrl && !state.mixedAudioUrl && (
                <div className="bg-[#090A0F] border border-white/10 rounded-xl p-3.5 space-y-2">
                  <span className="text-xs text-zinc-300 font-semibold block">
                    Previsualización de Pista Instrumental:
                  </span>
                  <audio controls src={state.musicAudioUrl} className="w-full h-9" />
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-white/10 flex justify-between">
              <button
                onClick={() => setState((prev) => ({ ...prev, step: 1 }))}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>
              <button
                onClick={() => setState((prev) => ({ ...prev, step: 3 }))}
                className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                Siguiente: Visuales <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: GENERACIÓN DE IMAGEN INICIAL (GPU LOCAL / GEMINI / PIXABAY) */}
      {state.step === 3 && (
        <div className="space-y-6">
          <div className="bg-[#11131C] border border-white/10 rounded-2xl p-6 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-mono uppercase text-violet-400">
                  Paso 3: Generación de Imagen Inicial ({state.aspectRatio}) • Coherencia de Estilo
                </span>
                <h2 className="text-lg font-bold text-white mt-0.5">
                  1. Fuente de Imagen Inicial y Dirección Artística
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Genera la imagen clave inicial para cada escena. Se adapta estrictamente al diálogo y al estilo visual seleccionado, lista para ser animada en el siguiente paso.
                </p>
              </div>

              <button
                onClick={() => onGenerateAllSceneImages(activeInitialSource)}
                disabled={isGeneratingAllImages || scenes.length === 0}
                className="px-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-violet-600/20 shrink-0"
              >
                {isGeneratingAllImages ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Generando {scenes.length} Imágenes Iniciales...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    ⚡ Generar Todas las Imágenes (
                    {activeInitialSource === 'local'
                      ? 'GPU Local'
                      : activeInitialSource === 'gemini'
                      ? 'Gemini API'
                      : 'Pixabay HD'}
                    )
                  </>
                )}
              </button>
            </div>

            {/* Selector de 3 Fuentes de Imagen Inicial */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: 'local' as const,
                  icon: Cpu,
                  name: 'GPU Local (RTX 5090 / Turbo)',
                  desc: 'Genera la imagen inicial en tu GPU local ($0 cuotas) con fallback de máxima velocidad.',
                  badge: 'LOCAL $0',
                },
                {
                  id: 'gemini' as const,
                  icon: Sparkles,
                  name: 'Google Gemini Image API',
                  desc: 'Genera imágenes artísticas de alta fidelidad vía Gemini 3.1 Flash / Imagen 3.',
                  badge: 'CLOUD IA',
                },
                {
                  id: 'pixabay' as const,
                  icon: Search,
                  name: 'Pixabay HD Stock',
                  desc: 'Descarga imágenes HD con licencia libre, filtradas por palabras clave y estilo (Foto vs Ilustración).',
                  badge: 'STOCK HD $0',
                },
              ].map((src) => {
                const Icon = src.icon;
                const active = activeInitialSource === src.id;
                return (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => updateInitialSource(src.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      active
                        ? 'bg-violet-600/20 border-violet-500 text-white ring-1 ring-violet-500/50'
                        : 'bg-[#090A0F] border-white/10 text-zinc-300 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold flex items-center gap-1.5">
                        <Icon className="w-4 h-4 text-violet-400 shrink-0" />
                        {src.name}
                      </span>
                      {active && <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />}
                    </div>
                    <span className="inline-block text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 mt-1">
                      {src.badge}
                    </span>
                    <p className="text-[11px] text-zinc-400 mt-1.5 leading-snug">{src.desc}</p>
                  </button>
                );
              })}
            </div>

            {/* Selector de Estilo Visual (12 Estilos) */}
            <div className="pt-2">
              <span className="text-xs font-mono uppercase text-zinc-400 block mb-2">
                Estilo Visual Coherente ({VIDEO_STYLES.length} estilos disponibles):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
                {VIDEO_STYLES.map((styleItem) => {
                  const isSelected = state.style === styleItem.id;
                  return (
                    <button
                      key={styleItem.id}
                      onClick={() => setState((prev) => ({ ...prev, style: styleItem.id }))}
                      className={`group rounded-xl overflow-hidden border text-left transition-all cursor-pointer bg-[#090A0F] ${
                        isSelected
                          ? 'border-violet-500 ring-2 ring-violet-500/40'
                          : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className="h-24 w-full overflow-hidden relative bg-zinc-900">
                        <img
                          src={styleItem.image}
                          alt={styleItem.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="p-2.5">
                        <div className="text-xs font-bold text-white truncate">
                          {styleItem.name}
                        </div>
                        <div className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">
                          {styleItem.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* TARJETAS DE ESCENAS (IMÁGENES INICIALES) */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {scenes.map((scene, idx) => (
              <div
                key={idx}
                className="bg-[#11131C] border border-white/10 rounded-2xl overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="aspect-video bg-[#090A0F] relative flex items-center justify-center overflow-hidden border-b border-white/10">
                    {scene.imageUrl ? (
                      <img
                        src={scene.imageUrl}
                        alt={scene.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center p-4 space-y-2">
                        <ImageIcon className="w-8 h-8 text-zinc-600 mx-auto" />
                        <span className="text-xs text-zinc-500 block">
                          Escena #{idx + 1}: Sin imagen inicial
                        </span>
                      </div>
                    )}
                    {scene.isGeneratingImage && (
                      <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2 px-4 text-center">
                        <RefreshCw className="w-6 h-6 text-violet-400 animate-spin" />
                        <span className="text-xs font-mono text-white">
                          Obteniendo imagen ({activeInitialSource.toUpperCase()})...
                        </span>
                      </div>
                    )}
                    <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-black/75 text-[10px] font-mono font-bold text-white">
                      Escena {idx + 1}
                    </span>
                    {scene.imageUrl && (
                      <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded bg-zinc-800 text-[10px] font-mono font-bold text-zinc-200">
                        {scene.visualProvider?.toUpperCase() || 'IMAGEN'}
                      </span>
                    )}
                  </div>

                  <div className="p-4 space-y-2">
                    <p className="text-xs font-semibold text-zinc-200 line-clamp-2">
                      {scene.title}
                    </p>
                    <p className="text-xs text-zinc-400 italic line-clamp-2">
                      "{scene.dialogue}"
                    </p>
                    {scene.stockKeywords && scene.stockKeywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {scene.stockKeywords.slice(0, 3).map((kw, kIdx) => (
                          <span
                            key={kIdx}
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-zinc-400"
                          >
                            #{kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 pt-0 space-y-2.5">
                  {/* Botón principal según la fuente activa */}
                  <button
                    type="button"
                    onClick={() => onGenerateSingleSceneImage(idx, activeInitialSource)}
                    disabled={scene.isGeneratingImage}
                    className="w-full py-2 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-violet-600/20"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    Obtener con{' '}
                    {activeInitialSource === 'local'
                      ? 'GPU Local'
                      : activeInitialSource === 'gemini'
                      ? 'Gemini API'
                      : 'Pixabay HD'}
                  </button>

                  {/* Acciones individuales alternativas */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => onGenerateSingleSceneImage(idx, 'local')}
                      disabled={scene.isGeneratingImage}
                      className="py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-40 text-zinc-300 hover:text-white text-[10px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer"
                    >
                      <Cpu className="w-3 h-3 text-emerald-400" /> GPU Local
                    </button>
                    <button
                      type="button"
                      onClick={() => onGenerateSingleSceneImage(idx, 'gemini')}
                      disabled={scene.isGeneratingImage}
                      className="py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-40 text-zinc-300 hover:text-white text-[10px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-violet-400" /> Gemini
                    </button>
                    <button
                      type="button"
                      onClick={() => onGenerateSingleSceneImage(idx, 'pixabay')}
                      disabled={scene.isGeneratingImage}
                      className="py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-40 text-zinc-300 hover:text-white text-[10px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer"
                    >
                      <Search className="w-3 h-3 text-sky-400" /> Pixabay
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setState((prev) => ({ ...prev, step: 2 }))}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
            <button
              onClick={() => setState((prev) => ({ ...prev, step: 4 }))}
              className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
            >
              Siguiente: Animación <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: ANIMACIÓN DE ESCENAS (SINCRONIZADA AL AUDIO) */}
      {state.step === 4 && (
        <div className="space-y-6">
          {/* CONTROL DE HARDWARE GPU LOCAL (RTX 5090 24GB) */}
          <div className="bg-[#11131C] border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-mono uppercase text-emerald-400 font-bold flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-violet-400" />
                  Hardware GPU Local: {clusterStatus?.gpuName || 'NVIDIA GeForce RTX 5090 Laptop GPU'}
                </span>
                <p className="text-xs text-zinc-400 mt-0.5">
                  VRAM Dedicada:{' '}
                  <strong className="text-white">
                    {clusterStatus?.vramFreeMb
                      ? `${Math.round(clusterStatus.vramFreeMb / 1024)} GB libres`
                      : '19.2 GB libres'}
                  </strong>{' '}
                  de{' '}
                  {clusterStatus?.vramTotalMb
                    ? `${Math.round(clusterStatus.vramTotalMb / 1024)} GB`
                    : '24 GB'}{' '}
                  totales. Todos los motores corren 100% en tu PC ($0 cuotas).
                </p>
              </div>

              <button
                type="button"
                onClick={refreshClusterStatus}
                disabled={isRefreshingCluster}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingCluster ? 'animate-spin' : ''}`} />
                Actualizar Estado
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* ComfyUI Card (Wan 2.1 14B) */}
              {(() => {
                const info = clusterStatus?.engines?.wan_comfyui;
                const isOnline = info?.status === 'online';
                const isStarting = info?.status === 'starting' || togglingEngine === 'wan_comfyui';
                return (
                  <div
                    className={`p-4 rounded-xl border transition-all ${
                      isOnline
                        ? 'bg-emerald-500/10 border-emerald-500/40'
                        : isStarting
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-[#090A0F] border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            isOnline
                              ? 'bg-emerald-400 animate-pulse'
                              : isStarting
                              ? 'bg-amber-400 animate-pulse'
                              : 'bg-zinc-600'
                          }`}
                        />
                        <span className="text-xs font-bold text-white">
                          ComfyUI • Wan 2.1 (14B Local)
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                          isOnline
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : isStarting
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {isOnline ? 'ONLINE (:8188)' : isStarting ? 'INICIANDO...' : 'OFFLINE'}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-2">
                      wan2.1_i2v_480p_14B (30.5 GB) + UMT5-XXL FP8 + Wan VAE en{' '}
                      <code className="text-zinc-300">C:\ComfyUI_windows_portable</code>.
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      {isOnline ? (
                        <button
                          type="button"
                          onClick={() => handleToggleLocalEngine('wan_comfyui', 'stop')}
                          disabled={togglingEngine === 'wan_comfyui'}
                          className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Power className="w-3.5 h-3.5" /> Detener ComfyUI (Liberar VRAM)
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleLocalEngine('wan_comfyui', 'start')}
                          disabled={togglingEngine === 'wan_comfyui'}
                          className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20"
                        >
                          <Zap className="w-3.5 h-3.5" />{' '}
                          {isStarting ? 'Iniciando ComfyUI...' : '⚡ Activar ComfyUI (Wan 2.1)'}
                        </button>
                      )}
                      <span className="text-[10px] font-mono text-zinc-500">
                        {info?.busy ? 'Procesando en GPU' : 'Listo'}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* LTX 2.3 Desktop Backend Card */}
              {(() => {
                const info = clusterStatus?.engines?.ltx_local;
                const isOnline = info?.status === 'online';
                const isStarting = info?.status === 'starting' || togglingEngine === 'ltx_local';
                return (
                  <div
                    className={`p-4 rounded-xl border transition-all ${
                      isOnline
                        ? 'bg-violet-500/10 border-violet-500/40'
                        : isStarting
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-[#090A0F] border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            isOnline
                              ? 'bg-violet-400 animate-pulse'
                              : isStarting
                              ? 'bg-amber-400 animate-pulse'
                              : 'bg-zinc-600'
                          }`}
                        />
                        <span className="text-xs font-bold text-white">
                          LTX 2.3 Local (22B Distilled Fast)
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                          isOnline
                            ? 'bg-violet-500/20 text-violet-300'
                            : isStarting
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {isOnline ? 'ONLINE (:41954)' : isStarting ? 'INICIANDO...' : 'OFFLINE'}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-2">
                      ltx-2.3-22b-distilled (43 GB) + Gemma-3 12B + SageAttention en{' '}
                      <code className="text-zinc-300">AppData\Local\LTXDesktop</code>.
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      {isOnline ? (
                        <button
                          type="button"
                          onClick={() => handleToggleLocalEngine('ltx_local', 'stop')}
                          disabled={togglingEngine === 'ltx_local'}
                          className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Power className="w-3.5 h-3.5" /> Detener LTX 2.3 (Liberar VRAM)
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleLocalEngine('ltx_local', 'start')}
                          disabled={togglingEngine === 'ltx_local'}
                          className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-violet-600/20"
                        >
                          <Zap className="w-3.5 h-3.5" />{' '}
                          {isStarting ? 'Iniciando LTX 2.3...' : '⚡ Activar LTX 2.3 Local'}
                        </button>
                      )}
                      <span className="text-[10px] font-mono text-zinc-500">
                        {info?.progressPhase || (info?.busy ? 'Generando video...' : 'Listo')}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* MODO DE ANIMACIÓN Y SINCRONIZACIÓN TEMPORAL */}
          <div className="bg-[#11131C] border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-mono uppercase text-violet-400">
                  Paso 4: Animación Sincronizada al Audio
                </span>
                <h2 className="text-lg font-bold text-white mt-0.5">
                  Modalidad de Animación de Escenas
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Cada animación dura exactamente el tiempo del audio de la escena (medido por la voz en off), evitando cortes abruptos o imágenes estáticas congeladas.
                </p>
              </div>

              {/* Selector de Modo */}
              <div className="inline-flex rounded-xl bg-[#090A0F] border border-white/10 p-1">
                <button
                  type="button"
                  onClick={() => setAnimationMode('camera_effects')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    animationMode === 'camera_effects'
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Film className="w-3.5 h-3.5" /> Efectos de Cámara
                </button>
                <button
                  type="button"
                  onClick={() => setAnimationMode('ai_local')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    animationMode === 'ai_local'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Video className="w-3.5 h-3.5" /> Animación IA Local
                </button>
              </div>
            </div>
          </div>

          {/* TARJETAS DE ESCENAS PARA ANIMACIÓN */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {scenes.map((scene, idx) => {
              const audioDuration = scene.durationSec ? scene.durationSec.toFixed(1) : '4.0';
              const hasVideo = !!(scene.videoClipUrl || scene.animatedUrl);
              const isWorking = scene.isAnimating || scene.isGeneratingImage || generatingLocalVideoIdx === idx;

              return (
                <div
                  key={idx}
                  className="bg-[#11131C] border border-white/10 rounded-2xl overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    <div className="aspect-video bg-[#090A0F] relative flex items-center justify-center overflow-hidden border-b border-white/10">
                      {hasVideo ? (
                        <video
                          src={scene.animatedUrl || scene.videoClipUrl}
                          poster={scene.imageUrl}
                          controls
                          loop
                          muted
                          className="w-full h-full object-cover"
                        />
                      ) : scene.imageUrl ? (
                        <img
                          src={scene.imageUrl}
                          alt={scene.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center p-4 text-xs text-zinc-500">
                          Sin imagen inicial en Escena {idx + 1}
                        </div>
                      )}

                      {isWorking && (
                        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2 px-4 text-center z-10">
                          <RefreshCw className="w-6 h-6 text-violet-400 animate-spin" />
                          <span className="text-xs font-mono text-white">
                            Animando video sincronizado ({audioDuration}s)...
                          </span>
                        </div>
                      )}

                      <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-black/75 text-[10px] font-mono font-bold text-white z-20">
                        Escena {idx + 1}
                      </span>

                      <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded bg-violet-600/90 text-[10px] font-mono font-bold text-white z-20 flex items-center gap-1">
                        ⏱️ Audio: {audioDuration}s
                      </span>
                    </div>

                    <div className="p-4 space-y-2">
                      <p className="text-xs font-semibold text-zinc-200 line-clamp-2">
                        {scene.title}
                      </p>
                      <p className="text-xs text-zinc-400 italic line-clamp-2">
                        "{scene.dialogue}"
                      </p>
                    </div>
                  </div>

                  <div className="p-4 pt-0 space-y-3">
                    {animationMode === 'camera_effects' ? (
                      <div className="space-y-2">
                        <div>
                          <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                            Efecto Ken Burns ({audioDuration}s):
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
                            className="w-full bg-[#090A0F] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white"
                          >
                            <option value="zoom_in">Zoom In Dinámico</option>
                            <option value="zoom_out">Zoom Out Revelador</option>
                            <option value="pan_right">Paneo Derecha</option>
                            <option value="pan_left">Paneo Izquierda</option>
                            <option value="pulse">Pulso de Retención</option>
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => onAnimateSceneAI(idx)}
                          disabled={isWorking}
                          className="w-full py-2.5 rounded-xl bg-violet-600/20 hover:bg-violet-600 border border-violet-500/40 text-violet-300 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Film className="w-3.5 h-3.5" />
                          {scene.isAnimating ? 'Animando...' : `Aplicar Efecto (${audioDuration}s)`}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-[10px] font-mono text-zinc-400">
                          Animar desde imagen inicial ({audioDuration}s):
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleGenerateSceneLocalVideo(idx, 'wan_comfyui')}
                            disabled={isWorking}
                            className="py-2 px-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-600 border border-emerald-500/40 text-emerald-300 hover:text-white text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                          >
                            <Video className="w-3.5 h-3.5" /> Wan 2.1 ({audioDuration}s)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleGenerateSceneLocalVideo(idx, 'ltx_local')}
                            disabled={isWorking}
                            className="py-2 px-2 rounded-xl bg-violet-600/20 hover:bg-violet-600 border border-violet-500/40 text-violet-300 hover:text-white text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                          >
                            <Zap className="w-3.5 h-3.5" /> LTX 2.3 ({audioDuration}s)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setState((prev) => ({ ...prev, step: 3 }))}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
            <button
              onClick={() => setState((prev) => ({ ...prev, step: 5 }))}
              className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
            >
              Siguiente: Subtítulos <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: SUBTÍTULOS DINÁMICOS */}
      {state.step === 5 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-[#11131C] border border-white/10 rounded-2xl p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-white">
                Estilo de Subtítulos Quemados en Video
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Selecciona el estilo visual de resaltado palabra por palabra para retener a la audiencia.
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
                  desc: 'Pastilla de alto contraste para lectura rápida en Shorts y Facebook',
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
              onClick={onGenerateSubtitles}
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
                onClick={() => setState((prev) => ({ ...prev, step: 4 }))}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>
              <button
                onClick={() => setState((prev) => ({ ...prev, step: 6 }))}
                className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                Siguiente: Renderizar Video <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 6: EDITOR MASTER & EXPORTACIÓN DE VIDEO */}
      {state.step === 6 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
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
                  <CheckCircle2 className="w-4 h-4" /> Video Persistido en Disco ({state.renderedVideoUrl})
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

          <div className="lg:col-span-6 bg-[#11131C] border border-white/10 rounded-2xl p-6 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div>
                <span className="text-xs font-mono uppercase text-emerald-400">
                  Compilación y Guardado Permanente en Disco
                </span>
                <h2 className="text-xl font-bold text-white mt-0.5">
                  Exportación de Video Real
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Combina todas las escenas, voz neural, música y subtítulos, guardando el video directamente en <code className="text-zinc-200">data/media/videos/</code>.
                </p>
              </div>

              <div>
                <span className="text-xs font-semibold text-zinc-300 block mb-2">
                  Línea de Tiempo de Escenas:
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

              <div className="bg-[#090A0F] border border-white/10 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Escenas del Guion:</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {scenes.length} escenas listas
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Locución Neural:</span>
                  <span
                    className={`font-mono font-bold ${
                      state.voiceAudioUrl ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {state.voiceAudioUrl ? 'Lista para mezclar' : 'Opcional (Sin voz)'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Pista Musical:</span>
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
                      Renderizando y guardando en disco...
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
                  onClick={onRenderFinalVideo}
                  disabled={isRenderingVideo}
                  className="flex-1 py-3.5 px-5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-violet-600/20"
                >
                  {isRenderingVideo ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Renderizando Video ({renderProgress}%)...
                    </>
                  ) : (
                    <>
                      <Film className="w-4 h-4" />
                      Renderizar y Guardar Video Final
                    </>
                  )}
                </button>

                {state.renderedVideoUrl && (
                  <a
                    href={state.renderedVideoUrl}
                    download={`clipai_${activeChannel.handle.replace('@', '')}_${Date.now()}.mp4`}
                    className="py-3.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Descargar MP4 Master (1080p)
                  </a>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex justify-between">
              <button
                onClick={() => setState((prev) => ({ ...prev, step: 5 }))}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>
              <button
                onClick={() => setState((prev) => ({ ...prev, step: 7 }))}
                className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                Siguiente: Publicar (YT / TikTok / FB) <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 7: MINIATURA, SEO & PUBLICACIÓN MULTI-RED */}
      {state.step === 7 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-[#11131C] border border-white/10 rounded-2xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-mono uppercase text-violet-400">
                  Kit Prioritario V1: YouTube • TikTok • Facebook
                </span>
                <h2 className="text-lg font-bold text-white">
                  Miniatura, SEO & Copy Adaptado por Plataforma
                </h2>
              </div>
              <button
                onClick={onGenerateMarketingPackage}
                disabled={isGeneratingMarketing}
                className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shrink-0"
              >
                <Wand2 className="w-4 h-4" />
                {isGeneratingMarketing
                  ? 'Generando Copy con IA...'
                  : 'Generar Miniatura y Copy IA'}
              </button>
            </div>

            {/* Platform Copy Selector Tabs */}
            <div className="flex flex-wrap gap-1.5 border-b border-white/10 pb-3">
              {SOCIAL_PLATFORMS.map((plat) => (
                <button
                  key={plat.id}
                  onClick={() => setSelectedMarketingPlatform(plat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedMarketingPlatform === plat.id
                      ? 'bg-violet-600 text-white'
                      : 'bg-[#090A0F] text-zinc-400 hover:text-white'
                  }`}
                >
                  <span>{plat.shortName}</span>
                  {plat.v1Priority && (
                    <span className="text-[9px] font-mono px-1 rounded bg-emerald-500/25 text-emerald-300">
                      V1
                    </span>
                  )}
                </button>
              ))}
            </div>

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
                'Haz clic en «Generar Miniatura y Copy IA» para adaptar el texto con Ollama.';
              const displayTags =
                currentCopy?.hashtags ||
                state.metadata?.hashtags ||
                ['shorts', 'tiktok', 'facebookreels'];

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

          <div className="lg:col-span-5 bg-[#11131C] border border-white/10 rounded-2xl p-6 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white">
                  Miniatura & Destino de Publicación
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/30">
                  {publishAutoMode === 'auto_publish' ? 'MODO DIRECTO' : 'MODO REVISIÓN'}
                </span>
              </div>

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
                  onClick={() => onScheduleOrPublish(false)}
                  className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-violet-600/20"
                >
                  <Calendar className="w-4 h-4" />
                  Programar en Calendario Multi-Canal
                </button>

                <button
                  onClick={() => onScheduleOrPublish(true)}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  Publicar Ahora (YouTube / TikTok / Facebook)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

