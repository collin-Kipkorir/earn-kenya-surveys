// payhero-integration/payhero-service.ts
import { InitiateResponse, StatusResponse } from './payhero-types';

// Wrapper that uses your app server endpoints (recommended).
// By default these call /api/payments/initiate and /api/payments/status

const API_BASE = (typeof window !== 'undefined' && (import.meta.env && (import.meta.env.VITE_API_BASE as string))) || '/api';

export async function initiateSTKPush(opts: { userId?: string; phone: string; amount: number; purpose?: string }) : Promise<InitiateResponse> {
  const resp = await fetch(`${API_BASE}/payments/initiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    return { success: false, raw: txt };
  }
  const j = await resp.json();
  return { success: true, providerReference: j.providerReference || j.payment?.providerResponse?.body?.reference || null, providerRequestId: j.providerRequestId || j.payment?.providerRequestId || null, raw: j };
}

export async function checkPaymentStatus(reference: string) : Promise<StatusResponse> {
  const resp = await fetch(`${API_BASE}/payments/status?reference=${encodeURIComponent(reference)}`);
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    return { success: false, raw: txt };
  }
  const j = await resp.json();
  // j may be the forwarder wrapper or raw provider body
  const providerBody = j && (j.body || j.providerBody) ? (j.body || j.providerBody) : j;
  const tx = providerBody?.status || providerBody?.result || providerBody?.resultCode || providerBody?.data?.status || 'unknown';
  const s = String(tx).toLowerCase();
  const okay = providerBody && (providerBody.success === true || providerBody.data?.success === true) || ['success', '0', 'completed', 'ok'].some(k => s === k || s.includes(k));
  return { success: okay, status: String(tx), providerReference: j?.providerReference || providerBody?.reference || null, providerRequestId: j?.providerRequestId || providerBody?.request_id || providerBody?.requestId || providerBody?.CheckoutRequestID || providerBody?.checkout_request_id || null, raw: j };
}

export default { initiateSTKPush, checkPaymentStatus };
