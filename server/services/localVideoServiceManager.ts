import fs from 'fs';
import os from 'os';
import path from 'path';
import { ChildProcess, execFile, spawn } from 'child_process';
import { promisify } from 'util';
import {
  LocalVideoClusterStatus,
  LocalVideoEngineId,
  LocalVideoEngineInfo,
} from '../../src/types.ts';
import { DATA_DIR, loadDb } from '../storage/localDb.ts';
import { resolveLocalToolPath } from './systemTools.ts';

const execFileAsync = promisify(execFile);

export const COMFYUI_ROOT = 'C:\\ComfyUI_windows_portable';
const COMFYUI_PYTHON = path.join(COMFYUI_ROOT, 'python_embeded', 'python.exe');
const COMFYUI_MAIN = path.join(COMFYUI_ROOT, 'ComfyUI', 'main.py');
const WAN_MODEL_FILE = path.join(
  COMFYUI_ROOT,
  'ComfyUI',
  'models',
  'wan',
  'wan2.1_i2v_480p_14B.safetensors'
);

const LTX_APP_DATA = path.join(os.homedir(), 'AppData', 'Local', 'LTXDesktop');
const LTX_PYTHON = path.join(LTX_APP_DATA, 'python', 'python.exe');
const LTX_BACKEND_DIR = 'C:\\Program Files\\LTX Desktop\\resources\\backend';
const LTX_SERVER_PY = path.join(LTX_BACKEND_DIR, 'ltx2_server.py');
const LTX_MODEL_FILE = path.join(
  LTX_APP_DATA,
  'models',
  'ltx-2.3-22b-distilled.safetensors'
);

const managedProcesses: Partial<Record<LocalVideoEngineId, ChildProcess>> = {};
const startingFlags: Record<LocalVideoEngineId, boolean> = {
  wan_comfyui: false,
  ltx_local: false,
};
const startedAtMs: Record<LocalVideoEngineId, number> = {
  wan_comfyui: 0,
  ltx_local: 0,
};
const logBuffers: Record<LocalVideoEngineId, string[]> = {
  wan_comfyui: [],
  ltx_local: [],
};

function appendEngineLog(engineId: LocalVideoEngineId, chunk: Buffer | string) {
  const lines = String(chunk)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    logBuffers[engineId].push(line.slice(0, 220));
    if (logBuffers[engineId].length > 35) {
      logBuffers[engineId].shift();
    }
  }
}

export function getEngineBaseUrls(): { comfyUiUrl: string; ltxLocalUrl: string } {
  const db = loadDb();
  return {
    comfyUiUrl: (db.settings.comfyUiUrl || 'http://127.0.0.1:8188').replace(/\/+$/, ''),
    ltxLocalUrl: (db.settings.ltxLocalUrl || 'http://127.0.0.1:41954').replace(/\/+$/, ''),
  };
}

export function isComfyUIInstalled(): boolean {
  return (
    fs.existsSync(COMFYUI_PYTHON) &&
    fs.existsSync(COMFYUI_MAIN) &&
    fs.existsSync(WAN_MODEL_FILE)
  );
}

export function isLtxLocalInstalled(): boolean {
  return (
    fs.existsSync(LTX_PYTHON) &&
    fs.existsSync(LTX_SERVER_PY) &&
    fs.existsSync(LTX_MODEL_FILE)
  );
}

/**
 * Generates `data/comfyui_extra_paths.yaml` inside the ClipAI workspace so ComfyUI's
 * `WanVideoModelLoader` finds `wan2.1_i2v_480p_14B.safetensors` inside `models/wan`
 * and also discovers LTX 2.3 models without modifying files outside our workspace.
 */
export function ensureComfyExtraPathsConfig(): string {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const yamlPath = path.join(DATA_DIR, 'comfyui_extra_paths.yaml');
  const comfyModelsPosix = path
    .join(COMFYUI_ROOT, 'ComfyUI', 'models')
    .replace(/\\/g, '/');
  const ltxModelsPosix = path.join(LTX_APP_DATA, 'models').replace(/\\/g, '/');

  const yamlContent = [
    'clipai_wan_paths:',
    `  base_path: ${comfyModelsPosix}`,
    '  diffusion_models: |',
    '    diffusion_models',
    '    wan',
    '  vae: |',
    '    vae',
    '    wan',
    '  clip_vision: |',
    '    clip_vision',
    '    wan',
    '  text_encoders: |',
    '    text_encoders',
    '    wan',
    'clipai_ltx_paths:',
    `  base_path: ${ltxModelsPosix}`,
    '  checkpoints: .',
    '  diffusion_models: .',
    '',
  ].join('\n');

  fs.writeFileSync(yamlPath, yamlContent, 'utf-8');
  return yamlPath;
}

