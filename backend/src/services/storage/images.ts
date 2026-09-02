import { env } from '../../config/env';
import { logger } from '../../config/logger';
import sharp from 'sharp';
import { convexUploadBuffer, convexDeleteStorageIds, storagePathToConvexId } from '../convexStorageBridge';
import { anyApi, convexQueryTrusted } from '../../config/convexHttp';
import { fetchRemoteMedia } from '../../lib/fetchRemoteMedia';
import { TRUSTED_FASHN_OUTPUT_HOSTS } from '../../lib/fashnHosts';

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

export interface SubjectCropOptions {
  /** Fraction of the shorter output dimension added as breathing room around the detected subject. */
  marginFraction?: number;
  /** Max per-channel color distance from the sampled background for a pixel to still count as background. */
  colorTolerance?: number;
}

/**
 * Crops a generated fashion-photo result down to the subject's actual bounding box. FASHN (and
 * similar garment-swap/model-generation APIs) render onto a uniform, near-white studio background
 * with the subject inset — a deliberate catalog-photography margin baked into the model's own
 * output, not an artifact of TryVerse's input framing (confirmed by testing: results carry the
 * same margin even when the input person canvas had zero letterbox padding of its own). Detecting
 * the actual foreground region and cropping to it — rather than trying to control the margin at
 * generation time, which FASHN's API exposes no parameter for — is the direct fix. Called from
 * every pipeline that stores a FASHN-generated photo (Try-On, Outfit Builder, AI Model Studio,
 * Product Photography, AI Photoshoot, AI Model Personalization) via `uploadResultBuffer`'s
 * `cropSubject` flag or unconditionally from `storeResultImage`, so the fix is consistent across
 * every surface a result appears in rather than living inside one pipeline.
 *
 * Samples the background color from the four corners, scans a downscaled copy for the bounding
 * box of pixels that differ from it, then maps that box back to full resolution with a small
 * margin. Deliberately conservative: any ambiguous or out-of-range result (near-empty or
 * near-full-frame foreground, tiny crop) falls back to the original, uncropped image rather than
 * risk cutting off part of the subject.
 */
