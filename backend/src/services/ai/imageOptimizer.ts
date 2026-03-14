import sharp from 'sharp';
import { logger } from '../../config/logger';
import { computeImageHash } from '../cache/tryonCache';

const MAX_SIZE = 1024;
const JPEG_QUALITY = 85;

export interface OptimizedImage {
  buffer: Buffer;
  hash: string;
  width: number;
  height: number;
}

/**
 * Fetches an image from URL, optimizes for AI inference, and returns buffer + hash.
 * - Resize to max 1024px (keep aspect ratio)
 * - Compress with Sharp (strip metadata, ensure RGB)
 * - Compute SHA-256 hash for caching
 */
export async function optimizeImageForAI(imageUrl: string): Promise<OptimizedImage> {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);

  const inputBuffer = Buffer.from(await response.arrayBuffer());

  const pipeline = sharp(inputBuffer)
    .resize(MAX_SIZE, MAX_SIZE, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .removeAlpha()
    .jpeg({
      quality: JPEG_QUALITY,
      progressive: true,
      mozjpeg: true,
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
    width: meta.width || MAX_SIZE,
    height: meta.height || MAX_SIZE,
  };
}

/**
 * Converts a buffer to a data URL for Replicate (accepts data URLs).
 */
export function bufferToDataUrl(buffer: Buffer): string {
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}
