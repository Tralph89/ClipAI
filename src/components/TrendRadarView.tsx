import React, { useState, useEffect } from 'react';
import {
  Flame,
  Search,
  ExternalLink,
  ArrowUpRight,
  Globe,
  RefreshCw,
  Wand2,
  TrendingUp,
  Layers,
  Copy,
  Check,
  Radio,
  Zap,
  Star,
  FileText,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Sparkles,
  Video,
  Bookmark,
  Trash2,
  Eye,
  ShieldCheck,
  Newspaper,
  BookOpen,
} from 'lucide-react';
import {
  AspectRatioType,
  SOCIAL_PLATFORMS,
  SocialChannel,
  TrendItem,
  SavedTrendIdea,
  TrendScanTelemetry,
} from '../types';
import {
  searchLiveTrends,
  transcribeVideoUrl,
  transcribeRawText,
  fetchSavedTrends,
  saveTrendIdeaApi,
  deleteSavedTrendApi,
  VideoTranscriptionData,
} from '../services/apiService';

interface TrendRadarViewProps {
  activeChannel: SocialChannel;
  trends: TrendItem[];
  onUpdateTrends: (newTrends: TrendItem[]) => void;
  onCreateVideoFromTrend: (trend: TrendItem, chosenRatio: AspectRatioType) => void;
}

/**
 * Generates dynamic, contextual sub-niches strictly tailored to the active channel's profile.
 */
