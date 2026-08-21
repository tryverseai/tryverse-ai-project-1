import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { anyApi, convexMutationTrusted } from '../../config/convexHttp';
import { storeResultImage } from '../storage/images';
import { FashionGenerationProvider } from './fashionGenerationProvider';
import { restoreCredits } from '../credits';
import type { ProductModelJob, ProductModelResult } from '../../types';

/**
 * Executes one AI Model Studio job: call FASHN product-to-model, store the result. Deliberately
 * calls only leaf utilities (storage, Convex, the FASHN client) — never imports the single try-on
 * pipeline or the Outfit Builder pipeline. Mirrors `executeOutfitPipeline`'s error convention:
 * never throws for a business-logic failure, returns `{status:'failed', error}` instead.
 */
export async function executeProductModelPipeline(job: ProductModelJob): Promise<ProductModelResult> {
  const startTime = Date.now();

  try {
    logger.info('Product-model pipeline: calling FASHN', { jobId: job.jobId, generationDbId: job.generationDbId });

    const fashnResult = await FashionGenerationProvider.productToModel({
      productImageUrl: job.productImageUrl,
      faceReferenceUrl: job.faceReferenceUrl,
      prompt: job.prompt,
    });

    const resultStoragePath = await storeResultImage(fashnResult.resultUrl, job.generationDbId, job.userId);

    const processingTimeMs = Date.now() - startTime;

    await convexMutationTrusted(anyApi.backendTrusted.patchProductModelGeneration, {
      secret: env.BACKEND_SHARED_SECRET,
      id: job.generationDbId,
      patch: {
        status: 'completed',
        result_image: resultStoragePath,
        completed_at: new Date().toISOString(),
      },
    });

    await convexMutationTrusted(anyApi.backendTrusted.logAiGenerationUsage, {
      secret: env.BACKEND_SHARED_SECRET,
      userId: job.userId,
      feature: 'product_model',
    });

    logger.info('Product-model pipeline: complete', { jobId: job.jobId, generationDbId: job.generationDbId, processingTimeMs });

    return { jobId: job.jobId, status: 'completed', resultUrl: resultStoragePath, processingTimeMs };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Product-model pipeline failed', { jobId: job.jobId, generationDbId: job.generationDbId, error: message });

    await restoreCredits(job.userId, job.creditAmount);

    try {
      await convexMutationTrusted(anyApi.backendTrusted.patchProductModelGeneration, {
        secret: env.BACKEND_SHARED_SECRET,
        id: job.generationDbId,
        patch: { status: 'failed', error: 'Could not generate this right now', completed_at: new Date().toISOString() },
      });
    } catch (patchErr) {
      logger.error('Product-model pipeline: failed to record failure in Convex', {
        generationDbId: job.generationDbId,
        error: patchErr instanceof Error ? patchErr.message : String(patchErr),
      });
    }

    return {
      jobId: job.jobId,
      status: 'failed',
      error: 'Could not generate this right now',
      processingTimeMs: Date.now() - startTime,
    };
  }
}
