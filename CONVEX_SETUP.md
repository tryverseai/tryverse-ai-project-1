# Convex (TryVerse)

The web app and Convex backend use **Convex Auth** (password) with **`@convex-dev/auth`**. Data and auth state live in Convex; the Express API handles try-on, uploads, and widget HTTP endpoints.

## Local setup

```bash
cd tryverse-ai-virtual-fashion
npm install
npm run convex:dev
```

Link the deployment when prompted. Ensure **`tryverse-ai-virtual-fashion/.env`** (or `.env.local`) includes:

```env
VITE_CONVEX_URL=https://<your-deployment>.convex.cloud
```

Restart Vite after changes.

## Convex dashboard — environment variables

Required for sign-in and JWT issuance:

- **`JWT_PRIVATE_KEY`** — PEM PKCS#8 private key (RS256). Set via CLI with stdin if the value has spaces/newlines.
- **`JWKS`** — Public JWKS JSON for the same keypair (see `@convex-dev/auth` docs / `generateKeys` helper).

Optional / email:

- **`AUTH_RESEND_KEY`** — Resend API key for password-reset OTP email.
- **`AUTH_EMAIL_FROM`** — Verified sender, e.g. `TryVerse <auth@yourdomain.com>`.

`auth.config.ts` uses **`CONVEX_SITE_URL`** when set by Convex (built-in); for local dev the fallback issuer origin is `http://localhost:8080` to match the Vite port.

## Scripts

- `npm run convex:dev` — push schema, watch, codegen
- `npm run convex:deploy` — production deploy

See **`convex/README.md`** for function layout and CLI notes.
