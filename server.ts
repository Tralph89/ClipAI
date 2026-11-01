import 'dotenv/config';
import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import {
  AIProviderId,
  AppSettings,
  Project,
  ScheduledPost,
  SocialChannel,
  TrendItem,
  VideoMetadata,
} from './src/types.ts';
import {
  ensureStorageDirectories,
  loadDb,
  MEDIA_DIR,
  MediaSubfolder,
  normalizeProjectMedia,
  saveBufferToMedia,
  saveDataUrlToMedia,
  saveDb,
} from './server/storage/localDb.ts';
import { getSystemStatus, resolveLocalToolPath } from './server/services/systemTools.ts';
import {
  extractJsonPayload,
  generateAIJson,
  generateAIText,
} from './server/services/aiProvider.ts';
import { discoverMultiSourceTrends } from './server/services/trendCollector.ts';
import { generateStructuredViralScript } from './server/services/scriptGenerator.ts';
import {
  buildSyncedSrtFromScenes,
  getOrCreateVoiceSample,
  rebuildMasterFromSceneAudios,
  synthesizeScenesVoiceover,
  synthesizeSingleVoiceClip,
} from './server/services/voiceEngine.ts';
import {
  generateStudioMusicTrackOnServer,
  mixVoiceAndMusicWithDucking,
} from './server/services/audioMixer.ts';
import {
  acquireStockVideoForScene,
  downloadAndNormalizeStockVideo,
  fetchPixabayStockImage,
  generateAndCacheSceneImage,
  generateSceneLocalVideo,
  generateVisualsForAllScenes,
  searchFreeStockVideos,
  VisualInitialSource,
} from './server/services/visualEngine.ts';
import {
  getLocalVideoClusterStatus,
  startLocalVideoEngine,
  stopLocalVideoEngine,
} from './server/services/localVideoServiceManager.ts';
import {
  compileMasterVideo,
  getRenderJobStatus,
} from './server/services/masterVideoCompiler.ts';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

