import {
  AspectRatioType,
  CameraMotionType,
  FiveActTemplate,
  getFiveActStructure,
  MotionIntensityType,
  Scene,
  SceneTransitionType,
  VisualBible,
} from '../../src/types.ts';
import { generateAIJson, generateAIText } from './aiProvider.ts';

const CAMERA_MOTIONS: CameraMotionType[] = [
  'zoom_in',
  'pan_right',
  'pan_up',
  'zoom_out',
  'dolly_zoom',
  'pan_left',
  'orbital_drift',
  'pan_down',
  'shake_horror',
  'pulse',
];

function cleanSpokenDialogue(raw: string): string {
  return String(raw || '')
    .replace(/\[Escena\s*\d+:[^\]]*\]/gi, '')
    .replace(/\[\d+:\d+[^\]]*\]/gi, '')
    .replace(/^(Narrador|Locutor|Voz en off|Host|Speaker)\s*:\s*/gim, '')
    .replace(/\([^)]*\)/g, '') // remove stage directions in parentheses
    .replace(/\*+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getDurationTargets(duration: string, aspectRatio: AspectRatioType): {
  minScenes: number;
  maxScenes: number;
  exactTargetScenes: number;
  targetWords: string;
  wordsPerScene: string;
} {
  switch (duration) {
    case '30s':
      return {
        exactTargetScenes: 5,
        minScenes: 4,
        maxScenes: 5,
        targetWords: '65 a 78 palabras en total (~5 escenas de 5-6s cada una)',
        wordsPerScene: '12 a 16 palabras por escena',
      };
    case '60s':
      return {
        exactTargetScenes: 5,
        minScenes: 5,
        maxScenes: 6,
        targetWords: '130 a 155 palabras en total (~5 actos cinematográficos)',
        wordsPerScene: '24 a 32 palabras por escena (narración pausada con peso dramático)',
      };
    case '90s':
      return {
        exactTargetScenes: 5,
        minScenes: 5,
        maxScenes: 7,
        targetWords: '200 a 240 palabras en total (~5 actos extendidos)',
        wordsPerScene: '35 a 45 palabras por escena',
      };
    case '3m':
      return {
        exactTargetScenes: 7,
        minScenes: 7,
        maxScenes: 7,
        targetWords: '380 a 450 palabras en total (~7 bloques episódicos de ~25s cada uno a ritmo pausado)',
        wordsPerScene: '45 a 65 palabras por escena',
      };
    case '5m':
      return {
        exactTargetScenes: 7,
        minScenes: 7,
        maxScenes: 7,
        targetWords: '650 a 750 palabras en total (~7 bloques episódicos de ~40-45s cada uno)',
        wordsPerScene: '80 a 105 palabras por escena',
      };
    case '8m':
    case '10m':
      return {
        exactTargetScenes: 7,
        minScenes: 7,
        maxScenes: 7,
        targetWords: '1050 a 1250 palabras en total (~7 bloques episódicos de ~65-70s cada uno)',
        wordsPerScene: '140 a 180 palabras por escena',
      };
    default:
      return aspectRatio === '16:9'
        ? {
            exactTargetScenes: 12,
            minScenes: 10,
            maxScenes: 15,
            targetWords: '400 a 460 palabras en total',
            wordsPerScene: '28 a 38 palabras por escena',
          }
        : {
            exactTargetScenes: 5,
            minScenes: 5,
            maxScenes: 6,
            targetWords: '130 a 155 palabras en total (~5 actos virales)',
            wordsPerScene: '24 a 32 palabras por escena',
          };
  }
}

export function formatScenesAsLegacyScript(scenes: Scene[]): string {
  return scenes
    .map((s, idx) => {
      const header = s.timeRange && s.actRole
        ? `${s.timeRange} ${s.actRole}`
        : `Escena ${idx + 1}: ${s.title}`;
      const lines = [`[${header}]`];
      if (s.visualDescription) {
        lines.push(`Visual:\n${s.visualDescription}`);
      } else if (s.title) {
        lines.push(`Visual:\n${s.title}`);
      }
      if (s.onScreenText) {
        lines.push(`Texto en pantalla: "${s.onScreenText}"`);
      }
      if (s.soundEffect) {
        lines.push(`Efecto sonoro: ${s.soundEffect}`);
      }
      lines.push(`Voz en off:\n"${s.dialogue}"`);
      return lines.join('\n\n');
    })
    .join('\n\n\n');
}

export function parseFallbackTextIntoScenes(scriptText: string): Scene[] {
  // Try matching 5-act blocks or [Escena ...] blocks
  const blocks = scriptText.split(/(?=\[(?:\d+:\d+|\w|Escena))/gi).filter((b) => b.trim());
  const parsed: Scene[] = [];

  for (const block of blocks) {
    const headerMatch = block.match(/^\[(.*?)\]/);
    if (!headerMatch) continue;
    const headerContent = headerMatch[1].trim();
    const rest = block.slice(headerMatch[0].length).trim();

    let timeRange: string | undefined;
    let actRole: string | undefined;
    let title = headerContent;

    const timeMatch = headerContent.match(/^(\d+:\d+\s*-\s*\d+:\d+)\s*(.*)$/);
    if (timeMatch) {
      timeRange = `[${timeMatch[1].trim()}]`;
      actRole = timeMatch[2].trim() || 'ESCENA';
      title = `${actRole} (${timeMatch[1].trim()})`;
    } else {
      const escenaMatch = headerContent.match(/^Escena\s*\d+:\s*(.*)$/i);
      if (escenaMatch) {
        title = escenaMatch[1].trim();
      }
    }

    const visualMatch = rest.match(/Visual:\s*([\s\S]*?)(?=(?:Texto en pantalla:|Efecto sonoro:|Música:|Voz en off:|$))/i);
    const visualDescription = visualMatch ? visualMatch[1].trim() : undefined;

    const onScreenMatch = rest.match(/Texto en pantalla:\s*"?([^"\n]+)"?/i);
    const onScreenText = onScreenMatch ? onScreenMatch[1].trim() : undefined;

    const sfxMatch = rest.match(/(?:Efecto sonoro|Música):\s*([^\n]+)/i);
    const soundEffect = sfxMatch ? sfxMatch[1].trim() : undefined;

    const vozMatch = rest.match(/Voz en off:\s*"?([\s\S]*?)"?\s*$/i);
    let spokenDialogue = '';
    if (vozMatch) {
      spokenDialogue = cleanSpokenDialogue(vozMatch[1]);
    } else {
      spokenDialogue = cleanSpokenDialogue(rest);
    }

    if (!spokenDialogue && !visualDescription) continue;

    parsed.push({
      title: title || `Escena ${parsed.length + 1}`,
      dialogue: spokenDialogue,
      timeRange,
      actRole,
      visualDescription,
      onScreenText,
      soundEffect,
      imagePrompt: `Cinematic high detail shot: ${visualDescription || title}`,
      stockKeywords: (visualDescription || title)
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .slice(0, 3),
      cameraMotion: CAMERA_MOTIONS[parsed.length % CAMERA_MOTIONS.length],
    });
  }

  // Fallback for raw text without tags
  if (parsed.length === 0 && scriptText.trim()) {
    const paragraphs = scriptText
      .split(/\n\s*\n/)
      .map((p) => cleanSpokenDialogue(p))
      .filter(Boolean);

    paragraphs.slice(0, 8).forEach((p, idx) => {
      parsed.push({
        title: `Plano dinámico de impacto #${idx + 1}`,
        dialogue: p,
        imagePrompt: `Dramatic cinematic scene representing: ${p.slice(0, 90)}`,
        stockKeywords: ['technology', 'cinematic', 'modern'],
        cameraMotion: CAMERA_MOTIONS[idx % CAMERA_MOTIONS.length],
      });
    });
  }

  return parsed;
}

export async function generateStructuredViralScript(params: {
  prompt: string;
  genre: string;
  subgenre: string;
  duration: string;
  language?: string;
  aspectRatio?: AspectRatioType;
  channelTone?: string;
  trendContext?: string;
}): Promise<{
  hook: string;
  scenes: Scene[];
  visualBible?: VisualBible;
  script: string;
  providerUsed: string;
  modelUsed: string;
}> {
  const aspectRatio: AspectRatioType = params.aspectRatio || '9:16';
  const language = params.language || 'es';
  const langLabel =
    language === 'en' ? 'Inglés (English)' : language === 'pt' ? 'Portugués (Português)' : 'Español';
  const targets = getDurationTargets(params.duration || '60s', aspectRatio);
  const fiveActs = getFiveActStructure(params.duration || '60s');
  const framingHint =
    aspectRatio === '16:9'
      ? 'widescreen 16:9 horizontal composition'
      : aspectRatio === '1:1'
      ? 'square 1:1 centered composition'
      : 'vertical 9:16 portrait composition';

  const actsGuideText = fiveActs
    .map(
      (act, i) =>
        `Acto ${i + 1}: ${act.timeRange} ${act.actRole} -> Objetivo narrativo: ${act.pacingNote}`
    )
    .join('\n');

  const isRelatos =
    Boolean(
      (params.subgenre && params.subgenre.toLowerCase().includes('relatos')) ||
      (params.channelTone && params.channelTone.toLowerCase().includes('relatos')) ||
      (params.prompt && params.prompt.toLowerCase().includes('relatos de la noche'))
    );

  const formatLabel =
    aspectRatio === '16:9'
      ? 'episodio largo cinematográfico documental para YouTube (16:9 Widescreen)'
      : `video vertical de alta retención para Reels, TikTok y YouTube Shorts (${aspectRatio})`;

  const structuredPrompt = `Actúa como director creativo y showrunner galardonado de contenido narrativo audiovisual.
Diseña un guion cinematográfico estructurado en la arquitectura de actos para un ${formatLabel} de duración objetivo ${params.duration || '60s'} (${targets.targetWords}).

Datos del proyecto:
- Categoría / Enfoque: ${params.genre} (${params.subgenre})
- Tono del canal: ${params.channelTone || 'Suspenso psicológico, sobrio y tenso (narración en off pausada y directa)'}
- Idioma OBLIGATORIO para "dialogue", "visualDescription", "onScreenText" y "hook": ${langLabel}
- Tema / Idea central: "${params.prompt}"
${
  params.trendContext
    ? `\n### MATERIAL DE REFERENCIA / TRANSCRIPCIÓN COMPLETA DEL CASO:\n${params.trendContext}\n\nDIRECTIVAS DE ADAPTACIÓN:
- Adapta esta historia preservando los detalles más aterradores, nombres reales, horas exactas (ej. 'las 9:15 PM'), detalles cotidianos y coartadas del testimonio original.
- Distribuye la narrativa a lo largo de los actos de forma progresiva.`
    : ''
}
${
  isRelatos
    ? `\n### DIRECTIVA ESPECIAL: ESTILO OFICIAL "RELATOS DE LA NOCHE" (URIEL REYES):
- Cadencia de narración: Pausada, sobria, reflexiva y madura. Tono de radio nocturna íntima de terror testimonial real.
- Estructura episódica: Basada en testimonios humanos verosímiles (paramédicos en turnos nocturnos, carreteras desiertas, casetas de cobro, hospitales de madrugada, encuentros inexplicables).
- Cold Open (Acto 1): Inicia "in media res" con el detalle más perturbador del caso antes de cualquier presentación formal (ej. "Colocamos con cuidado el cuerpo en la camioneta forense... cuando algo se movió ahí dentro.").
- Bienvenida a la Comunidad (Acto 2 si aplica): "Bienvenidos a otro episodio de Relatos de la Noche, mi querida comunidad... Hoy nos subimos a ambulancias que recorren carreteras desoladas...".
- Tensión psicológica y verosimilitud: Prohibido usar clichés de monstruos de película o sustos infantiles. El miedo nace de la lentitud, de la soledad en la guardia y de lo que no tiene explicación médica o lógica.
- Cierre (Último Acto): Reflexión final y despedida sobria: "Si alguna vez viajas tarde por esa carretera y ves luces de emergencia a lo lejos... no te detengas. Buenas noches."`
    : ''
}

ARQUITECTURA OBLIGATORIA DE LOS ACTOS (${targets.exactTargetScenes} ESCENAS):
${actsGuideText}

REGLAS ESTRICTAS DE REDACCIÓN Y PRODUCCIÓN AUDIOVISUAL:
1. Genera exactamente las ${targets.exactTargetScenes} escenas correspondientes a la estructura de actos. Cada escena debe contener los siguientes campos específicos:
   - "timeRange": El rango de tiempo exacto (ej. "${fiveActs[0].timeRange}").
   - "actRole": El nombre del acto (ej. "${fiveActs[0].actRole}").
   - "title": Título descriptivo en español para el editor (ej. "Apertura en penumbra exterior").
   - "visualDescription": Dirección de arte cinematográfica precisa en español. Describe el tipo de plano (plano detalle, mirilla fisheye, contra-picado, cámara lenta), los gestos de los personajes, la iluminación tenebrista/práctica (luz de pantalla de teléfono, farol exterior) y la atmósfera.
   - "onScreenText": Texto gráfico corto y contundente entre comillas para captar la atención visual en pantalla (ej. "No querían entrar. Querían que ella abriera.", "¿Casualidad o recolección de datos?").
   - "soundEffect": Efecto sonoro diegético o musical sugerido (ej. "Tres toques secos de madera, seguidos de silencio absoluto.", "Zumbido ambiental tenue.").
   - "dialogue": Voz en off limpia en ${langLabel} lista para sintetizador de voz neural (prohibido escribir acotaciones, emojis o "Narrador:"). Debe ser una narración pausada, sobria, madura y de alto impacto psicológico (evitar saludos infantiles o clichés de YouTube).
   - "imagePrompt": Prompt fotográfico de ultra-alta fidelidad OBLIGATORIAMENTE en INGLÉS cinematográfico (${framingHint}). Incluye especificaciones de cámara: "Shot on ARRI Alexa Mini LF, 35mm anamorphic lens, f/1.8, cinematic film still, subtle natural 35mm grain", iluminación motivada: "low-key dramatic lighting, volumetric shadows, realistic practical screen glow", y la perspectiva del plano (si es mirilla: "extreme wide-angle fisheye door peephole circular perspective with black vignetted border").
   - "stockKeywords": 2 a 4 palabras clave en inglés para B-Roll de apoyo.
   - "cameraMotion": Elige el movimiento de cámara cinemático más adecuado ("zoom_in", "zoom_out", "pan_right", "pan_left", "pan_up", "pan_down", "dolly_zoom", "orbital_drift", "pulse", "shake_horror").
   - "motionIntensity": "subtle", "cinematic", "dynamic" o "aggressive".
   - "transition": "cut", "fade_black", "crossfade" o "whip_pan".

2. "visualBible" (Biblia Visual): Define las anclas consistentes para TODO el video:
   - "characterAnchor": Descripción física y visual precisa en INGLÉS del protagonista recurrente (ej. "A 17-year-old girl with straight dark hair, wearing an oversized heather grey hoodie, anxious face").
   - "antagonistAnchor": Descripción física en INGLÉS del antagonista o entidad secundaria si aplica (ej. "A disheveled 35-year-old athletic man in a dark navy tracksuit jacket with white shoulder stripes, breathless and sweating").
   - "environmentAnchor": Descripción visual en INGLÉS del entorno recurrente (ej. "Suburban house interior hallway at night with dark wooden doors and warm porch lantern visible through peephole").
   - "colorPalette": Paleta cromática en INGLÉS (ej. "dark moody desaturated tones, deep blue-grey shadows, warm amber highlights").
   - "lightingDirective": Estilo de iluminación en INGLÉS (ej. "dramatic low-key chiaroscuro, bounce light from smartphone screen, sharp volumetric shadows").

Devuelve ÚNICAMENTE un JSON válido con esta estructura exacta:
{
  "hook": "Frase inicial exacta de los primeros 3 segundos",
  "visualBible": {
    "characterAnchor": "English physical description of recurring subject or character",
    "antagonistAnchor": "English physical description of secondary antagonist/entity or None",
    "environmentAnchor": "English visual description of recurring world/environment",
    "colorPalette": "English color palette and grading",
    "lightingDirective": "English lighting and camera style"
  },
  "scenes": [
    {
      "timeRange": "[0:00 - 0:04]",
      "actRole": "EL GANCHO",
      "title": "Descripción corta en español",
      "visualDescription": "Dirección cinematográfica en español con planos, iluminación y gestos",
      "onScreenText": "Texto de impacto en pantalla",
      "soundEffect": "Efecto sonoro diegético",
      "dialogue": "Locución hablada limpia lista para voz neural",
      "imagePrompt": "Detailed English cinematic camera shot description with subject, action, lighting, framing, 8k",
      "stockKeywords": ["keyword 1", "keyword 2"],
      "cameraMotion": "dolly_zoom",
      "motionIntensity": "dynamic",
      "transition": "cut"
    }
  ]
}`;

  const { data, meta } = await generateAIJson<{
    hook?: string;
    visualBible?: {
      characterAnchor?: string;
      antagonistAnchor?: string;
      environmentAnchor?: string;
      colorPalette?: string;
      lightingDirective?: string;
    };
    scenes?: Array<{
      timeRange?: string;
      actRole?: string;
      title?: string;
      visualDescription?: string;
      onScreenText?: string;
      soundEffect?: string;
      dialogue?: string;
      imagePrompt?: string;
      stockKeywords?: string[];
      cameraMotion?: string;
      motionIntensity?: string;
      transition?: string;
    }>;
  }>(
    {
      systemInstruction:
        'Eres un guionista maestro de YouTube Shorts, TikTok, Facebook Reels y thrillers virales. Respondes exclusivamente en JSON válido con la estructura solicitada de 5 actos virales.',
      prompt: structuredPrompt,
      temperature: 0.7,
    },
    { hook: '', scenes: [] }
  );

  const rawVisualBible = data?.visualBible;
  const visualBible: VisualBible = {
    characterAnchor: String(rawVisualBible?.characterAnchor || '').trim(),
    antagonistAnchor: String(rawVisualBible?.antagonistAnchor || '').trim(),
    environmentAnchor: String(rawVisualBible?.environmentAnchor || '').trim(),
    colorPalette: String(rawVisualBible?.colorPalette || 'cinematic moody thriller tones').trim(),
    lightingDirective: String(
      rawVisualBible?.lightingDirective || 'cinematic low-key practical lighting with deep shadows'
    ).trim(),
  };

  // Provide robust defaults if the model left anchors blank
  if (!visualBible.characterAnchor && params.prompt) {
    visualBible.characterAnchor = `Key central protagonist relating to ${params.prompt.slice(0, 50)}`;
  }
  if (!visualBible.environmentAnchor) {
    visualBible.environmentAnchor = `Atmospheric ${params.genre || 'cinematic'} setting with authentic suspense mood`;
  }

  const rawScenes = Array.isArray(data?.scenes) ? data.scenes : [];
  const validMotions = new Set<string>(CAMERA_MOTIONS);
  const validIntensities = new Set<string>(['subtle', 'cinematic', 'dynamic', 'aggressive']);
  const validTransitions = new Set<string>(['cut', 'fade_black', 'crossfade', 'whip_pan']);

  let normalizedScenes: Scene[] = rawScenes
    .map((item, idx) => {
      const dialogue = cleanSpokenDialogue(item.dialogue || '');
      if (!dialogue) return null;

      const actTemplate = fiveActs[idx] || fiveActs[fiveActs.length - 1];
      const timeRange = item.timeRange?.trim() || actTemplate.timeRange;
      const actRole = item.actRole?.trim() || actTemplate.actRole;

      const motionCandidate = String(item.cameraMotion || '');
      const cameraMotion: CameraMotionType = validMotions.has(motionCandidate)
        ? (motionCandidate as CameraMotionType)
        : actTemplate.defaultMotion || CAMERA_MOTIONS[idx % CAMERA_MOTIONS.length];

      const intensityCandidate = String(item.motionIntensity || '');
      const motionIntensity: MotionIntensityType = validIntensities.has(intensityCandidate)
        ? (intensityCandidate as MotionIntensityType)
        : actTemplate.defaultIntensity || 'cinematic';

      const transitionCandidate = String(item.transition || '');
      const transition: SceneTransitionType = validTransitions.has(transitionCandidate)
        ? (transitionCandidate as SceneTransitionType)
        : idx === 0
        ? 'cut'
        : idx === fiveActs.length - 1
        ? 'fade_black'
        : 'crossfade';

      const keywords = Array.isArray(item.stockKeywords)
        ? item.stockKeywords
            .map((k) => String(k).trim())
            .filter(Boolean)
            .slice(0, 4)
        : [];

      const rawPrompt = String(item.imagePrompt || '').trim();
      const visualDesc = String(item.visualDescription || item.title || '').trim();
      const imagePrompt =
        rawPrompt.length > 15
          ? rawPrompt
          : `Cinematic ${framingHint}, shot on ARRI Alexa Mini LF, 35mm lens, atmospheric scene depicting ${visualDesc || 'dramatic moment'}, subject: ${visualBible.characterAnchor}${visualBible.antagonistAnchor && visualBible.antagonistAnchor.toLowerCase() !== 'none' ? `, antagonist: ${visualBible.antagonistAnchor}` : ''}, setting: ${visualBible.environmentAnchor}, ${visualBible.lightingDirective}, ${visualBible.colorPalette}, 8k photorealistic`;

      const sceneObj: Scene = {
        title: String(item.title || `${actRole}: Plano cinematográfico`).trim(),
        dialogue,
        timeRange,
        actRole,
        visualDescription: visualDesc,
        onScreenText: item.onScreenText?.trim() || undefined,
        soundEffect: item.soundEffect?.trim() || undefined,
        hookText: idx === 0 ? String(data?.hook || item.onScreenText || dialogue.slice(0, 90)).trim() : undefined,
        imagePrompt,
        stockKeywords: keywords.length > 0 ? keywords : ['cinematic', 'suspense', 'realism'],
        cameraMotion,
        motionIntensity,
        transition,
      };
      return sceneObj;
    })
    .filter((s): s is Scene => s !== null);

  // Resilient fallback if a model returned non-JSON or empty scenes array
  if (normalizedScenes.length === 0) {
    const textFallback = await generateAIText({
      prompt: `Escribe un guion viral de suspenso en formato de 5 actos sobre "${params.prompt}" en ${langLabel}. Usa estrictamente el formato:\n[0:00 - 0:04] EL GANCHO\nVisual: Descripción cinematográfica\nTexto en pantalla: "Frase de impacto"\nEfecto sonoro: Sonido sugerido\nVoz en off:\nTexto hablado limpio.`,
      temperature: 0.7,
    });
    normalizedScenes = parseFallbackTextIntoScenes(textFallback.text);
  }

  const legacyScript = formatScenesAsLegacyScript(normalizedScenes);
  const hook =
    String(data?.hook || '').trim() ||
    normalizedScenes[0]?.onScreenText?.trim() ||
    normalizedScenes[0]?.dialogue?.split(/[.!?]/)[0]?.trim() ||
    '';

  return {
    hook,
    scenes: normalizedScenes,
    visualBible,
    script: legacyScript,
    providerUsed: meta.providerUsed,
    modelUsed: meta.modelUsed,
  };
}

