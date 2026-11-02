import React, { useState, useEffect, useRef } from 'react';
import {
  Film,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Zap,
  Sliders,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Video,
  Eye,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Layers,
  Compass,
  Activity,
  Move,
  Maximize2,
  Minimize2,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Vibrate,
  Radio,
} from 'lucide-react';
import {
  AspectRatioType,
  CameraMotionType,
  MotionIntensityType,
  Scene,
  SceneTransitionType,
  LocalVideoClusterStatus,
} from '../types';
import { animateSceneWithAI } from '../services/apiService';
import { drawSceneFrameOnCanvas } from '../services/videoRenderer';

interface AnimationStudioStepProps {
  scenes: Scene[];
  aspectRatio: AspectRatioType;
  onUpdateScene: (index: number, patch: Partial<Scene>) => void;
  onPrevStep: () => void;
  onNextStep: () => void;
}

export const CAMERA_MOTION_OPTIONS: Array<{
  id: CameraMotionType;
  label: string;
  description: string;
  icon: any;
  category: 'zoom' | 'pan' | 'special';
}> = [
  {
    id: 'zoom_in',
    label: 'Zoom In Dramático',
    description: 'Acercamiento progresivo al centro de atención (ideal para ganchos)',
    icon: Maximize2,
    category: 'zoom',
  },
  {
    id: 'zoom_out',
    label: 'Zoom Out Revelador',
    description: 'Alejamiento panorámico que descubre el entorno completo',
    icon: Minimize2,
    category: 'zoom',
  },
  {
    id: 'dolly_zoom',
    label: 'Dolly Zoom (Vértigo)',
    description: 'Contra-zoom cinematográfico de alto impacto psicológico',
    icon: Zap,
    category: 'zoom',
  },
  {
    id: 'pan_right',
    label: 'Paneo Derecha',
    description: 'Desplazamiento horizontal fluido hacia la derecha',
    icon: ArrowRight,
    category: 'pan',
  },
  {
    id: 'pan_left',
    label: 'Paneo Izquierda',
    description: 'Desplazamiento horizontal fluido hacia la izquierda',
    icon: ArrowLeft,
    category: 'pan',
  },
  {
    id: 'pan_up',
    label: 'Paneo Arriba (Tilt Up)',
    description: 'Revelación vertical ascendente desde la base al cielo o estructura',
    icon: ArrowUp,
    category: 'pan',
  },
  {
    id: 'pan_down',
    label: 'Paneo Abajo (Tilt Down)',
    description: 'Descenso dramático hacia detalles inquietantes en el suelo',
    icon: ArrowDown,
    category: 'pan',
  },
  {
    id: 'orbital_drift',
    label: 'Deriva Orbital',
    description: 'Rotación angular suave combinada con escala cinematográfica',
    icon: Compass,
    category: 'special',
  },
  {
    id: 'pulse',
    label: 'Pulso de Retención',
    description: 'Respiración rítmica y latido para reactivar atención',
    icon: Radio,
    category: 'special',
  },
  {
    id: 'shake_horror',
    label: 'Temblor / Tensión',
    description: 'Micro-vibración de cámara en mano para clímax, horror y urgencia',
    icon: Vibrate,
    category: 'special',
  },
];

export const TRANSITION_OPTIONS: Array<{
  id: SceneTransitionType;
  label: string;
  description: string;
}> = [
  { id: 'cut', label: 'Corte Directo', description: 'Corte seco e instantáneo al siguiente plano' },
  { id: 'fade_black', label: 'Fundido a Negro', description: 'Transición oscura clásica para suspenso y saltos temporales' },
  { id: 'crossfade', label: 'Disolvencia', description: 'Transición suave y etérea entre escenas' },
  { id: 'whip_pan', label: 'Barrido Rápido', description: 'Flash dinámico de velocidad para transiciones de acción' },
];

export const INTENSITY_OPTIONS: Array<{
  id: MotionIntensityType;
  label: string;
  factor: string;
}> = [
  { id: 'subtle', label: 'Sutil', factor: '0.6x' },
  { id: 'cinematic', label: 'Cinemático', factor: '1.0x' },
  { id: 'dynamic', label: 'Dinámico', factor: '1.5x' },
  { id: 'aggressive', label: 'Agresivo', factor: '2.2x' },
];