ensureStorageDirectories();

  app.use(express.json({ limit: '80mb' }));
  app.use('/media', express.static(MEDIA_DIR));

  function getOptionalGeminiClient(settings: AppSettings): GoogleGenAI | null {
    const apiKey =
      settings.geminiApiKey?.trim() ||
      (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
        ? process.env.GEMINI_API_KEY
        : '') ||
      process.env.API_KEY;

    if (!apiKey) return null;
    return new GoogleGenAI({ apiKey });
  }

  // ============================================================================
  // SECCIÓN 1: BOOTSTRAP, ESTADO DEL SISTEMA Y PERSISTENCIA EN DISCO
  // ============================================================================

  app.get('/api/bootstrap', async (_req, res) => {
    try {
      const db = loadDb();
      const systemStatus = await getSystemStatus();

      // Auto-align selected Ollama model if current default is not present locally
      if (
        systemStatus.ollamaReachable &&
        systemStatus.ollamaModels.length > 0 &&
        !systemStatus.ollamaModels.some((m) => m.name === db.settings.ollamaModel)
      ) {
        const preferred = ['gemma4:12b', 'qwen3.8:latest', 'qwen3.5:4b', 'gemma4:26b'];
        const match =
          preferred.find((p) => systemStatus.ollamaModels.some((m) => m.name === p)) ||
          systemStatus.ollamaModels[0].name;
        db.settings.ollamaModel = match;
        saveDb(db);
      }

      res.json({
        settings: db.settings,
        channels: db.channels,
        projects: db.projects,
        scheduledPosts: db.scheduledPosts,
        trends: db.trends,
        systemStatus,
      });
    } catch (error: any) {
      console.error('[bootstrap] Error:', error);
      res.status(500).json({ error: error.message || 'Error al inicializar el estado local.' });
    }
  });

  app.get('/api/system/status', async (_req, res) => {
    try {
      const status = await getSystemStatus();
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error al consultar herramientas locales.' });
    }
  });

  app.post('/api/system/test-ai', async (req, res) => {
    try {
      const { provider, model } = req.body as { provider?: AIProviderId; model?: string };
      const result = await generateAIText({
        prompt:
          'Escribe en español un único gancho viral (máximo 18 palabras) sobre cómo automatizar videos con IA local.',
        systemInstruction: 'Responde únicamente con la frase del gancho, sin comillas adicionales ni explicaciones.',
        temperature: 0.6,
        overrideProvider: provider,
        overrideModel: model,
      });

      res.json({
        ok: true,
        providerUsed: result.providerUsed,
        modelUsed: result.modelUsed,
        latencyMs: result.latencyMs,
        sampleOutput: result.text,
      });
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: error.message || 'No se pudo conectar con el motor de IA seleccionado.',
      });
    }
  });

  app.put('/api/settings', (req, res) => {
    try {
      const db = loadDb();
      const incoming = req.body as Partial<AppSettings>;
      db.settings = {
        ...db.settings,
        ...incoming,
      };
      saveDb(db);
      res.json({ settings: db.settings });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'No se pudieron guardar los ajustes.' });
    }
  });

  app.put('/api/channels', (req, res) => {
    try {
      const db = loadDb();
      const { channels } = req.body as { channels: SocialChannel[] };
      if (Array.isArray(channels) && channels.length > 0) {
        db.channels = channels;
        saveDb(db);
      }
      res.json({ channels: db.channels });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error al guardar canales.' });
    }
  });

  app.post('/api/projects', (req, res) => {
    try {
      const db = loadDb();
      const incomingProject = req.body.project as Project;
      if (!incomingProject || !incomingProject.id) {
        return res.status(400).json({ error: 'Proyecto inválido.' });
      }

      const cleanProject = normalizeProjectMedia(incomingProject);
      const idx = db.projects.findIndex((p) => p.id === cleanProject.id);
      if (idx >= 0) {
        db.projects[idx] = cleanProject;
      } else {
        db.projects.unshift(cleanProject);
      }
      saveDb(db);
      res.json({ project: cleanProject });
    } catch (error: any) {
      console.error('[projects] Save error:', error);
      res.status(500).json({ error: error.message || 'Error al guardar el proyecto en disco.' });
    }
  });

  app.delete('/api/projects/:id', (req, res) => {
    try {
      const db = loadDb();
      db.projects = db.projects.filter((p) => p.id !== req.params.id);
      saveDb(db);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error al eliminar proyecto.' });
    }
  });

  app.put('/api/scheduled-posts', (req, res) => {
    try {
      const db = loadDb();
      const { scheduledPosts } = req.body as { scheduledPosts: ScheduledPost[] };
      if (Array.isArray(scheduledPosts)) {
        db.scheduledPosts = scheduledPosts;
        saveDb(db);
      }
      res.json({ scheduledPosts: db.scheduledPosts });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error al guardar cola de publicaciones.' });
    }
  });

  app.put('/api/trends', (req, res) => {
    try {
      const db = loadDb();
      const { trends } = req.body as { trends: TrendItem[] };
      if (Array.isArray(trends)) {
        db.trends = trends;
        saveDb(db);
      }
      res.json({ trends: db.trends });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error al guardar tendencias.' });
    }
  });

  app.post('/api/media/upload', (req, res) => {
    try {
      const { dataUrl, subfolder = 'videos', prefix = 'clipai' } = req.body as {
        dataUrl: string;
        subfolder?: MediaSubfolder;
        prefix?: string;
      };
      if (!dataUrl || !dataUrl.startsWith('data:')) {
        return res.status(400).json({ error: 'Se requiere un dataUrl válido.' });
      }
      const mediaUrl = saveDataUrlToMedia(dataUrl, subfolder, prefix);
      res.json({ mediaUrl });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'No se pudo almacenar el archivo multimedia.' });
    }
  });

  // ============================================================================
  // ENDPOINTS DE PRODUCCIÓN CON MOTOR IA MULTI-PROVEEDOR (OLLAMA PRINCIPAL)
  // ============================================================================

  // 1. Live Multi-Source Free Trend Discovery ($0: Google Trends RSS + Google News RSS + YouTube yt-dlp + Reddit + Hacker News + Ollama)
  app.post('/api/trends/search', async (req, res) => {
    try {
      const { query, niche, region = 'Global / Español', platforms = [], mode = 'niche' } = req.body;
      const db = loadDb();

      const result = await discoverMultiSourceTrends({
        query,
        niche,
        region,
        platforms,
        mode,
      });

      if (result.trends.length > 0) {
        db.trends = result.trends;
        saveDb(db);
      }

      res.json(result);
    } catch (error: any) {
      console.error('Error searching trends:', error);
      res.status(500).json({ error: error.message || 'Error al escanear tendencias en vivo.' });
    }
  });

  // 2. Structured Viral Video Script & Scenes (JSON Output + Ollama Primary)
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

      const structured = await generateStructuredViralScript({
        prompt,
        genre,
        subgenre,
        duration,
        language,
        aspectRatio,
        channelTone,
        trendContext,
      });

      res.json(structured);
    } catch (error: any) {
      console.error('Error generating structured script:', error);
      res.status(500).json({ error: error.message || 'Error al generar el guion estructurado.' });
    }
  });

  // 3a. Single Clip Speech Generation (Piper Neural HD ONNX Primary + Edge-TTS / SAPI Fallback)
  app.post('/api/tts', async (req, res) => {
    try {
      const { text, voice = 'es-MX-DaliaNeural', language = 'es', speed = 1.08, filenamePrefix = 'tts' } = req.body;
      const clip = await synthesizeSingleVoiceClip({
        text,
        voice,
        language,
        speed,
        filenamePrefix,
      });

      res.json({
        audioDataUrl: clip.audioUrl,
        mimeType: clip.mimeType,
        durationSec: clip.durationSec,
        wordTimings: clip.wordTimings,
        engine: clip.engine,
        voiceUsed: clip.voiceUsed,
      });
    } catch (error: any) {
      console.error('Error generating TTS:', error);
      res.status(500).json({ error: error.message || 'No se pudo generar la narración de voz.' });
    }
  });

  // 3b. Per-Scene Neural Voiceover + Exact FFprobe Duration + Word Timings + Master Track + Synced SRT
  app.post('/api/tts/scenes', async (req, res) => {
    try {
      const { scenes, voice = 'Kore', language = 'es', speed = 1.08 } = req.body;
      const result = await synthesizeScenesVoiceover({
        scenes,
        voice,
        language,
        speed,
      });
      res.json(result);
    } catch (error: any) {
      console.error('Error generating per-scene TTS:', error);
      res.status(500).json({ error: error.message || 'Error al sintetizar voces por escena.' });
    }
  });

  // 3c. Rebuild Master Voice Track & Synced SRT After Single-Scene Voice Edit
  app.post('/api/tts/rebuild-master', async (req, res) => {
    try {
      const { scenes } = req.body;
      const result = await rebuildMasterFromSceneAudios(scenes || []);
      res.json(result);
    } catch (error: any) {
      console.error('Error rebuilding master voice track:', error);
      res.status(500).json({ error: error.message || 'Error al reconstruir pista maestra de voz.' });
    }
  });

  // 3d. Instant Cached Voice Preview Sample (Played Automatically When Selecting Any Voice)
  app.post('/api/tts/preview', async (req, res) => {
    try {
      const { voice = 'es-MX-DaliaNeural', customText } = req.body || {};
      const result = await getOrCreateVoiceSample({ voice, customText });
      res.json(result);
    } catch (error: any) {
      console.error('Error generating voice preview sample:', error);
      res.status(500).json({ error: error.message || 'No se pudo reproducir la muestra de voz.' });
    }
  });


  // =========================================================================
  // 3b. AI Visual Bible & ComfyUI Prompt Director (Guarantees Style & Scene Coherence)
  // =========================================================================
  app.post('/api/visuals/craft-prompts', async (req, res) => {
    try {
      const {
        scenes = [],
        styleProfile,
        architecture = 'flux1',
        aspectRatio = '9:16',
        existingVisualBible,
      } = req.body;

      const db = loadDb();
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || db.settings.geminiApiKey;
      if (!apiKey) {
        return res.status(400).json({ error: 'Configura tu clave de Gemini API en Ajustes para generar prompts de ComfyUI.' });
      }

      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });

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
    "characterAnchor": "Descripción física exacta en inglés del protagonista o sujeto recurrente para mantener identidad en todas las escenas",
    "environmentAnchor": "Descripción en inglés de la atmósfera, época y arquitectura común",
    "colorPalette": "Paleta cromática dominante en inglés",
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

      const modelName = db.settings.geminiModel || 'gemini-2.5-flash';
      const response = await ai.models.generateContent({
        model: modelName,
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

  // =========================================================================
  // 3c. ComfyUI Server-Side Proxy (For Tunnel URLs or Local Backend Execution)
  // =========================================================================
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

  // 4a. Scene Initial Image Generation (Supports Local RTX 5090, Gemini Image API, or Pixabay Stock HD)
  app.post('/api/visuals/scene-initial-image', async (req, res) => {
    try {
      const {
        sceneIndex,
        prompt,
        style = 'cinematic',
        aspectRatio = '9:16',
        engineSource = 'local',
        stockKeywords,
        seed,
      } = req.body || {};

      const result = await generateAndCacheSceneImage({
        prompt: prompt || 'Cinematic scene',
        style,
        aspectRatio,
        engineSource: engineSource as VisualInitialSource,
        stockKeywords,
        seed,
      });

      res.json({
        sceneIndex,
        imageUrl: result.imageUrl,
        provider: result.provider,
        seedUsed: result.seedUsed,
      });
    } catch (error: any) {
      console.error('Error generating scene initial image:', error);
      res.status(500).json({ error: error.message || 'No se pudo generar la imagen inicial.' });
    }
  });

  // 4a-batch. Batch Initial Images Generation for All Scenes in Project
  app.post('/api/visuals/batch-initial-images', async (req, res) => {
    try {
      const {
        scenes,
        style = 'cinematic',
        aspectRatio = '9:16',
        engineSource = 'local',
        visualSeed,
      } = req.body || {};

      if (!Array.isArray(scenes) || scenes.length === 0) {
        return res.status(400).json({ error: 'Se requiere una lista de escenas válida.' });
      }

      const baseSeed =
        typeof visualSeed === 'number' && visualSeed > 0
          ? visualSeed
          : Math.floor(100_000 + Math.random() * 899_999);

      const updatedScenes: Scene[] = [];

      for (let i = 0; i < scenes.length; i++) {
        const sc = scenes[i];
        const promptToUse = sc.imagePrompt || `${sc.title}. ${(sc.dialogue || '').slice(0, 80)}`;
        const imgRes = await generateAndCacheSceneImage({
          prompt: promptToUse,
          style,
          aspectRatio,
          engineSource: engineSource as VisualInitialSource,
          stockKeywords: sc.stockKeywords,
          seed: baseSeed + i * 19,
        });

        updatedScenes.push({
          ...sc,
          imageUrl: imgRes.imageUrl,
          visualProvider: imgRes.provider,
          visualSource: 'ai_image',
        });
      }

      res.json({ scenes: updatedScenes, visualSeed: baseSeed });
    } catch (error: any) {
      console.error('Error in batch initial images generation:', error);
      res.status(500).json({
        error: error.message || 'Error al generar imágenes iniciales en lote.',
      });
    }
  });

  // Legacy single image endpoint (for thumbnails and general calls)
  app.post('/api/image', async (req, res) => {
    try {
      const {
        prompt,
        style = 'cinematic',
        aspectRatio = '9:16',
        isThumbnail = false,
        engineSource = 'local',
        seed,
        stockKeywords,
      } = req.body || {};

      const result = await generateAndCacheSceneImage({
        prompt: prompt || 'Cinematic dramatic scene',
        style,
        aspectRatio,
        isThumbnail,
        engineSource: engineSource as VisualInitialSource,
        seed,
        stockKeywords,
      });

      res.json(result);
    } catch (error: any) {
      console.error('Error generating scene image:', error);
      res.status(500).json({ error: error.message || 'No se pudo generar la imagen de la escena.' });
    }
  });

  // 4b. Local Video Cluster Status (RTX 5090 VRAM + ComfyUI Wan 2.1 + LTX 2.3)
  app.get('/api/visuals/local-engines/status', async (_req, res) => {
    try {
      const clusterStatus = await getLocalVideoClusterStatus();
      res.json(clusterStatus);
    } catch (error: any) {
      console.error('Error querying local video cluster status:', error);
      res.status(500).json({
        error: error.message || 'Error al consultar estado de motores de video local.',
      });
    }
  });

  // 4c. Toggle Local Video Engine (Start or Stop ComfyUI or LTX 2.3 on Demand)
  app.post('/api/visuals/local-engines/toggle', async (req, res) => {
    try {
      const { engine, action } = req.body as {
        engine: 'wan_comfyui' | 'ltx_local';
        action: 'start' | 'stop';
      };
      if (!engine || !action) {
        return res.status(400).json({ error: 'Se requiere engine y action (start | stop).' });
      }

      const clusterStatus =
        action === 'start'
          ? await startLocalVideoEngine(engine, false)
          : await stopLocalVideoEngine(engine);

      res.json(clusterStatus);
    } catch (error: any) {
      console.error('Error toggling local video engine:', error);
      res.status(500).json({
        error: error.message || 'No se pudo cambiar el estado del motor de video.',
      });
    }
  });

  // 4d. Generate Single Scene Local Video (LTX 2.3 Local or Wan 2.1 ComfyUI)
  // Sincronizado exactamente a la duración del audio de la escena (targetDurationSec)
  app.post('/api/visuals/scene-local-video', async (req, res) => {
    try {
      const {
        scene,
        aspectRatio = '9:16',
        engine,
        style,
        seed,
        targetDurationSec,
      } = req.body || {};

      if (!scene) {
        return res.status(400).json({ error: 'Se requiere el objeto scene.' });
      }

      const result = await generateSceneLocalVideo({
        scene,
        aspectRatio,
        engine,
        style,
        seed,
        targetDurationSec:
          typeof targetDurationSec === 'number' && targetDurationSec > 0
            ? targetDurationSec
            : scene.durationSec,
      });
      res.json(result);
    } catch (error: any) {
      console.error('Error generating local scene video:', error);
      res.status(500).json({
        error: error.message || 'Error al generar video IA local para la escena.',
      });
    }
  });

  // 4b. Search Free HD Stock B-Roll Videos (Pexels + Pixabay + Zero-Key Wikimedia/NASA)
  app.post('/api/visuals/stock-search', async (req, res) => {
    try {
      const { query = 'technology', aspectRatio = '9:16' } = req.body || {};
      const result = await searchFreeStockVideos({ query, aspectRatio });
      res.json(result);
    } catch (error: any) {
      console.error('Error searching stock videos:', error);
      res.status(500).json({ error: error.message || 'Error al buscar clips de video stock.' });
    }
  });

  // 4c. Download & Normalize Specific Stock Video Clip to Local MP4 + Poster JPG
  app.post('/api/visuals/stock-download', async (req, res) => {
    try {
      const { downloadUrl, provider = 'stock', aspectRatio = '9:16', targetDurationSec = 6 } = req.body || {};
      if (!downloadUrl) {
        return res.status(400).json({ error: 'Se requiere downloadUrl del clip.' });
      }
      const result = await downloadAndNormalizeStockVideo({
        downloadUrl,
        provider,
        aspectRatio,
        targetDurationSec,
      });
      res.json(result);
    } catch (error: any) {
      console.error('Error downloading stock video:', error);
      res.status(500).json({ error: error.message || 'No se pudo descargar y normalizar el clip B-Roll.' });
    }
  });

  // 4d. Auto-Acquire Best Matching Stock B-Roll Video for a Single Scene
  app.post('/api/visuals/scene-broll', async (req, res) => {
    try {
      const { scene, aspectRatio = '9:16' } = req.body || {};
      if (!scene) {
        return res.status(400).json({ error: 'Se requiere el objeto scene.' });
      }
      const stock = await acquireStockVideoForScene({ scene, aspectRatio });
      if (!stock) {
        return res.status(404).json({ error: 'No se encontró clip B-Roll disponible para esta escena.' });
      }
      res.json(stock);
    } catch (error: any) {
      console.error('Error acquiring scene B-Roll:', error);
      res.status(500).json({ error: error.message || 'Error al obtener video B-Roll para la escena.' });
    }
  });

  // 4e. Batch Hybrid Visual Orchestrator (AI Images / Stock B-Roll / Smart Hybrid)
  app.post('/api/visuals/generate-batch', async (req, res) => {
    try {
      const {
        scenes = [],
        style = 'cinematic',
        aspectRatio = '9:16',
        visualMode = 'hybrid',
        visualSeed,
      } = req.body || {};

      const result = await generateVisualsForAllScenes({
        scenes,
        style,
        aspectRatio,
        visualMode,
        visualSeed,
      });
      res.json(result);
    } catch (error: any) {
      console.error('Error generating batch visuals:', error);
      res.status(500).json({ error: error.message || 'Error en generación visual por lotes.' });
    }
  });

  // 5a. Studio Royalty-Free Stereo Music Generation ($0, Local MP3 on Disk)
  app.post('/api/music', async (req, res) => {
    try {
      const { presetId = 'cyber-pulse', durationSec = 36 } = req.body || {};
      const track = await generateStudioMusicTrackOnServer({ presetId, durationSec });
      res.json({
        audioDataUrl: track.musicAudioUrl,
        durationSec: track.durationSec,
        presetId: track.presetId,
      });
    } catch (error: any) {
      console.error('Error generating studio music:', error);
      res.status(500).json({ error: error.message || 'Error al generar pista musical.' });
    }
  });

  // 5b. Real FFmpeg Sidechain Audio Ducking Mix (Voice + Ducked Background Music)
  app.post('/api/audio/mix', async (req, res) => {
    try {
      const {
        voiceAudioUrl,
        musicAudioUrl,
        musicVolume = 0.22,
        duckingEnabled = true,
      } = req.body || {};
      const mix = await mixVoiceAndMusicWithDucking({
        voiceAudioUrl,
        musicAudioUrl,
        musicVolume,
        duckingEnabled,
      });
      res.json(mix);
    } catch (error: any) {
      console.error('Error mixing audio with ducking:', error);
      res.status(500).json({ error: error.message || 'Error al mezclar voz y música con ducking.' });
    }
  });

  app.post('/api/video/animate', async (_req, res) => {
    res.status(400).json({
      error:
        'Se aplicará animación fluida Ken Burns (en Sección 5 se renderizará a 60fps en MP4 con FFmpeg local).',
    });
  });

  // 6. Frame-Accurate Subtitles (.SRT) from Measured Scene Timings (or AI Fallback)
  app.post('/api/subtitles', async (req, res) => {
    try {
      const { script, duration = '60s', scenes } = req.body;
      if (Array.isArray(scenes) && scenes.length > 0) {
        const srt = buildSyncedSrtFromScenes(scenes);
        if (srt.trim()) {
          return res.json({ subtitles: srt, syncedToAudio: true });
        }
      }

      const result = await generateAIText({
        prompt: `Convierte las líneas habladas de este guion en un archivo de subtítulos formato SRT dinámico para redes sociales (bloques cortos de 4 a 6 palabras distribuidos a lo largo de ${duration}). Ignora los encabezados [Escena X: ...]. Devuelve ÚNICAMENTE el contenido SRT limpio:\n\n${script}`,
        temperature: 0.4,
      });
      res.json({ subtitles: result.text, syncedToAudio: false });
    } catch (error: any) {
      console.error('Error generating subtitles:', error);
      res.status(500).json({ error: error.message || 'Error al generar subtítulos.' });
    }
  });

  // ============================================================================
  // SECCIÓN 5: RENDERIZADOR MASTER EN SERVIDOR CON FFMPEG (MP4 1080P + .ASS)
  // ============================================================================

  app.post('/api/render/master-video', async (req, res) => {
    try {
      const {
        scenes,
        aspectRatio = '9:16',
        voiceAudioUrl,
        musicAudioUrl,
        mixedAudioUrl,
        subtitleStyle = 'hormozi',
        subtitlesEnabled = true,
        channelWatermark,
      } = req.body || {};

      if (!Array.isArray(scenes) || scenes.length === 0) {
        return res.status(400).json({
          error: 'Debes proporcionar al menos una escena para compilar el video master.',
        });
      }

      const job = await compileMasterVideo({
        scenes,
        aspectRatio,
        voiceAudioUrl,
        musicAudioUrl,
        mixedAudioUrl,
        subtitleStyle,
        subtitlesEnabled,
        channelWatermark,
      });

      res.json(job);
    } catch (error: any) {
      console.error('Error in master video compile:', error);
      res.status(500).json({
        error: error.message || 'Error al renderizar el video master en el servidor.',
      });
    }
  });

  app.get('/api/render/status/:jobId', (req, res) => {
    const job = getRenderJobStatus(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Trabajo de renderizado no encontrado.' });
    }
    res.json(job);
  });

  // 7. Multi-Network Social Copy & SEO Package (Focused on YouTube, TikTok & Facebook)
  app.post('/api/marketing', async (req, res) => {
    try {
      const { script, genre, channelName, trendTitle } = req.body;

    const fallbackMetadata: VideoMetadata = {
      title: trendTitle || 'Nuevo Video Viral',
      description: 'Descubre las claves más importantes en menos de un minuto.',
      hashtags: ['viral', 'shorts', 'tiktok', 'reels'],
      thumbnailText: 'LO CAMBIA TODO',
    };

    const { data } = await generateAIJson<VideoMetadata>(
      {
        systemInstruction:
          'Eres un estratega experto en crecimiento orgánico en YouTube, TikTok y Facebook. Responde estrictamente en JSON válido.',
        prompt: `Actúa como estratega de crecimiento para el canal "${channelName || 'Canal Viral'}".
Basado en este guion(${ genre })${ trendTitle? ` sobre "${trendTitle}"` : ''}, genera un paquete completo de SEO, texto de miniatura y copy adaptado especialmente para YouTube Shorts, TikTok, Facebook Reels y YouTube Largo(además de Instagram y LinkedIn).

      Guion:
${ script }

Devuelve un JSON con esta estructura exacta:
    {
      "title": "Título maestro de alto CTR",
              "description": "Descripción SEO optimizada",
                "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4"],
                  "thumbnailText": "TEXTO CORTO (3-4 PALABRAS)",
                    "platformCopy": {
        "youtube_shorts": {
              "title": "Título SEO para YouTube Shorts (< 60 caracteres)",
                "caption": "Descripción con palabras clave para Shorts",
                  "hashtags": ["shorts", "youtubeshorts", "viral"],
          "cta": "Suscríbete para más videos diarios"
        },
          "tiktok": {
            "title": "Gancho rápido para TikTok",
              "caption": "Copy conversacional con pregunta para detonar comentarios",
                "hashtags": ["tiktok", "parati", "fyp", "viral"],
                  "cta": "Síguenos para la parte 2"
          },
          "facebook_reels": {
                  "title": "Título magnético para Facebook Reels y Página",
                    "caption": "Texto cercano que invite a compartir con amigos y debatir",
                      "hashtags": ["facebookreels", "reels", "curiosidades", "viral"],
                        "cta": "Comparte este video en tu muro"
          },
          "youtube_long": {
            "title": "Título SEO de alto CTR para YouTube 16:9",
            "caption": "Descripción completa con capítulos (00:00 Intro, 00:20 Desarrollo, 00:50 Conclusión)",
              "hashtags": ["youtube", "analisis", "tendencias"],
                "cta": "Activa la campanita y deja tu comentario"
          },
          "instagram_reels": {
            "title": "Portada de Reel",
              "caption": "Copy con puntos clave y llamado a guardar",
                "hashtags": ["reels", "instagramreels"],
                  "cta": "Guarda este Reel"
          },
          "linkedin": {
            "title": "Titular profesional",
              "caption": "Reflexión ejecutiva breve",
                "hashtags": ["innovacion", "negocios"],
                  "cta": "¿Qué opinas?"
          }
        }
      } `,
        temperature: 0.7,
      },
      fallbackMetadata
    );

    res.json(data);
  } catch (error: any) {
    console.error('Error generating marketing:', error);
    res.status(500).json({ error: error.message || 'Error al generar el paquete de marketing.' });
  }
});

// 8. Webhook Dispatcher
app.post('/api/channels/publish-webhook', async (req, res) => {
  try {
    const { webhookUrl, payload } = req.body;
    if (!webhookUrl || !webhookUrl.startsWith('http')) {
      return res.status(400).json({
        error: 'Configura una URL de Webhook válida (https://...) en los ajustes del canal.',
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
    res.status(500).json({
      error: `Error al conectar con el Webhook: ${ error.message || 'Verifica la URL.' } `,
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

  const tryListen = (portToTry: number) => {
    const httpServer = app.listen(portToTry, () => {
      console.log(`ClipAI Studio Server running on http://localhost:${portToTry}`);
    });
    httpServer.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && portToTry < PORT + 10) {
        console.warn(`Puerto ${portToTry} ocupado, probando puerto ${portToTry + 1}...`);
        tryListen(portToTry + 1);
      } else {
        console.error('Server listen error:', err);
        process.exit(1);
      }
    });
  };

  tryListen(PORT);
}

startServer();
