import { execFile } from 'child_process';
import { promisify } from 'util';
import { AspectRatioType, SocialPlatformId, TrendItem } from '../../src/types.ts';
import { generateAIJson } from './aiProvider.ts';
import { resolveLocalToolPath } from './systemTools.ts';
import { extractQuickVideoSubtitles } from './videoTranscriber.ts';

const execFileAsync = promisify(execFile);

export type RawTrendSourceKind =
  | 'google_trends'
  | 'google_news'
  | 'youtube'
  | 'reddit'
  | 'hackernews';

export interface RawTrendSignal {
  id: string;
  sourceKind: RawTrendSourceKind;
  sourceLabel: string;
  title: string;
  snippet: string;
  url: string;
  trafficOrEngagement?: string;
}

export interface TrendScanTelemetry {
  providerUsed: string;
  modelUsed: string;
  latencyMs: number;
  rawSignalsCount: number;
  breakdown: Record<RawTrendSourceKind, number>;
}

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'application/rss+xml, application/xml, text/xml, */*',
};

function decodeXmlEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractXmlTag(block: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = block.match(regex);
  return match ? decodeXmlEntities(match[1]) : '';
}

function extractXmlAttr(block: string, tagName: string, attrName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*\\s${attrName}=["']([^"']+)["'][^>]*>`, 'i');
  const match = block.match(regex);
  return match ? decodeXmlEntities(match[1]) : '';
}

function getRegionCodes(region: string): {
  geos: string[];
  hl: string;
  gl: string;
  ceid: string;
} {
  if (region.includes('España')) {
    return { geos: ['ES'], hl: 'es', gl: 'ES', ceid: 'ES:es' };
  }
  if (region.includes('Estados Unidos')) {
    return { geos: ['US'], hl: 'en-US', gl: 'US', ceid: 'US:en' };
  }
  if (region.includes('Argentina')) {
    return { geos: ['AR'], hl: 'es-419', gl: 'AR', ceid: 'AR:es-419' };
  }
  if (region.includes('Colombia')) {
    return { geos: ['CO'], hl: 'es-419', gl: 'CO', ceid: 'CO:es-419' };
  }
  if (region.includes('México') || region.includes('LATAM')) {
    return { geos: ['MX', 'CO'], hl: 'es-419', gl: 'MX', ceid: 'MX:es-419' };
  }
  // Global / Español default
  return { geos: ['MX', 'ES', 'AR', 'CO'], hl: 'es-419', gl: 'MX', ceid: 'MX:es-419' };
}

// 1. Google Trends Daily Trending Searches RSS ($0, Real Traffic Metrics)
async function collectGoogleTrendsRss(geos: string[]): Promise<RawTrendSignal[]> {
  const signals: RawTrendSignal[] = [];

  await Promise.allSettled(
    geos.map(async (geo) => {
      const url = `https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`;
      const res = await fetch(url, {
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return;
      const xml = await res.text();
      const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];

      for (const item of items.slice(0, 8)) {
        const keyword = extractXmlTag(item, 'title');
        const traffic = extractXmlTag(item, 'ht:approx_traffic');
        const newsTitle = extractXmlTag(item, 'ht:news_item_title');
        const newsUrl = extractXmlTag(item, 'ht:news_item_url');
        const newsSource = extractXmlTag(item, 'ht:news_item_source');

        if (!keyword) continue;
        signals.push({
          id: '',
          sourceKind: 'google_trends',
          sourceLabel: newsSource ? `${newsSource} (Google Trends ${geo})` : `Google Trends ${geo}`,
          title: newsTitle ? `${keyword}: ${newsTitle}` : keyword,
          snippet: newsTitle || `Pico de búsquedas en vivo en ${geo}`,
          url: newsUrl || `https://trends.google.com/trends/explore?geo=${geo}&q=${encodeURIComponent(keyword)}`,
          trafficOrEngagement: traffic ? `${traffic} búsquedas` : `Tendencia ${geo}`,
        });
      }
    })
  );

  return signals;
}

