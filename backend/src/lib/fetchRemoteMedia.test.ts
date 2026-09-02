import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchRemoteMedia, parseTrustedProviderUrl } from './fetchRemoteMedia';
import { TRUSTED_FASHN_OUTPUT_HOSTS } from './fashnHosts';

describe('parseTrustedProviderUrl', () => {
  it('accepts an HTTPS URL on a trusted host', () => {
    const url = parseTrustedProviderUrl('https://cdn.fashn.ai/out/1.jpg', 'test', TRUSTED_FASHN_OUTPUT_HOSTS);
    expect(url.hostname).toBe('cdn.fashn.ai');
  });

  it('accepts the post-migration media host', () => {
    const url = parseTrustedProviderUrl('https://media.fashn.ai/out/1.jpg', 'test', TRUSTED_FASHN_OUTPUT_HOSTS);
    expect(url.hostname).toBe('media.fashn.ai');
  });

  it('accepts any public HTTPS host when no allowlist is given (blocklist-only mode)', () => {
    const url = parseTrustedProviderUrl('https://replicate.delivery/xyz/out.png', 'test');
    expect(url.hostname).toBe('replicate.delivery');
  });

  it('rejects plain HTTP', () => {
    expect(() => parseTrustedProviderUrl('http://cdn.fashn.ai/out/1.jpg', 'test', TRUSTED_FASHN_OUTPUT_HOSTS)).toThrow(
      /only HTTPS URLs are allowed/
    );
  });

  it('rejects a host not on the allowlist', () => {
    expect(() => parseTrustedProviderUrl('https://evil.com/out/1.jpg', 'test', TRUSTED_FASHN_OUTPUT_HOSTS)).toThrow(
      /not a trusted output host/
    );
  });

  it('rejects a lookalike host', () => {
    expect(() =>
      parseTrustedProviderUrl('https://cdn.fashn.ai.evil.com/out.jpg', 'test', TRUSTED_FASHN_OUTPUT_HOSTS)
    ).toThrow(/not a trusted output host/);
  });

  it('rejects a subdomain bypass attempt', () => {
    expect(() =>
      parseTrustedProviderUrl('https://attacker.cdn.fashn.ai/out.jpg', 'test', TRUSTED_FASHN_OUTPUT_HOSTS)
    ).toThrow(/not a trusted output host/);
  });

  it('rejects localhost', () => {
    expect(() => parseTrustedProviderUrl('https://localhost/out.jpg', 'test')).toThrow(/URL host not allowed/);
  });

  it('rejects loopback IPv4', () => {
    expect(() => parseTrustedProviderUrl('https://127.0.0.1/out.jpg', 'test')).toThrow(/URL host not allowed/);
  });

  it('rejects private IPv4 ranges', () => {
    expect(() => parseTrustedProviderUrl('https://10.0.0.5/out.jpg', 'test')).toThrow(/URL host not allowed/);
    expect(() => parseTrustedProviderUrl('https://172.16.0.5/out.jpg', 'test')).toThrow(/URL host not allowed/);
    expect(() => parseTrustedProviderUrl('https://192.168.1.5/out.jpg', 'test')).toThrow(/URL host not allowed/);
  });

  it('rejects link-local / cloud metadata addresses', () => {
    expect(() => parseTrustedProviderUrl('https://169.254.169.254/latest/meta-data', 'test')).toThrow(
      /URL host not allowed/
    );
  });

  it('rejects IPv6 loopback', () => {
    expect(() => parseTrustedProviderUrl('https://[::1]/out.jpg', 'test')).toThrow(/URL host not allowed/);
  });

  it('rejects an unparseable URL', () => {
    expect(() => parseTrustedProviderUrl('not-a-url', 'test')).toThrow(/invalid URL/);
  });
});

