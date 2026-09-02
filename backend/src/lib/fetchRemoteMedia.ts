import { isPrivateOrBlockedHost } from './ssrfGuard';

export interface FetchRemoteMediaOptions {
  /** Human-readable label used in thrown error messages and logs (e.g. "storeResultImage"). */
  label: string;
  /** Hard cap on response size, enforced from both Content-Length and the actual bytes received. */
  maxBytes: number;
  /**
   * When provided, every hop's hostname (the initial URL and every redirect target) must be an
   * exact member of this set — used to pin a fetch known to originate from a specific upstream
   * provider (e.g. FASHN's output hosts) beyond the general private-host blocklist, which always
   * applies regardless of this option. Omit for call sites that legitimately span multiple
   * providers with different hostnames (e.g. the clothing try-on pipeline, which can hand back a
   * FASHN, Replicate, or Flux-Kontext URL depending on which engine ran).
   */
  allowedHosts?: ReadonlySet<string>;
  timeoutMs?: number;
  maxRedirects?: number;
}

export interface FetchRemoteMediaResult {
  buffer: Buffer;
  contentType: string | null;
}

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_REDIRECTS = 5;

/** Throws if `url` isn't a URL this backend should ever connect to. Exported standalone (no
 * network call) so it's directly unit-testable without mocking fetch. */
export function assertTrustedProviderUrl(
  url: URL,
  label: string,
  allowedHosts?: ReadonlySet<string>
): void {
  if (url.protocol !== 'https:') {
    throw new Error(`${label}: only HTTPS URLs are allowed`);
  }
  if (isPrivateOrBlockedHost(url.hostname)) {
    throw new Error(`${label}: URL host not allowed`);
  }
  if (allowedHosts && !allowedHosts.has(url.hostname.trim().toLowerCase())) {
    throw new Error(`${label}: URL host is not a trusted output host`);
  }
}

export function parseTrustedProviderUrl(
  raw: string,
  label: string,
  allowedHosts?: ReadonlySet<string>
): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${label}: invalid URL`);
  }
  assertTrustedProviderUrl(parsed, label, allowedHosts);
  return parsed;
}

/**
 * Fetches an AI provider's generated-output URL with the guardrails a general-purpose URL
 * downloader must never skip. Every backend call site that downloads a provider result (FASHN,
 * Replicate, Flux-Kontext) routes through this one function instead of a bare `fetch()`, so this
 * is the single place SSRF/media-fetch behavior is defined:
 *
 *  - HTTPS-only; private/loopback/link-local/unique-local/cloud-metadata hosts rejected
 *    (`isPrivateOrBlockedHost`, shared with every other outbound-URL fetch in this backend).
 *  - An optional strict per-provider hostname allowlist on top of that blocklist.
 *  - Redirects are followed manually (`redirect: 'manual'`), and every hop's target is
 *    re-validated against the exact same checks before being followed — a redirect to an
 *    untrusted or private host is rejected outright, not silently followed, and the hop count is
 *    capped.
 *  - A connect+read timeout via `AbortController` (a stalled upstream can't hang a worker
 *    indefinitely).
 *  - A hard byte cap enforced from Content-Length up front and from the actual bytes received
 *    (a missing/lying Content-Length can't bypass the cap).
 *
 * This function treats the URL as an opaque provider reference — it never parses or depends on
 * path structure, filenames, or query parameters, only the hostname and protocol.
 */
export async function fetchRemoteMedia(
  url: string,
  opts: FetchRemoteMediaOptions
): Promise<FetchRemoteMediaResult> {
  const { label, maxBytes, allowedHosts } = opts;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  let current = parseTrustedProviderUrl(url, label, allowedHosts);

  for (let hop = 0; ; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(current.toString(), { redirect: 'manual', signal: controller.signal });
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        throw new Error(`${label}: timed out after ${timeoutMs}ms`);
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) throw new Error(`${label}: redirect response had no Location header`);
      if (hop >= maxRedirects) throw new Error(`${label}: too many redirects`);
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        throw new Error(`${label}: invalid redirect target`);
      }
      assertTrustedProviderUrl(next, label, allowedHosts);
      current = next;
      continue;
    }

    if (!res.ok) {
      throw new Error(`${label}: fetch failed (${res.status})`);
    }

    const contentLength = res.headers.get('content-length');
    if (contentLength && Number(contentLength) > maxBytes) {
      throw new Error(`${label}: remote content exceeds size limit`);
    }
    const rawBuffer = await res.arrayBuffer();
    if (rawBuffer.byteLength > maxBytes) {
      throw new Error(`${label}: remote content exceeds size limit`);
    }
    return { buffer: Buffer.from(rawBuffer), contentType: res.headers.get('content-type') };
  }
}