// 2. Google News Live Search RSS ($0, Last 48h Breaking News by Topic/Niche)
async function collectGoogleNewsRss(
  searchTopic: string,
  regionCfg: { hl: string; gl: string; ceid: string }
): Promise<RawTrendSignal[]> {
  const cleanTopic = searchTopic.trim() || 'tecnología negocios ciencia viral';
  const q = `${cleanTopic} when:3d`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${regionCfg.hl}&gl=${regionCfg.gl}&ceid=${regionCfg.ceid}`;

  const res = await fetch(url, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(6500),
  });
  if (!res.ok) return [];

  const xml = await res.text();
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  const signals: RawTrendSignal[] = [];

  for (const item of items.slice(0, 10)) {
    const rawTitle = extractXmlTag(item, 'title');
    // Google News titles usually end with " - Medio"
    const dashIdx = rawTitle.lastIndexOf(' - ');
    const cleanHeadline = dashIdx > 15 ? rawTitle.slice(0, dashIdx).trim() : rawTitle;
    const sourceName =
      extractXmlTag(item, 'source') ||
      (dashIdx > 15 ? rawTitle.slice(dashIdx + 3).trim() : 'Google News');
    const sourceOriginUrl = extractXmlAttr(item, 'source', 'url');
    const googleLink = extractXmlTag(item, 'link');

    if (!cleanHeadline) continue;
    signals.push({
      id: '',
      sourceKind: 'google_news',
      sourceLabel: sourceName,
      title: cleanHeadline,
      snippet: `Noticia reciente publicada por ${sourceName}`,
      url: googleLink || sourceOriginUrl || 'https://news.google.com',
      trafficOrEngagement: 'Últimas 48h',
    });
  }

  return signals;
}

// 3. YouTube Real Ranking Videos via Local `yt-dlp` ($0)
async function collectYouTubeSignals(searchTopic: string): Promise<RawTrendSignal[]> {
  const ytDlpPath = resolveLocalToolPath('yt-dlp');
  if (!ytDlpPath) return [];

  const topic = searchTopic.trim() || 'tendencias inteligencia artificial tecnologia';
  try {
    const { stdout } = await execFileAsync(
      ytDlpPath,
      [`ytsearch5:${topic}`, '--flat-playlist', '-J', '--no-warnings'],
      { timeout: 7500, maxBuffer: 4 * 1024 * 1024 }
    );

    const parsed = JSON.parse(stdout) as { entries?: any[] };
    const signals: RawTrendSignal[] = [];

    for (const entry of (parsed.entries || []).slice(0, 5)) {
      if (!entry?.title) continue;
      const videoUrl =
        entry.url?.startsWith('http')
          ? entry.url
          : entry.id
          ? `https://www.youtube.com/watch?v=${entry.id}`
          : '';
      if (!videoUrl) continue;

      const views =
        typeof entry.view_count === 'number' && entry.view_count > 0
          ? `${Intl.NumberFormat('es').format(entry.view_count)} vistas`
          : 'YouTube';

      signals.push({
        id: '',
        sourceKind: 'youtube',
        sourceLabel: entry.channel || entry.uploader || 'YouTube',
        title: String(entry.title),
        snippet: entry.description ? String(entry.description).slice(0, 140) : 'Video destacado en YouTube',
        url: videoUrl,
        trafficOrEngagement: views,
      });
    }

    return signals;
  } catch {
    return [];
  }
}

// 4. Reddit Hot RSS ($0, Community Discussions)
async function collectRedditRss(searchTopic: string): Promise<RawTrendSignal[]> {
  const topic = searchTopic.trim() || 'artificial intelligence technology';
  const url = `https://www.reddit.com/search.rss?q=${encodeURIComponent(topic)}&sort=hot&t=week&limit=6`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'ClipAIStudio:v1.0.0 (by /u/clipai_local_radar)',
      Accept: 'application/atom+xml, application/xml, text/xml',
    },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return [];

  const xml = await res.text();
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/gi) || [];
  const signals: RawTrendSignal[] = [];

  for (const entry of entries.slice(0, 6)) {
    const title = extractXmlTag(entry, 'title');
    const link = extractXmlAttr(entry, 'link', 'href');
    const category = extractXmlAttr(entry, 'category', 'label') || 'Reddit';
    if (!title || !link) continue;

    signals.push({
      id: '',
      sourceKind: 'reddit',
      sourceLabel: category.startsWith('r/') ? category : `r/${category}`,
      title,
      snippet: `Debate activo en comunidad ${category}`,
      url: link,
      trafficOrEngagement: 'Reddit Hot',
    });
  }

  return signals;
}