describe('fetchRemoteMedia', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockResponse(opts: {
    status?: number;
    ok?: boolean;
    headers?: Record<string, string>;
    body?: ArrayBuffer;
  }) {
    const headers = new Map(Object.entries(opts.headers ?? {}));
    return {
      status: opts.status ?? 200,
      ok: opts.ok ?? true,
      headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? headers.get(k) ?? null },
      arrayBuffer: async () => opts.body ?? new ArrayBuffer(0),
    } as unknown as Response;
  }

  it('returns the buffer and content-type for a successful fetch under the size cap', async () => {
    const body = new TextEncoder().encode('hello world').buffer;
    global.fetch = vi.fn().mockResolvedValue(
      mockResponse({ headers: { 'content-type': 'image/jpeg', 'content-length': String(body.byteLength) }, body })
    );

    const result = await fetchRemoteMedia('https://cdn.fashn.ai/out/1.jpg', {
      label: 'test',
      maxBytes: 1024,
      allowedHosts: TRUSTED_FASHN_OUTPUT_HOSTS,
    });

    expect(result.contentType).toBe('image/jpeg');
    expect(Buffer.from(result.buffer).toString()).toBe('hello world');
  });

  it('rejects before reading the body when Content-Length exceeds the cap', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ headers: { 'content-length': '999999999' } }));
    global.fetch = fetchMock;

    await expect(
      fetchRemoteMedia('https://cdn.fashn.ai/out/1.jpg', { label: 'test', maxBytes: 1024 })
    ).rejects.toThrow(/exceeds size limit/);
  });

  it('rejects when the actual body exceeds the cap even without a Content-Length header', async () => {
    const body = new ArrayBuffer(2048);
    global.fetch = vi.fn().mockResolvedValue(mockResponse({ body }));

    await expect(
      fetchRemoteMedia('https://cdn.fashn.ai/out/1.jpg', { label: 'test', maxBytes: 1024 })
    ).rejects.toThrow(/exceeds size limit/);
  });

  it('follows a redirect to a trusted host', async () => {
    const body = new TextEncoder().encode('final').buffer;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockResponse({ status: 302, ok: false, headers: { location: 'https://media.fashn.ai/out/2.jpg' } }))
      .mockResolvedValueOnce(mockResponse({ body }));
    global.fetch = fetchMock;

    const result = await fetchRemoteMedia('https://cdn.fashn.ai/out/1.jpg', {
      label: 'test',
      maxBytes: 1024,
      allowedHosts: TRUSTED_FASHN_OUTPUT_HOSTS,
    });

    expect(Buffer.from(result.buffer).toString()).toBe('final');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects a redirect to an untrusted host instead of following it', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockResponse({ status: 302, ok: false, headers: { location: 'https://evil.com/steal.jpg' } }));
    global.fetch = fetchMock;

    await expect(
      fetchRemoteMedia('https://cdn.fashn.ai/out/1.jpg', {
        label: 'test',
        maxBytes: 1024,
        allowedHosts: TRUSTED_FASHN_OUTPUT_HOSTS,
      })
    ).rejects.toThrow(/not a trusted output host/);
    // The untrusted host must never actually be requested.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a redirect to a private/internal host', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockResponse({ status: 302, ok: false, headers: { location: 'http://169.254.169.254/latest/meta-data' } }));
    global.fetch = fetchMock;

    await expect(
      fetchRemoteMedia('https://cdn.fashn.ai/out/1.jpg', { label: 'test', maxBytes: 1024 })
    ).rejects.toThrow(/URL host not allowed|only HTTPS URLs are allowed/);
  });

  it('caps the number of redirect hops', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse({ status: 302, ok: false, headers: { location: 'https://cdn.fashn.ai/loop.jpg' } })
    );
    global.fetch = fetchMock;

    await expect(
      fetchRemoteMedia('https://cdn.fashn.ai/out/1.jpg', {
        label: 'test',
        maxBytes: 1024,
        allowedHosts: TRUSTED_FASHN_OUTPUT_HOSTS,
        maxRedirects: 2,
      })
    ).rejects.toThrow(/too many redirects/);
  });

  it('surfaces a clear error when the upstream fetch times out', async () => {
    const abortError = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
    global.fetch = vi.fn().mockRejectedValue(abortError);

    await expect(
      fetchRemoteMedia('https://cdn.fashn.ai/out/1.jpg', { label: 'test', maxBytes: 1024, timeoutMs: 5 })
    ).rejects.toThrow(/timed out/);
  });

  it('rejects a non-2xx, non-redirect response', async () => {
    global.fetch = vi.fn().mockResolvedValue(mockResponse({ status: 500, ok: false }));

    await expect(
      fetchRemoteMedia('https://cdn.fashn.ai/out/1.jpg', { label: 'test', maxBytes: 1024 })
    ).rejects.toThrow(/fetch failed \(500\)/);
  });
});
