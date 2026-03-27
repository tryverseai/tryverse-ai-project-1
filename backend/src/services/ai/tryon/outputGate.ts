import sharp from 'sharp';
import { logger } from '../../../config/logger';
import { TRYON_CANVAS_HEIGHT, TRYON_CANVAS_WIDTH } from './canonical';

export interface OutputGateResult {
  ok: boolean;
  reason?: string;
}

const DOWNSCALE = 72;

/**
 * Mean absolute difference per channel (0–255 scale) after aligning to a tiny grid.
 * Low values mean the try-on model likely returned the person image unchanged.
 */
export async function meanAbsDiffDownscaled(a: Buffer, b: Buffer): Promise<number> {
  const w = DOWNSCALE;
  const h = DOWNSCALE;
  const [ta, tb] = await Promise.all([
    sharp(a).resize(w, h, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(b).resize(w, h, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  const da = ta.data;
  const db = tb.data;
  if (da.length !== db.length || da.length === 0) return 255;
  let sum = 0;
  for (let i = 0; i < da.length; i++) sum += Math.abs(da[i] - db[i]);
  return sum / da.length;
}

/**
 * Lightweight quality gate on the generated raster (no extra ML).
 * Rejects empty/flat/broken dimensions before returning to clients.
 */
export async function validateTryOnOutput(buffer: Buffer): Promise<OutputGateResult> {
  const meta = await sharp(buffer).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (w < 256 || h < 256) {
    return { ok: false, reason: 'Generated image dimensions too small' };
  }

  const stats = await sharp(buffer)
    .resize(64, 64, { fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = stats;
  const ch = info.channels;
  const n = data.length / Math.max(1, ch);
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < data.length; i += ch) {
    const g = (data[i] + data[i + 1] + data[i + 2]) / 3;
    sum += g;
    sumSq += g * g;
  }
  const mean = sum / Math.max(1, n);
  const variance = Math.max(0, sumSq / Math.max(1, n) - mean * mean);
  if (variance < 8) {
    return { ok: false, reason: 'Generated image appears flat or corrupted' };
  }

  const ratio = h / w;
  const expected = TRYON_CANVAS_HEIGHT / TRYON_CANVAS_WIDTH;
  if (Math.abs(ratio - expected) > 0.35) {
    logger.warn('tryon.outputGate: unusual aspect ratio', { w, h, ratio });
  }

  return { ok: true };
}

/**
 * Reject landscape / stitched outputs Replicate sometimes returns (before/after, triptychs).
 * Portrait try-on should be taller than wide (ratio h/w > ~1.05).
 */
export async function assertTryOnOutputNotCollage(
  outputBuffer: Buffer,
  personWidth: number,
  personHeight: number
): Promise<void> {
  const meta = await sharp(outputBuffer).metadata();
  const ow = meta.width ?? 0;
  const oh = meta.height ?? 0;
  if (!ow || !oh) {
    throw new Error('Invalid output — model layout looks wrong; please try again.');
  }
  if (ow > oh * 0.82) {
    logger.warn('tryon.outputGate: landscape output rejected', { ow, oh });
    throw new Error('Invalid output — model layout looks wrong; please try again.');
  }
  if (personWidth > 0 && personHeight > 0 && ow > personWidth * 1.12) {
    logger.warn('tryon.outputGate: output wider than person frame', { ow, personWidth });
    throw new Error('Invalid output — model layout looks wrong; please try again.');
  }
}
