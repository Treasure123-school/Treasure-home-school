import fs from 'fs/promises';
import path from 'path';
import { storage } from '../storage';

// ─── Cloudflare ──────────────────────────────────────────────────────────────

export const CLOUDFLARE_IMAGE_MODELS = [
  { id: '@cf/black-forest-labs/flux-1-schnell', label: 'FLUX Schnell (Fastest — Recommended)' },
  { id: '@cf/bytedance/stable-diffusion-xl-lightning', label: 'SDXL Lightning (Fast)' },
  { id: '@cf/stabilityai/stable-diffusion-xl-base-1.0', label: 'Stable Diffusion XL 1.0' },
  { id: '@cf/lykon/dreamshaper-8-lcm', label: 'Dreamshaper 8 LCM (Fast)' },
  { id: '@cf/runwayml/stable-diffusion-v1-5', label: 'Stable Diffusion v1.5 (Classic)' },
];

export const DEFAULT_CF_IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell';

export const DEFAULT_CF_PROMPT_TEMPLATE =
  'Educational diagram for {topic} in {subject}, class {className}. ' +
  'Clear textbook illustration, white background, labeled, professional, informative, clean.';

export interface CloudflareConfig {
  accountId: string;
  apiToken: string;
  imageModel: string;
  imageGenEnabled: boolean;
  imagePromptTemplate: string;
  steps: number;
}

export async function getCloudflareConfig(): Promise<CloudflareConfig> {
  const allSettings = await storage.getAllSettings();
  const cf: Record<string, string> = {};
  for (const s of allSettings) {
    if (s.key.startsWith('cf.')) cf[s.key.replace('cf.', '')] = s.value;
  }

  return {
    accountId: cf['accountId'] || process.env.CLOUDFLARE_ACCOUNT_ID || '',
    apiToken: cf['apiToken'] || process.env.CLOUDFLARE_API_TOKEN || '',
    imageModel: cf['imageModel'] || DEFAULT_CF_IMAGE_MODEL,
    imageGenEnabled: cf['imageGenEnabled'] !== 'false',
    imagePromptTemplate: cf['imagePromptTemplate'] || DEFAULT_CF_PROMPT_TEMPLATE,
    steps: parseInt(cf['steps'] || '4', 10),
  };
}

export function buildImagePrompt(
  template: string,
  vars: { topic: string; subject?: string; className?: string },
): string {
  return template
    .replace(/\{topic\}/g, vars.topic || '')
    .replace(/\{subject\}/g, vars.subject || 'general')
    .replace(/\{className\}/g, vars.className || 'Secondary School');
}

