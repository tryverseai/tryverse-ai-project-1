import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy: (times) => {
        // Stop retrying after 5 attempts in dev, backoff in prod
        if (env.NODE_ENV !== 'production' && times > 3) return null;
        return Math.min(times * 1000, 30000);
      },
    });

    redisClient.on('connect', () => logger.info('Redis connected'));
    redisClient.on('error', (err) => {
      // Only log first error to avoid flooding logs
      const tagged = redisClient as Redis & { _errorLogged?: boolean };
      if (!tagged._errorLogged) {
        logger.warn('Redis unavailable — running without queue', { error: err.message });
        tagged._errorLogged = true;
      }
    });
  }
  return redisClient;
}

export async function connectRedis(): Promise<void> {
  const client = getRedisClient();
  try {
    await client.connect();
    (client as Redis & { _errorLogged?: boolean })._errorLogged = false;

  } catch (err) {
    logger.warn('Redis not available — job queue and caching disabled', { error: String(err) });
  }
}
