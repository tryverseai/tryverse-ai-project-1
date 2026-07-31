import Bull from 'bull';
import Redis from 'ioredis';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { REDIS_CONNECT_OPTIONS } from '../../config/redis';
import type { TryOnJob, TryOnResult, BullJobStatus } from '../../types';

let tryOnQueue: Bull.Queue<TryOnJob> | null = null;

export function getTryOnQueue(): Bull.Queue<TryOnJob> | null {
  if (!tryOnQueue) {
    try {
      tryOnQueue = new Bull<TryOnJob>('tryon-jobs', {
        /**
         * Bull needs up to 3 separate ioredis connections (client / subscriber / blocking
         * "bclient" — the last can't be shared with the others). Build each from the same
         * REDIS_URL + REDIS_CONNECT_OPTIONS as the shared app client (config/redis.ts) so Bull's
         * reconnect backoff, connect timeout, and TLS handling (from the REDIS_URL scheme) match
         * the rest of the app instead of relying on ioredis's untuned defaults — previously Bull
         * only received a bare `redis: env.REDIS_URL` string here.
         */
        createClient: () => new Redis(env.REDIS_URL, { ...REDIS_CONNECT_OPTIONS, lazyConnect: false }),
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

/** Shape returned by both job-status helpers. */
export interface JobStatusResult {
  status: BullJobStatus;
  progress: number;
  /** Pipeline result, present when the job completed successfully. */
  result?: TryOnResult;
  error?: string;
}

/**
 * Gets job status by ID.
 */
export async function getJobStatus(jobId: string): Promise<JobStatusResult> {
  const queue = getTryOnQueue();
  if (!queue) return { status: 'unknown', progress: 0 };

  const job = await queue.getJob(jobId);
  if (!job) return { status: 'not_found', progress: 0 };

  const state = await job.getState();
  // Bull's progress() can be a number or an object; normalise to number.
  const rawProgress = job.progress();
  const progress = typeof rawProgress === 'number' ? rawProgress : 0;

  return {
    status: state as BullJobStatus,
    progress,
    result: job.returnvalue as TryOnResult | undefined,
    error: job.failedReason ?? undefined,
  };
}

/**
 * Gets job status only if the job belongs to the given user.
 * Returns null if job not found or user is not the owner (IDOR prevention).
 */
export async function getJobStatusForUser(
  jobId: string,
  userId: string
): Promise<JobStatusResult | null> {
  const queue = getTryOnQueue();
  if (!queue) return null;

  const job = await queue.getJob(jobId);
  if (!job || !job.data) return null;

  // Queue is typed as Bull.Queue<TryOnJob> — no cast needed.
  const jobUserId = job.data.userId ?? null;
  if (jobUserId !== userId) return null;

  const state = await job.getState();
  const rawProgress = job.progress();
  const progress = typeof rawProgress === 'number' ? rawProgress : 0;

  return {
    status: state as BullJobStatus,
    progress,
    result: job.returnvalue as TryOnResult | undefined,
    error: job.failedReason ?? undefined,
  };
}
