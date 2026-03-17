# TryVerse Architecture

## What Brands See vs. What Shoppers See

| Who | Where | What they see |
|-----|-------|---------------|
| **Brand (e.g. Zara admin)** | `tryverse.ai` | Full TryVerse platform: Dashboard, Try-On Studio, API Keys, Billing |
| **Brand's shoppers** | Brand site (e.g. `zara.com`) | **Only the widget** — a modal or inline component. They never visit tryverse.ai |

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

## Brand Admin Experience (tryverse.ai)

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
              │ Supabase │         │ Replicate│         │ Supabase     │
              │ Storage  │         │ (IDM-VTON│         │ (auth, DB)   │
              │ (images) │         │  FASHN)  │         │              │
              └──────────┘         └──────────┘         └──────────────┘


┌─────────────────────────────────────────────────────────────────────────────────┐
│                    TRYVERSE PLATFORM (tryverse.ai)                               │
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
| **Platform** (React app) | Brand admins | tryverse.ai |
| **Try-On Studio** | Brand admins | tryverse.ai/studio |
| **Backend API** | Both widget and platform | api.tryverse.ai |
