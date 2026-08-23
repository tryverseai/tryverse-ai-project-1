import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { getSignedUrl, uploadResultBuffer, INPUT_BUCKET, RESULT_BUCKET } from '../storage/images';
import { anyApi, convexMutationTrusted, convexQueryTrusted } from '../../config/convexHttp';
import { resolveModelImageUrl } from '../models/modelLibrary';
import { AppError } from '../../middleware/errorHandler';
import { FashionGenerationProvider } from './fashionGenerationProvider';

export type PhotoshootModelSource = 'library' | 'generated';

export interface ProductPhotoshootParams {
  productStoragePath: string;
  modelId: string;
  modelSource: PhotoshootModelSource;
  background?: string;
  theme?: string;
  lighting?: string;
}

export interface ProductPhotoshootResult {
  storagePath: string;
  createdAt: string;
}

/**
 * Resolves the chosen model (stock library or the brand's own saved AI-generated model) to a
 * fetchable image URL. Exported for reuse by the Outfit Builder (`aiStudio.ts` outfit routes),
 * which picks a model the same way this feature does.
 */
export async function resolveModelUrl(userId: string, modelId: string, source: PhotoshootModelSource): Promise<string> {
  if (source === 'library') {
    const row = await convexQueryTrusted<{ id: string; image_url: string; is_active: boolean } | null>(
      anyApi.backendTrusted.getModelForResolvePath,
      { secret: env.BACKEND_SHARED_SECRET, idOrSlug: modelId }
    );
    if (!row || !row.is_active) throw new AppError('Model not found or inactive', 404);
    return resolveModelImageUrl(row.image_url);
  }

  const saved = (await convexQueryTrusted(anyApi.backendTrusted.listGeneratedAiModels, {
    secret: env.BACKEND_SHARED_SECRET,
    userId,
  })) as Array<{ id: string; storagePath: string }>;
  const match = saved.find((m) => m.id === modelId);
  if (!match) throw new AppError('Saved model not found', 404);
  return getSignedUrl(RESULT_BUCKET, match.storagePath);
}

/**
 * Generates a professional product-photography composite: the brand's own uploaded product photo,
 * shown on a model they picked (from the stock library or their saved AI-generated models).
 * Credit-metered on every plan — see `reserveGenerationCredits` in routes/aiStudio.ts.
 *
 * FASHN has no single endpoint for "composite this product onto this exact pre-chosen model
 * photo" — `product-to-model` (see fashn.ts) generates a new person from the product photo, it
 * doesn't accept a full pre-chosen model image. So this chains two real FASHN endpoints:
 *   1. product-to-model — the product photo becomes a photorealistic on-model shot in the
 *      requested scene (FASHN generates the person).
 *   2. model-swap, with `face_reference` set to the brand's actual chosen model photo — pulls the
 *      generated person's identity toward the chosen model while preserving the garment from
 *      step 1.
 * This is an identity-guided approximation (FASHN's `face_reference` locks facial identity, not
 * full body characteristics) — not a pixel-perfect reuse of the chosen model photo the way the
 * previous Replicate Flux Kontext call was, but it's the correct FASHN-native way to approach this
 * and needs no Replicate dependency. Costs 2 FASHN predictions instead of 1 — see CREDIT_COSTS.
 */
export async function generateProductPhotoshoot(
  userId: string,
  params: ProductPhotoshootParams
): Promise<ProductPhotoshootResult> {
  const [productUrl, modelUrl] = await Promise.all([
    getSignedUrl(INPUT_BUCKET, params.productStoragePath),
    resolveModelUrl(userId, params.modelId, params.modelSource),
  ]);

  const { id: generationId } = (await convexMutationTrusted(anyApi.backendTrusted.insertPhotoshootGeneration, {
    secret: env.BACKEND_SHARED_SECRET,
    userId,
    productStoragePath: params.productStoragePath,
    modelId: params.modelId,
    modelSource: params.modelSource,
    theme: params.theme,
    lighting: params.lighting,
    background: params.background,
  })) as { id: string };

  const scenePrompt = [
    'Photorealistic e-commerce product photography.',
    `${params.theme || 'contemporary catalog'} theme, ${params.lighting || 'soft studio'} lighting,`,
    `${params.background || 'clean neutral'} background.`,
    'Commercial fashion catalog quality, sharp focus, no visible AI artifacts.',
  ].join(' ');

  logger.info('Generating product photoshoot', { userId, generationId, provider: 'fashn' });

  try {
    logger.info('Photoshoot step 1/2: product-to-model', { userId, generationId });
    const onModel = await FashionGenerationProvider.productToModel({
      productImageUrl: productUrl,
      prompt: scenePrompt,
    });

    logger.info('Photoshoot step 2/2: model-swap to chosen model', { userId, generationId });
    const swapped = await FashionGenerationProvider.swapModel({
      modelImageUrl: onModel.resultUrl,
      faceReferenceUrl: modelUrl,
    });

    const res = await fetch(swapped.resultUrl);
    if (!res.ok) throw new Error(`Failed to download photoshoot image (${res.status})`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const storagePath = await uploadResultBuffer(buffer, userId, true);

    await convexMutationTrusted(anyApi.backendTrusted.patchPhotoshootGeneration, {
      secret: env.BACKEND_SHARED_SECRET,
      id: generationId,
      patch: { status: 'completed', result_image: storagePath, completed_at: new Date().toISOString() },
    });
    await convexMutationTrusted(anyApi.backendTrusted.logAiGenerationUsage, {
      secret: env.BACKEND_SHARED_SECRET,
      userId,
      feature: 'ai_photoshoot',
    });

    return { storagePath, createdAt: new Date().toISOString() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Product photoshoot failed', { userId, generationId, error: message });
    await convexMutationTrusted(anyApi.backendTrusted.patchPhotoshootGeneration, {
      secret: env.BACKEND_SHARED_SECRET,
      id: generationId,
      patch: { status: 'failed', error: 'Could not generate this photoshoot right now', completed_at: new Date().toISOString() },
    });
    throw err;
  }
}
