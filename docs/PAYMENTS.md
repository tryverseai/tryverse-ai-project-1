# TryVerse payments (Paystack · Flutterwave)

## Processors

| Provider | Currencies | Amount source |
|----------|------------|---------------|
| **Paystack** | **NGN** | `plans.price_ngn` (server only — never trust the browser) |
| **Flutterwave** | **USD** or **NGN** | `plans.price_usd` or `plans.price_ngn` from the same row |

Coverage and settlement depend on **your** Paystack / Flutterwave merchant account, KYC, and their current country rules.

## Environment (backend)

- `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET` — leave unset to disable Paystack.
- `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_WEBHOOK_SECRET` — leave unset to disable Flutterwave.

## Webhook URLs

- Paystack: `https://<your-api-domain>/api/payment/webhook/paystack`
- Flutterwave: `https://<your-api-domain>/api/payment/webhook/flutterwave`

The backend uses `express.text` on `/api/payment/webhook/*` so raw bodies verify correctly.

## Verify endpoints (logged-in user)

- `GET /api/payment/verify/paystack/:reference`
- `GET /api/payment/verify/flutterwave/:transactionId`

## Test matrix (sandboxes)

See official docs for test cards and webhook replay. Exercise: **success**, **decline**, **3DS** (if your integration supports it), and delayed webhooks using verify as a backup.

## Legal / marketing

- Name **Paystack** and **Flutterwave** where you disclose payment processors.
- Do not claim “all countries” unless your merchant agreements actually support that.

## Code

- Backend: `src/services/payments/paystack.ts`, `flutterwave.ts`, `src/routes/payment.ts`, `src/server.ts`
- Frontend: `src/pages/Pricing.tsx`, `src/lib/backendApi.ts`
