import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-cpu';
import { load as blazefaceLoad } from '@tensorflow-models/blazeface';
import type { BlazeFaceModel, NormalizedFace } from '@tensorflow-models/blazeface';
import Replicate from 'replicate';
import sharp from 'sharp';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { waitForReplicateSlot } from './replicate';

const replicate = new Replicate({ auth: env.REPLICATE_API_TOKEN });

/**
 * Face handling after IDM-VTON (clothing):
 * - **Face lock** (default): detect face on the person image passed to VTON, paste that region onto
 *   the VTON output at the mapped position with feathered edges — identity matches the input tensor.
 * - **GFPGAN** (optional, `ENABLE_FACE_PRESERVATION`): restores/enhances face via Replicate — skipped
 *   when face lock succeeded so we do not alter the pasted face.
 *
 * Detection uses BlazeFace (@tensorflow-models/blazeface) + TensorFlow.js CPU (no native canvas / tfjs-node).
 * This avoids heavyweight @vladmandic/face-api setup on Windows while still providing a tight face box; compositing is Sharp-only.
 */

export interface FacePreservationResult {
  processedImageUrl: string;
  faceEnhanced: boolean;
}

export interface FaceLockResult {
  buffer: Buffer;
  applied: boolean;
}

/** Tighter paste for `category=dresses` — restores identity without pulling the original chest/strapline into the new gown. */
export interface FaceLockOptions {
  dressMode?: boolean;
  /** Minimal neck — for FASHN overlays so straps / white tanks do not get a mid-torso seam from the source photo. */
  faceOnlyMode?: boolean;
}

interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

let blazeFacePromise: Promise<BlazeFaceModel> | null = null;
/** For counting / gating: must allow multiple faces and slightly lower threshold to reduce false "no face". */
let blazeFaceCountPromise: Promise<BlazeFaceModel> | null = null;
/** Second pass when strict count is 0 (small / distant faces on full-body catalog shots). */
let blazeFaceCountLoosePromise: Promise<BlazeFaceModel> | null = null;
let tfReadyPromise: Promise<void> | null = null;

async function ensureTfBackend(): Promise<void> {
  if (!tfReadyPromise) {
    tfReadyPromise = (async () => {
      await tf.setBackend('cpu');
      await tf.ready();
    })();
  }
  await tfReadyPromise;
}

async function ensureBlazeFaceModel(): Promise<BlazeFaceModel> {
  await ensureTfBackend();
  if (!blazeFacePromise) {
    blazeFacePromise = blazefaceLoad({
      maxFaces: 1,
      scoreThreshold: 0.62,
    });
  }
  return blazeFacePromise;
}

async function ensureBlazeFaceCountModel(): Promise<BlazeFaceModel> {
  await ensureTfBackend();
  if (!blazeFaceCountPromise) {
    blazeFaceCountPromise = blazefaceLoad({
      maxFaces: 10,
      scoreThreshold: 0.44,
    });
  }
  return blazeFaceCountPromise;
}

async function ensureBlazeFaceCountModelLoose(): Promise<BlazeFaceModel> {
  await ensureTfBackend();
  if (!blazeFaceCountLoosePromise) {
    blazeFaceCountLoosePromise = blazefaceLoad({
      maxFaces: 10,
      scoreThreshold: 0.33,
    });
  }
  return blazeFaceCountLoosePromise;
}

/** Larger than face-lock detect path so small faces in full-length shots still register. */
const FACE_COUNT_MAX_DET = 896;

/** Max normalized vertical center (y / detH) for a face in full-body / catalog shots — suppresses knee/shadow false positives. */
const FACE_COUNT_MAX_CENTER_Y_FRAC = 0.72;

interface FaceCountBox {
  x: number;
  y: number;
  w: number;
  h: number;
  prob: number;
}

function readFacePoint(pt: [number, number] | tf.Tensor1D): [number, number] | null {
  if (Array.isArray(pt) && pt.length >= 2) {
    return [Number(pt[0]), Number(pt[1])];
  }
  try {
    const t = pt as tf.Tensor1D;
    const d = t.dataSync();
    return d.length >= 2 ? [Number(d[0]), Number(d[1])] : null;
  } catch {
    return null;
  }
}

