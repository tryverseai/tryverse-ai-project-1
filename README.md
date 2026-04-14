# TryVerse — AI Virtual Try-On Platform

An AI-powered virtual try-on system for both consumers (B2C) and brands (B2B).

- **Frontend** — React + Vite + TypeScript + Tailwind CSS (`tryverse-ai-virtual-fashion/`)
- **Backend** — Node.js + Express + TypeScript (`backend/`)
- **Database / Auth** — Convex (`tryverse-ai-virtual-fashion/convex/`)
- **AI** — Replicate (IDM-VTON, FASHN Try-On, Flux Kontext)
- **Queue** — Bull / Redis
- **Payments** — Paystack, Flutterwave
- **Storage** — Convex file storage (signed URLs)
- **Email** — Resend
- **Monitoring** — Sentry (optional)

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| npm | 9+ |
| Redis | 7+ (optional — try-ons run sync without it) |
| Convex account | [convex.dev](https://convex.dev) |

---

## Quick start (development)

### 1. Clone and install

```sh
git clone <YOUR_GIT_URL>
cd TryVerse

# Frontend + Convex
cd tryverse-ai-virtual-fashion
npm install

# Backend
cd ../backend
npm install
```

### 2. Configure environment variables

```sh
# Frontend / Convex
cd tryverse-ai-virtual-fashion
cp .env.example .env.local   # fill in VITE_CONVEX_URL at minimum

# Backend
cd ../backend
cp .env.example .env         # fill in CONVEX_URL, BACKEND_SHARED_SECRET, REPLICATE_API_TOKEN at minimum
```

The minimum required keys to run locally:

| Variable | Where to get it |
|----------|----------------|
| `VITE_CONVEX_URL` | `npx convex dev` prints it; also in Convex dashboard → Settings |
| `CONVEX_URL` | Same URL as above |
| `BACKEND_SHARED_SECRET` | Any strong random string: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `REPLICATE_API_TOKEN` | [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens) |
| `ADMIN_SECRET_KEY` | Any strong random string (same command as above) |

> Set `BACKEND_SHARED_SECRET` identically in both `.env` (backend) and
> Convex dashboard → Settings → Environment Variables.

### 3. Start Convex (dev deploy)

```sh
cd tryverse-ai-virtual-fashion
npx convex dev
```

Leave this terminal running. Convex watches `convex/` and hot-reloads.

### 4. Start the backend

```sh
cd backend
npm run dev
```

Starts Express on **port 3001**.

### 5. Start the frontend

```sh
cd tryverse-ai-virtual-fashion
npm run dev
```

Starts Vite on **port 8080**. Vite proxies `/api` → `localhost:3001` automatically
so you don't need to set `VITE_BACKEND_URL` in development.

### 6. (Optional) Start Redis

```sh
redis-server
```

Without Redis the try-on queue is disabled and jobs run synchronously.
The app still works — you'll just see slower response times.

---

## Project structure

```
TryVerse/
├── backend/                  Express API server
│   ├── src/
│   │   ├── config/           env, logger, Sentry, Convex HTTP client
│   │   ├── lib/              shared constants, storage-path regex, plan tier
│   │   ├── middleware/        auth, rate limiting, validation, error handling
│   │   ├── routes/           REST endpoints (tryon, widget, upload, products, …)
│   │   ├── services/
│   │   │   ├── ai/           pipeline, Replicate wrappers, preprocessing
│   │   │   ├── analytics/    brand analytics
│   │   │   ├── cache/        Redis try-on result cache
│   │   │   ├── payments/     Paystack + Flutterwave
│   │   │   ├── queue/        Bull producer
│   │   │   └── storage/      Convex-backed image upload / signed URLs
│   │   └── types/            Shared TypeScript interfaces
│   └── .env.example
│
└── tryverse-ai-virtual-fashion/   Frontend + Convex functions
    ├── convex/               Database schema, queries, mutations, auth
    ├── public/               Static assets
    ├── src/
    │   ├── components/       Reusable UI components
    │   ├── contexts/         Auth context
    │   ├── hooks/            Custom React hooks
    │   ├── lib/              API client (backendApi.ts), utilities
    │   └── pages/            Route-level page components
    └── .env.example
```

---

## Running in production

1. Deploy Convex: `npx convex deploy` (inside `tryverse-ai-virtual-fashion/`)
2. Build the frontend: `npm run build` → serve `dist/` from any static host
3. Build and run the backend: `npm run build && node dist/server.js`
4. Set `FRONTEND_URL` and `WIDGET_ALLOWED_ORIGINS` to your production URLs
5. Set `NODE_ENV=production` — this enforces stricter rate limits, disables dev
   helpers (`TRYON_SKIP_CREDIT_CHECK`), and enables Redis-only queue mode

See `backend/.env.example` for the full list of environment variables.

---

## Key scripts

| Directory | Command | Description |
|-----------|---------|-------------|
| `backend/` | `npm run dev` | Start Express with ts-node-dev hot reload |
| `backend/` | `npm run build` | Compile TypeScript to `dist/` |
| `backend/` | `npm run lint` | ESLint |
| `tryverse-ai-virtual-fashion/` | `npm run dev` | Vite dev server |
| `tryverse-ai-virtual-fashion/` | `npm run build` | Production Vite build |
| `tryverse-ai-virtual-fashion/` | `npx convex dev` | Convex dev watcher |
| `tryverse-ai-virtual-fashion/` | `npx convex deploy` | Deploy Convex to production |
