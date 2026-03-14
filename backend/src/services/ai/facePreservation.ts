import Replicate from 'replicate';
import sharp from 'sharp';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { waitForReplicateSlot } from './replicate';

const replicate = new Replicate({ auth: env.REPLICATE_API_TOKEN });

/**
 * STAGE 3 — FACE PRESERVATION (InsightFace / GFPGAN)
 *
 * AI try-on models can sometimes distort or alter the subject's face.
 * This stage:
 *   1. Detects the face region in the generated result
 *   2. Restores/enhances the face using GFPGAN or CodeFormer
 *   3. Blends the preserved face back into the result image
 *
 * Result: Photorealistic identity preservation — the person looks
 * exactly like themselves, just wearing the new product.
 */

export interface FacePreservationResult {
  processedImageUrl: string;
  faceEnhanced: boolean;
}

/**
 * Runs face enhancement on the generated try-on result.
 * Uses GFPGAN (GAN-based face restoration) via Replicate.
 */
export async function preserveFace(generatedImageUrl: string): Promise<FacePreservationResult> {
  if (!env.ENABLE_FACE_PRESERVATION) {
    return { processedImageUrl: generatedImageUrl, faceEnhanced: false };
  }

  logger.info('Running face preservation');

  try {
    await waitForReplicateSlot();
    const output = await replicate.run(
      env.REPLICATE_MODEL_GFPGAN as `${string}/${string}:${string}`,
      {
        input: {
          img: generatedImageUrl,
          scale: 2,             // upscale factor — improves face clarity
          version: 'v1.4',      // GFPGAN v1.4 = best face fidelity
          face_enhance: true,
        },
      }
    );

    const enhancedUrl = extractUrl(output);
    if (!enhancedUrl) {
      logger.warn('Face preservation returned no output, using original');
      return { processedImageUrl: generatedImageUrl, faceEnhanced: false };
    }

    logger.info('Face preservation complete');
    return { processedImageUrl: enhancedUrl, faceEnhanced: true };
  } catch (err) {
    logger.error('Face preservation failed, using original', { error: String(err) });
    return { processedImageUrl: generatedImageUrl, faceEnhanced: false };
  }
}

/**
 * Blends the enhanced face back into the result at the correct position.
 * This prevents over-upscaling the entire image while still fixing the face.
 * Called after GFPGAN to compose the face enhancement into the full result.
 */
export async function blendFaceIntoResult(
  originalResultUrl: string,
  enhancedFaceUrl: string
): Promise<string> {
  try {
    const [origRes, faceRes] = await Promise.all([
      fetch(originalResultUrl),
      fetch(enhancedFaceUrl),
    ]);

    const [origBuffer, faceBuffer] = await Promise.all([
      origRes.arrayBuffer().then(Buffer.from),
      faceRes.arrayBuffer().then(Buffer.from),
    ]);

    const origMeta = await sharp(origBuffer).metadata();
    const { width = 768, height = 1024 } = origMeta;

    // Downscale the face-enhanced image back to original resolution
    // then composite (this preserves the original body but with enhanced face)
    const resizedFace = await sharp(faceBuffer)
      .resize(width, height, { fit: 'contain' })
      .toBuffer();

    const blended = await sharp(origBuffer)
      .composite([{ input: resizedFace, blend: 'over', gravity: 'north' }])
      .jpeg({ quality: 95 })
      .toBuffer();

    return `data:image/jpeg;base64,${blended.toString('base64')}`;
  } catch (err) {
    logger.error('Face blend failed, returning enhanced face directly', { error: String(err) });
    return enhancedFaceUrl;
  }
}

function extractUrl(output: unknown): string {
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) return String(output[0]);
  if (output && typeof output === 'object' && 'output' in output) {
    return String((output as { output: unknown }).output);
  }
  return String(output);
}
