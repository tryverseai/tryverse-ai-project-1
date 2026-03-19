import Replicate from 'replicate';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { buildTryOnPrompt } from './promptBuilder';
import type { ProductCategory } from '../../types';

const replicate = new Replicate({ auth: env.REPLICATE_API_TOKEN });

export interface VtonInput {
  personImageUrl: string;
  productImageUrl: string;
  category: ProductCategory;
  productDescription?: string;
  /** For dynamic prompt building (flux-kontext) */
  bodyDetected?: boolean;
  poseType?: 'full_body' | 'half_body' | 'face_only';
}

export interface VtonOutput {
  resultUrl: string;
  processingTimeMs: number;
  modelUsed: string;
  category: ProductCategory;
}

// ─── Category → Model routing ────────────────────────────────────────────────

function getModelConfig(category: ProductCategory): {
  model: string;
  buildInput: (input: VtonInput) => Record<string, unknown>;
} {
  switch (category) {
    // ── Clothing — IDM-VTON: fabric-aware, pose-aligned garment try-on ──────
    case 'clothing':
      return {
        model: env.REPLICATE_MODEL_CLOTHING,
        buildInput: (input) => ({
          human_img: input.personImageUrl,
          garm_img: input.productImageUrl,
          garment_des: input.productDescription || 'clothing item',
          is_checked: true,
          is_checked_crop: false,
          denoise_steps: 30,
          seed: randomSeed(),
        }),
      };

    // ── Bags — FASHN: accessory overlay with body context ────────────────────
    case 'bags':
      return {
        model: env.REPLICATE_MODEL_ACCESSORIES,
        buildInput: (input) => ({
          model_image: input.personImageUrl,
          garment_image: input.productImageUrl,
          category: 'tops',
          adjust_hands: false,
          restore_background: true,
          restore_clothes: true,
          garment_description: input.productDescription || 'bag / handbag / accessory',
          long_top: false,
        }),
      };

    // ── Glasses — FASHN: face-region overlay ─────────────────────────────────
    case 'glasses':
      return {
        model: env.REPLICATE_MODEL_ACCESSORIES,
        buildInput: (input) => ({
          model_image: input.personImageUrl,
          garment_image: input.productImageUrl,
          category: 'tops',
          adjust_hands: false,
          restore_background: true,
          restore_clothes: true,
          garment_description: input.productDescription || 'glasses / eyewear',
          long_top: false,
        }),
      };
  }
}

// ─── Main inference function ─────────────────────────────────────────────────

const MAX_RETRIES = 4;  // 5 attempts total
const DEFAULT_RATE_LIMIT_WAIT_MS = 15_000;  // 15s when retry_after not in response

/** Minimum gap between Replicate API calls (burst of 1 = only 1 at a time) */
let lastReplicateCallAt = 0;
const MIN_GAP_MS = 12_000;

/** Call before any Replicate API request to respect rate limits (burst of 1). */
export async function waitForReplicateSlot(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastReplicateCallAt;
  if (elapsed < MIN_GAP_MS) {
    const wait = MIN_GAP_MS - elapsed;
    logger.info('Replicate throttle: waiting before next call', { waitMs: wait });
    await new Promise((r) => setTimeout(r, wait));
  }
  lastReplicateCallAt = Date.now();
}

function parseRetryAfter(err: unknown): number {
  const msg = err instanceof Error ? err.message : String(err);
  const match = msg.match(/"retry_after"\s*:\s*(\d+)/);
  if (match) return (parseInt(match[1], 10) + 2) * 1000;
  return DEFAULT_RATE_LIMIT_WAIT_MS;
}

/**
 * Flux Kontext: prompt-based multi-image try-on.
 * Uses dynamic prompts (user never sees them).
 */
