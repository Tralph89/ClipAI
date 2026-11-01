import React, { useState } from 'react';
import {
  Cpu,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Zap,
  Eye,
  Send,
  KeyRound,
  Save,
  Volume2,
  Terminal,
} from 'lucide-react';
import {
  AIProviderId,
  AppSettings,
  PublishAutoMode,
  SystemStatus,
} from '../types';
import {
  fetchSystemStatus,
  saveAppSettings,
  testAIMotorConnection,
} from '../services/apiService';

interface EngineSettingsViewProps {
  settings: AppSettings;
  systemStatus: SystemStatus | null;
  onUpdateSettings: (next: AppSettings) => void;
  onUpdateSystemStatus: (next: SystemStatus) => void;
}

function formatGigabytes(bytes: number): string {
  if (!bytes) return '';
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

export const EngineSettingsView: React.FC<EngineSettingsViewProps> = ({
  settings,
  systemStatus,
  onUpdateSettings,
  onUpdateSystemStatus,
}) => {
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isRefreshingTools, setIsRefreshingTools] = useState(false);
  const [isTestingAI, setIsTestingAI] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
    sample?: string;
  } | null>(null);

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const saved = await saveAppSettings(draft);
      onUpdateSettings(saved);
      setDraft(saved);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefreshDiagnostics = async () => {
    setIsRefreshingTools(true);
    try {
      const status = await fetchSystemStatus();
      onUpdateSystemStatus(status);
    } finally {
      setIsRefreshingTools(false);
    }
  };

  const handleTestAI = async () => {
    setIsTestingAI(true);
    setTestResult(null);
    try {
      // Save current draft first so backend uses latest URL/keys/model
      const saved = await saveAppSettings(draft);
      onUpdateSettings(saved);

      const modelOverride =
        draft.primaryProvider === 'ollama'
          ? draft.ollamaModel
          : draft.primaryProvider === 'groq'
          ? draft.groqModel
          : draft.geminiModel;

      const res = await testAIMotorConnection(draft.primaryProvider, modelOverride);
      setTestResult({
        ok: true,
        message: `Conectado con ${res.providerUsed.toUpperCase()} (${res.modelUsed}) en ${res.latencyMs} ms`,
        sample: res.sampleOutput,
      });
    } catch (err: any) {
      setTestResult({
        ok: false,
        message: err.message || 'No se pudo conectar con el motor IA.',
      });
    } finally {
      setIsTestingAI(false);
    }
  };

  const ollamaModels = systemStatus?.ollamaModels || [];

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Header */}
      <div className="bg-[#11131C] border border-white/10 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 block mb-1">
            Arquitectura Local & APIs Gratuitas ($0)
          </span>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Cpu className="w-6 h-6 text-violet-400" />
            Motores Locales, IA y Automatización
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Configura tu motor principal en <strong className="text-white">Ollama Local</strong>, revisa las herramientas instaladas en tu PC y define el comportamiento del botón de 1 clic.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRefreshDiagnostics}
            disabled={isRefreshingTools}
            className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshingTools ? 'animate-spin' : ''}`} />
            Re-escanear PC
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-violet-600/20"
          >
            {saveSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                ¡Ajustes Guardados!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isSaving ? 'Guardando...' : 'Guardar Configuración'}
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Primary AI Engine + 1-Click Mode */}
        <div className="lg:col-span-7 space-y-6">
          {/* Primary AI Router Card */}
          <div className="bg-[#11131C] border border-white/10 rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  1. Motor Principal de Inteligencia Artificial
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Usado para redactar guiones virales, hooks, subtítulos y copy de YouTube, TikTok y Facebook.
                </p>
              </div>
              {systemStatus?.ollamaReachable ? (
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono font-bold">
                  Ollama Online {systemStatus.ollamaVersion ? `v${systemStatus.ollamaVersion}` : ''}
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-[11px] font-mono font-bold">
                  Ollama Offline
                </span>
              )}
            </div>

            {/* Provider Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: 'ollama' as AIProviderId,
                  title: 'Ollama Local',
                  sub: '100% Gratis • Sin Cuotas',
                  badge: 'PRINCIPAL',
                },
                {
                  id: 'gemini' as AIProviderId,
                  title: 'Gemini Free API',
                  sub: 'Nube Gratuita Google',
                },
                {
                  id: 'groq' as AIProviderId,
                  title: 'Groq Free API',
                  sub: 'Inferencia Ultrarrápida',
                },
              ].map((prov) => {
                const active = draft.primaryProvider === prov.id;
                return (
                  <button
                    type="button"
                    key={prov.id}
                    onClick={() => setDraft((prev) => ({ ...prev, primaryProvider: prov.id }))}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      active
                        ? 'bg-violet-600/20 border-violet-500 text-white'
                        : 'bg-[#090A0F] border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{prov.title}</span>
                      {prov.badge && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                          {prov.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1">{prov.sub}</p>
                  </button>
                );
              })}
            </div>

            {/* Ollama Specific Config */}
            <div className="bg-[#090A0F] border border-white/10 rounded-xl p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                    Modelo Local en Ollama ({ollamaModels.length} detectados)
                  </label>
                  {ollamaModels.length > 0 ? (
                    <select
                      value={draft.ollamaModel}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, ollamaModel: e.target.value }))
                      }
                      className="w-full bg-[#11131C] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-violet-500"
                    >
                      {ollamaModels.map((m) => (
                        <option key={m.name} value={m.name}>
                          {m.name} {m.parameterSize ? `(${m.parameterSize})` : ''} —{' '}
                          {formatGigabytes(m.sizeBytes)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={draft.ollamaModel}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, ollamaModel: e.target.value }))
                      }
                      placeholder="gemma4:12b"
                      className="w-full bg-[#11131C] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white font-mono"
                    />
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                    Endpoint Local de Ollama
                  </label>
                  <input
                    type="url"
                    value={draft.ollamaBaseUrl}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, ollamaBaseUrl: e.target.value }))
                    }
                    className="w-full bg-[#11131C] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1.5">
                    Motor de Respaldo Automático (Fallback)
                  </label>
                  <select
                    value={draft.fallbackProvider}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        fallbackProvider: e.target.value as AIProviderId | 'none',
                      }))
                    }
                    className="w-full bg-[#11131C] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="none">Sin respaldo externo (100% Local)</option>
                    <option value="gemini">Gemini Free API (si está configurada)</option>
                    <option value="groq">Groq Free API (si está configurada)</option>
                    <option value="ollama">Ollama Local</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-zinc-400 flex items-center gap-1 mb-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-violet-400" /> Motor de Voz Predeterminado
                  </label>
                  <select
                    value={draft.defaultVoiceEngine}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        defaultVoiceEngine: e.target.value as AppSettings['defaultVoiceEngine'],
                      }))
                    }
                    className="w-full bg-[#11131C] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="piper">Piper Neural HD ONNX (100% Local • Recomendado)</option>
                    <option value="edge-tts">Edge-TTS Neural (Respaldo automático a Piper)</option>
                    <option value="gemini-tts">Gemini TTS (Requiere API Key)</option>
                  </select>
                </div>
              </div>

              <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleTestAI}
                  disabled={isTestingAI}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isTestingAI ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Probando respuesta en vivo...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Probar Conexión con Motor IA ({draft.primaryProvider})
                    </>
                  )}
                </button>
              </div>

              {testResult && (
                <div
                  className={`rounded-xl p-3.5 border text-xs space-y-1.5 ${
                    testResult.ok
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-red-500/10 border-red-500/30 text-red-300'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    {testResult.ok ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{testResult.message}</span>
                  </div>
                  {testResult.sample && (
                    <p className="text-zinc-200 italic pl-5">
                      Ejemplo generado: "{testResult.sample}"
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 1-Click Automation Behavior Card */}
          <div className="bg-[#11131C] border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="text-base font-bold text-white">
              2. Comportamiento del Flujo «1 Clic» (YouTube, TikTok y Facebook)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  id: 'review_first' as PublishAutoMode,
                  icon: Eye,
                  title: '1 Clic con Vista Previa',
                  desc: 'Genera guion, voz, visuales, MP4 y copy automáticamente, y pausa para que apruebes la subida con 1 clic.',
                },
                {
                  id: 'auto_publish' as PublishAutoMode,
                  icon: Send,
                  title: 'Publicación Directa Automática',
                  desc: 'Ejecuta todo el pipeline y publica inmediatamente en YouTube, TikTok y Facebook al finalizar el render.',
                },
              ].map((item) => {
                const Icon = item.icon;
                const selected = draft.publishAutoMode === item.id;
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() =>
                      setDraft((prev) => ({ ...prev, publishAutoMode: item.id }))
                    }
                    className={`p-4 rounded-xl border text-left space-y-1.5 transition-all cursor-pointer ${
                      selected
                        ? 'bg-violet-600/20 border-violet-500 text-white'
                        : 'bg-[#090A0F] border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <Icon className="w-4 h-4 text-violet-400" />
                      <span>{item.title}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">{item.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Free API Keys */}
          <div className="bg-[#11131C] border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-violet-400" />
              <h2 className="text-base font-bold text-white">
                3. APIs Gratuitas Opcionales (Respaldo & Videos Stock B-Roll)
              </h2>
            </div>
            <p className="text-xs text-zinc-400">
              No son obligatorias: el motor visual usa <strong className="text-zinc-200">FLUX.1-schnell ($0)</strong> y <strong className="text-zinc-200">Wikimedia / NASA HD ($0)</strong> sin claves, pero puedes añadir Pexels/Pixabay o tu instancia local de Stable Diffusion / Forge.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">
                  Gemini API Key (Free Tier - Opcional)
                </label>
                <input
                  type="password"
                  value={draft.geminiApiKey || ''}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, geminiApiKey: e.target.value }))
                  }
                  placeholder="AIzaSy..."
                  className="w-full bg-[#090A0F] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">
                  Groq API Key (Free Tier - Opcional)
                </label>
                <input
                  type="password"
                  value={draft.groqApiKey || ''}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, groqApiKey: e.target.value }))
                  }
                  placeholder="gsk_..."
                  className="w-full bg-[#090A0F] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">
                  Pexels API Key (Videos Stock HD Gratis - Opcional)
                </label>
                <input
                  type="password"
                  value={draft.pexelsApiKey || ''}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, pexelsApiKey: e.target.value }))
                  }
                  placeholder="Clave gratuita de pexels.com/api"
                  className="w-full bg-[#090A0F] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">
                  Pixabay API Key (Videos Stock HD Gratis - Opcional)
                </label>
                <input
                  type="password"
                  value={draft.pixabayApiKey || ''}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, pixabayApiKey: e.target.value }))
                  }
                  placeholder="Clave gratuita de pixabay.com/api/docs"
                  className="w-full bg-[#090A0F] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-zinc-400 block mb-1">
                  Stable Diffusion WebUI / Forge Local URL (Opcional • Prioridad #1 en Imágenes)
                </label>
                <input
                  type="text"
                  value={draft.localSdUrl || ''}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, localSdUrl: e.target.value }))
                  }
                  placeholder="http://127.0.0.1:7860 (déjalo vacío para usar FLUX.1-schnell gratuito)"
                  className="w-full bg-[#090A0F] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Local System Tools & Disk Persistence Status */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#11131C] border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                Herramientas Locales en tu PC
              </h2>
              <span className="text-xs font-mono text-emerald-400 font-bold">
                {(systemStatus?.tools || []).filter((t) => t.available).length}/
                {(systemStatus?.tools || []).length} Activas
              </span>
            </div>

            <div className="space-y-2.5">
              {(systemStatus?.tools || []).map((tool) => (
                <div
                  key={tool.id}
                  className="bg-[#090A0F] border border-white/10 rounded-xl p-3.5 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{tool.name}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">{tool.role}</p>
                    {tool.path && (
                      <p className="text-[10px] font-mono text-zinc-500 truncate mt-1" title={tool.path}>
                        {tool.path}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                      tool.available
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    {tool.available ? 'DETECTADO' : 'NO DETECTADO'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#11131C] border border-white/10 rounded-2xl p-6 space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-violet-400" />
              Almacenamiento Persistente en Disco
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Los proyectos, audios neurales, imágenes y videos renderizados ahora se guardan directamente en tu disco duro local (sin el límite de 5 MB de <code className="text-zinc-200">localStorage</code> ni pérdida de videos al recargar).
            </p>
            <div className="bg-[#090A0F] border border-white/10 rounded-xl p-3.5 space-y-2 text-xs font-mono">
              <div className="flex justify-between gap-2">
                <span className="text-zinc-500">Directorio:</span>
                <span className="text-zinc-200 truncate">{systemStatus?.storageDir || 'data/'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-zinc-500">Archivos Multimedia en Disco:</span>
                <span className="text-emerald-400 font-bold tabular-nums">
                  {systemStatus?.mediaCount ?? 0} archivos
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};

