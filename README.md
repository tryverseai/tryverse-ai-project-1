# TryVerse — AI Fashion Infrastructure

A **B2B AI fashion infrastructure platform**. Fashion brands, retailers, designers, and creative
teams use TryVerse to generate and visualize fashion content — virtual try-on, AI photoshoots,
AI-generated models, outfit visualization, and product video.

- **TryVerse has no individual / consumer ("B2C") account type.** Every account is a business
  account. A human authenticates as an **Authorized User** acting for that business; `user_id`
  is the ownership, authorization, and audit boundary. There is no multi-seat organization model
  today (deferred future work).
- Two product surfaces: the **business dashboard** (`tryverseai.com` — creation tools, Products,
  Analytics, Developers, API Keys, Billing) and the **integration surface** a business uses to
  bring try-on to *its own* storefront. The integration surface has three paths, in order of
  preference: the **SDK** (recommended), the **REST API**, and an **embeddable widget** /
  personalization script (a lower-friction fallback for teams without engineering resource).
- "Shoppers" throughout the code are a **brand's own** end customers using that brand's embedded
  experience — never TryVerse account holders.

## Stack

| Area | Tech |
|------|------|
| Frontend | React + Vite + TypeScript + Tailwind (`src/`, root package) |
| Backend | Node.js + Express + TypeScript (`backend/`) |
| Database / Auth / File storage | Convex (`convex/`) — Convex Auth (password + email OTP), signed-URL storage |
| AI generation | FASHN direct API (try-on, outfit, model generation, photoshoot, video) |
| Queue | Bull / Redis (optional — jobs run synchronously without it) |
| Payments | Paystack, Flutterwave (NGN / USD) |
| Email | Resend |
| Analytics / monitoring | PostHog, Sentry (both optional, env-gated) |
| SDK | `@tryverseai/sdk` (`sdk/`) |

## Repository layout

The repo is **flat** — the frontend and Convex functions live at the root, the API server is a
nested package.

```
.
├── src/               Frontend — pages, components, contexts, hooks, lib (backendApi.ts)
├── convex/            Convex — schema.ts, queries/mutations/actions, auth, _generated/
│   └── README.md      ⚠ dev-vs-production deployment rules — read before any convex command
├── public/            Static assets + the embeddable widget scripts
│                      (tryverse-widget.js, tryverse-personalize.js, widget.js)
├── sdk/               @tryverseai/sdk source
├── backend/           Express API server (own package.json / package-lock.json)
│   └── src/
│       ├── config/        env, logger, Sentry, Convex HTTP client
│       ├── middleware/    auth, apiKey, rate limiting, requirePlan, validation
│       ├── routes/        REST endpoints (tryon, widget, personalize, upload, payment, admin, …)
│       └── services/      ai/ · analytics/ · cache/ · payments/ · queue/ · storage/ · email/
├── docs/              Deployment, security, legal, testing, widget guides
└── scripts/           One-off ops scripts
```

## Quick start (development)

Requires **Node 18+** and a Convex project. The repo uses **Bun** at the root (`bun.lockb`) and
**npm** in `backend/` (`package-lock.json`).

```sh
# root — frontend + Convex
bun install

# backend
cd backend && npm install && cd ..
```

Environment:

```sh
cp .env.example .env.local          # set VITE_CONVEX_URL
cp backend/.env.example backend/.env # set CONVEX_URL, BACKEND_SHARED_SECRET, plus AI/payment keys
```

`BACKEND_SHARED_SECRET` must be identical in `backend/.env` and the Convex deployment's
environment variables — it guards every trusted backend→Convex call.

Run (three terminals):

```sh
bun run convex:dev     # Convex watcher — see convex/README.md for the deployment caveat
cd backend && npm run dev   # Express on :3001
bun run dev            # Vite on :8080 (proxies /api → :3001)
```

Redis is optional; without it the try-on queue is disabled and jobs run synchronously.

## Tests

See **[`docs/TESTING.md`](docs/TESTING.md)** — three suites (frontend, convex+backend, backend),
and the reliable per-platform commands.

## Deployment

- **Convex**: `convex/README.md` is authoritative. The deployment Convex labels `dev:`
  (`patient-axolotl-17`) is the **real production database**; `prod:` (`pastel-setter-205`) is a
  sandbox. Use `bun run convex:deploy:prod` — never a bare `convex deploy`.
- **Frontend** (Vercel): root directory is the repo root, `vercel.json` handles SPA routing.
- **Backend** (Railway): root directory is `backend/`. Set `FRONTEND_URL`,
  `WIDGET_ALLOWED_ORIGINS`, and `NODE_ENV=production` (stricter rate limits, no dev helpers,
  Redis-only queue). Full host wiring: [`docs/DEPLOY_VERCEL_RAILWAY.md`](docs/DEPLOY_VERCEL_RAILWAY.md);
  go-live checklist: [`docs/GOING_TO_PRODUCTION.md`](docs/GOING_TO_PRODUCTION.md).

## Key scripts

| Where | Command | Description |
|-------|---------|-------------|
| root | `bun run dev` / `bun run build` | Vite dev server (:8080) / production build |
| root | `bun run convex:dev` | Convex watcher against the sandbox |
| root | `bun run convex:deploy:prod` | Deploy Convex functions to **real production** |
| root | `bun run test` / `bun run test:convex` | Frontend / convex+backend suites (see `docs/TESTING.md`) |
| `backend/` | `npm run dev` / `npm run build` | Express with `tsx watch` / compile to `dist/` |
| `backend/` | `npm test` / `npm run lint` | Backend suite / ESLint |
