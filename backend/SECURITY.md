# TryVerse Backend — Security Guide

## Authentication & Authorization

### Convex Auth (Frontend + API)
- **Password hashing**: Handled by Convex Auth (`@convex-dev/auth` Password provider).
- **Sessions**: JWT issued by Convex Auth; the React app stores the token the Convex client uses.
- **Password reset**: OTP email via Resend (`AUTH_RESEND_KEY` and related vars in the **Convex** deployment). See `tryverse-ai-virtual-fashion/convex/ResendOTPPasswordReset.ts`.

### Backend Auth
- JWT verification via Convex (`authSession.verifyBearerSession` and shared Convex deployment URL).
- Failed auth attempts are logged (path, IP) for monitoring.
- Admin routes require `X-Admin-Key` header matching `ADMIN_SECRET_KEY`.

### IDOR Prevention
All user-scoped endpoints enforce ownership:
- **Credits, Usage, Products, Analytics**: Filter by `req.user.id`.
- **Try-on status**: Requires auth; filters by user or API key owner.
- **Job status**: Verifies job belongs to requesting user.
- **Payment verify**: Confirms `metadata.user_id` matches authenticated user.
- **Signed URLs**: Path must start with `{userId}/`.

---

## Rate Limiting

| Endpoint / Area | Limit | Purpose |
|-----------------|-------|---------|
| General API | 100/min per IP | Baseline |
| Try-on POST | 20/min per user/IP | AI cost control |
| Try-on (plan-based) | Free: 1/10s; Pro: 10/min; Enterprise: 100/min | Per-plan limits |
| Upload | 30/min per user/IP | Abuse prevention |
| Payment init | 10/min per IP | Brute force protection |
| Widget | 60/min per API key | Brand quota |

Rate limit hits are logged.

---

## Secrets Management

- **Never** commit `.env` or any file containing secrets.
- All secrets MUST be in environment variables. See `.env.example`.
- **Frontend**: `VITE_CONVEX_URL` is public by design (Convex deployment URL). Do not put `BACKEND_SHARED_SECRET` or service keys in frontend env.
- **API keys**: Stored hashed in DB. Never log full key values. Prefer `x-api-key` header over query params (query params may appear in logs).

---

## No custom domain yet?

Security rules apply whenever **`NODE_ENV=production`**, not only when you own a domain. Use your host’s HTTPS URL (e.g. `https://*.up.railway.app`) for `FRONTEND_URL` and `WIDGET_ALLOWED_ORIGINS`. See **`docs/GOING_TO_PRODUCTION.md`**.

---

## Deployment Checklist

1. **HTTPS**: Enforce in production. The app redirects HTTP → HTTPS when `X-Forwarded-Proto` is `http`. Ensure your reverse proxy sets `X-Forwarded-Proto` and `X-Forwarded-For`.
2. **Trust proxy**: Set `trust proxy` (already configured).
3. **Data**: Convex is managed; follow Convex access rules and keep `BACKEND_SHARED_SECRET` only on the Node backend and in Convex env.
4. **Environment variables**: Use secrets manager or platform env (e.g. Vercel, Railway). Never bake secrets into images.
5. **CORS**: Set `FRONTEND_URL` and `WIDGET_ALLOWED_ORIGINS` to your production domains. **`WIDGET_ALLOWED_ORIGINS=*` is rejected at startup when `NODE_ENV=production`.**
6. **API hostname**: Set `PUBLIC_API_HOSTNAMES` to your API’s public hostname(s) so HTTP→HTTPS upgrade only applies to expected `Host` values.
7. **API keys**: In production, keys must be sent with the `x-api-key` header unless `ALLOW_API_KEY_IN_QUERY=true` (not recommended).
8. **Logging**: Ensure auth failures, rate limits, and errors are captured (Sentry, CloudWatch, etc.).

---

## Input Validation

- **express-validator** on routes: `body`, `param`, `query` validation.
- **Admin search**: Sanitized (alphanumeric, @, ., -, max 80 chars).
- **Upload from-URL**: SSRF protection — blocks localhost, private IPs, `file://`, `ftp://`, etc.; redirects are followed with the same host checks per hop.
- **Multipart uploads**: Declared MIME type is not trusted; file bytes are verified with **sharp** (real JPEG/PNG/WebP only).
- **Helmet**: Restrictive **Content-Security-Policy** on API responses (`default-src 'none'`, etc.) — safe for JSON APIs.
- **Signed URL path**: Rejects `..`, `http`; enforces `{userId}/` prefix.

---

## Logging

- Auth failures: `path`, `ip`, `error`.
- Admin access denied: `path`, `ip`.
- Rate limit exceeded: `path`, `ip`, `identifier`.
- IDOR/path violations: `path`, `userId`.
- SSRF attempts: truncated URL, host.
