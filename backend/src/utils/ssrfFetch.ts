/**
 * Fetch with manual redirect handling and per-hop hostname checks (SSRF mitigation).
 */
const MAX_REDIRECTS = 5;

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

    return res as globalThis.Response;
  }
  throw new Error('Too many redirects');
}