export async function generateImageWithCloudflare(
  prompt: string,
  config: CloudflareConfig,
): Promise<Buffer> {
  const { accountId, apiToken, imageModel: model } = config;

  if (!accountId || !apiToken) {
    throw new Error(
      'Cloudflare Account ID and API Token are required. ' +
        'Configure them in AI Settings → Image Generation.',
    );
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

  const body: Record<string, unknown> = { prompt };
  if (
    model.includes('flux') ||
    model.includes('dreamshaper') ||
    model.includes('lightning') ||
    model.includes('lcm')
  ) {
    body.num_steps = config.steps || 4;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudflare API error (${response.status}): ${errorText.slice(0, 400)}`);
  }

  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const json = (await response.json()) as {
      result?: { image?: string };
      errors?: { message: string }[];
    };
    if (json.errors && json.errors.length > 0) {
      throw new Error(`Cloudflare AI error: ${json.errors.map((e) => e.message).join(', ')}`);
    }
    if (json.result?.image) {
      return Buffer.from(json.result.image, 'base64');
    }
    throw new Error('Unexpected Cloudflare response format — no image in result');
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    throw new Error('Cloudflare returned an empty image response');
  }
  return Buffer.from(arrayBuffer);
}

export async function testCloudflareConnection(
  config: CloudflareConfig,
): Promise<{ success: boolean; message: string; detail?: string }> {
  try {
    if (!config.accountId || !config.apiToken) {
      return { success: false, message: 'Missing Cloudflare Account ID or API Token' };
    }

    const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${config.imageModel}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: 'a red circle', num_steps: 1 }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 401)
      return { success: false, message: 'Invalid API Token — authentication failed' };
    if (response.status === 403)
      return { success: false, message: 'Forbidden — check account ID and token permissions' };
    if (response.status === 404)
      return { success: false, message: 'Invalid account ID or model not available' };
    if (response.ok)
      return { success: true, message: `Connection successful using ${config.imageModel}` };

    const text = await response.text();
    return {
      success: false,
      message: `Cloudflare returned HTTP ${response.status}`,
      detail: text.slice(0, 300),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, message: `Connection failed: ${msg}` };
  }
}

// ─── NVIDIA Image Generation ──────────────────────────────────────────────────

export const NVIDIA_IMAGE_MODELS = [
  { id: 'black-forest-labs/flux.1-schnell', label: 'FLUX.1 Schnell (Fast — Recommended)', endpoint: 'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell' },
  { id: 'black-forest-labs/flux.1-dev',     label: 'FLUX.1 Dev (Higher Quality)',        endpoint: 'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev' },
  { id: 'stabilityai/sdxl-turbo',           label: 'SDXL Turbo (Fast)',                  endpoint: 'https://ai.api.nvidia.com/v1/genai/stabilityai/sdxl-turbo' },
  { id: 'stabilityai/stable-diffusion-xl',  label: 'Stable Diffusion XL',               endpoint: 'https://ai.api.nvidia.com/v1/genai/stabilityai/stable-diffusion-xl' },
];

export const DEFAULT_NVIDIA_IMAGE_MODEL = 'black-forest-labs/flux.1-schnell';

export interface NvidiaImageConfig {
  apiKey: string;
  imageModel: string;
  imageGenEnabled: boolean;
  width: number;
  height: number;
  steps: number;
  seed: number;
}

function getNvidiaEndpoint(modelId: string): string {
  return NVIDIA_IMAGE_MODELS.find(m => m.id === modelId)?.endpoint ||
    `https://ai.api.nvidia.com/v1/genai/${modelId}`;
}

export async function getNvidiaImageConfig(): Promise<NvidiaImageConfig> {
  const allSettings = await storage.getAllSettings();
  const n: Record<string, string> = {};
  for (const s of allSettings) {
    if (s.key.startsWith('nvidiaImg.')) n[s.key.replace('nvidiaImg.', '')] = s.value;
  }

  // Fall back to the shared nvidia.apiKey (used by text AI) if no separate key set
  const textApiKey = allSettings.find(s => s.key === 'nvidia.apiKey')?.value || '';

  return {
    apiKey: n['apiKey'] || process.env.NVIDIA_API_KEY || textApiKey || '',
    imageModel: n['imageModel'] || DEFAULT_NVIDIA_IMAGE_MODEL,
    imageGenEnabled: n['imageGenEnabled'] !== 'false',
    width: parseInt(n['width'] || '1024', 10),
    height: parseInt(n['height'] || '1024', 10),
    steps: parseInt(n['steps'] || '4', 10),
    seed: parseInt(n['seed'] || '0', 10),
  };
}

export async function generateImageWithNvidia(
  prompt: string,
  config: NvidiaImageConfig,
): Promise<Buffer> {
  const { apiKey, imageModel } = config;

  if (!apiKey) {
    throw new Error(
      'NVIDIA API Key is required. Configure it in AI Settings → Image Generation → NVIDIA.',
    );
  }

  const invokeUrl = getNvidiaEndpoint(imageModel);

  const payload: Record<string, unknown> = {
    prompt,
    width: config.width || 1024,
    height: config.height || 1024,
    seed: config.seed ?? 0,
    steps: config.steps || 4,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);

  let response: Response;
  try {
    response = await fetch(invokeUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`NVIDIA API error (${response.status}): ${errBody.slice(0, 400)}`);
  }

  const json = (await response.json()) as {
    created?: number;
    data?: { b64_json?: string; url?: string; index?: number }[];
    artifacts?: { base64?: string }[];
  };

  // Handle both response shapes NVIDIA uses
  const b64 =
    json.data?.[0]?.b64_json ||
    json.artifacts?.[0]?.base64;

  if (b64) return Buffer.from(b64, 'base64');

  // If NVIDIA returns a URL instead of base64, fetch it
  const imageUrl = json.data?.[0]?.url;
  if (imageUrl) {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`Failed to fetch NVIDIA image URL: ${imgRes.status}`);
    const ab = await imgRes.arrayBuffer();
    return Buffer.from(ab);
  }

  throw new Error(`Unexpected NVIDIA response format: ${JSON.stringify(json).slice(0, 200)}`);
}

export async function testNvidiaImageConnection(
  config: NvidiaImageConfig,
): Promise<{ success: boolean; message: string; detail?: string }> {
  try {
    if (!config.apiKey) {
      return { success: false, message: 'Missing NVIDIA API Key' };
    }

    const invokeUrl = getNvidiaEndpoint(config.imageModel);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);

    let response: Response;
    try {
      response = await fetch(invokeUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ prompt: 'a blue square', steps: 1, width: 512, height: 512, seed: 0 }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 401)
      return { success: false, message: 'Invalid NVIDIA API Key — authentication failed' };
    if (response.status === 402)
      return { success: false, message: 'NVIDIA account credits exhausted or subscription required' };
    if (response.status === 403)
      return { success: false, message: 'Forbidden — check your NVIDIA API key permissions' };
    if (response.status === 404)
      return { success: false, message: `Model not found: ${config.imageModel}` };
    if (response.ok)
      return { success: true, message: `Connected! Model: ${config.imageModel}` };

    const text = await response.text();
    return {
      success: false,
      message: `NVIDIA returned HTTP ${response.status}`,
      detail: text.slice(0, 300),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, message: `Connection failed: ${msg}` };
  }
}

