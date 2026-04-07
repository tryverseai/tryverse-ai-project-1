import { env } from '../../config/env';
import { logger } from '../../config/logger';
import sharp from 'sharp';
import { convexUploadBuffer, convexDeleteStorageIds, storagePathToConvexId } from '../convexStorageBridge';
import { anyApi, convexQueryTrusted } from '../../config/convexHttp';

const INPUT_BUCKET = env.STORAGE_BUCKET_INPUTS;
const RESULT_BUCKET = env.STORAGE_BUCKET_RESULTS;

const INFERENCE_SCRATCH_PREFIX = '_inference_scratch';

export function storageFailureMessage(label: string, bucket: string, errorMessage: string): string {
  void bucket;
  return `${label}: ${errorMessage}`;
}

/**
 * Filename is always `{convexStorageId}.jpg`; folder encodes owner + type.
 */
export async function uploadInferenceScratchJpeg(
  buffer: Buffer,
  _role: 'person' | 'product',
  userId: string | null
): Promise<string> {
  const storageId = await convexUploadBuffer(buffer, 'image/jpeg');
  const folder = userId
    ? `${userId}/${INFERENCE_SCRATCH_PREFIX}`
    : `anonymous/${INFERENCE_SCRATCH_PREFIX}`;
  return `${folder}/${storageId}.jpg`;
}

export async function removeInferenceScratchPaths(paths: string[]): Promise<void> {
  if (!paths.length) return;
  const ids = paths.map((p) => {
    try {
      return storagePathToConvexId(p);
    } catch {
      return null;
    }
  }).filter((x): x is string => x !== null);
  await convexDeleteStorageIds(ids);
}

export async function uploadImageBuffer(
  buffer: Buffer,
  mimeType: string,
  folder: 'person' | 'garment',
  userId?: string
): Promise<string> {
  void mimeType;
  const optimized = await sharp(buffer)
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 90, progressive: true })
    .toBuffer();

  const storageId = await convexUploadBuffer(optimized, 'image/jpeg');
  const base = userId ? `${userId}/${folder}` : `anonymous/${folder}`;
  return `${base}/${storageId}.jpg`;
}

export async function uploadResultBuffer(buffer: Buffer, userId?: string): Promise<string> {
  const optimized = await sharp(buffer)
    .jpeg({
      quality: 96,
      progressive: true,
      chromaSubsampling: '4:4:4',
      mozjpeg: true,
    })
    .toBuffer();
  const storageId = await convexUploadBuffer(optimized, 'image/jpeg');
  const base = userId ? `${userId}/results` : `anonymous/results`;
  return `${base}/${storageId}.jpg`;
}

export async function storeResultImage(
  imageUrl: string,
  tryonId: string,
  userId?: string
): Promise<string> {
  void tryonId;
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Failed to fetch result image: ${response.statusText}`);

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const optimized = await sharp(buffer)
    .jpeg({
      quality: 96,
      progressive: true,
      chromaSubsampling: '4:4:4',
      mozjpeg: true,
    })
    .toBuffer();

  const storageId = await convexUploadBuffer(optimized, 'image/jpeg');
  const base = userId ? `${userId}/results` : `anonymous/results`;
  return `${base}/${storageId}.jpg`;
}

export async function getSignedUrl(
  _bucket: string,
  filePath: string,
  _expiresInSeconds: number = env.IMAGE_EXPIRY_SECONDS
): Promise<string> {
  void _expiresInSeconds;
  try {
    const storageId = storagePathToConvexId(filePath);
    return await convexQueryTrusted<string>(anyApi.trustedStorage.storageGetUrl, {
      secret: env.BACKEND_SHARED_SECRET,
      storageId,
    });
  } catch (err) {
    logger.error('getSignedUrl failed', { filePath: filePath.slice(0, 120), error: String(err) });
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export async function getPublicUrl(_bucket: string, filePath: string): Promise<string> {
  return getSignedUrl(_bucket, filePath, env.IMAGE_EXPIRY_SECONDS);
}

/** No global listing API for Convex scratch space — no-op. */
export async function cleanupExpiredInputs(_olderThanHours: number = 24): Promise<void> {
  void _olderThanHours;
}

export { INPUT_BUCKET, RESULT_BUCKET };
