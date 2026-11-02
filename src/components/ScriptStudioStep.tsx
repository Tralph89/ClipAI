import React, { useState } from 'react';
import {
  Sparkles,
  Clock,
  Film,
  Type,
  Volume2,
  Plus,
  Trash2,
  Wand2,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Eye,
  Sliders,
  UserCheck,
  Compass,
  Zap,
} from 'lucide-react';
import {
  AspectRatioType,
  CameraMotionType,
  DURATIONS,
  GENRES,
  getFiveActStructure,
  MotionIntensityType,
  Scene,
  SceneTransitionType,
  SocialChannel,
  SUBGENRES,
  VisualBible,
} from '../types';

export interface ScriptStudioStepProps {
  activeChannel: SocialChannel;
  aspectRatio: AspectRatioType;
  onSelectAspectRatio: (ratio: AspectRatioType) => void;
  genre: string;
  subgenre: string;
  onSelectGenre: (genre: string, subgenre: string) => void;
  duration: string;
  onSelectDuration: (duration: string) => void;
  language: string;
  onSelectLanguage: (lang: string) => void;
  prompt: string;
  onChangePrompt: (val: string) => void;
  sourceTrendTitle?: string;
  isGeneratingScript: boolean;
  onGenerateScript: () => void;
  scenes: Scene[];
  onUpdateScenes: React.Dispatch<React.SetStateAction<Scene[]>>;
  visualBible?: VisualBible;
  onUpdateVisualBible?: (bible: VisualBible) => void;
  onNextStep: () => void;
}

