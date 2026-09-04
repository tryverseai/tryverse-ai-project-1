import { describe, it, expect } from 'vitest';
import { welcomeEmail, accountVerifiedEmail } from './templates';

// Regression coverage for the welcome-email credit bug: the template used to hardcode "20"
// independently of the real allocation (a flat 10 free AI generations per business account —
// see DEFAULT_FREE_CREDITS_BUSINESS in backend/src/services/credits.ts), so it could never
// reflect what a new account actually got. These assert the template now renders whatever value
// it's told, with a safe default only when the caller genuinely has no profile data.

describe('welcomeEmail credits line', () => {
  it('renders the real credits value passed in, not a hardcoded number', () => {
    const t = welcomeEmail({ name: 'Ada', brandName: '', credits: 5 });
    expect(t.html).toContain('5 complimentary AI generation');
    expect(t.text).toContain('5 complimentary AI generation');
    expect(t.html).not.toContain('20 complimentary');
    expect(t.text).not.toContain('20 complimentary');
  });

  it('renders 10 for a business-account allocation', () => {
    const t = welcomeEmail({ name: 'Ada', brandName: 'Acme', credits: 10 });
    expect(t.html).toContain('10 complimentary AI generation');
    expect(t.text).toContain('10 complimentary AI generation');
  });

  it('falls back to 10 when no credits value is supplied at all', () => {
    const t = welcomeEmail({ name: 'Ada', brandName: '' });
    expect(t.html).toContain('10 complimentary AI generation');
  });

  it('uses correct singular grammar for exactly 1 credit', () => {
    const t = welcomeEmail({ name: 'Ada', brandName: '', credits: 1 });
    expect(t.text).toContain('1 complimentary AI generation has been added');
    expect(t.text).not.toContain('generations');
  });

  it('never renders a negative credits value — falls back to the safe default instead', () => {
    const t = welcomeEmail({ name: 'Ada', brandName: '', credits: -5 });
    expect(t.html).toContain('10 complimentary AI generation');
    expect(t.html).not.toContain('-5');
  });
});

describe('accountVerifiedEmail credits line', () => {
  it('renders the real credits value passed in, not a hardcoded number', () => {
    const t = accountVerifiedEmail({ firstName: 'Ada', credits: 5 });
    expect(t.html).toContain('5 complimentary AI generation');
    expect(t.text).toContain('5 complimentary AI generation');
    expect(t.html).not.toContain('20 complimentary');
  });

  it('falls back to 10 when no credits value is supplied', () => {
    const t = accountVerifiedEmail({ firstName: 'Ada' });
    expect(t.html).toContain('10 complimentary AI generation');
  });
});
