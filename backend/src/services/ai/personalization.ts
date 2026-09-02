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
import { fetchRemoteMedia } from '../../lib/fetchRemoteMedia';
import { TRUSTED_FASHN_OUTPUT_HOSTS } from '../../lib/fashnHosts';

const PERSONALIZATION_IMAGE_MAX_BYTES = 20 * 1024 * 1024; // 20 MB cap, matching other FASHN image results.

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

  const { buffer } = await fetchRemoteMedia(swapped.resultUrl, {
    label: 'generatePersonalizedModel',
    maxBytes: PERSONALIZATION_IMAGE_MAX_BYTES,
    allowedHosts: TRUSTED_FASHN_OUTPUT_HOSTS,
  });
  const resultPath = await uploadResultBuffer(buffer, input.userId, true);

  const durationMs = Date.now() - startMs;
  logger.info('Personalization: complete', { durationMs, resultPath });

  return { resultPath, durationMs };
}

export function isPersonalizationEnabled(): boolean {
  return isFashnDirectEnabled();
}