export async function runFluxKontextInference(input: VtonInput): Promise<VtonOutput> {
  const startTime = Date.now();
  const model = env.REPLICATE_MODEL_FLUX_KONTEXT;
  const prompt = buildTryOnPrompt({
    category: input.category,
    productDescription: input.productDescription,
    bodyDetected: input.bodyDetected ?? true,
    poseType: input.poseType,
    garmentHint: input.productDescription,
  });

  logger.info('Starting flux-kontext inference', { category: input.category, promptLength: prompt.length });

  await waitForReplicateSlot();

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const output = await replicate.run(
        model as `${string}/${string}:${string}`,
        {
          input: {
            prompt,
            input_image_1: input.personImageUrl,
            input_image_2: input.productImageUrl,
            aspect_ratio: 'match_input_image',
          },
        }
      );

      const processingTimeMs = Date.now() - startTime;
      const resultUrl = extractResultUrl(output);

      if (!resultUrl || !resultUrl.startsWith('http')) {
        throw new Error('Invalid output URL from flux-kontext');
      }

      logger.info('Flux-kontext inference complete', {
        category: input.category,
        processingTimeMs,
      });
      return {
        resultUrl,
        processingTimeMs,
        modelUsed: 'flux-kontext',
        category: input.category,
      };
    } catch (err: unknown) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const is429 = msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('throttled');

      if (is429 && attempt <= MAX_RETRIES) {
        const waitMs = parseRetryAfter(err);
        logger.warn('Replicate rate limited, retrying', { attempt, waitMs });
        await sleep(waitMs);
      } else {
        throw new Error(
          is429
            ? 'AI service is busy. Please try again in about 30 seconds.'
            : `AI inference failed: ${msg}`
        );
      }
    }
  }
  throw lastError;
}

/**
 * Runs the appropriate AI try-on inference for the given category.
 * Uses flux-kontext when REPLICATE_USE_FLUX_KONTEXT=true, otherwise legacy models.
 * Retries automatically on 429 (rate limit) with backoff.
 */
export async function runVtonInference(input: VtonInput): Promise<VtonOutput> {
  if (env.REPLICATE_USE_FLUX_KONTEXT) {
    return runFluxKontextInference(input);
  }

  const startTime = Date.now();
  const { model, buildInput } = getModelConfig(input.category);
  const modelShortName = model.split('/')[1]?.split(':')[0] || model;

  logger.info('Starting inference', { category: input.category, model: modelShortName });

  await waitForReplicateSlot();

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const output = await replicate.run(
        model as `${string}/${string}:${string}`,
        { input: buildInput(input) }
      );

      const processingTimeMs = Date.now() - startTime;
      const resultUrl = extractResultUrl(output);

      if (!resultUrl || !resultUrl.startsWith('http')) {
        throw new Error(`Invalid output URL from ${modelShortName}`);
      }

      logger.info('Inference complete', { category: input.category, model: modelShortName, processingTimeMs });
      return { resultUrl, processingTimeMs, modelUsed: modelShortName, category: input.category };
    } catch (err: unknown) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const is429 = msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('throttled');

      if (is429 && attempt <= MAX_RETRIES) {
        const waitMs = parseRetryAfter(err);
        logger.warn('Replicate rate limited, retrying', { attempt, waitMs, maxRetries: MAX_RETRIES });
        await sleep(waitMs);
      } else {
        logger.error('Inference failed', { category: input.category, error: msg });
        throw new Error(
          is429
            ? `AI service is busy (rate limit). Please try again in about 30 seconds.`
            : `AI inference failed for ${input.category}: ${msg}`
        );
      }
    }
  }
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns metadata about all active product categories.
 */
export function getSupportedCategories(): Array<{
  id: ProductCategory;
  label: string;
  description: string;
  modelFamily: string;
  active: boolean;
}> {
  return [
    { id: 'clothing', label: 'Clothing',  description: 'Tops, bottoms, dresses, jackets, outerwear', modelFamily: 'IDM-VTON', active: true },
    { id: 'bags',     label: 'Bags',      description: 'Handbags, backpacks, clutches, totes',        modelFamily: 'FASHN',    active: true },
    { id: 'glasses',  label: 'Eyewear',   description: 'Sunglasses, prescription glasses, goggles',   modelFamily: 'FASHN',    active: true },
  ];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function randomSeed(): number {
  return Math.floor(Math.random() * 999999);
}

function extractResultUrl(output: unknown): string {
  if (Array.isArray(output)) return String(output[0]);
  if (output && typeof output === 'object') {
    if ('url' in output && typeof (output as { url: unknown }).url === 'function') {
      return String((output as { url: () => string }).url());
    }
    if ('url' in output) return String((output as { url: unknown }).url);
  }
  return String(output);
}
