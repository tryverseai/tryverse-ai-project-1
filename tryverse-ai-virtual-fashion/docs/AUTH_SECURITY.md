# Authentication security (Convex Auth)

TryVerse uses **Convex Auth** with the **Password** provider (`convex/auth.ts`). Sessions are JWT-based; signing keys are **only** on the Convex deployment (`JWT_PRIVATE_KEY`, `JWKS`).

## Operational checklist

- **Keys**: Generate and set `JWT_PRIVATE_KEY` and `JWKS` in the Convex dashboard. Rotate by generating a new pair and updating both vars in one maintenance window.
- **Site URL**: Use the HTTPS origin your users hit for production (Convex sets `CONVEX_SITE_URL` for the deployment; local dev typically uses `http://localhost:8080` per `auth.config.ts` fallback).
- **Password reset**: Configure **`AUTH_RESEND_KEY`** (and optionally **`AUTH_EMAIL_FROM`**) so `ResendOTPPasswordReset` can send OTP email. Use a verified domain in Resend for production.

## Frontend

- **`VITE_CONVEX_URL`** — public Convex deployment URL (safe to expose).
- Do **not** put private keys, `BACKEND_SHARED_SECRET`, or admin secrets in Vite env vars.

## Node API

The Express backend uses **`CONVEX_URL`** and **`BACKEND_SHARED_SECRET`** (see `backend/.env.example`) to call Convex from trusted server routes — not user JWTs for those paths unless explicitly designed.

Never expose the service/deploy secrets in client bundles or public repos.
