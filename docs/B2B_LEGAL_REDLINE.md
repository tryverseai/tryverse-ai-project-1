# B2B Legal Alignment — change record for counsel

**Status: APPLIED to the live policy components, pending counsel review.** TryVerse is B2B-only
in the product. The published Terms, Privacy Policy, and DPA have been edited to match: the
"individual / consumer account" framing is gone, three roles are now defined, and legal-entity
details are professional bracket placeholders. **Counsel should review the wording below and
confirm or adjust** — engineering has aligned the documents with the product, not made final
legal determinations.

Files changed: `src/content/policyContent.tsx` (Terms, DPA, Acceptable Use Policy),
`src/content/TryVersePrivacyPolicy.tsx`, `src/pages/TermsOfService.tsx`.

Legitimate and kept: every reference to a **"Shopper"** / **"subject"** / **"data subject"** /
**"Authorized User"** — these are natural persons within a B2B relationship (the brand's own end
customer, the person in an uploaded photo, the human operating the account), not a TryVerse
consumer account.

---

## Roles now defined (Terms §2, DPA §2, Privacy Policy intro)

| Term | Definition as written |
|---|---|
| **Customer** | The business, brand, organization, or other commercial entity that holds a TryVerse account. |
| **Authorized User** | A natural person the Customer permits to access or administer that account (owner, employee, contractor, agency operator). |
| **Shopper / End User** | A person who interacts with a TryVerse-powered experience that a Customer provides to or for its own customers. |

Added sentence, three places: *"TryVerse accounts are business accounts; TryVerse does not offer
a separate individual or consumer account type."*

## Legal-entity placeholders (Terms §2, §25; DPA §1; Privacy Policy intro, §1)

`[LEGAL ENTITY NAME — TO BE CONFIRMED BY COUNSEL]` · `[REGISTERED ADDRESS — TO BE CONFIRMED]` ·
`[JURISDICTION — TO BE CONFIRMED BY COUNSEL]` · `[LEGAL CONTACT EMAIL — TO BE CONFIRMED]`.
The amber "pending counsel" banner on Terms and Privacy already flags these.

## Wording changes — before → after

| Location | Before | After |
|---|---|---|
| Terms §10 (billing) | "…governed by the applicable plan terms and mandatory consumer law." | "…governed by the applicable plan terms and by any mandatory protections under applicable law that cannot lawfully be excluded." |
| Terms §14 (privacy) | "…processing of personal data in direct-user contexts." | "…processing of personal data where TryVerse acts as a controller (including account, authentication, billing, and platform-security data)." |
| Terms §18 (warranties) | "…a warranty or consumer right that cannot lawfully be excluded." | "…a warranty or right that cannot lawfully be excluded." |
| Terms §22 (governing law) | "…any mandatory consumer or statutory right you have…" | "…any mandatory statutory right that applies to you…" |
| Terms §25 (contact) | "Our registered entity name and business address will be added here once confirmed with counsel." | Full bracket-placeholder entity block. |
| Terms §2 heading | "Eligibility and Accounts" | "Definitions and Accounts" (+ the three role definitions). |
| DPA §1 | "…between TryVerse AI ("TryVerse," "Processor") and the Brand/customer…" | "…between TryVerse AI (`[LEGAL ENTITY NAME…]`; "TryVerse," "Processor") and the Customer…" |
| DPA §2 (Roles) | "Where an individual uses TryVerse directly for their own purposes, the Privacy Policy governs that processing and this DPA does not apply." | "Where TryVerse acts as a controller in its own right — e.g. for the Customer's account, authentication, and billing records, or for platform security and abuse prevention — that processing is governed by the Privacy Policy rather than this DPA." |
| DPA §6 (retention) | "Dashboard-based generations (signed-in individual or business accounts)…" | "Dashboard-based generations created by an Authorized User in a signed-in business account…" |
| AUP §1 (purpose) | "…brand teams, their shoppers via the embedded widget, and personal accounts…" | "…a Customer's team and Authorized Users, and the Shoppers who interact with a TryVerse-powered experience on a Customer's storefront…" |
| Privacy intro | "It applies to individuals using TryVerse directly and describes the relevant processing in brand/merchant contexts." | Rewritten around Authorized Users + controller/processor split. |
| Privacy §1 (Who We Are) | "…rendered onto a photo of a shopper… Individuals can also use TryVerse directly through our web app (Personal Studio) to try on outfits for themselves." | Personal-Studio-for-yourself sentence deleted; channels reworded so the widget is not the sole path; "no separate individual or consumer account type" added. |
| Privacy §2 (data collected) | "Account type (individual or business), brand or company name, and role/job title" | "Brand or company name, and each Authorized User's name and role/job title" |
| Privacy §2 (photos) | "Shopper/user photos — the photo you (or a shopper…) upload…" | "Subject photos — …whether uploaded by an Authorized User in the dashboard or by a Shopper interacting with a brand's embedded TryVerse experience" |
| Privacy §5 | "…preserve the shopper's likeness…" | "…preserve the subject's likeness…" |
| Privacy §7, §11 (retention) | "(signed-in individual or business accounts)…" / "delete individual try-ons" | "…run by an Authorized User in a signed-in business account…" / "delete those try-ons" |
| `TermsOfService.tsx` page intro | "This page reflects our standard terms for brands and merchants. Personal accounts see a tailored summary at signup." | "These are the terms for TryVerse business accounts." |

## Still needs a person, not code

- Confirm the legal entity name / address / jurisdiction and fill the four placeholders.
- Confirm governing law, dispute-resolution venue, and the liability-cap floor (pre-existing open items).
- Confirm the controller/processor split as written in DPA §2 and Terms §14 is the intended legal position.
- Confirm whether any mandatory consumer-protection carve-out is still wanted for sole-trader / very-small-business customers (current wording says "mandatory protections under applicable law that cannot lawfully be excluded", which covers it generically).
- International-transfer country list (pre-existing open item).
