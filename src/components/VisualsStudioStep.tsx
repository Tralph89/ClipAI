import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Cloud,
  Sparkles,
  Lock,
  Unlock,
  Sliders,
  RefreshCw,
  Check,
  Wand2,
  Image as ImageIcon,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Code2,
  Dice5,
  Eye,
  Layers,
  Terminal,
} from 'lucide-react';
import {
  AspectRatioType,
  ComfyArchitectureType,
  ComfyUIConfig,
  DEFAULT_COMFY_CONFIG,
  Scene,
  StyleTechnicalProfile,
  VIDEO_STYLES,
  VisualBible,
} from '../types';
import {
  buildStyleCoherentScenePrompt,
  checkComfyConnection,
  getComfyDimensions,
} from '../services/comfyService';

interface VisualsStudioStepProps {
  scenes: Scene[];
  selectedStyleId: string;
  aspectRatio: AspectRatioType;
  comfyConfig: ComfyUIConfig;
  visualBible?: VisualBible;
  isGeneratingAllImages: boolean;
  isCraftingPrompts: boolean;
  onSelectStyle: (styleId: string) => void;
  onUpdateComfyConfig: (next: ComfyUIConfig) => void;
  onUpdateVisualBible: (next: VisualBible) => void;
  onUpdateScene: (index: number, patch: Partial<Scene>) => void;
  onSyncVisualBibleWithAI: () => void;
  onGenerateSingleScene: (index: number) => void;
  onGenerateAllScenes: () => void;
  onPrevStep: () => void;
  onNextStep: () => void;
}

