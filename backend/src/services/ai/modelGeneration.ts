import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { uploadResultBuffer } from '../storage/images';
import { anyApi, convexMutationTrusted, convexQueryTrusted } from '../../config/convexHttp';
import { AppError } from '../../middleware/errorHandler';
import { FashionGenerationProvider } from './fashionGenerationProvider';
import { fetchRemoteMedia } from '../../lib/fetchRemoteMedia';
import { TRUSTED_FASHN_OUTPUT_HOSTS } from '../../lib/fashnHosts';

const AI_MODEL_IMAGE_MAX_BYTES = 20 * 1024 * 1024; // 20 MB cap, matching other FASHN image results.

export interface AiModelGenerationParams {
  /** Free-text description of the model the brand wants — e.g. "professional African fashion
   * model, female, age 28, dark skin, studio lighting, luxury editorial fashion campaign." */
  prompt: string;
}

export interface SavedAiModel {
  id: string;
  storagePath: string;
  params: AiModelGenerationParams;
  createdAt: string;
}

export function buildPrompt(p: AiModelGenerationParams): string {
  return [
    p.prompt.trim(),
    'professional fashion photography, high detail, editorial quality, photorealistic, full body shot',
  ].join(', ');
}

/**
 * Generates a single consistent AI fashion model image via FASHN's `model-create` (text prompt →
 * model image, no input photo required — https://docs.fashn.ai/api-reference/model-create) and
 * stores it in Convex, then saves the library entry. Credit-metered on every plan — see
 * `reserveGenerationCredits` in routes/aiStudio.ts.
 */
export async function generateAndSaveAiModel(
  userId: string,
  params: AiModelGenerationParams
): Promise<SavedAiModel> {
  const prompt = buildPrompt(params);

  logger.info('Generating AI fashion model', { userId, provider: 'fashn', model: 'model-create' });

  let resultUrl: string;
  try {
    const result = await FashionGenerationProvider.createModel({ prompt, aspectRatio: '3:4' });
    resultUrl = result.resultUrl;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // FASHN's safety filter can flag entirely benign prompts (false positives are common for
    // words like "model"/"fashion") — surface this one specific, actionable case instead of a
    // dead-end generic error; everything else stays generic (no internal provider details leak).
    if (/nsfw|safety|content policy/i.test(message)) {
      throw new AppError(
        'This prompt was flagged by the safety filter — try rephrasing it (this can happen even for ordinary fashion prompts).',
        422,
        'AI_MODEL_NSFW_FLAGGED'
      );
    }
    throw new Error(`AI model generation failed: ${message}`);
  }

  const { buffer } = await fetchRemoteMedia(resultUrl, {
    label: 'generateAndSaveAiModel',
    maxBytes: AI_MODEL_IMAGE_MAX_BYTES,
    allowedHosts: TRUSTED_FASHN_OUTPUT_HOSTS,
  });

  const storagePath = await uploadResultBuffer(buffer, userId, true);

  const saved = (await convexMutationTrusted(anyApi.backendTrusted.saveGeneratedAiModel, {
    secret: env.BACKEND_SHARED_SECRET,
    userId,
    storagePath,
    params,
  })) as { id: string };

  await convexMutationTrusted(anyApi.backendTrusted.logAiGenerationUsage, {
    secret: env.BACKEND_SHARED_SECRET,
    userId,
    feature: 'ai_model',
  });

  return { id: saved.id, storagePath, params, createdAt: new Date().toISOString() };
}

export async function listSavedAiModels(userId: string): Promise<SavedAiModel[]> {
  return convexQueryTrusted<SavedAiModel[]>(anyApi.backendTrusted.listGeneratedAiModels, {
    secret: env.BACKEND_SHARED_SECRET,
    userId,
  });
}

export async function archiveSavedAiModel(userId: string, modelId: string): Promise<void> {
  await convexMutationTrusted(anyApi.backendTrusted.archiveGeneratedAiModel, {
    secret: env.BACKEND_SHARED_SECRET,
    userId,
    modelId,
  });
}
