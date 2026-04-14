# Going to production (with or without a custom domain)

The security rules in the backend **do not require a purchased domain**. They apply whenever **`NODE_ENV=production`**.

## How it works

| Situation | What happens |
|-----------|----------------|
| **Local dev** (`NODE_ENV=development`) | `WIDGET_ALLOWED_ORIGINS=*` is allowed. `?api_key=` still works unless you change defaults. HTTPS redirect / strict CORS checks are relaxed or off. |
| **Production** (any public URL) | You **must** set real values below. A Railway / Render / Fly **`.app` hostname** counts as a real origin — paste that exact `https://…` URL. |

So: **same code, same rules** — you only fill in env vars when you deploy.

---

## 1. `WIDGET_ALLOWED_ORIGINS`

Comma-separated list of **origins** of pages that embed the widget or call your API from the browser (scheme + host + port, no path).

**Examples (no custom domain yet):**

```env
# Your marketing / dashboard app on the host’s URL
WIDGET_ALLOWED_ORIGINS=https://tryverse-frontend.up.railway.app
```

**Multiple sites:**

```env
WIDGET_ALLOWED_ORIGINS=https://tryverseai.com,https://www.clientstore.com
```

**Never** use `*` when `NODE_ENV=production` — the server **refuses to start**.

---

## 2. `FRONTEND_URL`

Set to your **main web app** URL (same scheme/host you use in the browser):

```env
FRONTEND_URL=https://tryverse-frontend.up.railway.app
```

Used for CORS, model-library image URL resolution, and (if `PUBLIC_API_HOSTNAMES` is empty) HTTPS redirect host hints.

---

## 3. `PUBLIC_API_HOSTNAMES` (optional)

Only needed if the **API** is on a **different hostname** than `FRONTEND_URL`.

Example: app at `https://tryverseai.com`, API at `https://api.tryverseai.com`:

```env
PUBLIC_API_HOSTNAMES=api.tryverseai.com
```

If the API and app share the same host, or you only have one public URL, you can leave this **empty** (hostname is taken from `FRONTEND_URL`).

---

## 4. API keys: `x-api-key` header

- The **TryVerse widget** already sends the key in the **`x-api-key`** header.
- In **production**, **`?api_key=` in the URL is rejected** unless you set `ALLOW_API_KEY_IN_QUERY=true` (not recommended).

Integrations should use:

```http
x-api-key: tv_live_...
```

---

## Checklist when deploying with your custom domain (`tryverseai.com`)

1. Update `FRONTEND_URL` to `https://tryverseai.com`.
2. Update `WIDGET_ALLOWED_ORIGINS` to include `https://tryverseai.com` and any merchant origins.
3. If the API runs on a separate subdomain, set `PUBLIC_API_HOSTNAMES=api.tryverseai.com`.
4. Point DNS / TLS at your host (same env vars, new strings).

No code change required — only environment updates.