function faceDetectionProbability(f: NormalizedFace): number {
  const p = f.probability;
  if (typeof p === 'number' && Number.isFinite(p)) return p;
  return 0.5;
}

function iouFaceCountBoxes(a: FaceCountBox, b: FaceCountBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.w * a.h + b.w * b.h - inter;
  return union <= 0 ? 0 : inter / union;
}

function nmsFaceCountBoxes(boxes: FaceCountBox[], iouThresh: number): FaceCountBox[] {
  const sorted = [...boxes].sort((a, b) => b.prob - a.prob);
  const kept: FaceCountBox[] = [];
  for (const b of sorted) {
    if (kept.every((k) => iouFaceCountBoxes(k, b) < iouThresh)) {
      kept.push(b);
    }
  }
  return kept;
}

function boxesFromNormalizedFaces(
  faces: NormalizedFace[],
  detW: number,
  detH: number,
  maxCenterYFrac: number | null
): FaceCountBox[] {
  const out: FaceCountBox[] = [];
  for (const f of faces) {
    const tl = readFacePoint(f.topLeft as [number, number] | tf.Tensor1D);
    const br = readFacePoint(f.bottomRight as [number, number] | tf.Tensor1D);
    if (!tl || !br) continue;
    const x = Math.min(tl[0], br[0]);
    const y = Math.min(tl[1], br[1]);
    const w = Math.abs(br[0] - tl[0]);
    const h = Math.abs(br[1] - tl[1]);
    if (w < 6 || h < 6) continue;
    const cy = (y + h / 2) / Math.max(1, detH);
    if (maxCenterYFrac !== null && cy > maxCenterYFrac) continue;
    out.push({ x, y, w, h, prob: faceDetectionProbability(f) });
  }
  return out;
}

/**
 * BlazeFace often emits overlapping boxes on one face and spurious boxes on limbs/background
 * in full-length studio shots. Prefer upper-frame candidates + NMS so strict validation matches human intent.
 */
