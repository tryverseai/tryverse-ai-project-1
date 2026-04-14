import { randomBytes } from 'crypto';

export const ADMIN_SESSION_COOKIE = 'tryverse_admin_session';
const SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes (matches frontend idle timeout)
const MAX_SESSIONS = 20; // Safety cap — admin is a single user

interface SessionEntry { expiresAt: number }
const sessions = new Map<string, SessionEntry>();

/** Prune expired sessions to keep the Map bounded. */
function pruneExpired(): void {
  const now = Date.now();
  for (const [token, entry] of sessions) {
    if (entry.expiresAt <= now) sessions.delete(token);
  }
}

export function createAdminSession(): string {
  pruneExpired();
  if (sessions.size >= MAX_SESSIONS) {
    // Evict the oldest token if at cap (pathological case — too many parallel logins)
    const oldest = [...sessions.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0];
    if (oldest) sessions.delete(oldest[0]);
  }
  const token = randomBytes(32).toString('hex');
  sessions.set(token, { expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

/** Returns true and slides the TTL window; returns false if token is missing/expired. */
export function validateAndRefreshSession(token: string | undefined): boolean {
  if (!token) return false;
  const entry = sessions.get(token);
  if (!entry || Date.now() > entry.expiresAt) {
    if (entry) sessions.delete(token);
    return false;
  }
  entry.expiresAt = Date.now() + SESSION_TTL_MS; // sliding window
  return true;
}

export function revokeAdminSession(token: string | undefined): void {
  if (token) sessions.delete(token);
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
