# Authentication Security (Supabase)

Configure these settings in **Supabase Dashboard → Authentication → Settings**:

## Email Verification
- **Enable "Confirm email"** so new signups must verify before signing in.
- Path: Authentication → Providers → Email → Confirm email = ON

## Session & JWT
- **JWT Expiry**: Recommended 3600 seconds (1 hour) for access tokens.
- **Refresh token rotation**: Enable for stolen-token revocation.
- Path: Authentication → Settings → JWT expiry

## Password Reset
- Supabase password reset links expire after 1 hour by default.
- Configure in Authentication → Email Templates → Reset Password if needed.

## Frontend (safe to expose)
- `VITE_SUPABASE_URL` — your project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — the **anon** key (public by design; RLS protects data)

Never expose the **service_role** key in frontend code.
