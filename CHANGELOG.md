# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Security

- **Widget (`tryverse-widget.js`)**: Validate image URLs before use; render result/preview images via `createElement` instead of string `innerHTML` for untrusted URLs.
- **API keys**: In `NODE_ENV=production`, reject `?api_key=` unless `ALLOW_API_KEY_IN_QUERY=true` (default false). Prefer `x-api-key` header.
- **CORS**: In production, `WIDGET_ALLOWED_ORIGINS=*` is rejected at startup; set explicit origins (works with platform URLs like `*.railway.app`, not only custom domains).
- **HTTPS upgrade**: Optional `PUBLIC_API_HOSTNAMES` allowlist for `Host` on HTTP→HTTPS redirect; falls back to `FRONTEND_URL` hostname when unset.
- **Helmet**: Enable restrictive Content-Security-Policy defaults for API responses.
- **Uploads**: Verify image bytes with Sharp (JPEG/PNG/WebP); SSRF-safe redirect handling for `/api/upload/from-url`.
- **multer**: Upgraded to **2.1.1+** (from 1.x) to address supply-chain findings (memory/stream handling, error handling, cleanup — e.g. CVE-2025-47935, CVE-2025-47944, CVE-2025-48997, CVE-2025-7338, CVE-2026-3520, CVE-2026-2359, CVE-2026-3304).
- **Docker**: `no-new-privileges: true` on Redis service.
- **Vite dev**: `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` headers.

See `backend/SECURITY.md` and `docs/GOING_TO_PRODUCTION.md`.

### Semgrep Code (AI) triage — addressed in code

- **`/health`**: Production returns a **minimal** JSON (no feature-flag / payment-provider fingerprinting). Dev keeps the detailed payload.
- **`POST /api/emails/welcome`**: Now **`requireAuth`**; email is taken **only** from the JWT (`req.user.email`), not from the body — prevents sending welcome mail to arbitrary addresses.
- **`POST /api/tryon`**: Now requires **`optionalApiKey` + `optionalAuth` + `requireAuthenticatedActor`** (no fully anonymous try-ons). **Storage paths** must start with `{accountUserId}/` to block cross-account image use (IDOR).