// ─── Active image provider + unified generator ────────────────────────────────

export type ImageProvider = 'cloudflare' | 'nvidia';

export async function getActiveImageProvider(): Promise<ImageProvider> {
  const allSettings = await storage.getAllSettings();
  const p = allSettings.find(s => s.key === 'imgAi.provider')?.value;
  return (p === 'nvidia' ? 'nvidia' : 'cloudflare') as ImageProvider;
}

export async function getActiveImagePromptTemplate(): Promise<string> {
  const allSettings = await storage.getAllSettings();
  return allSettings.find(s => s.key === 'imgAi.promptTemplate')?.value || DEFAULT_CF_PROMPT_TEMPLATE;
}

/**
 * Unified image generator — dispatches to Cloudflare or NVIDIA based on the
 * `imgAi.provider` system setting. Both return a Buffer of PNG image data.
 */
export async function generateImage(
  prompt: string,
  providerOverride?: ImageProvider,
): Promise<{ buffer: Buffer; provider: ImageProvider; model: string }> {
  const provider = providerOverride ?? await getActiveImageProvider();

  if (provider === 'nvidia') {
    const config = await getNvidiaImageConfig();
    if (!config.imageGenEnabled) throw new Error('NVIDIA image generation is disabled by the administrator.');
    if (!config.apiKey) throw new Error('NVIDIA API Key is not configured. Go to AI Settings → Image Generation.');
    const buffer = await generateImageWithNvidia(prompt, config);
    return { buffer, provider: 'nvidia', model: config.imageModel };
  }

  // Default: Cloudflare
  const config = await getCloudflareConfig();
  if (!config.imageGenEnabled) throw new Error('Cloudflare image generation is disabled by the administrator.');
  if (!config.accountId || !config.apiToken)
    throw new Error('Cloudflare Account ID and API Token are not configured. Go to AI Settings → Image Generation.');
  const buffer = await generateImageWithCloudflare(prompt, config);
  return { buffer, provider: 'cloudflare', model: config.imageModel };
}

// ─── File saving helpers ──────────────────────────────────────────────────────

export async function saveImageLocally(
  imageBuffer: Buffer,
  noteId: number | string,
): Promise<string> {
  const filename = `lesson-${noteId}-${Date.now()}.png`;
  const dir = path.resolve('server/uploads/lesson-images');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), imageBuffer);
  return `/uploads/lesson-images/${filename}`;
}

export async function saveImageToCloudinary(
  imageBuffer: Buffer,
  noteId: number | string,
): Promise<string> {
  const { v2: cloudinary } = await import('cloudinary');

  // Ensure Cloudinary is configured (safe to call repeatedly — it's a no-op if already set)
  if (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  ) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'lesson-images',
        public_id: `lesson-${noteId}-${Date.now()}`,
        format: 'png',
        resource_type: 'image',
      },
      (err, result) => {
        if (err) reject(new Error(err.message));
        else resolve(result!.secure_url);
      },
    );
    uploadStream.end(imageBuffer);
  });
}

/**
 * Saves a generated image to Cloudinary (preferred — permanent, CDN-served) when
 * credentials are available, or falls back to local disk.
 *
 * Cloudinary is always used when the three CLOUDINARY_* env vars are set,
 * regardless of NODE_ENV. This ensures images survive server restarts and
 * environment resets in both development and production.
 */
export async function saveGeneratedImage(
  imageBuffer: Buffer,
  noteId: number | string,
): Promise<string> {
  const hasCloudinary =
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET;

  if (hasCloudinary) {
    try {
      const url = await saveImageToCloudinary(imageBuffer, noteId);
      console.log(`[Image AI] Saved to Cloudinary: ${url}`);
      return url;
    } catch (err) {
      console.warn('[Image AI] Cloudinary upload failed, falling back to local:', (err as Error).message);
    }
  }

  const localUrl = await saveImageLocally(imageBuffer, noteId);
  console.log(`[Image AI] Saved locally: ${localUrl}`);
  return localUrl;
}

