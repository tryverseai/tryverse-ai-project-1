import sharp from 'sharp';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { computeImageHash } from '../cache/tryonCache';

export interface OptimizedImage {
  buffer: Buffer;
  hash: string;
  width: number;
  height: number;
}

/**
 * Fetches an image from URL, optimizes for AI inference, and returns buffer + hash.
 * - Resize to TRYON_AI_MAX_DIMENSION (keep aspect ratio)
 * - JPEG at TRYON_AI_JPEG_QUALITY (preserve detail for downstream models)
 * - Compute SHA-256 hash for caching
 */
export async function optimizeImageForAI(imageUrl: string): Promise<OptimizedImage> {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);

  const inputBuffer = Buffer.from(await response.arrayBuffer());
  const maxEdge = env.TRYON_AI_MAX_DIMENSION;
  const jpegQ = env.TRYON_AI_JPEG_QUALITY;

  const pipeline = sharp(inputBuffer)
    .resize(maxEdge, maxEdge, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .removeAlpha()
    .jpeg({
      quality: jpegQ,
      progressive: true,
      mozjpeg: true,
      chromaSubsampling: '4:4:4',
    });

  const buffer = await pipeline.toBuffer();
  const meta = await sharp(buffer).metadata();
  const hash = computeImageHash(buffer);

  logger.info('Image optimized for AI', {
    hash: hash.slice(0, 12),
    width: meta.width,
    height: meta.height,
  });

  return {
    buffer,
    hash,
    width: meta.width || maxEdge,
    height: meta.height || maxEdge,
  };
}

/**
 * Converts a buffer to a data URL for Replicate (accepts data URLs).
 */
export function bufferToDataUrl(buffer: Buffer): string {
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}
