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
  const res = await fetch(`${FASHN_BASE_URL}/run`, {
    method: 'POST',
    headers: fashnHeaders(),
    body: JSON.stringify(wrapForDirectApi(body)),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`FASHN /run failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as FashnRunResponse;

  if (data.error) {
    throw new Error(`FASHN run error: ${data.error}`);
  }
  if (!data.id) {
    throw new Error('FASHN /run did not return a prediction ID');
  }

  return data.id;
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
 * Build a clean payload for the FASHN direct API (tryon-v1.6).
 *
 * FASHN v1.6 only accepts a specific set of inputs — building explicitly
 * prevents Replicate-specific fields from causing 400 BadRequest errors.
 *
 * Accepted fields (tryon-v1.6):
 *   model_image, garment_image, category, mode, garment_photo_type,
 *   segmentation_free, seed, num_samples, output_format, moderation_level
 *
 * NOT accepted (removed in v1.5+, Replicate-specific only):
 *   adjust_hands, restore_background, restore_clothes, long_top,
 *   cover_feet, garment_description
 *
 * NOTE: 'auto' is a valid category in v1.6 — it lets the model auto-detect
 * the garment type. Do NOT remap it to 'one-pieces'.
 */
function sanitiseForDirectApi(raw: Record<string, unknown>): Record<string, unknown> {
  // Pass category through as-is: 'tops', 'bottoms', 'one-pieces', or 'auto'.
  // 'auto' is fully supported in v1.6 and gives better results than forcing 'one-pieces'.
  const category = raw['category'] ?? 'auto';

  return {
    model_image: raw['model_image'],
    garment_image: raw['garment_image'],
    category,
    mode: 'quality',
    garment_photo_type: raw['garment_photo_type'] ?? 'auto',
    // Disable segmentation-free mode so FASHN performs human parsing.
    // This gives sharper garment boundaries and eliminates transition artifacts.
    segmentation_free: false,
  };
}

/**
 * Run a FASHN try-on via the direct FASHN AI API.
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

  // Build the payload from the shared Replicate-style builder, then normalise it
  // to what the direct FASHN API actually accepts.
  const rawPayload = buildPayload(input);
  const payload = sanitiseForDirectApi(rawPayload);

  logger.info('FASHN direct: starting prediction', {
    label,
    category: input.category,
    fashnCategory: payload['category'],
    longTop: payload['long_top'],
    coverFeet: payload['cover_feet'],
    mode: payload['mode'],
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
