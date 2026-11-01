/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AspectRatioType,
  ComfyUIConfig,
  StyleTechnicalProfile,
  VIDEO_STYLES,
  VisualBible,
} from '../types';

export interface ComfyDiscoveryResult {
  connected: boolean;
  checkpoints: string[];
  loras: string[];
  error?: string;
}

export function getComfyDimensions(aspectRatio: AspectRatioType): {
  width: number;
  height: number;
} {
  if (aspectRatio === '16:9') return { width: 1344, height: 768 };
  if (aspectRatio === '1:1') return { width: 1024, height: 1024 };
  return { width: 768, height: 1344 }; // 9:16 vertical native SDXL/Flux resolution
}

/**
 * Deterministic client-side prompt builder so every scene immediately has a valid,
 * style-coherent Positive & Negative prompt even before running the AI Visual Director.
 */
export function buildStyleCoherentScenePrompt(
  sceneTitle: string,
  sceneDialogue: string,
  styleId: string,
  architecture: 'flux1' | 'sdxl' | 'custom_json',
  visualBible?: VisualBible
): { positive: string; negative: string } {
  const styleProfile: StyleTechnicalProfile =
    VIDEO_STYLES.find((s) => s.id === styleId) || VIDEO_STYLES[0];

  const charPart = visualBible?.characterAnchor
    ? `Consistent subject: ${visualBible.characterAnchor}.`
    : '';
  const envPart = visualBible?.environmentAnchor
    ? `Consistent setting: ${visualBible.environmentAnchor}.`
    : '';
  const colorPart = visualBible?.colorPalette
    ? `Color palette: ${visualBible.colorPalette}.`
    : '';

  const cleanAction = `${sceneTitle}. ${sceneDialogue.slice(0, 120)}`.replace(/\s+/g, ' ').trim();

  if (architecture === 'sdxl') {
    const positive = [
      styleProfile.sdxlTags,
      charPart,
      cleanAction,
      envPart,
      colorPart,
      styleProfile.cameraAndLighting,
    ]
      .filter(Boolean)
      .join(' ');
    return {
      positive,
      negative: styleProfile.negativePrompt,
    };
  }

  // Flux.1 natural language structured prompt
  const positive = [
    styleProfile.fluxPrefix,
    charPart,
    `Scene action: ${cleanAction}.`,
    envPart,
    colorPart,
    `Lighting & Camera: ${styleProfile.cameraAndLighting}.`,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    positive,
    negative: styleProfile.negativePrompt,
  };
}

