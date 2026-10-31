import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

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
2. Cada escena DEBE comenzar con el encabezado exacto: [Escena X: Descripción visual detallada en inglés o español para el generador de imagen, incluyendo iluminación, sujeto y encuadre]
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

// 3. Speech Generation (TTS) using gemini-3.8-flash-lite-tts via Interactions API
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

    // Check inside steps if output_audio helper wasn't populated
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

// 4. Scene Image Generation (Tries gemini-3.1-flash-lite-image first, with seamless high-res fallback)
app.post('/api/image', async (req, res) => {
  const { prompt, style, aspectRatio = '9:16', isThumbnail = false } = req.body;

  const styleDescriptions: Record<string, string> = {
    anime: 'anime art style, Makoto Shinkai inspired, vibrant colors, cel shaded, studio ufotable quality',
    biblia: 'epic biblical historical oil painting, dramatic chiaroscuro lighting, ancient middle east robes and architecture, masterpiece',
    cartoon: 'modern 3D Pixar Disney style animation, expressive characters, soft cinematic lighting, vibrant colors',
    cinematic: 'Hollywood blockbuster cinematography, ARRI Alexa 65, anamorphic lens, dramatic volumetric lighting, shallow depth of field',
    comic: 'vintage American comic book art, bold ink outlines, halftone dots, dynamic action framing, vibrant pop colors',
    fantasy: 'epic high fantasy digital painting, magical glowing atmosphere, intricate armor and mythical landscapes, Unreal Engine 5',
    horror: 'dark atmospheric gothic horror, eerie fog, unsettling shadows, cinematic suspense lighting, high contrast',
    photorealistic: 'ultra-photorealistic 8k photography, natural skin texture, crisp details, National Geographic & Sony A7RV quality',
    scifi: 'futuristic cyberpunk sci-fi concept art, neon holographic lighting, sleek spacecraft and megastructures, Blade Runner aesthetic',
    pixelart: 'detailed 16-bit retro pixel art scene, vibrant sprite work, nostalgic arcade aesthetic, crisp pixel grid',
    lego: 'macro photography of a world made entirely of shiny plastic LEGO bricks and minifigures, tilt-shift depth of field',
    minecraft: 'voxel block world aesthetic inspired by Minecraft with RTX shaders, volumetric sunbeams, cubic terrain',
  };

  const stylePrompt = styleDescriptions[style] || styleDescriptions.cinematic;
  const fullPrompt = isThumbnail
    ? `YouTube / TikTok viral video thumbnail, eye-catching composition, extreme contrast, expressive focal subject: ${prompt}. Visual style: ${stylePrompt}. No small illegible text.`
    : `${prompt}. Visual style: ${stylePrompt}. High resolution, dramatic composition.`;

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

  // Reliable high-definition fallback when paid image model key is not enabled
  const width = aspectRatio === '16:9' ? 1280 : aspectRatio === '1:1' ? 1024 : 720;
  const height = aspectRatio === '16:9' ? 720 : aspectRatio === '1:1' ? 1024 : 1280;
  const seed = Math.floor(Math.random() * 1000000);
  const encodedPrompt = encodeURIComponent(fullPrompt.slice(0, 450));
  const fallbackUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true`;

  return res.json({
    imageUrl: fallbackUrl,
    provider: 'pollinations',
  });
});

// 5. Music Generation (Lyria 3 Clip Preview)
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

// 6. Scene Video Generation (Veo / Omni Flash via Interactions API)
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

// 7. Subtitles SRT / Timed Blocks Generation
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

// 8. Multi-Network Social Copy & SEO Package
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

// 9. Webhook Dispatcher for Multi-Channel Social Publishing
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