// 5. Hacker News Algolia API ($0, Fast JSON for Tech/Business/Science)
async function collectHackerNews(searchTopic: string): Promise<RawTrendSignal[]> {
  const clean = searchTopic.trim();
  const isGeneralTech =
    !clean || /ia|inteligencia|ai|tech|tecnolog|software|startup|negocio|ciencia|finanza|cripto/i.test(clean);

  const endpoint =
    clean && !isGeneralTech
      ? `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(clean)}&tags=story&hitsPerPage=5`
      : `https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=6`;

  const res = await fetch(endpoint, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return [];

  const data = (await res.json()) as { hits?: any[] };
  const signals: RawTrendSignal[] = [];

  for (const hit of (data.hits || []).slice(0, 5)) {
    if (!hit?.title) continue;
    const hnUrl = `https://news.ycombinator.com/item?id=${hit.objectID}`;
    signals.push({
      id: '',
      sourceKind: 'hackernews',
      sourceLabel: 'Hacker News',
      title: String(hit.title),
      snippet: `${hit.points || 0} puntos y ${hit.num_comments || 0} comentarios en Hacker News`,
      url: hit.url || hnUrl,
      trafficOrEngagement: `${hit.points || 50}+ pts`,
    });
  }

  return signals;
}

function deduplicateSignals(all: RawTrendSignal[]): RawTrendSignal[] {
  const seenKeys = new Set<string>();
  const unique: RawTrendSignal[] = [];

  for (const item of all) {
    const norm = item.title
      .toLowerCase()
      .replace(/[^a-z0-9áéíóúñ\s]/gi, '')
      .split(/\s+/)
      .slice(0, 6)
      .join(' ');
    if (!norm || seenKeys.has(norm)) continue;
    seenKeys.add(norm);
    unique.push({
      ...item,
      id: `S${unique.length + 1}`,
    });
  }

  return unique;
}

function buildFallbackTrendsFromSignals(
  signals: RawTrendSignal[],
  niche: string,
  channelTone?: string
): TrendItem[] {
  return signals.slice(0, 6).map((sig, idx) => {
    const isVideo = sig.sourceKind === 'youtube';
    const detailed = `${sig.title}. ${sig.snippet}. Datos verificados reportados por ${sig.sourceLabel}. Contexto clave para desarrollo de guión en formato ${sig.trafficOrEngagement || 'alta retención'}.`;
    return {
      id: `trend-${Date.now()}-${idx}`,
      title: sig.title,
      summary: sig.snippet,
      detailedContent: detailed,
      contentType: isVideo ? 'video_transcript' : 'news_dossier',
      evidencePoints: [sig.sourceLabel, sig.trafficOrEngagement || 'Tendencia activa hoy', sig.title],
      viralScore: Math.max(78, 95 - idx * 3),
      category: niche || 'Tendencia en Vivo',
      whyTrending: `${sig.sourceLabel} (${sig.trafficOrEngagement || 'En tendencia hoy'})`,
      suggestedHook: channelTone?.includes('sombrío') || channelTone?.includes('misterio')
        ? `Lo que acaba de confirmarse sobre "${sig.title.slice(0, 50)}" es mucho más perturbador de lo que dijeron...`
        : `Detén el scroll porque lo que acaba de pasar con "${sig.title.slice(0, 50)}" lo cambia todo...`,
      angle: channelTone || 'Resumen ágil con contexto visual y conclusión directa en menos de 60 segundos.',
      recommendedFormats: ['9:16', '16:9'],
      recommendedPlatforms: ['youtube_shorts', 'tiktok', 'facebook_reels', 'youtube_long'],
      keywords: sig.title
        .split(/\s+/)
        .filter((w) => w.length > 4)
        .slice(0, 4),
      sources: [{ title: sig.sourceLabel, uri: sig.url }],
      trafficBadge: sig.trafficOrEngagement,
      sourceTypes: [sig.sourceKind],
      detectedAt: Date.now(),
      fullTranscript: detailed,
    };
  });
}

export async function discoverMultiSourceTrends(params: {
  query?: string;
  niche?: string;
  channelName?: string;
  channelNiche?: string;
  channelTone?: string;
  region?: string;
  platforms?: SocialPlatformId[];
  mode?: 'niche' | 'breaking';
}): Promise<{
  trends: TrendItem[];
  sources: Array<{ title: string; uri: string }>;
  telemetry: TrendScanTelemetry;
}> {
  const startTime = Date.now();
  const region = params.region || 'Global / Español';
  const regionCfg = getRegionCodes(region);

  // Build targeted search topic matching the active channel's niche
  let searchTopic = '';
  if (params.query?.trim()) {
    searchTopic = params.query.trim();
  } else if (params.niche?.trim()) {
    searchTopic = params.niche.trim();
  } else if (params.channelNiche?.trim()) {
    searchTopic = params.channelNiche.trim();
  } else {
    searchTopic = 'Tendencias y Noticias Virales';
  }

  const isBreakingMode = params.mode === 'breaking' && !params.query?.trim();

  // Execute all 5 free collectors in parallel
  const [gNewsRes, gTrendsRes, ytRes, redditRes, hnRes] = await Promise.allSettled([
    isBreakingMode ? Promise.resolve([]) : collectGoogleNewsRss(searchTopic, regionCfg),
    collectGoogleTrendsRss(regionCfg.geos),
    isBreakingMode ? Promise.resolve([]) : collectYouTubeSignals(searchTopic),
    isBreakingMode ? Promise.resolve([]) : collectRedditRss(searchTopic),
    isBreakingMode ? Promise.resolve([]) : collectHackerNews(searchTopic),
  ]);

  const gNews = gNewsRes.status === 'fulfilled' ? gNewsRes.value : [];
  const gTrends = gTrendsRes.status === 'fulfilled' ? gTrendsRes.value : [];
  const yt = ytRes.status === 'fulfilled' ? ytRes.value : [];
  const reddit = redditRes.status === 'fulfilled' ? redditRes.value : [];
  const hn = hnRes.status === 'fulfilled' ? hnRes.value : [];

  const breakdown: Record<RawTrendSourceKind, number> = {
    google_news: gNews.length,
    google_trends: gTrends.length,
    youtube: yt.length,
    reddit: reddit.length,
    hackernews: hn.length,
  };

  // Interleave signals so every active source gets fair representation in the top 18 signals sent to Ollama
  const orderedPool = isBreakingMode
    ? [...gTrends, ...gNews]
    : [
        ...gNews.slice(0, 7),
        ...yt.slice(0, 4),
        ...reddit.slice(0, 4),
        ...gTrends.slice(0, 4),
        ...hn.slice(0, 3),
      ];

  const signals = deduplicateSignals(orderedPool).slice(0, 18);
  const signalMap = new Map<string, RawTrendSignal>(signals.map((s) => [s.id, s]));

  if (signals.length === 0) {
    throw new Error(
      'No se pudieron recolectar señales en vivo (verifica tu conexión a internet o intenta otra búsqueda).'
    );
  }

  const compactDigest = signals
    .map(
      (s) =>
        `[${s.id}] (${s.sourceLabel}${s.trafficOrEngagement ? ` | ${s.trafficOrEngagement}` : ''}) ${s.title}`
    )
    .join('\n');

  const channelContext = params.channelName
    ? `CANAL ACTIVO: "${params.channelName}" | NICHO: "${params.channelNiche || searchTopic}" | TONO OBLIGATORIO: "${params.channelTone || 'Envolvente, de alta retención'}"`
    : `NICHO ACTIVO: "${searchTopic}"`;

  const aiPrompt = `Actúa como Director Creativo y Estratega de Contenido para el siguiente canal:
${channelContext}

Se han recolectado estas ${signals.length} señales REALES en vivo (${region}):
${compactDigest}

Selecciona y sintetiza las 6 mejores oportunidades de video adaptadas 100% al nicho y al tono del canal.
Traduce al español cualquier titular en inglés manteniendo fidelidad total a los hechos reales.

Para cada oportunidad:
1. "title": Título magnético adaptado al estilo del canal.
2. "summary": Resumen informativo de 2 oraciones con el hecho central.
3. "detailedContent": DOSSIER DETALLADO (3 a 5 párrafos ricos en hechos) con:
   - Cronología de los hechos (fechas, horas, lugares exactos).
   - Nombres de personas, organismos, testigos o fuentes oficiales.
   - Datos numéricos, citas textuales y evidencia clave.
   - La controversia, dilema o enigma central. Este texto se enviará directamente para redactar el guión final.
4. "evidencePoints": Array con 3 a 5 datos clave comprobables.
5. "suggestedHook": Gancho verbal de los primeros 3 segundos (0-3s) redactado exactamente con el tono del canal ("${params.channelTone || 'Inmersivo y de alta retención'}").
6. "angle": Ángulo narrativo coherente con el tono del canal.
7. "recommendedFormats": ["9:16", "16:9"]
8. "recommendedPlatforms": ["youtube_shorts", "tiktok", "facebook_reels", "youtube_long"]
9. "keywords": ["palabra1", "palabra2", "palabra3"]

Devuelve ÚNICAMENTE un JSON válido con esta estructura exacta:
{
  "trends": [
    {
      "sourceIds": ["S1"],
      "title": "Título en español",
      "summary": "Resumen de 2 oraciones",
      "detailedContent": "Dossier profundo estructurado...",
      "evidencePoints": ["Dato clave 1", "Dato clave 2", "Dato clave 3"],
      "viralScore": 95,
      "category": "Categoría",
      "whyTrending": "Por qué es tendencia hoy",
      "suggestedHook": "Gancho verbal 0-3s",
      "angle": "Ángulo narrativo adaptado al tono",
      "recommendedFormats": ["9:16", "16:9"],
      "recommendedPlatforms": ["youtube_shorts", "tiktok", "facebook_reels", "youtube_long"],
      "keywords": ["kw1", "kw2"]
    }
  ]
}`;

  try {
    const { data, meta } = await generateAIJson<{ trends?: any[] }>(
      {
        systemInstruction:
          'Eres un estratega jefe de contenido viral para YouTube, TikTok y Facebook. Basas cada idea exclusivamente en las señales reales proporcionadas [S1..Sn] y devuelves JSON limpio.',
        prompt: aiPrompt,
        temperature: 0.55,
      },
      { trends: [] }
    );

    const rawItems = Array.isArray(data) ? data : data.trends || [];
    if (rawItems.length === 0) {
      const fallbackTrends = buildFallbackTrendsFromSignals(signals, params.niche || searchTopic);
      return {
        trends: fallbackTrends,
        sources: signals.slice(0, 8).map((s) => ({ title: s.sourceLabel, uri: s.url })),
        telemetry: {
          providerUsed: meta.providerUsed,
          modelUsed: meta.modelUsed,
          latencyMs: Date.now() - startTime,
          rawSignalsCount: signals.length,
          breakdown,
        },
      };
    }

    const enriched: TrendItem[] = await Promise.all(
      rawItems.slice(0, 6).map(async (item, idx) => {
        const ids: string[] = Array.isArray(item.sourceIds) ? item.sourceIds : [];
        const matchedSignals = ids
          .map((id) => signalMap.get(String(id).replace(/[\[\]\s]/g, '')))
          .filter((s): s is RawTrendSignal => Boolean(s));

        if (matchedSignals.length === 0 && signals[idx]) {
          matchedSignals.push(signals[idx]);
        }

        const primarySignal = matchedSignals[0];
        const isVideo = primarySignal?.sourceKind === 'youtube';

        let videoTranscript = '';
        if (isVideo && primarySignal?.url) {
          try {
            videoTranscript = await extractQuickVideoSubtitles(primarySignal.url, 8000);
          } catch {
            // ignore
          }
        }

        let detailedContent = item.detailedContent || '';
        if (!detailedContent || detailedContent.length < 80) {
          detailedContent = `${item.title || ''}. ${item.summary || ''}. ` +
            `Datos e investigación verificada a través de ${primarySignal?.sourceLabel || 'fuente en vivo'}. ` +
            `Esta tendencia ha generado ${primarySignal?.trafficOrEngagement || 'alta atención'} en redes y medios.`;
        }

        if (videoTranscript && videoTranscript.length > 50) {
          detailedContent += `\n\n### TRANSCRIPCIÓN REAL DEL VIDEO DE REFERENCIA:\n${videoTranscript.slice(0, 9000)}`;
        }

      const verifiedSources = matchedSignals.map((s) => ({
        title: s.sourceLabel,
        uri: s.url,
      }));

      const validFormats: AspectRatioType[] = Array.isArray(item.recommendedFormats)
        ? item.recommendedFormats.filter((r: any) => r === '9:16' || r === '16:9' || r === '1:1')
        : ['9:16', '16:9'];

      const validPlatforms: SocialPlatformId[] = Array.isArray(item.recommendedPlatforms)
        ? item.recommendedPlatforms
        : ['youtube_shorts', 'tiktok', 'facebook_reels', 'youtube_long'];

        return {
          id: `trend-${Date.now()}-${idx}`,
          title: item.title || matchedSignals[0]?.title || `Tendencia #${idx + 1}`,
          summary: item.summary || matchedSignals[0]?.snippet || '',
          detailedContent,
          contentType: isVideo ? 'video_transcript' : 'news_dossier',
          evidencePoints: Array.isArray(item.evidencePoints) && item.evidencePoints.length > 0
            ? item.evidencePoints
            : [matchedSignals[0]?.sourceLabel || 'Fuente Verificada', matchedSignals[0]?.trafficOrEngagement || 'Tendencia en Vivo'],
          viralScore:
            typeof item.viralScore === 'number'
              ? Math.min(99, Math.max(70, Math.round(item.viralScore)))
              : 92 - idx * 2,
          category: item.category || params.niche || 'Tendencia en Vivo',
          whyTrending:
            item.whyTrending ||
            matchedSignals[0]?.trafficOrEngagement ||
            'Pico de búsquedas y conversación activa hoy.',
          suggestedHook:
            item.suggestedHook ||
            'Detén el scroll 5 segundos porque lo que acaba de ocurrir cambia las reglas...',
          angle: item.angle || params.channelTone || 'Explicación directa con datos visuales y conclusión accionable.',
          recommendedFormats: validFormats.length ? validFormats : ['9:16', '16:9'],
          recommendedPlatforms: validPlatforms.length
            ? validPlatforms
            : ['youtube_shorts', 'tiktok', 'facebook_reels'],
          keywords: Array.isArray(item.keywords) ? item.keywords : [],
          sources: verifiedSources,
          trafficBadge: matchedSignals[0]?.trafficOrEngagement,
          sourceTypes: Array.from(new Set(matchedSignals.map((s) => s.sourceKind))),
          detectedAt: Date.now(),
          fullTranscript: videoTranscript || detailedContent,
        };
      })
    );

    return {
      trends: enriched,
      sources: signals.slice(0, 10).map((s) => ({ title: s.sourceLabel, uri: s.url })),
      telemetry: {
        providerUsed: meta.providerUsed,
        modelUsed: meta.modelUsed,
        latencyMs: Date.now() - startTime,
        rawSignalsCount: signals.length,
        breakdown,
      },
    };
  } catch (err) {
    console.warn('[trendCollector] AI synthesis fallback used:', (err as Error).message);
    const fallbackTrends = buildFallbackTrendsFromSignals(signals, params.niche || searchTopic);
    return {
      trends: fallbackTrends,
      sources: signals.slice(0, 8).map((s) => ({ title: s.sourceLabel, uri: s.url })),
      telemetry: {
        providerUsed: 'direct-rss',
        modelUsed: 'live-signals',
        latencyMs: Date.now() - startTime,
        rawSignalsCount: signals.length,
        breakdown,
      },
    };
  }
}

