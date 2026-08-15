import Bull from 'bull';
import { getTryOnQueue } from './producer';
import { getOutfitQueue } from './outfitProducer';
import { getProductModelQueue } from './productModelProducer';
import { getVideoQueue } from './videoProducer';
import { executeTryOnPipeline } from '../ai/pipeline';
import { executeOutfitPipeline } from '../ai/outfitPipeline';
import { executeProductModelPipeline } from '../ai/productModelPipeline';
import { executeVideoPipeline } from '../ai/videoPipeline';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import type {
  TryOnJob, TryOnResult, OutfitJob, OutfitResult,
  ProductModelJob, ProductModelResult, VideoJob, VideoResult,
} from '../../types';

/**
 * Starts the Bull worker that processes try-on jobs from the queue.
 * Run this as a separate process in production: `npm run worker`
 */
export function startWorker(): boolean {
  const queue = getTryOnQueue();

  if (!queue) {
    logger.warn('Try-on worker not started — queue not available (sync fallback only)');
    return false;
  }

  logger.info('Worker starting', { concurrency: env.JOB_CONCURRENCY });
  logger.info('Clothing try-on routing (worker — effective)', {
    clothingUseFashn: env.TRYON_CLOTHING_USE_FASHN,
    fashnFallbackToIdm: env.TRYON_FASHN_FALLBACK_IDM,
  });

  queue.process(env.JOB_CONCURRENCY, async (job: Bull.Job<TryOnJob>): Promise<TryOnResult> => {
    logger.info('Processing job', { jobId: job.id, tryonDbId: job.data.tryonDbId });

    await job.progress(10);

    try {
      const result = await executeTryOnPipeline(job.data);
      await job.progress(100);

      if (result.status === 'failed') {
        throw new Error(result.error || 'Pipeline execution failed');
      }

      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Job processing error', { jobId: job.id, error: message });
      throw err;
    }
  });

  queue.on('completed', (job, result: TryOnResult) => {
    logger.info('Job completed', {
      jobId: job.id,
      tryonDbId: job.data.tryonDbId,
      processingTimeMs: result.processingTimeMs,
    });
  });

  queue.on('failed', (job, err) => {
    logger.error('Job failed permanently', {
      jobId: job.id,
      tryonDbId: job.data.tryonDbId,
      attemptsMade: job.attemptsMade,
      error: err.message,
    });
  });

  queue.on('stalled', (job) => {
    logger.warn('Job stalled', { jobId: job.id });
  });

  logger.info('Worker ready and listening for jobs');
  startOutfitWorker();
  startProductModelWorker();
  startVideoWorker();
  return true;
}

/**
 * Processes the separate `outfit-jobs` queue in the same worker process. Deliberately isolated
 * from the `tryon-jobs` handler above — a bug in `executeOutfitPipeline` cannot touch or block
 * single try-on processing, since they're different Bull queues with independent job streams.
 */
function startOutfitWorker(): void {
  const outfitQueue = getOutfitQueue();
  if (!outfitQueue) {
    logger.warn('Outfit worker not started — outfit queue not available');
    return;
  }

  outfitQueue.process(env.JOB_CONCURRENCY, async (job: Bull.Job<OutfitJob>): Promise<OutfitResult> => {
    logger.info('Processing outfit job', { jobId: job.id, outfitDbId: job.data.outfitDbId });
    await job.progress(10);

    const result = await executeOutfitPipeline(job.data);
    await job.progress(100);

    if (result.status === 'failed') {
      throw new Error(result.error || 'Outfit pipeline execution failed');
    }
    return result;
  });

  outfitQueue.on('completed', (job, result: OutfitResult) => {
    logger.info('Outfit job completed', {
      jobId: job.id,
      outfitDbId: job.data.outfitDbId,
      processingTimeMs: result.processingTimeMs,
    });
  });

  outfitQueue.on('failed', (job, err) => {
    logger.error('Outfit job failed permanently', {
      jobId: job.id,
      outfitDbId: job.data.outfitDbId,
      attemptsMade: job.attemptsMade,
      error: err.message,
    });
  });

  logger.info('Outfit worker ready and listening for jobs');
}

/** Processes the separate `product-model-jobs` queue — isolated from every other queue above. */
function startProductModelWorker(): void {
  const queue = getProductModelQueue();
  if (!queue) {
    logger.warn('Product-model worker not started — queue not available');
    return;
  }

  queue.process(env.JOB_CONCURRENCY, async (job: Bull.Job<ProductModelJob>): Promise<ProductModelResult> => {
    logger.info('Processing product-model job', { jobId: job.id, generationDbId: job.data.generationDbId });
    await job.progress(10);

    const result = await executeProductModelPipeline(job.data);
    await job.progress(100);

    if (result.status === 'failed') {
      throw new Error(result.error || 'Product-model pipeline execution failed');
    }
    return result;
  });

  queue.on('completed', (job, result: ProductModelResult) => {
    logger.info('Product-model job completed', {
      jobId: job.id,
      generationDbId: job.data.generationDbId,
      processingTimeMs: result.processingTimeMs,
    });
  });

  queue.on('failed', (job, err) => {
    logger.error('Product-model job failed permanently', {
      jobId: job.id,
      generationDbId: job.data.generationDbId,
      attemptsMade: job.attemptsMade,
      error: err.message,
    });
  });

  logger.info('Product-model worker ready and listening for jobs');
}

/** Processes the separate `video-jobs` queue — isolated from every other queue above. */
function startVideoWorker(): void {
  const queue = getVideoQueue();
  if (!queue) {
    logger.warn('Video worker not started — queue not available');
    return;
  }

  queue.process(env.JOB_CONCURRENCY, async (job: Bull.Job<VideoJob>): Promise<VideoResult> => {
    logger.info('Processing video job', { jobId: job.id, generationDbId: job.data.generationDbId });
    await job.progress(10);

    const result = await executeVideoPipeline(job.data);
    await job.progress(100);

    if (result.status === 'failed') {
      throw new Error(result.error || 'Video pipeline execution failed');
    }
    return result;
  });

  queue.on('completed', (job, result: VideoResult) => {
    logger.info('Video job completed', {
      jobId: job.id,
      generationDbId: job.data.generationDbId,
      processingTimeMs: result.processingTimeMs,
    });
  });

  queue.on('failed', (job, err) => {
    logger.error('Video job failed permanently', {
      jobId: job.id,
      generationDbId: job.data.generationDbId,
      attemptsMade: job.attemptsMade,
      error: err.message,
    });
  });

  logger.info('Video worker ready and listening for jobs');
}

// When run directly
if (require.main === module) {
  if (!startWorker()) process.exit(1);
}
