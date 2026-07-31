import Redis, { RedisOptions } from 'ioredis';
import { env } from './env';
import { logger } from './logger';

let redisClient: Redis | null = null;

/** After `connect()` resolves; can flip false on `close`. Bull uses its own Redis connection(s). */
let applicationRedisReady = false;

/** True if shared ioredis client is usable; false when running degraded without broker. */
export function isApplicationRedisReady(): boolean {
  return applicationRedisReady;
}

/** Safe log label for REDIS_URL (scheme + host + port only). */
export function redisTargetForLog(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ''}`;
  } catch {
    return '(unparseable REDIS_URL)';
  }
}

/**
 * Single source of truth for ioredis connection behavior, shared by every Redis consumer in
 * this backend: the app-level client below, the cache layer (services/cache/tryonCache.ts, via
 * `getRedisClient()`), and Bull's queue client (services/queue/producer.ts, via `createClient`).
 * Centralising this avoids the previous setup where Bull built its own ad-hoc ioredis connections
 * from a bare `REDIS_URL` string — with none of the tuning below — which is a common cause of
 * "Redis looks unstable in prod but not locally" symptoms (queue client reconnecting differently
 * than the app client under the same network blip).
 *
 * TLS: ioredis derives TLS automatically from the `rediss://` scheme in `REDIS_URL` (used by
 * Upstash and most managed Redis add-ons that require TLS-in-transit). Plain `redis://` (local
 * Docker Compose, or Railway's own Redis plugin over its private network) stays unencrypted.
 * There is no hardcoded `tls` option here on purpose — switching the scheme in `REDIS_URL` is
 * enough, no code change required.
 */
export const REDIS_CONNECT_OPTIONS: RedisOptions = {
  // Required by Bull for its blocking ("bclient") connection; harmless for the app/cache client.
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
  connectTimeout: 15_000,
  // Exponential backoff (1s, 2s, 4s, 8s, 16s, ... capped at 30s) — not a tight retry loop.
  retryStrategy: (times) => {
    if (env.NODE_ENV !== 'production' && times > 3) return null;
    if (env.NODE_ENV === 'production' && times > 30) {
      logger.warn('Redis: reconnect attempts capped', { times });
      return null;
    }
    return Math.min(1000 * 2 ** (times - 1), 30_000);
  },
};

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, REDIS_CONNECT_OPTIONS);

    redisClient.on('connect', () => {
      logger.info('Redis TCP connected (shared client)', { target: redisTargetForLog(env.REDIS_URL) });
    });
    redisClient.on('ready', () => {
      logger.info('Redis ready event (shared client)', { target: redisTargetForLog(env.REDIS_URL) });
    });
    redisClient.on('close', () => {
      applicationRedisReady = false;
    });
    redisClient.on('error', (err) => {
      const tagged = redisClient as Redis & { _errorLogged?: boolean };
      if (!tagged._errorLogged) {
        logger.warn('Redis shared client error — app continues (degraded mode OK)', {
          error: err.message,
          target: redisTargetForLog(env.REDIS_URL),
        });
        tagged._errorLogged = true;
      }
    });
  }
  return redisClient;
}

/**
 * Best-effort Redis connect. Never throws — API stays up without Redis.
 * Bull/queue retries against REDIS_URL independently; sync try-on path remains stable.
 */
export async function connectRedis(): Promise<void> {
  const client = getRedisClient();
  const target = redisTargetForLog(env.REDIS_URL);
  try {
    const initialStatus: string = client.status;
    if (initialStatus === 'ready') {
      applicationRedisReady = true;
      logger.info('Redis bootstrap connect finished (already ready)', { target });
      return;
    }
    await Promise.race([
      client.connect(),
      new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Redis connect timed out after 8s')), 8000);
      }),
    ]);
    // Re-read as `string` — client.status legitimately changes across the `await` above, but
    // TS's control-flow narrowing on the dotted access doesn't know that (pre-existing TS2367).
    const statusAfterConnect: string = client.status;
    applicationRedisReady = statusAfterConnect === 'ready' || statusAfterConnect === 'connect';
    (client as Redis & { _errorLogged?: boolean })._errorLogged = false;
    logger.info('Redis bootstrap connect finished', {
      target,
      status: client.status,
      note: 'shared client; Bull uses same REDIS_URL',
    });
  } catch (err) {
    applicationRedisReady = false;
    logger.warn(
      'Redis bootstrap skipped — intentional stable fallback (no crash). Verify Railway Redis plugin / REDIS_URL.',
      { target, error: String(err) }
    );
  }
}
