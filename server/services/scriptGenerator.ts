import {
  AspectRatioType,
  CameraMotionType,
  Scene,
  VisualBible,
} from '../../src/types.ts';
import { generateAIJson, generateAIText } from './aiProvider.ts';

const CAMERA_MOTIONS: CameraMotionType[] = [
  'zoom_in',
  'pan_right',
  'zoom_out',
  'pan_left',
  'pulse',
];

function cleanSpokenDialogue(raw: string): string {
  return String(raw || '')
    .replace(/\[Escena\s*\d+:[^\]]*\]/gi, '')
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
        exactTargetScenes: 4,
        minScenes: 4,
        maxScenes: 5,
        targetWords: '68 a 78 palabras en total (~4 escenas de 7.5s cada una)',
        wordsPerScene: '16 a 19 palabras por escena (ideal para 7.5 a 8 segundos)',
      };
    case '60s':
      return {
        exactTargetScenes: 8,
        minScenes: 7,
        maxScenes: 8,
        targetWords: '135 a 155 palabras en total (~7-8 escenas de 7.5s a 8s)',
        wordsPerScene: '18 a 21 palabras por escena (ideal para 7.5 a 8 segundos)',
      };
    case '90s':
      return {
        exactTargetScenes: 12,
        minScenes: 11,
        maxScenes: 12,
        targetWords: '210 a 240 palabras en total (~11-12 escenas de 7.5s a 8s)',
        wordsPerScene: '18 a 21 palabras por escena (ideal para 7.5 a 8 segundos)',
      };
    case '3m':
      return {
        exactTargetScenes: 21,
        minScenes: 20,
        maxScenes: 24,
        targetWords: '400 a 460 palabras en total (~21 a 24 escenas de 8s)',
        wordsPerScene: '18 a 22 palabras por escena (ideal para 7.5 a 8 segundos)',
      };
    case '5m':
      return {
        exactTargetScenes: 38,
        minScenes: 36,
        maxScenes: 40,
        targetWords: '720 a 800 palabras en total (~38 escenas de 8s)',
        wordsPerScene: '18 a 22 palabras por escena (ideal para 7.5 a 8 segundos)',
      };
    case '8m':
    case '10m':
      return {
        exactTargetScenes: 60,
        minScenes: 58,
        maxScenes: 62,
        targetWords: '1150 a 1250 palabras en total (~60 escenas de 8s)',
        wordsPerScene: '18 a 22 palabras por escena (ideal para 7.5 a 8 segundos)',
      };
    default:
      return aspectRatio === '16:9'
        ? {
            exactTargetScenes: 21,
            minScenes: 20,
            maxScenes: 24,
            targetWords: '400 a 460 palabras en total (~21 escenas)',
            wordsPerScene: '18 a 22 palabras por escena',
          }
        : {
            exactTargetScenes: 8,
            minScenes: 7,
            maxScenes: 8,
            targetWords: '135 a 155 palabras en total (~8 escenas)',
            wordsPerScene: '18 a 21 palabras por escena',
          };
  }
}

export function formatScenesAsLegacyScript(scenes: Scene[]): string {
  return scenes
    .map((s, idx) => `[Escena ${idx + 1}: ${s.title}]\n${s.dialogue}`)
    .join('\n\n');
}

export function parseFallbackTextIntoScenes(scriptText: string): Scene[] {
  const regex = /\[Escena\s*\d+:\s*([^\]]+)\]\s*([\s\S]*?)(?=\[Escena\s*\d+:|$)/gi;
  const parsed: Scene[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(scriptText)) !== null) {
    const visualTitle = match[1].trim();
    const spokenDialogue = cleanSpokenDialogue(match[2]);
    if (!spokenDialogue) continue;
    parsed.push({
      title: visualTitle,
      dialogue: spokenDialogue,
      imagePrompt: `Cinematic high detail shot: ${visualTitle}`,
      stockKeywords: visualTitle
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .slice(0, 3),
      cameraMotion: CAMERA_MOTIONS[parsed.length % CAMERA_MOTIONS.length],
    });
  }

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
  const framingHint =
    aspectRatio === '16:9'
      ? 'widescreen 16:9 horizontal composition'
      : aspectRatio === '1:1'
      ? 'square 1:1 centered composition'
      : 'vertical 9:16 portrait composition';

  const structuredPrompt = `Actúa como director creativo jefe de videos virales de alta retención para YouTube, TikTok y Facebook.
Diseña un guion estructurado escena por escena para un video en formato ${aspectRatio} de duración objetivo ${params.duration || '60s'} (${targets.targetWords}).

Datos del proyecto:
- Categoría / Enfoque: ${params.genre} (${params.subgenre})
- Tono del canal: ${params.channelTone || 'Dinámico, claro, revelador y de alta retención'}
- Idioma OBLIGATORIO para "dialogue" y "hook": ${langLabel}
- Tema / Idea central: "${params.prompt}"
${
  params.trendContext
    ? `\n### MATERIAL DE REFERENCIA / TRANSCRIPCIÓN COMPLETA DEL CASO:\n${params.trendContext}\n\nDIRECTIVAS DE ADAPTACIÓN:
