import { env } from '../../config/env';
import { logger } from '../../config/logger';
import sharp from 'sharp';
import { convexUploadBuffer, convexDeleteStorageIds, storagePathToConvexId } from '../convexStorageBridge';
import { anyApi, convexQueryTrusted } from '../../config/convexHttp';

// ---------------------------------------------------------------------------
// Signed-URL in-memory cache
// Convex storage URLs do not expire, but we cache to prevent N signing
// round-trips per list request. TTL is kept well below any real expiry.
// ---------------------------------------------------------------------------
const SIGNED_URL_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_ENTRIES = 2_000;

interface CacheEntry { url: string; expiresAt: number }
const signedUrlCache = new Map<string, CacheEntry>();

function getCachedUrl(key: string): string | undefined {
  const entry = signedUrlCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) { signedUrlCache.delete(key); return undefined; }
  return entry.url;
}

function setCachedUrl(key: string, url: string): void {
  if (signedUrlCache.size >= MAX_CACHE_ENTRIES) {
    // Evict the 200 oldest entries to bound memory usage
    const toDelete = [...signedUrlCache.keys()].slice(0, 200);
    toDelete.forEach((k) => signedUrlCache.delete(k));
  }
  signedUrlCache.set(key, { url, expiresAt: Date.now() + SIGNED_URL_CACHE_TTL_MS });
}

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

  // Basic SSRF guard: only allow HTTPS URLs pointing to non-private hosts.
  // This function is currently unused but is protected defensively.
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    throw new Error('storeResultImage: invalid URL');
  }
  if (parsedUrl.protocol !== 'https:') {
    throw new Error('storeResultImage: only HTTPS URLs are allowed');
  }
  const PRIVATE_HOST = /^(localhost|127\.|0\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.|::1)/i;
  if (PRIVATE_HOST.test(parsedUrl.hostname)) {
    throw new Error('storeResultImage: URL host not allowed');
  }

  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Failed to fetch result image: ${response.status}`);

  // Cap response size before buffering to prevent OOM
  const RESULT_IMAGE_MAX_BYTES = 20 * 1024 * 1024; // 20 MB cap for result images
  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > RESULT_IMAGE_MAX_BYTES) {
    throw new Error('storeResultImage: remote image exceeds size limit');
  }
  const rawBuffer = await response.arrayBuffer();
  if (rawBuffer.byteLength > RESULT_IMAGE_MAX_BYTES) {
    throw new Error('storeResultImage: remote image exceeds size limit');
  }
  const buffer = Buffer.from(rawBuffer);

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

/**
 * Downloads and stores a video result (AI Video / FASHN `image-to-video`) — same SSRF guard as
 * `storeResultImage`, but stored as-is with no Sharp re-encode (Sharp is image-only).
 */
export async function storeResultVideo(videoUrl: string, userId?: string): Promise<string> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(videoUrl);
  } catch {
    throw new Error('storeResultVideo: invalid URL');
  }
  if (parsedUrl.protocol !== 'https:') {
    throw new Error('storeResultVideo: only HTTPS URLs are allowed');
  }
  const PRIVATE_HOST = /^(localhost|127\.|0\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.|::1)/i;
  if (PRIVATE_HOST.test(parsedUrl.hostname)) {
    throw new Error('storeResultVideo: URL host not allowed');
  }

  const response = await fetch(videoUrl);
  if (!response.ok) throw new Error(`Failed to fetch result video: ${response.status}`);

  // Video clips are short (5-10s) but can still be a few MB — cap well above a typical clip.
  const RESULT_VIDEO_MAX_BYTES = 100 * 1024 * 1024; // 100 MB cap
  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > RESULT_VIDEO_MAX_BYTES) {
    throw new Error('storeResultVideo: remote video exceeds size limit');
  }
  const rawBuffer = await response.arrayBuffer();
  if (rawBuffer.byteLength > RESULT_VIDEO_MAX_BYTES) {
    throw new Error('storeResultVideo: remote video exceeds size limit');
  }
  const buffer = Buffer.from(rawBuffer);

  const contentType = response.headers.get('content-type') || 'video/mp4';
  const storageId = await convexUploadBuffer(buffer, contentType);
  const base = userId ? `${userId}/videos` : `anonymous/videos`;
  return `${base}/${storageId}.mp4`;
}

export async function getSignedUrl(
  _bucket: string,
  filePath: string,
  _expiresInSeconds: number = env.IMAGE_EXPIRY_SECONDS
): Promise<string> {
  void _expiresInSeconds;
  const cached = getCachedUrl(filePath);
  if (cached) return cached;
  try {
    const storageId = storagePathToConvexId(filePath);
    const url = await convexQueryTrusted<string>(anyApi.trustedStorage.storageGetUrl, {
      secret: env.BACKEND_SHARED_SECRET,
      storageId,
    });
    setCachedUrl(filePath, url);
    return url;
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
