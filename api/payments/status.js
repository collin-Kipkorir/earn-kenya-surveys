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

    return res.status(response.status).json(data);
  } catch (err) {
    console.error('[api/payhero/status] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
