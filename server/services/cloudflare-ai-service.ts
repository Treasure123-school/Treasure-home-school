import fs from 'fs/promises';
import path from 'path';
import { storage } from '../storage';

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

export async function saveGeneratedImage(
  imageBuffer: Buffer,
  noteId: number | string,
): Promise<string> {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    const hasCloudinary =
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET;

    if (hasCloudinary) {
      try {
        return await saveImageToCloudinary(imageBuffer, noteId);
      } catch (err) {
        console.warn('[CF Image] Cloudinary upload failed, falling back to local:', (err as Error).message);
      }
    }
  }

  return saveImageLocally(imageBuffer, noteId);
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
      return {
        success: false,
        message: 'Forbidden — check account ID and token permissions',
      };
    if (response.status === 404)
      return {
        success: false,
        message: 'Invalid account ID or model not available',
      };
    if (response.ok)
      return {
        success: true,
        message: `Connection successful using ${config.imageModel}`,
      };

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
  };
}
