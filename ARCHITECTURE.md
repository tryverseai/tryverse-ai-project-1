# TryVerse Architecture

TryVerse is a **B2B AI fashion infrastructure platform**. Customers are fashion brands,
retailers, and creative teams — there is no individual/consumer ("B2C") account type. Every
authenticated user belongs to a business account (`profiles.account_type` is always `"business"`;
the account's identity is its `brand_name` + `website_url`). "Shoppers" below means a **brand's
own** end customers using that brand's embedded widget — not TryVerse users.

Account model (single-tenant business account, no multi-user org layer yet): Convex Auth `users`
row ⇄ one `profiles` row ⇄ resources scoped by `user_id` (products, generations, API keys,
subscriptions, payments, credits). A true `organizations` + members + RBAC model is deferred
until a customer needs a second seat — see `B2B_ARCHITECTURE_AUDIT.md` §4.

## Two product surfaces

1. **Dashboard / Studio** (`tryverseai.com`) — where the brand's team works: Overview,
   Analytics, **Personal Studio** (single-subject creation environment), Outfit Builder,
   AI Photoshoot, AI Video, AI Model Studio, My Models, Products, Product Photography,
   My Creations, Connect Store, Developers, API Keys, Billing, Settings. This is the primary
   product surface.
2. **Storefront integration** — how a brand exposes try-on to its own shoppers on its own site.
   Three paths, in order of preference: the **TryVerse SDK** (recommended), the **REST API**
   (`/api/widget/*`, `/api/upload`), and the **embeddable widget** (`tryverse-widget.js` /
   `tryverse-personalize.js`) — a drop-in script for brands without engineering resources. All
   three authenticate with an API key + domain allowlist and hit the same backend. Shoppers
   never visit `tryverseai.com`. This is TryVerse-as-infrastructure powering the brand's own
   storefront, like a payments provider offering both an API and a drop-in checkout button.

### Widget status (verified 2026-09-03)

The widget is **active** and a **secondary/fallback integration path**, not legacy and not the
platform's identity. It depends on: `backend/src/routes/widget.ts` + `personalize.ts`,
`backend/src/middleware/apiKey.ts` (`requireApiKey` / `validateDomain` / `requireScope`), the
widget CORS block in `server.ts`, the `allowed_domains` table, `WIDGET_ALLOWED_ORIGINS`, and
`public/tryverse-widget.js` / `tryverse-personalize.js`. Removing it would break any brand
currently embedding the script, collapse the "no developer" onboarding path to SDK-only, and
orphan the domain-allowlist security layer. `public/widget.js` is an older iframe-based variant
(loads `/widget-preview`) that appears superseded by `tryverse-widget.js` — left in place,
flagged for a later dead-code check. `PersonalizeTab` is imported in `Dashboard.tsx` but not
wired into the nav — the backend personalization API is live (FASHN-gated) but the dashboard tab
is currently unreachable.

## What Brands See vs. What Shoppers See

| Who | Where | What they see |
|-----|-------|---------------|
| **Brand's team / Authorized Users** | `tryverseai.com` | Full TryVerse dashboard: creation tools, Products, Analytics, Developers, API Keys, Billing |
| **Brand's shoppers** | Brand site (e.g. `zara.com`) | Only the try-on experience the brand embedded — the drop-in widget, or the brand's own UI built on the SDK/API. They never visit tryverseai.com |

---

## Shopper Experience on Brand Site (e.g. zara.com)

When Zara embeds TryVerse:

1. Shopper visits a product page on zara.com
2. Clicks **"Try It On"** button
3. Sees a modal: "Upload your photo to see how this item looks on you"
4. Uploads photo → Clicks "Try It On"
5. Progress: "Uploading…" → "Generating try-on…"
6. Result image appears
7. Closes modal — **never leaves zara.com**

Shoppers **never** see the TryVerse landing page, Dashboard, or Try-On Studio.

---

## Brand Admin Experience (tryverseai.com)

Brand teams (e.g. Zara) log into the TryVerse platform to:

- **Dashboard** → Overview, Analytics, Products, API Keys, Widget, Billing, Settings
- **Try-On Studio** (`/studio`) → Test try-on before going live (upload mode, AI demo models)
- **Widget** tab → Get API key, add allowed domains, copy embed code
- **Products** → Manage product catalog for try-on

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         BRAND'S WEBSITE (e.g. zara.com)                          │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │  Product page                                                              │  │
│  │  [Product image]  [Buy]  [Try It On]  ← Button triggers TryVerse widget    │  │
│  │                              ↓                                             │  │
│  │  ┌─────────────────────────────────────────────────────────────────────┐  │  │
│  │  │  tryverse-widget.js (vanilla JS)                                     │  │  │
│  │  │  • Modal: "Upload your photo" → "Try It On" → Result image           │  │  │
│  │  │  • Calls TryVerse Backend API with brand's API key                   │  │  │
│  │  │  • Shopper never leaves brand site                                   │  │  │
│  │  └─────────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          │ HTTPS (API key in header)
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         TRYVERSE BACKEND (Express API)                           │
│  • /api/widget/request     – Start try-on (API key auth)                         │
│  • /api/widget/status/:id  – Poll result                                          │
│  • /api/upload             – Upload person/product images                         │
│  • Domain validation       – Only brand's approved domains                        │
└─────────────────────────────────────────────────────────────────────────────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
              ┌──────────┐         ┌──────────┐         ┌──────────────┐
              │ Convex   │         │ Replicate│         │ Convex       │
              │ (files,  │         │ (IDM-VTON│         │ Auth + DB    │
              │  DB)     │         │  FASHN)  │         │              │
              └──────────┘         └──────────┘         └──────────────┘


┌─────────────────────────────────────────────────────────────────────────────────┐
│                    TRYVERSE PLATFORM (tryverseai.com)                               │
│  Used by brand admins — NOT embedded on brand sites                              │
│                                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  ┌───────────────────────┐ │
│  │ Landing (/) │  │ Dashboard   │  │ Try-On Studio   │  │ Widget config         │ │
│  │             │  │ Overview,   │  │ /studio         │  │ (keys, domains,       │ │
│  │             │  │ Analytics,  │  │ • Test try-on   │  │  embed code)         │ │
│  │             │  │ Products,   │  │ • AI demo models│  │                       │ │
│  │             │  │ Billing     │  │ • Upload mode   │  │                       │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘  └───────────────────────┘ │
│         │                  │                    │                      │         │
│         └──────────────────┴────────────────────┴──────────────────────┘         │
│                                    │                                              │
│                          Same backend API (JWT auth)                              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Summary

| Component | Who uses it | Where |
|-----------|-------------|-------|
| **Widget** (`tryverse-widget.js`) | Shoppers | On brand sites (e.g. zara.com) |
| **Platform** (React app) | Brand admins | tryverseai.com |
| **Try-On Studio** | Brand admins | tryverseai.com/studio |
| **Backend API** | Both widget and platform | api.tryverseai.com |
