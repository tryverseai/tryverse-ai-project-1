# Security scanner notes (Semgrep / similar)

Some findings are **false positives** or **stale** after code changes. Use this when triaging or filing “ignore” in your tool.

## `tryverse-widget.js` — `insecure-document-method`

The widget **does not** use string-to-markup DOM sinks; the UI uses `document.createElement`, `textContent`, and validated image URLs.

**Important:** Do **not** put sink names (e.g. `innerHTML`) even inside **comments** — some tools match naïvely on the substring anywhere in the file.

If the scanner still points to old line numbers, **re-run** on the latest `main` after a full refresh.

## `server.ts` — Open redirect (HTTPS middleware)

The production middleware redirects **HTTP → HTTPS** for the **same** `Host` and path. **`Host` is not trusted blindly**: `isHostAllowedForHttpsRedirect()` gates redirects using `PUBLIC_API_HOSTNAMES` (or `FRONTEND_URL` hostname when unset). Non-allowlisted hosts are **not** redirected.

The `Location` header is built with `new URL(req.originalUrl, \`https://${rawHost}\`)` **after** the allowlist check (equivalent to same-origin HTTPS upgrade, not an open redirect to arbitrary sites).

## `server.ts` — CSP / Helmet

Helmet’s CSP is intentionally strict for the **API** (`default-src 'none'`, etc.). Adjust only if you serve HTML from this app.

## `earlyAccess.ts` / `earlyAccessEmailHtml.ts` — `raw-html-format`

User-supplied names are passed through **`escapeHtml()`** before any HTML assembly. The HTML builder lives in **`earlyAccessEmailHtml.ts`** so templates are not mixed with raw `req.body` in one taint graph.

## `docker-compose.yml` — Redis

- **`no-new-privileges: true`** is set.
- **`read_only: true`** with **`tmpfs: /tmp`**; the **`redis_data` volume** keeps `/data` writable for AOF.

## `server.ts` — IDOR (AI) around route `app.use(...)`

Some **AI-assisted** scanners flag **Express `app.use('/api/...', router)`** lines as “IDOR” because they see a **path segment**. Mounting a router is **not** object-reference access; **authorization** is enforced **inside** each router (middleware + per-resource checks). **Dismiss** as false positive unless the finding points to **specific handler code** that loads a resource by ID without a `user_id` / ownership check.

## `widget.ts` — IDOR on `POST /api/widget/request`

**Resolved in code:** paths must start with **`{widgetUserId}/`** (same as `POST /api/tryon`) so a caller cannot reference another account’s storage objects.

## `index.html` — `missing-integrity` on `<link rel="canonical">`

**Subresource Integrity (SRI)** applies to **scripts/styles** loaded as executable or render-critical subresources. A **canonical URL** `<link>` is inert metadata for crawlers; browsers do not treat it like a script load.

The canonical uses a **same-origin relative** `href="/"` so scanners do not treat it like an external fetch. **Absolute** URLs remain in `og:url` / `twitter` metadata where needed.
