PayHero integration (scaffold)

This folder contains a minimal PayHero (M-Pesa STK) integration scaffold for the app.

Files:
- `payhero-config.ts` — env-driven config
- `payhero-types.ts` — types for requests/responses
- `payhero-service.ts` — client-side wrapper (useful for local/dev) with `initiateSTKPush` and `checkPaymentStatus`
- `usePaymentPolling.ts` — React hook to poll PayHero for a reference
- `useCredits.ts` — small helper to finalize payments via server `/api/payments/confirm` (adapted here to activation/upgrade)

Notes:
- For production, prefer server-side initiation and webhook processing. The client-side service uses VITE_PAYHERO_AUTH_TOKEN which is okay for local dev only.
- This project uses amount=1 for activation/upgrade test flows. Adjust env vars in `.env.example`.
