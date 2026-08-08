import sharp from 'sharp';

const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);

/**
 * Verify buffer is a real image (magic bytes via sharp) and matches allowed types.
 * Rejects polyglot / mismatched Content-Type uploads.
 */
export async function validateImageBuffer(buffer: Buffer): Promise<'image/jpeg' | 'image/png' | 'image/webp'> {
  // Derived from sharp's own return type rather than the `sharp.Metadata` namespace reference —
  // sharp 0.35's type definitions no longer resolve that reference the same way under this
  // tsconfig, and deriving it this way is robust to that regardless of the underlying cause.
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    throw new Error('Invalid or corrupted image file');
  }
  const format = meta.format;
  if (!format || !ALLOWED_FORMATS.has(format)) {
    throw new Error('Only JPEG, PNG, and WebP images are accepted');
  }
  const mime =
    format === 'jpeg' ? 'image/jpeg' : format === 'png' ? 'image/png' : 'image/webp';
  return mime;
}
