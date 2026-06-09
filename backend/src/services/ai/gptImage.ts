/**
 * GPT Image — AI Model Personalization Engine
 *
 * Uses OpenAI gpt-image-1 (images.edit with multi-image input) to replace
 * the identity of the fashion model in a product photograph while preserving
 * every other element of the image exactly: clothing, pose, lighting,
 * background, styling, and composition.
 *
 * This is NOT virtual try-on / garment transfer.
 * This IS identity replacement in professional fashion photography.
 */

import OpenAI from 'openai';
import sharp from 'sharp';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { uploadResultBuffer } from '../storage/images';

// ---------------------------------------------------------------------------
// Engine registry — abstraction layer for future model additions
// ---------------------------------------------------------------------------

export type PersonalizeEngine = 'gpt-image-1' | 'flux-kontext-pro' | 'seedream';

export interface PersonalizeInput {
  /** URL or buffer of the product photograph containing the original model. */
  productImageUrl: string;
  /** Buffer of the shopper's reference photo (uploaded once per session). */
  referenceImageBuffer: Buffer;
  /** Engine to use for generation (default: gpt-image-1). */
  engine?: PersonalizeEngine;
  /** Optional user ID for storage namespacing. */
  userId?: string;
}

export interface PersonalizeOutput {
  /** Storage path of the generated personalized image. */
  resultPath: string;
  /** Which engine produced this result. */
  engine: PersonalizeEngine;
  /** Duration in milliseconds. */
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Model replacement prompt
// ---------------------------------------------------------------------------

const MODEL_REPLACEMENT_PROMPT = `Replace the fashion model in this product photograph with the person shown in the reference photo.

Preserve EXACTLY:
- The clothing, garment details, textures, branding, and accessories
- The pose and body positioning of the original model
- The camera angle and framing
- The facial expression style and overall mood
- The lighting, shadows, and reflections
- The background, environment, and composition
- The professional photography quality and color grading
- The image dimensions and aspect ratio

Only change: the identity of the model to match the uploaded reference person.

The result must appear as a professional fashion campaign photograph shot by the original brand, with the same production quality. Do not redesign or alter the clothing in any way. Do not change proportions unnecessarily. The shopper should appear naturally wearing the exact garment shown in the product image.`;

// ---------------------------------------------------------------------------
// GPT Image (gpt-image-1) implementation
// ---------------------------------------------------------------------------

function getOpenAIClient(): OpenAI {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured. Add it to your backend .env file.');
  }
  return new OpenAI({ apiKey });
}

/** Fetch a product image URL and return it as a Buffer (with safety guards). */
async function fetchProductImageBuffer(url: string): Promise<Buffer> {
  const MAX_BYTES = 20 * 1024 * 1024; // 20 MB cap

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Invalid product image URL');
  }
  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    throw new Error('Product image URL must use HTTP or HTTPS');
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch product image: ${res.status} ${res.statusText}`);
  }

  const contentLength = res.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
    throw new Error('Product image exceeds size limit');
  }

  const raw = await res.arrayBuffer();
  if (raw.byteLength > MAX_BYTES) {
    throw new Error('Product image exceeds size limit after download');
  }

  return Buffer.from(raw);
}

/** Convert a buffer to a PNG and wrap it in a File object for the OpenAI SDK. */
async function bufferToPngFile(buffer: Buffer, name: string): Promise<File> {
  const pngBuffer = await sharp(buffer)
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();

  return new File([pngBuffer], name, { type: 'image/png' });
}

async function runGptImage1(input: PersonalizeInput): Promise<PersonalizeOutput> {
  const startMs = Date.now();

  logger.info('GPT Image personalization: fetching product image', {
    url: input.productImageUrl.slice(0, 80),
  });

  const [productBuffer, referenceBuffer] = await Promise.all([
    fetchProductImageBuffer(input.productImageUrl),
    Promise.resolve(input.referenceImageBuffer),
  ]);

  // Convert both images to PNG Files for the multimodal edit API
  const [productFile, referenceFile] = await Promise.all([
    bufferToPngFile(productBuffer, 'product.png'),
    bufferToPngFile(referenceBuffer, 'reference.png'),
  ]);

  logger.info('GPT Image personalization: calling OpenAI images.edit');
  const openai = getOpenAIClient();

  const response = await openai.images.edit({
    model: 'gpt-image-1',
    image: [productFile, referenceFile],
    prompt: MODEL_REPLACEMENT_PROMPT,
    n: 1,
    size: '1024x1024',
  });

  const imageData = response.data?.[0];
  if (!imageData) {
    throw new Error('GPT Image returned no image data');
  }

  // gpt-image-1 returns base64 JSON
  const b64 = imageData.b64_json;
  if (!b64) {
    throw new Error('GPT Image response missing b64_json');
  }

  const resultBuffer = Buffer.from(b64, 'base64');
  const resultPath = await uploadResultBuffer(resultBuffer, input.userId);

  const durationMs = Date.now() - startMs;
  logger.info('GPT Image personalization: complete', { durationMs, resultPath });

  return { resultPath, engine: 'gpt-image-1', durationMs };
}

// ---------------------------------------------------------------------------
// Public entry point — engine dispatcher
// ---------------------------------------------------------------------------

export async function generatePersonalizedModel(
  input: PersonalizeInput
): Promise<PersonalizeOutput> {
  const engine: PersonalizeEngine = input.engine ?? 'gpt-image-1';

  switch (engine) {
    case 'gpt-image-1':
      return runGptImage1(input);

    case 'flux-kontext-pro':
    case 'seedream':
      throw new Error(`Engine "${engine}" is planned for a future release. Use gpt-image-1 for now.`);

    default:
      throw new Error(`Unknown personalization engine: ${String(engine)}`);
  }
}

export function isPersonalizationEnabled(): boolean {
  return Boolean(env.OPENAI_API_KEY);
}
