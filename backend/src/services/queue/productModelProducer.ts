import Bull from 'bull';
import Redis from 'ioredis';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { REDIS_CONNECT_OPTIONS } from '../../config/redis';
import type { ProductModelJob, ProductModelResult } from '../../types';

/** Isolated from `tryon-jobs` and `outfit-jobs` — same Redis, own queue name. Mirrors `outfitProducer.ts`. */
let productModelQueue: Bull.Queue<ProductModelJob> | null = null;

export function getProductModelQueue(): Bull.Queue<ProductModelJob> | null {
  if (!productModelQueue) {
    try {
      productModelQueue = new Bull<ProductModelJob>('product-model-jobs', {
        createClient: () => new Redis(env.REDIS_URL, { ...REDIS_CONNECT_OPTIONS, lazyConnect: false }),
        defaultJobOptions: {
          attempts: env.JOB_MAX_RETRIES,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 50,
          timeout: env.JOB_TIMEOUT_MS,
        },
      });

      let queueErrorLogged = false;
      productModelQueue.on('error', (err) => {
        if (!queueErrorLogged) {
          logger.warn('Product-model queue: Redis unavailable', { error: err.message });
          queueErrorLogged = true;
        }
      });

      logger.info('Product-model Bull queue initialized');
    } catch (err) {
      logger.warn('Product-model Bull queue unavailable', { error: String(err) });
      return null;
    }
  }
  return productModelQueue;
}

export async function enqueueProductModelJob(jobData: ProductModelJob): Promise<string> {
  const queue = getProductModelQueue();
  if (!queue) throw new Error('Product-model queue not available');
  const job = await queue.add(jobData, { jobId: jobData.jobId });
  logger.info('Product-model job enqueued', { jobId: job.id, generationDbId: jobData.generationDbId });
  return String(job.id);
}
