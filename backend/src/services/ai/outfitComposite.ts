import sharp from 'sharp';
import { logger } from '../../config/logger';
import type { OutfitSlots } from './outfitSlots';
import { OUTFIT_SLOT_ORDER } from './outfitSlots';
import { isPrivateOrBlockedHost } from '../../lib/ssrfGuard';

const CANVAS_SIZE = 1200;
const CELL_PADDING = 28;
const CANVAS_BACKGROUND = { r: 255, g: 255, b: 255, alpha: 1 } as const;

const IMAGE_MAX_BYTES = 15 * 1024 * 1024; // 15MB cap per product photo

/**
 * Fetches an arbitrary product image URL with the same SSRF guard used by
 * `services/storage/images.ts::storeResultImage` (HTTPS-only, private-host blocklist, size cap) —
 * product `image_url` values are brand-supplied and not necessarily Convex storage paths.
 */
async function fetchProductImageBuffer(imageUrl: string): Promise<Buffer> {
  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    throw new Error(`Invalid product image URL: ${imageUrl.slice(0, 120)}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Only HTTPS product image URLs are allowed');
  }
  if (isPrivateOrBlockedHost(parsed.hostname)) {
    throw new Error('Product image URL host not allowed');
  }

  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Failed to fetch product image (${response.status})`);

  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > IMAGE_MAX_BYTES) {
    throw new Error('Product image exceeds size limit');
  }
  const raw = await response.arrayBuffer();
  if (raw.byteLength > IMAGE_MAX_BYTES) {
    throw new Error('Product image exceeds size limit');
  }
  return Buffer.from(raw);
}

/**
 * Normalizes one product photo onto a fixed-size padded white cell — the single biggest lever on
 * composite quality. Without this, a large shoe photo and a small cropped top thumbnail get
 * composited at wildly different apparent scales, and FASHN reads the result as a messy collage
 * rather than a coherent outfit.
 */
async function buildCell(imageUrl: string, cellWidth: number, cellHeight: number): Promise<Buffer> {
  const raw = await fetchProductImageBuffer(imageUrl);
  const innerW = Math.max(1, Math.round(cellWidth) - CELL_PADDING * 2);
  const innerH = Math.max(1, Math.round(cellHeight) - CELL_PADDING * 2);
  return sharp(raw)
    .resize({
      width: innerW,
      height: innerH,
      fit: 'contain',
      background: CANVAS_BACKGROUND,
    })
    .extend({
      top: CELL_PADDING,
      bottom: CELL_PADDING,
      left: CELL_PADDING,
      right: CELL_PADDING,
      background: CANVAS_BACKGROUND,
    })
    .toBuffer();
}

/** Grid position for a given slot count (1–4), reading top-to-bottom, left-to-right. */
function layoutFor(count: number): Array<{ x: number; y: number; w: number; h: number }> {
  const half = CANVAS_SIZE / 2;
  switch (count) {
    case 1:
      return [{ x: 0, y: 0, w: CANVAS_SIZE, h: CANVAS_SIZE }];
    case 2:
      // Stacked vertically — matches how a real flat-lay shows a top above a bottom.
      return [
        { x: 0, y: 0, w: CANVAS_SIZE, h: half },
        { x: 0, y: half, w: CANVAS_SIZE, h: half },
      ];
    case 3:
      // First item (outerwear/top/one-piece) spans the top half; the other two share the bottom.
      return [
        { x: 0, y: 0, w: CANVAS_SIZE, h: half },
        { x: 0, y: half, w: half, h: half },
        { x: half, y: half, w: half, h: half },
      ];
    default:
      // 4 items — classic 2x2 grid.
      return [
        { x: 0, y: 0, w: half, h: half },
        { x: half, y: 0, w: half, h: half },
        { x: 0, y: half, w: half, h: half },
        { x: half, y: half, w: half, h: half },
      ];
  }
}

/**
 * Composites the selected products (per validated `OutfitSlots`) into a single flat-lay JPEG —
 * the same trick proven by hand (multiple garments in one picture-frame image + a prompt) rather
 * than FASHN accepting multiple garment inputs, which it does not.
 */
export async function buildOutfitFlatLay(slots: OutfitSlots): Promise<Buffer> {
  const present = OUTFIT_SLOT_ORDER
    .map((slot) => ({ slot, imageUrl: slots[slot] }))
    .filter((s): s is { slot: keyof OutfitSlots; imageUrl: string } => Boolean(s.imageUrl));

  if (present.length === 0) {
    throw new Error('buildOutfitFlatLay: no product images provided');
  }

  const positions = layoutFor(present.length);

  const cells = await Promise.all(
    present.map((item, i) => buildCell(item.imageUrl, positions[i].w, positions[i].h))
  );

  logger.info('Outfit flat-lay: compositing', { slots: present.map((p) => p.slot) });

  const composite = await sharp({
    create: {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      channels: 3,
      background: CANVAS_BACKGROUND,
    },
  })
    .composite(
      cells.map((cellBuffer, i) => ({
        input: cellBuffer,
        top: Math.round(positions[i].y),
        left: Math.round(positions[i].x),
      }))
    )
    .jpeg({ quality: 94, progressive: true, mozjpeg: true })
    .toBuffer();

  return composite;
}
