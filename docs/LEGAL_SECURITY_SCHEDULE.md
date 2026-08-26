# Security & Data Protection Schedule

**Internal / counsel + enterprise-contract document — not customer-facing.** This is the contractual description of
technical/organizational safeguards referenced by the DPA. Intended to be attached to enterprise agreements once
counsel has reviewed it, not published as a public page.

Reproduced from the lawyer-review package's Part VIII, annotated against what this session's security audit
actually verified in the production codebase (see the earlier Security Engagement Report from 2026-08-23 for full
detail). Items marked **(verified)** were confirmed against real code/config this session; items without that
marker reflect the lawyer-review draft's baseline and should be validated by engineering before counsel relies on
them in a signed contract.

## 1. Governance
TryVerse maintains documented security ownership, risk management, access-control standards, incident-response
procedures, and security policies appropriate to the size and risk profile of the Service.

## 2. Identity and Access Management
Access to production systems is authenticated and authorized according to role and least privilege. Admin routes
require a timing-safe key comparison and reject cross-site credentialed requests via Fetch Metadata checks
**(verified — fixed 2026-08-23)**.

## 3. Secrets and Credentials
Secrets, API keys, and provider credentials are stored in Railway/Convex environment configuration, not committed
to source. Customer API keys are hashed at rest (SHA-256, looked up by exact-match hash rather than by the raw
secret) as of 2026-08-26 — the prior plaintext-storage gap noted in earlier drafts of this schedule has been
remediated **(verified — production rows backfilled and a live auth request confirmed working against the new
hash-based lookup before deploy)**. One documented exception: the single auto-provisioned key the dashboard's
Connect Store flow re-displays on every visit keeps plaintext storage by design, since a hash-only key has nothing
left to redisplay after creation — every other key (named/scoped keys created via the API Keys tab) is hash-only
from creation. Plaintext credentials are not exposed through client bundles or logs **(verified)**.

## 4. Application Security
Secure development practices are in place for input validation, authorization checks, and dependency management.
A Content-Security-Policy header was added to the frontend as of 2026-08-26 (`connect-src`/`script-src`/
`frame-ancestors` restricted to known origins); `script-src` still permits `unsafe-inline`/`unsafe-eval`, which is a
known remaining hardening step requiring its own live-verification pass before removal, not yet done
**(verified as currently deployed — the further tightening is explicitly not claimed as done)**. Dependency
vulnerabilities were re-audited and remediated as of 2026-08-26: backend down from 20 to 3 (the remainder is a
Windows-only dev-server tool and a transitive dependency of the job-queue library that would require a breaking
downgrade to fully clear); frontend's 3 critical/high advisories (in the authentication library itself) were fixed
and the fix was verified with a live local sign-in test before shipping; 2 moderate frontend advisories in the
routing library remain, deferred pending a major-version migration **(verified via `npm audit` and live testing)**.

## 5. Data Protection
Personal data and Generated Content are protected via encryption in transit (HTTPS/TLS) **(verified)**. Storage URLs
are signed and access-controlled rather than public **(verified)**.

## 6. Isolation and Authorization
Every creation, generated model, source asset, and account-scoped resource is authorized server-side against the
authenticated user/account — not filtered client-side only **(verified as the general pattern this session; not
every admin route was exhaustively line-reviewed for IDOR — flagged as a residual risk in the Security Engagement
Report)**. A new admin-only AI-usage visibility route was added 2026-08-26 (aggregate/per-account generation counts
for internal support and capacity purposes); it sits behind the same admin session/key gate as every other admin
route covered above, not separately re-reviewed.

## 7. Monitoring and Logging
Security-relevant events are logged via Sentry, with authorization/auth-token headers stripped before capture
**(verified)**.

## 8. Vulnerability Management
A dependency-audit and remediation process exists; see item 4 above for current status.

## 9. Incident Response
An incident-response process should cover identification, containment, investigation, remediation, recovery,
evidence preservation, and legally required notifications. The DPA (Part III §10 of the lawyer-review package)
commits to a 72-hour breach-notification window to affected brands, matching what is already live in the current
Data Processing Agreement.

## 10. Business Continuity
Production systems run on managed platforms (Railway, Vercel, Convex) with their own backup/recovery guarantees.
TryVerse-specific backup/restore drills are not something this session's audit exercised — flagged for a future
pass, not claimed as verified here.

## 11. AI Provider Security
The underlying AI provider (FASHN — see `docs/LEGAL_SUBPROCESSOR_SCHEDULE.md`) should go through a vendor-risk
review before this schedule is attached to any enterprise agreement. Not performed as part of this session's audit,
which focused on TryVerse's own application/infrastructure layer.

## 12. Customer Security Responsibilities
Customers are responsible for protecting their own credentials, configuring integrations securely, and reporting
suspected compromise — consistent with the Acceptable Use Policy and Terms of Service.

---

**Do not attach this schedule to a signed customer contract until counsel has reviewed it against the current
production state**, since several items above explicitly note residual gaps rather than clean guarantees.
