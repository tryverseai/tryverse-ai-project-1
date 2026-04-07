# Convex migration (TryVerse)

Full migration from Supabase → Convex is **multi-phase**. This repo now contains:

| Delivered | Purpose |
|-----------|---------|
| `convex/schema.ts` | Tables mirroring `public.*` (with optional `legacy_id` for UUID parity) |
| `convex/auth.config.ts` | Validates **Supabase** access tokens (hybrid: same auth, new DB) |
| `convex/profiles.ts`, `plans.ts`, `modelLibrary.ts` | First Convex API surface |
| `ConvexProviderGate` + `VITE_CONVEX_URL` | React client + JWT forwarding |

The **Express API** and **Supabase Postgres** are still the source of truth until you backfill Convex and switch reads/writes.

## Phase 0 — Link your “TryVerse” Convex project

```bash
cd tryverse-ai-virtual-fashion
npm install
npm run convex:dev
```

Select your existing deployment. Set Convex env vars (**Dashboard → Settings → Environment**):

- `SUPABASE_JWT_ISSUER` = `https://<ref>.supabase.co/auth/v1`
- `SUPABASE_JWKS_URL` = `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json`

Add to `.env`:

```env
VITE_CONVEX_URL=https://<your-deployment>.convex.cloud
```

Restart Vite. Sign in; `useQuery(api.profiles.getMyProfile, {})` should resolve once the profile row exists in Convex.

## Phase 1 — Backfill data

1. Export from Supabase (CSV or SQL `COPY`).
2. Write a **one-off** Convex mutation (or `npx convex import`) to insert rows.
3. For `tryverse_model_library`, set **`legacy_id`** to the old Postgres UUID so IDs match `GET /api/models` during dual-run.

## Phase 2 — Frontend

Replace `supabase.from(...)` usage with `useQuery` / `useMutation` per feature (Billing, Overview, Api keys, etc.). Keep Supabase Auth until you move to Clerk / Convex Auth.

## Phase 3 — Backend (`backend/`)

Options:

1. **ConvexHttpClient** from Node with the user’s JWT for user-scoped calls, plus deploy key only for admin scripts, or  
2. Move try-on + credits + admin paths into **Convex mutations/actions** and delete duplicate Postgres access.

Until then, production continues to use `supabaseAdmin` in Express unchanged.

## Phase 4 — Decommission Supabase DB

After traffic proves Convex-only:

- Remove Supabase client usage, migrations, and RLS-dependent flows.
- Keep Supabase **Auth** only if still needed, or migrate identities to Clerk.

---

**Scope note:** Completing phases 1–4 touches most files in `tryverse-ai-virtual-fashion` and `backend`. This document tracks intent; use `convex/README.md` for day-to-day Convex CLI commands.
