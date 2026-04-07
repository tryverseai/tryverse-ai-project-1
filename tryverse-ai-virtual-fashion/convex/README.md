# TryVerse Convex backend

This folder is the Convex project that mirrors your Supabase `public` schema (`schema.ts`). Auth stays on **Supabase** initially: JWTs are validated in `auth.config.ts` using your project’s JWKS (see env vars below).

## One-time link (project: TryVerse)

From **this directory’s parent** (`tryverse-ai-virtual-fashion/`):

```bash
npm install
npx convex dev
```

- Log in and select the **TryVerse** deployment you created (or create one).
- This writes deployment config to `.env.local` / `CONVEX_DEPLOYMENT` and generates `convex/_generated/**`.

Add to the **Convex dashboard → Settings → Environment variables**:

| Name | Value |
|------|--------|
| `SUPABASE_JWT_ISSUER` | `https://<project-ref>.supabase.co/auth/v1` (must match JWT `iss`) |
| `SUPABASE_JWKS_URL` | `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json` |

Add to **`tryverse-ai-virtual-fashion/.env`** (Vite):

```
VITE_CONVEX_URL=https://<your-deployment>.convex.cloud
```

Use the **HTTP origin** Convex shows for the deployment (same as in the Convex dashboard after `npx convex dev`).

## Scripts

- `npm run convex:dev` — `convex dev` (push schema + functions, watch, codegen)
- `npm run convex:deploy` — `convex deploy` (production)

## Implemented functions

- `profiles:getMyProfile` — authenticated profile row
- `profiles:upsertProfileForUser` — idempotent profile row for the signed-in user
- `plans:listActivePlans` — active plans (public read)
- `modelLibrary:listActiveModels` — active presets (public read)

## Next migration steps

1. **Seed / backfill** data from Supabase (one-shot script or Convex import) so `legacy_id` on library rows matches old UUIDs where the app still expects them.
2. **Replace** direct `supabase.from(...)` calls in React with `useQuery` / `useMutation` against these functions.
3. **Point** the Node API at Convex via `ConvexHttpClient` + user JWT, or move try-on persistence into Convex `mutation`s / `action`s and slim the Express app.

See also `CONVEX_SETUP.md` in this folder’s parent for a full cutover checklist.
