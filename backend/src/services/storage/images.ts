import { supabaseAdmin } from '../../config/supabase';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';

const INPUT_BUCKET = env.STORAGE_BUCKET_INPUTS;
const RESULT_BUCKET = env.STORAGE_BUCKET_RESULTS;

/**
 * Processes, optimizes, and uploads an image buffer to Supabase Storage.
 * Returns the stored path (not a public URL).
 */
export async function uploadImageBuffer(
  buffer: Buffer,
  mimeType: string,
  folder: 'person' | 'garment',
  userId?: string
): Promise<string> {
  // Optimize image: convert to JPEG, resize to max 1024px, compress
  const optimized = await sharp(buffer)
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 90, progressive: true })
    .toBuffer();

  const fileName = `${uuidv4()}.jpg`;
  const filePath = userId ? `${userId}/${folder}/${fileName}` : `anonymous/${folder}/${fileName}`;

  const { error } = await supabaseAdmin.storage
    .from(INPUT_BUCKET)
    .upload(filePath, optimized, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    logger.error('Failed to upload image to storage', { error: error.message });
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  return filePath;
}

/**
 * Uploads a result image (from URL) to Supabase Storage.
 * Downloads from the AI provider URL and re-uploads for permanence.
 */
export async function storeResultImage(
  imageUrl: string,
  tryonId: string,
  userId?: string
): Promise<string> {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Failed to fetch result image: ${response.statusText}`);

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Optimize result too
  const optimized = await sharp(buffer)
    .jpeg({ quality: 95, progressive: true })
    .toBuffer();

  const filePath = userId
    ? `${userId}/results/${tryonId}.jpg`
    : `anonymous/results/${tryonId}.jpg`;

  const { error } = await supabaseAdmin.storage
    .from(RESULT_BUCKET)
    .upload(filePath, optimized, {
      contentType: 'image/jpeg',
      cacheControl: '86400',
      upsert: true,
    });

  if (error) {
    logger.error('Failed to store result image', { error: error.message });
    throw new Error(`Result storage failed: ${error.message}`);
  }

  return filePath;
}

/**
 * Generates a short-lived signed URL for a stored image.
 */
export async function getSignedUrl(
  bucket: string,
  filePath: string,
  expiresInSeconds: number = env.IMAGE_EXPIRY_SECONDS
): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(filePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to generate signed URL: ${error?.message}`);
  }

  return data.signedUrl;
}

/**
 * Returns a public CDN URL for result images.
 */
export function getPublicUrl(bucket: string, filePath: string): string {
  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}

/**
 * Deletes old/expired input images to save storage.
 */
export async function cleanupExpiredInputs(olderThanHours: number = 24): Promise<void> {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString();

  const { data: files } = await supabaseAdmin.storage
    .from(INPUT_BUCKET)
    .list('anonymous', { limit: 100 });

  if (!files?.length) return;

  const toDelete = files
    .filter((f) => f.created_at && f.created_at < cutoff)
    .map((f) => `anonymous/${f.name}`);

  if (toDelete.length > 0) {
    await supabaseAdmin.storage.from(INPUT_BUCKET).remove(toDelete);
    logger.info(`Cleaned up ${toDelete.length} expired input images`);
  }
}

export { INPUT_BUCKET, RESULT_BUCKET };
