import { randomBytes } from 'crypto';
import { getRedisClient } from '../config/redis';
import { logger } from '../config/logger';

export const ADMIN_SESSION_COOKIE = 'tryverse_admin_session';
const SESSION_TTL_MS = 7 * 60 * 1000; // 7 minutes — tighter than the dashboard's 15-minute idle
// window given admin's privileged surface (block/ban/delete accounts, revoke keys, etc.).
const SESSION_TTL_SEC = SESSION_TTL_MS / 1000;
const REDIS_KEY_PREFIX = 'admin:session:';
const MAX_FALLBACK_SESSIONS = 20; // Safety cap for the in-memory path — admin is a single user

/**
 * Admin is a single privileged user, but the backend can run more than one instance (Railway can
 * scale beyond one dyno). An in-memory Map only works within a single process, so a session
 * created on instance A silently fails to validate on instance B. Redis is the source of truth
 * when reachable; the in-memory Map is a fallback for local dev without Redis running, and for
 * the brief window before a Redis reconnect completes — never the other way around.
 */
interface FallbackEntry { expiresAt: number }
const fallbackSessions = new Map<string, FallbackEntry>();

function pruneExpiredFallback(): void {
  const now = Date.now();
  for (const [token, entry] of fallbackSessions) {
    if (entry.expiresAt <= now) fallbackSessions.delete(token);
  }
}

function redisReady(): boolean {
  return getRedisClient().status === 'ready';
}

export async function createAdminSession(): Promise<string> {
  const token = randomBytes(32).toString('hex');

  if (redisReady()) {
    try {
      await getRedisClient().set(REDIS_KEY_PREFIX + token, '1', 'EX', SESSION_TTL_SEC);
      return token;
    } catch (err) {
      logger.warn('Admin session: Redis write failed, using in-memory fallback', { error: String(err) });
    }
  }

  pruneExpiredFallback();
  if (fallbackSessions.size >= MAX_FALLBACK_SESSIONS) {
    const oldest = [...fallbackSessions.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0];
    if (oldest) fallbackSessions.delete(oldest[0]);
  }
  fallbackSessions.set(token, { expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

/** Returns true and slides the TTL window; returns false if token is missing/expired. */
export async function validateAndRefreshSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;

  if (redisReady()) {
    try {
      const key = REDIS_KEY_PREFIX + token;
      const refreshed = await getRedisClient().expire(key, SESSION_TTL_SEC);
      if (refreshed === 1) return true;
      // Key didn't exist in Redis — fall through to check the fallback map (covers a session
      // created while Redis was briefly down, then Redis came back up before it expired).
    } catch (err) {
      logger.warn('Admin session: Redis read failed, checking in-memory fallback', { error: String(err) });
    }
  }

  const entry = fallbackSessions.get(token);
  if (!entry || Date.now() > entry.expiresAt) {
    if (entry) fallbackSessions.delete(token);
    return false;
  }
  entry.expiresAt = Date.now() + SESSION_TTL_MS;
  return true;
}

export async function revokeAdminSession(token: string | undefined): Promise<void> {
  if (!token) return;
  fallbackSessions.delete(token);
  if (redisReady()) {
    try {
      await getRedisClient().del(REDIS_KEY_PREFIX + token);
    } catch (err) {
      logger.warn('Admin session: Redis delete failed', { error: String(err) });
    }
  }
}

/** Parses a single cookie value from the raw Cookie header string. */
export function parseCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k.trim() === name) return decodeURIComponent(rest.join('=').trim());
  }
  return undefined;
}
