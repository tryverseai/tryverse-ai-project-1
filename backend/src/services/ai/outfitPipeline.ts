import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { anyApi, convexMutationTrusted } from '../../config/convexHttp';
import { uploadResultBuffer, storeResultImage, getSignedUrl, RESULT_BUCKET } from '../storage/images';
import { buildOutfitFlatLay } from './outfitComposite';
import { buildOutfitPrompt } from './outfitPrompt';
import { FashionGenerationProvider } from './fashionGenerationProvider';
import { restoreCredits } from '../credits';
import type { OutfitJob, OutfitResult } from '../../types';

/**
 * Executes one Outfit Builder job: composite the selected products into a flat-lay, generate a
 * styling prompt, call FASHN Try-On Max, store the result. Deliberately calls only leaf utilities
 * shared with the rest of the app (storage, Convex) — never imports or extends
 * `services/ai/pipeline.ts::executeTryOnPipeline`, so a bug here cannot affect single try-ons.
 *
 * Mirrors `executeTryOnPipeline`'s convention of never throwing on a business-logic failure —
 * returns `{ status: 'failed', error }` instead, and the worker decides whether to throw for
 * Bull's retry bookkeeping (see `services/queue/worker.ts`).
 */
export async function executeOutfitPipeline(job: OutfitJob): Promise<OutfitResult> {
  const startTime = Date.now();

  try {
    const compositeBuffer = await buildOutfitFlatLay(job.slotImageUrls);
    const compositeStoragePath = await uploadResultBuffer(compositeBuffer, job.userId);
    const compositeUrl = await getSignedUrl(RESULT_BUCKET, compositeStoragePath);

    const prompt = buildOutfitPrompt(job.slotLabels);

    await convexMutationTrusted(anyApi.backendTrusted.patchOutfitGeneration, {
      secret: env.BACKEND_SHARED_SECRET,
      id: job.outfitDbId,
      patch: { composite_image: compositeStoragePath },
    });

    logger.info('Outfit pipeline: calling FASHN', { jobId: job.jobId, outfitDbId: job.outfitDbId });

    const fashnResult = await FashionGenerationProvider.outfitTryOn(compositeUrl, job.modelImageUrl, prompt);

    const resultStoragePath = await storeResultImage(fashnResult.resultUrl, job.outfitDbId, job.userId);

    const processingTimeMs = Date.now() - startTime;

    await convexMutationTrusted(anyApi.backendTrusted.patchOutfitGeneration, {
      secret: env.BACKEND_SHARED_SECRET,
      id: job.outfitDbId,
      patch: {
        status: 'completed',
        result_image: resultStoragePath,
        completed_at: new Date().toISOString(),
      },
    });

    await convexMutationTrusted(anyApi.backendTrusted.logAiGenerationUsage, {
      secret: env.BACKEND_SHARED_SECRET,
      userId: job.userId,
      feature: 'outfit_builder',
    });

    logger.info('Outfit pipeline: complete', { jobId: job.jobId, outfitDbId: job.outfitDbId, processingTimeMs });

    return { jobId: job.jobId, status: 'completed', resultUrl: resultStoragePath, processingTimeMs };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Outfit pipeline failed', { jobId: job.jobId, outfitDbId: job.outfitDbId, error: message });

    await restoreCredits(job.userId, job.creditAmount, job.creditType);

    try {
      await convexMutationTrusted(anyApi.backendTrusted.patchOutfitGeneration, {
        secret: env.BACKEND_SHARED_SECRET,
        id: job.outfitDbId,
        patch: { status: 'failed', error: 'Could not generate this outfit right now', completed_at: new Date().toISOString() },
      });
    } catch (patchErr) {
      logger.error('Outfit pipeline: failed to record failure in Convex', {
        outfitDbId: job.outfitDbId,
        error: patchErr instanceof Error ? patchErr.message : String(patchErr),
      });
    }

    return {
      jobId: job.jobId,
      status: 'failed',
      error: 'Could not generate this outfit right now',
      processingTimeMs: Date.now() - startTime,
    };
  }
}
