import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis';
import { getPlanId } from '../services/credits';
import { logger } from '../config/logger';

/**
 * Plan-based rate limits for try-on endpoint:
 * - Free: 1 request per 10 seconds (6/minute)
 * - Pro (starter, growth): 10 requests per minute
 * - Enterprise: 100 requests per minute
 */
const PLAN_LIMITS: Record<string, { windowSec: number; max: number }> = {
  free: { windowSec: 10, max: 1 },
  starter: { windowSec: 60, max: 10 },
  growth: { windowSec: 60, max: 10 },
  enterprise: { windowSec: 60, max: 100 },
};

export async function planAwareTryonRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const identifier = req.user?.id || req.apiKey?.userId || req.ip || 'anon';
  const planId = req.user?.id ? await getPlanId(req.user.id) : 'free';
  const config = PLAN_LIMITS[planId] ?? PLAN_LIMITS.free;
  const key = `tryon:rate:${identifier}`;

  try {
    const redis = getRedisClient();
    if (redis.status !== 'ready') {
      next();
      return;
    }

    const multi = redis.multi();
    multi.incr(key);
    multi.ttl(key);
    const results = await multi.exec();

    if (!results) {
      next();
      return;
    }

    const count = results[0]?.[1] as number ?? 1;
    const ttl = results[1]?.[1] as number ?? -1;

    if (ttl === -1) {
      await redis.expire(key, config.windowSec);
    }

    if (count > config.max) {
      logger.warn('Rate limit exceeded', {
        identifier,
        planId,
        count,
        limit: config.max,
        windowSec: config.windowSec,
      });
      res.status(429).json({
        error: 'Too many try-on requests. Please slow down.',
        retryAfter: config.windowSec,
      });
      return;
    }

    next();
  } catch (err) {
    logger.warn('Rate limit check failed, allowing request', { error: String(err) });
    next();
  }
}
