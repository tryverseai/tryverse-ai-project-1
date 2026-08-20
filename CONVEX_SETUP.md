# Convex (TryVerse)

The web app and Convex backend use **Convex Auth** (password) with **`@convex-dev/auth`**. Data and auth state live in Convex; the Express API handles try-on, uploads, and widget HTTP endpoints.

## Local setup

```bash
npm install
npm run convex:dev
```

This pushes to the local dev sandbox deployment (`pastel-setter-205` — see **`convex/README.md`**'s "Dev vs production" section for why that's the dev deployment and not, confusingly, `patient-axolotl-17` which is the real production one). Restart Vite after changes.

**Never run `npx convex deploy` expecting it to reach production** — it targets `pastel-setter-205` (empty), not the real production data. Use `npm run convex:deploy:prod` for that, then `npm run convex:dev:reset` immediately after.

## Convex dashboard — environment variables

Required for sign-in and JWT issuance:

- **`JWT_PRIVATE_KEY`** — PEM PKCS#8 private key (RS256). Set via CLI with stdin if the value has spaces/newlines.
- **`JWKS`** — Public JWKS JSON for the same keypair (see `@convex-dev/auth` docs / `generateKeys` helper).

Optional / email:

- **`AUTH_RESEND_KEY`** — Resend API key for password-reset OTP email.
- **`AUTH_EMAIL_FROM`** — Verified sender, e.g. `TryVerse <auth@yourdomain.com>`.

`auth.config.ts` uses **`CONVEX_SITE_URL`** when set by Convex (built-in); for local dev the fallback issuer origin is `http://localhost:8080` to match the Vite port.

## Scripts

- `npm run convex:dev` — push schema, watch, codegen (dev sandbox)
- `npm run convex:dev:reset` — one-shot push to the dev sandbox; also fixes `.env.local` after a prod push
- `npm run convex:deploy:prod` — the only command that reaches real production
- `npm run convex:deploy` — inert for this project, kept for parity only (see `convex/README.md`)

See **`convex/README.md`** for function layout, the full dev/prod explanation, and CLI notes.
