import sharp from 'sharp';
import { logger } from '../../config/logger';
import { env } from '../../config/env';

/** IDM-VTON expects portrait ~3:4 (width:height). Height/width = 4/3. */
const PORTRAIT_HW = 4 / 3;

/**
 * Images with height/width below this are treated as "tight" (head-and-shoulders,
 * upper chest). We composite them smaller in the upper part of a 3:4 canvas so
 * the model can extend the garment into the lower region instead of cropping
 * the product integrity.
 */
const TIGHT_PORTRAIT_THRESHOLD = 1.52;

/** Max fraction of canvas height the subject may occupy when using tight framing. */
const TIGHT_SUBJECT_HEIGHT_FRAC = 0.64;

/**
 * Prepare person image for clothing (IDM-VTON): stable 3:4 canvas, no lossy crop.
 * - Tight portraits: scale subject into upper ~64% of frame, neutral padding below.
 * - Already tall / full-length style: center letterbox to 3:4 only.
 */
export async function prepareClothingPersonForIdmVton(buffer: Buffer): Promise<Buffer> {
  const meta = await sharp(buffer).metadata();
  const iw = meta.width ?? 0;
  const ih = meta.height ?? 0;
  if (!iw || !ih) return buffer;

  const ratio = ih / iw;
  const targetW = env.TRYON_AI_MAX_DIMENSION;
  const targetH = Math.round(targetW * PORTRAIT_HW);

  const bg = await sampleEdgeBackground(buffer);

  // Only "squeeze + pad below" for portrait shots that are not already tall (full-length).
  // Landscape images get plain letterboxing so we do not mis-detect them as tight bust crops.
  const isTightPortrait =
    ratio >= 1.0 && ratio < TIGHT_PORTRAIT_THRESHOLD;

  if (isTightPortrait) {
    logger.info('Clothing try-on: tight portrait framing (extra canvas below subject)', {
      iw,
      ih,
      ratio: Number(ratio.toFixed(3)),
    });

    const subjectMaxH = Math.round(targetH * TIGHT_SUBJECT_HEIGHT_FRAC);
    const scale = Math.min(subjectMaxH / ih, targetW / iw);
    const scaledW = Math.max(1, Math.round(iw * scale));
    const scaledH = Math.max(1, Math.round(ih * scale));

    const resized = await sharp(buffer)
      .resize(scaledW, scaledH, { fit: 'inside', withoutEnlargement: false })
      .flatten({ background: bg })
      .removeAlpha()
      .jpeg({
        quality: env.TRYON_AI_JPEG_QUALITY,
        mozjpeg: true,
        progressive: true,
        chromaSubsampling: '4:4:4',
      })
      .toBuffer();

    const rmeta = await sharp(resized).metadata();
    const rw = rmeta.width ?? scaledW;
    const rh = rmeta.height ?? scaledH;
    const left = Math.max(0, Math.floor((targetW - rw) / 2));

    return sharp({
      create: {
        width: targetW,
        height: targetH,
        channels: 3,
        background: bg,
      },
    })
      .composite([{ input: resized, left, top: 0 }])
      .jpeg({
        quality: env.TRYON_AI_JPEG_QUALITY,
        mozjpeg: true,
        progressive: true,
        chromaSubsampling: '4:4:4',
      })
      .toBuffer();
  }

  logger.info('Clothing try-on: letterboxing person to 3:4 (no tight-frame expansion)', {
    iw,
    ih,
    ratio: Number(ratio.toFixed(3)),
  });

  return letterboxToPortrait(buffer, targetW, targetH, bg);
}

async function letterboxToPortrait(
  buffer: Buffer,
  targetW: number,
  targetH: number,
  bg: { r: number; g: number; b: number }
): Promise<Buffer> {
  const meta = await sharp(buffer).metadata();
  const iw = meta.width ?? 0;
  const ih = meta.height ?? 0;
  if (!iw || !ih) return buffer;

  const scale = Math.min(targetW / iw, targetH / ih);
  const scaledW = Math.max(1, Math.round(iw * scale));
  const scaledH = Math.max(1, Math.round(ih * scale));

  const resized = await sharp(buffer)
    .resize(scaledW, scaledH, { fit: 'inside', withoutEnlargement: false })
    .flatten({ background: bg })
    .removeAlpha()
    .jpeg({
      quality: env.TRYON_AI_JPEG_QUALITY,
      mozjpeg: true,
      progressive: true,
      chromaSubsampling: '4:4:4',
    })
    .toBuffer();

  const rmeta = await sharp(resized).metadata();
  const rw = rmeta.width ?? scaledW;
  const rh = rmeta.height ?? scaledH;
  const left = Math.floor((targetW - rw) / 2);
  const top = Math.floor((targetH - rh) / 2);

  return sharp({
    create: {
      width: targetW,
      height: targetH,
      channels: 3,
      background: bg,
    },
  })
    .composite([{ input: resized, left, top }])
    .jpeg({
      quality: env.TRYON_AI_JPEG_QUALITY,
      mozjpeg: true,
      progressive: true,
      chromaSubsampling: '4:4:4',
    })
    .toBuffer();
}

async function sampleEdgeBackground(buffer: Buffer): Promise<{ r: number; g: number; b: number }> {
  try {
    const { data, info } = await sharp(buffer)
      .resize(32, 32, { fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    let r = 0;
    let g = 0;
    let b = 0;
    const channels = info.channels;
    const pixels = data.length / channels;
    for (let i = 0; i < data.length; i += channels) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    const n = Math.max(1, pixels);
    return {
      r: Math.round(r / n),
      g: Math.round(g / n),
      b: Math.round(b / n),
    };
  } catch {
    return { r: 245, g: 245, b: 245 };
  }
}
