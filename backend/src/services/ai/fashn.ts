/**
 * Direct FASHN AI API client (https://api.fashn.ai/v1)
 *
 * When FASHN_API_KEY is set, all FASHN try-ons (clothing, bags, glasses)
 * call the FASHN API directly instead of routing through Replicate.
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
 */
function wrapForDirectApi(inputs: Record<string, unknown>): Record<string, unknown> {
  return {
    model_name: 'tryon-v1.6',
    inputs,
  };
}

/** Start a FASHN prediction. Returns the prediction ID. */
async function startFashnRun(body: Record<string, unknown>): Promise<string> {
  const payload = wrapForDirectApi(body);
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

/** Poll FASHN status until the prediction finishes. Returns the output URL. */
async function pollFashnStatus(predictionId: string): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

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
      throw new Error(`FASHN prediction failed: ${data.error ?? 'unknown reason'}`);
    }

    logger.debug('FASHN prediction in progress', { id: predictionId, status: data.status });
  }

  throw new Error(`FASHN prediction timed out after ${POLL_TIMEOUT_MS / 1000}s`);
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
 * Run a FASHN try-on via the direct FASHN AI API (clothing, bags, glasses).
 *
 * @param input        - Canonical VtonInput (person + product URLs, category, etc.)
 * @param buildPayload - Category-specific function that maps VtonInput → FASHN request body
 * @param label        - Short label for logging (e.g. 'fashn-clothing', 'fashn-bags')
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
