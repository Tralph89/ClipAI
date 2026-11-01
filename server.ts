import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// 1. Live Trend Discovery with Google Search Grounding
app.post('/api/trends/search', async (req, res) => {
  try {
    const { query, niche, region = 'Global / Español', platforms = [] } = req.body;
    const ai = getGenAIClient();

    const searchFocus = query?.trim()
      ? `sobre "${query.trim()}"`
      : `en el nicho de "${niche || 'Tecnología, Negocios y Cultura Viral'}"`;

    const prompt = `Investiga en tiempo real usando Google Search las 6 tendencias más virales, noticias de última hora o temas de alto crecimiento hoy ${searchFocus} (${region}) ideales para crear videos en ${platforms.length ? platforms.join(', ') : 'TikTok, YouTube Shorts, Instagram Reels, LinkedIn y YouTube'}.

Devuelve ÚNICAMENTE un bloque JSON válido (un array de 6 objetos) con esta estructura exacta, sin texto adicional fuera del bloque JSON:
[
  {
    "title": "Título corto y magnético de la tendencia",
    "summary": "Resumen claro de qué está pasando hoy y datos clave reales (2-3 oraciones)",
    "viralScore": 94,
    "category": "Categoría o nicho",
    "whyTrending": "Razón específica por la que está explotando en búsquedas y redes hoy",
    "suggestedHook": "Gancho verbal de los primeros 3 segundos para retener a la audiencia",
    "angle": "Enfoque recomendado para diferenciarse en video",
    "recommendedFormats": ["9:16", "16:9"],
    "recommendedPlatforms": ["tiktok", "youtube_shorts", "instagram_reels", "linkedin", "youtube_long"],
    "keywords": ["palabra1", "palabra2", "palabra3"]
  }
]`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const rawText = response.text || '[]';
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const groundedSources: Array<{ title: string; uri: string }> = [];

    for (const chunk of chunks) {
      if (chunk.web?.uri) {
        groundedSources.push({
          title: chunk.web.title || new URL(chunk.web.uri).hostname,
          uri: chunk.web.uri,
        });
      }
    }

    let parsedTrends: any[] = [];
    const jsonMatch =
      rawText.match(/```json\s*([\s\S]*?)\s*```/) ||
      rawText.match(/(\[\s*\{[\s\S]*\}\s*\])/);

    if (jsonMatch) {
      try {
        parsedTrends = JSON.parse(jsonMatch[1]);
      } catch {
        parsedTrends = [];
      }
    }

    const enrichedTrends = (Array.isArray(parsedTrends) ? parsedTrends : []).map((item, idx) => ({
      id: `trend-${Date.now()}-${idx}`,
      title: item.title || `Tendencia #${idx + 1}`,
      summary: item.summary || '',
      viralScore: typeof item.viralScore === 'number' ? item.viralScore : 88,
      category: item.category || niche || 'Tendencia',
      whyTrending: item.whyTrending || 'Alto volumen de búsqueda en las últimas 24 horas.',
      suggestedHook: item.suggestedHook || 'Nadie está hablando de lo que acaba de pasar con esto...',
      angle: item.angle || 'Explicación rápida con datos visuales y conclusión accionable.',
      recommendedFormats: Array.isArray(item.recommendedFormats) ? item.recommendedFormats : ['9:16', '16:9'],
      recommendedPlatforms: Array.isArray(item.recommendedPlatforms)
        ? item.recommendedPlatforms
        : ['tiktok', 'youtube_shorts', 'instagram_reels'],
      keywords: Array.isArray(item.keywords) ? item.keywords : [],
      sources: groundedSources.slice(0, 5),
      detectedAt: Date.now(),
    }));

    res.json({ trends: enrichedTrends, sources: groundedSources });
  } catch (error: any) {
    console.error('Error searching trends:', error);
    res.status(500).json({ error: error.message || 'Error al buscar tendencias en vivo.' });
  }
});