export const ScriptStudioStep: React.FC<ScriptStudioStepProps> = ({
  activeChannel,
  aspectRatio,
  onSelectAspectRatio,
  genre,
  subgenre,
  onSelectGenre,
  duration,
  onSelectDuration,
  language,
  onSelectLanguage,
  prompt,
  onChangePrompt,
  sourceTrendTitle,
  isGeneratingScript,
  onGenerateScript,
  scenes,
  onUpdateScenes,
  visualBible,
  onUpdateVisualBible,
  onNextStep,
}) => {
  const [showVisualBible, setShowVisualBible] = useState(false);
  const [expandedPrompts, setExpandedPrompts] = useState<Record<number, boolean>>({});

  const togglePromptExpand = (idx: number) => {
    setExpandedPrompts((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const getActBadgeColor = (actRole?: string, idx?: number) => {
    const role = (actRole || '').toUpperCase();
    if (role.includes('GANCHO') || idx === 0) {
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    }
    if (role.includes('CONTEXTO') || role.includes('ILUSIÓN') || idx === 1) {
      return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
    }
    if (role.includes('FISURA') || role.includes('COARTADA') || idx === 2) {
      return 'bg-violet-500/15 text-violet-300 border-violet-500/30';
    }
    if (role.includes('QUIEBRE') || idx === 3) {
      return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    }
    if (role.includes('CIERRE') || role.includes('REMATE') || idx === 4) {
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    }
    return 'bg-zinc-800 text-zinc-300 border-white/10';
  };

  const handleApplyFiveActTemplate = () => {
    const structure = getFiveActStructure(duration || '60s');
    const newScenes: Scene[] = structure.map((act, i) => {
      const existing = scenes[i];
      return {
        title: existing?.title || `${act.actRole}: Plano cinematográfico`,
        dialogue: existing?.dialogue || 'Locución de la escena...',
        timeRange: act.timeRange,
        actRole: act.actRole,
        visualDescription:
          existing?.visualDescription ||
          (i === 0
            ? 'Plano detalle en cámara lenta: una ventana iluminada desde el exterior de noche. Corte rápido a la protagonista.'
            : i === 1
            ? 'La protagonista mira su teléfono en un pasillo oscuro. Reloj digital marcando las 9:15 PM. Tres golpes secos en la puerta.'
            : i === 2
            ? 'Plano subjetivo circular por la mirilla. Afuera un hombre agitado con ropa deportiva dando detalles familiares específicos.'
            : i === 3
            ? 'La mano se detiene antes de girar el cerrojo. Plano detalle de sus ojos dándose cuenta de que la acera exterior está vacía.'
            : 'Plano exterior de la casa en penumbra. Una sombra difusa retrocede lentamente hacia los árboles.'),
        onScreenText:
          existing?.onScreenText ||
          (i === 0
            ? 'No querían entrar. Querían que ella abriera.'
            : i === 2
            ? '¿Casualidad o recolección de datos?'
            : i === 4
            ? 'La información es el arma.'
            : undefined),
        soundEffect:
          existing?.soundEffect ||
          (i === 1
            ? 'Tres toques secos de madera, seguidos de silencio absoluto.'
            : i === 4
            ? 'Silencio súbito, dejando solo el zumbido ambiental.'
            : undefined),
        imagePrompt:
          existing?.imagePrompt ||
          `Cinematic atmospheric 35mm film still, shot on ARRI Alexa Mini LF, dramatic low-key lighting, 8k photorealistic`,
        stockKeywords: ['cinematic', 'suspense', 'realism'],
        cameraMotion: act.defaultMotion,
        motionIntensity: act.defaultIntensity,
        transition: i === 0 ? 'cut' : i === 4 ? 'fade_black' : 'crossfade',
      };
    });
    onUpdateScenes(newScenes);
  };

  const totalWords = scenes.reduce((acc, sc) => {
    const words = (sc.dialogue || '').trim().split(/\s+/).filter(Boolean).length;
    return acc + words;
  }, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* LEFT COLUMN: Video Settings & Script Generation Controls */}
      <div className="lg:col-span-5 bg-[#11131C] border border-white/10 rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-400" /> Dirección de Guion & Formato
          </h2>
          <span className="text-xs font-mono text-zinc-400">
            Canal: <strong className="text-violet-300">{activeChannel.name}</strong>
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
                type="button"
                onClick={() => onSelectAspectRatio(fmt.id as AspectRatioType)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  aspectRatio === fmt.id
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
              value={genre}
              onChange={(e) => {
                const g = e.target.value;
                onSelectGenre(g, SUBGENRES[g]?.[0] || '');
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
            <label className="text-xs text-zinc-400 block mb-1.5">Enfoque Narrativo</label>
            <select
              value={subgenre}
              onChange={(e) => onSelectGenre(genre, e.target.value)}
              className="w-full bg-[#090A0F] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white"
            >
              {(SUBGENRES[genre] || []).map((sg) => (
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
              value={duration}
              onChange={(e) => onSelectDuration(e.target.value)}
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
            <label className="text-xs text-zinc-400 block mb-1.5">Idioma de Narración</label>
            <select
              value={language}
              onChange={(e) => onSelectLanguage(e.target.value)}
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
            Tema, Caso, Noticia o Transcripción Completa
          </label>
          <textarea
            rows={4}
            value={prompt}
            onChange={(e) => onChangePrompt(e.target.value)}
            placeholder="Describe la historia, caso o tema... (ej: 'Una chica sola en casa recibe la visita de un desconocido que sabe detalles íntimos de su familia')"
            className="w-full bg-[#090A0F] border border-white/10 rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-violet-500 placeholder-zinc-600"
          />
        </div>

        {/* Generate Button */}
        <button
          onClick={onGenerateScript}
          disabled={isGeneratingScript}
          className="w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-violet-600/20 transition-all"
        >
          {isGeneratingScript ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
              Estructurando Guion en 5 Actos Virales...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4 text-violet-200" />
              Generar Guion con Estructura Viral (5 Actos)
            </>
          )}
        </button>

        {/* Visual Bible Accordion Card */}
        {visualBible && (
          <div className="bg-[#090A0F] border border-white/10 rounded-xl p-4 space-y-3">
            <button
              type="button"
              onClick={() => setShowVisualBible((p) => !p)}
              className="w-full flex items-center justify-between text-xs font-semibold text-zinc-300 hover:text-white cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-emerald-400" />
                <span>Biblia Visual & Coherencia de Personajes</span>
              </div>
              {showVisualBible ? (
                <ChevronUp className="w-4 h-4 text-zinc-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-zinc-500" />
              )}
            </button>

            {showVisualBible && (
              <div className="space-y-3 pt-2 text-xs border-t border-white/5">
                <div>
                  <span className="text-[10px] font-mono text-zinc-400 block mb-0.5 flex items-center gap-1">
                    <UserCheck className="w-3 h-3 text-emerald-400" /> Ancla Protagonista (EN):
                  </span>
                  <input
                    type="text"
                    value={visualBible.characterAnchor || ''}
                    onChange={(e) =>
                      onUpdateVisualBible?.({
                        ...visualBible,
                        characterAnchor: e.target.value,
                      })
                    }
                    className="w-full bg-[#11131C] border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-zinc-200 font-mono"
                    placeholder="Physical description of main protagonist..."
                  />
                </div>
                {visualBible.antagonistAnchor && (
                  <div>
                    <span className="text-[10px] font-mono text-zinc-400 block mb-0.5 flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-rose-400" /> Ancla Antagonista (EN):
                    </span>
                    <input
                      type="text"
                      value={visualBible.antagonistAnchor || ''}
                      onChange={(e) =>
                        onUpdateVisualBible?.({
                          ...visualBible,
                          antagonistAnchor: e.target.value,
                        })
                      }
                      className="w-full bg-[#11131C] border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-zinc-200 font-mono"
                      placeholder="Physical description of antagonist / intruder..."
                    />
                  </div>
                )}
                <div>
                  <span className="text-[10px] font-mono text-zinc-400 block mb-0.5">
                    Ancla Entorno (EN):
                  </span>
                  <input
                    type="text"
                    value={visualBible.environmentAnchor || ''}
                    onChange={(e) =>
                      onUpdateVisualBible?.({
                        ...visualBible,
                        environmentAnchor: e.target.value,
                      })
                    }
                    className="w-full bg-[#11131C] border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-zinc-200 font-mono"
                    placeholder="Recurring location and environment setting..."
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: 5-Act Audiovisual Script & Multimodal Scene Cards */}
      <div className="lg:col-span-7 bg-[#11131C] border border-white/10 rounded-2xl p-6 flex flex-col justify-between space-y-5">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Film className="w-4 h-4 text-violet-400" />
                Guion Audiovisual Cinemático ({scenes.length} escenas)
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Total palabras: <strong className="text-emerald-400 font-mono">{totalWords}</strong> (~
                {Math.round(totalWords / 2.5)}s estimados a ritmo pausado)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleApplyFiveActTemplate}
                className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
                title="Carga la plantilla de 5 actos virales de suspenso psicológico"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" /> Cargar Plantilla 5 Actos
              </button>

              <button
                type="button"
                onClick={() => {
                  const newIdx = scenes.length + 1;
                  onUpdateScenes((prev) => [
                    ...prev,
                    {
                      title: `Escena ${newIdx}: Plano cinematográfico`,
                      dialogue: 'Nueva línea de narración para la escena.',
                      cameraMotion: 'zoom_in',
                      motionIntensity: 'cinematic',
                      transition: 'cut',
                      stockKeywords: ['cinematic', 'suspense'],
                    },
                  ]);
                }}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-violet-300 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Añadir Escena
              </button>
            </div>
          </div>

          {scenes.length === 0 ? (
            <div className="bg-[#090A0F] border border-white/5 rounded-xl p-10 text-center space-y-3">
              <Sparkles className="w-10 h-10 text-violet-400 mx-auto" />
              <p className="text-sm font-semibold text-white">
                Aún no has generado las escenas del guion
              </p>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                Escribe tu tema y pulsa <strong>«Generar Guion con Estructura Viral»</strong> o pulsa{' '}
                <strong>«Cargar Plantilla 5 Actos»</strong> para cargar un guion cinematográfico de prueba.
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[560px] overflow-y-auto pr-1">
              {scenes.map((scene, idx) => {
                const badgeColor = getActBadgeColor(scene.actRole, idx);
                const isExpanded = !!expandedPrompts[idx];

                return (
                  <div
                    key={idx}
                    className="bg-[#090A0F] border border-white/10 hover:border-violet-500/40 rounded-xl p-4 space-y-3 transition-colors"
                  >
                    {/* Scene Header */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border uppercase ${badgeColor}`}
                        >
                          {scene.actRole || `ACTO ${idx + 1}`}
                        </span>

                        {scene.timeRange && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-zinc-300 flex items-center gap-1 border border-white/5">
                            <Clock className="w-3 h-3 text-zinc-400" />
                            {scene.timeRange}
                          </span>
                        )}

                        {scene.cameraMotion && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20">
                            {scene.cameraMotion} ({scene.motionIntensity || 'cinematic'})
                          </span>
                        )}

                        {scene.transition && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                            {scene.transition}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          onUpdateScenes((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="text-zinc-500 hover:text-red-400 cursor-pointer p-1"
                        title="Eliminar escena"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Field 1: Visual (Dirección cinematográfica en español) */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
                        <Film className="w-3.5 h-3.5 text-sky-400" />
                        <span>Visual (Planos, Iluminación y Acción en Español):</span>
                      </label>
                      <textarea
                        rows={2}
                        value={scene.visualDescription || scene.title}
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateScenes((prev) =>
                            prev.map((s, i) =>
                              i === idx ? { ...s, visualDescription: val, title: val.slice(0, 80) } : s
                            )
                          );
                        }}
                        placeholder="Descripción visual del plano, gestos y atmósfera en español..."
                        className="w-full bg-[#11131C] border border-white/10 rounded-lg p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-sky-500/60"
                      />
                    </div>

                    {/* Field 2 & Field 3 in 2 Columns: On-Screen Text & Sound Effect */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5 mb-1">
                          <Type className="w-3.5 h-3.5 text-amber-400" />
                          <span>Texto en Pantalla (Sticker Retención):</span>
                        </label>
                        <input
                          type="text"
                          value={scene.onScreenText || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            onUpdateScenes((prev) =>
                              prev.map((s, i) => (i === idx ? { ...s, onScreenText: val } : s))
                            );
                          }}
                          placeholder='Ej: "No querían entrar. Querían que ella abriera."'
                          className="w-full bg-[#11131C] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5 mb-1">
                          <Volume2 className="w-3.5 h-3.5 text-violet-400" />
                          <span>Efecto Sonoro (SFX Diegético):</span>
                        </label>
                        <input
                          type="text"
                          value={scene.soundEffect || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            onUpdateScenes((prev) =>
                              prev.map((s, i) => (i === idx ? { ...s, soundEffect: val } : s))
                            );
                          }}
                          placeholder="Ej: Tres toques secos de madera..."
                          className="w-full bg-[#11131C] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-violet-300 placeholder-zinc-600 focus:outline-none focus:border-violet-500/50"
                        />
                      </div>
                    </div>

                    {/* Field 4: Spoken Dialogue / Voiceover */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Voz en Off (Locución Limpia para Voz Neural):</span>
                        </label>
                        <span className="text-[10px] font-mono text-zinc-500">
                          {(scene.dialogue || '').split(/\s+/).filter(Boolean).length} palabras
                        </span>
                      </div>
                      <textarea
                        rows={3}
                        value={scene.dialogue}
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateScenes((prev) =>
                            prev.map((s, i) => (i === idx ? { ...s, dialogue: val } : s))
                          );
                        }}
                        placeholder="Texto limpio que leerá el sintetizador de voz neural..."
                        className="w-full bg-[#11131C] border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500/60 leading-relaxed font-sans"
                      />
                    </div>

                    {/* Accordion toggle for Image Prompt & Keywords */}
                    <div className="pt-1 border-t border-white/5">
                      <button
                        type="button"
                        onClick={() => togglePromptExpand(idx)}
                        className="text-[10px] font-mono text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3 h-3 text-zinc-500" />
                        {isExpanded ? 'Ocultar Prompts IA (EN)' : 'Ver Prompt de Cámara IA & B-Roll (EN)'}
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>

                      {isExpanded && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                          <div>
                            <span className="text-[10px] font-mono text-zinc-500 block mb-0.5">
                              Prompt IA Cinemático (EN):
                            </span>
                            <textarea
                              rows={2}
                              value={scene.imagePrompt || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                onUpdateScenes((prev) =>
                                  prev.map((s, i) => (i === idx ? { ...s, imagePrompt: val } : s))
                                );
                              }}
                              className="w-full bg-[#11131C] border border-white/10 rounded-lg p-2 text-[10px] text-zinc-300 font-mono"
                              placeholder="ARRI Alexa 35mm cinematic prompt..."
                            />
                          </div>

                          <div>
                            <span className="text-[10px] font-mono text-zinc-500 block mb-0.5">
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
                                onUpdateScenes((prev) =>
                                  prev.map((s, i) => (i === idx ? { ...s, stockKeywords: kws } : s))
                                );
                              }}
                              className="w-full bg-[#11131C] border border-white/10 rounded-lg px-2.5 py-1.5 text-[10px] text-emerald-300 font-mono"
                              placeholder="cinematic, suspense, night porch..."
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="pt-4 border-t border-white/10 flex justify-end">
          <button
            onClick={onNextStep}
            disabled={scenes.length === 0}
            className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-violet-600/20 transition-all"
          >
            Siguiente: Voz & Locución (Paso 2) <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
