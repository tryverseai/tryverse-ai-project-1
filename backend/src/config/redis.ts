import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

let redisClient: Redis | null = null;

/** After `connect()` resolves; can flip false on `close`. Bull uses its own Redis connection. */
let applicationRedisReady = false;

/** True if shared ioredis client is usable; false when running degraded without broker. */
export function isApplicationRedisReady(): boolean {
  return applicationRedisReady;
}

/** Safe log label for REDIS_URL (scheme + host + port only). */
function redisTargetForLog(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ''}`;
  } catch {
    return '(unparseable REDIS_URL)';
  }
}

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      connectTimeout: 15_000,
      retryStrategy: (times) => {
        if (env.NODE_ENV !== 'production' && times > 3) return null;
        if (env.NODE_ENV === 'production' && times > 30) {
          logger.warn('Redis shared client: reconnect attempts capped');
          return null;
        }
        return Math.min(times * 1000, 30_000);
      },
    });

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
    if (client.status === 'ready') {
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
    applicationRedisReady = client.status === 'ready' || client.status === 'connect';
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
