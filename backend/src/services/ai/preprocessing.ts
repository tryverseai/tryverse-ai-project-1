import Replicate from 'replicate';
import sharp from 'sharp';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { waitForReplicateSlot } from './replicate';

const replicate = new Replicate({ auth: env.REPLICATE_API_TOKEN });

export interface PreprocessResult {
  processedImageUrl: string;
  originalUrl: string;
  wasProcessed: boolean;
  bodyDetected: boolean;
  quality: 'high' | 'medium' | 'low';
}

/**
 * STAGE 1 — IMAGE PREPROCESSING
 *
 * For the person image:
 *   1. Validate dimensions and quality
 *   2. Background normalization (clean neutral background improves VTON accuracy)
 *   3. Body/pose presence validation
 *
 * For the product image:
 *   1. Background removal (white/transparent background improves model accuracy)
 *   2. Normalize size and aspect ratio
 */

/**
 * Preprocesses the person image for optimal try-on results.
 * Normalizes background to reduce noise in AI generation.
 */
export async function preprocessPersonImage(imageUrl: string): Promise<PreprocessResult> {
  logger.info('Preprocessing person image', { imageUrl: imageUrl.slice(0, 60) });

  try {
    // Validate and assess image quality via Sharp metadata
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('Failed to fetch person image for preprocessing');

    const buffer = Buffer.from(await response.arrayBuffer());
    const meta = await sharp(buffer).metadata();

    const width = meta.width || 0;
    const height = meta.height || 0;
    const quality = assessImageQuality(width, height);

    // Body detection heuristic: person images should be portrait-oriented
    // or close to square, and at least 256px in each dimension
    const bodyDetected = width >= 256 && height >= 256 && height / width >= 0.8;

    if (!bodyDetected) {
      logger.warn('Person image may not contain a full body', { width, height });
    }

    // If background removal is enabled, normalize background for better alignment
    if (env.ENABLE_BACKGROUND_NORMALIZATION && quality !== 'low') {
      try {
        const cleanedUrl = await normalizeBackground(imageUrl);
        return { processedImageUrl: cleanedUrl, originalUrl: imageUrl, wasProcessed: true, bodyDetected, quality };
      } catch (err) {
        logger.warn('Background normalization failed, using original', { error: String(err) });
      }
    }

    return { processedImageUrl: imageUrl, originalUrl: imageUrl, wasProcessed: false, bodyDetected, quality };
  } catch (err) {
    logger.error('Person image preprocessing error', { error: String(err) });
    // Non-fatal — return original image
    return { processedImageUrl: imageUrl, originalUrl: imageUrl, wasProcessed: false, bodyDetected: true, quality: 'medium' };
  }
}

/**
 * Preprocesses the product image for optimal try-on accuracy.
 * Removes background from product image so the AI model gets a clean overlay target.
 */
export async function preprocessProductImage(imageUrl: string): Promise<PreprocessResult> {
  logger.info('Preprocessing product image', { imageUrl: imageUrl.slice(0, 60) });

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error('Failed to fetch product image for preprocessing');
    const buffer = Buffer.from(await response.arrayBuffer());
    const meta = await sharp(buffer).metadata();
    const quality = assessImageQuality(meta.width || 0, meta.height || 0);

    if (env.ENABLE_BACKGROUND_REMOVAL && quality !== 'low') {
      try {
        const cleanedUrl = await removeBackground(imageUrl);
        return { processedImageUrl: cleanedUrl, originalUrl: imageUrl, wasProcessed: true, bodyDetected: false, quality };
      } catch (err) {
        logger.warn('Background removal failed, using original', { error: String(err) });
      }
    }

    return { processedImageUrl: imageUrl, originalUrl: imageUrl, wasProcessed: false, bodyDetected: false, quality };
  } catch (err) {
    logger.error('Product image preprocessing error', { error: String(err) });
    return { processedImageUrl: imageUrl, originalUrl: imageUrl, wasProcessed: false, bodyDetected: false, quality: 'medium' };
  }
}

/**
 * Removes background from an image using Replicate's rembg model.
 * Returns URL of the background-removed image.
 */
async function removeBackground(imageUrl: string): Promise<string> {
  await waitForReplicateSlot();
  const output = await replicate.run(
    env.REPLICATE_MODEL_REMBG as `${string}/${string}:${string}`,
    { input: { image: imageUrl } }
  );

  const url = extractUrl(output);
  if (!url) throw new Error('No output from background removal model');
  return url;
}

/**
 * Normalizes a cluttered background to a clean neutral gray.
 * Uses rembg then composites onto a neutral background for consistent lighting.
 */
async function normalizeBackground(imageUrl: string): Promise<string> {
  // Step 1: Remove background
  const noBgUrl = await removeBackground(imageUrl);

  // Step 2: Fetch the transparent PNG and composite onto neutral background
  const response = await fetch(noBgUrl);
  const buffer = Buffer.from(await response.arrayBuffer());

  const neutralBg = await sharp({
    create: {
      width: 768,
      height: 1024,
      channels: 3,
      background: { r: 220, g: 220, b: 220 }, // light neutral gray
    },
  })
    .jpeg({ quality: 95 })
    .toBuffer();

  const composed = await sharp(neutralBg)
    .composite([{ input: buffer, blend: 'over' }])
    .resize(768, 1024, { fit: 'contain', background: { r: 220, g: 220, b: 220 } })
    .jpeg({ quality: 95 })
    .toBuffer();

  // Return as data URI for pipeline use
  return `data:image/jpeg;base64,${composed.toString('base64')}`;
}

function assessImageQuality(width: number, height: number): 'high' | 'medium' | 'low' {
  const pixels = width * height;
  if (pixels >= 512 * 512) return 'high';
  if (pixels >= 256 * 256) return 'medium';
  return 'low';
}

function extractUrl(output: unknown): string {
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) return String(output[0]);
  return String(output);
}
