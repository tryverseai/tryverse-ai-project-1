import Bull from 'bull';
import Redis from 'ioredis';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { REDIS_CONNECT_OPTIONS } from '../../config/redis';
import type { VideoJob, VideoResult } from '../../types';

/** Isolated from every other queue — same Redis, own queue name. Mirrors `outfitProducer.ts`. */
let videoQueue: Bull.Queue<VideoJob> | null = null;

export function getVideoQueue(): Bull.Queue<VideoJob> | null {
  if (!videoQueue) {
    try {
      videoQueue = new Bull<VideoJob>('video-jobs', {
        createClient: () => new Redis(env.REDIS_URL, { ...REDIS_CONNECT_OPTIONS, lazyConnect: false }),
        defaultJobOptions: {
          attempts: env.JOB_MAX_RETRIES,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 50,
          // Video rendering can run long — give the Bull job itself the same longer ceiling as
          // the FASHN poll timeout, so Bull doesn't kill a slow-but-succeeding job early.
          timeout: env.FASHN_VIDEO_POLL_TIMEOUT_MS + 30_000,
        },
      });

      let queueErrorLogged = false;
      videoQueue.on('error', (err) => {
        if (!queueErrorLogged) {
          logger.warn('Video queue: Redis unavailable', { error: err.message });
          queueErrorLogged = true;
        }
      });

      logger.info('Video Bull queue initialized');
    } catch (err) {
      logger.warn('Video Bull queue unavailable', { error: String(err) });
      return null;
    }
  }
  return videoQueue;
}

export async function enqueueVideoJob(jobData: VideoJob): Promise<string> {
  const queue = getVideoQueue();
  if (!queue) throw new Error('Video queue not available');
  const job = await queue.add(jobData, { jobId: jobData.jobId });
  logger.info('Video job enqueued', { jobId: job.id, generationDbId: jobData.generationDbId });
  return String(job.id);
}