// 2. Generate Viral Video Script & Scenes
app.post('/api/script', async (req, res) => {
  try {
    const {
      prompt,
      genre,
      subgenre,
      duration,
      language = 'es',
      aspectRatio = '9:16',
      channelTone = 'Dinámico, claro y de alta retención',
      trendContext,
    } = req.body;

    const ai = getGenAIClient();
    const isLongForm = aspectRatio === '16:9' || duration === '3m' || duration === '5m' || duration === '10m';
    const sceneCount = isLongForm ? '6 a 8 escenas detalladas' : '4 a 5 escenas dinámicas de alto impacto';

    const fullPrompt = `Actúa como un director creativo de videos virales para redes sociales.
Crea un guion estructurado para un video en formato ${aspectRatio} (${isLongForm ? 'Formato horizontal YouTube / LinkedIn' : 'Formato vertical Shorts / TikTok / Reels'}) de duración aproximada ${duration}.
- Género: ${genre} (${subgenre})
- Tono del canal: ${channelTone}
- Idioma: ${language === 'es' ? 'Español' : language === 'en' ? 'Inglés' : language}
- Idea / Tema principal: "${prompt}"
${trendContext ? `- Contexto de tendencia en tiempo real: ${trendContext}` : ''}

Reglas estrictas de formato:
1. Divide el guion en ${sceneCount}.
2. Cada escena DEBE comenzar con el encabezado exacto: [Escena X: Descripción visual detallada del sujeto, acción, entorno e iluminación]
3. Debajo de cada encabezado [Escena X: ...], escribe únicamente el diálogo/locución hablada por el narrador (sin acotaciones entre paréntesis ni nombres de locutor, listo para leerse en voz alta).
4. La Escena 1 debe tener un gancho (Hook) irresistible en los primeros 3 segundos.
5. La última escena debe incluir un cierre memorable y llamado a la acción (CTA).`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: fullPrompt,
    });

    res.json({ script: response.text || '' });
  } catch (error: any) {
    console.error('Error generating script:', error);
    res.status(500).json({ error: error.message || 'Error al generar el guion.' });
  }
});

