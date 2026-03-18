// Replace status proxy with fanaka-loans style: forward the provider response body and HTTP status
// Vercel Serverless function: /api/payhero/status
// Queries PayHero for payment status by reference and returns provider status/code directly.

export default async function handler(req, res) {
  // Set CORS headers first
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const PAYHERO_BASE = process.env.PAYHERO_BASE_URL || 'https://backend.payhero.co.ke';
    const AUTH = process.env.PAYHERO_AUTH_TOKEN || '';
    const reference = req.query.reference || '';

    if (!reference) {
      return res.status(400).json({ error: 'Missing reference' });
    }

    // Ensure Authorization header has Basic prefix if not already present
    let authHeader = AUTH;
    if (AUTH && !AUTH.startsWith('Basic ')) {
      authHeader = `Basic ${AUTH}`;
    }

    // Use PayHero's transaction-status endpoint
    const url = `${PAYHERO_BASE}/api/v2/transaction-status?reference=${encodeURIComponent(reference)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
    });

    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (e) {
      data = { raw: text };
    }

    // Persist the raw provider response for auditing and debugging.
    try {
      const { appendLog } = await import('../_lib.js');
      try { await appendLog('info', 'Status proxy response', { reference, status: response.status, body: data }); } catch (e) { /* ignore logging errors */ }
    } catch (e) {
      // ignore if import fails in some runtimes
    }

    // Derive helpful tracing fields so clients can see whether STK was sent and whether
    // the provider reports an explicit boolean success or a textual success.
    const providerRequestId = data.request_id || data.checkout_request_id || data.requestId || data.CheckoutRequestID || null;
    const providerReference = data.reference || data.provider_reference || data.payment_reference || null;
    const explicitSuccess = (typeof data.success === 'boolean') ? data.success : (data.data && typeof data.data.success === 'boolean' ? data.data.success : null);
    const s = String((data.status || data.result || data.resultCode || explicitSuccess === null) || '').toLowerCase();
    const textualSuccess = s && (s.includes('success') || s.includes('completed') || s === '0');
    const stkSent = Boolean(providerRequestId || providerReference);

    return res.status(response.status).json({ providerBody: data, providerRequestId, providerReference, explicitSuccess, textualSuccess, stkSent });
  } catch (err) {
    console.error('[api/payhero/status] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
