# Legal Review & Implementation Checklist

**Internal — for the reviewing lawyer, not customer-facing.** Source: the lawyer-review legal package delivered
2026-08-24 (Part IX), annotated with what engineering has already resolved vs. what is a genuine business/legal
decision only counsel or the founder can make. The live policy pages at tryverseai.com now reflect the resolved
items and flag the unresolved ones with an in-page notice rather than raw placeholder brackets.

## Resolved by engineering (2026-08-24)

- ✅ **Stale AI-provider disclosure** — the live Privacy Policy no longer names Replicate/OpenAI; it describes
  providers generically per the package's abstraction principle. The real current provider (FASHN) is recorded in
  `docs/LEGAL_SUBPROCESSOR_SCHEDULE.md` for counsel/enterprise use, not in customer-facing copy.
- ✅ **Conflicting retention periods** — verified against the actual code (`backend/src/services/personalizeSession.ts`):
  widget/anonymous reference photos use a 7-day Redis session TTL. The Privacy Policy's "7 days" was correct; the
  DPA's "24 hours" was not. The DPA now says 7 days, matching reality.
  Dashboard/My Creations retention (until user deletion or account closure) is unchanged and accurate.
- ✅ **Contact emails** — every `[…EMAIL]` placeholder resolved to `info@tryverseai.com`, the one address the
  product actually sends from and the one already publicly used before this update. No separate legal@/security@/
  privacy@ inboxes exist in the codebase; create them if counsel wants inbox separation.
- ✅ **Age threshold** — kept at 13, matching what was already live and consistent with the codebase's existing
  posture (no code contradicts this).
- ✅ **Breach-notification timeline** — kept at a fixed 72 hours, matching what was already a live public
  commitment in the DPA. Not weakened to "without undue delay."
- ✅ **Terms scope** — expanded from 10 to 25 sections to cover My Creations, user-generated models, Credits,
  API/SDK responsibilities, Connect Store, and security/responsible-disclosure, per the package's own diagnosis
  that the old Terms were too short for the current platform.
- ✅ **Dead/duplicate content removed** — an orphaned, never-imported second draft of the Privacy Policy
  (`PrivacyContent` in `src/content/policyContent.tsx`) has been deleted; it was not what was actually live and had
  drifted from the real policy.
- ✅ **New document published** — the AI & Image Processing Notice (Part VI) is now live at `/ai-image-notice` and
  reused in the business onboarding consent flow (`ComplianceOnboardingModal`), which previously showed a narrower,
  non-standalone "personal data notice" with no URL of its own.
- ✅ **Basic version tracking added** — `profiles.policy_version_accepted` now records which published policy
  version a user's `terms_of_service_accepted_at` timestamp corresponds to, without altering historical timestamps.

## Still genuinely pending — needs a person, not code

These cannot be resolved by inspecting the codebase; they're business/legal decisions. They are flagged in-page
(an amber notice on the Terms and Privacy Policy) rather than left as raw brackets, but the underlying decision
still needs to be made:

- [ ] Confirm the exact TryVerse legal entity name, registration number, registered address, and operating
      jurisdiction(s).
- [ ] Confirm governing law and dispute-resolution mechanism/venue for the Terms.
- [ ] Confirm the fixed-amount minimum floor (if any) for the liability cap — currently published as "fees paid in
      the preceding 12 months" only, with no dollar-figure minimum.
- [ ] TryVerse is now B2B-only — the individual/consumer ("B2C") account type is removed from the product (code,
      auth, billing, onboarding) **and the published Terms / Privacy Policy / DPA have been edited to match**:
      consumer-account framing removed, three roles defined (Customer / Authorized User / Shopper), legal-entity
      details replaced with professional bracket placeholders. **Counsel action: review the applied wording** —
      every change is listed before/after in `docs/B2B_LEGAL_REDLINE.md`. Confirm in particular the
      controller/processor split as written in DPA §2 and Terms §14, and whether any consumer-protection carve-out
      is still wanted for sole-trader customers.
- [ ] Confirm the actual FASHN relationship, processing terms, and data-use restrictions before this is described
      in any signed subprocessor schedule (`docs/LEGAL_SUBPROCESSOR_SCHEDULE.md` currently has several
      `[CONFIRM]` cells for location/transfer-mechanism/contract-status).
- [ ] Confirm whether TryVerse or FASHN uses customer content for model training, product improvement, or
      benchmarking — the published Privacy Policy currently states we do not use uploaded photos to train
      foundation models; this must remain true or be corrected before publication of any change.
- [ ] Determine whether facial/likeness processing triggers biometric-data or sensitive-data requirements in any
      target market.
- [ ] Confirm cookie/analytics consent requirements in every target market.
- [ ] Confirm Generated Content ownership/licensing — the prior source document said TryVerse retained generated
      outputs; the new Terms intentionally move this to a "TryVerse grants the rights it is legally able to grant"
      model instead of assuming the old language is still commercially correct. Confirm this is the intended
      commercial position.
- [ ] Confirm whether enterprise customers need a separate Order Form, SLA, Support Policy, Security Addendum, or
      Data Protection Addendum (this session's `docs/LEGAL_SECURITY_SCHEDULE.md` is a candidate Security Addendum
      draft, not yet counsel-reviewed).
- [ ] Confirm whether API/SDK terms should be split into a separate Developer Agreement.
- [ ] Confirm trademark/brand-usage permissions language.
- [ ] Perform a final legal cross-document consistency review before treating any of this as binding.

## Publication principle

The live pages reflect the best factually-grounded version of the lawyer-review package that engineering could
produce without inventing a legal fact. They are **not** a substitute for the still-pending items above. Anywhere
those items matter, the live page says so in plain language rather than a raw bracket or a silently-invented value.
