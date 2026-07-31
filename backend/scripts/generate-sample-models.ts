/**
 * Pre-generates a batch of sample AI fashion models via Replicate and saves them as static
 * assets under the frontend's public/ai-model-samples/ — a starter set so "Generate AI Model"
 * has example output to show, independent of any single Enterprise account's private library.
 *
 * Spends real Replicate credits. Run: npx tsx scripts/generate-sample-models.ts
 */
import path from 'path';
import fs from 'fs/promises';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env') });

import Replicate from 'replicate';
import { env } from '../src/config/env';
import { buildPrompt, type AiModelGenerationParams } from '../src/services/ai/modelGeneration';

const replicate = new Replicate({ auth: env.REPLICATE_API_TOKEN });

const OUT_DIR = path.join(__dirname, '../../public/ai-model-samples');

const SAMPLES: Array<{ slug: string } & AiModelGenerationParams> = [
  { slug: 'sample-02-femme-street', gender: 'Female', skinTone: 'Deep', pose: 'Walking', age: '18–25', hair: 'Curly', background: 'Urban street', fashionStyle: 'Streetwear' },
  { slug: 'sample-04-femme-athletic', gender: 'Female', skinTone: 'Tan', pose: 'Standing', age: '18–25', hair: 'Coily', background: 'Studio white', fashionStyle: 'Athletic' },
  { slug: 'sample-08-homme-minimal', gender: 'Male', skinTone: 'Tan', pose: 'Side profile', age: '26–35', hair: 'Wavy', background: 'Studio white', fashionStyle: 'Minimalist' },
];

async function generateOne(sample: (typeof SAMPLES)[number]): Promise<void> {
  const model = env.REPLICATE_MODEL_AI_MODEL_GENERATION;
  const prompt = buildPrompt(sample);
  console.log(`Generating ${sample.slug}…`);

  const output = await replicate.run(model as `${string}/${string}:${string}`, {
    input: { prompt, aspect_ratio: '3:4', output_format: 'jpg', num_outputs: 1 },
  });

  const urlHolder = Array.isArray(output) ? output[0] : output;
  const imageUrl =
    typeof urlHolder === 'string'
      ? urlHolder
      : typeof (urlHolder as { url?: () => string })?.url === 'function'
        ? (urlHolder as { url: () => string }).url()
        : String(urlHolder);

  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${sample.slug}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(path.join(OUT_DIR, `${sample.slug}.jpg`), buffer);
  console.log(`  saved ${sample.slug}.jpg`);
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const manifestPath = path.join(OUT_DIR, 'manifest.json');
  let manifest: Array<{ slug: string; params: AiModelGenerationParams; file: string }> = [];
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
  } catch {
    /* no existing manifest */
  }
  for (const sample of SAMPLES) {
    const { slug, ...params } = sample;
    try {
      await generateOne(sample);
      manifest = manifest.filter((m) => m.slug !== slug);
      manifest.push({ slug, params, file: `/ai-model-samples/${slug}.jpg` });
    } catch (e) {
      console.error(`  FAILED ${slug}:`, e instanceof Error ? e.message : e);
    }
  }
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Done. ${manifest.length}/${SAMPLES.length} generated. Manifest written.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