// 3. AI Visual Bible & ComfyUI Prompt Director (Guarantees Style & Scene Coherence)
app.post('/api/visuals/craft-prompts', async (req, res) => {
  try {
    const {
      scenes = [],
      styleProfile,
      architecture = 'flux1',
      aspectRatio = '9:16',
      existingVisualBible,
    } = req.body;

    const ai = getGenAIClient();

    const archInstructions =
      architecture === 'sdxl'
        ? `Arquitectura destino: SDXL (Stable Diffusion XL + LoRA).
Formato de Positive Prompt requerido: Tags descriptivos en INGLÉS separados por comas, iniciando OBLIGATORIAMENTE con "${styleProfile?.sdxlTags || '(masterpiece, best quality:1.3)'}", seguido de la descripción consistente del personaje/sujeto ancla, la acción de la escena, el entorno consistente y cerrando con "${styleProfile?.cameraAndLighting || 'dramatic lighting, 8k'}".`
        : `Arquitectura destino: Flux.1 (Dev / Schnell).
Formato de Positive Prompt requerido: Oraciones descriptivas ricas en INGLÉS (lenguaje natural de alta precisión), iniciando OBLIGATORIAMENTE con "${styleProfile?.fluxPrefix || 'Cinematic high-detail visual,'}", seguido de la descripción exacta e invariable del personaje/sujeto ancla, la composición de la escena en formato ${aspectRatio}, el entorno y cerrando con "${styleProfile?.cameraAndLighting || 'dramatic lighting'}".`;

    const prompt = `Actúa como un Director de Fotografía e Ingeniero de Prompts para ComfyUI en GPU local.
Necesitamos que TODAS las escenas de este video tengan una coherencia visual absoluta con el estilo "${styleProfile?.name || 'Cinematográfico'}" (${styleProfile?.description || ''}).

${archInstructions}

Regla crítica de Estilo:
- PROHIBIDO mezclar estilos distintos. Si el estilo es "${styleProfile?.name}", cada escena debe reflejar inequívocamente la estética "${styleProfile?.name}".
- Negative Prompt base obligatorio: "${styleProfile?.negativePrompt || 'lowres, blurry, watermark, text, deformed'}"
${
  existingVisualBible?.characterAnchor
    ? `- Respeta esta Ancla de Personaje/Sujeto definida por el usuario: "${existingVisualBible.characterAnchor}"`
    : ''
}
${
  existingVisualBible?.environmentAnchor
    ? `- Respeta esta Ancla de Entorno/Atmósfera definida por el usuario: "${existingVisualBible.environmentAnchor}"`
    : ''
}

Escenas del proyecto:
${scenes
  .map(
    (s: any, i: number) =>
      `Escena ${i + 1}: Visual original="${s.title}" | Diálogo="${s.dialogue}"`
  )
  .join('\n')}

Devuelve un JSON con esta estructura exacta:
{
  "visualBible": {
    "characterAnchor": "Descripción física exacta en inglés del protagonista o sujeto recurrente para mantener identidad en todas las escenas (ej. 'a 30-year-old male tech researcher with silver-rimmed glasses, dark navy turtleneck, short tousled black hair')",
    "environmentAnchor": "Descripción en inglés de la atmósfera, época y arquitectura común (ej. 'sleek minimalist futuristic laboratory with obsidian glass walls')",
    "colorPalette": "Paleta cromática dominante en inglés (ej. 'deep obsidian, electric cyan, warm amber rim light')",
    "lightingDirective": "Directiva de cámara e iluminación consistente en inglés"
  },
  "scenePrompts": [
    {
      "sceneIndex": 0,
      "comfyPositivePrompt": "Prompt positivo completo en inglés listo para ComfyUI que incluye el prefijo del estilo, el characterAnchor, la acción específica de esta escena, el environmentAnchor y la iluminación",
      "comfyNegativePrompt": "Negative prompt en inglés específico para proteger el estilo y anatomía en esta escena"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (error: any) {
    console.error('Error crafting ComfyUI prompts:', error);
    res.status(500).json({
      error: error.message || 'No se pudieron sincronizar los prompts técnicos con IA.',
    });
  }
});

// 4. ComfyUI Server-Side Proxy (For Tunnel URLs or Local Backend Execution)
app.post('/api/comfy/proxy', async (req, res) => {
  try {
    const { serverUrl, endpoint, method = 'GET', body } = req.body;
    if (!serverUrl) {
      return res.status(400).json({ error: 'Se requiere serverUrl de ComfyUI.' });
    }
    const baseUrl = serverUrl.replace(/\/+$/, '');
    const targetUrl = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    if (method !== 'GET' && body) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return res.status(response.status).json({
        error: `ComfyUI respondió con HTTP ${response.status}: ${errText.slice(0, 200)}`,
      });
    }

    // If fetching an image via /view, convert binary image to base64 dataUrl
    if (endpoint.startsWith('/view')) {
      const arrayBuf = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);
      const mime = response.headers.get('content-type') || 'image/png';
      return res.json({
        imageUrl: `data:${mime};base64,${buffer.toString('base64')}`,
      });
    }

    const data = await response.json();
    return res.json(data);
  } catch (error: any) {
    res.status(502).json({
      error: `No se pudo conectar a ComfyUI desde el servidor (${error.message}). Si ComfyUI corre en tu PC local (127.0.0.1:8188), usa el modo "Conexión Directa desde Navegador" o un túnel HTTPS.`,
    });
  }
});

// 5. Speech Generation (TTS) using gemini-3.8-flash-lite-tts via Interactions API
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voice = 'Kore', language = 'es' } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Se requiere texto para generar la voz.' });
    }

    const ai = getGenAIClient();
    const cleanText = text
      .replace(/\[Escena\s*\d+:[^\]]*\]/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    const langCode =
      language === 'en' ? 'en-US' : language === 'pt' ? 'pt-BR' : language === 'fr' ? 'fr-FR' : 'es-US';

    const interaction = await ai.interactions.create({
      model: 'gemini-3.8-flash-lite-tts',
      input: [
        {
          type: 'text',
          text: cleanText,
          annotations: [
            {
              type: 'speech_metadata',
              style: 'Energetic, clear, engaging social media creator narrator',
            },
          ],
        },
      ],
      response_format: { type: 'audio' },
      generation_config: {
        speech_config: [
          {
            language: langCode,
            voice,
          },
        ],
      },
    });

    const audio = interaction.output_audio;
    if (audio?.data) {
      const mimeType = audio.mime_type || 'audio/wav';
      return res.json({
        audioDataUrl: `data:${mimeType};base64,${audio.data}`,
        mimeType,
      });
    }

    for (const step of interaction.steps || []) {
      if (step.type === 'model_output') {
        const audioPart = step.content?.find((c: any) => c.type === 'audio');
        if (audioPart && (audioPart as any).data) {
          const mimeType = (audioPart as any).mime_type || 'audio/wav';
          return res.json({
            audioDataUrl: `data:${mimeType};base64,${(audioPart as any).data}`,
            mimeType,
          });
        }
      }
    }

    throw new Error('El modelo TTS no devolvió datos de audio.');
  } catch (error: any) {
    console.error('Error generating TTS:', error);
    res.status(500).json({ error: error.message || 'No se pudo generar la narración de voz.' });
  }
});

// 6. Scene Image Generation (Cloud Fallback with strict Style Profile, Visual Bible & Seed Lock)
app.post('/api/image', async (req, res) => {
  const {
    prompt,
    style,
    aspectRatio = '9:16',
    isThumbnail = false,
    comfyPositivePrompt,
    comfyNegativePrompt,
    visualBible,
    seed,
  } = req.body;

  const styleDescriptions: Record<string, string> = {
    anime:
      '2D Japanese anime feature film key visual in the style of Makoto Shinkai and Ufotable, crisp cel-shaded linework, vibrant anime colors, NOT photorealistic',
    biblia:
      'epic classical biblical historical oil painting in the style of Caravaggio and Gustave Dore, dramatic chiaroscuro candlelight, ancient robes and stone architecture, masterpiece oil on canvas',
    cartoon:
      '3D Pixar and Disney feature animation style render, expressive stylized character proportions, soft subsurface scattering, warm whimsical lighting',
    cinematic:
      'Hollywood blockbuster cinematography shot on ARRI Alexa 65 with anamorphic lens, dramatic teal and amber volumetric lighting, shallow depth of field',
    comic:
      'American graphic novel comic book art, heavy black ink outlines, Ben-Day halftone dots, dynamic comic panel framing, vibrant pop colors',
    fantasy:
      'epic high fantasy digital painting, magical glowing runes and atmosphere, intricate armor and mythical citadel, Weta Workshop concept art',
    horror:
      'A24 dark psychological horror cinematography, eerie volumetric fog, oppressive shadows, cold desaturated moonlight, high suspense',
    photorealistic:
      'ultra-photorealistic 8k RAW editorial photography shot on Sony A7R V 85mm f/1.4, natural skin texture, crisp details, National Geographic realism',
    scifi:
      'futuristic cyberpunk sci-fi concept art, Blade Runner 2049 aesthetic, glowing cyan and magenta neon holograms, sleek megastructures',
    pixelart:
      'authentic 16-bit SNES retro pixel art scene, crisp pixel grid alignment, hand-crafted dithering, nostalgic arcade sprite work, NOT 3d or smooth',
    lego:
      'macro tilt-shift photography of a miniature world built 100% from glossy ABS plastic LEGO bricks and official yellow LEGO minifigures',
    minecraft:
      'Minecraft voxel block world rendered with RTX raytracing shaders, everything made of 1x1m cubic pixelated blocks and blocky voxel characters',
  };

  const styleDirective = styleDescriptions[style] || styleDescriptions.cinematic;
  const bibleContext = visualBible
    ? `Character/Subject consistency: ${visualBible.characterAnchor || ''}. Environment consistency: ${visualBible.environmentAnchor || ''}. Color palette: ${visualBible.colorPalette || ''}.`
    : '';

  const fullPrompt = comfyPositivePrompt?.trim()
    ? `${comfyPositivePrompt.trim()}${comfyNegativePrompt ? ` (Avoid: ${comfyNegativePrompt})` : ''}`
    : isThumbnail
    ? `Viral social media video thumbnail, extreme contrast, expressive focal subject: ${prompt}. Strict Visual Style: ${styleDirective}. ${bibleContext} No small illegible text.`
    : `Strict Visual Style: ${styleDirective}. ${bibleContext} Scene description: ${prompt}. High resolution, cohesive art direction.`;

  try {
    const ai = getGenAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-image',
      contents: {
        parts: [{ text: fullPrompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio === '16:9' ? '16:9' : aspectRatio === '1:1' ? '1:1' : '9:16',
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        const mime = part.inlineData.mimeType ?? 'image/png';
        return res.json({
          imageUrl: `data:${mime};base64,${part.inlineData.data}`,
          provider: 'gemini',
        });
      }
    }
  } catch (err) {
    console.warn('Gemini image generation fallback triggered:', (err as Error).message);
  }

  // Deterministic seed-locked high-res fallback
  const width = aspectRatio === '16:9' ? 1280 : aspectRatio === '1:1' ? 1024 : 720;
  const height = aspectRatio === '16:9' ? 720 : aspectRatio === '1:1' ? 1024 : 1280;
  const effectiveSeed = typeof seed === 'number' && seed > 0 ? seed : Math.floor(Math.random() * 1000000);
  const encodedPrompt = encodeURIComponent(fullPrompt.slice(0, 500));
  const fallbackUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${effectiveSeed}&model=flux&nologo=true`;

  return res.json({
    imageUrl: fallbackUrl,
    provider: 'pollinations_flux',
  });
});

// 7. Music Generation (Lyria 3 Clip Preview)
app.post('/api/music', async (req, res) => {
  try {
    const { prompt, genre, mood } = req.body;
    const ai = getGenAIClient();

    const musicPrompt = `Generate a 30-second instrumental background music track for a ${genre || 'dynamic'} social media video. Mood: ${mood || prompt || 'upbeat, modern, cinematic'}.`;

    const response = await ai.models.generateContentStream({
      model: 'lyria-3-clip-preview',
      contents: musicPrompt,
    });

    const audioChunks: Buffer[] = [];
    let mimeType = 'audio/mpeg';

    for await (const chunk of response) {
      const parts = chunk.candidates?.[0]?.content?.parts;
      if (!parts) continue;
      for (const part of parts) {
        if (part.inlineData?.data) {
          if (audioChunks.length === 0 && part.inlineData.mimeType) {
            mimeType = part.inlineData.mimeType;
          }
          audioChunks.push(Buffer.from(part.inlineData.data, 'base64'));
        }
      }
    }

    if (audioChunks.length === 0) {
      throw new Error('No se recibieron fragmentos de audio de Lyria.');
    }

    const audioBase64 = Buffer.concat(audioChunks).toString('base64');
    res.json({
      audioDataUrl: `data:${mimeType};base64,${audioBase64}`,
    });
  } catch (error: any) {
    console.warn('Lyria music generation error:', error.message);
    res.status(500).json({
      error: error.message || 'No se pudo generar música con Lyria (requiere clave de pago activa). Usa las pistas de estudio integradas.',
    });
  }
});

// 8. Scene Video Generation (Veo / Omni Flash via Interactions API)
app.post('/api/video/animate', async (req, res) => {
  try {
    const { prompt, imageUrl, aspectRatio = '9:16' } = req.body;
    const ai = getGenAIClient();

    const inputs: any[] = [];
    if (imageUrl && imageUrl.startsWith('data:')) {
      const [header, base64Data] = imageUrl.split(',');
      const mimeMatch = header.match(/data:(.*?);base64/);
      inputs.push({
        type: 'image',
        mime_type: mimeMatch ? mimeMatch[1] : 'image/png',
        data: base64Data,
      });
    }

    inputs.push({
      type: 'text',
      text: `Cinematic smooth camera motion, high detail: ${prompt}`,
    });

    const interaction = await ai.interactions.create(
      {
        model: 'gemini-omni-1.1-flash',
        input: inputs,
        background: false,
        store: false,
        stream: false,
        response_format: {
          type: 'video',
          aspect_ratio: aspectRatio === '16:9' ? '16:9' : '9:16',
          duration: '5s',
          resolution: '720p',
        },
      } as any,
      { timeout: 300000 }
    );

    const videoPart = interaction.output_video;
    if (videoPart?.data) {
      const mime = videoPart.mime_type || 'video/mp4';
      return res.json({
        videoDataUrl: `data:${mime};base64,${videoPart.data}`,
      });
    }

    throw new Error('No se recibió video de gemini-omni-1.1-flash.');
  } catch (error: any) {
    console.warn('Omni Flash video generation error:', error.message);
    res.status(500).json({
      error:
        error.message ||
        'La generación con Veo / Omni Flash requiere una API Key de facturación activa. Se aplicará animación de cámara Ken Burns en tiempo real.',
    });
  }
});

// 9. Subtitles SRT / Timed Blocks Generation
app.post('/api/subtitles', async (req, res) => {
  try {
    const { script, duration = '60s' } = req.body;
    const ai = getGenAIClient();

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Convierte las líneas habladas de este guion en subtítulos dinámicos formato SRT de ritmo rápido para retención en redes sociales (máximo 5-7 palabras por bloque, sincronizados a lo largo de ${duration}). Ignora los encabezados [Escena X: ...]. Devuelve únicamente el contenido SRT limpio:\n\n${script}`,
    });

    res.json({ subtitles: response.text || '' });
  } catch (error: any) {
    console.error('Error generating subtitles:', error);
    res.status(500).json({ error: error.message || 'Error al generar subtítulos.' });
  }
});

// 10. Multi-Network Social Copy & SEO Package
app.post('/api/marketing', async (req, res) => {
  try {
    const { script, genre, channelName, trendTitle } = req.body;
    const ai = getGenAIClient();

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Actúa como un estratega de crecimiento multi-canal para "${channelName || 'Canal Viral'}".
Basado en el siguiente guion (${genre})${trendTitle ? ` y la tendencia "${trendTitle}"` : ''}, genera un paquete completo de SEO, miniatura y publicaciones adaptadas para las 6 redes sociales principales.

Guion:
${script}

Devuelve un JSON con esta estructura exacta:
{
  "title": "Título maestro de alto CTR",
  "description": "Descripción SEO general optimizada para búsquedas",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"],
  "thumbnailText": "TEXTO CORTO (3-4 PALABRAS IMPACTO)",
  "platformCopy": {
    "tiktok": {
      "title": "Hook corto para TikTok",
      "caption": "Copy conversacional con pregunta para comentarios",
      "hashtags": ["tiktok", "fyp", "viral", "tendencia"],
      "cta": "Síguenos para la parte 2"
    },
    "youtube_shorts": {
      "title": "Título SEO para Shorts (< 60 caracteres)",
      "caption": "Descripción con palabras clave para el feed de Shorts",
      "hashtags": ["shorts", "youtubeshorts", "viral"],
      "cta": "Suscríbete al canal"
    },
    "instagram_reels": {
      "title": "Portada de Reel",
      "caption": "Copy estético con viñetas de valor y llamado a guardar el post",
      "hashtags": ["reels", "instagramreels", "creadores"],
      "cta": "Guarda este Reel y compártelo"
    },
    "linkedin": {
      "title": "Titular ejecutivo para LinkedIn",
      "caption": "Reflexión profesional de liderazgo y análisis de impacto en la industria (3 párrafos cortos)",
      "hashtags": ["innovacion", "tendencias", "negocios"],
      "cta": "¿Qué opinas sobre este cambio? Te leo en los comentarios."
    },
    "facebook_reels": {
      "title": "Título atractivo para Facebook Reels",
      "caption": "Texto cercano que invite a compartir con amigos y comunidad",
      "hashtags": ["facebookreels", "viral", "curiosidades"],
      "cta": "Comparte este video en tu muro"
    },
    "youtube_long": {
      "title": "Título SEO de alto CTR para YouTube 16:9",
      "caption": "Descripción completa con marcas de tiempo (00:00 Intro, 00:15 Desarrollo, 00:45 Conclusión) y palabras clave",
      "hashtags": ["youtube", "documental", "analisis"],
      "cta": "Activa la campanita y deja tu like"
    }
  }
}`,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (error: any) {
    console.error('Error generating multi-platform marketing:', error);
    res.status(500).json({ error: error.message || 'Error al generar el paquete de marketing.' });
  }
});

// 11. Webhook Dispatcher for Multi-Channel Social Publishing
app.post('/api/channels/publish-webhook', async (req, res) => {
  try {
    const { webhookUrl, payload } = req.body;
    if (!webhookUrl || !webhookUrl.startsWith('http')) {
      return res.status(400).json({
        error: 'Configura una URL de Webhook válida (https://...) en los ajustes del canal para despachar vía API.',
      });
    }

    const webhookRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ClipAI-MultiChannel-Publisher/1.0',
      },
      body: JSON.stringify({
        event: 'video.publish',
        timestamp: new Date().toISOString(),
        ...payload,
      }),
    });

    const responseText = await webhookRes.text().catch(() => '');
    res.json({
      success: webhookRes.ok,
      status: webhookRes.status,
      responsePreview: responseText.slice(0, 300),
    });
  } catch (error: any) {
    console.error('Webhook dispatch error:', error);
    res.status(500).json({
      error: `Error al conectar con el Webhook: ${error.message || 'Verifica la URL del endpoint.'}`,
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ClipAI Studio Server running on http://localhost:${PORT}`);
  });
}

startServer();
