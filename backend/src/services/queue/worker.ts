import Bull from 'bull';
import { getTryOnQueue } from './producer';
import { getOutfitQueue } from './outfitProducer';
import { executeTryOnPipeline } from '../ai/pipeline';
import { executeOutfitPipeline } from '../ai/outfitPipeline';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import type { TryOnJob, TryOnResult, OutfitJob, OutfitResult } from '../../types';

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

// When run directly
if (require.main === module) {
  if (!startWorker()) process.exit(1);
}
