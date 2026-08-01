## Audit

### Layer map (what I will and won't touch)

| Layer | Files | Action |
|---|---|---|
| Presentation | `src/components/*`, `src/pages/*`, `src/index.css`, `tailwind.config.ts` | **Redesign** |
| Business logic / hooks | `src/hooks/*`, `src/contexts/AuthContext.tsx`, `src/lib/backendApi.ts` | Preserve; only re-wire into new components |
| Backend | `backend/src/**` (Express, Replicate, FASHN, Redis queue, Paystack/Flutterwave, Resend) | **Untouched** |
| Data layer | `convex/**`, `src/integrations/supabase/*` | **Untouched** |
| Widget/API | `public/widget.js`, `public/tryverse-*.js` | **Untouched** (widget styling only if asked) |

Rule for every change: components keep their existing props, handlers, query calls and route paths. Only markup, tokens, layout and motion change.

### SpreeAI: what actually makes it feel premium

- **Editorial typography** — a high-contrast display serif at enormous scale (wordmark spanning the full viewport), paired with a small, quiet UI sans. The type *is* the graphic.
- **Product-as-hero** — a full-bleed cutout model on a soft grey studio backdrop; copy is a small right-aligned block, not a centered stack.
- **Near-empty chrome** — nav is two text links. No pill badges, no gradient buttons, no stat rows.
- **Narrative scroll** — one idea per viewport, huge whitespace, statements set as headings rather than paragraphs.
- **Restraint in motion** — slow opacity/mask reveals and a scroll cue; nothing bounces or floats.
- **Palette** — warm off-white, studio grey, near-black. A single black pill button.

### Where TryVerse currently falls short

1. **Hero reads as a generic SaaS template**: pulsing badge pill, centered headline + subhead + two buttons + 3-stat row + 4-card grid. Every AI-generated landing page looks like this.
2. **Continuously floating video cards** (`y: [0,-8,0]` infinite loops) — reads as decoration, not craft.
3. **Type system is default**: Space Grotesk + Inter, no scale rhythm, no editorial display tier.
4. **Tokens are flat greys** — `--gradient-primary` is grey-on-grey; `shadow-elevated` is generic.
5. **Navbar is 105px of logo** with a `10rem` navbar-height variable pushing content down oddly.
6. **Section rhythm is uniform** — everything is `py-24 max-w-7xl` centered; no pacing, no contrast between sections.
7. **Dashboard/admin tabs** are unstyled shadcn defaults — no cohesion with the marketing site.
8. **No storytelling arc** — sections are feature blocks, not a narrative.
9. **Empty / loading / error states** are mostly bare spinners or absent.

---

## Redesign plan

### Phase 0 — Design system foundation
Rewrite `src/index.css` + `tailwind.config.ts` only.
- Palette: warm paper `#FAF9F7`, studio grey, ink near-black, one restrained accent. Full dark-mode parity.
- Type: editorial display serif for headlines + geometric sans for UI. Fluid `clamp()` type scale (display / h1–h4 / body / caption / mono-label).
- Spacing rhythm, radius scale, three-tier shadow, motion tokens (durations + easings), focus-visible ring.
- New primitives: section shell, eyebrow label, reveal-on-scroll wrapper, marquee, before/after slider.

### Phase 1 — Navigation + shared shell
Navbar (slim, text-led, scroll-aware), footer, mobile sheet nav, page transition wrapper, `<main>` landmark, skip link.

### Phase 2 — Landing page narrative
Rebuild `Index.tsx` as a scroll story following your arc: Problem → Shopping friction → How TryVerse works → Brand integration → Real try-on → Enterprise → API → Proof → CTA. Full-bleed cinematic hero using your uploaded clips (muted loops, poster-first, `IntersectionObserver` via the existing `AutoPlayVideo`), one idea per viewport, mask/opacity reveals instead of float loops.

### Phase 3 — Auth surfaces
Auth, ForgotPassword, ResetPassword, VerifyEmail, AuthInvite, AuthConfirm, ApproveDevice — split editorial layout, same form state and handlers.

### Phase 4 — Dashboard shell + tabs
Dashboard chrome, Overview, Analytics, Products, ApiKeys, Billing, Settings, Widget, Studio, AiModels, AiPhotoshoot, DeveloperDocs, TryOnGuide. Same data hooks, new cards/tables/empty/loading/error states.

### Phase 5 — Try-On experience
Upload → processing → result. Skeleton + progress choreography, before/after slider, results gallery, comparison, download/share/regenerate. Wired to the existing generation endpoints unchanged.

### Phase 6 — Remaining pages
Pricing, About, PartnerWithUs, BookDemo, Support, EarlyAccess, NotFound, legal pages, Admin tabs, every modal (`ComplianceOnboarding`, `EnterpriseUpgrade`, `TryOnGuidelines`, `SignupAccountType`, `BetaAccessOverlay`, `CookieConsent`).

### Phase 7 — Validation
Per phase: `tsgo` typecheck, dev-server 200, Playwright pass over key routes (desktop + mobile viewport) checking console errors, navigation, form submission, and enterprise gating.

### Technical notes
- Motion: `framer-motion` (already installed), transform/opacity only, `useReducedMotion` respected globally via the existing `MotionConfig`.
- Videos: your two uploaded clips are 834×1112 portrait, 8s, with audio — I'll strip audio, encode muted MP4 + WebM, and upload via Lovable Assets rather than committing binaries.
- No backend, schema, endpoint, env-var or auth-logic changes are proposed. If any phase appears to require one, I'll stop and document it instead.

### Sequencing
Phases 0–2 first, delivered together for your review. Phases 3–7 follow once the language is approved, so the whole platform inherits one system rather than drifting.