export function getChannelNiches(channel: SocialChannel): string[] {
  const nicheLower = (channel.niche || '').toLowerCase();
  const nameLower = (channel.name || '').toLowerCase();

  if (
    nicheLower.includes('terror') ||
    nicheLower.includes('misterio') ||
    nicheLower.includes('paranormal') ||
    nameLower.includes('archivo') ||
    nameLower.includes('noche')
  ) {
    return [
      'Casos Reales & Llamadas al 911',
      'Relatos de la Noche & Testimonios',
      'Expedientes Desclasificados & Sin Resolver',
      'Leyendas Urbanas & Folclore Oscuro',
      'Dross / Enigmas & Casas Embrujadas',
      'Misterios Históricos & Objetos Malditos',
    ];
  }

  if (
    nicheLower.includes('tecnología') ||
    nicheLower.includes('ia') ||
    nicheLower.includes('inteligencia') ||
    nicheLower.includes('tech') ||
    nicheLower.includes('software')
  ) {
    return [
      'Agentes de IA & Modelos Nuevos',
      'Robótica & Automatización',
      'Startups & Negocios de Silicon Valley',
      'Ciberseguridad & Hacks Virales',
      'Gadgets del Futuro',
      'Productividad & Dev Tools',
    ];
  }

  if (
    nicheLower.includes('finanza') ||
    nicheLower.includes('dinero') ||
    nicheLower.includes('cripto') ||
    nicheLower.includes('negocio') ||
    nicheLower.includes('inversión')
  ) {
    return [
      'Bitcoin & Cripto hoy',
      'Estrategias de Inversión',
      'Historias de Negocios & Fraudes',
      'Bolsa & Macroeconomía',
      'Errores Financieros Virales',
      'Emprendimiento Real & Casos de Éxito',
    ];
  }

  if (
    nicheLower.includes('crimen') ||
    nicheLower.includes('polic') ||
    nicheLower.includes('investigaci')
  ) {
    return [
      'Juicios & Sentencias Reales',
      'Desapariciones Inexplicables',
      'Casos Forenses Resueltos',
      'Interrogatorios Policiales Reales',
      'Asesinos Seriales & Perfiles Criminales',
      'Llamadas de Emergencia Críticas',
    ];
  }

  if (
    nicheLower.includes('ciencia') ||
    nicheLower.includes('curiosidad') ||
    nicheLower.includes('espacio') ||
    nicheLower.includes('historia')
  ) {
    return [
      'Descubrimientos Espaciales & Telescopio Webb',
      'Secretos Ocultos de la Historia',
      'Misterios del Océano Profundo',
      'Experimentos Científicos Asombrosos',
      'Psicología & Paradojas Mentales',
      'Datos Fascinantes que Pocos Conocen',
    ];
  }

  // Fallback tailored to channel's custom title / keywords
  const words = (channel.niche || channel.name).split(/[,.\s]+/).filter((w) => w.length > 4);
  return [
    `Tendencias Virales de ${channel.name}`,
    `Noticias Recientes de ${words[0] || 'Actualidad'}`,
    `Debates Populares en ${channel.name}`,
    `Casos y Novedades de ${words[1] || 'Impacto'}`,
    `Guías y Preguntas Frecuentes`,
    `Lo Más Compartido Hoy`,
  ];
}

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  google_news: {
    label: 'Google News',
    color: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  },
  google_trends: {
    label: 'Google Trends',
    color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  youtube: {
    label: 'YouTube (yt-dlp)',
    color: 'bg-red-500/15 text-red-300 border-red-500/30',
  },
  reddit: {
    label: 'Reddit Hot',
    color: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  },
  hackernews: {
    label: 'Hacker News',
    color: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
};

export const TrendRadarView: React.FC<TrendRadarViewProps> = ({
  activeChannel,
  trends,
  onUpdateTrends,
  onCreateVideoFromTrend,
}) => {
  const channelNiches = getChannelNiches(activeChannel);

  // Active Radar Tab: 'live' or 'saved'
  const [activeTab, setActiveTab] = useState<'live' | 'saved'>('live');
  const [savedTrends, setSavedTrends] = useState<SavedTrendIdea[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);

  // Search and Niche States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNiche, setSelectedNiche] = useState(channelNiches[0] || activeChannel.niche);
  const [region, setRegion] = useState('Global / Español');
  const [radarMode, setRadarMode] = useState<'niche' | 'breaking'>('niche');
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<TrendScanTelemetry | null>(null);
  const [selectedRatios, setSelectedRatios] = useState<Record<string, AspectRatioType>>({});
  const [copiedHookId, setCopiedHookId] = useState<string | null>(null);

  // Expanded Dossier Details per Card
  const [expandedDossierIds, setExpandedDossierIds] = useState<Record<string, boolean>>({});

  // Universal Extractor State (Video URL vs Raw Text)
  const [extractorMode, setExtractorMode] = useState<'url' | 'text'>('url');
  const [directUrl, setDirectUrl] = useState('');
  const [rawTextInput, setRawTextInput] = useState('');
  const [rawTextTitle, setRawTextTitle] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState<VideoTranscriptionData | null>(null);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [showFullTranscript, setShowFullTranscript] = useState(false);

  // When activeChannel changes, automatically adapt the selected niche
  useEffect(() => {
    const niches = getChannelNiches(activeChannel);
    setSelectedNiche(niches[0] || activeChannel.niche);
    loadSavedTrends();
  }, [activeChannel.id]);

  const loadSavedTrends = async () => {
    setIsLoadingSaved(true);
    try {
      const list = await fetchSavedTrends(activeChannel.id);
      setSavedTrends(list);
    } catch {
      // Ignore initial load failure
    } finally {
      setIsLoadingSaved(false);
    }
  };

  const handleToggleSaveTrend = async (trend: TrendItem) => {
    const isAlreadySaved = savedTrends.some((t) => t.id === trend.id);
    if (isAlreadySaved) {
      // Remove
      setSavedTrends((prev) => prev.filter((t) => t.id !== trend.id));
      await deleteSavedTrendApi(trend.id).catch(() => {});
    } else {
      // Save
      const idea: SavedTrendIdea = {
        ...trend,
        channelId: activeChannel.id,
        savedAt: Date.now(),
        isSaved: true,
      };
      setSavedTrends((prev) => [idea, ...prev]);
      await saveTrendIdeaApi(idea).catch(() => {});
    }
  };

  const handleTranscribeDirectUrl = async () => {
    if (!directUrl.trim()) return;
    setIsTranscribing(true);
    setTranscriptionError(null);
    try {
      const data = await transcribeVideoUrl(directUrl.trim());
      setTranscriptionResult(data);
    } catch (err: any) {
      setTranscriptionError(err.message || 'Error al transcribir el video.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleStructureRawText = async () => {
    if (!rawTextInput.trim()) return;
    setIsTranscribing(true);
    setTranscriptionError(null);
    try {
      const data = await transcribeRawText({
        text: rawTextInput.trim(),
        customTitle: rawTextTitle.trim() || undefined,
        channelTone: activeChannel.tone,
        channelNiche: activeChannel.niche,
      });
      setTranscriptionResult(data);
    } catch (err: any) {
      setTranscriptionError(err.message || 'Error al procesar el texto.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleCreateVideoFromTranscription = (chosenRatio: AspectRatioType) => {
    if (!transcriptionResult) return;
    const syntheticTrend: TrendItem = {
      id: 'transcribe-' + Date.now(),
      title: transcriptionResult.title,
      summary: transcriptionResult.summary,
      detailedContent: transcriptionResult.transcript,
      contentType: extractorMode === 'url' ? 'video_transcript' : 'news_dossier',
      evidencePoints: transcriptionResult.mysteryElements,
      viralScore: 98,
      category: activeChannel.name + ' / Exclusiva',
      whyTrending: 'Material de referencia con transcripción y datos estructurados para ' + activeChannel.name,
      suggestedHook: transcriptionResult.suggestedHook,
      angle: transcriptionResult.angle || activeChannel.tone,
      recommendedFormats: transcriptionResult.recommendedFormats || ['9:16', '16:9'],
      recommendedPlatforms: activeChannel.platforms,
      keywords: [activeChannel.name, ...transcriptionResult.mysteryElements],
      sources: [{ title: transcriptionResult.uploader, uri: transcriptionResult.url }],
      trafficBadge: Math.round(transcriptionResult.durationSec / 60) + ' min analizados',
      sourceTypes: [extractorMode === 'url' ? 'youtube' : 'google_news'],
      detectedAt: Date.now(),
      fullTranscript: transcriptionResult.transcript,
    };
    onCreateVideoFromTrend(syntheticTrend, chosenRatio);
  };

  const handleRunLiveSearch = async (
    customQuery?: string,
    customNiche?: string,
    customMode?: 'niche' | 'breaking'
  ) => {
    const effectiveMode = customMode || radarMode;
    setIsSearching(true);
    setErrorMsg(null);
    try {
      const result = await searchLiveTrends({
        query: customQuery !== undefined ? customQuery : searchQuery,
        niche: customNiche || selectedNiche,
        channelName: activeChannel.name,
        channelNiche: activeChannel.niche,
        channelTone: activeChannel.tone,
        region,
        platforms: activeChannel.platforms,
        mode: effectiveMode,
      });

      if (result.telemetry) {
        setTelemetry(result.telemetry);
      }
      if (result.trends && result.trends.length > 0) {
        onUpdateTrends(result.trends);
      } else {
        setErrorMsg('No se encontraron señales recientes para este criterio. Prueba con otra palabra clave.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al recolectar señales en vivo.');
    } finally {
      setIsSearching(false);
    }
  };

  const getRatioForTrend = (trend: TrendItem): AspectRatioType => {
    return selectedRatios[trend.id] || activeChannel.defaultAspectRatio || '9:16';
  };

  const handleCopyHook = (id: string, hook: string) => {
    navigator.clipboard.writeText(hook);
    setCopiedHookId(id);
    setTimeout(() => setCopiedHookId(null), 1800);
  };

  const toggleDossierExpand = (id: string) => {
    setExpandedDossierIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const displayTrends = activeTab === 'saved' ? savedTrends : trends;

  return (
    <div className="space-y-6">
      {/* 1. Header & Live Multi-Source Search Control Panel */}
      <div className="bg-[#11131C] border border-white/10 rounded-2xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-white/10">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-emerald-400 text-xs font-mono uppercase tracking-wider mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Radar Ad-Hoc $0 • 5 Fuentes En Vivo • Google Trends • News • YouTube • Reddit</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Radar de Tendencias Virales
              <span
                className="text-xs px-2.5 py-1 rounded-full font-mono font-bold"
                style={{ backgroundColor: `${activeChannel.accentColor}25`, color: activeChannel.accentColor }}
              >
                {activeChannel.name}
              </span>
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Búsquedas ad-hoc y análisis exhaustivo alineado con el nicho:{' '}
              <span className="text-zinc-200 font-semibold">{activeChannel.niche}</span>.
            </p>
          </div>

          {/* Tab Switch: Tendencias en Vivo vs Ideas Guardadas */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#090A0F] border border-white/10 rounded-xl p-1">
              <button
                onClick={() => setActiveTab('live')}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'live' ? 'bg-violet-600 text-white shadow-md' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                Tendencias en Vivo
              </button>
              <button
                onClick={() => {
                  setActiveTab('saved');
                  loadSavedTrends();
                }}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'saved' ? 'bg-amber-600 text-white shadow-md' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Star className="w-3.5 h-3.5 fill-current" />
                Ideas Guardadas ({savedTrends.length})
              </button>
            </div>
          </div>
        </div>

        {/* 2. Control Bar (Mode, Region, Scan Button) */}
        {activeTab === 'live' && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-[#090A0F] border border-white/10 rounded-xl p-1">
                <button
                  onClick={() => setRadarMode('niche')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    radarMode === 'niche' ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Por Nicho del Canal
                </button>
                <button
                  onClick={() => {
                    setRadarMode('breaking');
                    handleRunLiveSearch('', selectedNiche, 'breaking');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    radarMode === 'breaking' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  Picos de Búsqueda del Día
                </button>
              </div>

              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="bg-[#090A0F] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-medium text-zinc-200 focus:outline-none focus:border-violet-500"
              >
                <option value="Global / Español">Hispanoamérica & España</option>
                <option value="México y Latinoamérica">México & Centroamérica</option>
                <option value="España">España</option>
                <option value="Argentina">Argentina</option>
                <option value="Colombia">Colombia</option>
                <option value="Estados Unidos (US Trends)">EE. UU. (Global)</option>
              </select>
            </div>

            <button
              onClick={() => handleRunLiveSearch()}
              disabled={isSearching}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-violet-600/25 border border-violet-400/30"
            >
              {isSearching ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Escaneando Ad-Hoc ({activeChannel.name})...
                </>
              ) : (
                <>
                  <Flame className="w-4 h-4 text-amber-300" />
                  Escanear Tendencias Ahora
                </>
              )}
            </button>
          </div>
        )}

        {/* 3. EXTRACTOR UNIVERSAL (Enlace de Video O Pegar Texto Libre) */}
        <div className="bg-gradient-to-r from-red-950/30 via-[#160b10] to-[#0c0d14] border border-red-500/30 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-red-500/20">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-red-400 bg-red-500/10 border border-red-500/30 px-2.5 py-1 rounded-full">
                Extractor Universal de Casos & Relatos
              </span>
            </div>
            <div className="flex items-center bg-black/40 border border-white/10 rounded-lg p-0.5">
              <button
                onClick={() => setExtractorMode('url')}
                className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                  extractorMode === 'url' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                🎥 Enlace de Video
              </button>
              <button
                onClick={() => setExtractorMode('text')}
                className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                  extractorMode === 'text' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                📄 Pegar Texto / Artículo
              </button>
            </div>
          </div>

          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              {extractorMode === 'url' ? (
                <>
                  <Video className="w-4 h-4 text-red-400" />
                  Extraer Transcripción Real desde Video (YouTube / TikTok)
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 text-red-400" />
                  Estructurar Caso desde Documento, Noticia o Relato Pegado
                </>
              )}
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              {extractorMode === 'url'
                ? 'Obtén la transcripción completa de diálogos y testimonios para que tu guión conserve nombres, horas y detalles reales.'
                : 'Pega un artículo policial, llamada, testimonio o documento. La IA extraerá los datos exactos y el gancho alineado a tu canal.'}
            </p>
          </div>

          {extractorMode === 'url' ? (
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="url"
                value={directUrl}
                onChange={(e) => setDirectUrl(e.target.value)}
                placeholder="Ej: https://www.youtube.com/watch?v=... o https://tiktok.com/@..."
                className="flex-1 bg-[#090A0F] border border-white/10 focus:border-red-500 rounded-xl px-4 py-3 text-xs text-white placeholder-zinc-500 focus:outline-none transition-all"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTranscribeDirectUrl();
                }}
              />
              <button
                onClick={handleTranscribeDirectUrl}
                disabled={isTranscribing || !directUrl.trim()}
                className="px-5 py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-red-600/30 whitespace-nowrap"
              >
                {isTranscribing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Transcribiendo Video...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Transcribir e Importar
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                type="text"
                value={rawTextTitle}
                onChange={(e) => setRawTextTitle(e.target.value)}
                placeholder="Título o referencia del caso (opcional)"
                className="w-full bg-[#090A0F] border border-white/10 focus:border-red-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none"
              />
              <textarea
                value={rawTextInput}
                onChange={(e) => setRawTextInput(e.target.value)}
                placeholder="Pega aquí el texto completo, artículo periodístico, expediente, transcripción manual o relato..."
                rows={4}
                className="w-full bg-[#090A0F] border border-white/10 focus:border-red-500 rounded-xl px-4 py-3 text-xs text-white placeholder-zinc-500 focus:outline-none leading-relaxed font-mono"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleStructureRawText}
                  disabled={isTranscribing || rawTextInput.trim().length < 40}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-red-600/30"
                >
                  {isTranscribing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Estructurando Caso para Guión...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Estructurar Caso Completo
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {transcriptionError && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Error al procesar:</span>
                <span>{transcriptionError}</span>
              </div>
            </div>
          )}

          {transcriptionResult && (
            <div className="bg-[#090A0F]/90 border border-red-500/40 rounded-xl p-4 space-y-4 mt-2">
              <div className="flex flex-col md:flex-row gap-4 items-start">
                {transcriptionResult.thumbnailUrl && (
                  <img
                    src={transcriptionResult.thumbnailUrl}
                    alt={transcriptionResult.title}
                    className="w-full md:w-44 h-28 object-cover rounded-lg border border-white/10 flex-shrink-0"
                  />
                )}
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-bold border border-red-500/30">
                      CASO ESTRUCTURADO CON ÉXITO
                    </span>
                    <span className="text-xs text-zinc-400">
                      Fuente: <strong className="text-white">{transcriptionResult.uploader}</strong>
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white line-clamp-2">{transcriptionResult.title}</h3>
                  <p className="text-xs text-zinc-300 leading-relaxed">{transcriptionResult.summary}</p>
                </div>
              </div>

              {/* Hook Suggestion Box */}
              <div className="bg-red-950/30 border border-red-500/30 rounded-lg p-3">
                <span className="text-[10px] font-mono text-red-400 uppercase tracking-wider block font-bold mb-1">
                  Gancho Sugerido según el Tono del Canal ({activeChannel.tone}):
                </span>
                <p className="text-xs text-zinc-200 italic font-medium">"{transcriptionResult.suggestedHook}"</p>
              </div>

              {/* Evidence Chips */}
              {transcriptionResult.mysteryElements.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                    Puntos y Elementos Clave Detectados:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {transcriptionResult.mysteryElements.map((elem, idx) => (
                      <span
                        key={idx}
                        className="text-[11px] px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-zinc-300"
                      >
                        👁️ {elem}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Collapsible Transcript */}
              <div className="pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowFullTranscript(!showFullTranscript)}
                  className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-all cursor-pointer font-medium"
                >
                  <FileText className="w-3.5 h-3.5 text-red-400" />
                  {showFullTranscript ? 'Ocultar Transcripción' : 'Ver Transcripción Completa'}
                  {showFullTranscript ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {showFullTranscript && (
                  <div className="mt-2.5 p-3 rounded-lg bg-black/60 border border-white/5 max-h-48 overflow-y-auto text-xs text-zinc-300 leading-relaxed font-mono whitespace-pre-wrap">
                    {transcriptionResult.transcript}
                  </div>
                )}
              </div>

              {/* Action Buttons: Dual Format Output */}
              <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row gap-2.5 justify-end">
                <button
                  onClick={() => handleCreateVideoFromTranscription('9:16')}
                  className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-red-600/30"
                >
                  📱 Crear Short Viral (9:16)
                </button>
                <button
                  onClick={() => handleCreateVideoFromTranscription('16:9')}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  🖥️ Crear Documental YouTube (16:9)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 4. Sub-Niches Dynamically Generated from Active Channel */}
        {activeTab === 'live' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setRadarMode('niche');
                      handleRunLiveSearch(searchQuery, selectedNiche, 'niche');
                    }
                  }}
                  placeholder={`Investigar tema específico para "${activeChannel.name}" (ej. '${channelNiches[0]}')...`}
                  className="w-full bg-[#090A0F] border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
                />
              </div>
              <button
                onClick={() => {
                  setRadarMode('niche');
                  handleRunLiveSearch(searchQuery, selectedNiche, 'niche');
                }}
                disabled={isSearching}
                className="px-5 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0"
              >
                Buscar en Vivo
              </button>
            </div>

            {/* Nichos Contextuales del Canal */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-[11px] font-mono uppercase text-zinc-500 shrink-0 mr-1 flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-violet-400" />
                Nichos de {activeChannel.name}:
              </span>
              {channelNiches.map((nicheItem) => {
                const isSelected = selectedNiche === nicheItem && radarMode === 'niche';
                return (
                  <button
                    key={nicheItem}
                    onClick={() => {
                      setSelectedNiche(nicheItem);
                      setSearchQuery('');
                      setRadarMode('niche');
                      handleRunLiveSearch('', nicheItem, 'niche');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer border ${
                      isSelected
                        ? 'bg-violet-600/25 border-violet-500 text-violet-200 font-bold shadow-sm'
                        : 'bg-[#090A0F] border-white/5 text-zinc-400 hover:text-zinc-200 hover:border-white/15'
                    }`}
                  >
                    {nicheItem}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. Live Scan Telemetry Strip */}
        {telemetry && activeTab === 'live' && (
          <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] text-zinc-400 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                {telemetry.rawSignalsCount} señales reales procesadas para {activeChannel.name}:
              </span>
              {Object.entries(telemetry.breakdown).map(([kind, count]) => {
                if (!count) return null;
                const info = SOURCE_LABELS[kind] || {
                  label: kind,
                  color: 'bg-white/5 text-zinc-300 border-white/10',
                };
                return (
                  <span
                    key={kind}
                    className={`px-2 py-0.5 rounded border text-[10px] font-mono font-semibold ${info.color}`}
                  >
                    {info.label}: {count}
                  </span>
                );
              })}
            </div>
            <span className="font-mono text-[11px] text-zinc-400">
              Curado en <strong className="text-violet-300">{(telemetry.latencyMs / 1000).toFixed(1)}s</strong> por{' '}
              {telemetry.providerUsed} ({telemetry.modelUsed})
            </span>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-300 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button
            onClick={() => handleRunLiveSearch()}
            className="text-xs font-bold underline hover:text-white cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Loading Skeletons */}
      {isSearching && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="bg-[#11131C] border border-white/10 rounded-2xl p-5 space-y-4 animate-pulse"
            >
              <div className="flex justify-between">
                <div className="h-5 w-28 bg-zinc-800 rounded" />
                <div className="h-5 w-20 bg-zinc-800 rounded" />
              </div>
              <div className="h-6 w-4/5 bg-zinc-800 rounded" />
              <div className="h-16 w-full bg-zinc-800/70 rounded" />
              <div className="h-14 w-full bg-zinc-800/50 rounded" />
              <div className="h-10 w-full bg-violet-900/30 rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State for Saved Trends */}
      {activeTab === 'saved' && savedTrends.length === 0 && !isLoadingSaved && (
        <div className="bg-[#11131C] border border-white/10 rounded-2xl p-12 text-center space-y-3">
          <Bookmark className="w-10 h-10 text-zinc-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No tienes ideas guardadas aún para {activeChannel.name}</h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Explora las tendencias en vivo y presiona el ícono de estrella ⭐ en cualquier tarjeta para archivarla en tu banco de ideas y crear el video cuando desees.
          </p>
          <button
            onClick={() => setActiveTab('live')}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl cursor-pointer"
          >
            Ver Tendencias en Vivo
          </button>
        </div>
      )}

      {/* Trends Grid */}
      {!isSearching && displayTrends.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {displayTrends.map((trend) => {
            const currentRatio = getRatioForTrend(trend);
            const isSaved = savedTrends.some((t) => t.id === trend.id);
            const isDossierExpanded = Boolean(expandedDossierIds[trend.id]);
            const isVideo = trend.contentType === 'video_transcript' || trend.sourceTypes?.includes('youtube');

            return (
              <div
                key={trend.id}
                className="bg-[#11131C] border border-white/10 hover:border-violet-500/40 rounded-2xl p-5 flex flex-col justify-between transition-all group relative"
              >
                <div className="space-y-4">
                  {/* Top Bar: Category, Content Badge & Bookmark Button */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[11px] font-medium text-zinc-300 truncate">
                        {trend.category}
                      </span>
                      {isVideo ? (
                        <span className="px-2 py-0.5 rounded bg-red-500/15 border border-red-500/30 text-red-300 text-[10px] font-mono font-semibold shrink-0 flex items-center gap-1">
                          <Video className="w-3 h-3" /> Transcripción
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-sky-500/15 border border-sky-500/30 text-sky-300 text-[10px] font-mono font-semibold shrink-0 flex items-center gap-1">
                          <Newspaper className="w-3 h-3" /> Dossier Factual
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleSaveTrend(trend)}
                        className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                          isSaved
                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                            : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
                        }`}
                        title={isSaved ? 'Quitar de guardados' : 'Guardar en banco de ideas'}
                      >
                        <Star className={`w-3.5 h-3.5 ${isSaved ? 'fill-amber-400' : ''}`} />
                      </button>

                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold shrink-0">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span className="tabular-nums">{trend.viralScore}/100</span>
                      </div>
                    </div>
                  </div>

                  {/* Title & Summary */}
                  <div>
                    <h3 className="text-base font-bold text-white group-hover:text-violet-300 transition-colors leading-snug">
                      {trend.title}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{trend.summary}</p>
                  </div>

                  {/* Evidence Points Chips */}
                  {trend.evidencePoints && trend.evidencePoints.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono uppercase text-zinc-500 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" /> Datos y Evidencia Comprobada:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {trend.evidencePoints.slice(0, 3).map((pt, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-white/5 text-zinc-300"
                          >
                            • {pt}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Expandable Detailed Content / Transcript Box */}
                  {trend.detailedContent && (
                    <div className="border border-white/10 rounded-xl overflow-hidden bg-[#090A0F]/70">
                      <button
                        onClick={() => toggleDossierExpand(trend.id)}
                        className="w-full px-3 py-2 text-[11px] font-semibold text-zinc-300 hover:text-white flex items-center justify-between cursor-pointer border-b border-white/5"
                      >
                        <span className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-violet-400" />
                          {isDossierExpanded
                            ? 'Ocultar Dossier / Transcripción'
                            : `Ver Dossier Completo (${trend.detailedContent.split(/\s+/).length} palabras)`}
                        </span>
                        {isDossierExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5 text-zinc-500" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                        )}
                      </button>
                      {isDossierExpanded && (
                        <div className="p-3 text-xs text-zinc-300 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap font-mono border-t border-white/5">
                          {trend.detailedContent}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Hook aligned to Channel's Tone */}
                  <div className="bg-[#090A0F] border border-white/5 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-violet-400">
                        Gancho con Tono del Canal ({activeChannel.tone.slice(0, 24)}...):
                      </span>
                      <button
                        onClick={() => handleCopyHook(trend.id, trend.suggestedHook)}
                        className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        {copiedHookId === trend.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-xs font-medium text-white italic">"{trend.suggestedHook}"</p>
                  </div>

                  {/* Real Verified Sources */}
                  {trend.sources && trend.sources.length > 0 && (
                    <div>
                      <span className="text-[10px] font-mono uppercase text-zinc-500 flex items-center gap-1 mb-1">
                        <Globe className="w-3 h-3" /> Fuentes verificadas:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {trend.sources.slice(0, 2).map((src, i) => (
                          <a
                            key={i}
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-zinc-300 hover:text-violet-300 bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded border border-white/10 truncate max-w-[200px]"
                          >
                            <span className="truncate">{src.title}</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Format Picker & Action Button */}
                <div className="pt-4 mt-4 border-t border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-zinc-500" /> Formato:
                    </span>
                    <div className="flex items-center gap-1 bg-[#090A0F] p-1 rounded-lg border border-white/10">
                      {(['9:16', '16:9', '1:1'] as AspectRatioType[]).map((ratio) => (
                        <button
                          key={ratio}
                          onClick={() => setSelectedRatios((prev) => ({ ...prev, [trend.id]: ratio }))}
                          className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-all cursor-pointer ${
                            currentRatio === ratio ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          {ratio}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => onCreateVideoFromTrend(trend, currentRatio)}
                    className="w-full py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-violet-600/20"
                  >
                    <Wand2 className="w-4 h-4" />
                    Crear Video con este Caso ({currentRatio})
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
