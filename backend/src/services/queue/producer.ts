import Bull from 'bull';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import type { TryOnJob } from '../../types';

let tryOnQueue: Bull.Queue<TryOnJob> | null = null;

export function getTryOnQueue(): Bull.Queue<TryOnJob> | null {
  if (!tryOnQueue) {
    try {
      tryOnQueue = new Bull<TryOnJob>('tryon-jobs', {
        redis: env.REDIS_URL,
        defaultJobOptions: {
          attempts: env.JOB_MAX_RETRIES,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 50,
          timeout: env.JOB_TIMEOUT_MS,
        },
      });

      // Only log queue errors once to avoid flooding console when Redis is unavailable
      let queueErrorLogged = false;
      tryOnQueue.on('error', (err) => {
        if (!queueErrorLogged) {
          logger.warn('Bull queue: Redis unavailable — try-ons will run in sync mode', { error: err.message });
          queueErrorLogged = true;
        }
      });

      logger.info('Bull queue initialized');
    } catch (err) {
      logger.warn('Bull queue unavailable — running in sync mode', { error: String(err) });
      return null;
    }
  }
  return tryOnQueue;
}

/**
 * Enqueues a try-on job for async processing.
 * Returns the Bull job ID.
 */
export async function enqueueTryOnJob(jobData: TryOnJob): Promise<string> {
  const queue = getTryOnQueue();
  if (!queue) {
    throw new Error('Queue not available');
  }

  const job = await queue.add(jobData, {
    jobId: jobData.jobId,
    priority: jobData.widgetMode ? 5 : 10, // widget gets higher priority
  });

  logger.info('Try-on job enqueued', { jobId: job.id, tryonDbId: jobData.tryonDbId });
  return String(job.id);
}

/**
 * Gets job status by ID.
 */
export async function getJobStatus(jobId: string): Promise<{
  status: string;
  progress: number;
  result?: unknown;
  error?: string;
}> {
  const queue = getTryOnQueue();
  if (!queue) return { status: 'unknown', progress: 0 };

  const job = await queue.getJob(jobId);
  if (!job) return { status: 'not_found', progress: 0 };

  const state = await job.getState();
  const progress = job.progress() as number;

  return {
    status: state,
    progress: typeof progress === 'number' ? progress : 0,
    result: job.returnvalue,
    error: job.failedReason,
  };
}

/**
 * Gets job status only if the job belongs to the given user.
 * Returns null if job not found or user is not the owner (IDOR prevention).
 */
export async function getJobStatusForUser(
  jobId: string,
  userId: string
): Promise<{
  status: string;
  progress: number;
  result?: unknown;
  error?: string;
} | null> {
  const queue = getTryOnQueue();
  if (!queue) return null;

  const job = await queue.getJob(jobId);
  if (!job || !job.data) return null;

  const jobData = job.data as TryOnJob;
  const jobUserId = jobData.userId ?? null;
  if (jobUserId !== userId) return null;

  const state = await job.getState();
  const progress = job.progress() as number;

  return {
    status: state,
    progress: typeof progress === 'number' ? progress : 0,
    result: job.returnvalue,
    error: job.failedReason,
  };
}
