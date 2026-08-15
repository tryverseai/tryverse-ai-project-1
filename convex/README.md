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
| `AUTH_RESEND_KEY` | Resend API key (password reset / auth email) — same `re_…` key as backend `RESEND_API_KEY` |
| `AUTH_EMAIL_FROM` | Verified sender on your domain, e.g. `TryVerse <info@tryverseai.com>` (must match a domain verified in Resend) |

**Leads:** Waitlist submissions are stored in **`early_access_requests`** (backend `POST /api/early-access` → `insertEarlyAccessRowTrusted`). Book-a-demo form submissions (no Calendly) are stored in **`support_requests`** with `category: "demo_request"` via `insertSupportRequestTrusted`.

Also set **`BACKEND_SHARED_SECRET`** (and any other server secrets) to match the Node **`backend/.env`** where the API calls Convex with the deploy secret.

Frontend **`.env`**:

```env
VITE_CONVEX_URL=https://<your-deployment>.convex.cloud
```

## Dev vs production pushes

- **`npx convex dev --once`** (or `npx convex dev`) pushes functions + schema to the **development** deployment in `.env.local` (`CONVEX_DEPLOYMENT=dev:…`), e.g. **patient-axolotl-17**. Use this when that’s the deployment you open in the Convex dashboard.
- **`npx convex deploy`** pushes to your linked **production** deployment (often a different `*.convex.cloud` URL). Only use it when you intend to update prod.

Keep **`backend/.env`** `CONVEX_URL` and the app **`VITE_CONVEX_URL`** / **`.env.local`** pointed at the **same** deployment you care about. **Vercel:** set **`VITE_CONVEX_URL`** and your hosted API’s **`CONVEX_URL`** to that same URL (e.g. `https://patient-axolotl-17.eu-west-1.convex.cloud`).

## Scripts

- `npm run convex:dev` — `convex dev`
- `npm run convex:deploy` — `convex deploy` (production deployment only)

## Implemented surface (high level)

- Profiles, plans, model library, billing-related queries/mutations, admin/trusted actions, etc. — see `convex/*.ts`.

See **`CONVEX_SETUP.md`** in the repo root for a short env checklist.
