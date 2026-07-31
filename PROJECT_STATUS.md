# TryVerse — Project Status

_Last updated: 2026-07-31_
_Base commit: `1a8d77f` ("Fixed preview nesting issue") — all work below is uncommitted on top of this until the commit made alongside this file._

---

## Completed

### Repository
- **Resolved the "two repos" confusion**: `iamprinceefe/tryverse-ai-project` is the only GitHub repo. This working directory was 6 commits behind `origin/main` (missing Lovable's flattening of `tryverse-ai-virtual-fashion/` up to repo root). Fast-forwarded cleanly (`67bb343 → 1a8d77f`), zero conflicts, full history intact. Lovable was never pointed at the wrong repo.
- Deleted the now-redundant duplicate clone, a stale `dist/` build folder, a stray Vite cache dir, and an unused auto-generated Supabase client stub (`src/integrations/supabase/`, `supabase/config.toml`) that contradicted "Convex only."
- Removed two fully-orphaned pages confirmed unreferenced anywhere (`IndividualDashboard.tsx`, `TryOnStudio.tsx` — ~1,500 lines).

### Positioning
- Removed jewelry/accessories from the landing page, backend category constants, Convex schema, and every dashboard category picker. TryVerse is apparel-only (`clothing | tops | bottoms | dresses | one-pieces`).
- Self-serve signup: homepage CTAs are **Start Free** / **Create Account**, linking to `/auth?signup=business`. Book a Demo demoted to secondary (Enterprise) CTA, not removed.
- **Closed-beta wall removed** (`BetaAccessOverlay.tsx`) — this was a real bug: every self-serve signup was landing in the dashboard and immediately hitting "We're in Closed Beta." New profiles now default `beta_approved: true`. The overlay now only handles profile-bootstrap loading and one-time Terms/Privacy acceptance.

### Auth
- Convex Auth + Resend (confirmed — **not** Supabase, per explicit instruction).
- Rewrote verification + welcome email templates on the shared branded layout; welcome email now actually fires once after verification via the existing JWT-scoped `POST /api/emails/welcome`.
- Shortened verification code expiry; resend flow gives a specific "expired, check your email" message.
- Confirmed Convex Auth's OTP flow auto-authenticates on completion; fixed post-verify redirect to land cleanly on the dashboard.
- Real loading/error states across Auth, VerifyEmail, ForgotPassword, ResetPassword, ApproveDevice.

### Legal
- Rewrote Privacy Policy (business + individual) naming the real vendors: Replicate, OpenAI, Convex, Resend, Paystack/Flutterwave, PostHog, Sentry.
- New pages: **Cookie Policy**, **Acceptable Use Policy** — wired into `App.tsx` and the footer.

### Brand integration / onboarding (redesigned twice — see "In Progress" note below on why)
- **API key generation is now automatic** — `POST /api/account/api-keys` is idempotent (returns existing key or creates one), no manual "Generate" button anywhere. `POST /api/account/api-keys/regenerate` revokes + reissues. `GET /api/account/api-keys` lists them. Backed by a new Convex user-scoped query `listApiKeysForUser` (existing `createApiKeyAdmin`/`revokeApiKeyAdmin` reused for the mutations).
- **`ConnectStoreWizard.tsx` rebuilt**: key shown automatically → choose platform (Shopify, WooCommerce, Magento, **BigCommerce**, Headless Commerce, Custom API) → connect confirmation → raw request format hidden behind a collapsed "Advanced" disclosure → "Run your first Try-On" → done. No embed-code-first flow, no script tags shown by default.
- **Public API documentation removed entirely** from the marketing site — deleted `/api-docs` page/route, the footer link, every pointer. Moved into an **authenticated** `Dashboard → Developers` tab (`DeveloperDocsTab.tsx`): endpoints, auth, code examples, rate limits (all real), plus a generated OpenAPI spec + Postman collection (real, built from the actual 2 endpoints), and honest "coming soon" cards for Webhooks/SDKs (not fabricated).
- **Dashboard now opens on "Connect Your Store"** for brands without a key + allowlisted domain yet; switches to the normal landing tab (Try-On guide) once connected.
- Deleted the "Widget Guide" public page entirely (folded into the API docs move).
- `ApiKeysTab.tsx` now shows the real key (copy/regenerate) instead of "informational only" placeholder text.

### Enterprise features
- Real server-side plan gating: `backend/src/middleware/requirePlan.ts` checks a Convex-trusted query on every request — not a hidden frontend button. A client cannot bypass this by calling the API directly.
- **AI Model Generation** (`POST /api/ai-studio/models/generate`) — real Replicate call (Flux), stores to Convex, per-user saved library (list/archive). 8 sample images pre-generated to `public/ai-model-samples/` (real Replicate spend, explicitly authorized).
- **AI Product Photoshoot** (`POST /api/ai-studio/photoshoot/generate`) — brand uploads a product photo, picks a model (stock library or their own saved AI model), generates. Frontend tab built (`AiPhotoshootTab.tsx`).
- **AI body-shape estimate** (`POST /api/body-estimate`) — pose-keypoint-based (MoveNet) build/shape classification + suggested size band with a visible confidence score. Does **not** claim precise cm measurements — see AI Pipeline Status below for why.
- **Higgsfield / AI Video — removed entirely** per direct instruction (not left stubbed): no route, no frontend tab, no gating scaffold, no Convex usage-tracking literal for it.
- Enterprise plan tier confirmed present in the real `plans` table on **both** deployments (dev already had it; production's `plans` table was actually empty and just got seeded with all 6 tiers).

### Infrastructure
- Redis: added `REDIS_URL` support (what Railway/Upstash actually inject), confirmed TLS via URL scheme, fixed a real dead-code type-narrowing bug in the connection-status check.
- Fixed a **Vite dev-proxy bug**: `/api` was matched as a naive string prefix, so `/api-docs` (and any future `/api*` route) was being swallowed by the backend proxy and 404ing instead of rendering. Changed to a path-boundary regex (`^/api(/|$)`).
- Fixed a **real pre-existing type bug**: `src/lib/backendApi.ts`'s `TryOnCategory` type still said `'clothing' | 'bags' | 'glasses'` instead of the actual category set — a leftover from the accessories cleanup, masked because typecheck was silently checking nothing all session (see Bugs section).
- Landing page: scroll-triggered motion via `framer-motion` (already a dependency), fully gated behind `prefers-reduced-motion`.
- Removed the `lovable-tagger` dev dependency and its Vite plugin usage; removed a Lovable logo from the integrations strip.
- All 26 model-library photos refreshed programmatically (Sharp: consistent 4:5 crop, color/contrast normalization, sharpening) — **not** via Replicate, per explicit instruction. Originals backed up to `public/model-library/_originals/`.

### Deployment
- Convex functions deployed to **both** deployments:
  - **Dev** (`limitless-magpie-618`) — via the dev-scoped `CONVEX_DEPLOY_KEY` provided.
  - **Production** (`successful-squirrel-888`) — via `CONVEX_DEPLOYMENT=prod:...`.
  - Both confirmed via `✔ Deployed Convex functions to ...` and `Schema validation complete.` No indexes were deleted by any push (additive only).

---

## In Progress

Nothing left mid-implementation. The brand-integration/onboarding flow went through two real redesigns in this session (first a Stripe-Connect-style wizard with embed-code snippets, then a full rebuild removing all public docs and raw code exposure per follow-up direction) — the **current** state described above is the final one, not a partial state.

---

## Failed / Blocked

- **First Convex deploy attempt landed on production by accident.** Setting `CONVEX_DEPLOYMENT=limitless-magpie-618` (no `dev:`/`prod:` prefix) was silently ignored by the CLI, which fell back to the default-linked deployment — production. Cause fully diagnosed: `npx convex deploy` **always** targets the project's production deployment whenever `CONVEX_DEPLOYMENT` is set, regardless of its value (this is documented CLI behavior, confirmed via `--help`). The correct way to target dev non-interactively is a dev-scoped `CONVEX_DEPLOY_KEY`, which the user then provided — used successfully. No data was harmed by the earlier accidental deploy (additive schema changes only, confirmed "no indexes deleted").
- **`npx convex dev --once` was attempted and aborted.** Without an existing local project link, this started an interactive "set up a new project" flow (downloading a local backend binary) — stopped immediately rather than risk creating an unwanted resource headlessly. Superseded by the deploy-key approach.
- **Bulk regeneration of anything via Replicate beyond the one authorized 8-image sample batch was intentionally not done** — e.g., a full model-library *AI regeneration* (as opposed to the Sharp touch-up that was done) would mean dozens more paid calls; not fired without a specific go-ahead each time.

---

## Files Changed

~116 files touched (55 modified from the first pass's baseline report, refined further this pass; full live list always available via `git status`). Highlights by area:

**Repo/config**: `.env` (new), `.claude/launch.json`, `vite.config.ts` (proxy fix), `index.html`, `package.json`

**Landing/marketing**: `src/pages/Index.tsx`, `HeroSection.tsx`, `CTASection.tsx`, `Navbar.tsx`, `Footer.tsx`, `FeaturesSection.tsx`, `HowItWorks.tsx`, `TechnologySection.tsx`, `TrustedBy.tsx`, `TryOnShowcase.tsx`, `DemoSection.tsx`, `ForBrandsSection.tsx` — deleted `JewelrySection.tsx`, `JewelryShowcase.tsx`

**Auth**: `Auth.tsx`, `VerifyEmail.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx`, `AuthConfirm.tsx`, `AuthInvite.tsx`, `ApproveDevice.tsx`, `BetaAccessOverlay.tsx` (beta wall removed), `convex/ResendEmailSignupVerification.ts`, `ResendOTPPasswordReset.ts`, `emailLayout.ts`, `backend/src/routes/emails.ts`

**Legal**: `src/content/policyContent.tsx`, `TryVersePrivacyPolicy.tsx`, new `CookiePolicy.tsx`, `AcceptableUsePolicy.tsx` — deleted `src/integrations/supabase/client.ts`, `supabase/config.toml`

**Dashboard/onboarding**: `Dashboard.tsx` (default-tab logic), `WidgetTab.tsx`, `StudioTab.tsx`, `ApiKeysTab.tsx` (rewritten), new `ConnectStoreWizard.tsx` (rewritten), `DeveloperDocsTab.tsx` (new), `AiModelsTab.tsx`, `AiPhotoshootTab.tsx`, `EnterpriseUpgradeModal.tsx`, `TryOnGuidelinesModal.tsx`, `useIsEnterprisePlan.ts` — deleted `AiVideoTab.tsx`, `ApiDocs.tsx`, `WidgetGuide.tsx`, `IndividualDashboard.tsx`, `TryOnStudio.tsx`

**Backend — AI & routing**: `server.ts`, `config/env.ts`, `routes/tryon.ts`, `routes/widget.ts`, `routes/account.ts` (new API-key endpoints), new `routes/aiStudio.ts`, `routes/bodyEstimate.ts`, new `services/ai/modelGeneration.ts`, `productPhotoshoot.ts`, `bodyEstimate.ts`, new `middleware/requirePlan.ts`, `services/ai/fashn.ts`, `garmentDescriptor.ts`, `pipeline.ts`, `replicate.ts`, `tryon/garmentClassify.ts` (category-comment cleanup only — **no FASHN behavior changed**)

**Backend — infra**: `config/redis.ts`, `.env.example`, `services/queue/producer.ts`, `worker.ts`, `package.json` (+`@tensorflow-models/pose-detection`), new one-off scripts: `seed-plans.ts`, `generate-sample-models.ts`, `refresh-model-library-photos.ts`

**Convex**: `schema.ts` (+`ai_generated_models`, `ai_generation_usage` tables), `backendTrusted.ts` (+several trusted queries/mutations), `adminTrusted.ts`, `seed.ts` (enterprise feature list updated)

**Frontend lib**: `src/lib/backendApi.ts` (real API-key functions, photoshoot functions, `TryOnCategory` fix), `src/lib/safeUrl.ts`

**Assets**: all 26 `public/model-library/*.png` refreshed in place (originals in `_originals/`), new `public/ai-model-samples/` (8 images + manifest)

---

## Database Changes (Convex)

All additive — **no table was dropped, no field was renamed, no existing data was touched.**

| Change | Table | Notes |
|---|---|---|
| New table | `ai_generated_models` | Enterprise "Generate AI Model" saved library — `user_id`, `storage_path`, `params`, `status`, `created_at`, indexed `by_userId` |
| New table | `ai_generation_usage` | Usage log for `ai_model` / `ai_photoshoot` features — `user_id`, `feature`, `created_at`, indexed `by_userId` |
| Field default changed | `profiles.beta_approved` | New signups now get `true` (was `false`) — this is the fix for the closed-beta-wall bug. Existing rows untouched; the frontend gate no longer reads this field for access control anyway. |
| Data seeded (prod only) | `plans` | Production's `plans` table was empty; seeded with all 6 tiers (free/pro/creator/starter/growth/enterprise) via the new `ensurePlansSeeded` trusted mutation. Dev already had these rows. |
| New trusted functions | `backendTrusted.ts` | `listApiKeysForUser`, `saveGeneratedAiModel`, `listGeneratedAiModels`, `archiveGeneratedAiModel`, `getUserPlanTier`, `logAiGenerationUsage`, `ensurePlansSeeded` |

**Deployed to both `limitless-magpie-618` (dev) and `successful-squirrel-888` (prod).**

---

## API Changes (Express backend)

New endpoints, all additive:

| Method | Path | Purpose | Auth |
|---|---|---|---|
| `GET` | `/api/account/api-keys` | List caller's active keys | `requireAuth` |
| `POST` | `/api/account/api-keys` | Idempotent create-if-none | `requireAuth` |
| `POST` | `/api/account/api-keys/regenerate` | Revoke + reissue | `requireAuth` |
| `POST` | `/api/ai-studio/models/generate` | Generate AI fashion model (Replicate) | `requireAuth` + `requirePlan('enterprise')` |
| `GET` | `/api/ai-studio/models` | List saved models | `requireAuth` + `requirePlan('enterprise')` |
| `DELETE` | `/api/ai-studio/models/:id` | Archive a saved model | `requireAuth` + `requirePlan('enterprise')` |
| `POST` | `/api/ai-studio/photoshoot/generate` | Product photoshoot (Replicate) | `requireAuth` + `requirePlan('enterprise')` |
| `POST` | `/api/body-estimate` | Body-shape/size estimate from a photo | `requireAuth` |

Removed: nothing removed from the public contract — the AI Video endpoint (`/api/ai-studio/video/generate`) that briefly existed in an earlier pass of this session was deleted before ever being documented externally.

No changes to `FASHN`/Replicate try-on endpoints (`/api/tryon`, `/api/widget/request`, `/api/widget/status/:id`) beyond stale doc-comment cleanup (`bags`/`glasses` → real category list).

---

## AI Pipeline Status

- **Core try-on pipeline (FASHN + IDM-VTON + Flux Kontext via Replicate): unchanged.** Not touched, not exposed, not modified per explicit instruction. Brands only ever see TryVerse's own `/api/widget/*` and `/api/tryon` endpoints — FASHN's identity, endpoints, and keys stay fully internal.
- **AI Model Generation**: live, real Replicate calls (`black-forest-labs/flux-schnell`), Enterprise-gated server-side.
- **AI Product Photoshoot**: live, real Replicate calls (`black-forest-labs/flux-kontext-pro`), Enterprise-gated server-side.
- **AI body-shape/size estimate**: live, uses MoveNet pose-detection (`@tensorflow-models/pose-detection`, new dependency) — **not** Replicate. Deliberately does **not** claim precise circumference measurements (chest/waist/hip in cm): a single 2D photo has no depth information, so that would be a guess dressed up as data. What's shipped instead: proportion-based build/shape classification + a suggested size band, always with a visible confidence score.
- **AI Video (Higgsfield)**: removed. No vendor integration exists in the codebase at all as of this status.

---

## Bugs

Found and fixed this session (not pre-existing when this session started, or found-and-fixed regardless of origin):

1. **Closed-beta wall blocking every self-serve signup** — `BetaAccessOverlay.tsx` still enforced `beta_approved === true`, contradicting the "no waitlist" self-serve copy already shipped. Fixed.
2. **Vite dev-proxy swallowing `/api-docs`** — naive `/api` prefix match. Fixed with a path-boundary regex.
3. **`TryOnCategory` type stale** (`'bags' | 'glasses'` instead of the real apparel categories) — masked by a typecheck config issue (below), found and fixed.

Found, confirmed **pre-existing** (present before this session, not touched, left as-is — flagged for visibility, not fixed, to keep this session's diff honest and scoped):

- `ProductsTab.tsx` (2 spots): `form.category` typed as loose `string` rather than `TryOnCategory` — likely harmless at runtime (values come from a constrained dropdown) but not type-safe.
- `AuthContext.tsx` / `AuthInvite.tsx`: `verifyEmailWithCode`'s return type doesn't match what `AuthInvite.tsx` destructures (`pendingEmail`, `pendingBootstrap`).
- `WidgetPreview.tsx`: accesses `.resultUrl`/`.error` on `WidgetTryOnStartResponse` without narrowing which union member it has.
- `PostHogProvider.tsx`: references `AppUser.created_at`, which isn't on that type.
- A cluster of admin-panel prop-type mismatches (`AdminApiKeysTab.tsx`, `AdminAuditTab.tsx`, `AdminLogsTab.tsx`, `AdminOverviewTab.tsx`, `AdminQueueTab.tsx`, `AdminRevenueTab.tsx`, `AdminSettingsTab.tsx`, `AdminTryonsTab.tsx`, `AdminUsersTab.tsx`) — components receive a different shape than their props declare. Looks like a longer-standing type-looseness issue in the admin panel, unrelated to anything touched this session.

**Root cause of why these went unnoticed for so long**: `bunx tsc --noEmit` (no `-p` flag) against this repo's root `tsconfig.json` checks **nothing** — that file has `"files": []` with TypeScript project references, which only resolve under `tsc --build`. Every "clean typecheck" claim made earlier in this session using the bare command was a false signal. **The real check is `bunx tsc --noEmit -p tsconfig.app.json`.** Use that going forward.

---

## Technical Debt

- The pre-existing type errors listed above are real and should get a dedicated cleanup pass — none are urgent (no runtime crashes observed), but they represent a genuine type-safety gap, especially across the whole admin panel.
- `REPLICATE_MODEL_ACCESSORIES` env var name is misleading (it's actually the live FASHN clothing-fallback model ID, kept for backward compatibility with existing Railway/Convex config rather than renamed). Low priority — rename opportunistically next time Railway env vars are touched.
- `docker-compose.yml`'s local Redis service is a self-hosted alternative; Railway's actual production path is a managed Redis add-on with its own `REDIS_URL`. Not a bug, just worth knowing the two paths diverge.
- `ai_generation_usage`/`ai_generated_models` have no admin UI yet (no way to see Enterprise usage/library across all brands from `/admin`) — fine for now given low expected volume, but will want one before this feature scales.
- No automated tests were added for any of this session's new backend endpoints or Convex functions.

---

## Next Priority

1. **Commit and push this work** (see below — done as part of this same turn).
2. **Legal review** of the 5 policy documents before treating them as binding.
3. **Confirm the Enterprise plan tier is what you want it to be** — feature list, pricing (currently `price_ngn: 0, price_usd: 0` = "contact sales", `tryons_per_month: -1` = unlimited) — this was seeded from the pre-existing definition in `convex/seed.ts`, not newly designed this session.
4. **Test-drive AI Model Generation and Product Photoshoot end-to-end** as a real Enterprise user before telling any customer about them.
5. Clean up the pre-existing type errors (Bugs section) — none are urgent, but the admin panel cluster in particular suggests deeper prop-type drift worth a dedicated look.
6. Decide whether `docs/GOING_TO_PRODUCTION.md`'s checklist has been run end-to-end against the current state of the real deployment (origins, webhook URLs, smoke test) — not verified as part of this session.

---

## Exact Prompt to Resume

```
Continue work on TryVerse (C:\Users\Prince Oruma\Documents\TryVerse). Read PROJECT_STATUS.md
first for full context on what's done, what's pre-existing-but-unfixed, and what's next.

Immediate priorities, in order:
1. Clean up the pre-existing TypeScript errors listed under "Bugs" in PROJECT_STATUS.md —
   use `bunx tsc --noEmit -p tsconfig.app.json` from the repo root to check (NOT the bare
   `bunx tsc --noEmit`, which checks nothing due to the root tsconfig's project-references
   setup). Start with the admin panel cluster since it's the largest group.
2. Test AI Model Generation and AI Product Photoshoot end-to-end as a real Enterprise-plan
   user on both the dev and production Convex deployments (dev: limitless-magpie-618,
   prod: successful-squirrel-888) to confirm the Replicate prompts produce acceptable
   quality before telling any customer about them.
3. Run docs/GOING_TO_PRODUCTION.md's go-live checklist against the real deployed
   environment (not just localhost) — origins, Redis, webhook URLs, smoke test — and note
   any gaps.

Convex deploys: `npx convex deploy` always targets production when CONVEX_DEPLOYMENT is
set (confirmed via --help) — use a deployment-scoped CONVEX_DEPLOY_KEY to target dev, or
CONVEX_DEPLOYMENT=prod:successful-squirrel-888 to target prod explicitly. Always deploy to
both after any convex/*.ts change, per standing instruction.

Do not reintroduce: Supabase (Convex only), the closed-beta signup wall, public developer
documentation on the marketing site, or the Higgsfield/AI-video feature.
```
