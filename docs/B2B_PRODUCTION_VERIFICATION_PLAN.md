# B2B-only — production verification plan

**To run by whoever holds deploy access, after merge and deploy. Not executed in the refactor
session (no deploy key; nothing was deployed).** Non-destructive checks only.

Prod deployment map (from `convex/README.md`, supersedes `PROJECT_STATUS.md`): the deployment
Convex labels `dev:` — `patient-axolotl-17` — is the **real production database**. `prod:`
(`pastel-setter-205`) is the sandbox. `npm run convex:deploy:prod` is the only command that
reaches production; it auto-resets `.env.local` to the sandbox afterward.

## 0. Pre-deploy gate

- [ ] `bunx tsc --noEmit` in `backend/` — clean
- [ ] `bunx tsc --noEmit -p convex/tsconfig.json` — clean
- [ ] `bunx tsc --noEmit -p tsconfig.app.json` — only the 2 known pre-existing `Pricing.tsx` errors
- [ ] `bunx vite build` — clean
- [ ] All three test suites green (see `docs/TESTING.md`)
- [ ] `npx convex codegen` (or `convex dev --once` against the sandbox) run and `convex/_generated/**` committed
- [ ] Diff reviewed for auth / authz / credits / payments / security regressions — none expected (see the completion report's safety section)

## 1. Business account lifecycle

- [ ] Sign up at `/auth?signup=business` with a fresh work email → verification email arrives
- [ ] Enter the 8-digit code → lands on the dashboard, `ComplianceOnboardingModal` shows business goals only
- [ ] `GET /api/account/me` (or Convex dashboard) → `profiles` row exists, `account_type === "business"`, `free_credits_total === 10`, `free_credits_remaining === 10`
- [ ] Welcome email received once; says "your workspace is now active"
- [ ] Log out → log back in → dashboard loads, no re-onboarding
- [ ] Visit `/dashboard/individual` → 301s to `/dashboard/business` (back-compat retained)

## 2. Credits

- [ ] New account shows 10 free credits in the dashboard
- [ ] Run one Try-On (Personal Studio or Connect Store test) → succeeds, remaining drops to 9
- [ ] Force a generation failure if feasible (or check logs from a naturally failed job) → credit is refunded exactly once (`credit_refund_dedup` row present)
- [ ] Enterprise-plan account (if one exists) → generations do not decrement (unlimited bypass intact)

## 3. AI features (one controlled generation each, credits permitting)

- [ ] Try-On (dashboard) → result returns
- [ ] One other feature (Outfit Builder / AI Photoshoot / AI Model Studio / Product Photography / AI Video) → result returns
- [ ] `ai_generation_usage` / feature-specific `*_generations` row written with the correct `user_id`

## 4. Storefront integration (widget = secondary path — verify it still works)

- [ ] `Dashboard → Connect Store` → API key auto-provisions and displays
- [ ] `Dashboard → Developers → Allowed domains` → add a test domain, then list it
- [ ] `POST /api/widget/request` with that API key + `Origin` header for the allowed domain + storage paths under the key owner → `202`/`200`
- [ ] Same call with a **non-allowlisted** `Origin` → rejected by `validateDomain`
- [ ] Same call with storage paths **not** prefixed by the key owner's `user_id` → `403` (IDOR guard intact)
- [ ] `GET /api/widget/status/:id` for another account's try-on id → `404` (ownership scoped)
- [ ] SDK quick-start from `Dashboard → Developers` → one server-side try-on succeeds without a domain allowlist entry

## 5. Payments (verify security, do not create unnecessary charges)

- [ ] `GET /api/payment/providers` → returns configured providers
- [ ] Inspect a recent real `payment_intents` row → `expected_amount` / `expected_currency` / `plan_id` / `user_id` present (webhook amount-validation path intact)
- [ ] Do **not** initiate a new live payment solely for this check

## 6. Admin

- [ ] `/admin` → login gate works (7-min session)
- [ ] Admin user list loads; the account-type filter offers only **All / Business**
- [ ] `PATCH /api/admin/users/:id/profile` → `404` (route removed)
- [ ] Admin plan-change (`PATCH /api/admin/users/:id/plan`) still works on a test account
- [ ] Non-admin session hitting `/api/admin/*` → `401/403`

## 7. Legal pages

- [ ] `/terms`, `/privacy`, `/data-processing`, `/acceptable-use`, `/cookie-policy`, `/ai-image-notice` all render
- [ ] Terms §2 shows the Customer / Authorized User / Shopper definitions and "no separate individual or consumer account type"
- [ ] No "individual account", "personal account", "individual or business" wording remains (spot-check Terms §10/§14/§18/§22, DPA §2/§6, Privacy §1/§2/§7)
- [ ] Legal-entity bracket placeholders visible in Terms §25, DPA §1, Privacy intro/§1
- [ ] `ComplianceOnboardingModal` legal steps render (Terms, Privacy, DPA, goals)

## 8. Plan copy correction

- [ ] Before: `npx convex run seed:fixFreePlanFeatureCopy` — review the `plans` free row's `features`
- [ ] Run `npx convex run seed:fixFreePlanFeatureCopy` against production → `{ changed: true, replaced: 1 }` (or `changed: false` if already correct)
- [ ] `/pricing` free plan now reads "10 free AI generations on signup"
- [ ] Re-run once → `{ changed: false }` (idempotent)
- [ ] Rollback rehearsal on the sandbox: `npx convex run seed:fixFreePlanFeatureCopy '{ "revert": true }'`

## 9. Post-deploy smoke

- [ ] Frontend loads, no console errors on `/` and `/dashboard`
- [ ] `GET /api/health` (or equivalent) → ok
- [ ] Convex dashboard → no schema-validation errors, no dropped indexes
- [ ] One real business login → dashboard + credits load