async function countFacesWithModel(buffer: Buffer, model: BlazeFaceModel): Promise<number> {
  const meta = await sharp(buffer).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (!W || !H) return 0;
  const { data, info } = await sharp(buffer)
    .resize(FACE_COUNT_MAX_DET, FACE_COUNT_MAX_DET, { fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const detW = info.width;
  const detH = info.height;
  if (!detW || !detH || info.channels !== 3) return 0;
  const tensor = tf.cast(tf.tensor3d(new Uint8Array(data), [detH, detW, 3]), 'float32');
  try {
    const faces = await model.estimateFaces(tensor, false, false, true);
    let boxes = boxesFromNormalizedFaces(faces, detW, detH, FACE_COUNT_MAX_CENTER_Y_FRAC);
    if (boxes.length === 0 && faces.length > 0) {
      boxes = boxesFromNormalizedFaces(faces, detW, detH, null);
    }
    return nmsFaceCountBoxes(boxes, 0.42).length;
  } catch {
    return 0;
  } finally {
    tensor.dispose();
  }
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Grayscale alpha map: 255 in the interior, 0 at edges; then blurred for soft feathering.
 */
async function buildFeatherAlpha(width: number, height: number, edgePx: number): Promise<Buffer> {
  const inner = Math.max(2, edgePx);
  const buf = Buffer.alloc(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d = Math.min(x, y, width - 1 - x, height - 1 - y);
      const a = smoothstep(0, inner, d);
      buf[y * width + x] = Math.round(255 * a);
    }
  }
  return sharp(buf, { raw: { width, height, channels: 1 } })
    .blur(Math.max(0.6, inner * 0.38))
    .raw()
    .toBuffer();
}

function interleaveRgbAlpha(
  rgb: Buffer,
  alpha: Buffer,
  width: number,
  height: number,
  peakOpacity: number
): Buffer {
  const rgba = Buffer.alloc(width * height * 4);
  const n = width * height;
  const pk = Math.max(0, Math.min(1, peakOpacity));
  for (let i = 0; i < n; i++) {
    rgba[i * 4] = rgb[i * 3];
    rgba[i * 4 + 1] = rgb[i * 3 + 1];
    rgba[i * 4 + 2] = rgb[i * 3 + 2];
    rgba[i * 4 + 3] = Math.min(255, Math.round(alpha[i] * pk));
  }
  return rgba;
}

/** Extend box downward to include upper neck / jaw blend zone (input-space px). */
function extendBoxWithNeck(box: FaceBox, imgH: number, neckHeightRatio: number): FaceBox {
  const add = Math.round(box.height * Math.max(0.1, neckHeightRatio));
  let nh = box.height + add;
  const y = box.y;
  if (y + nh > imgH) nh = Math.max(box.height, imgH - y);
  return { x: box.x, y, width: box.width, height: Math.max(box.height, nh) };
}

function expandBox(box: FaceBox, imgW: number, imgH: number, relExpand: number): FaceBox {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const nw = box.width * (1 + relExpand);
  const nh = box.height * (1 + relExpand);
  let x = Math.floor(cx - nw / 2);
  let y = Math.floor(cy - nh / 2);
  let rw = Math.floor(nw);
  let rh = Math.floor(nh);
  x = Math.max(0, x);
  y = Math.max(0, y);
  rw = Math.min(rw, imgW - x);
  rh = Math.min(rh, imgH - y);
  rw = Math.max(1, rw);
  rh = Math.max(1, rh);
  return { x, y, width: rw, height: rh };
}

function scaleBoxToOutput(box: FaceBox, srcW: number, srcH: number, dstW: number, dstH: number): FaceBox {
  const sx = dstW / srcW;
  const sy = dstH / srcH;
  let x = Math.floor(box.x * sx);
  let y = Math.floor(box.y * sy);
  let w = Math.floor(box.width * sx);
  let h = Math.floor(box.height * sy);
  x = Math.max(0, Math.min(x, dstW - 1));
  y = Math.max(0, Math.min(y, dstH - 1));
  w = Math.max(1, Math.min(w, dstW - x));
  h = Math.max(1, Math.min(h, dstH - y));
  return { x, y, width: w, height: h };
}

/** Keep identity patch face-sized: never paste most of the frame (would restore the old outfit). */
function clampIdentityPatchBox(box: FaceBox, imgW: number, imgH: number): FaceBox {
  const maxH = Math.max(48, Math.floor(imgH * env.FACE_LOCK_MAX_HEIGHT_FRAC));
  const maxW = Math.max(48, Math.floor(imgW * env.FACE_LOCK_MAX_WIDTH_FRAC));
  let { x, y, width, height } = box;
  if (height > maxH) {
    height = maxH;
  }
  if (width > maxW) {
    const cx = x + width / 2;
    width = maxW;
    x = Math.max(0, Math.min(Math.floor(cx - width / 2), imgW - width));
  }
  x = Math.max(0, Math.min(x, imgW - 1));
  y = Math.max(0, Math.min(y, imgH - 1));
  width = Math.max(8, Math.min(width, imgW - x));
  height = Math.max(8, Math.min(height, imgH - y));
  return { x, y, width, height };
}

/**
 * Counts distinct faces (input gating). More lenient than face-lock box detection:
 * full-body / catalog models often have small faces — we rescale larger, try the top ~62% band,
 * then a looser BlazeFace threshold if needed.
 */
export async function countDetectedFaces(buffer: Buffer): Promise<number> {
  const meta = await sharp(buffer).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (!W || !H) return 0;

  const strictModel = await ensureBlazeFaceCountModel();
  let n = await countFacesWithModel(buffer, strictModel);
  if (n > 0) return n;

  if (H >= 480 && W >= 200) {
    const cropH = Math.min(H, Math.max(320, Math.floor(H * 0.62)));
    try {
      const top = await sharp(buffer).extract({ left: 0, top: 0, width: W, height: cropH }).jpeg({ quality: 95 }).toBuffer();
      n = await countFacesWithModel(top, strictModel);
      if (n > 0) return n;
    } catch {
      /* extract out of range etc. */
    }
  }

  const looseModel = await ensureBlazeFaceCountModelLoose();
  n = await countFacesWithModel(buffer, looseModel);
  if (n > 0) return n;

  if (H >= 480 && W >= 200) {
    const cropH = Math.min(H, Math.max(320, Math.floor(H * 0.62)));
    try {
      const top = await sharp(buffer).extract({ left: 0, top: 0, width: W, height: cropH }).jpeg({ quality: 95 }).toBuffer();
      return await countFacesWithModel(top, looseModel);
    } catch {
      return 0;
    }
  }
  return 0;
}

async function detectFaceBoundingBox(buffer: Buffer): Promise<FaceBox | null> {
  const meta = await sharp(buffer).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (!W || !H) return null;

  const maxDet = 640;
  const { data, info } = await sharp(buffer)
    .resize(maxDet, maxDet, { fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const detW = info.width;
  const detH = info.height;
  if (!detW || !detH) return null;
  const scaleX = W / detW;
  const scaleY = H / detH;

  const ch = info.channels;
  if (ch !== 3) return null;

  const tensor = tf.cast(tf.tensor3d(new Uint8Array(data), [detH, detW, 3]), 'float32');

  try {
    const model = await ensureBlazeFaceModel();
    const faces = await model.estimateFaces(tensor, false, false, false);
    if (!faces.length) return null;
    const f = faces[0] as { topLeft: [number, number]; bottomRight: [number, number] };
    const [x1, y1] = f.topLeft;
    const [x2, y2] = f.bottomRight;
    let x = Math.floor(Math.min(x1, x2) * scaleX);
    let y = Math.floor(Math.min(y1, y2) * scaleY);
    let rw = Math.ceil(Math.abs(x2 - x1) * scaleX);
    let rh = Math.ceil(Math.abs(y2 - y1) * scaleY);
    x = Math.max(0, x);
    y = Math.max(0, y);
    rw = Math.min(rw, W - x);
    rh = Math.min(rh, H - y);
    if (rw < 8 || rh < 8) return null;
    return { x, y, width: rw, height: rh };
  } catch (err) {
    logger.warn('Face detection failed', { error: String(err) });
    return null;
  } finally {
    tensor.dispose();
  }
}

/**
 * Pastes face + upper-neck region from the person image onto the try-on output (pixel-accurate identity),
 * with feathered edges and controlled peak opacity so shoulders blend naturally.
 */
export async function applyFaceLockFromPersonInput(
  personInputBuffer: Buffer,
  vtonOutputBuffer: Buffer,
  options?: FaceLockOptions
): Promise<FaceLockResult> {
  if (!env.ENABLE_FACE_LOCK) {
    return { buffer: vtonOutputBuffer, applied: false };
  }

  try {
    const [pMeta, oMeta] = await Promise.all([
      sharp(personInputBuffer).metadata(),
      sharp(vtonOutputBuffer).metadata(),
    ]);
    const pw = pMeta.width ?? 0;
    const ph = pMeta.height ?? 0;
    const ow = oMeta.width ?? 0;
    const oh = oMeta.height ?? 0;
    if (!pw || !ph || !ow || !oh) {
      return { buffer: vtonOutputBuffer, applied: false };
    }

    const rawBox = await detectFaceBoundingBox(personInputBuffer);
    if (!rawBox) {
      logger.warn('Face lock skipped: no face in person image');
      return { buffer: vtonOutputBuffer, applied: false };
    }

    if (rawBox.height > ph * 0.52 || rawBox.width > pw * 0.62) {
      logger.warn('Face lock skipped: face box unusually large (bad detection — would cover too much of body)', {
        rawBox,
      });
      return { buffer: vtonOutputBuffer, applied: false };
    }

    const faceOnlyMode = options?.faceOnlyMode === true;
    const dressMode = options?.dressMode === true && !faceOnlyMode;
    const expandRel = faceOnlyMode ? 0.055 : dressMode ? 0.11 : 0.16;
    const neckRatio = faceOnlyMode
      ? 0.035
      : dressMode
        ? Math.min(env.FACE_LOCK_NECK_EXTENSION_RATIO, 0.14)
        : env.FACE_LOCK_NECK_EXTENSION_RATIO;
    const expanded = expandBox(rawBox, pw, ph, expandRel);
    const withNeck = extendBoxWithNeck(expanded, ph, neckRatio);
    const clamped = clampIdentityPatchBox(withNeck, pw, ph);
    const boxOut = scaleBoxToOutput(clamped, pw, ph, ow, oh);

    let patchRgb = await sharp(personInputBuffer)
      .extract({
        left: clamped.x,
        top: clamped.y,
        width: clamped.width,
        height: clamped.height,
      })
      .removeAlpha()
      .raw()
      .toBuffer();

    if (boxOut.width !== clamped.width || boxOut.height !== clamped.height) {
      patchRgb = await sharp(personInputBuffer)
        .extract({
          left: clamped.x,
          top: clamped.y,
          width: clamped.width,
          height: clamped.height,
        })
        .resize(boxOut.width, boxOut.height, { fit: 'fill' })
        .removeAlpha()
        .raw()
        .toBuffer();
    }

    const featherPx = Math.max(
      env.FACE_LOCK_FEATHER_MIN_PX,
      Math.min(12, Math.round(Math.min(boxOut.width, boxOut.height) * 0.065))
    );
    const alpha = await buildFeatherAlpha(boxOut.width, boxOut.height, featherPx);
    const rgba = interleaveRgbAlpha(
      patchRgb,
      alpha,
      boxOut.width,
      boxOut.height,
      env.FACE_LOCK_BLEND_OPACITY
    );
    const overlay = await sharp(rgba, {
      raw: { width: boxOut.width, height: boxOut.height, channels: 4 },
    })
      .png()
      .toBuffer();

    const out = await sharp(vtonOutputBuffer)
      .composite([{ input: overlay, left: boxOut.x, top: boxOut.y, blend: 'over' }])
      .jpeg({
        quality: env.TRYON_AI_JPEG_QUALITY,
        mozjpeg: true,
        progressive: true,
        chromaSubsampling: '4:4:4',
      })
      .toBuffer();

    logger.info('Face lock applied', { box: boxOut, dressMode, faceOnlyMode });
    return { buffer: out, applied: true };
  } catch (err) {
    logger.error('Face lock failed, using VTON output', { error: String(err) });
    return { buffer: vtonOutputBuffer, applied: false };
  }
}

/**
 * GFPGAN via Replicate — optional; keep disabled when using face lock to avoid changing identity.
 */
export async function preserveFace(generatedImageUrl: string): Promise<FacePreservationResult> {
  if (!env.ENABLE_FACE_PRESERVATION) {
    return { processedImageUrl: generatedImageUrl, faceEnhanced: false };
  }

  logger.info('Running face preservation (GFPGAN)');

  try {
    await waitForReplicateSlot();
    const output = await replicate.run(
      env.REPLICATE_MODEL_GFPGAN as `${string}/${string}:${string}`,
      {
        input: {
          img: generatedImageUrl,
          scale: 2,
          version: 'v1.4',
          face_enhance: true,
        },
      }
    );

    const enhancedUrl = extractUrl(output);
    if (!enhancedUrl) {
      logger.warn('Face preservation returned no output, using original');
      return { processedImageUrl: generatedImageUrl, faceEnhanced: false };
    }

    logger.info('Face preservation (GFPGAN) complete');
    return { processedImageUrl: enhancedUrl, faceEnhanced: true };
  } catch (err) {
    logger.error('Face preservation failed, using original', { error: String(err) });
    return { processedImageUrl: generatedImageUrl, faceEnhanced: false };
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
