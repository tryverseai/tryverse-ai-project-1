import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { anyApi, convexMutationTrusted } from '../../config/convexHttp';
import { storeResultVideo } from '../storage/images';
import { FashionGenerationProvider } from './fashionGenerationProvider';
import { restoreCredits } from '../credits';
import type { VideoJob, VideoResult } from '../../types';

/**
 * Executes one AI Video job: call FASHN image-to-video, store the result clip. Deliberately calls
 * only leaf utilities — never imports any other pipeline. Mirrors `executeOutfitPipeline`'s error
 * convention: never throws for a business-logic failure, returns `{status:'failed', error}` instead.
 */
export async function executeVideoPipeline(job: VideoJob): Promise<VideoResult> {
  const startTime = Date.now();

  try {
    logger.info('Video pipeline: calling FASHN', { jobId: job.jobId, generationDbId: job.generationDbId });

    const fashnResult = await FashionGenerationProvider.imageToVideo({
      imageUrl: job.sourceImageUrl,
      prompt: job.prompt,
      duration: job.duration,
      resolution: job.resolution,
    });

    const resultStoragePath = await storeResultVideo(fashnResult.resultUrl, job.userId);

    const processingTimeMs = Date.now() - startTime;

    await convexMutationTrusted(anyApi.backendTrusted.patchVideoGeneration, {
      secret: env.BACKEND_SHARED_SECRET,
      id: job.generationDbId,
      patch: {
        status: 'completed',
        result_video: resultStoragePath,
        completed_at: new Date().toISOString(),
      },
    });

    await convexMutationTrusted(anyApi.backendTrusted.logAiGenerationUsage, {
      secret: env.BACKEND_SHARED_SECRET,
      userId: job.userId,
      feature: 'video',
    });

    logger.info('Video pipeline: complete', { jobId: job.jobId, generationDbId: job.generationDbId, processingTimeMs });

    return { jobId: job.jobId, status: 'completed', resultUrl: resultStoragePath, processingTimeMs };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Video pipeline failed', { jobId: job.jobId, generationDbId: job.generationDbId, error: message });

    await restoreCredits(job.userId, job.creditAmount);

    try {
      await convexMutationTrusted(anyApi.backendTrusted.patchVideoGeneration, {
        secret: env.BACKEND_SHARED_SECRET,
        id: job.generationDbId,
        patch: { status: 'failed', error: 'Could not generate this video right now', completed_at: new Date().toISOString() },
      });
    } catch (patchErr) {
      logger.error('Video pipeline: failed to record failure in Convex', {
        generationDbId: job.generationDbId,
        error: patchErr instanceof Error ? patchErr.message : String(patchErr),
      });
    }

    return {
      jobId: job.jobId,
      status: 'failed',
      error: 'Could not generate this video right now',
      processingTimeMs: Date.now() - startTime,
    };
  }
}
