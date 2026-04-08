# Early access vs sign-up

**Policy**

- **Anyone** can request **Early Access** (waitlist) via **Get Early Access** on the site.
- **Full account sign-up** is **invite-only** — for brands/emails you have approved.

**Product behavior**

- Default auth page (`/auth`) is **Sign in** only.
- **Create account** (registration) is shown when the user opens an **invite link**:
  - `https://<your-domain>/auth?signup=true`
  - Optional alias: `?invite=true`

Send that URL in your invite email. The URL alone is not strong security; for strict enforcement, validate the email against an allowlist (or your CRM) before exposing sign-up, or gate `signUp` in Convex Auth / your backend.

**Copy**

- Waitlist → `/early-access`
- Existing users → `/auth`
- Invited new users → `/auth?signup=true`