// ─── Admin config helpers ─────────────────────────────────────────────────────

function maskSecret(secret: string): string {
  if (!secret || secret.length < 8) return '••••••••';
  return `${secret.substring(0, 4)}...${secret.slice(-4)}`;
}

export async function getCloudflareConfigForAdmin(): Promise<{
  accountId: string;
  accountIdMasked: string;
  accountIdFromEnv: boolean;
  apiToken: string;
  apiTokenMasked: string;
  apiTokenFromEnv: boolean;
  imageModel: string;
  imageGenEnabled: boolean;
  imagePromptTemplate: string;
  steps: number;
  availableModels: { id: string; label: string }[];
  activeProvider: ImageProvider;
  sharedPromptTemplate: string;
}> {
  const allSettings = await storage.getAllSettings();
  const cf: Record<string, string> = {};
  for (const s of allSettings) {
    if (s.key.startsWith('cf.')) cf[s.key.replace('cf.', '')] = s.value;
  }

  const storedAccountId = cf['accountId'] || '';
  const envAccountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
  const storedApiToken = cf['apiToken'] || '';
  const envApiToken = process.env.CLOUDFLARE_API_TOKEN || '';

  const activeProvider = (allSettings.find(s => s.key === 'imgAi.provider')?.value || 'cloudflare') as ImageProvider;
  const sharedPromptTemplate = allSettings.find(s => s.key === 'imgAi.promptTemplate')?.value || DEFAULT_CF_PROMPT_TEMPLATE;

  return {
    accountId: '',
    accountIdMasked: storedAccountId
      ? maskSecret(storedAccountId)
      : envAccountId
        ? maskSecret(envAccountId)
        : '',
    accountIdFromEnv: !storedAccountId && !!envAccountId,
    apiToken: '',
    apiTokenMasked: storedApiToken
      ? maskSecret(storedApiToken)
      : envApiToken
        ? maskSecret(envApiToken)
        : '',
    apiTokenFromEnv: !storedApiToken && !!envApiToken,
    imageModel: cf['imageModel'] || DEFAULT_CF_IMAGE_MODEL,
    imageGenEnabled: cf['imageGenEnabled'] !== 'false',
    imagePromptTemplate: cf['imagePromptTemplate'] || DEFAULT_CF_PROMPT_TEMPLATE,
    steps: parseInt(cf['steps'] || '4', 10),
    availableModels: CLOUDFLARE_IMAGE_MODELS,
    activeProvider,
    sharedPromptTemplate,
  };
}

export async function getNvidiaImageConfigForAdmin(): Promise<{
  apiKey: string;
  apiKeyMasked: string;
  apiKeyFromEnv: boolean;
  apiKeyFromTextAI: boolean;
  imageModel: string;
  imageGenEnabled: boolean;
  width: number;
  height: number;
  steps: number;
  seed: number;
  availableModels: { id: string; label: string }[];
}> {
  const allSettings = await storage.getAllSettings();
  const n: Record<string, string> = {};
  for (const s of allSettings) {
    if (s.key.startsWith('nvidiaImg.')) n[s.key.replace('nvidiaImg.', '')] = s.value;
  }

  const storedKey = n['apiKey'] || '';
  const envKey = process.env.NVIDIA_API_KEY || '';
  const textAiKey = allSettings.find(s => s.key === 'nvidia.apiKey')?.value || '';

  return {
    apiKey: '',
    apiKeyMasked: storedKey
      ? maskSecret(storedKey)
      : envKey
        ? maskSecret(envKey)
        : textAiKey
          ? maskSecret(textAiKey)
          : '',
    apiKeyFromEnv: !storedKey && !!envKey,
    apiKeyFromTextAI: !storedKey && !envKey && !!textAiKey,
    imageModel: n['imageModel'] || DEFAULT_NVIDIA_IMAGE_MODEL,
    imageGenEnabled: n['imageGenEnabled'] !== 'false',
    width: parseInt(n['width'] || '1024', 10),
    height: parseInt(n['height'] || '1024', 10),
    steps: parseInt(n['steps'] || '4', 10),
    seed: parseInt(n['seed'] || '0', 10),
    availableModels: NVIDIA_IMAGE_MODELS.map(m => ({ id: m.id, label: m.label })),
  };
}
