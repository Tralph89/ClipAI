import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';
import { LocalToolStatus, OllamaModelInfo, SystemStatus } from '../../src/types.ts';
import { countStoredMediaFiles, DATA_DIR, loadDb } from '../storage/localDb.ts';

const resolvedToolCache = new Map<string, string | null>();

function getCandidatePathsForWindows(toolName: string): string[] {
  const home = os.homedir();
  const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');

  const candidates: Record<string, string[]> = {
    ollama: [path.join(localAppData, 'Programs', 'Ollama', 'ollama.exe')],
    ffmpeg: [
      path.join(
        localAppData,
        'Microsoft',
        'WinGet',
        'Packages',
        'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe',
        'ffmpeg-8.1.1-full_build',
        'bin',
        'ffmpeg.exe'
      ),
    ],
    ffprobe: [
      path.join(
        localAppData,
        'Microsoft',
        'WinGet',
        'Packages',
        'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe',
        'ffmpeg-8.1.1-full_build',
        'bin',
        'ffprobe.exe'
      ),
    ],
    'edge-tts': [
      path.join(localAppData, 'Programs', 'Python', 'Python311', 'Scripts', 'edge-tts.exe'),
      path.join(localAppData, 'hermes', 'hermes-agent', 'venv', 'Scripts', 'edge-tts.exe'),
    ],
    piper: [
      path.join(localAppData, 'Programs', 'Python', 'Python311', 'Scripts', 'piper.exe'),
      path.join(localAppData, 'hermes', 'hermes-agent', 'venv', 'Scripts', 'piper.exe'),
    ],
    whisper: [
      path.join(localAppData, 'Programs', 'Python', 'Python311', 'Scripts', 'whisper.exe'),
      path.join(localAppData, 'hermes', 'hermes-agent', 'venv', 'Scripts', 'whisper.exe'),
    ],
    'yt-dlp': [
      path.join(localAppData, 'Programs', 'Python', 'Python311', 'Scripts', 'yt-dlp.exe'),
      path.join(localAppData, 'hermes', 'hermes-agent', 'venv', 'Scripts', 'yt-dlp.exe'),
    ],
    comfyui_wan21: [
      'C:\\ComfyUI_windows_portable\\ComfyUI\\models\\wan\\wan2.1_i2v_480p_14B.safetensors',
    ],
    ltx_23_local: [
      path.join(localAppData, 'LTXDesktop', 'models', 'ltx-2.3-22b-distilled.safetensors'),
    ],
  };

  return candidates[toolName] || [];
}

export function resolveLocalToolPath(toolName: string): string | null {
  if (resolvedToolCache.has(toolName)) {
    return resolvedToolCache.get(toolName) ?? null;
  }

  // 1. Check known concrete installation directories first on Windows (avoids WinGet Links 0-byte reparse ENOENT)
  if (process.platform === 'win32') {
    for (const candidate of getCandidatePathsForWindows(toolName)) {
      if (fs.existsSync(candidate)) {
        resolvedToolCache.set(toolName, candidate);
        return candidate;
      }
    }
  }

  // 2. Fallback to system PATH lookup (`where.exe` on Windows, `which` on Unix)
  try {
    const locator = process.platform === 'win32' ? 'where.exe' : 'which';
    const stdout = execFileSync(locator, [toolName], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2500,
    });
    const firstMatch = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => {
        if (!line || !fs.existsSync(line)) return false;
        try {
          return fs.statSync(line).size > 0;
        } catch {
          return false;
        }
      });

    if (firstMatch) {
      resolvedToolCache.set(toolName, firstMatch);
      return firstMatch;
    }
  } catch {
    // Not found in PATH
  }

  resolvedToolCache.set(toolName, null);
  return null;
}

export async function fetchOllamaStatus(baseUrl?: string): Promise<{
  reachable: boolean;
  version?: string;
  models: OllamaModelInfo[];
}> {
  const db = loadDb();
  const cleanBase = (baseUrl || db.settings.ollamaBaseUrl || 'http://127.0.0.1:11434').replace(
    /\/+$/,
    ''
  );

  try {
    const [tagsRes, versionRes] = await Promise.all([
      fetch(`${cleanBase}/api/tags`, { signal: AbortSignal.timeout(3500) }),
      fetch(`${cleanBase}/api/version`, { signal: AbortSignal.timeout(2500) }).catch(() => null),
    ]);

    if (!tagsRes.ok) {
      return { reachable: false, models: [] };
    }

    const tagsJson = (await tagsRes.json()) as { models?: any[] };
    const versionJson = versionRes && versionRes.ok ? ((await versionRes.json()) as { version?: string }) : undefined;

    const models: OllamaModelInfo[] = (tagsJson.models || []).map((m: any) => ({
      name: m.name || m.model,
      sizeBytes: typeof m.size === 'number' ? m.size : 0,
      parameterSize: m.details?.parameter_size,
      family: m.details?.family,
      capabilities: Array.isArray(m.capabilities) ? m.capabilities : [],
    }));

    return {
      reachable: true,
      version: versionJson?.version,
      models,
    };
  } catch {
    return { reachable: false, models: [] };
  }
}

export async function getSystemStatus(): Promise<SystemStatus> {
  const ollama = await fetchOllamaStatus();

  const toolDefinitions: Array<{ id: string; name: string; role: string }> = [
    { id: 'ollama', name: 'Ollama Runtime', role: 'Motor IA Local (Guiones, Copy, SEO)' },
    { id: 'comfyui_wan21', name: 'ComfyUI • Wan 2.1 14B', role: 'Generación de Video IA Local en GPU (:8188)' },
    { id: 'ltx_23_local', name: 'LTX 2.3 (22B Fast)', role: 'Generación de Video e Imagen IA Local (:41954)' },
    { id: 'ffmpeg', name: 'FFmpeg 8.1', role: 'Renderizador Master MP4 1080p & Subtítulos .ASS' },
    { id: 'ffprobe', name: 'FFprobe', role: 'Medición exacta de duración de audio y escenas' },
    { id: 'edge-tts', name: 'Edge-TTS Neural', role: 'Locución hispana/inglesa + Timestamps por palabra' },
    { id: 'piper', name: 'Piper TTS', role: 'Síntesis de voz 100% offline en CPU' },
    { id: 'whisper', name: 'OpenAI Whisper CLI', role: 'Alineación y transcripción local de audio' },
    { id: 'yt-dlp', name: 'yt-dlp', role: 'Extracción de metadatos y tendencias de video' },
  ];

  const tools: LocalToolStatus[] = toolDefinitions.map((def) => {
    const foundPath = resolveLocalToolPath(def.id);
    return {
      id: def.id,
      name: def.name,
      available: Boolean(foundPath),
      path: foundPath || undefined,
      role: def.role,
    };
  });

  return {
    ollamaReachable: ollama.reachable,
    ollamaVersion: ollama.version,
    ollamaModels: ollama.models,
    tools,
    storageDir: DATA_DIR,
    mediaCount: countStoredMediaFiles(),
  };
}