- Se te ha proporcionado el material o transcripción completa. Adapta esta historia preservando los detalles más aterradores, nombres reales, horas (ej. 'las 3:14 AM'), ubicaciones y diálogos del testimonio original.
- Distribuye la narrativa a lo largo de las ${targets.exactTargetScenes} escenas de forma progresiva (Gancho inicial -> Tensión -> Clímax -> Cierre inquietante) para que cubra exactamente la duración de ${params.duration || '60s'}.`
    : ''
}

Reglas estrictas de retención y producción:
1. Genera OBLIGATORIAMENTE entre ${targets.minScenes} y ${targets.maxScenes} escenas (meta exacta para cubrir la duración de ${params.duration || '60s'}: ${targets.exactTargetScenes} escenas). Cada escena debe durar aproximadamente 7.5 a 8 segundos (${targets.wordsPerScene}).
2. La Escena 1 DEBE abrir con un Hook verbal explosivo en los primeros 3 segundos que detenga el scroll de inmediato (prohibido saludar con "Hola amigos" o "Bienvenidos").
3. "dialogue" debe contener ÚNICAMENTE el texto limpio que leerá el sintetizador de voz neural en ${langLabel} (sin acotaciones entre paréntesis, sin emojis, sin escribir "Narrador:").
4. "title" es la descripción visual clara en español para el editor.
5. "visualBible" (Biblia Visual): Define las anclas visuales consistentes para TODO el video:
   - "characterAnchor": Descripción física y visual precisa en INGLÉS del protagonista recurrente o sujeto clave (edad, vestimenta, rasgos, estilo). Si el video no tiene personaje humano, describir la entidad o elemento principal recurrente (o "None" si es puramente documental de paisajes).
   - "environmentAnchor": Descripción visual en INGLÉS del entorno, época, ubicación y arquitectura recurrente.
   - "colorPalette": Paleta cromática dominante en INGLÉS (ej. "cold desaturated tones with deep cyan shadows", "warm golden hour hues").
   - "lightingDirective": Estilo de iluminación en INGLÉS (ej. "volumetric chiaroscuro moody lighting, sharp shadows").
6. "imagePrompt": OBLIGATORIAMENTE en INGLÉS cinematográfico (${framingHint}).
   - PROHIBIDO poner el texto de la locución hablada o diálogo aquí.
   - Debe describir la composición visual de la cámara, el sujeto (respetando characterAnchor), la acción física visible que ocurre en esta escena específica, el entorno (respetando environmentAnchor) y la iluminación.
7. "stockKeywords" DEBE contener de 2 a 4 términos cortos en INGLÉS ideales para buscar clips reales B-Roll en Pexels/Pixabay (ej. ["robot hand", "data center", "stock market chart"]).
8. "cameraMotion" debe alternar entre: "zoom_in", "zoom_out", "pan_right", "pan_left", "pulse".
9. La última escena debe cerrar con una conclusión memorable y un llamado a la acción orgánico.

Devuelve ÚNICAMENTE un JSON válido con esta estructura exacta:
{
  "hook": "Frase inicial exacta de los primeros 3 segundos",
  "visualBible": {
    "characterAnchor": "English physical description of recurring subject or character",
    "environmentAnchor": "English visual description of recurring world/environment",
    "colorPalette": "English color palette and grading",
    "lightingDirective": "English lighting and camera style"
  },
  "scenes": [
    {
      "title": "Descripción visual en español de la escena",
      "dialogue": "Locución hablada limpia lista para voz neural",
      "imagePrompt": "Detailed English cinematic camera shot description with subject, action, lighting, framing, 8k",
      "stockKeywords": ["english keyword 1", "english keyword 2"],
      "cameraMotion": "zoom_in"
    }
  ]
}`;

  const { data, meta } = await generateAIJson<{
    hook?: string;
    visualBible?: {
      characterAnchor?: string;
      environmentAnchor?: string;
      colorPalette?: string;
      lightingDirective?: string;
    };
    scenes?: Array<{
      title?: string;
      dialogue?: string;
      imagePrompt?: string;
      stockKeywords?: string[];
      cameraMotion?: string;
    }>;
  }>(
    {
      systemInstruction:
        'Eres un guionista maestro de YouTube Shorts, TikTok, Facebook Reels y documentales virales. Respondes exclusivamente en JSON válido siguiendo el esquema solicitado.',
      prompt: structuredPrompt,
      temperature: 0.7,
    },
    { hook: '', scenes: [] }
  );

  const rawVisualBible = data?.visualBible;
  const visualBible: VisualBible = {
    characterAnchor: String(rawVisualBible?.characterAnchor || '').trim(),
    environmentAnchor: String(rawVisualBible?.environmentAnchor || '').trim(),
    colorPalette: String(rawVisualBible?.colorPalette || 'cinematic moody tones').trim(),
    lightingDirective: String(rawVisualBible?.lightingDirective || 'cinematic volumetric lighting').trim(),
  };

  // Provide robust defaults if the model left anchors blank
  if (!visualBible.characterAnchor && params.prompt) {
    visualBible.characterAnchor = `Key central subject relating to ${params.prompt.slice(0, 50)}`;
  }
  if (!visualBible.environmentAnchor) {
    visualBible.environmentAnchor = `Atmospheric ${params.genre || 'cinematic'} setting with authentic mood`;
  }

  const rawScenes = Array.isArray(data?.scenes) ? data.scenes : [];
  const validMotions = new Set<string>(CAMERA_MOTIONS);

  let normalizedScenes: Scene[] = rawScenes
    .map((item, idx) => {
      const dialogue = cleanSpokenDialogue(item.dialogue || '');
      if (!dialogue) return null;

      const motionCandidate = String(item.cameraMotion || '');
      const cameraMotion: CameraMotionType = validMotions.has(motionCandidate)
        ? (motionCandidate as CameraMotionType)
        : CAMERA_MOTIONS[idx % CAMERA_MOTIONS.length];

      const keywords = Array.isArray(item.stockKeywords)
        ? item.stockKeywords
            .map((k) => String(k).trim())
            .filter(Boolean)
            .slice(0, 4)
        : [];

      const rawPrompt = String(item.imagePrompt || '').trim();
      const imagePrompt =
        rawPrompt.length > 15
          ? rawPrompt
          : `Cinematic ${framingHint}, atmospheric scene depicting ${item.title || 'dramatic moment'}, subject: ${visualBible.characterAnchor}, setting: ${visualBible.environmentAnchor}, ${visualBible.lightingDirective}, ${visualBible.colorPalette}, 8k photorealistic`;

      const sceneObj: Scene = {
        title: String(item.title || `Escena ${idx + 1}: Plano cinematográfico`).trim(),
        dialogue,
        hookText: idx === 0 ? String(data?.hook || dialogue.slice(0, 90)).trim() : undefined,
        imagePrompt,
        stockKeywords: keywords.length > 0 ? keywords : ['cinematic', 'high quality'],
        cameraMotion,
      };
      return sceneObj;
    })
    .filter((s): s is Scene => s !== null);

  // Resilient fallback if a model returned non-JSON or empty scenes array
  if (normalizedScenes.length === 0) {
    const textFallback = await generateAIText({
      prompt: `Escribe un guion viral de ${targets.minScenes} escenas sobre "${params.prompt}" en ${langLabel}. Usa estrictamente el formato:\n[Escena 1: Descripción visual]\nTexto hablado limpio sin acotaciones.`,
      temperature: 0.7,
    });
    normalizedScenes = parseFallbackTextIntoScenes(textFallback.text);
  }

  const legacyScript = formatScenesAsLegacyScript(normalizedScenes);
  const hook =
    String(data?.hook || '').trim() ||
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

