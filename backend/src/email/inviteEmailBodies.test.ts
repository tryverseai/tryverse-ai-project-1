import { describe, it, expect } from 'vitest';
import * as inviteBodies from './inviteEmailBodies';
import { businessInviteBodies } from './inviteEmailBodies';

// TryVerse is B2B-only. There is exactly one invite flavour — business. This locks in the
// removal of the legacy individual/"personal" invite path (personalInviteBodies), so a future
// edit can't quietly reintroduce a consumer invite email.

describe('invite email bodies — B2B-only', () => {
  it('exposes only the business invite builder', () => {
    expect(typeof businessInviteBodies).toBe('function');
    expect((inviteBodies as Record<string, unknown>).personalInviteBodies).toBeUndefined();
  });

  it('business invite renders company + business-access framing, not personal-account framing', () => {
    const { subject, html, text } = businessInviteBodies({
      name: 'Ada',
      email: 'ada@acme.com',
      companyName: 'Acme',
      inviteUrl: 'https://tryverseai.com/auth/invite?token=inv_abc',
    });
    expect(subject).toMatch(/business/i);
    expect(html).toContain('Acme');
    expect(html).toMatch(/business access/i);
    expect(html).not.toMatch(/personal (account|style|access link)/i);
    expect(text).not.toMatch(/personal (account|style|access link)/i);
  });

  it('falls back to a neutral org label when no company name is given', () => {
    const { html } = businessInviteBodies({
      name: '',
      email: 'ada@acme.com',
      companyName: '',
      inviteUrl: 'https://tryverseai.com/x',
    });
    expect(html).toContain('Your organization');
  });
});
