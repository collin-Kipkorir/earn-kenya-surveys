// Simple proxy to Payhero's transaction-status endpoint.
// Usage: GET /api/payments/status?reference=...  (returns Payhero response)

export default async function handler(req, res) {
  try {
    // Allow CORS for client polling
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const PAYHERO_BASE = process.env.PAYHERO_BASE_URL || 'https://api.payhero.co.ke';
    const AUTH = process.env.PAYHERO_AUTH_TOKEN || process.env.PAYHERO_API_KEY || '';
    const reference = req.query.reference || req.query.ref || req.query.reference_id || '';

    if (!reference) return res.status(400).json({ error: 'Missing reference query parameter' });

    if (!AUTH) return res.status(500).json({ error: 'Server configuration error: PAYHERO_AUTH_TOKEN not set' });

    const authHeader = AUTH.startsWith('Basic ') ? AUTH : `Basic ${AUTH}`;
    const url = `${PAYHERO_BASE}/api/v2/transaction-status?reference=${encodeURIComponent(reference)}`;

    const response = await fetch(url, { method: 'GET', headers: { 'Authorization': authHeader, 'Accept': 'application/json' } });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { raw: text }; }

    return res.status(response.status).json(data);
  } catch (err) {
    console.error('Status handler error', err);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(500).json({ error: 'handler_exception', detail: err && err.message ? err.message : String(err) });
  }
}
