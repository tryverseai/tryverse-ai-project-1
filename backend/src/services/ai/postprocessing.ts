import sharp from 'sharp';
import { logger } from '../../config/logger';
import { env } from '../../config/env';

/**
 * STAGE 4 — POST-PROCESSING
 *
 * After AI generation, the result often has:
 * - Slightly off colors vs. original scene lighting
 * - Harsh transitions between generated garment and real background
 * - Flat shadows that look artificial
 *
 * This stage applies:
 *   1. Color correction — match natural skin tones and garment color accuracy
 *   2. Lighting normalization — blend the generated item into scene lighting
 *   3. Shadow enhancement — add soft natural shadow under garments
 *   4. Sharpness + clarity — ensure the result is crisp, not AI-blurry
 *   5. Final compression optimization for CDN delivery
 */

export interface PostProcessResult {
  buffer: Buffer;
  mimeType: 'image/jpeg';
  widthPx: number;
  heightPx: number;
}

/**
 * Applies the full post-processing pipeline to a try-on result image.
 */
export async function postProcessResult(imageUrl: string): Promise<PostProcessResult> {
  logger.info('Post-processing try-on result');

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Failed to fetch result: ${response.statusText}`);
    return postProcessResultBuffer(Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    logger.error('Post-processing failed, fetching original', { error: String(err) });
    const response = await fetch(imageUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    const meta = await sharp(buffer).metadata();
    return { buffer, mimeType: 'image/jpeg', widthPx: meta.width || 768, heightPx: meta.height || 1024 };
  }
}

/**
 * Minimal pass for FASHN (and similar) outputs: no sharpen — global sharpen exaggerates soft facial regions.
 */
export async function postProcessResultBufferMinimal(inputBuffer: Buffer): Promise<PostProcessResult> {
  try {
    /** No modulate/sharpen — avoids ringing on high-contrast garment edges (e.g. white on studio white). */
    const processed = await sharp(inputBuffer)
      .jpeg({
        quality: 96,
        progressive: true,
        chromaSubsampling: '4:4:4',
        mozjpeg: true,
      })
      .toBuffer();
    const meta = await sharp(processed).metadata();
    logger.info('Post-processing complete (minimal)', { width: meta.width, height: meta.height });
    return {
      buffer: processed,
      mimeType: 'image/jpeg',
      widthPx: meta.width || 768,
      heightPx: meta.height || 1024,
    };
  } catch (err) {
    logger.error('Minimal post-processing failed, returning input', { error: String(err) });
    const meta = await sharp(inputBuffer).metadata();
    return {
      buffer: inputBuffer,
      mimeType: 'image/jpeg',
      widthPx: meta.width || 768,
      heightPx: meta.height || 1024,
    };
  }
}

/** Same pipeline as {@link postProcessResult} without an intermediate fetch (e.g. after in-memory face lock). */
export async function postProcessResultBuffer(inputBuffer: Buffer): Promise<PostProcessResult> {
  try {
    const processed = await applyEnhancements(inputBuffer);
    const meta = await sharp(processed).metadata();
    logger.info('Post-processing complete', { width: meta.width, height: meta.height });
    return {
      buffer: processed,
      mimeType: 'image/jpeg',
      widthPx: meta.width || 768,
      heightPx: meta.height || 1024,
    };
  } catch (err) {
    logger.error('Post-processing failed on buffer, returning input', { error: String(err) });
    const meta = await sharp(inputBuffer).metadata();
    return {
      buffer: inputBuffer,
      mimeType: 'image/jpeg',
      widthPx: meta.width || 768,
      heightPx: meta.height || 1024,
    };
  }
}

/**
 * Applies multi-step image enhancements using Sharp.
 */
async function applyEnhancements(inputBuffer: Buffer): Promise<Buffer> {
  const pipeline = sharp(inputBuffer);
  const vivid = env.TRYON_POST_PROCESS_STYLE === 'vivid';

  if (!vivid) {
    // Natural / editorial: minimal change so scene lighting and skin stay closer to the model output.
    return pipeline
      .modulate({ saturation: 1.03, brightness: 1.01, hue: 0 })
      .gamma(1.02)
      .linear(1.01, -1)
      .sharpen({ sigma: 0.45, m1: 1.0, m2: 1.5, x1: 2.0, y2: 10.0, y3: 18.0 })
      .jpeg({
        quality: 96,
        progressive: true,
        chromaSubsampling: '4:4:4',
        mozjpeg: true,
      })
      .toBuffer();
  }

  return pipeline
    .modulate({
      saturation: 1.08,
      brightness: 1.02,
      hue: 0,
    })
    .gamma(1.05)
    .linear(1.03, -3)
    .sharpen({
      sigma: 0.8,
      m1: 1.0,
      m2: 2.0,
      x1: 2.0,
      y2: 10.0,
      y3: 20.0,
    })
    .jpeg({
      quality: 93,
      progressive: true,
      chromaSubsampling: '4:4:4',
      mozjpeg: true,
    })
    .toBuffer();
}

/**
 * Adds a soft natural shadow beneath the garment area.
 * Uses a gradient overlay composited at low opacity.
 */
export async function addGarmentShadow(imageBuffer: Buffer): Promise<Buffer> {
  try {
    const meta = await sharp(imageBuffer).metadata();
    const { width = 768, height = 1024 } = meta;

    // Create a vertical gradient: transparent top, soft shadow at bottom of garment area
    // Shadow appears in the lower third, simulating ground/floor shadow
    const shadowHeight = Math.floor(height * 0.15);
    const shadowWidth = width;

    // SVG gradient shadow overlay
    const shadowSvg = `
      <svg width="${shadowWidth}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="shadow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="black" stop-opacity="0"/>
            <stop offset="100%" stop-color="black" stop-opacity="0.12"/>
          </linearGradient>
        </defs>
        <rect x="0" y="${height - shadowHeight}" width="${shadowWidth}" height="${shadowHeight}" fill="url(#shadow)"/>
      </svg>
    `;

    return sharp(imageBuffer)
      .composite([
        { input: Buffer.from(shadowSvg), blend: 'multiply', gravity: 'south' },
      ])
      .jpeg({
        quality: env.TRYON_POST_PROCESS_STYLE === 'vivid' ? 93 : 96,
        progressive: true,
        chromaSubsampling: '4:4:4',
        mozjpeg: true,
      })
      .toBuffer();
  } catch (err) {
    logger.warn('Shadow addition failed, returning without shadow', { error: String(err) });
    return imageBuffer;
  }
}
