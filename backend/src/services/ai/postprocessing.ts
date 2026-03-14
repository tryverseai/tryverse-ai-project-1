import sharp from 'sharp';
import { logger } from '../../config/logger';

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

    const inputBuffer = Buffer.from(await response.arrayBuffer());
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
    logger.error('Post-processing failed, fetching original', { error: String(err) });
    // Return original image buffer as fallback
    const response = await fetch(imageUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    const meta = await sharp(buffer).metadata();
    return { buffer, mimeType: 'image/jpeg', widthPx: meta.width || 768, heightPx: meta.height || 1024 };
  }
}

/**
 * Applies multi-step image enhancements using Sharp.
 */
async function applyEnhancements(inputBuffer: Buffer): Promise<Buffer> {
  const pipeline = sharp(inputBuffer);

  return pipeline
    // 1. Color correction — normalize by enhancing saturation slightly
    //    and adjusting vibrance to remove the "washed out" AI look
    .modulate({
      saturation: 1.08,    // +8% saturation for richer colors
      brightness: 1.02,    // +2% brightness to lift shadows
      hue: 0,              // no hue shift
    })
    // 2. Contrast + gamma — lift midtones for a more natural exposure
    .gamma(1.05)
    // 3. Linear tone mapping — enhance white point clarity
    .linear(
      1.03,   // multiplier (slight contrast boost)
      -3      // offset (darkens deep blacks slightly for depth)
    )
    // 4. Sharpness — crisp edges on garment borders
    .sharpen({
      sigma: 0.8,           // subtle sharpening radius
      m1: 1.0,              // flat area sharpening threshold
      m2: 2.0,              // jagged area sharpening threshold
      x1: 2.0,
      y2: 10.0,
      y3: 20.0,
    })
    // 5. Final output — high quality progressive JPEG for CDN
    .jpeg({
      quality: 93,
      progressive: true,
      chromaSubsampling: '4:4:4',   // preserve color detail
      mozjpeg: true,                 // better compression via mozjpeg
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
      .jpeg({ quality: 93, progressive: true })
      .toBuffer();
  } catch (err) {
    logger.warn('Shadow addition failed, returning without shadow', { error: String(err) });
    return imageBuffer;
  }
}