async function comfyRequest(
  config: ComfyUIConfig,
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: any
): Promise<any> {
  const cleanBase = config.serverUrl.trim().replace(/\/+$/, '');

  if (config.connectionMode === 'server_proxy') {
    const res = await fetch('/api/comfy/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serverUrl: cleanBase,
        endpoint,
        method,
        body,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Error proxy ComfyUI (${res.status})`);
    }
    return data;
  }

  // Browser direct mode (e.g. http://127.0.0.1:8188 on user's local machine)
  const targetUrl = `${cleanBase}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const res = await fetch(targetUrl, {
    method,
    headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
    body: method === 'POST' && body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    throw new Error(`ComfyUI respondió con HTTP ${res.status}`);
  }

  if (endpoint.startsWith('/view')) {
    const blob = await res.blob();
    return await blobToDataUrl(blob);
  }

  return await res.json();
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Checks connectivity with the user's ComfyUI instance and fetches installed Checkpoints & LoRAs.
 */
export async function checkComfyConnection(
  config: ComfyUIConfig
): Promise<ComfyDiscoveryResult> {
  try {
    const info = await comfyRequest(config, '/object_info', 'GET');
    const ckptSimple =
      info?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] || [];
    const unetModels = info?.UNETLoader?.input?.required?.unet_name?.[0] || [];
    const checkpoints = Array.from(new Set([...ckptSimple, ...unetModels]));

    const lorasRaw = info?.LoraLoader?.input?.required?.lora_name?.[0] || [];
    const loras = ['None', ...lorasRaw];

    return {
      connected: true,
      checkpoints: checkpoints.length
        ? checkpoints
        : ['flux1-dev-fp8.safetensors', 'juggernautXL_v9.safetensors'],
      loras,
    };
  } catch (err: any) {
    return {
      connected: false,
      checkpoints: [],
      loras: [],
      error:
        err.message ||
        'No se detectó ComfyUI activo. Asegúrate de ejecutar ComfyUI con --enable-cors-header "*"',
    };
  }
}

/**
 * Constructs a ComfyUI API Workflow JSON graph for Flux.1, SDXL (+ optional LoRA), or Custom JSON.
 */
export function buildComfyWorkflowGraph(params: {
  config: ComfyUIConfig;
  positivePrompt: string;
  negativePrompt: string;
  seed: number;
  aspectRatio: AspectRatioType;
}): Record<string, any> {
  const { config, positivePrompt, negativePrompt, seed, aspectRatio } = params;
  const { width, height } = getComfyDimensions(aspectRatio);

  if (config.architecture === 'custom_json' && config.customWorkflowJson?.trim()) {
    const replaced = config.customWorkflowJson
      .replace(/\{\{POSITIVE_PROMPT\}\}/g, JSON.stringify(positivePrompt).slice(1, -1))
      .replace(/\{\{NEGATIVE_PROMPT\}\}/g, JSON.stringify(negativePrompt).slice(1, -1))
      .replace(/\{\{SEED\}\}/g, String(seed))
      .replace(/\{\{WIDTH\}\}/g, String(width))
      .replace(/\{\{HEIGHT\}\}/g, String(height));
    return JSON.parse(replaced);
  }

  const hasLora =
    config.loraName && config.loraName !== 'None' && config.loraName.trim() !== '';

  const modelSource: [string, number] = hasLora ? ['10', 0] : ['1', 0];
  const clipSource: [string, number] = hasLora ? ['10', 1] : ['1', 1];

  const baseGraph: Record<string, any> = {
    '1': {
      inputs: {
        ckpt_name: config.checkpointName || 'flux1-dev-fp8.safetensors',
      },
      class_type: 'CheckpointLoaderSimple',
    },
    '2': {
      inputs: {
        text: positivePrompt,
        clip: clipSource,
      },
      class_type: 'CLIPTextEncode',
    },
    '3': {
      inputs: {
        text: config.architecture === 'flux1' ? '' : negativePrompt,
        clip: clipSource,
      },
      class_type: 'CLIPTextEncode',
    },
    '4': {
      inputs: {
        width,
        height,
        batch_size: 1,
      },
      class_type: 'EmptyLatentImage',
    },
    '5': {
      inputs: {
        seed,
        steps: config.steps || (config.architecture === 'flux1' ? 20 : 25),
        cfg: config.architecture === 'flux1' ? config.cfg || 1.0 : config.cfg || 7.0,
        sampler_name: config.samplerName || (config.architecture === 'flux1' ? 'euler' : 'dpmpp_2m'),
        scheduler: config.scheduler || (config.architecture === 'flux1' ? 'simple' : 'karras'),
        denoise: 1.0,
        model: modelSource,
        positive: ['2', 0],
        negative: ['3', 0],
        latent_image: ['4', 0],
      },
      class_type: 'KSampler',
    },
    '6': {
      inputs: {
        samples: ['5', 0],
        vae: ['1', 2],
      },
      class_type: 'VAEDecode',
    },
    '7': {
      inputs: {
        filename_prefix: 'ClipAI_Studio',
        images: ['6', 0],
      },
      class_type: 'SaveImage',
    },
  };

  if (hasLora) {
    baseGraph['10'] = {
      inputs: {
        lora_name: config.loraName,
        strength_model: config.loraStrength ?? 0.85,
        strength_clip: config.loraStrength ?? 0.85,
        model: ['1', 0],
        clip: ['1', 1],
      },
      class_type: 'LoraLoader',
    };
  }

  return baseGraph;
}

/**
 * Queues a prompt in ComfyUI, polls /history/{prompt_id} until completion, and returns the image as a Base64 Data URL.
 */
export async function generateImageWithComfyUI(params: {
  config: ComfyUIConfig;
  positivePrompt: string;
  negativePrompt: string;
  seed: number;
  aspectRatio: AspectRatioType;
}): Promise<{ imageUrl: string; renderTimeMs: number }> {
  const startTime = performance.now();
  const workflow = buildComfyWorkflowGraph(params);

  const clientId = `clipai-${Date.now()}`;
  const queueRes = await comfyRequest(params.config, '/prompt', 'POST', {
    prompt: workflow,
    client_id: clientId,
  });

  const promptId = queueRes?.prompt_id;
  if (!promptId) {
    throw new Error('ComfyUI no devolvió un prompt_id válido al encolar el workflow.');
  }

  // Poll /history/{promptId} up to 120 seconds
  const maxAttempts = 80;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, 1500));
    const historyData = await comfyRequest(
      params.config,
      `/history/${promptId}`,
      'GET'
    );
    const entry = historyData?.[promptId];
    if (entry && entry.outputs) {
      for (const nodeId of Object.keys(entry.outputs)) {
        const images = entry.outputs[nodeId]?.images;
        if (Array.isArray(images) && images.length > 0) {
          const imgMeta = images[0];
          const viewQuery = `/view?filename=${encodeURIComponent(
            imgMeta.filename
          )}&subfolder=${encodeURIComponent(imgMeta.subfolder || '')}&type=${encodeURIComponent(
            imgMeta.type || 'output'
          )}`;

          const viewRes = await comfyRequest(params.config, viewQuery, 'GET');
          const imageUrl =
            typeof viewRes === 'string' ? viewRes : viewRes?.imageUrl;

          if (imageUrl) {
            return {
              imageUrl,
              renderTimeMs: Math.round(performance.now() - startTime),
            };
          }
        }
      }
    }
  }

  throw new Error('Tiempo de espera agotado esperando el renderizado de ComfyUI.');
}
