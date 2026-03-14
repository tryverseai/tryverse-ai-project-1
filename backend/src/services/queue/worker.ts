import Bull from 'bull';
import { getTryOnQueue } from './producer';
import { executeTryOnPipeline } from '../ai/pipeline';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import type { TryOnJob, TryOnResult } from '../../types';

/**
 * Starts the Bull worker that processes try-on jobs from the queue.
 * Run this as a separate process in production: `npm run worker`
 */
export function startWorker(): void {
  const queue = getTryOnQueue();

  if (!queue) {
    logger.error('Cannot start worker — queue not available');
    process.exit(1);
  }

  logger.info('Worker starting', { concurrency: env.JOB_CONCURRENCY });

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
}

// When run directly
if (require.main === module) {
  startWorker();
}
