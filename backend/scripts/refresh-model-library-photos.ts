/**
 * Refreshes the existing model-library photos programmatically — no AI vendor, no Replicate.
 * "Redesign" here means: consistent framing/aspect ratio, color & contrast normalization,
 * sharpening, and clean edges — a real touch-up pass on the photos that are already there.
 *
 * Originals are preserved under public/model-library/_originals/ before overwriting.
 *
 * Run: npx tsx scripts/refresh-model-library-photos.ts
 */
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';

const LIB_DIR = path.join(__dirname, '../../public/model-library');
const BACKUP_DIR = path.join(LIB_DIR, '_originals');

const TARGET_WIDTH = 1024;
const TARGET_ASPECT = 4 / 5; // portrait catalog-style crop

async function refreshOne(file: string): Promise<void> {
  const src = path.join(LIB_DIR, file);
  const buffer = await fs.readFile(src);
  const meta = await sharp(buffer).metadata();
  if (!meta.width || !meta.height) return;

  const targetHeight = Math.round(TARGET_WIDTH / TARGET_ASPECT);

  const refreshed = await sharp(buffer)
    // Crop-to-cover a consistent 4:5 portrait frame, keeping the subject centered.
    .resize(TARGET_WIDTH, targetHeight, { fit: 'cover', position: 'attention' })
    // Gentle normalization + sharpening — not a filter, a cleanup pass.
    .modulate({ brightness: 1.02, saturation: 1.06 })
    .linear(1.04, -6) // slight contrast lift
    .sharpen({ sigma: 0.6 })
    .png({ quality: 92, compressionLevel: 8 })
    .toBuffer();

  await fs.writeFile(src, refreshed);
  console.log(`refreshed ${file} (${meta.width}x${meta.height} -> ${TARGET_WIDTH}x${targetHeight})`);
}

async function main() {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const entries = await fs.readdir(LIB_DIR);
  const pngs = entries.filter((f) => f.toLowerCase().endsWith('.png'));

  for (const file of pngs) {
    const src = path.join(LIB_DIR, file);
    const backupPath = path.join(BACKUP_DIR, file);
    try {
      await fs.access(backupPath);
    } catch {
      await fs.copyFile(src, backupPath);
    }
  }
  console.log(`Backed up ${pngs.length} originals to public/model-library/_originals/`);

  let done = 0;
  for (const file of pngs) {
    try {
      await refreshOne(file);
      done++;
    } catch (e) {
      console.error(`FAILED ${file}:`, e instanceof Error ? e.message : e);
    }
  }
  console.log(`Done. ${done}/${pngs.length} refreshed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
