import sharp from 'sharp';
import { env } from '../../../config/env';
import { logger } from '../../../config/logger';
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
  // Allow smaller catalog / model thumbnails (still usable for VTON after upscale path).
  if (w < 280 || h < 280) {
    return { ok: false, reason: 'Photo is too small; use at least ~280px on the shortest side.' };
  }

  const ratio = h / w;
  // Full-body studio shots can be fairly wide; 0.48 avoids rejecting valid library models.
  if (ratio < 0.48) {
    return {
      ok: false,
      reason: 'Photo is very wide/landscape; use a taller portrait so the full subject is visible.',
    };
  }

  let faces: number;
  try {
    faces = await countDetectedFaces(buffer);
  } catch (err) {
    // BlazeFace / tfjs can throw "fetch failed" when downloading model weights (offline, firewall, DNS).
    // Assume a single subject so try-on can proceed instead of hard-failing the whole pipeline.
    logger.warn('tryon.validate: face count failed; assuming one subject', {
      error: err instanceof Error ? err.message : String(err),
    });
    faces = 1;
  }
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

export interface SubjectCropOptions {
  /** Fraction of the shorter output dimension added as breathing room around the detected subject. */
  marginFraction?: number;
  /** Max per-channel color distance from the sampled background for a pixel to still count as background. */
  colorTolerance?: number;
}

/**
 * Crops a generated try-on result down to the subject's actual bounding box. FASHN (and similar
 * garment-swap APIs) render onto a uniform, near-white studio background with the subject
 * inset — a deliberate catalog-photography margin baked into the model's own output, not an
 * artifact of our input framing (confirmed by testing: results carry the same margin even when
 * the input person canvas had zero letterbox padding). Detecting the actual foreground region and
 * cropping to it — rather than trying to control the margin at generation time, which FASHN's API
 * exposes no parameter for — is the direct fix.
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