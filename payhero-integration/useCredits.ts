// payhero-integration/useCredits.ts
// Example helper to call a server endpoint that applies credits to a user account.

export async function applyCreditsForPayment(opts: { userId: string; amount: number; paymentId?: string; purpose?: string }) {
  // Server should expose a secure endpoint that performs an idempotent credit operation.
  const resp = await fetch('/api/credits/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  if (!resp.ok) throw new Error('Failed to apply credits');
  return resp.json();
}

export default { applyCreditsForPayment };
