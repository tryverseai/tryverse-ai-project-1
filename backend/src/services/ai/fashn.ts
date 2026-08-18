/**
 * Direct FASHN AI API client (https://api.fashn.ai/v1)
 *
 * When FASHN_API_KEY is set, clothing FASHN try-ons call the FASHN API directly
 * instead of routing through Replicate.
 * This removes the Replicate intermediary, reducing latency and cost.
 *
 * Flow:
 *   1. POST /v1/run   → receives { id }
 *   2. Poll GET /v1/status/{id} until status === 'completed' | 'failed'
 *   3. Return first URL from output array
 */

import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { inferFashnGarmentCategory } from './garmentDescriptor';
import type { VtonInput, VtonOutput } from './replicate';

const FASHN_BASE_URL = 'https://api.fashn.ai/v1';

/** How long to wait between status polls (ms). */
const POLL_INTERVAL_MS = 3_000;
/** Maximum total wait time for a FASHN prediction (ms). */
const POLL_TIMEOUT_MS = 180_000;

interface FashnRunResponse {
  id?: string;
  error?: string;
}

interface FashnStatusResponse {
  id: string;
  status: 'starting' | 'in_queue' | 'processing' | 'completed' | 'failed';
  output?: string[];
  error?: string | null;
}

/** Returns true when a direct FASHN API key is configured. */
export function isFashnDirectEnabled(): boolean {
  return Boolean(env.FASHN_API_KEY);
}

function fashnHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${env.FASHN_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Wrap a flat inputs payload in the envelope the FASHN direct API requires:
 *   { model_name: "fashn/tryon", inputs: { model_image, garment_image, ... } }
 *
 * `modelName` defaults to the existing single-garment model so every current call site keeps its
 * exact behavior; only the Outfit Builder path (`runFashnOutfit`) passes a different value.
 */
function wrapForDirectApi(
  inputs: Record<string, unknown>,
  modelName: string = 'tryon-v1.6'
): Record<string, unknown> {
  return {
    model_name: modelName,
    inputs,
  };
}

/** Start a FASHN prediction. Returns the prediction ID. */
async function startFashnRun(body: Record<string, unknown>, modelName?: string): Promise<string> {
  const payload = wrapForDirectApi(body, modelName);
  try {
    const response = await fetch(`${FASHN_BASE_URL}/run`, {
      method: 'POST',
      headers: fashnHeaders(),
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    logger.info('FASHN API response', {
      status: response.status,
      statusText: response.statusText,
      body: responseText,
    });

    if (!response.ok) {
      throw new Error(`FASHN API error ${response.status}: ${responseText}`);
    }

    let data: FashnRunResponse;
    try {
      data = JSON.parse(responseText) as FashnRunResponse;
    } catch {
      throw new Error(`FASHN API invalid JSON: ${responseText}`);
    }

    if (data.error) {
      throw new Error(`FASHN run error: ${data.error}`);
    }
    if (!data.id) {
      throw new Error(`FASHN API returned no prediction ID: ${responseText}`);
    }

    return data.id;
  } catch (err) {
    logger.error('FASHN startRun failed', { error: String(err), payload });
    throw err;
  }
}

/**
 * Poll FASHN status until the prediction finishes. Returns the output URL.
 * `timeoutMs` defaults to POLL_TIMEOUT_MS (unchanged for every existing call site); video
 * generation can run longer than a still-image prediction, so `runFashnImageToVideo` passes a
 * longer override rather than risk a slow-but-succeeding video job being cut off early.
 */
async function pollFashnStatus(predictionId: string, timeoutMs: number = POLL_TIMEOUT_MS): Promise<string> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    const res = await fetch(`${FASHN_BASE_URL}/status/${predictionId}`, {
      headers: fashnHeaders(),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`FASHN /status failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as FashnStatusResponse;

    if (data.status === 'completed') {
      const url = data.output?.[0];
      if (!url || !url.startsWith('http')) {
        throw new Error('FASHN completed but returned no valid output URL');
      }
      return url;
    }

    if (data.status === 'failed') {
      const reason =
        typeof data.error === 'string'
          ? data.error
          : data.error
            ? JSON.stringify(data.error)
            : 'unknown reason';
      throw new Error(`FASHN prediction failed: ${reason}`);
    }

    logger.debug('FASHN prediction in progress', { id: predictionId, status: data.status });
  }

  throw new Error(`FASHN prediction timed out after ${timeoutMs / 1000}s`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Normalize client/category hints to FASHN slots. Valid slots pass through; unknown hints
 * reuse {@link inferFashnGarmentCategory} so portrait product crops alone never force `one-pieces`.
 */
export function mapToFashnCategory(
  category: string,
  productDescription: string,
  productHeightOverWidth?: number
): 'tops' | 'bottoms' | 'one-pieces' | 'auto' {
  const cat = (category || '').toLowerCase().trim();
  if (cat === 'tops' || cat === 'bottoms' || cat === 'one-pieces' || cat === 'auto') {
    return cat;
  }
  return inferFashnGarmentCategory(productHeightOverWidth, productDescription, {
    useAutoForGenericDescription: env.TRYON_FASHN_CATEGORY_AUTO,
  });
}

/**
 * Build FASHN direct API inputs for `tryon-v1.6`.
 *
 * The hosted API rejects many Replicate-era keys (400 "not allowed"), e.g.
 * adjust_hands, restore_background, restore_clothes, garment_description, long_top,
 * nsfw_filter, flat_lay. Do not spread `rawPayload` — only send supported fields.
 *
 * Category still follows the same heuristics as Replicate (via rawPayload.category hint +
 * mapToFashnCategory).
 */
export function buildFashnDirectInputs(
  input: VtonInput,
  rawPayload: Record<string, unknown>
): Record<string, unknown> {
  const categoryHint = String(rawPayload['category'] ?? input.category ?? '');
  const fashnCategory = mapToFashnCategory(
    categoryHint,
    input.productDescription || '',
    input.productHeightOverWidth
  );

  return {
    model_image: input.personImageUrl,
    garment_image: input.productImageUrl,
    category: fashnCategory,
    mode: 'quality',
    garment_photo_type: 'auto',
    segmentation_free: env.FASHN_SEGMENTATION_FREE,
  };
}

/**
 * Run a FASHN try-on via the direct FASHN AI API (clothing).
 *
 * @param input        - Canonical VtonInput (person + product URLs, category, etc.)
 * @param buildPayload - Category-specific function that maps VtonInput → FASHN request body
 * @param label        - Short label for logging (e.g. 'fashn-clothing')
 */
export async function runFashnDirect(
  input: VtonInput,
  buildPayload: (inp: VtonInput) => Record<string, unknown>,
  label: string
): Promise<VtonOutput> {
  const startTime = Date.now();

  const rawPayload = buildPayload(input);
  const payload = buildFashnDirectInputs(input, rawPayload);

  logger.info('FASHN direct: starting prediction', {
    label,
    category: input.category,
    fashnCategory: payload['category'],
    segmentationFree: payload['segmentation_free'],
    mode: payload['mode'],
    garmentPhotoType: payload['garment_photo_type'],
  });

  const predictionId = await startFashnRun(payload);

  logger.info('FASHN direct: prediction started', { label, predictionId });

  const resultUrl = await pollFashnStatus(predictionId);

  const processingTimeMs = Date.now() - startTime;

  logger.info('FASHN direct: prediction complete', {
    label,
    predictionId,
    processingTimeMs,
  });

  return {
    resultUrl,
    processingTimeMs,
    modelUsed: 'fashn-direct',
    category: input.category,
  };
}

/** @deprecated Use {@link runFashnDirect}; kept as an alias for older call sites. */
export const runFashnTryOn = runFashnDirect;

/** FASHN model used for the Outfit Builder (product + prompt → full outfit). */
const OUTFIT_MODEL_NAME = env.FASHN_OUTFIT_MODEL_NAME;

export interface FashnOutfitOutput {
  resultUrl: string;
  processingTimeMs: number;
}

/**
 * Runs a FASHN Try-On Max prediction for the Outfit Builder: a single pre-composited flat-lay
 * image (built by `outfitComposite.ts` from the shopper's/brand's selected products) plus a
 * generated styling prompt, applied to one model photo — the same mechanism proven by hand
 * (multiple garments combined into one picture-frame image, not multiple API inputs, since
 * Try-On Max — like tryon-v1.6 — accepts exactly one product image per request).
 *
 * Deliberately separate from `runFashnDirect`/`buildFashnDirectInputs`: Try-On Max's accepted
 * fields aren't 100% confirmed from docs alone, so this fails loud (the same raw-response-body
 * logging `startFashnRun` already does) rather than silently degrading output on a schema
 * mismatch — this is new, unproven integration surface and should surface problems immediately
 * during testing, not produce quietly-wrong results.
 */
export async function runFashnOutfit(
  compositeImageUrl: string,
  modelImageUrl: string,
  prompt: string
): Promise<FashnOutfitOutput> {
  const startTime = Date.now();

  const payload = {
    model_image: modelImageUrl,
    product_image: compositeImageUrl,
    prompt,
  };

  logger.info('FASHN outfit: starting prediction', { modelName: OUTFIT_MODEL_NAME });

  const predictionId = await startFashnRun(payload, OUTFIT_MODEL_NAME);

  logger.info('FASHN outfit: prediction started', { predictionId });

  const resultUrl = await pollFashnStatus(predictionId);

  const processingTimeMs = Date.now() - startTime;

  logger.info('FASHN outfit: prediction complete', { predictionId, processingTimeMs });

  return { resultUrl, processingTimeMs };
}

/** FASHN model used for AI Model Studio (product photo → on-model shot). */
const PRODUCT_MODEL_MODEL_NAME = env.FASHN_PRODUCT_MODEL_MODEL_NAME;

export interface FashnProductToModelInput {
  productImageUrl: string;
  faceReferenceUrl?: string;
  prompt?: string;
}

/**
 * Runs FASHN's `product-to-model`: turns a flat-lay/ghost-mannequin product photo into a
 * professional on-model shot. Unlike the existing Replicate-based AI Product Photoshoot (product +
 * a specific pre-chosen model photo → composite), this generates the person itself — an optional
 * `faceReferenceUrl` guides identity, but there's no "use exactly this saved model" input the way
 * Photoshoot has. Deliberately a separate feature/table, not a second engine bolted onto Photoshoot.
 * Field names confirmed against the live FASHN docs (product_image, image_prompt, face_reference,
 * prompt, aspect_ratio, resolution) — see PRs/plan notes for the source.
 */
export async function runFashnProductToModel(input: FashnProductToModelInput): Promise<FashnOutfitOutput> {
  const startTime = Date.now();

  const payload: Record<string, unknown> = {
    product_image: input.productImageUrl,
  };
  if (input.faceReferenceUrl) payload.face_reference = input.faceReferenceUrl;
  if (input.prompt) payload.prompt = input.prompt;

  logger.info('FASHN product-to-model: starting prediction', { modelName: PRODUCT_MODEL_MODEL_NAME });

  const predictionId = await startFashnRun(payload, PRODUCT_MODEL_MODEL_NAME);

  logger.info('FASHN product-to-model: prediction started', { predictionId });

  const resultUrl = await pollFashnStatus(predictionId);

  const processingTimeMs = Date.now() - startTime;

  logger.info('FASHN product-to-model: prediction complete', { predictionId, processingTimeMs });

  return { resultUrl, processingTimeMs };
}

/** FASHN model used for AI Video (still image → short animated clip). */
const IMAGE_TO_VIDEO_MODEL_NAME = env.FASHN_VIDEO_MODEL_NAME;

export interface FashnImageToVideoInput {
  imageUrl: string;
  prompt?: string;
  duration?: 5 | 10;
  resolution?: '480p' | '720p' | '1080p';
}

/**
 * Runs FASHN's `image-to-video`: animates a single still image into a short clip. Field names
 * confirmed against the live FASHN docs (image, prompt, duration, resolution). Real per-credit
 * cost (480p=1, 720p=3, 1080p=6, ×2 for 10s) — the caller is responsible for plan-gating and
 * surfacing that cost, this function just runs the prediction.
 */
export async function runFashnImageToVideo(input: FashnImageToVideoInput): Promise<FashnOutfitOutput> {
  const startTime = Date.now();

  const payload: Record<string, unknown> = {
    image: input.imageUrl,
    duration: input.duration ?? 5,
    resolution: input.resolution ?? '1080p',
  };
  if (input.prompt) payload.prompt = input.prompt;

  logger.info('FASHN image-to-video: starting prediction', {
    modelName: IMAGE_TO_VIDEO_MODEL_NAME,
    duration: payload.duration,
    resolution: payload.resolution,
  });

  const predictionId = await startFashnRun(payload, IMAGE_TO_VIDEO_MODEL_NAME);

  logger.info('FASHN image-to-video: prediction started', { predictionId });

  // Video rendering can run longer than a still-image prediction — use the longer configurable
  // timeout so a slow-but-succeeding job isn't cut off at the still-image POLL_TIMEOUT_MS.
  const resultUrl = await pollFashnStatus(predictionId, env.FASHN_VIDEO_POLL_TIMEOUT_MS);

  const processingTimeMs = Date.now() - startTime;

  logger.info('FASHN image-to-video: prediction complete', { predictionId, processingTimeMs });

  return { resultUrl, processingTimeMs };
}
