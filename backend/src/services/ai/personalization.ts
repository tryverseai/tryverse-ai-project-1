/**
 * AI Model Personalization — replaces the model's identity in an existing product photograph
 * with the shopper's own likeness, while preserving the garment, pose, framing, and styling.
 *
 * Previously implemented via OpenAI's gpt-image-1 (images.edit with multi-image input). Migrated
 * to FASHN's `model-swap` endpoint once confirmed (docs.fashn.ai/api-reference/model-swap) that
 * it does exactly this: "Change the identity of fashion models in existing images while
 * preserving clothing and outfit details" via a `model_image` (the product photo) + optional
 * `face_reference` (the identity to apply) — a 1:1 match for this feature's inputs, and keeps
 * TryVerse on a single AI provider instead of two.
 */
import { logger } from '../../config/logger';
import { uploadResultBuffer } from '../storage/images';
import { FashionGenerationProvider } from './fashionGenerationProvider';
import { isFashnDirectEnabled } from './fashn';

export interface PersonalizeInput {
  /** URL of the product photograph containing the original model. */
  productImageUrl: string;
  /** URL of the shopper's reference photo (already uploaded to storage for the session). */
  referenceImageUrl: string;
  /** Optional user ID for storage namespacing. */
  userId?: string;
}

export interface PersonalizeOutput {
  /** Storage path of the generated personalized image. */
  resultPath: string;
  /** Duration in milliseconds. */
  durationMs: number;
}

export async function generatePersonalizedModel(input: PersonalizeInput): Promise<PersonalizeOutput> {
  const startMs = Date.now();

  logger.info('Personalization: swapping model identity');

  const swapped = await FashionGenerationProvider.swapModel({
    modelImageUrl: input.productImageUrl,
    faceReferenceUrl: input.referenceImageUrl,
  });

  const res = await fetch(swapped.resultUrl);
  if (!res.ok) throw new Error(`Failed to download personalization result (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const resultPath = await uploadResultBuffer(buffer, input.userId, true);

  const durationMs = Date.now() - startMs;
  logger.info('Personalization: complete', { durationMs, resultPath });

  return { resultPath, durationMs };
}

export function isPersonalizationEnabled(): boolean {
  return isFashnDirectEnabled();
}
