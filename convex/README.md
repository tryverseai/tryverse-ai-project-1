# TryVerse Convex backend

This folder is the Convex project: **`schema.ts`** defines tables; **`auth.ts`** configures Convex Auth (password + profile fields for business sign-up — TryVerse is B2B-only, every profile is `account_type: "business"`). **`auth.config.ts`** wires the Auth.js-style provider domain.

## One-time link

From the repo root (the frontend/Convex code lives here directly, not in a subdirectory):

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

## ⚠️ Dev vs production — read this before running any convex command

This project has an unusual, deliberate setup because of a naming mixup that happened twice (see git history). **Read this whole section before assuming what `npx convex dev` or `npx convex deploy` will do.**

| Deployment | Convex's own label | What it actually is |
|---|---|---|
| **`patient-axolotl-17`** | `dev:` (personal dev deployment) | **The real production database.** Railway's `CONVEX_URL` and Vercel's `VITE_CONVEX_URL` both point here. Holds all real customer data. |
| **`pastel-setter-205`** | `prod:` (the project's official production deployment) | **Empty, repurposed as the local dev/testing sandbox.** Nothing in the live app talks to it. |

Why: `patient-axolotl-17` accumulated all the real data over time (Railway/Vercel were configured to point at it), while the Convex-provisioned "official" prod deployment (`pastel-setter-205`) sat unused. Migrating the real data into the correctly-labeled deployment was judged too risky (would require a live data + file-storage migration with a cutover window) versus just documenting reality clearly and adding guardrails — which is what this section is.

**NEVER run bare `npx convex dev` or `npx convex deploy` in this repo.** Always use the npm scripts below — each pins its target deployment via its own `--env-file`, rather than trusting `.env.local`.

Why bare commands are unsafe here: `.env.local`'s `CONVEX_DEPLOYMENT` line is **not reliable**. Convex's CLI rewrites `.env.local` after every `convex dev`/`deploy` run, but inconsistently — sometimes it updates `VITE_CONVEX_URL` while leaving `CONVEX_DEPLOYMENT` stale (pointed at whatever deployment a *previous* command used), producing a file where the two values contradict each other. A bare `npx convex dev` reads `CONVEX_DEPLOYMENT` from that file — if it's stale and says `dev:patient-axolotl-17`, you just pushed to real production without meaning to. The npm scripts below sidestep this entirely by never reading `.env.local`'s `CONVEX_DEPLOYMENT` — each passes its own dedicated env file instead.

**Commands, given that setup:**

- **`npm run convex:dev`** / **`npm run convex:dev:reset`** — pushes to the dev sandbox (`pastel-setter-205`), reading `.env.dev-sandbox` (gitignored, pinned to `prod:pastel-setter-205`). Safe to break, experiment, run test-account tooling, anything. `:reset` is the one-shot form — run it any time you're not sure what `.env.local` currently says, to force it back to the sandbox.
- **`npm run convex:deploy:prod`** — the **only** command that reaches real production (`patient-axolotl-17`). Reads `.env.production-convex` (gitignored, pinned to `dev:patient-axolotl-17`).
- **`npx convex deploy`** (bare) — do **not** use this expecting it to reach production. Convex's `deploy` command always targets the project's *officially-typed* prod deployment (`pastel-setter-205`), which is the empty sandbox, not the real one. `npm run convex:deploy` is kept only for completeness/parity — treat it as inert for this project.

**`npm run convex:deploy:prod` now auto-resets `.env.local` back to the sandbox afterward** via a `postconvex:deploy:prod` npm hook (runs `convex:dev:reset` automatically) — you no longer have to remember this manually. This guardrail exists because relying on a human to remember it already caused a real incident: a local dev session's frontend was left pointed at production, its backend still pointed at the sandbox, and Convex Auth rejected every session with `NoAuthProvider` — reported to Sentry as if it were a real production outage. If you ever run a bare `npx convex dev`/`deploy` outside these npm scripts, run `npm run convex:dev:reset` immediately after by hand.

## Scripts

- `npm run convex:dev` — dev sandbox, watch mode
- `npm run convex:dev:reset` — dev sandbox, one-shot — run after any prod push, or whenever unsure of `.env.local`'s state
- `npm run convex:deploy:prod` — pushes to **real production** (`patient-axolotl-17`) — see warning above
- `npm run convex:deploy` — `convex deploy` — inert for this project (see above), kept for parity only

## Implemented surface (high level)

- Profiles, plans, model library, billing-related queries/mutations, admin/trusted actions, etc. — see `convex/*.ts`.

See **`CONVEX_SETUP.md`** in the repo root for a short env checklist.