export const AnimationStudioStep: React.FC<AnimationStudioStepProps> = ({
  scenes,
  aspectRatio,
  onUpdateScene,
  onPrevStep,
  onNextStep,
}) => {
  const [playingPreviewIdx, setPlayingPreviewIdx] = useState<number | null>(null);
  const [previewProgress, setPreviewProgress] = useState<Record<number, number>>({});
  const [animatingIndices, setAnimatingIndices] = useState<Record<number, boolean>>({});
  const [clusterStatus, setClusterStatus] = useState<LocalVideoClusterStatus | null>(null);
  const [statusText, setStatusText] = useState<string>('');

  const canvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({});
  const imageElementsRef = useRef<Record<number, HTMLImageElement | null>>({});
  const animFrameRefs = useRef<Record<number, number | null>>({});

  // Query GPU cluster status on mount
  useEffect(() => {
    fetch('/api/visuals/local-engines/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setClusterStatus(data);
      })
      .catch(() => {});
  }, []);

  // Preload scene image elements for live canvas previews
  useEffect(() => {
    scenes.forEach((sc, idx) => {
      if (sc.imageUrl && !imageElementsRef.current[idx]) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = sc.imageUrl;
        img.onload = () => {
          imageElementsRef.current[idx] = img;
          renderFrame(idx, 0);
        };
      }
    });
  }, [scenes]);

  const renderFrame = (idx: number, progress: number) => {
    const canvas = canvasRefs.current[idx];
    const img = imageElementsRef.current[idx];
    const scene = scenes[idx];
    if (!canvas || !scene) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawSceneFrameOnCanvas(
      ctx,
      canvas.width,
      canvas.height,
      scene,
      img || null,
      progress,
      'hormozi'
    );
  };

  const togglePlayPreview = (idx: number) => {
    if (playingPreviewIdx === idx) {
      // Pause
      setPlayingPreviewIdx(null);
      if (animFrameRefs.current[idx]) {
        cancelAnimationFrame(animFrameRefs.current[idx]!);
        animFrameRefs.current[idx] = null;
      }
      return;
    }

    // Stop any existing preview loop
    if (playingPreviewIdx !== null && animFrameRefs.current[playingPreviewIdx]) {
      cancelAnimationFrame(animFrameRefs.current[playingPreviewIdx]!);
      animFrameRefs.current[playingPreviewIdx] = null;
    }

    setPlayingPreviewIdx(idx);
    const durationMs = (scenes[idx]?.durationSec || 5) * 1000;
    const startTime = performance.now();

    const loop = (now: number) => {
      const elapsed = now - startTime;
      const progress = (elapsed % durationMs) / durationMs;
      setPreviewProgress((prev) => ({ ...prev, [idx]: progress }));
      renderFrame(idx, progress);
      animFrameRefs.current[idx] = requestAnimationFrame(loop);
    };

    animFrameRefs.current[idx] = requestAnimationFrame(loop);
  };

  // Smart Motion Director: Applies viral retention sequence across all scenes
  const handleApplySmartRetentionChoreography = () => {
    scenes.forEach((scene, idx) => {
      let motion: CameraMotionType = 'zoom_in';
      let intensity: MotionIntensityType = 'cinematic';
      let transition: SceneTransitionType = 'cut';

      if (idx === 0) {
        // Hook (Escena 1): Alto impacto de retención instantánea
        motion = 'dolly_zoom';
        intensity = 'dynamic';
        transition = 'cut';
      } else if (idx === scenes.length - 1) {
        // Outro (Última escena): Zoom Out + Fade to black
        motion = 'zoom_out';
        intensity = 'cinematic';
        transition = 'fade_black';
      } else if (idx === Math.floor(scenes.length * 0.65)) {
        // Clímax / Momento de mayor tensión
        motion = 'shake_horror';
        intensity = 'dynamic';
        transition = 'cut';
      } else if (idx % 4 === 1) {
        motion = 'pan_right';
        intensity = 'cinematic';
        transition = 'cut';
      } else if (idx % 4 === 2) {
        motion = 'pan_up';
        intensity = 'cinematic';
        transition = 'crossfade';
      } else if (idx % 4 === 3) {
        motion = 'orbital_drift';
        intensity = 'dynamic';
        transition = 'cut';
      } else {
        motion = 'pulse';
        intensity = 'dynamic';
        transition = 'cut';
      }

      onUpdateScene(idx, {
        cameraMotion: motion,
        motionIntensity: intensity,
        transition,
      });

      // Update frame preview with new motion
      setTimeout(() => renderFrame(idx, previewProgress[idx] || 0), 50);
    });

    setStatusText('¡Coreografía de retención viral aplicada a todas las escenas!');
    setTimeout(() => setStatusText(''), 4000);
  };

  // Generate MP4 animation clip using specified engine
  const handleAnimateScene = async (
    index: number,
    engine: 'auto' | 'wan_comfyui' | 'ltx_local' | 'ken_burns_mp4' = 'ken_burns_mp4'
  ) => {
    const scene = scenes[index];
    if (!scene) return;

    setAnimatingIndices((prev) => ({ ...prev, [index]: true }));
    setStatusText(
      engine === 'wan_comfyui'
        ? `Renderizando clip con GPU Local Wan 2.1 (Escena ${index + 1})...`
        : engine === 'ltx_local'
        ? `Renderizando clip con GPU Local LTX 2.3 (Escena ${index + 1})...`
        : `Generando clip fluido Ken Burns MP4 60fps (Escena ${index + 1})...`
    );

    try {
      const res = await animateSceneWithAI({
        scene,
        aspectRatio,
        engine,
        cameraMotion: scene.cameraMotion || 'zoom_in',
        motionIntensity: scene.motionIntensity || 'cinematic',
        targetDurationSec: scene.durationSec || 5,
      });

      onUpdateScene(index, {
        animatedUrl: res.videoClipUrl || res.videoDataUrl,
        videoUrl: res.videoClipUrl || res.videoDataUrl,
        sourceType: engine === 'ken_burns_mp4' ? 'local_ai' : 'local_ai',
        visualMode: engine === 'ken_burns_mp4' ? 'ai_still' : 'hybrid',
      });

      setStatusText(`¡Clip de Escena #${index + 1} generado exitosamente! (${res.provider || 'MP4'})`);
    } catch (err: any) {
      alert(`Error al generar animación: ${err.message || 'Error desconocido'}`);
    } finally {
      setAnimatingIndices((prev) => ({ ...prev, [index]: false }));
      setTimeout(() => setStatusText(''), 5000);
    }
  };

  const handleClearClip = (index: number) => {
    onUpdateScene(index, {
      animatedUrl: undefined,
      videoUrl: undefined,
    });
    setTimeout(() => renderFrame(index, 0), 100);
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & SMART RETENTION DIRECTOR */}
      <div className="bg-[#11131C] border border-white/10 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase text-violet-400">
                Paso 5 • Dirección de Movimiento y Video
              </span>
              {clusterStatus?.gpuName && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold">
                  GPU: {clusterStatus.gpuName} ({clusterStatus.vramFreeGb}GB VRAM Libre)
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-white mt-1">
              Estudio de Animación Cinemática de Cámara y Clips IA
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Configura cómo se moverá la cámara en cada escena a 60 FPS o genera clips de video completos con tu GPU local (Wan 2.1 / LTX 2.3).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleApplySmartRetentionChoreography}
              disabled={scenes.length === 0}
              className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-violet-600/20"
              title="Aplica una alternancia rítmica de movimientos probados para retener el scroll (Hooks, giros, clímax con horror shake, y outro fade)"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              Director Automático de Retención
            </button>
          </div>
        </div>

        {statusText && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusText}</span>
          </div>
        )}
      </div>

      {/* 2. SCENE ANIMATION CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {scenes.map((scene, idx) => {
          const isPlaying = playingPreviewIdx === idx;
          const isAnimatingThis = !!animatingIndices[idx];
          const hasVideoClip = !!(scene.animatedUrl || scene.videoUrl);

          return (
            <div
              key={idx}
              className="bg-[#11131C] border border-white/10 rounded-2xl overflow-hidden flex flex-col justify-between"
            >
              <div>
                {/* 2.1 Media Viewport (Interactive 60fps Canvas or Video Element) */}
                <div className="aspect-video bg-[#090A0F] relative flex items-center justify-center overflow-hidden border-b border-white/10 group">
                  {hasVideoClip ? (
                    <video
                      src={scene.animatedUrl || scene.videoUrl}
                      controls
                      loop
                      muted
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <canvas
                      ref={(el) => {
                        canvasRefs.current[idx] = el;
                      }}
                      width={aspectRatio === '16:9' ? 640 : 360}
                      height={aspectRatio === '16:9' ? 360 : 640}
                      className="w-full h-full object-contain cursor-pointer"
                      onClick={() => togglePlayPreview(idx)}
                    />
                  )}

                  {/* Top Badges */}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 pointer-events-none">
                    <span className="px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono font-bold text-white">
                      Escena {idx + 1}
                    </span>
                    {hasVideoClip ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-mono font-bold text-emerald-300 backdrop-blur-sm flex items-center gap-1">
                        <Video className="w-3 h-3" /> Clip MP4 Activo
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-violet-500/20 border border-violet-500/40 text-[10px] font-mono font-bold text-violet-300 backdrop-blur-sm">
                        Ken Burns 60fps
                      </span>
                    )}
                  </div>

                  {/* Play / Pause Interactive Toggle Overlay */}
                  {!hasVideoClip && scene.imageUrl && (
                    <button
                      onClick={() => togglePlayPreview(idx)}
                      className={`absolute inset-0 flex items-center justify-center transition-opacity cursor-pointer ${
                        isPlaying
                          ? 'opacity-0 hover:opacity-100 bg-black/30'
                          : 'opacity-85 hover:opacity-100 bg-black/40'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-full bg-violet-600/90 text-white flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform">
                        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                      </div>
                    </button>
                  )}

                  {/* Generating Spinner Overlay */}
                  {isAnimatingThis && (
                    <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center gap-2 p-4 text-center z-10">
                      <RefreshCw className="w-7 h-7 text-emerald-400 animate-spin" />
                      <span className="text-xs font-mono text-white">
                        Renderizando animación con GPU...
                      </span>
                    </div>
                  )}

                  {/* Scrub bar on playback */}
                  {isPlaying && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                      <div
                        className="h-full bg-emerald-400 transition-all duration-75"
                        style={{ width: `${(previewProgress[idx] || 0) * 100}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* 2.2 Scene Details & Controls */}
                <div className="p-4 space-y-4">
                  <div>
                    <p className="text-xs font-bold text-zinc-100 line-clamp-1">{scene.title}</p>
                    <p className="text-xs text-zinc-400 italic line-clamp-2 mt-0.5">
                      "{scene.dialogue}"
                    </p>
                  </div>

                  {/* Motion Selector */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono uppercase text-zinc-400 flex items-center justify-between">
                      <span>Movimiento de Cámara:</span>
                      <span className="text-emerald-400 font-bold lowercase">
                        {scene.cameraMotion || 'zoom_in'}
                      </span>
                    </label>
                    <select
                      value={scene.cameraMotion || 'zoom_in'}
                      onChange={(e) => {
                        const val = e.target.value as CameraMotionType;
                        onUpdateScene(idx, { cameraMotion: val });
                        setTimeout(() => renderFrame(idx, previewProgress[idx] || 0), 50);
                      }}
                      className="w-full bg-[#090A0F] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      {CAMERA_MOTION_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label} • {opt.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Intensity and Transition Row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                        Intensidad:
                      </label>
                      <select
                        value={scene.motionIntensity || 'cinematic'}
                        onChange={(e) => {
                          const val = e.target.value as MotionIntensityType;
                          onUpdateScene(idx, { motionIntensity: val });
                          setTimeout(() => renderFrame(idx, previewProgress[idx] || 0), 50);
                        }}
                        className="w-full bg-[#090A0F] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      >
                        {INTENSITY_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label} ({opt.factor})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                        Transición:
                      </label>
                      <select
                        value={scene.transition || 'cut'}
                        onChange={(e) => {
                          const val = e.target.value as SceneTransitionType;
                          onUpdateScene(idx, { transition: val });
                        }}
                        className="w-full bg-[#090A0F] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      >
                        {TRANSITION_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2.3 Action Footer */}
              <div className="p-4 pt-0 space-y-2">
                {hasVideoClip ? (
                  <button
                    onClick={() => handleClearClip(idx)}
                    className="w-full py-2 rounded-xl bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/40 text-zinc-300 hover:text-red-300 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Quitar Video Clip (Volver a Ken Burns 60fps)
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleAnimateScene(idx, 'ken_burns_mp4')}
                      disabled={isAnimatingThis}
                      className="py-2 px-2.5 rounded-xl bg-white/5 hover:bg-violet-600/30 border border-white/10 hover:border-violet-500/40 text-zinc-200 hover:text-white text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
                      title="Compila un clip MP4 instantáneo con el movimiento de cámara aplicado a 60 FPS"
                    >
                      <Film className="w-3.5 h-3.5 text-violet-400" />
                      Clip Ken Burns MP4
                    </button>

                    <button
                      onClick={() =>
                        handleAnimateScene(
                          idx,
                          clusterStatus?.preferredEngine === 'wan_comfyui'
                            ? 'wan_comfyui'
                            : 'auto'
                        )
                      }
                      disabled={isAnimatingThis}
                      className="py-2 px-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/40 text-emerald-300 hover:text-white text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
                      title="Genera movimiento de video real Image-to-Video usando tu GPU RTX 5090"
                    >
                      <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                      Video GPU (Wan 2.1)
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. NAVIGATION FOOTER */}
      <div className="flex justify-between pt-2">
        <button
          onClick={onPrevStep}
          className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold flex items-center gap-1 cursor-pointer hover:bg-zinc-700"
        >
          <ChevronLeft className="w-4 h-4" /> Anterior: Visuales
        </button>
        <button
          onClick={onNextStep}
          className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-violet-600/20"
        >
          Siguiente: Subtítulos <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

