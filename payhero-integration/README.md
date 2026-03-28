# PayHero Integration (M-Pesa STK) — Quick Start

This folder contains a small, framework-agnostic integration scaffold for PayHero (M-Pesa STK) that you can copy into your project.

Files added
- `payhero-config.ts` — environment-driven config helpers
- `payhero-types.ts` — small TS types for responses
- `payhero-service.ts` — client wrapper (calls your app server endpoints)
- `usePaymentPolling.ts` — React hook for polling with safety logic
- `payhero-webhook.ts` — Express-compatible webhook handler factory
- `useCredits.ts` — example credit application helper (calls your server endpoint)
- `.env.example` — example env vars

How to wire it into your app
1. Copy the folder into your project root (or move files into your preferred folders).
2. Provide env vars (see `.env.example`).
3. On the frontend, call `initiateSTKPush` and start `usePaymentPolling(reference, { onSuccess, onError })`.
4. On the server, create an Express route using `makePayheroWebhookHandler` and provide an `onConfirmed` callback to update your DB idempotently.

Security notes
- Never commit production secrets. Use environment variables or a secret manager.
- Always perform server-side credit application in the webhook handler after verification and make it idempotent.

Testing
- Use the PayHero sandbox / functions emulator or call `/api/payments/callback` with a simulated payload to verify your webhook logic.
