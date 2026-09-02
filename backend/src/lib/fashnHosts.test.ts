import { describe, it, expect } from 'vitest';
import { isTrustedFashnOutputHost, TRUSTED_FASHN_OUTPUT_HOSTS } from './fashnHosts';

describe('isTrustedFashnOutputHost', () => {
  it('trusts the legacy CDN host', () => {
    expect(isTrustedFashnOutputHost('cdn.fashn.ai')).toBe(true);
  });

  it('trusts the new media host post-migration', () => {
    expect(isTrustedFashnOutputHost('media.fashn.ai')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isTrustedFashnOutputHost('CDN.FASHN.AI')).toBe(true);
    expect(isTrustedFashnOutputHost('Media.Fashn.Ai')).toBe(true);
  });

  it('tolerates surrounding whitespace', () => {
    expect(isTrustedFashnOutputHost('  cdn.fashn.ai  ')).toBe(true);
  });

  it('rejects an unrelated public host', () => {
    expect(isTrustedFashnOutputHost('example.com')).toBe(false);
  });

  it('rejects a lookalike domain that merely contains the trusted name', () => {
    expect(isTrustedFashnOutputHost('cdn.fashn.ai.evil.com')).toBe(false);
    expect(isTrustedFashnOutputHost('evil-cdn.fashn.ai')).toBe(false);
    expect(isTrustedFashnOutputHost('cdnfashn.ai')).toBe(false);
    expect(isTrustedFashnOutputHost('cdn-fashn.ai')).toBe(false);
  });

  it('rejects a subdomain bypass attempt', () => {
    expect(isTrustedFashnOutputHost('attacker.cdn.fashn.ai')).toBe(false);
    expect(isTrustedFashnOutputHost('fashn.ai')).toBe(false);
  });

  it('exposes exactly the two documented hosts', () => {
    expect([...TRUSTED_FASHN_OUTPUT_HOSTS].sort()).toEqual(['cdn.fashn.ai', 'media.fashn.ai']);
  });
});
