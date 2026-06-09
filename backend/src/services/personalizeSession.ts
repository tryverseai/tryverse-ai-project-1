/**
 * Personalize Session Service
 *
 * Manages short-lived shopper sessions for the AI Model Personalization feature.
 * Sessions are keyed by UUID and stored in Redis with a 7-day TTL.
 * No user account required — ephemeral personalization contexts.
 *
 * Session data:
 *   - apiKeyId (brand owning the session)
 *   - referenceImagePath (uploaded selfie stored in our storage)
 *   - createdAt
 *   - expiresAt
 */

import crypto from 'crypto';
import { getRedisClient } from '../config/redis';
import { logger } from '../config/logger';

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const SESSION_PREFIX = 'personalize:session:';

export interface ShopperSession {
  sessionId: string;
  apiKeyId: string;
  referenceImagePath: string;
  createdAt: number;
  expiresAt: number;
}

function sessionKey(sessionId: string): string {
  return `${SESSION_PREFIX}${sessionId}`;
}

export function generateSessionId(): string {
  return crypto.randomUUID();
}

export async function createShopperSession(
  apiKeyId: string,
  referenceImagePath: string
): Promise<ShopperSession> {
  const sessionId = generateSessionId();
  const now = Date.now();
  const session: ShopperSession = {
    sessionId,
    apiKeyId,
    referenceImagePath,
    createdAt: now,
    expiresAt: now + SESSION_TTL_SECONDS * 1000,
  };

  try {
    const redis = getRedisClient();
    if (redis.status === 'ready') {
      await redis.setex(sessionKey(sessionId), SESSION_TTL_SECONDS, JSON.stringify(session));
      logger.info('Shopper session created', { sessionId, apiKeyId });
    }
  } catch (err) {
    logger.warn('Redis write for shopper session failed', { error: String(err) });
  }

  return session;
}

export async function getShopperSession(sessionId: string): Promise<ShopperSession | null> {
  try {
    const redis = getRedisClient();
    if (redis.status !== 'ready') return null;
    const raw = await redis.get(sessionKey(sessionId));
    if (!raw) return null;
    const session = JSON.parse(raw) as ShopperSession;
    if (Date.now() > session.expiresAt) {
      await redis.del(sessionKey(sessionId));
      return null;
    }
    return session;
  } catch (err) {
    logger.warn('Redis read for shopper session failed', { error: String(err) });
    return null;
  }
}

export async function deleteShopperSession(sessionId: string): Promise<void> {
  try {
    const redis = getRedisClient();
    if (redis.status === 'ready') {
      await redis.del(sessionKey(sessionId));
    }
  } catch (err) {
    logger.warn('Redis delete for shopper session failed', { error: String(err) });
  }
}
