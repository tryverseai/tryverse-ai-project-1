# Deploy TryVerse on **Vercel** (frontend) + **Railway** (API)

Convex stays on **Convex Cloud** (deploy from the repo root — the frontend/Convex code lives there directly, not in a subdirectory). This guide wires the three pieces: **Vercel UI → Railway API → Convex**.

**Read `convex/README.md`'s "Dev vs production" section before touching any Convex deploy command in this project** — `npx convex deploy` does not reach real production here; use `npm run convex:deploy:prod`.

---

## Architecture

| Piece | Host | Role |
|--------|------|------|
| **Vercel** | `https://tryverseai.com` (or `*.vercel.app`) | Static Vite/React app, env baked in at build time |
| **Railway** | `https://api.tryverseai.com` (or `*.up.railway.app`) | Node Express API, uploads, try-on, webhooks |
| **Convex** | `https://….convex.cloud` | Database, auth, trusted mutations from the API |
| **Redis** (recommended) | Railway Redis plugin | Bull queue + try-on result cache |

---

## 1. Railway — API service

1. **New project** → **Deploy from GitHub** → select this repo.
2. Add a **service** → set **Root directory** to `backend`.
3. **Settings → Deploy**
   - **Build command:** `npm ci && npm run build`
   - **Start command:** `npm run start`
   - Railway sets **`PORT`**; the backend already reads `process.env.PORT` (default `3001` locally).
4. **Generate a public URL** (e.g. `tryverse-production.up.railway.app`) or attach a custom domain **`api.tryverseai.com`** (DNS CNAME to Railway).

### Environment variables (Railway)

Copy from `backend/.env.example` and use **production** values:

| Variable | Notes |
|----------|--------|
| `NODE_ENV` | `production` |
| `PORT` | Usually injected by Railway — leave unset or match their docs |
| `FRONTEND_URL` | Your Vercel URL, e.g. `https://tryverseai.com` |
| `WIDGET_ALLOWED_ORIGINS` | Comma-separated, **no** `*` in prod. Include `https://tryverseai.com` and any merchant origins that embed the widget |
| `PUBLIC_API_HOSTNAMES` | Optional; if API is on `api.tryverseai.com`, set `api.tryverseai.com` |
| `CONVEX_URL` | Production Convex deployment URL — `https://patient-axolotl-17.eu-west-1.convex.cloud` (see `convex/README.md` for why it's this one, not the Convex-labeled "production" deployment) |
| `BACKEND_SHARED_SECRET` | Same secret as Convex `BACKEND_SHARED_SECRET` |
| `REPLICATE_API_TOKEN` | Production token |
| `FASHN_API_KEY` | If you use direct FASHN |
| `REDIS_URL` | Add **Railway Redis** and paste the connection string (recommended) |
| `RESEND_API_KEY` / `EMAIL_FROM` | Production Resend + verified sender domain |
| `ADMIN_SECRET_KEY` | Strong random secret (not the dev placeholder) |
| `SENTRY_DSN` | Optional but recommended |
| Payment / storage keys | As in `.env.example` |

**Health check:** Railway can use path `/health` (already implemented).

### Optional: Bull worker (second Railway service)

If you use the queue worker in production:

- Duplicate the service, same **root** `backend`, **start command:** `npm run start:worker`
- Same env as the API (especially `REDIS_URL`, `CONVEX_URL`, secrets).

---

## 2. Vercel — frontend

1. **Import project** from GitHub.
2. **Root directory:** repo root (the frontend lives at the repo root, not a subdirectory).
3. **Framework preset:** Vite (auto-detected).
4. **Build command:** `npm run build` (default).
5. **Output directory:** `dist` (Vite default).
6. **Install command:** `npm ci` or `npm install`.

### Environment variables (Vercel)

Set these for **Production** (and Preview if you want previews to hit a staging API):

| Variable | Required | Example |
|----------|----------|---------|
| `VITE_BACKEND_URL` | **Yes** in production | `https://api.tryverseai.com` (no trailing slash) |
| `VITE_CONVEX_URL` | **Yes** | `https://patient-axolotl-17.eu-west-1.convex.cloud` — the real production deployment (NOT what `npx convex deploy` targets in this project; see `convex/README.md`) |

**Important:** The app resolves the API URL at build time for production. If `VITE_BACKEND_URL` is missing, the built bundle can fall back to `http://localhost:3001`, which will **not** work on Vercel. Always set `VITE_BACKEND_URL` to your Railway API origin.

Convex Auth / `SITE_URL` are configured on **Convex** (see below), not only in Vite.

### Cursor / Git-first deploy

- With **Git connected** on the Vercel project, every **`git push` to `main`** triggers a Production deploy — no CLI or dashboard clicks on each release.
- **Optional GitHub Actions** (`.github/workflows/vercel-frontend-deploy.yml`): add GitHub Secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`. If Vercel is *also* set to deploy on Git push, you may get **two builds** per push; disable one side if that bothers you.

### Local CLI deploy

From the repo root, run **`npx vercel login`** once, then **`npx vercel link`** → **`npx vercel deploy --prod`**. Alternatively set env var **`VERCEL_TOKEN`** locally (never commit it).

### Custom domain

In Vercel: **Domains** → add `tryverseai.com` / `www` per your DNS plan.

---

## 3. Convex — production deployment

**Do not run `npx convex deploy`** — in this project it targets an empty, unused deployment, not real production. From the repo root:

```bash
npm run convex:deploy:prod
npm run convex:dev:reset   # always run immediately after, or .env.local is left pointing at prod
```

See `convex/README.md`'s "Dev vs production" section for the full explanation. In the **Convex dashboard → Settings → Environment variables** (on the `patient-axolotl-17` deployment specifically), set at least:

- `SITE_URL` — `https://tryverseai.com` (matches the live app)
- `AUTH_RESEND_KEY` — same Resend API key pattern as backend mail
- `AUTH_EMAIL_FROM` — verified sender on your domain
- `BACKEND_SHARED_SECRET` — must match Railway

Redeploy after changing Convex env vars.

---

## 4. Cross-origin checklist (fixes “failed to fetch” / CORS)

1. **`FRONTEND_URL`** on Railway = exact Vercel origin (`https://tryverseai.com`, no trailing slash unless you always use one consistently).
2. **`WIDGET_ALLOWED_ORIGINS`** includes that same origin (and any other allowed browser origins).
3. **`VITE_BACKEND_URL`** on Vercel = exact Railway public API URL (`https://…`).
4. Admin login uses **cookies** on the API domain — admin panel on Vercel calling Railway must use `credentials: 'include'` (already in code); **SameSite** cookies work for cross-site requests when the flow is correct; if admin breaks only in prod, confirm both URLs are HTTPS and CORS allows the Vercel origin.

---

## 5. DNS sketch (tryverseai.com)

| Record | Points to |
|--------|-----------|
| `tryverseai.com` | Vercel (A / CNAME per Vercel instructions) |
| `api.tryverseai.com` | Railway service (CNAME) |

---

## 6. Before you announce “live”

- [ ] `NODE_ENV=production` on Railway  
- [ ] No `TRYON_SKIP_CREDIT_CHECK` in production  
- [ ] `WIDGET_ALLOWED_ORIGINS` ≠ `*`  
- [ ] Resend: domain verified, keys valid on Railway + Convex  
- [ ] Payment webhooks point to **Railway** URL + secrets updated in Paystack/Flutterwave dashboards  
- [ ] Smoke test: sign up, try-on, waitlist email, widget from an allowed origin  

For more security notes, see [`GOING_TO_PRODUCTION.md`](./GOING_TO_PRODUCTION.md).
