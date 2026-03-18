import { appendLog, readPayments, writePayments } from '../../_lib.js';

export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { id } = req.query || {};
    if (!id) return res.status(400).json({ error: 'id required' });

    const body = req.body || {};
    const userId = body.userId || null;
    const reason = body.reason || 'client_invalidate';

    const payments = await readPayments();
    const idx = payments.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: 'payment not found' });

    const p = payments[idx];
    // Basic ownership check: only allow invalidation by the same user who initiated the payment
    if (p.userId && userId && String(p.userId) !== String(userId)) {
      await appendLog('warn', 'Unauthorized invalidate attempt', { paymentId: id, by: userId });
      return res.status(403).json({ error: 'forbidden' });
    }

    p.status = 'invalidated';
    p.invalidatedAt = new Date().toISOString();
    p.invalidatedBy = userId || null;
    p.invalidationReason = reason;
    p.updatedAt = new Date().toISOString();

    payments[idx] = p;
    await writePayments(payments);
    await appendLog('info', 'Payment invalidated by client', { paymentId: id, userId, reason });

    return res.json({ ok: true, payment: p });
  } catch (err) {
    console.error('Invalidate handler error', err);
    try { await appendLog('error', 'Invalidate handler exception', { err: String(err) }); } catch (e) { /* ignore */ }
    return res.status(500).json({ error: 'handler_exception', detail: err && err.message ? err.message : String(err) });
  }
}
