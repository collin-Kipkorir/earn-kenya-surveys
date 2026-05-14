// Lightweight helpers to finalize payments via the server and adapt to this app's activation/upgrade flows.
// In this project we prefer the server to perform authoritative upserts. These helpers POST to
// `/api/payments/confirm` so the server can persist and (optionally) upsert the user when appropriate.

export async function finalizePaymentByProviderReference(providerReference: string, userId: string, phone?: string, amount?: number, purpose?: string) {
	const apiBase = (import.meta.env.VITE_API_BASE_URL as string) || (import.meta.env.VITE_API_BASE as string) || '/api';
	const base = apiBase.replace(/\/+$/, '');
	const body: Record<string, any> = { reference: providerReference, userId };
	if (phone) body.phone = phone;
	if (amount !== undefined) body.amount = amount;
	if (purpose) body.purpose = purpose;

	const resp = await fetch(`${base}/payments/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
	if (!resp.ok) throw new Error(`Confirm failed: HTTP ${resp.status}`);
	return resp.json();
}

export async function finalizePaymentByExternalReference(externalReference: string, userId: string, phone?: string, amount?: number, purpose?: string) {
	const apiBase = (import.meta.env.VITE_API_BASE_URL as string) || (import.meta.env.VITE_API_BASE as string) || '/api';
	const base = apiBase.replace(/\/+$/, '');
	const body: Record<string, any> = { external_reference: externalReference, userId };
	if (phone) body.phone = phone;
	if (amount !== undefined) body.amount = amount;
	if (purpose) body.purpose = purpose;

	const resp = await fetch(`${base}/payments/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
	if (!resp.ok) throw new Error(`Confirm failed: HTTP ${resp.status}`);
	return resp.json();
}

export async function applyActivationViaServer(providerReference: string, userId: string, phone?: string) {
	return finalizePaymentByProviderReference(providerReference, userId, phone, 1, 'activation');
}

export async function applyUpgradeViaServer(providerReference: string, userId: string, phone?: string, tier: 'premium'|'gold' = 'premium') {
	return finalizePaymentByProviderReference(providerReference, userId, phone, tier === 'premium' ? 1 : 1, `upgrade:${tier}`);
}
