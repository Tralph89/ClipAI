import { GoogleGenAI } from '@google/genai';
import { AIProviderId, AppSettings } from '../../src/types.ts';
import { loadDb } from '../storage/localDb.ts';
import { fetchOllamaStatus } from './systemTools.ts';

export interface AIGenerationOptions {
  prompt: string;
  systemInstruction?: string;
  jsonMode?: boolean;
  temperature?: number;
  overrideProvider?: AIProviderId;
  overrideModel?: string;
}

export interface AIGenerationResult {
  text: string;
  providerUsed: AIProviderId;
  modelUsed: string;
  latencyMs: number;
}

function stripThinkingBlocks(raw: string): string {
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
}

export function extractJsonPayload<T>(rawText: string, fallback: T): T {
  const cleaned = stripThinkingBlocks(rawText);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Try extracting the outermost JSON object or array
    const arrayMatch = cleaned.match(/(\[[\s\S]*\])/);
    const objMatch = cleaned.match(/(\{[\s\S]*\})/);

    const candidate =
      arrayMatch && objMatch
        ? arrayMatch.index! < objMatch.index!
          ? arrayMatch[1]
          : objMatch[1]
        : arrayMatch?.[1] || objMatch?.[1];

    if (candidate) {
      try {
        return JSON.parse(candidate) as T;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}

async function resolveBestOllamaModel(settings: AppSettings, overrideModel?: string): Promise<string> {
  if (overrideModel) return overrideModel;

  const status = await fetchOllamaStatus(settings.ollamaBaseUrl);
  if (!status.reachable || status.models.length === 0) {
    return settings.ollamaModel || 'gemma4:12b';
  }

  const exact = status.models.find((m) => m.name === settings.ollamaModel);
  if (exact) return exact.name;

  // Smart preference order from detected local models
  const preferredOrder = ['gemma4:12b', 'qwen3.8:latest', 'qwen3.5:4b', 'gemma4:26b', 'llama3.2:latest'];
  for (const pref of preferredOrder) {
    const found = status.models.find((m) => m.name === pref);
    if (found) return found.name;
  }

  return status.models[0].name;
}

async function callOllama(
  settings: AppSettings,
  options: AIGenerationOptions
): Promise<{ text: string; modelUsed: string }> {
  const baseUrl = (settings.ollamaBaseUrl || 'http://127.0.0.1:11434').replace(/\/+$/, '');
  const model = await resolveBestOllamaModel(settings, options.overrideModel);

  const messages: Array<{ role: string; content: string }> = [];
  if (options.systemInstruction) {
    messages.push({ role: 'system', content: options.systemInstruction });
  }
  messages.push({ role: 'user', content: options.prompt });

  const body: Record<string, any> = {
    model,
    messages,
    stream: false,
    think: false, // Prevents long reasoning delays on Qwen3 / Gemma4 models
    keep_alive: settings.ollamaKeepAlive || '10m',
    options: {
      temperature: options.temperature ?? 0.7,
    },
  };

  if (options.jsonMode) {
    body.format = 'json';
  }

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Ollama respondió HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as { message?: { content?: string }; response?: string };
  const content = data.message?.content ?? data.response ?? '';
  if (!content.trim()) {
    throw new Error(`El modelo local "${model}" en Ollama devolvió una respuesta vacía.`);
  }

  return {
    text: stripThinkingBlocks(content),
    modelUsed: model,
  };
}

async function callGemini(
  settings: AppSettings,
  options: AIGenerationOptions
): Promise<{ text: string; modelUsed: string }> {
  const apiKey =
    settings.geminiApiKey?.trim() ||
    (process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' ? process.env.GEMINI_API_KEY : '') ||
    process.env.API_KEY;

  if (!apiKey) {
    throw new Error('No hay GEMINI_API_KEY configurada.');
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = options.overrideModel || settings.geminiModel || 'gemini-2.5-flash';

  const response = await ai.models.generateContent({
    model,
    contents: options.prompt,
    config: {
      systemInstruction: options.systemInstruction,
      temperature: options.temperature ?? 0.7,
      ...(options.jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  });

  const text = response.text || '';
  if (!text.trim()) {
    throw new Error(`Gemini (${model}) devolvió una respuesta vacía.`);
  }

  return { text: stripThinkingBlocks(text), modelUsed: model };
}

async function callGroq(
  settings: AppSettings,
  options: AIGenerationOptions
): Promise<{ text: string; modelUsed: string }> {
  const apiKey = settings.groqApiKey?.trim() || process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('No hay GROQ_API_KEY configurada.');
  }

  const model = options.overrideModel || settings.groqModel || 'llama-3.3-70b-versatile';
  const messages: Array<{ role: string; content: string }> = [];
  if (options.systemInstruction) {
    messages.push({ role: 'system', content: options.systemInstruction });
  }
  messages.push({ role: 'user', content: options.prompt });

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Groq respondió HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as any;
  const content = data.choices?.[0]?.message?.content || '';
  if (!content.trim()) {
    throw new Error(`Groq (${model}) devolvió una respuesta vacía.`);
  }

  return { text: stripThinkingBlocks(content), modelUsed: model };
}

async function invokeSingleProvider(
  provider: AIProviderId,
  settings: AppSettings,
  options: AIGenerationOptions
): Promise<{ text: string; modelUsed: string }> {
  if (provider === 'ollama') return callOllama(settings, options);
  if (provider === 'groq') return callGroq(settings, options);
  return callGemini(settings, options);
}

export async function generateAIText(options: AIGenerationOptions): Promise<AIGenerationResult> {
  const { settings } = loadDb();
  const primary: AIProviderId = options.overrideProvider || settings.primaryProvider || 'ollama';
  const start = Date.now();

  try {
    const out = await invokeSingleProvider(primary, settings, options);
    return {
      text: out.text,
      providerUsed: primary,
      modelUsed: out.modelUsed,
      latencyMs: Date.now() - start,
    };
  } catch (primaryErr: any) {
    const fallback = settings.fallbackProvider;
    if (
      !options.overrideProvider &&
      fallback &&
      fallback !== 'none' &&
      fallback !== primary
    ) {
      console.warn(
        `[aiProvider] Motor principal (${primary}) falló (${primaryErr.message}). Intentando respaldo (${fallback})...`
      );
      const fallbackStart = Date.now();
      const out = await invokeSingleProvider(fallback, settings, {
        ...options,
        overrideModel: undefined,
      });
      return {
        text: out.text,
        providerUsed: fallback,
        modelUsed: out.modelUsed,
        latencyMs: Date.now() - fallbackStart,
      };
    }
    throw primaryErr;
  }
}

export async function generateAIJson<T>(
  options: AIGenerationOptions,
  fallbackValue: T
): Promise<{ data: T; meta: Omit<AIGenerationResult, 'text'> }> {
  const result = await generateAIText({ ...options, jsonMode: true });
  const parsed = extractJsonPayload<T>(result.text, fallbackValue);
  return {
    data: parsed,
    meta: {
      providerUsed: result.providerUsed,
      modelUsed: result.modelUsed,
      latencyMs: result.latencyMs,
    },
  };
}