export async function cropToSubjectBoundingBox(buffer: Buffer, opts: SubjectCropOptions = {}): Promise<Buffer> {
  const marginFraction = opts.marginFraction ?? 0.035;
  const colorTolerance = opts.colorTolerance ?? 18;

  try {
    const meta = await sharp(buffer).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (!w || !h) return buffer;

    // Downscaled scan — an approximate bounding box is all that's needed, and this keeps the
    // per-pixel scan below fast even on large "4k"-resolution results.
    const scanW = Math.min(220, w);
    const scanH = Math.max(1, Math.round((scanW / w) * h));
    const { data, info } = await sharp(buffer)
      .resize(scanW, scanH, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const channels = info.channels;

    const at = (x: number, y: number): [number, number, number] => {
      const idx = (y * scanW + x) * channels;
      return [data[idx], data[idx + 1], data[idx + 2]];
    };

    const corners = [at(0, 0), at(scanW - 1, 0), at(0, scanH - 1), at(scanW - 1, scanH - 1)];
    const bg: [number, number, number] = [0, 1, 2].map(
      (c) => Math.round(corners.reduce((sum, p) => sum + p[c], 0) / corners.length)
    ) as [number, number, number];

    let minX = scanW;
    let maxX = -1;
    let minY = scanH;
    let maxY = -1;
    for (let y = 0; y < scanH; y++) {
      for (let x = 0; x < scanW; x++) {
        const [r, g, b] = at(x, y);
        const isBackground =
          Math.abs(r - bg[0]) <= colorTolerance &&
          Math.abs(g - bg[1]) <= colorTolerance &&
          Math.abs(b - bg[2]) <= colorTolerance;
        if (!isBackground) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) return buffer; // no foreground detected — leave as-is
    const foundW = maxX - minX + 1;
    const foundH = maxY - minY + 1;
    // Skip implausibly small (likely noise, not a real subject) or already-tight (nothing
    // meaningful to crop) detections rather than risk an aggressive or no-op crop.
    if (foundW < scanW * 0.15 || foundH < scanH * 0.15) return buffer;
    if (foundW > scanW * 0.97 && foundH > scanH * 0.97) return buffer;

    const scaleX = w / scanW;
    const scaleY = h / scanH;
    const marginPx = Math.round(Math.min(w, h) * marginFraction);

    const left = Math.max(0, Math.round(minX * scaleX) - marginPx);
    const top = Math.max(0, Math.round(minY * scaleY) - marginPx);
    const right = Math.min(w, Math.round((maxX + 1) * scaleX) + marginPx);
    const bottom = Math.min(h, Math.round((maxY + 1) * scaleY) + marginPx);
    const cropW = right - left;
    const cropH = bottom - top;
    if (cropW < 10 || cropH < 10) return buffer;

    return await sharp(buffer)
      .extract({ left, top, width: cropW, height: cropH })
      .jpeg({ quality: 96, mozjpeg: true, progressive: true, chromaSubsampling: '4:4:4' })
      .toBuffer();
  } catch (err) {
    logger.warn('cropToSubjectBoundingBox: detection failed, storing uncropped result', {
      error: err instanceof Error ? err.message : String(err),
    });
    return buffer;
  }
}

/**
 * @param cropSubject Set true when `buffer` is a final FASHN-generated subject photo (Try-On,
 * Outfit Builder, AI Model Studio, Product Photography, AI Photoshoot, personalization) — crops
 * off FASHN's own studio-margin padding before storage (see `cropToSubjectBoundingBox`). Leave
 * false for non-photo buffers this function also stores, e.g. the Outfit Builder's intermediate
 * flat-lay composite, which has no single subject to detect.
 */
export async function uploadResultBuffer(
  buffer: Buffer,
  userId?: string,
  cropSubject = false
): Promise<string> {
  const cropped = cropSubject ? await cropToSubjectBoundingBox(buffer) : buffer;
  const optimized = await sharp(cropped)
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

/** Always used for a final FASHN-generated subject photo fetched by URL — see `cropToSubjectBoundingBox`. */
const RESULT_IMAGE_MAX_BYTES = 20 * 1024 * 1024; // 20 MB cap for result images
const RESULT_VIDEO_MAX_BYTES = 100 * 1024 * 1024; // 100 MB cap — clips are short (5-10s) but capped well above a typical clip.

/** Always used for a final FASHN-generated subject photo fetched by URL — the raw URL is treated
 * as opaque (see `fetchRemoteMedia`'s doc comment): only its hostname/protocol are checked, and
 * it must be one of FASHN's documented output hosts (`TRUSTED_FASHN_OUTPUT_HOSTS`) since every
 * caller of this function passes a `fashnResult.resultUrl`, never a general provider URL. */
export async function storeResultImage(
  imageUrl: string,
  tryonId: string,
  userId?: string
): Promise<string> {
  void tryonId;

  const { buffer } = await fetchRemoteMedia(imageUrl, {
    label: 'storeResultImage',
    maxBytes: RESULT_IMAGE_MAX_BYTES,
    allowedHosts: TRUSTED_FASHN_OUTPUT_HOSTS,
  });
  // sharp() below both re-encodes and validates the buffer actually decodes as an image —
  // a corrupt or non-image payload throws here rather than ever reaching storage.
  const cropped = await cropToSubjectBoundingBox(buffer);

  const optimized = await sharp(cropped)
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

/** MP4's ISO-BMFF container has a `ftyp` box starting at byte 4 in virtually every real-world
 * encoder's output (including FASHN's) — a cheap signature check so an unexpected payload that
 * merely claims `video/mp4` in its Content-Type header (never trusted alone) doesn't get stored
 * and served to users as a video. */
function looksLikeMp4(buffer: Buffer): boolean {
  return buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp';
}

/**
 * Downloads and stores a video result (AI Video / FASHN `image-to-video`) — same trusted-host
 * allowlist and hardened fetch as `storeResultImage`, but stored as-is with no Sharp re-encode
 * (Sharp is image-only), so it gets its own lightweight signature check instead.
 */
export async function storeResultVideo(videoUrl: string, userId?: string): Promise<string> {
  const { buffer, contentType } = await fetchRemoteMedia(videoUrl, {
    label: 'storeResultVideo',
    maxBytes: RESULT_VIDEO_MAX_BYTES,
    allowedHosts: TRUSTED_FASHN_OUTPUT_HOSTS,
    timeoutMs: 45_000,
  });
  if (!looksLikeMp4(buffer)) {
    throw new Error('storeResultVideo: remote content is not a recognizable MP4 file');
  }

  const storageId = await convexUploadBuffer(buffer, contentType || 'video/mp4');
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
