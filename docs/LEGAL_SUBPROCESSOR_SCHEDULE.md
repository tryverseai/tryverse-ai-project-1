# Subprocessor & Infrastructure Schedule

**Internal / counsel document — not customer-facing.** Do not publish this as a public page. It exists to support
the Data Processing Agreement and any enterprise security questionnaire, and to keep the public-facing Privacy
Policy accurate without naming vendors in ordinary product copy (see `docs/LEGAL_COUNSEL_CHECKLIST.md`).

Filled from the actual production codebase as of 2026-08-24. Cells marked `[CONFIRM]` are genuinely unknown from the
code alone (exact data-center region, contractual transfer mechanism, or contract status) and need a person to
confirm them, not an invented value.

| Category | Provider | Purpose | Data | Location | Transfer Mechanism | Contract Status |
|---|---|---|---|---|---|---|
| Database / storage | Convex | Account records, product catalogue, try-on history, uploaded/generated images | Account + content | EU (Ireland — confirmed via the production deployment's `eu-west-1` endpoint) | `[CONFIRM]` | `[CONFIRM]` |
| AI processing | FASHN | Virtual try-on, AI Model Studio, AI Photoshoot, Product Photography, AI Video generation | Person/product images, generation parameters | `[CONFIRM]` | `[CONFIRM]` | `[CONFIRM]` |
| Payments | Paystack | Subscription/payment processing (NGN) | Billing metadata (no card numbers stored by TryVerse) | Nigeria | `[CONFIRM]` | `[CONFIRM]` |
| Payments | Flutterwave | Subscription/payment processing (USD and other currencies) | Billing metadata (no card numbers stored by TryVerse) | `[CONFIRM]` | `[CONFIRM]` | `[CONFIRM]` |
| Email | Resend | Verification, security, transactional email | Email address + message metadata | `[CONFIRM]` | `[CONFIRM]` | `[CONFIRM]` |
| Analytics | PostHog | Product analytics (page views, feature usage, funnel completion) — optional, consent-gated | Technical/usage events; does not receive uploaded photos | `[CONFIRM]` | `[CONFIRM]` | `[CONFIRM]` |
| Monitoring | Sentry | Error/crash monitoring | Logs/diagnostics; auth headers stripped before send | `[CONFIRM]` | `[CONFIRM]` | `[CONFIRM]` |
| Hosting — backend | Railway | Application/API delivery, queue workers | Technical/application data | `[CONFIRM]` | `[CONFIRM]` | `[CONFIRM]` |
| Hosting — frontend/CDN | Vercel | Frontend application delivery | Technical/application data | `[CONFIRM]` | `[CONFIRM]` | `[CONFIRM]` |
| Cache/queue | Redis (Railway-managed) | Job queue, widget-session cache | Ephemeral session/job data | `[CONFIRM]` | `[CONFIRM]` | `[CONFIRM]` |

## Notes for counsel

- **AI provider naming**: the current implementation direction (see the lawyer-review package this schedule
  accompanies) deliberately does not name FASHN in ordinary customer-facing product copy or in the public Privacy
  Policy body text — it's described generically as "third-party AI infrastructure providers." This schedule is the
  place that names it, for exactly the audiences who need to know (counsel, enterprise due-diligence, a DPA
  attachment).
- **Prior stale disclosure**: the Privacy Policy live before 2026-08-24 named Replicate and OpenAI as the AI
  providers for try-on and model-personalization processing. That is no longer accurate — production try-on,
  AI Model Studio, AI Photoshoot, Product Photography, and AI Video generation all run on FASHN as of this
  session's remediation. The published Privacy Policy has been corrected to stop naming a stale provider; this
  schedule is the authoritative record of the current one.
- This table should be reviewed any time a new subprocessor is added or an existing one's role changes materially,
  and the DPA's subprocessor-notice clause (Part III §8 of the lawyer-review package) should be honored when that
  happens.
