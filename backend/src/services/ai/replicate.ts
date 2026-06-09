import Replicate from 'replicate';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { buildTryOnPrompt } from './promptBuilder';
import {
  buildIdmGarmentDescription,
  buildFashnClothingDescription,
  inferIdmVtonGarmentCategory,
  inferFashnGarmentCategory,
  inferIsLongGarment,
  type IdmVtonGarmentCategory,
} from './garmentDescriptor';
import { isFashnDirectEnabled, runFashnDirect } from './fashn';

import type { ProductCategory } from '../../types';

const replicate = new Replicate({ auth: env.REPLICATE_API_TOKEN });

export interface VtonInput {
  personImageUrl: string;
  productImageUrl: string;
  category: ProductCategory;
  productDescription?: string;
  /** Optimized product image height ÷ width — auto gown/dress hint for IDM-VTON. */
  productHeightOverWidth?: number;
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

/** Clothing-only: FASHN (default), IDM-VTON, or Flux Kontext hybrid routing. */
export type ClothingTryOnEngine = 'idm_vton' | 'flux_kontext' | 'fashn';

/** Viktorfa OOT / tryon-diffusion style APIs use model_image + garment_image (not IDM fields). */
function clothingModelInputKind(modelRef: string): 'idm_vton' | 'oot_style' {
  const m = modelRef.toLowerCase();
  if (m.includes('oot_diffusion') || m.includes('tryon-diffusion')) {
    return 'oot_style';
  }
  return 'idm_vton';
}

/** All active categories use the clothing try-on pipeline. */
function isClothingCategory(category: ProductCategory): boolean {
  return (
    category === 'clothing' ||
    category === 'tops' ||
    category === 'bottoms' ||
    category === 'dresses' ||
    category === 'one-pieces'
  );
}

function getModelConfig(category: ProductCategory): {
  model: string;
  buildInput: (input: VtonInput) => Record<string, unknown>;
} {
  // All clothing subcategories route through the same IDM-VTON / FASHN clothing pipeline.
  switch (category) {
    case 'clothing':
    case 'tops':
    case 'bottoms':
    case 'dresses':
    case 'one-pieces':
      return {
        model: env.REPLICATE_MODEL_CLOTHING,
        buildInput: (input) => {
          const modelRef = env.REPLICATE_MODEL_CLOTHING;
          const idmSlot: IdmVtonGarmentCategory =
            category === 'dresses' || category === 'one-pieces'
              ? 'dresses'
              : category === 'bottoms'
                ? 'upper_body'
                : category === 'tops'
                  ? 'upper_body'
                  : inferIdmVtonGarmentCategory(
                      input.productHeightOverWidth,
                      input.productDescription
                    );
          const isDresses = idmSlot === 'dresses';

          if (clothingModelInputKind(modelRef) === 'oot_style') {
            return {
              model_image: input.personImageUrl,
              garment_image: input.productImageUrl,
              steps: isDresses ? 35 : 25,
              guidance_scale: isDresses ? 3.5 : 2,
              seed: randomSeed(),
            };
          }

          return {
            human_img: input.personImageUrl,
            garm_img: input.productImageUrl,
            /** Replicate defaults to upper_body; must match long garments or IDM crops to torso and seams at the waist. */
            category: idmSlot,
            garment_des: buildIdmGarmentDescription(input.productDescription, {
              productHeightOverWidth: input.productHeightOverWidth,
              idmCategory: idmSlot,
            }),
            is_checked: true,
            is_checked_crop: !isDresses,
            denoise_steps: isDresses ? 60 : env.IDM_VTON_DENOISE_STEPS,
            guidance_scale: isDresses ? 3.5 : env.IDM_VTON_GUIDANCE_SCALE,
            seed: randomSeed(),
          };
        },
      };
  }
}

// ─── Main inference ──────────────────────────────────────────────────────────

const MAX_RETRIES = 4;
const DEFAULT_RATE_LIMIT_WAIT_MS = 15_000;

let lastReplicateCallAt = 0;

/** Call before any Replicate API request to respect rate limits (burst of 1). */
export async function waitForReplicateSlot(): Promise<void> {
  const gap = env.REPLICATE_MIN_GAP_MS;
  const now = Date.now();
  const elapsed = now - lastReplicateCallAt;
  if (elapsed < gap) {
    const wait = gap - elapsed;
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
    productHeightOverWidth: input.productHeightOverWidth,
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

async function replicateRunWithRetry(
  input: VtonInput,
  model: string,
  buildInput: (input: VtonInput) => Record<string, unknown>,
  modelShortName: string
): Promise<VtonOutput> {
  const startTime = Date.now();
  await waitForReplicateSlot();

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const output = await replicate.run(model as `${string}/${string}:${string}`, {
        input: buildInput(input),
      });

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

async function runIdmClothing(input: VtonInput): Promise<VtonOutput> {
  const { model, buildInput } = getModelConfig('clothing');
  const modelShortName = model.split('/')[1]?.split(':')[0] || model;
  logger.info('Starting IDM-VTON', { category: 'clothing', model: modelShortName });
  return replicateRunWithRetry(input, model, buildInput, modelShortName);
}

/** FASHN Try-On for clothing — direct FASHN API when key is set, Replicate otherwise. */
async function runFashnClothing(input: VtonInput): Promise<VtonOutput> {
  const inferOpts = { useAutoForGenericDescription: env.TRYON_FASHN_CATEGORY_AUTO };

  /**
   * Payload builder shared by both direct API and Replicate paths.
   * For direct API, sanitiseForDirectApi (in fashn.ts) strips Replicate-only
   * fields before sending. Those fields are kept here solely for the Replicate fallback.
   */
  const buildPayload = (inp: VtonInput): Record<string, unknown> => {
    const fashnCat = inferFashnGarmentCategory(inp.productHeightOverWidth, inp.productDescription, inferOpts);
    // long_top: only relevant for Replicate path (Replicate fashn/tryon); stripped for direct API
    const longTop =
      fashnCat === 'one-pieces' ||
      fashnCat === 'auto' ||
      (fashnCat === 'tops' && inferIsLongGarment(inp.productHeightOverWidth, inp.productDescription));
    return {
      model_image: inp.personImageUrl,
      garment_image: inp.productImageUrl,
      category: fashnCat,
      // Fields below are Replicate-only; sanitiseForDirectApi strips them for the direct API
      adjust_hands: false,
      restore_background: true,
      restore_clothes: env.TRYON_FASHN_RESTORE_CLOTHES,
      garment_description: buildFashnClothingDescription(inp.productDescription, {
        productHeightOverWidth: inp.productHeightOverWidth,
        fashnCategory: fashnCat,
      }),
      long_top: longTop,
    };
  };

  if (isFashnDirectEnabled()) {
    const fashnCat = inferFashnGarmentCategory(
      input.productHeightOverWidth,
      input.productDescription,
      inferOpts
    );
    logger.info('Starting FASHN clothing (direct API)', { fashnCategory: fashnCat });
    return runFashnDirect(input, buildPayload, 'fashn-clothing');
  }

  // Replicate fallback when no direct FASHN key is configured
  const model = env.REPLICATE_MODEL_ACCESSORIES;
  const modelShortName = model.split('/')[1]?.split(':')[0] || model;
  const fashnCat = inferFashnGarmentCategory(
    input.productHeightOverWidth,
    input.productDescription,
    inferOpts
  );
  logger.info('Starting FASHN clothing (Replicate)', { model: modelShortName, fashnCategory: fashnCat });
  return replicateRunWithRetry(input, model, buildPayload, modelShortName);
}

/**
 * Multi-route try-on: FASHN (accessories), IDM-VTON (clothing default), Flux Kontext (full-body dresses when enabled).
 * When `REPLICATE_USE_FLUX_KONTEXT=true`, all clothing uses Flux (legacy single-toggle).
 */
export async function runVtonInference(
  input: VtonInput,
  opts?: { clothingEngine?: ClothingTryOnEngine }
): Promise<VtonOutput> {
  if (env.REPLICATE_USE_FLUX_KONTEXT) {
    return runFluxKontextInference(input);
  }

  if (isClothingCategory(input.category)) {
    const engine =
      opts?.clothingEngine ?? (env.TRYON_CLOTHING_USE_FASHN ? 'fashn' : 'idm_vton');
    if (engine === 'fashn') {
      try {
        return await runFashnClothing(input);
      } catch (err) {
        if (env.TRYON_FASHN_FALLBACK_IDM) {
          logger.warn('tryon.engine: FASHN clothing failed; falling back to IDM-VTON', {
            error: err instanceof Error ? err.message : String(err),
          });
          return runIdmClothing(input);
        }
        throw err instanceof Error ? err : new Error(String(err));
      }
    }
    if (engine === 'flux_kontext') {
      try {
        return await runFluxKontextInference(input);
      } catch (err) {
        if (env.TRYON_FULLBODY_FLUX_FALLBACK_IDM) {
          logger.warn('tryon.engine: Flux Kontext failed; falling back to IDM-VTON', {
            error: err instanceof Error ? err.message : String(err),
          });
          return runIdmClothing(input);
        }
        throw err instanceof Error ? err : new Error(String(err));
      }
    }
    return runIdmClothing(input);
  }

  const { model, buildInput } = getModelConfig(input.category);
  const modelShortName = model.split('/')[1]?.split(':')[0] || model;
  logger.info('Starting inference (Replicate)', { category: input.category, model: modelShortName });
  return replicateRunWithRetry(input, model, buildInput, modelShortName);
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
    {
      id: 'clothing',
      label: 'Clothing',
      description: 'General apparel — tops, bottoms, dresses, one-pieces',
      modelFamily: env.TRYON_CLOTHING_USE_FASHN ? 'FASHN' : 'IDM-VTON',
      active: true,
    },
    { id: 'tops', label: 'Tops', description: 'Shirts, blouses, t-shirts, jackets', modelFamily: env.TRYON_CLOTHING_USE_FASHN ? 'FASHN' : 'IDM-VTON', active: true },
    { id: 'bottoms', label: 'Bottoms', description: 'Pants, skirts, shorts', modelFamily: env.TRYON_CLOTHING_USE_FASHN ? 'FASHN' : 'IDM-VTON', active: true },
    { id: 'dresses', label: 'Dresses', description: 'Dresses and gowns', modelFamily: env.TRYON_CLOTHING_USE_FASHN ? 'FASHN' : 'IDM-VTON', active: true },
    { id: 'one-pieces', label: 'One-pieces', description: 'Jumpsuits, rompers, overalls', modelFamily: env.TRYON_CLOTHING_USE_FASHN ? 'FASHN' : 'IDM-VTON', active: true },
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
