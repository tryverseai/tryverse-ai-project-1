import Bull from 'bull';
import Redis from 'ioredis';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { REDIS_CONNECT_OPTIONS } from '../../config/redis';
import type { OutfitJob } from '../../types';

/**
 * A separate Bull queue from `tryon-jobs` (same Redis instance, own queue name) — deliberate
 * isolation so the Outfit Builder can never affect the revenue-critical single try-on path, even
 * under load or a bad deploy. Mirrors `queue/producer.ts` exactly otherwise.
 */
let outfitQueue: Bull.Queue<OutfitJob> | null = null;

export function getOutfitQueue(): Bull.Queue<OutfitJob> | null {
  if (!outfitQueue) {
    try {
      outfitQueue = new Bull<OutfitJob>('outfit-jobs', {
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
      outfitQueue.on('error', (err) => {
        if (!queueErrorLogged) {
          logger.warn('Outfit queue: Redis unavailable', { error: err.message });
          queueErrorLogged = true;
        }
      });

      logger.info('Outfit Bull queue initialized');
    } catch (err) {
      logger.warn('Outfit Bull queue unavailable', { error: String(err) });
      return null;
    }
  }
  return outfitQueue;
}

export async function enqueueOutfitJob(jobData: OutfitJob): Promise<string> {
  const queue = getOutfitQueue();
  if (!queue) {
    throw new Error('Outfit queue not available');
  }
  const job = await queue.add(jobData, { jobId: jobData.jobId });
  logger.info('Outfit job enqueued', { jobId: job.id, outfitDbId: jobData.outfitDbId });
  return String(job.id);
}
