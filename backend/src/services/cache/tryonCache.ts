import crypto from 'crypto';
import { getRedisClient } from '../../config/redis';
import { logger } from '../../config/logger';
import type { ProductCategory } from '../../types';

/**
 * CACHING LAYER — Repeat Try-On Results
 *
 * Cache key: tryon:{personHash}:{productHash}:{category}
 * Identical image combinations return cached result — no AI inference.
 * TTL: 24 hours (reduces AI costs for popular products).
 */

const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const CACHE_PREFIX = 'tryon:';

/**
 * Computes SHA-256 hash of image buffer for cache key.
 */
export function computeImageHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Builds cache key from image content hashes.
 */
export function buildCacheKey(
  personImageHash: string,
  productImageHash: string,
  category: ProductCategory
): string {
  return `${CACHE_PREFIX}${personImageHash}:${productImageHash}:${category}`;
}

/**
 * Looks up a cached result. Returns stored result path or null.
 */
export async function getCachedResultByHash(
  personImageHash: string,
  productImageHash: string,
  category: ProductCategory
): Promise<string | null> {
  try {
    const redis = getRedisClient();
    if (redis.status !== 'ready') return null;

    const key = buildCacheKey(personImageHash, productImageHash, category);
    const cached = await redis.get(key);

    if (cached) {
      logger.info('Cache hit', { key: key.slice(-24), ttl: CACHE_TTL_SECONDS });
      return cached;
    }
    return null;
  } catch (err) {
    logger.warn('Cache lookup failed', { error: String(err) });
    return null;
  }
}

/**
 * Stores a try-on result in the cache.
 */
export async function setCachedResultByHash(
  personImageHash: string,
  productImageHash: string,
  category: ProductCategory,
  resultPath: string
): Promise<void> {
  try {
    const redis = getRedisClient();
    if (redis.status !== 'ready') return;

    const key = buildCacheKey(personImageHash, productImageHash, category);
    await redis.setex(key, CACHE_TTL_SECONDS, resultPath);
    logger.info('Result cached', { key: key.slice(-24), ttl: CACHE_TTL_SECONDS });
  } catch (err) {
    logger.warn('Cache write failed', { error: String(err) });
  }
}


/**
 * Invalidates a cached result.
 */
export async function invalidateCacheEntry(
  personImageHash: string,
  productImageHash: string,
  category: ProductCategory
): Promise<void> {
  try {
    const redis = getRedisClient();
    if (redis.status !== 'ready') return;
    const key = buildCacheKey(personImageHash, productImageHash, category);
    await redis.del(key);
    logger.info('Cache invalidated', { key: key.slice(-24) });
  } catch (err) {
    logger.warn('Cache invalidation failed', { error: String(err) });
  }
}

/**
 * Returns cache statistics for admin dashboard.
 */
export async function getCacheStats(): Promise<{ keys: number; memoryMb: number } | null> {
  try {
    const redis = getRedisClient();
    if (redis.status !== 'ready') return null;

    const [keyCount, memInfo] = await Promise.all([
      redis.dbsize(),
      redis.info('memory'),
    ]);

    const memMatch = memInfo.match(/used_memory:(\d+)/);
    const memBytes = memMatch ? parseInt(memMatch[1], 10) : 0;
    return { keys: keyCount, memoryMb: Math.round(memBytes / 1024 / 1024) };
  } catch {
    return null;
  }
}
