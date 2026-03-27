import sharp from 'sharp';
import { env } from '../../../config/env';
import { countDetectedFaces } from '../facePreservation';

/** Production try-on canvas: 3:4 portrait, matches common VTON / catalog norms. */
export const TRYON_CANVAS_WIDTH = 768;
export const TRYON_CANVAS_HEIGHT = 1024;

export interface PersonValidationResult {
  ok: boolean;
  reason?: string;
}

/**
 * Reject unusable person inputs before spending model credits.
 */
export async function validatePersonForTryOn(buffer: Buffer): Promise<PersonValidationResult> {
  if (!env.TRYON_STRICT_PERSON_VALIDATION) {
    return { ok: true };
  }

  const meta = await sharp(buffer).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w < 320 || h < 320) {
    return { ok: false, reason: 'Photo is too small; use at least ~320px on the shortest side.' };
  }

  const ratio = h / w;
  if (ratio < 0.55) {
    return {
      ok: false,
      reason: 'Photo is very wide/landscape; use a taller portrait so the full subject is visible.',
    };
  }

  const faces = await countDetectedFaces(buffer);
  if (faces > 1) {
    return {
      ok: false,
      reason: 'Multiple faces detected; use a photo with one clear subject.',
    };
  }
  if (faces === 0) {
    return {
      ok: false,
      reason: 'No clear face detected; use a front-facing photo with your face visible.',
    };
  }

  return { ok: true };
}

/**
 * Letterbox / fit image to exact 768×1024, centered, sRGB JPEG-friendly background from edge sample.
 */
export async function normalizePersonToTryOnCanvas(buffer: Buffer): Promise<Buffer> {
  const meta = await sharp(buffer).metadata();
  const iw = meta.width ?? 0;
  const ih = meta.height ?? 0;
  if (!iw || !ih) return buffer;

  const tw = TRYON_CANVAS_WIDTH;
  const th = TRYON_CANVAS_HEIGHT;
  if (iw === tw && ih === th) return buffer;
  const scale = Math.min(tw / iw, th / ih);
  const sw = Math.max(1, Math.round(iw * scale));
  const sh = Math.max(1, Math.round(ih * scale));

  const edge = await sharp(buffer)
    .resize(2, 2, { fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const px = edge.data;
  const bg = {
    r: px[0] ?? 245,
    g: px[1] ?? 245,
    b: px[2] ?? 245,
  };

  const resized = await sharp(buffer)
    .resize(sw, sh, { fit: 'inside', withoutEnlargement: false })
    .flatten({ background: bg })
    .removeAlpha()
    .jpeg({ quality: 95, mozjpeg: true })
    .toBuffer();

  const left = Math.floor((tw - sw) / 2);
  const top = Math.floor((th - sh) / 2);

  return sharp({
    create: {
      width: tw,
      height: th,
      channels: 3,
      background: bg,
    },
  })
    .composite([{ input: resized, left, top }])
    .jpeg({ quality: 95, mozjpeg: true, progressive: true, chromaSubsampling: '4:4:4' })
    .toBuffer();
}