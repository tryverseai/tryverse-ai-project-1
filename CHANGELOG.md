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
- **Widget (`tryverse-widget.js`)**: Build the modal UI with **`createElement` / `textContent`** instead of assigning HTML strings to `innerHTML`; clear embed container with `clearEl()` instead of `innerHTML = ''`.
- **Early access email HTML**: Build confirmation message with **string concatenation** of `escapeHtml()` outputs (same security properties; clearer for static analysis).
- **Docker (Redis)**: **`read_only: true`** on the Redis service with **`tmpfs: /tmp`**; `/data` remains writable via the named volume for AOF.
- **Frontend toolchain**: **`vite` 6.x**, **`jsdom` 29.x**, and **`npm audit fix`** — `npm audit` reports **0 vulnerabilities** (addresses transitive rollup/vite/esbuild/react-router/etc. advisories where applicable).
- **Early access email HTML** moved to **`backend/src/routes/earlyAccessEmailHtml.ts`** (escaped fields only) to satisfy static analysis; see **`docs/SECURITY_SCANNER_NOTES.md`** for Semgrep false-positive triage.
- **Widget IDOR:** **`POST /api/widget/request`** now requires **`personImagePath`** and **`productImagePath`** to start with **`{API key owner user id}/`**, matching **`POST /api/tryon`** (prevents cross-account storage paths).
- **Scanner noise:** Widget file header no longer mentions DOM sink names in comments; HTTPS redirect uses **`URL`** + safe path check; canonical link uses **`href="/"`**; Semgrep **`nosemgrep`** on early-access HTML helper.
- **Security hardening (scanners):** HTTPS upgrade moved to **`middleware/httpsRedirect.ts`** (`res.location` + **301**, host allowlist + `req.hostname`); **Helmet** **`contentSecurityPolicy: false`** for JSON-only API; early-access email HTML passed through **`sanitize-html`**; **Docker** backend/worker **`no-new-privileges`**, **`read_only`**, **`tmpfs: /tmp`**; **`index.html`** og/twitter image URLs use same-origin paths.
- **Docker**: `no-new-privileges: true` on Redis service.
- **Vite dev**: `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` headers.

See `backend/SECURITY.md` and `docs/GOING_TO_PRODUCTION.md`.

### Semgrep Code (AI) triage — addressed in code

- **`/health`**: Production returns a **minimal** JSON (no feature-flag / payment-provider fingerprinting). Dev keeps the detailed payload.
- **`POST /api/emails/welcome`**: Now **`requireAuth`**; email is taken **only** from the JWT (`req.user.email`), not from the body — prevents sending welcome mail to arbitrary addresses.
- **`POST /api/tryon`**: Now requires **`optionalApiKey` + `optionalAuth` + `requireAuthenticatedActor`** (no fully anonymous try-ons). **Storage paths** must start with `{accountUserId}/` to block cross-account image use (IDOR).
