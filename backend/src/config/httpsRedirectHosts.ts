import { env } from './env';

/** Hostnames allowed for production HTTP→HTTPS upgrade (from env or FRONTEND_URL). */
export function httpsRedirectAllowedHosts(): string[] {
  const raw = env.PUBLIC_API_HOSTNAMES.trim();
  if (raw) {
    return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  }
  try {
    const h = new URL(env.FRONTEND_URL).hostname.toLowerCase();
    return h ? [h] : [];
  } catch {
    return [];
  }
}

export function isHostAllowedForHttpsRedirect(host: string, allowed: string[]): boolean {
  if (!allowed.length) return true;
  const h = host.toLowerCase();
  return allowed.some((a) => h === a || h.endsWith(`.${a}`));
}

/** Host header must look like a normal hostname (no slashes, spaces, etc.). */
export function isPlausibleHostname(host: string): boolean {
  if (!host || host.length > 253) return false;
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(host);
}
