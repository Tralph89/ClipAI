import React, { useState } from 'react';
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
} from 'lucide-react';
import {
  AspectRatioType,
  SOCIAL_PLATFORMS,
  SocialChannel,
  TrendItem,
  TrendScanTelemetry,
} from '../types';
import { searchLiveTrends } from '../services/apiService';

interface TrendRadarViewProps {
  activeChannel: SocialChannel;
  trends: TrendItem[];
  onUpdateTrends: (newTrends: TrendItem[]) => void;
  onCreateVideoFromTrend: (trend: TrendItem, chosenRatio: AspectRatioType) => void;
}

const QUICK_NICHES = [
  'Inteligencia Artificial & Tech',
  'Finanzas, Cripto & Negocios',
  'Ciencia & Descubrimientos',
  'Marketing Digital & Creadores',
  'Salud, Hábitos & Productividad',
  'Cultura Pop & Entretenimiento Viral',
];

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNiche, setSelectedNiche] = useState(activeChannel.niche || QUICK_NICHES[0]);
  const [region, setRegion] = useState('Global / Español');
  const [radarMode, setRadarMode] = useState<'niche' | 'breaking'>('niche');
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<TrendScanTelemetry | null>(null);
  const [selectedRatios, setSelectedRatios] = useState<Record<string, AspectRatioType>>({});
  const [copiedHookId, setCopiedHookId] = useState<string | null>(null);

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
        setErrorMsg('No se encontraron señales recientes. Prueba con otra palabra clave o región.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al recolectar señales gratuitas en vivo.');
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

  return (
    <div className="space-y-6">
      {/* Header & Live Multi-Source Search Control Panel */}
      <div className="bg-[#11131C] border border-white/10 rounded-2xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-white/10">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-emerald-400 text-xs font-mono uppercase tracking-wider mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Radar Multi-Fuente $0: Google Trends • News • YouTube • Reddit • HN</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Radar de Tendencias Virales en Tiempo Real
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Escanea noticias de última hora, videos en crecimiento y picos de búsqueda reales curados por tu IA local para{' '}
              <span className="text-white font-semibold">{activeChannel.name}</span> ({activeChannel.handle}).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Mode Switch: Niche vs Country Breaking Spikes */}
            <div className="flex items-center bg-[#090A0F] border border-white/10 rounded-xl p-1">
              <button
                onClick={() => {
                  setRadarMode('niche');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  radarMode === 'niche'
                    ? 'bg-violet-600 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Por Nicho / Tema
              </button>
              <button
                onClick={() => {
                  setRadarMode('breaking');
                  handleRunLiveSearch('', selectedNiche, 'breaking');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  radarMode === 'breaking'
                    ? 'bg-emerald-600 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                Explosiones del Día
              </button>
            </div>

            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="bg-[#090A0F] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-medium text-zinc-200 focus:outline-none focus:border-violet-500"
            >
              <option value="Global / Español">Hispanohablante (MX + ES)</option>
              <option value="México y Latinoamérica">México & LATAM</option>
              <option value="España">España</option>
              <option value="Estados Unidos (US Trends)">EE. UU. (Global)</option>
            </select>

            <button
              onClick={() => handleRunLiveSearch()}
              disabled={isSearching}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-violet-600/20"
            >
              {isSearching ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Recolectando Señales + IA...
                </>
              ) : (
                <>
                  <Flame className="w-4 h-4" />
                  Escanear Tendencias Ahora
                </>
              )}
            </button>
          </div>
        </div>

        {/* Search Input & Quick Niches */}
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
                placeholder="Investigar tema específico en vivo (ej. 'Agentes IA', 'Bitcoin hoy', ' robótica', 'productividad')..."
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
              Investigar en 5 Fuentes
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-[11px] font-mono uppercase text-zinc-500 shrink-0 mr-1">
              Nichos Rápidos:
            </span>
            {QUICK_NICHES.map((nicheItem) => {
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
                      ? 'bg-violet-600/20 border-violet-500 text-violet-300'
                      : 'bg-[#090A0F] border-white/5 text-zinc-400 hover:text-zinc-200 hover:border-white/15'
                  }`}
                >
                  {nicheItem}
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Scan Telemetry Strip */}
        {telemetry && (
          <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] text-zinc-400 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                {telemetry.rawSignalsCount} señales reales procesadas:
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
              Curado por <strong className="text-violet-300">{telemetry.providerUsed}</strong> (
              {telemetry.modelUsed}) en {(telemetry.latencyMs / 1000).toFixed(1)}s
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

      {/* Trends Grid */}
      {!isSearching && trends.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {trends.map((trend) => {
            const currentRatio = getRatioForTrend(trend);
            return (
              <div
                key={trend.id}
                className="bg-[#11131C] border border-white/10 hover:border-violet-500/40 rounded-2xl p-5 flex flex-col justify-between transition-all group"
              >
                <div className="space-y-4">
                  {/* Top Bar: Category, Traffic & Viral Score */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[11px] font-medium text-zinc-300 truncate">
                        {trend.category}
                      </span>
                      {trend.trafficBadge && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-mono font-semibold shrink-0">
                          {trend.trafficBadge}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold shrink-0">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span className="tabular-nums">{trend.viralScore}/100</span>
                    </div>
                  </div>

                  {/* Title & Summary */}
                  <div>
                    <h3 className="text-base font-bold text-white group-hover:text-violet-300 transition-colors leading-snug">
                      {trend.title}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{trend.summary}</p>
                  </div>

                  {/* Why Trending & Copyable Hook Box */}
                  <div className="bg-[#090A0F] border border-white/5 rounded-xl p-3.5 space-y-2.5">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 block">
                        Por qué es tendencia hoy:
                      </span>
                      <p className="text-xs text-zinc-300 mt-0.5">{trend.whyTrending}</p>
                    </div>
                    <div className="pt-2 border-t border-white/5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-violet-400">
                          Hook sugerido (0-3s):
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
                              <span>Copiar Hook</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-xs font-medium text-white italic mt-1">
                        "{trend.suggestedHook}"
                      </p>
                    </div>
                  </div>

                  {/* Recommended Networks (Prioritizing V1 Platforms) */}
                  <div className="flex flex-wrap gap-1.5">
                    {trend.recommendedPlatforms.map((platId) => {
                      const plat = SOCIAL_PLATFORMS.find((p) => p.id === platId);
                      if (!plat) return null;
                      return (
                        <span
                          key={platId}
                          className={`text-[10px] px-2 py-0.5 rounded border font-medium ${plat.badgeColor}`}
                        >
                          {plat.shortName}
                        </span>
                      );
                    })}
                  </div>

                  {/* Real Verified Sources */}
                  {trend.sources && trend.sources.length > 0 && (
                    <div className="pt-1">
                      <span className="text-[10px] font-mono uppercase text-zinc-500 flex items-center gap-1 mb-1.5">
                        <Globe className="w-3 h-3" /> Fuentes reales verificadas:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {trend.sources.slice(0, 3).map((src, i) => (
                          <a
                            key={i}
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-zinc-300 hover:text-violet-300 bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded border border-white/10 truncate max-w-[195px]"
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
                      <Layers className="w-3.5 h-3.5 text-zinc-500" /> Formato de salida:
                    </span>
                    <div className="flex items-center gap-1 bg-[#090A0F] p-1 rounded-lg border border-white/10">
                      {(['9:16', '16:9', '1:1'] as AspectRatioType[]).map((ratio) => (
                        <button
                          key={ratio}
                          onClick={() =>
                            setSelectedRatios((prev) => ({ ...prev, [trend.id]: ratio }))
                          }
                          className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-all cursor-pointer ${
                            currentRatio === ratio
                              ? 'bg-violet-600 text-white'
                              : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          {ratio}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => onCreateVideoFromTrend(trend, currentRatio)}
                    className="w-full py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-violet-600/15"
                  >
                    <Wand2 className="w-4 h-4" />
                    Crear Video de esta Tendencia ({currentRatio})
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
