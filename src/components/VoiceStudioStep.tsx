import React, { useState, useRef } from 'react';
import {
  Mic,
  Volume2,
  Play,
  Pause,
  RefreshCw,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Clock,
  Sliders,
  FileAudio,
} from 'lucide-react';
import { Scene, VideoState, VOICES, VoiceOption } from '../types';
import {
  generateSpeechClip,
  generateScenesVoiceover,
  rebuildMasterVoiceTrack,
} from '../services/apiService';

interface VoiceStudioStepProps {
  scenes: Scene[];
  state: VideoState;
  onUpdateScenes: (scenes: Scene[]) => void;
  onUpdateState: (patch: Partial<VideoState>) => void;
  onNextStep: () => void;
  onPrevStep: () => void;
  onSetStatus: (msg: { type: 'info' | 'success' | 'error'; text: string }) => void;
}

export const VoiceStudioStep: React.FC<VoiceStudioStepProps> = ({
  scenes,
  state,
  onUpdateScenes,
  onUpdateState,
  onNextStep,
  onPrevStep,
  onSetStatus,
}) => {
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [activeGeneratingIdx, setActiveGeneratingIdx] = useState<number | null>(null);
  const [playingSceneIdx, setPlayingSceneIdx] = useState<number | null>(null);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const sceneAudioRef = useRef<HTMLAudioElement | null>(null);

  const effectiveSpeed = state.voiceSpeed || (state.voice.startsWith('xtts-') ? 0.85 : 1.05);

  const totalCalculatedDuration = scenes.reduce((acc, s) => acc + (s.durationSec || 0), 0);
  const completedScenesCount = scenes.filter((s) => Boolean(s.voiceAudioUrl || s.audioClipUrl)).length;
  const totalWords = scenes.reduce(
    (acc, s) => acc + (s.dialogue ? s.dialogue.split(/\s+/).filter(Boolean).length : 0),
    0
  );

  const handlePlayVoicePreview = (e: React.MouseEvent, voice: VoiceOption) => {
    e.stopPropagation();
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      if (playingVoiceId === voice.id) {
        setPlayingVoiceId(null);
        return;
      }
    }
    const url = voice.previewUrl || `/media/audio/samples/sample_${voice.id}.mp3`;
    const audio = new Audio(url);
    previewAudioRef.current = audio;
    setPlayingVoiceId(voice.id);
    audio.play().catch(() => setPlayingVoiceId(null));
    audio.onended = () => setPlayingVoiceId(null);
    audio.onerror = () => setPlayingVoiceId(null);
  };

  const handlePlaySceneAudio = (idx: number, url: string) => {
    if (sceneAudioRef.current) {
      sceneAudioRef.current.pause();
      if (playingSceneIdx === idx) {
        setPlayingSceneIdx(null);
        return;
      }
    }
    const audio = new Audio(url);
    sceneAudioRef.current = audio;
    setPlayingSceneIdx(idx);
    audio.play().catch(() => setPlayingSceneIdx(null));
    audio.onended = () => setPlayingSceneIdx(null);
    audio.onerror = () => setPlayingSceneIdx(null);
  };

  const handleGenerateSingleScene = async (idx: number) => {
    const scene = scenes[idx];
    const textToSpeak = scene.dialogue?.trim() || scene.title;
    if (!textToSpeak) {
      onSetStatus({ type: 'error', text: `La escena ${idx + 1} no tiene texto para narrar.` });
      return;
    }

    setActiveGeneratingIdx(idx);
    onSetStatus({
      type: 'info',
      text: `Sintetizando locución para la Escena ${idx + 1} con la voz "${state.voice}" en GPU...`,
    });

    try {
      const clip = await generateSpeechClip({
        text: textToSpeak,
        voice: state.voice,
        language: state.language || 'es',
        speed: effectiveSpeed,
        filenamePrefix: `scene${idx + 1}`,
      });

      const updated = [...scenes];
      updated[idx] = {
        ...updated[idx],
        voiceAudioUrl: clip.audioDataUrl,
        audioClipUrl: clip.audioDataUrl,
        durationSec: clip.durationSec,
        wordTimings: clip.wordTimings,
        isGeneratingVoice: false,
      };

      onUpdateScenes(updated);

      // Recalcular pista maestra en segundo plano
      try {
        const master = await rebuildMasterVoiceTrack(updated);
        onUpdateState({
          voiceAudioUrl: master.voiceAudioUrl,
          subtitles: master.subtitlesSrt,
        });
      } catch {
        // Ignorar si falla reconstrucción parcial
      }

      onSetStatus({
        type: 'success',
        text: `Escena ${idx + 1} sintetizada con éxito (${clip.durationSec}s).`,
      });
    } catch (err: any) {
      onSetStatus({
        type: 'error',
        text: `Error al sintetizar Escena ${idx + 1}: ${err.message}`,
      });
    } finally {
      setActiveGeneratingIdx(null);
    }
  };

  const handleGenerateAllScenes = async () => {
    if (scenes.length === 0) {
      onSetStatus({ type: 'error', text: 'No hay escenas para sintetizar.' });
      return;
    }

    setIsGeneratingAll(true);
    onSetStatus({
      type: 'info',
      text: `Sintetizando ${scenes.length} escenas en lote con "${state.voice}" (GPU RTX 5090)...`,
    });

    try {
      const res = await generateScenesVoiceover({
        scenes,
        voice: state.voice,
        language: state.language || 'es',
        speed: effectiveSpeed,
      });

      onUpdateScenes(res.scenes);
      onUpdateState({
        voiceAudioUrl: res.voiceAudioUrl,
        subtitles: res.subtitlesSrt,
      });

      onSetStatus({
        type: 'success',
        text: `¡Todas las ${res.scenes.length} escenas sintetizadas! Duración total: ${res.totalDurationSec}s.`,
      });
    } catch (err: any) {
      onSetStatus({
        type: 'error',
        text: `Error en la síntesis por escenas: ${err.message}`,
      });
    } finally {
      setIsGeneratingAll(false);
    }
  };

  const handleDialogueChange = (idx: number, newText: string) => {
    const updated = [...scenes];
    updated[idx] = { ...updated[idx], dialogue: newText };
    onUpdateScenes(updated);
  };

  return (
    <div className="space-y-6">
      {/* 1. Barra de Control Global de Locución */}
      <div className="bg-[#11131C] border border-white/10 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Mic className="w-5 h-5 text-violet-400" />
              Paso 2: Locución por Escenas (Voice Studio)
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Genera la narración de cada escena individualmente o en lote. Cada escena calcula su duración exacta con precisión FFprobe.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerateAllScenes}
              disabled={isGeneratingAll || scenes.length === 0}
              className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-violet-600/25 transition-all cursor-pointer"
            >
              {isGeneratingAll ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Sintetizando Todas ({completedScenesCount}/{scenes.length})...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  ⚡ Generar Todas las Escenas
                </>
              )}
            </button>
          </div>
        </div>

        {/* Resumen de Métricas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#090A0F] border border-white/5 rounded-xl p-3.5 text-center">
          <div>
            <div className="text-[11px] text-zinc-400">Total Escenas</div>
            <div className="text-base font-bold font-mono text-white">{scenes.length}</div>
          </div>
          <div>
            <div className="text-[11px] text-zinc-400">Escenas con Audio</div>
            <div className="text-base font-bold font-mono text-emerald-400">
              {completedScenesCount} / {scenes.length}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-zinc-400">Palabras Totales</div>
            <div className="text-base font-bold font-mono text-violet-400">{totalWords}</div>
          </div>
          <div>
            <div className="text-[11px] text-zinc-400">Duración Acumulada</div>
            <div className="text-base font-bold font-mono text-amber-400">
              {totalCalculatedDuration > 0
                ? `${Math.floor(totalCalculatedDuration / 60)}m ${(totalCalculatedDuration % 60).toFixed(1)}s`
                : 'Calculando...'}
            </div>
          </div>
        </div>

        {/* Selector de Voces */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-zinc-300 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-violet-400" />
              Selecciona la Voz Principal para las Escenas
            </label>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5 text-zinc-500" />
                Velocidad: <strong className="font-mono text-zinc-200">{effectiveSpeed.toFixed(2)}x</strong>
              </span>
              <input
                type="range"
                min="0.75"
                max="1.25"
                step="0.05"
                value={effectiveSpeed}
                onChange={(e) => onUpdateState({ voiceSpeed: parseFloat(e.target.value) })}
                className="w-24 accent-violet-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 max-h-[280px] overflow-y-auto pr-1">
            {VOICES.map((v) => {
              const selected = state.voice === v.id;
              const isPlaying = playingVoiceId === v.id;
              const isCloned = v.engine === 'xtts';

              return (
                <div
                  key={v.id}
                  onClick={() => onUpdateState({ voice: v.id })}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer select-none relative ${
                    selected
                      ? isCloned
                        ? 'bg-red-950/40 border-red-500 shadow-md shadow-red-950/50'
                        : 'bg-violet-600/15 border-violet-500 shadow-md shadow-violet-600/15'
                      : isCloned
                      ? 'bg-red-950/15 border-red-900/40 hover:border-red-600/60'
                      : 'bg-[#090A0F] border-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <span className="text-xs font-bold text-white truncate">{v.name}</span>
                    <button
                      type="button"
                      onClick={(e) => handlePlayVoicePreview(e, v)}
                      className={`p-1 rounded-md border transition-all cursor-pointer shrink-0 ${
                        isPlaying
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
                      }`}
                      title="Escuchar muestra"
                    >
                      {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-zinc-400">{v.accent}</span>
                    <span className="text-[10px] text-zinc-500">•</span>
                    <span className="text-[10px] text-zinc-400">{v.gender}</span>
                    {isCloned && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/20 text-red-300 font-semibold ml-auto">
                        Clonada
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Grid de Escenas con Tarjetas de Locución (Estilo Animación) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileAudio className="w-4 h-4 text-emerald-400" />
            Tarjetas de Locución por Escena ({scenes.length})
          </h3>
          <span className="text-xs text-zinc-400">
            Edita el texto antes de generar el audio para ajustar pronunciación o pausas.
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scenes.map((sc, idx) => {
            const hasAudio = Boolean(sc.voiceAudioUrl || sc.audioClipUrl);
            const audioUrl = sc.voiceAudioUrl || sc.audioClipUrl || '';
            const isGenerating = activeGeneratingIdx === idx || isGeneratingAll;
            const isPlayingThis = playingSceneIdx === idx;
            const dur = sc.durationSec || 0;

            return (
              <div
                key={idx}
                className={`bg-[#11131C] border rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-all ${
                  hasAudio
                    ? 'border-emerald-500/30 bg-emerald-950/5'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                {/* Header de Escena */}
                <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-white/5 text-zinc-300 font-mono">
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-white truncate max-w-[200px]">
                      {sc.title || `Escena ${idx + 1}`}
                    </span>
                  </div>

                  {hasAudio ? (
                    <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-500/20">
                      <Clock className="w-3 h-3" />
                      {dur.toFixed(2)}s
                    </span>
                  ) : (
                    <span className="text-[11px] text-zinc-500 font-mono">Sin audio</span>
                  )}
                </div>

                {/* Diálogo Editable */}
                <div className="space-y-1.5 flex-1">
                  <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                    Diálogo Hablado
                  </label>
                  <textarea
                    rows={3}
                    value={sc.dialogue || ''}
                    onChange={(e) => handleDialogueChange(idx, e.target.value)}
                    placeholder="Escribe o ajusta el diálogo de esta escena..."
                    className="w-full bg-[#090A0F] border border-white/10 rounded-xl p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-violet-500 resize-none transition-all leading-relaxed"
                  />
                </div>

                {/* Acciones y Reproductor */}
                <div className="pt-1 flex items-center justify-between gap-3 border-t border-white/5">
                  {hasAudio && (
                    <button
                      type="button"
                      onClick={() => handlePlaySceneAudio(idx, audioUrl)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isPlayingThis
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-white/5 border-white/10 text-emerald-400 hover:bg-white/10'
                      }`}
                    >
                      {isPlayingThis ? (
                        <>
                          <Pause className="w-3.5 h-3.5" />
                          Pausar
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          Escuchar
                        </>
                      )}
                    </button>
                  )}

                  <div className="ml-auto">
                    <button
                      type="button"
                      onClick={() => handleGenerateSingleScene(idx)}
                      disabled={isGenerating}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        hasAudio
                          ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/10'
                          : 'bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-600/20'
                      }`}
                    >
                      {isGenerating ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        <>
                          {hasAudio ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5" />
                              Regenerar Voz
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5" />
                              Generar Voz
                            </>
                          )}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Navegación Inferior */}
      <div className="flex items-center justify-between pt-4 border-t border-white/10">
        <button
          onClick={onPrevStep}
          className="px-5 py-2.5 rounded-xl border border-white/10 hover:border-white/20 text-zinc-300 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
          Atrás: Guion Viral
        </button>

        <button
          onClick={onNextStep}
          className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-violet-600/25 cursor-pointer transition-all"
        >
          Siguiente: Música & SFX
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

