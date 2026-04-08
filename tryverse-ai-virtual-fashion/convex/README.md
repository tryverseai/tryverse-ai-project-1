# TryVerse Convex backend

This folder is the Convex project: **`schema.ts`** defines tables; **`auth.ts`** configures Convex Auth (password, profile fields for individual vs business sign-up). **`auth.config.ts`** wires the Auth.js-style provider domain.

## One-time link

From **`tryverse-ai-virtual-fashion/`**:

```bash
npm install
npx convex dev
```

Log in and select your deployment. This writes **`.env.local`** / deployment config and generates **`convex/_generated/**`.

## Dashboard → Environment variables

| Name | Purpose |
|------|--------|
| `JWT_PRIVATE_KEY` | RS256 private key (PEM) for session JWTs |
| `JWKS` | Public JWKS for the same key |
| `AUTH_RESEND_KEY` | Resend API key (password reset email) |
| `AUTH_EMAIL_FROM` | Optional verified From address |

Also set **`BACKEND_SHARED_SECRET`** (and any other server secrets) to match the Node **`backend/.env`** where the API calls Convex with the deploy secret.

Frontend **`.env`**:

```env
VITE_CONVEX_URL=https://<your-deployment>.convex.cloud
```

## Scripts

- `npm run convex:dev` — `convex dev`
- `npm run convex:deploy` — `convex deploy`

## Implemented surface (high level)

- Profiles, plans, model library, billing-related queries/mutations, admin/trusted actions, etc. — see `convex/*.ts`.

See **`CONVEX_SETUP.md`** in the repo root for a short env checklist.
