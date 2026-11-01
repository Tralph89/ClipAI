import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { DATA_DIR } from '../storage/localDb.ts';
import { resolveLocalToolPath } from './systemTools.ts';
import { generateAIText, extractJsonPayload } from './aiProvider.ts';

const execFileAsync = promisify(execFile);

export interface VideoTranscriptionResult {
  url: string;
  title: string;
  uploader: string;
  durationSec: number;
  thumbnailUrl: string;
  transcript: string;
  summary: string;
  suggestedHook: string;
  angle: string;
  mysteryElements: string[];
  recommendedFormats: ('9:16' | '16:9')[];
}

/**
 * Cleans raw VTT/SRT subtitle text into clean, continuous prose:
 * - Strips WEBVTT headers and metadata
 * - Strips timestamps (00:00:01.000 --> 00:00:03.000)
 * - Strips inline cue/formatting tags (<c>, <00:00:01>, &nbsp;)
 * - Deduplicates consecutive rolling caption lines
 */
export function cleanSubtitleText(rawSubContent: string): string {
  const lines = rawSubContent.split(/\r?\n/);
  const textLines: string[] = [];
  let lastLine = '';

  for (let rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;
    if (
      line.startsWith('WEBVTT') ||
      line.startsWith('Kind:') ||
      line.startsWith('Language:') ||
      line.startsWith('NOTE') ||
      line.startsWith('STYLE')
    ) {
      continue;
    }
    if (line.includes('-->')) continue;
    if (/^\d+$/.test(line)) continue; // Subtitle index number

    // Strip inline HTML/VTT tags like <00:00:01.200><c> etc.
    const clean = line
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();

    if (!clean) continue;

    // Deduplicate rolling captions
    if (clean.toLowerCase() === lastLine.toLowerCase()) continue;
    lastLine = clean;
    textLines.push(clean);
  }

  return textLines
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Transcribes any YouTube or TikTok video using yt-dlp (instant subtitles)
 * with local Whisper CLI fallback, then enriches it with horror analysis for Archivo Clasificado.
 */
export async function transcribeVideoUrl(rawUrl: string): Promise<VideoTranscriptionResult> {
  const url = rawUrl.trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    throw new Error('Por favor ingresa un enlace válido que comience con https://');
  }

  const ytdlpPath = resolveLocalToolPath('yt-dlp');
  if (!ytdlpPath) {
    throw new Error('yt-dlp no está instalado o no se encuentra en el sistema.');
  }

  // 1. Fetch metadata with yt-dlp
  let title = 'Historia de Terror / Caso Inquietante';
  let uploader = 'Desconocido';
  let durationSec = 180;
  let thumbnailUrl = 'https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&w=600&q=80';

  try {
    const { stdout: metaJson } = await execFileAsync(
      ytdlpPath,
      ['--dump-json', '--skip-download', '--no-warnings', url],
      { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }
    );
    const meta = JSON.parse(metaJson);
    if (meta.title) title = meta.title;
    if (meta.uploader || meta.channel) uploader = meta.uploader || meta.channel;
    if (typeof meta.duration === 'number') durationSec = meta.duration;
    if (meta.thumbnail) thumbnailUrl = meta.thumbnail;
  } catch (err: any) {
    console.warn('[videoTranscriber] Failed to fetch full metadata with yt-dlp:', err.message);
  }

  // 2. Prepare temporary directory for subtitle extraction
  const tempId = `transcribe_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const tempDir = path.join(DATA_DIR, 'tmp', tempId);
  fs.mkdirSync(tempDir, { recursive: true });

  let rawTranscript = '';

  try {
    // Attempt A: Extract official or auto-generated Spanish subtitles
    const subOutTemplate = path.join(tempDir, 'sub.%(ext)s');
    await execFileAsync(
      ytdlpPath,
      [
        '--write-subs',
        '--write-auto-subs',
        '--sub-langs',
        'es.*,es,es-419,es-ES,es-MX',
        '--sub-format',
        'vtt/srt',
        '--skip-download',
        '--no-warnings',
        '-o',
        subOutTemplate,
        url,
      ],
      { timeout: 45000 }
    ).catch(() => null);

    // Scan for generated subtitle file
    const files = fs.readdirSync(tempDir);
    const subFile = files.find((f) => f.endsWith('.vtt') || f.endsWith('.srt'));

    if (subFile) {
      const content = fs.readFileSync(path.join(tempDir, subFile), 'utf-8');
      rawTranscript = cleanSubtitleText(content);
    }

    // Attempt B: Fallback to local Whisper CLI if subtitles are missing or very short (< 60 chars)
    if (!rawTranscript || rawTranscript.length < 60) {
      const whisperPath = resolveLocalToolPath('whisper');
      if (whisperPath) {
        const audioFile = path.join(tempDir, 'audio.mp3');
        // Download 64k audio stream only
        await execFileAsync(
          ytdlpPath,
          [
            '-x',
            '--audio-format',
            'mp3',
            '--audio-quality',
            '64K',
            '--no-warnings',
            '-o',
            audioFile,
            url,
          ],
          { timeout: 60000 }
        );

        if (fs.existsSync(audioFile)) {
          await execFileAsync(
            whisperPath,
            [
              audioFile,
              '--language',
              'es',
              '--model',
              'base',
              '--output_format',
              'txt',
              '--output_dir',
              tempDir,
            ],
            { timeout: 180000 }
          );

          const txtFile = path.join(tempDir, 'audio.txt');
          if (fs.existsSync(txtFile)) {
            rawTranscript = fs.readFileSync(txtFile, 'utf-8').trim();
          }
        }
      }
    }
  } catch (err: any) {
    console.error('[videoTranscriber] Error during subtitle/audio extraction:', err);
  } finally {
    // Cleanup temporary files
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }

  // If transcript is still empty, throw clear helpful error
  if (!rawTranscript || rawTranscript.length < 30) {
    throw new Error(
      `No se pudo extraer la transcripción automática de este video. Asegúrate de que el video tenga audio o subtítulos en español disponibles.`
    );
  }

  // 3. AI Analysis: Extract horror hook, mystery elements, and angle for Archivo Clasificado
  const aiPrompt = `Actúa como un Investigador de Expedientes y Guionista de Terror para el canal "Archivo Clasificado" (@archivoclasificado01), experto en relatos virales estilo "Relatos de la Noche" y "DrossRotzank".

A continuación tienes la transcripción completa de un video de referencia sobre un misterio, suceso paranormal o caso perturbador:

Título original: "${title}"
Canal fuente: "${uploader}"
Transcripción:
"""
${rawTranscript.slice(0, 6000)}
"""

Genera un análisis en formato JSON con esta estructura exacta:
{
  "summary": "Resumen conciso y espeluznante de lo que ocurrió (2-3 oraciones enfocadas en el misterio)",
  "suggestedHook": "Un gancho narrativo perturbador de 1 oración (0-5 segundos) para abrir el video y paralizar a la audiencia (ej: 'Lo que una familia encontró grabado a las 3:14 AM en su sótano jamás debió salir a la luz...')",
  "angle": "El ángulo siniestro para narrar la historia en Archivo Clasificado",
  "mysteryElements": [
    "Elemento aterrador 1 (ej: 'El susurro captado en la grabadora')",
    "Elemento aterrador 2",
    "Elemento aterrador 3"
  ],
  "recommendedFormats": ["9:16", "16:9"]
}`;

  let summary = 'Un perturbador expediente sin resolver que oculta detalles que la versión oficial intentó callar.';
  let suggestedHook = 'Lo que estás a punto de escuchar ocurrió en circunstancias que la ciencia aún no ha podido explicar...';
  let angle = 'Narración testimonial inmersiva en primera persona con tensión ascendente.';
  let mysteryElements = ['El testimonio de los testigos', 'Evidencia documental oculta', 'El desenlace inexplicable'];
  let recommendedFormats: ('9:16' | '16:9')[] = ['9:16', '16:9'];

  try {
    const aiResult = await generateAIText({
      prompt: aiPrompt,
      systemInstruction: 'Eres un director de contenido de terror y misterio para redes sociales. Devuelve únicamente JSON válido.',
      jsonMode: true,
      temperature: 0.7,
    });

    const parsed = extractJsonPayload<any>(aiResult.text, {});
    if (parsed.summary) summary = parsed.summary;
    if (parsed.suggestedHook) suggestedHook = parsed.suggestedHook;
    if (parsed.angle) angle = parsed.angle;
    if (Array.isArray(parsed.mysteryElements) && parsed.mysteryElements.length > 0) {
      mysteryElements = parsed.mysteryElements;
    }
    if (Array.isArray(parsed.recommendedFormats)) {
      recommendedFormats = parsed.recommendedFormats;
    }
  } catch (err: any) {
    console.warn('[videoTranscriber] AI analysis fallback used:', err.message);
  }

  return {
    url,
    title,
    uploader,
    durationSec,
    thumbnailUrl,
    transcript: rawTranscript,
    summary,
    suggestedHook,
    angle,
    mysteryElements,
    recommendedFormats,
  };
}
