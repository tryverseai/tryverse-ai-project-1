# Early access vs sign-up

**Policy**

- **Anyone** can request **Early Access** (waitlist) via **Get Early Access** on the site.
- **Full account sign-up** is **invite-only** — for brands/emails you have approved.

**Product behavior**

- Default auth page (`/auth`) is **Sign in** only.
- **Create account** (registration) is shown when the user opens an **invite link**:
  - `https://<your-domain>/auth?signup=true`
  - Optional alias: `?invite=true`

Send that URL in your invite email. The URL alone is not strong security; for strict enforcement, use Supabase [Auth hooks](https://supabase.com/docs/guides/auth/auth-hooks) or an allowlist table and validate before `signUp`.

**Copy**

- Waitlist → `/early-access`
- Existing users → `/auth`
- Invited new users → `/auth?signup=true`
