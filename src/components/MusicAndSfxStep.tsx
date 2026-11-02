import React, { useState, useEffect, useRef } from 'react';
import {
  Music,
  Volume2,
  Play,
  Pause,
  Upload,
  CloudRain,
  Wind,
  Activity,
  Radio,
  Sliders,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  FolderOpen,
  VolumeX,
} from 'lucide-react';
import { Scene, VideoState, MusicLibraryItem } from '../types';
import {
  fetchMusicLibrary,
  uploadCustomMusic,
  fetchSfxLibrary,
  mixMultiTrackAudioApi,
} from '../services/apiService';

interface MusicAndSfxStepProps {
  scenes: Scene[];
  state: VideoState;
  onUpdateState: (patch: Partial<VideoState>) => void;
  onNextStep: () => void;
  onPrevStep: () => void;
  onSetStatus: (msg: { type: 'info' | 'success' | 'error'; text: string }) => void;
}

export const MusicAndSfxStep: React.FC<MusicAndSfxStepProps> = ({
  scenes,
  state,
  onUpdateState,
  onNextStep,
  onPrevStep,
  onSetStatus,
}) => {
  const [musicLibrary, setMusicLibrary] = useState<MusicLibraryItem[]>([]);
  const [ambientTracks, setAmbientTracks] = useState<{ id: string; name: string; url: string; durationSec: number }[]>([]);
  const [sfxHits, setSfxHits] = useState<{ id: string; name: string; url: string; durationSec: number }[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isMixingPreview, setIsMixingPreview] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'terror' | 'suspenso' | 'documental' | 'tech' | 'custom'>('all');

  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const totalVideoDuration = scenes.reduce((acc, s) => acc + (s.durationSec || 0), 0);

  const musicVol = state.musicVolume !== undefined ? state.musicVolume : 0.18;
  const ambientVol = state.ambientVolume !== undefined ? state.ambientVolume : 0.12;
  const ducking = state.duckingPreset || 'balanced';

  useEffect(() => {
    loadAudioAssets();
  }, []);

  const loadAudioAssets = async () => {
    setIsLoadingLibrary(true);
    try {
      const [musicItems, sfxData] = await Promise.all([
        fetchMusicLibrary(),
        fetchSfxLibrary(),
      ]);
      setMusicLibrary(musicItems);
      setAmbientTracks(sfxData.ambient);
      setSfxHits(sfxData.hits);

      // Si no hay música seleccionada y hay pistas en la biblioteca, seleccionar la primera de terror por defecto
      if (!state.musicAudioUrl && musicItems.length > 0) {
        const defaultTrack = musicItems.find((m) => m.category === 'terror') || musicItems[0];
        onUpdateState({
          music: defaultTrack.id,
          musicAudioUrl: defaultTrack.url,
        });
      }
    } catch {
      onSetStatus({ type: 'error', text: 'Error al cargar biblioteca de audio en disco.' });
    } finally {
      setIsLoadingLibrary(false);
    }
  };

  const handlePlayToggle = (url: string) => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      if (playingAudioUrl === url) {
        setPlayingAudioUrl(null);
        return;
      }
    }
    const audio = new Audio(url);
    audioPlayerRef.current = audio;
    setPlayingAudioUrl(url);
    audio.play().catch(() => setPlayingAudioUrl(null));
    audio.onended = () => setPlayingAudioUrl(null);
    audio.onerror = () => setPlayingAudioUrl(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    onSetStatus({ type: 'info', text: `Subiendo pista personalizada "${file.name}"...` });
    try {
      const item = await uploadCustomMusic(file);
      setMusicLibrary((prev) => [item, ...prev]);
      onUpdateState({
        music: item.id,
        musicAudioUrl: item.url,
      });
      onSetStatus({ type: 'success', text: `Pista "${item.name}" guardada y asignada exitosamente.` });
    } catch (err: any) {
      onSetStatus({ type: 'error', text: err.message });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleMixPreview = async () => {
    if (!state.voiceAudioUrl) {
      onSetStatus({
        type: 'error',
        text: 'Primero debes generar la locución de las escenas en el Paso 2 para previsualizar la mezcla.',
      });
      return;
    }

    setIsMixingPreview(true);
    onSetStatus({ type: 'info', text: 'Mezclando locución con música de fondo atenuada y atmósfera en FFmpeg...' });

    try {
      const res = await mixMultiTrackAudioApi({
        voiceAudioUrl: state.voiceAudioUrl,
        musicAudioUrl: state.musicAudioUrl,
        musicVolume: musicVol,
        duckingPreset: ducking,
        ambientAudioUrl: state.ambientAudioUrl,
        ambientVolume: ambientVol,
      });

      onUpdateState({ mixedAudioUrl: res.mixedAudioUrl });
      onSetStatus({
        type: 'success',
        text: `Mezcla multipista completada (${res.tracksMixed} pistas unificadas con sidechain ducking).`,
      });

      // Reproducir mezcla
      handlePlayToggle(res.mixedAudioUrl);
    } catch (err: any) {
      onSetStatus({ type: 'error', text: `Error al mezclar: ${err.message}` });
    } finally {
      setIsMixingPreview(false);
    }
  };

  const filteredMusic = activeTab === 'all'
    ? musicLibrary
    : musicLibrary.filter((m) => m.category === activeTab);

  return (
    <div className="space-y-6">
      {/* 1. Header con Resumen de Duración de Escenas */}
      <div className="bg-[#11131C] border border-white/10 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Music className="w-5 h-5 text-emerald-400" />
              Paso 3: Banda Sonora & SFX (Music & Sound Design Studio)
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Configura la música de fondo que cubrirá todo el video y agrega una capa de atmósfera foley (lluvia, viento, latidos).
            </p>
          </div>

          <button
            onClick={handleMixPreview}
            disabled={isMixingPreview || !state.voiceAudioUrl}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/25 cursor-pointer transition-all shrink-0"
          >
            {isMixingPreview ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Mezclando Pistas...
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4" />
                🎧 Escuchar Mezcla Multipista
              </>
            )}
          </button>
        </div>

        {/* Timeline Visual de Duración de Escenas */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-300">
              Duración Objetivo Total fijada por Voces:{' '}
              <strong className="text-emerald-400 font-mono">
                {totalVideoDuration > 0
                  ? `${Math.floor(totalVideoDuration / 60)}m ${(totalVideoDuration % 60).toFixed(1)}s`
                  : 'Sin audio de voz'}
              </strong>
            </span>
            <span className="text-zinc-500 text-[11px] font-mono">{scenes.length} Escenas en Timeline</span>
          </div>

          {/* Barra de progreso visual por escenas */}
          <div className="w-full h-3 bg-[#090A0F] rounded-full overflow-hidden flex border border-white/10 p-0.5 gap-0.5">
            {scenes.map((sc, idx) => {
              const fraction = totalVideoDuration > 0 ? (sc.durationSec || 4) / totalVideoDuration : 1 / scenes.length;
              return (
                <div
                  key={idx}
                  style={{ width: `${fraction * 100}%` }}
                  title={`Escena ${idx + 1}: ${(sc.durationSec || 4).toFixed(1)}s`}
                  className="h-full rounded-sm bg-gradient-to-r from-violet-600 to-emerald-500 hover:opacity-80 transition-all cursor-pointer"
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUMNA IZQUIERDA: BLOQUE A - MÚSICA DE FONDO (BGM) */}
        <div className="lg:col-span-7 bg-[#11131C] border border-white/10 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Music className="w-4 h-4 text-emerald-400" />
                Opción A: Música de Fondo Global
              </h3>
              <p className="text-[11px] text-zinc-400">
                Pistas reales en disco que cubren todas las escenas con loop y recorte inteligente.
              </p>
            </div>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 bg-white/5 text-zinc-300 hover:text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
              >
                {isUploading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                Subir Propia
              </button>
            </div>
          </div>

          {/* Categorías de Filtro */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {(['all', 'terror', 'suspenso', 'documental', 'tech', 'custom'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                className={`px-3 py-1 rounded-lg font-bold capitalize transition-all cursor-pointer ${
                  activeTab === cat
                    ? 'bg-emerald-500 text-black'
                    : 'bg-[#090A0F] text-zinc-400 hover:text-white border border-white/5'
                }`}
              >
                {cat === 'all' ? 'Todas' : cat}
              </button>
            ))}
          </div>

          {/* Lista de Pistas de la Biblioteca */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {isLoadingLibrary ? (
              <div className="text-center py-8 text-zinc-500 text-xs flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Cargando pistas de audio en disco...
              </div>
            ) : filteredMusic.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-xs">
                No hay pistas en esta categoría. Puedes subir tu archivo MP3 con el botón superior.
              </div>
            ) : (
              filteredMusic.map((item) => {
                const isSelected = state.musicAudioUrl === item.url || state.music === item.id;
                const isPlaying = playingAudioUrl === item.url;

                return (
                  <div
                    key={item.id}
                    onClick={() =>
                      onUpdateState({
                        music: item.id,
                        musicAudioUrl: item.url,
                      })
                    }
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-500 shadow-md shadow-emerald-500/10 text-white'
                        : 'bg-[#090A0F] border-white/5 hover:border-white/15 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayToggle(item.url);
                        }}
                        className={`p-2 rounded-lg border transition-all cursor-pointer shrink-0 ${
                          isPlaying
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                            : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>

                      <div className="truncate">
                        <div className="text-xs font-bold truncate">{item.name}</div>
                        <div className="text-[10px] text-zinc-400 flex items-center gap-2 mt-0.5">
                          <span className="uppercase px-1.5 py-0.2 rounded bg-white/5 text-[9px]">
                            {item.category}
                          </span>
                          <span className="font-mono">{item.durationSec ? `${item.durationSec.toFixed(1)}s` : 'Loop'}</span>
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Controles de Mezcla de Música */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#090A0F] border border-white/5 rounded-xl p-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  Volumen Música
                </span>
                <span className="font-mono font-bold text-white">{Math.round(musicVol * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.04"
                max="0.45"
                step="0.02"
                value={musicVol}
                onChange={(e) => onUpdateState({ musicVolume: parseFloat(e.target.value) })}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-500">
                <span>Discreto (8%)</span>
                <span>Recomendado (18%)</span>
                <span>Alto (35%)</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-violet-400" />
                  Sidechain Ducking
                </span>
                <span className="font-bold text-violet-400 uppercase text-[10px] font-mono">{ducking}</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(['subtle', 'balanced', 'aggressive'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onUpdateState({ duckingPreset: mode })}
                    className={`py-1.5 px-2 rounded-lg text-[10px] font-bold capitalize transition-all cursor-pointer ${
                      ducking === mode
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'bg-white/5 border border-white/5 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {mode === 'subtle' ? 'Suave' : mode === 'balanced' ? 'Normal' : 'Fuerte'}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                Atenúa la música automáticamente mientras el narrador habla.
              </p>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: BLOQUE B - EFECTOS DE SONIDO & ATMÓSFERA */}
        <div className="lg:col-span-5 bg-[#11131C] border border-white/10 rounded-2xl p-6 space-y-5">
          <div className="border-b border-white/10 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CloudRain className="w-4 h-4 text-cyan-400" />
              Opción B: Atmósfera Sonora & Foley (4 Niveles)
            </h3>
            <p className="text-[11px] text-zinc-400">
              Capa de ambiente continuo para dar textura inmersiva a relatos oscuros y crónicas.
            </p>
          </div>

          {/* Selector de Atmósfera Continua (Nivel 1) */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-zinc-300 flex items-center justify-between">
              <span>Capa de Ambiente Continuo</span>
              {state.ambientAudioUrl && (
                <button
                  type="button"
                  onClick={() => onUpdateState({ ambientAudioUrl: undefined, ambientPresetId: undefined })}
                  className="text-[10px] text-red-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <VolumeX className="w-3 h-3" />
                  Desactivar
                </button>
              )}
            </label>

            <div className="space-y-2">
              {ambientTracks.map((amb) => {
                const isSelected = state.ambientAudioUrl === amb.url;
                const isPlaying = playingAudioUrl === amb.url;

                return (
                  <div
                    key={amb.id}
                    onClick={() =>
                      onUpdateState({
                        ambientPresetId: amb.id,
                        ambientAudioUrl: amb.url,
                      })
                    }
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-500 text-white shadow-md shadow-cyan-950/50'
                        : 'bg-[#090A0F] border-white/5 hover:border-white/15 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayToggle(amb.url);
                        }}
                        className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                          isPlaying
                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                            : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                      </button>

                      <span className="text-xs font-bold">{amb.name}</span>
                    </div>

                    {isSelected && <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />}
                  </div>
                );
              })}
            </div>

            {/* Slider de Volumen de Atmósfera */}
            {state.ambientAudioUrl && (
              <div className="bg-[#090A0F] border border-white/5 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Volumen de Ambiente</span>
                  <span className="font-mono font-bold text-cyan-400">{Math.round(ambientVol * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.04"
                  max="0.30"
                  step="0.02"
                  value={ambientVol}
                  onChange={(e) => onUpdateState({ ambientVolume: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* SFX Hits de Impacto (Nivel 2) */}
          <div className="space-y-3 pt-2 border-t border-white/5">
            <label className="text-xs font-bold text-zinc-300 flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400" />
              SFX de Impacto / Jumpscares Disponibles
            </label>
            <div className="space-y-1.5">
              {sfxHits.map((hit) => {
                const isPlaying = playingAudioUrl === hit.url;
                return (
                  <div
                    key={hit.id}
                    className="p-2.5 rounded-xl bg-[#090A0F] border border-white/5 flex items-center justify-between text-xs"
                  >
                    <span className="text-zinc-300 font-semibold">{hit.name}</span>
                    <button
                      type="button"
                      onClick={() => handlePlayToggle(hit.url)}
                      className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-amber-300 font-bold flex items-center gap-1 cursor-pointer transition-all"
                    >
                      {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                      Probar
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Navegación Inferior */}
      <div className="flex items-center justify-between pt-4 border-t border-white/10">
        <button
          onClick={onPrevStep}
          className="px-5 py-2.5 rounded-xl border border-white/10 hover:border-white/20 text-zinc-300 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
          Atrás: Locución por Escenas
        </button>

        <button
          onClick={onNextStep}
          className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-violet-600/25 cursor-pointer transition-all"
        >
          Siguiente: Visuales (ComfyUI)
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

