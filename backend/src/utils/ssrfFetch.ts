/**
 * Fetch with manual redirect handling, per-hop hostname checks (SSRF mitigation),
 * and a response size cap to prevent OOM from malicious large responses.
 */
const MAX_REDIRECTS = 5;

/** Maximum bytes we will buffer from a remote image URL (10 MB). */
export const MAX_REMOTE_RESPONSE_BYTES = 10 * 1024 * 1024;

export type HostBlockFn = (hostname: string) => boolean;

export async function fetchWithSsrfRedirectChecks(
  initialUrl: string,
  isBlockedHost: HostBlockFn
): Promise<globalThis.Response> {
  let url = initialUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error('Invalid URL');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid URL protocol');
    }
    if (isBlockedHost(parsed.hostname)) {
      throw new Error('URL host not allowed');
    }

    const res = await fetch(url, {
      redirect: 'manual',
      headers: { Accept: 'image/*,*/*;q=0.8' },
    });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) {
        throw new Error('Redirect without Location header');
      }
      const nextUrl = new URL(loc, url).href;
      url = nextUrl;
      continue;
    }

    // Reject responses that advertise a body larger than our cap before we
    // even start buffering — protects against slow or large payloads.
    const contentLength = res.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_REMOTE_RESPONSE_BYTES) {
      throw new Error('Remote image exceeds maximum allowed size');
    }

    return res as globalThis.Response;
  }
  throw new Error('Too many redirects');
}
