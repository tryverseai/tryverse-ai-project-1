import { describe, it, expect } from 'vitest';
import { normalizeAdminKeyInput, timingSafeStringEqual } from './adminKey';

describe('timingSafeStringEqual', () => {
  it('returns true for identical strings', () => {
    expect(timingSafeStringEqual('super-secret-key', 'super-secret-key')).toBe(true);
  });

  it('returns false for different strings of the same length', () => {
    expect(timingSafeStringEqual('super-secret-key', 'super-secret-kex')).toBe(false);
  });

  it('returns false for different lengths without throwing', () => {
    // crypto.timingSafeEqual throws on mismatched buffer lengths — the wrapper must catch that
    // case itself before ever calling it, not let the throw escape as an unhandled error.
    expect(() => timingSafeStringEqual('short', 'a-much-longer-secret')).not.toThrow();
    expect(timingSafeStringEqual('short', 'a-much-longer-secret')).toBe(false);
  });

  it('returns false when one side is empty', () => {
    expect(timingSafeStringEqual('', 'not-empty')).toBe(false);
    expect(timingSafeStringEqual('not-empty', '')).toBe(false);
  });

  it('returns true when both sides are empty', () => {
    expect(timingSafeStringEqual('', '')).toBe(true);
  });

  it('is case-sensitive', () => {
    expect(timingSafeStringEqual('AdminKey123', 'adminkey123')).toBe(false);
  });
});

describe('normalizeAdminKeyInput', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeAdminKeyInput('  my-key  ')).toBe('my-key');
  });

  it('strips a UTF-8 BOM', () => {
    expect(normalizeAdminKeyInput('﻿my-key')).toBe('my-key');
  });

  it('strips wrapping double quotes copied from a .env file', () => {
    expect(normalizeAdminKeyInput('"my-key"')).toBe('my-key');
  });

  it('strips wrapping single quotes', () => {
    expect(normalizeAdminKeyInput("'my-key'")).toBe('my-key');
  });

  it('does not strip a quote that only appears on one side', () => {
    expect(normalizeAdminKeyInput('"my-key')).toBe('"my-key');
  });

  it('coerces non-string input to a string rather than throwing', () => {
    expect(normalizeAdminKeyInput(undefined)).toBe('');
    expect(normalizeAdminKeyInput(null)).toBe('');
  });
});
