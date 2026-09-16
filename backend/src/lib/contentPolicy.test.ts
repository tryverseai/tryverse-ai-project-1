import { describe, it, expect, vi } from 'vitest';

// contentPolicy.ts imports AppError from middleware/errorHandler, which also exports the Express
// error-handling middleware and pulls in env validation as a side effect of that file's other
// imports — stub those out so this stays a pure unit test (same approach as payments/paystack.test.ts).
vi.mock('../config/env', () => ({ env: { NODE_ENV: 'test', SENTRY_DSN: '' } }));
vi.mock('../config/sentry', () => ({ Sentry: { withScope: vi.fn(), captureException: vi.fn() } }));

import { assertPromptDoesNotDescribeAMinor, ProhibitedMinorContentError } from './contentPolicy';

describe('assertPromptDoesNotDescribeAMinor', () => {
  it('allows ordinary adult fashion-model prompts', () => {
    expect(() =>
      assertPromptDoesNotDescribeAMinor(
        'professional African fashion model, female, age 28, dark skin, studio lighting, luxury editorial fashion campaign'
      )
    ).not.toThrow();
  });

  it('allows a prompt with no age or age-adjacent wording at all', () => {
    expect(() => assertPromptDoesNotDescribeAMinor('male model, streetwear, urban background, confident pose')).not.toThrow();
  });

  it.each([
    'toddler fashion model wearing a summer dress',
    'a 5 year old child model',
    'a 5-year-old model',
    '7 yo boy in a school uniform',
    'age 8 girl, studio portrait',
    'aged 3, smiling',
    'infant wearing a onesie',
    'newborn baby portrait',
    'preteen model, casual outfit',
    'tween fashion shoot',
    'underage-looking model',
    'kindergarten class photo style',
    'elementary school student, uniform',
    'a young kid trying on shoes',
    'photo of a child in winter clothing',
    'children modeling matching pajamas',
  ])('rejects: %s', (prompt) => {
    expect(() => assertPromptDoesNotDescribeAMinor(prompt)).toThrow(ProhibitedMinorContentError);
  });

  it('rejects regardless of case', () => {
    expect(() => assertPromptDoesNotDescribeAMinor('TODDLER MODEL, BRIGHT COLORS')).toThrow(ProhibitedMinorContentError);
  });

  it('does not reject adult ages just because they contain a digit near "old"', () => {
    expect(() => assertPromptDoesNotDescribeAMinor('a 28 year old model, confident and stylish')).not.toThrow();
    expect(() => assertPromptDoesNotDescribeAMinor('a 45-year-old male model')).not.toThrow();
  });

  it('throws a 422 AppError with the PROHIBITED_CONTENT_MINOR code', () => {
    try {
      assertPromptDoesNotDescribeAMinor('toddler model');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ProhibitedMinorContentError);
      const e = err as ProhibitedMinorContentError;
      expect(e.statusCode).toBe(422);
      expect(e.code).toBe('PROHIBITED_CONTENT_MINOR');
    }
  });
});
