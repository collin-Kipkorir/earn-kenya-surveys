import { readPayments } from '../_lib.js';

export default async function handler(req, res) {
  try {
    const { id } = req.query || {};
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    if (!id) return res.status(400).json({ error: 'id required' });
    const payments = await readPayments();
    const p = payments.find(x => x.id === id);
    if (!p) return res.status(404).json({ error: 'payment not found' });
    return res.json(p);
  } catch (err) {
    console.error('Payment by id handler error', err);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(500).json({ error: 'handler_exception', detail: err && err.message ? err.message : String(err) });
  }
}