/**
 * Frees Ollama LLM weights from GPU VRAM (`keep_alive: 0`) right before heavy video diffusion
 * so 24 GB GPUs (RTX 5090 Laptop) never hit CUDA Out-Of-Memory. Ollama reloads automatically on next text prompt.
 */
export async function unloadOllamaFromVram(): Promise<void> {
  try {
    const db = loadDb();
    const base = (db.settings.ollamaBaseUrl || 'http://127.0.0.1:11434').replace(
      /\/+$/,
      ''
    );
    const psRes = await fetch(`${base}/api/ps`, {
      signal: AbortSignal.timeout(2500),
    }).catch(() => null);

    const modelsToUnload = new Set<string>();
    if (db.settings.ollamaModel) {
      modelsToUnload.add(db.settings.ollamaModel);
    }
    if (psRes && psRes.ok) {
      const psJson = (await psRes.json()) as { models?: Array<{ name?: string; model?: string }> };
      for (const m of psJson.models || []) {
        const name = m.name || m.model;
        if (name) modelsToUnload.add(name);
      }
    }

    await Promise.allSettled(
      Array.from(modelsToUnload).map((modelName) =>
        fetch(`${base}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: modelName, keep_alive: 0 }),
          signal: AbortSignal.timeout(3500),
        })
      )
    );
  } catch {
    // Non-fatal if Ollama is offline
  }
}

async function queryGpuTelemetry(): Promise<{
  gpuName: string;
  vramTotalMb: number;
  vramUsedMb: number;
  vramFreeMb: number;
}> {
  try {
    const { stdout } = await execFileAsync(
      'nvidia-smi',
      [
        '--query-gpu=name,memory.total,memory.used,memory.free',
        '--format=csv,noheader,nounits',
      ],
      { timeout: 3000 }
    );
    const firstLine = stdout.split(/\r?\n/).find((l) => l.trim());
    if (firstLine) {
      const [name, total, used, free] = firstLine.split(',').map((s) => s.trim());
      return {
        gpuName: name || 'NVIDIA GPU',
        vramTotalMb: Number(total) || 0,
        vramUsedMb: Number(used) || 0,
        vramFreeMb: Number(free) || 0,
      };
    }
  } catch {
    // Fallback if nvidia-smi unavailable
  }
  return {
    gpuName: 'GPU Local',
    vramTotalMb: 0,
    vramUsedMb: 0,
    vramFreeMb: 0,
  };
}

async function probeComfyUIStatus(comfyUiUrl: string): Promise<{
  online: boolean;
  busy: boolean;
  progressPhase?: string;
}> {
  try {
    const statsRes = await fetch(`${comfyUiUrl}/system_stats`, {
      signal: AbortSignal.timeout(2200),
    });
    if (!statsRes.ok) return { online: false, busy: false };

    let busy = false;
    let progressPhase: string | undefined;
    try {
      const qRes = await fetch(`${comfyUiUrl}/queue`, {
        signal: AbortSignal.timeout(1800),
      });
      if (qRes.ok) {
        const qJson = (await qRes.json()) as {
          queue_running?: any[];
          queue_pending?: any[];
        };
        const running = qJson.queue_running?.length || 0;
        const pending = qJson.queue_pending?.length || 0;
        busy = running > 0 || pending > 0;
        if (busy) {
          progressPhase = `Renderizando Wan 2.1 (${running} activo, ${pending} en cola)`;
        }
      }
    } catch {}

    return { online: true, busy, progressPhase };
  } catch {
    return { online: false, busy: false };
  }
}

async function probeLtxLocalStatus(ltxLocalUrl: string): Promise<{
  online: boolean;
  busy: boolean;
  progressPct?: number;
  progressPhase?: string;
}> {
  try {
    const healthRes = await fetch(`${ltxLocalUrl}/health`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!healthRes.ok) return { online: false, busy: false };

    let busy = false;
    let progressPct: number | undefined;
    let progressPhase: string | undefined;

    try {
      const progRes = await fetch(`${ltxLocalUrl}/api/generation/progress`, {
        signal: AbortSignal.timeout(1800),
      });
      if (progRes.ok) {
        const progJson = (await progRes.json()) as {
          status?: string;
          phase?: string;
          progress?: number;
          currentStep?: number | null;
          totalSteps?: number | null;
        };
        if (progJson.status === 'running') {
          busy = true;
          progressPct =
            typeof progJson.progress === 'number' ? progJson.progress : undefined;
          const stepInfo =
            progJson.currentStep && progJson.totalSteps
              ? ` (${progJson.currentStep}/${progJson.totalSteps})`
              : '';
          progressPhase = `${progJson.phase || 'Generando LTX 2.3'}${stepInfo}`;
        }
      }
    } catch {}

    return { online: true, busy, progressPct, progressPhase };
  } catch {
    return { online: false, busy: false };
  }
}

export async function getLocalVideoClusterStatus(): Promise<LocalVideoClusterStatus> {
  const { comfyUiUrl, ltxLocalUrl } = getEngineBaseUrls();
  const [gpu, comfyProbe, ltxProbe] = await Promise.all([
    queryGpuTelemetry(),
    probeComfyUIStatus(comfyUiUrl),
    probeLtxLocalStatus(ltxLocalUrl),
  ]);

  // Clear stale starting flags once online or timed out (>110s)
  const now = Date.now();
  if (comfyProbe.online || now - startedAtMs.wan_comfyui > 110_000) {
    startingFlags.wan_comfyui = false;
  }
  if (ltxProbe.online || now - startedAtMs.ltx_local > 110_000) {
    startingFlags.ltx_local = false;
  }

  const wanInfo: LocalVideoEngineInfo = {
    id: 'wan_comfyui',
    name: 'ComfyUI • Wan 2.1 (14B Local)',
    port: Number(new URL(comfyUiUrl).port) || 8188,
    baseUrl: comfyUiUrl,
    installed: isComfyUIInstalled(),
    modelSummary: 'wan2.1_i2v_480p_14B (30.5 GB) + UMT5-XXL FP8 + Wan VAE',
    status: comfyProbe.online
      ? 'online'
      : startingFlags.wan_comfyui
      ? 'starting'
      : 'offline',
    managedByClipAI: Boolean(managedProcesses.wan_comfyui),
    busy: comfyProbe.busy,
    progressPhase: comfyProbe.progressPhase,
    recentLogs: logBuffers.wan_comfyui.slice(-8),
  };

  const ltxInfo: LocalVideoEngineInfo = {
    id: 'ltx_local',
    name: 'LTX 2.3 Local (22B Distilled Fast)',
    port: Number(new URL(ltxLocalUrl).port) || 41954,
    baseUrl: ltxLocalUrl,
    installed: isLtxLocalInstalled(),
    modelSummary: 'ltx-2.3-22b-distilled (43 GB) + Gemma-3 12B + Z-Image-Turbo + SageAttention',
    status: ltxProbe.online
      ? 'online'
      : startingFlags.ltx_local
      ? 'starting'
      : 'offline',
    managedByClipAI: Boolean(managedProcesses.ltx_local),
    busy: ltxProbe.busy,
    progressPct: ltxProbe.progressPct,
    progressPhase: ltxProbe.progressPhase,
    recentLogs: logBuffers.ltx_local.slice(-8),
  };

  return {
    gpuName: gpu.gpuName,
    vramTotalMb: gpu.vramTotalMb,
    vramUsedMb: gpu.vramUsedMb,
    vramFreeMb: gpu.vramFreeMb,
    engines: {
      wan_comfyui: wanInfo,
      ltx_local: ltxInfo,
    },
  };
}

function buildEnhancedEnv(extraEnv: Record<string, string> = {}): NodeJS.ProcessEnv {
  const ffmpegPath = resolveLocalToolPath('ffmpeg');
  const ffmpegDir = ffmpegPath ? path.dirname(ffmpegPath) : '';
  const currentPath = process.env.PATH || process.env.Path || '';
  const mergedPath = ffmpegDir ? `${ffmpegDir};${currentPath}` : currentPath;

  return {
    ...process.env,
    PATH: mergedPath,
    PYTHONUTF8: '1',
    PYTHONIOENCODING: 'utf-8',
    ...extraEnv,
  };
}

async function killProcessTreeWindows(pid: number): Promise<void> {
  if (!pid) return;
  try {
    await execFileAsync('taskkill', ['/PID', String(pid), '/T', '/F'], {
      timeout: 6000,
    });
  } catch {
    // Process already exited
  }
}

async function findListeningPidOnPort(port: number): Promise<number | null> {
  if (process.platform !== 'win32') return null;
  try {
    const { stdout } = await execFileAsync('netstat', ['-ano', '-p', 'tcp'], {
      timeout: 3500,
    });
    for (const line of stdout.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed.includes(`:${port}`) || !trimmed.includes('LISTENING')) continue;
      const parts = trimmed.split(/\s+/);
      const localAddr = parts[1] || '';
      const pidStr = parts[parts.length - 1] || '';
      if (localAddr.endsWith(`:${port}`)) {
        const pid = Number(pidStr);
        if (pid > 0) return pid;
      }
    }
  } catch {}
  return null;
}

export async function stopLocalVideoEngine(
  engineId: LocalVideoEngineId
): Promise<LocalVideoClusterStatus> {
  const { comfyUiUrl, ltxLocalUrl } = getEngineBaseUrls();

  if (engineId === 'wan_comfyui') {
    await fetch(`${comfyUiUrl}/interrupt`, {
      method: 'POST',
      signal: AbortSignal.timeout(2000),
    }).catch(() => null);
    await fetch(`${comfyUiUrl}/free`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unload_models: true, free_memory: true }),
      signal: AbortSignal.timeout(2500),
    }).catch(() => null);
  } else {
    await fetch(`${ltxLocalUrl}/api/generate/cancel`, {
      method: 'POST',
      signal: AbortSignal.timeout(2000),
    }).catch(() => null);
  }

  startingFlags[engineId] = false;
  const proc = managedProcesses[engineId];
  if (proc?.pid) {
    await killProcessTreeWindows(proc.pid);
    delete managedProcesses[engineId];
  } else {
    // Also stop orphaned local port listener if user explicitly asked to stop it
    const targetPort =
      engineId === 'wan_comfyui'
        ? Number(new URL(comfyUiUrl).port) || 8188
        : Number(new URL(ltxLocalUrl).port) || 41954;
    const pid = await findListeningPidOnPort(targetPort);
    if (pid) {
      await killProcessTreeWindows(pid);
    }
  }

  appendEngineLog(engineId, `[ClipAI] Servicio ${engineId} detenido y VRAM liberada.`);
  await new Promise((r) => setTimeout(r, 700));
  return getLocalVideoClusterStatus();
}

export async function startLocalVideoEngine(
  engineId: LocalVideoEngineId,
  waitUntilReady: boolean = false
): Promise<LocalVideoClusterStatus> {
  const { comfyUiUrl, ltxLocalUrl } = getEngineBaseUrls();

  if (engineId === 'wan_comfyui') {
    const probe = await probeComfyUIStatus(comfyUiUrl);
    if (probe.online) {
      await unloadOllamaFromVram();
      return getLocalVideoClusterStatus();
    }
    if (!isComfyUIInstalled()) {
      throw new Error(
        `No se encontró ComfyUI o el modelo Wan 2.1 en ${WAN_MODEL_FILE}.`
      );
    }

    // Free VRAM from Ollama and stop LTX 2.3 if running so RTX 5090 24GB has maximum headroom
    await unloadOllamaFromVram();
    if (managedProcesses.ltx_local) {
      await stopLocalVideoEngine('ltx_local');
    }

    if (!startingFlags.wan_comfyui) {
      startingFlags.wan_comfyui = true;
      startedAtMs.wan_comfyui = Date.now();
      logBuffers.wan_comfyui = ['[ClipAI] Iniciando ComfyUI + Wan 2.1 14B en 127.0.0.1:8188...'];

      const extraPathsYaml = ensureComfyExtraPathsConfig();
      const port = String(Number(new URL(comfyUiUrl).port) || 8188);

      const child = spawn(
        COMFYUI_PYTHON,
        [
          '-s',
          COMFYUI_MAIN,
          '--windows-standalone-build',
          '--listen',
          '127.0.0.1',
          '--port',
          port,
          '--extra-model-paths-config',
          extraPathsYaml,
        ],
        {
          cwd: COMFYUI_ROOT,
          env: buildEnhancedEnv(),
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        }
      );

      managedProcesses.wan_comfyui = child;
      child.stdout?.on('data', (chunk) => appendEngineLog('wan_comfyui', chunk));
      child.stderr?.on('data', (chunk) => appendEngineLog('wan_comfyui', chunk));
      child.on('exit', (code) => {
        appendEngineLog('wan_comfyui', `[ComfyUI] Proceso finalizado (código ${code ?? 0}).`);
        startingFlags.wan_comfyui = false;
        if (managedProcesses.wan_comfyui === child) {
          delete managedProcesses.wan_comfyui;
        }
      });
    }

    if (waitUntilReady) {
      const deadline = Date.now() + 95_000;
      while (Date.now() < deadline) {
        const check = await probeComfyUIStatus(comfyUiUrl);
        if (check.online) {
          startingFlags.wan_comfyui = false;
          break;
        }
        if (!startingFlags.wan_comfyui && !managedProcesses.wan_comfyui) {
          throw new Error(
            `ComfyUI se cerró durante el arranque: ${logBuffers.wan_comfyui.slice(-3).join(' | ')}`
          );
        }
        await new Promise((r) => setTimeout(r, 1400));
      }
    }

    return getLocalVideoClusterStatus();
  }

  // Engine: ltx_local (LTX 2.3 22B Distilled + Z-Image-Turbo)
  const ltxProbe = await probeLtxLocalStatus(ltxLocalUrl);
  if (ltxProbe.online) {
    await unloadOllamaFromVram();
    return getLocalVideoClusterStatus();
  }
  if (!isLtxLocalInstalled()) {
    throw new Error(
      `No se encontró el servidor local LTX 2.3 o el modelo en ${LTX_MODEL_FILE}.`
    );
  }

  // Free VRAM from Ollama and ComfyUI before booting LTX 2.3
  await unloadOllamaFromVram();
  if (managedProcesses.wan_comfyui) {
    await stopLocalVideoEngine('wan_comfyui');
  } else {
    await fetch(`${comfyUiUrl}/free`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unload_models: true, free_memory: true }),
      signal: AbortSignal.timeout(1800),
    }).catch(() => null);
  }

  if (!startingFlags.ltx_local) {
    startingFlags.ltx_local = true;
    startedAtMs.ltx_local = Date.now();
    logBuffers.ltx_local = [
      '[ClipAI] Iniciando motor local LTX 2.3 (22B Distilled + SageAttention) en 127.0.0.1:41954...',
    ];

    const port = String(Number(new URL(ltxLocalUrl).port) || 41954);
    const child = spawn(LTX_PYTHON, ['-X', 'utf8', LTX_SERVER_PY], {
      cwd: LTX_BACKEND_DIR,
      env: buildEnhancedEnv({
        LTX_APP_DATA_DIR: LTX_APP_DATA,
        LTX_PORT: port,
      }),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    managedProcesses.ltx_local = child;
    child.stdout?.on('data', (chunk) => appendEngineLog('ltx_local', chunk));
    child.stderr?.on('data', (chunk) => appendEngineLog('ltx_local', chunk));
    child.on('exit', (code) => {
      appendEngineLog('ltx_local', `[LTX 2.3] Proceso finalizado (código ${code ?? 0}).`);
      startingFlags.ltx_local = false;
      if (managedProcesses.ltx_local === child) {
        delete managedProcesses.ltx_local;
      }
    });
  }

  if (waitUntilReady) {
    const deadline = Date.now() + 95_000;
    while (Date.now() < deadline) {
      const check = await probeLtxLocalStatus(ltxLocalUrl);
      if (check.online) {
        startingFlags.ltx_local = false;
        // Ensure local text encoder & local generation preferences are active in LTX runtime
        await fetch(`${ltxLocalUrl}/api/settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_prefers_ltx_api_video_generations: false,
            use_local_text_encoder: true,
          }),
          signal: AbortSignal.timeout(3000),
        }).catch(() => null);
        break;
      }
      if (!startingFlags.ltx_local && !managedProcesses.ltx_local) {
        throw new Error(
          `LTX 2.3 se cerró durante el arranque: ${logBuffers.ltx_local.slice(-3).join(' | ')}`
        );
      }
      await new Promise((r) => setTimeout(r, 1400));
    }
  }

  return getLocalVideoClusterStatus();
}