export const VisualsStudioStep: React.FC<VisualsStudioStepProps> = ({
  scenes,
  selectedStyleId,
  aspectRatio,
  comfyConfig,
  visualBible,
  isGeneratingAllImages,
  isCraftingPrompts,
  onSelectStyle,
  onUpdateComfyConfig,
  onUpdateVisualBible,
  onUpdateScene,
  onSyncVisualBibleWithAI,
  onGenerateSingleScene,
  onGenerateAllScenes,
  onPrevStep,
  onNextStep,
}) => {
  const [showComfySettings, setShowComfySettings] = useState(false);
  const [showBiblePanel, setShowBiblePanel] = useState(true);
  const [expandedScenePrompts, setExpandedScenePrompts] = useState<Record<number, boolean>>({});
  const [connectionState, setConnectionState] = useState<{
    checking: boolean;
    connected: boolean;
    checkpoints: string[];
    loras: string[];
    error?: string;
  }>({
    checking: false,
    connected: false,
    checkpoints: [
      'flux1-dev-fp8.safetensors',
      'flux1-schnell-fp8.safetensors',
      'juggernautXL_v9.safetensors',
      'realvisxlV40.safetensors',
    ],
    loras: ['None'],
  });

  const activeStyleProfile: StyleTechnicalProfile =
    VIDEO_STYLES.find((s) => s.id === selectedStyleId) || VIDEO_STYLES[0];
  const dims = getComfyDimensions(aspectRatio);

  const handleTestComfyConnection = async () => {
    setConnectionState((prev) => ({ ...prev, checking: true, error: undefined }));
    const res = await checkComfyConnection(comfyConfig);
    setConnectionState({
      checking: false,
      connected: res.connected,
      checkpoints: res.checkpoints.length
        ? res.checkpoints
        : [
            'flux1-dev-fp8.safetensors',
            'flux1-schnell-fp8.safetensors',
            'juggernautXL_v9.safetensors',
          ],
      loras: res.loras.length ? res.loras : ['None', activeStyleProfile.recommendedLoraHint],
      error: res.error,
    });
    if (res.connected && res.checkpoints.length > 0 && !res.checkpoints.includes(comfyConfig.checkpointName)) {
      onUpdateComfyConfig({
        ...comfyConfig,
        checkpointName: res.checkpoints[0],
      });
    }
  };

  // Auto-populate technical prompts whenever style or architecture changes if scenes don't have one yet
  useEffect(() => {
    scenes.forEach((s, idx) => {
      if (!s.comfyPositivePrompt) {
        const built = buildStyleCoherentScenePrompt(
          s.title,
          s.dialogue,
          selectedStyleId,
          comfyConfig.architecture,
          visualBible
        );
        onUpdateScene(idx, {
          comfyPositivePrompt: built.positive,
          comfyNegativePrompt: built.negative,
          seed: comfyConfig.seedLock
            ? comfyConfig.masterSeed
            : Math.floor(10000000 + Math.random() * 90000000),
        });
      }
    });
  }, [selectedStyleId, comfyConfig.architecture]);

  const handleRandomizeMasterSeed = () => {
    const nextSeed = Math.floor(10000000 + Math.random() * 90000000);
    onUpdateComfyConfig({ ...comfyConfig, masterSeed: nextSeed });
    if (comfyConfig.seedLock) {
      scenes.forEach((_, idx) => {
        onUpdateScene(idx, { seed: nextSeed });
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP ENGINE BAR: COMFYUI LOCAL GPU + CLOUD FALLBACK SWITCHER */}
      <div className="bg-[#11131C] border border-white/10 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                comfyConfig.enabled
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                  : 'bg-violet-500/15 border-violet-500/40 text-violet-400'
              }`}
            >
              {comfyConfig.enabled ? <Cpu className="w-5 h-5" /> : <Cloud className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Motor de Renderizado Visual: {comfyConfig.enabled ? 'ComfyUI en GPU Local' : 'Cloud IA (Gemini / Flux Cloud)'}
                </h2>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                    connectionState.connected
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : comfyConfig.autoFallbackToCloud
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      : 'bg-zinc-800 text-zinc-400 border-white/10'
                  }`}
                >
                  {connectionState.connected
                    ? 'GPU LOCAL CONECTADA'
                    : comfyConfig.enabled && comfyConfig.autoFallbackToCloud
                    ? 'COMFYUI + AUTO-FALLBACK CLOUD'
                    : 'MODO NUBE ACTIVO'}
                </span>
                <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-zinc-300 tabular-nums">
                  {dims.width}×{dims.height}px ({aspectRatio})
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Arquitectura activa:{' '}
                <span className="text-white font-mono font-semibold uppercase">
                  {comfyConfig.architecture === 'flux1'
                    ? `Flux.1 (Steps: ${comfyConfig.steps}, Guidance: ${comfyConfig.fluxGuidance})`
                    : comfyConfig.architecture === 'sdxl'
                    ? `SDXL + LoRA (Steps: ${comfyConfig.steps}, CFG: ${comfyConfig.cfg})`
                    : 'Custom Workflow JSON'}
                </span>{' '}
                • Semilla Maestra:{' '}
                <span className="text-emerald-400 font-mono font-semibold tabular-nums">
                  {comfyConfig.seedLock ? `Bloqueada (#${comfyConfig.masterSeed})` : 'Variable por escena'}
                </span>
              </p>
            </div>
          </div>

          {/* Engine Mode Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-[#090A0F] p-1 rounded-xl border border-white/10">
              <button
                onClick={() => onUpdateComfyConfig({ ...comfyConfig, enabled: true })}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  comfyConfig.enabled
                    ? 'bg-emerald-600 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" /> ComfyUI Local
              </button>
              <button
                onClick={() => onUpdateComfyConfig({ ...comfyConfig, enabled: false })}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  !comfyConfig.enabled
                    ? 'bg-violet-600 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Cloud className="w-3.5 h-3.5" /> Solo Cloud
              </button>
            </div>

            <button
              onClick={handleTestComfyConnection}
              disabled={connectionState.checking}
              className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${connectionState.checking ? 'animate-spin text-emerald-400' : ''}`}
              />
              {connectionState.checking ? 'Verificando GPU...' : 'Conectar GPU'}
            </button>

            <button
              onClick={() => setShowComfySettings(!showComfySettings)}
              className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                showComfySettings
                  ? 'bg-violet-600/20 border-violet-500 text-violet-300'
                  : 'bg-[#090A0F] border-white/10 text-zinc-300 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Ajustes ComfyUI / Workflow
            </button>
          </div>
        </div>

        {/* Expandable ComfyUI GPU & Workflow Configuration Panel */}
        {showComfySettings && (
          <div className="pt-4 border-t border-white/10 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1.5">
                  URL de tu Servidor ComfyUI
                </label>
                <input
                  type="text"
                  value={comfyConfig.serverUrl}
                  onChange={(e) =>
                    onUpdateComfyConfig({ ...comfyConfig, serverUrl: e.target.value })
                  }
                  placeholder="http://127.0.0.1:8188 o https://tu-tunel.trycloudflare.com"
                  className="w-full bg-[#090A0F] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1.5">
                  Modo de Conexión de Red
                </label>
                <select
                  value={comfyConfig.connectionMode}
                  onChange={(e) =>
                    onUpdateComfyConfig({
                      ...comfyConfig,
                      connectionMode: e.target.value as 'browser_direct' | 'server_proxy',
                    })
                  }
                  className="w-full bg-[#090A0F] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white"
                >
                  <option value="browser_direct">
                    Directo desde Navegador (localhost:8188 en tu PC)
                  </option>
                  <option value="server_proxy">
                    Proxy Servidor (Para Túnel Cloudflare / Ngrok HTTPS)
                  </option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1.5">
                  Arquitectura de Workflow ComfyUI
                </label>
                <select
                  value={comfyConfig.architecture}
                  onChange={(e) => {
                    const arch = e.target.value as ComfyArchitectureType;
                    onUpdateComfyConfig({
                      ...comfyConfig,
                      architecture: arch,
                      steps: arch === 'flux1' ? 20 : 25,
                      cfg: arch === 'flux1' ? 1.0 : 7.0,
                      samplerName: arch === 'flux1' ? 'euler' : 'dpmpp_2m',
                      scheduler: arch === 'flux1' ? 'simple' : 'karras',
                      checkpointName:
                        arch === 'flux1'
                          ? 'flux1-dev-fp8.safetensors'
                          : 'juggernautXL_v9.safetensors',
                    });
                  }}
                  className="w-full bg-[#090A0F] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white font-bold"
                >
                  <option value="flux1">Flux.1 (Dev / Schnell) — Máxima coherencia al prompt</option>
                  <option value="sdxl">SDXL / Juggernaut / Pony + Soporte LoRA por Estilo</option>
                  <option value="custom_json">Importar mi propio workflow_api.json</option>
                </select>
              </div>
            </div>

            {comfyConfig.architecture !== 'custom_json' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="lg:col-span-2">
                  <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">
                    Checkpoint / Modelo en GPU
                  </label>
                  <input
                    list="comfy-checkpoints-list"
                    value={comfyConfig.checkpointName}
                    onChange={(e) =>
                      onUpdateComfyConfig({ ...comfyConfig, checkpointName: e.target.value })
                    }
                    className="w-full bg-[#090A0F] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                  <datalist id="comfy-checkpoints-list">
                    {connectionState.checkpoints.map((cp) => (
                      <option key={cp} value={cp} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">
                    LoRA de Estilo (Opcional)
                  </label>
                  <input
                    list="comfy-loras-list"
                    value={comfyConfig.loraName}
                    onChange={(e) =>
                      onUpdateComfyConfig({ ...comfyConfig, loraName: e.target.value })
                    }
                    placeholder={activeStyleProfile.recommendedLoraHint}
                    className="w-full bg-[#090A0F] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                  <datalist id="comfy-loras-list">
                    {connectionState.loras.map((l) => (
                      <option key={l} value={l} />
                    ))}
                    <option value={activeStyleProfile.recommendedLoraHint} />
                  </datalist>
                </div>

                <div>
                  <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">
                    Steps & Sampler
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={comfyConfig.steps}
                      onChange={(e) =>
                        onUpdateComfyConfig({
                          ...comfyConfig,
                          steps: Number(e.target.value) || 20,
                        })
                      }
                      className="w-16 bg-[#090A0F] border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white font-mono tabular-nums"
                    />
                    <select
                      value={comfyConfig.samplerName}
                      onChange={(e) =>
                        onUpdateComfyConfig({ ...comfyConfig, samplerName: e.target.value })
                      }
                      className="flex-1 bg-[#090A0F] border border-white/10 rounded-xl px-2 py-2 text-xs text-white font-mono"
                    >
                      <option value="euler">euler</option>
                      <option value="euler_ancestral">euler_a</option>
                      <option value="dpmpp_2m">dpmpp_2m</option>
                      <option value="dpmpp_2m_sde">dpmpp_2m_sde</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-mono uppercase text-zinc-400 block mb-1">
                    {comfyConfig.architecture === 'flux1' ? 'Flux Guidance' : 'CFG Scale'}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min={1}
                    max={20}
                    value={
                      comfyConfig.architecture === 'flux1'
                        ? comfyConfig.fluxGuidance
                        : comfyConfig.cfg
                    }
                    onChange={(e) => {
                      const val = Number(e.target.value) || 3.5;
                      if (comfyConfig.architecture === 'flux1') {
                        onUpdateComfyConfig({ ...comfyConfig, fluxGuidance: val });
                      } else {
                        onUpdateComfyConfig({ ...comfyConfig, cfg: val });
                      }
                    }}
                    className="w-full bg-[#090A0F] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono tabular-nums"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs text-zinc-300 font-semibold block">
                  Pega tu `workflow_api.json` exportado desde ComfyUI (usa `{'{{POSITIVE_PROMPT}}'}`, `{'{{NEGATIVE_PROMPT}}'}`, `{'{{SEED}}'}`, `{'{{WIDTH}}'}`, `{'{{HEIGHT}}'}`):
                </label>
                <textarea
                  rows={5}
                  value={comfyConfig.customWorkflowJson || ''}
                  onChange={(e) =>
                    onUpdateComfyConfig({ ...comfyConfig, customWorkflowJson: e.target.value })
                  }
                  placeholder='{"1": {"inputs": {"ckpt_name": "flux1-dev.safetensors"}, "class_type": "CheckpointLoaderSimple"}, ...}'
                  className="w-full bg-[#090A0F] border border-white/10 rounded-xl p-3 text-xs font-mono text-zinc-200"
                />
              </div>
            )}

            {/* Helper command & Auto-Fallback toggle */}
            <div className="bg-[#090A0F] border border-white/5 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs text-zinc-400">
                <Terminal className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Comando recomendado para iniciar ComfyUI local:{' '}
                  <code className="text-emerald-300 font-mono bg-white/5 px-2 py-0.5 rounded">
                    python main.py --listen --enable-cors-header "*"
                  </code>
                </span>
              </div>

              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={comfyConfig.autoFallbackToCloud}
                  onChange={(e) =>
                    onUpdateComfyConfig({
                      ...comfyConfig,
                      autoFallbackToCloud: e.target.checked,
                    })
                  }
                  className="rounded border-white/20 text-violet-600 focus:ring-violet-500"
                />
                <span>Usar Cloud automáticamente si mi GPU está apagada</span>
              </label>
            </div>

            {connectionState.error && (
              <p className="text-xs text-amber-400 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{connectionState.error}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* 2. STYLE SELECTOR & VISUAL BIBLE COHERENCE ENGINE */}
      <div className="bg-[#11131C] border border-white/10 rounded-2xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-mono uppercase text-violet-400">
              Coherencia Estética de Principio a Fin
            </span>
            <h2 className="text-lg font-bold text-white">
              1. Estilo Visual Maestro y Biblia de Consistencia
            </h2>
            <p className="text-xs text-zinc-400">
              Al seleccionar un estilo, el Director de Prompts IA adapta cada escena con las reglas de cámara, paleta y exclusiones negativas del estilo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={onSyncVisualBibleWithAI}
              disabled={isCraftingPrompts || scenes.length === 0}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20"
            >
              {isCraftingPrompts ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Sincronizando Biblia Visual...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Sincronizar Biblia Visual y Prompts con IA
                </>
              )}
            </button>

            <button
              onClick={onGenerateAllScenes}
              disabled={isGeneratingAllImages || scenes.length === 0}
              className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-violet-600/20"
            >
              {isGeneratingAllImages ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Renderizando {scenes.length} Escenas...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  Generar Todas las Escenas ({scenes.length})
                </>
              )}
            </button>
          </div>
        </div>

        {/* 12 Verified Style Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {VIDEO_STYLES.map((styleItem) => {
            const isSelected = selectedStyleId === styleItem.id;
            return (
              <button
                key={styleItem.id}
                onClick={() => onSelectStyle(styleItem.id)}
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
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center shadow">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <div className="text-xs font-bold text-white truncate">{styleItem.name}</div>
                  <div className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">
                    {styleItem.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Style Technical Rules + Visual Bible & Seed Lock Box */}
        <div className="bg-[#090A0F] border border-white/10 rounded-xl p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-violet-500/15 border border-violet-500/30 text-violet-300 text-xs font-bold">
                Estilo Activo: {activeStyleProfile.name}
              </span>
              <span className="text-xs font-mono text-zinc-400 hidden sm:inline">
                LoRA sugerido: {activeStyleProfile.recommendedLoraHint}
              </span>
            </div>

            {/* Seed Lock Master Control */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const nextLock = !comfyConfig.seedLock;
                  onUpdateComfyConfig({ ...comfyConfig, seedLock: nextLock });
                  if (nextLock) {
                    scenes.forEach((_, i) => onUpdateScene(i, { seed: comfyConfig.masterSeed }));
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 border cursor-pointer ${
                  comfyConfig.seedLock
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-zinc-900 border-white/10 text-zinc-400'
                }`}
              >
                {comfyConfig.seedLock ? (
                  <>
                    <Lock className="w-3.5 h-3.5" /> Seed Lock Activo
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5" /> Seed Libre
                  </>
                )}
              </button>

              <input
                type="number"
                value={comfyConfig.masterSeed}
                onChange={(e) => {
                  const val = Number(e.target.value) || 42;
                  onUpdateComfyConfig({ ...comfyConfig, masterSeed: val });
                  if (comfyConfig.seedLock) {
                    scenes.forEach((_, i) => onUpdateScene(i, { seed: val }));
                  }
                }}
                className="w-28 bg-[#11131C] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white tabular-nums"
              />

              <button
                onClick={handleRandomizeMasterSeed}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 cursor-pointer"
                title="Generar nueva semilla maestra"
              >
                <Dice5 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Editable Visual Bible Anchors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-mono uppercase text-emerald-400 block mb-1">
                Ancla de Personaje / Sujeto Principal (Fijo en todas las escenas):
              </label>
              <input
                type="text"
                value={visualBible?.characterAnchor || ''}
                onChange={(e) =>
                  onUpdateVisualBible({
                    characterAnchor: e.target.value,
                    environmentAnchor: visualBible?.environmentAnchor || '',
                    colorPalette: visualBible?.colorPalette || '',
                    lightingDirective:
                      visualBible?.lightingDirective || activeStyleProfile.cameraAndLighting,
                  })
                }
                placeholder="Ej. 'a 30yo researcher in dark minimalist jacket, rim lighting' (Pulsa Sincronizar con IA para autocompletar)"
                className="w-full bg-[#11131C] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono uppercase text-violet-400 block mb-1">
                Ancla de Entorno, Época y Paleta de Color:
              </label>
              <input
                type="text"
                value={visualBible?.environmentAnchor || ''}
                onChange={(e) =>
                  onUpdateVisualBible({
                    characterAnchor: visualBible?.characterAnchor || '',
                    environmentAnchor: e.target.value,
                    colorPalette: visualBible?.colorPalette || '',
                    lightingDirective:
                      visualBible?.lightingDirective || activeStyleProfile.cameraAndLighting,
                  })
                }
                placeholder="Ej. 'futuristic dark glass studio with cyan and warm amber accents'"
                className="w-full bg-[#11131C] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div className="text-[11px] font-mono text-zinc-400 flex flex-wrap gap-x-6 gap-y-1 pt-1">
            <div>
              <span className="text-zinc-500">Directiva {comfyConfig.architecture.toUpperCase()}:</span>{' '}
              <span className="text-zinc-300">
                {comfyConfig.architecture === 'sdxl'
                  ? activeStyleProfile.sdxlTags
                  : activeStyleProfile.fluxPrefix}
              </span>
            </div>
            <div>
              <span className="text-red-400/80">Exclusiones (Negative):</span>{' '}
              <span className="text-zinc-400">{activeStyleProfile.negativePrompt}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. SCENE STORYBOARD CARDS WITH COMFYUI PROMPT INSPECTOR */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {scenes.map((scene, idx) => {
          const isExpanded = !!expandedScenePrompts[idx];
          const badgeLabel =
            scene.renderedBy === 'comfyui_flux'
              ? 'GPU Local • Flux.1'
              : scene.renderedBy === 'comfyui_sdxl'
              ? 'GPU Local • SDXL'
              : scene.renderedBy === 'comfyui_custom'
              ? 'GPU Local • Custom'
              : scene.imageUrl
              ? 'Cloud Coherente'
              : null;

          return (
            <div
              key={idx}
              className="bg-[#11131C] border border-white/10 rounded-2xl overflow-hidden flex flex-col justify-between"
            >
              <div>
                {/* Preview Canvas / Image */}
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
                        Escena #{idx + 1} lista para renderizar ({activeStyleProfile.name})
                      </span>
                    </div>
                  )}

                  {scene.isGeneratingImage && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2 p-4 text-center">
                      <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
                      <span className="text-xs font-mono text-white">
                        {comfyConfig.enabled
                          ? `Renderizando en ComfyUI (${comfyConfig.architecture.toUpperCase()})...`
                          : 'Generando con Estilo Coherente...'}
                      </span>
                    </div>
                  )}

                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono font-bold text-white">
                      Escena {idx + 1}
                    </span>
                    {badgeLabel && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-mono font-bold text-emerald-300 backdrop-blur-sm">
                        {badgeLabel}
                        {scene.renderTimeMs ? ` (${(scene.renderTimeMs / 1000).toFixed(1)}s)` : ''}
                      </span>
                    )}
                  </div>

                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/75 text-[10px] font-mono text-zinc-300 tabular-nums">
                    Seed: {scene.seed || comfyConfig.masterSeed}
                  </span>
                </div>

                {/* Scene Summary & Collapsible ComfyUI Technical Prompt Editor */}
                <div className="p-4 space-y-3">
                  <div>
                    <p className="text-xs font-bold text-zinc-100 line-clamp-2">{scene.title}</p>
                    <p className="text-xs text-zinc-400 italic line-clamp-2 mt-1">
                      "{scene.dialogue}"
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      setExpandedScenePrompts((prev) => ({
                        ...prev,
                        [idx]: !prev[idx],
                      }))
                    }
                    className="w-full py-1.5 px-3 rounded-lg bg-[#090A0F] border border-white/10 text-[11px] font-mono text-violet-300 hover:text-white flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <Code2 className="w-3.5 h-3.5" />
                      Prompt Técnico ComfyUI ({comfyConfig.architecture.toUpperCase()})
                    </span>
                    <span>{isExpanded ? 'Ocultar' : 'Editar Prompt'}</span>
                  </button>

                  {isExpanded && (
                    <div className="bg-[#090A0F] border border-white/10 rounded-xl p-3 space-y-2.5">
                      <div>
                        <label className="text-[10px] font-mono uppercase text-emerald-400 block mb-1">
                          Positive Prompt (Coherente con {activeStyleProfile.name}):
                        </label>
                        <textarea
                          rows={3}
                          value={scene.comfyPositivePrompt || ''}
                          onChange={(e) =>
                            onUpdateScene(idx, { comfyPositivePrompt: e.target.value })
                          }
                          className="w-full bg-[#11131C] border border-white/10 rounded-lg p-2 text-[11px] font-mono text-zinc-200"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-mono uppercase text-red-400 block mb-1">
                          Negative Prompt (Exclusiones de Estilo):
                        </label>
                        <textarea
                          rows={2}
                          value={
                            scene.comfyNegativePrompt || activeStyleProfile.negativePrompt
                          }
                          onChange={(e) =>
                            onUpdateScene(idx, { comfyNegativePrompt: e.target.value })
                          }
                          className="w-full bg-[#11131C] border border-white/10 rounded-lg p-2 text-[11px] font-mono text-zinc-400"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono text-zinc-400">
                          Semilla de Escena:
                        </span>
                        <input
                          type="number"
                          value={scene.seed || comfyConfig.masterSeed}
                          onChange={(e) =>
                            onUpdateScene(idx, { seed: Number(e.target.value) || 42 })
                          }
                          className="w-28 bg-[#11131C] border border-white/10 rounded px-2 py-1 text-xs font-mono text-white tabular-nums"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 pt-0">
                <button
                  onClick={() => onGenerateSingleScene(idx)}
                  disabled={scene.isGeneratingImage}
                  className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-violet-600 text-zinc-200 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  {comfyConfig.enabled ? (
                    <Cpu className="w-3.5 h-3.5" />
                  ) : (
                    <Wand2 className="w-3.5 h-3.5" />
                  )}
                  {scene.imageUrl
                    ? `Regenerar en ${comfyConfig.enabled ? 'ComfyUI / Cloud' : 'Cloud'}`
                    : `Renderizar Escena #${idx + 1}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation Footer */}
      <div className="flex justify-between pt-2">
        <button
          onClick={onPrevStep}
          className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" /> Anterior: Voz & Música
        </button>
        <button
          onClick={onNextStep}
          className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
        >
          Siguiente: Animación <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
