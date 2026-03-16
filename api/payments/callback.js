import { appendLog, readPayments, writePayments, generateId } from '../_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = process.env.PAYHERO_CALLBACK_SECRET;
  if (secret) {
    const incoming = req.headers['x-payhero-signature'] || req.headers['x-payhero-secret'];
    if (!incoming || incoming !== secret) {
      await appendLog('warn', 'Invalid callback signature', { incoming, headers: req.headers });
      return res.status(403).json({ error: 'invalid signature' });
    }
  }

  const body = req.body || {};
  await appendLog('info', 'Callback received', { headers: req.headers, body });

  // Try multiple possible fields Payhero might send
  const accountReference = body.accountReference
    || body.external_reference
    || body.data?.accountReference
    || body.metadata?.accountReference
    || body.checkoutRequestID
    || body.checkoutRequestId
    || body.request_id
    || body.requestId
    || body.reference;

  // transaction status may be in several places depending on provider version
  const transactionStatus = body.status
    || body.result
    || body.resultCode
    || body.data?.status
    || (body.data && body.data.transaction && body.data.transaction.status)
    || 'unknown';

  const payments = await readPayments();
  const p = payments.find(x =>
    x.id === accountReference
    || x.providerRequestId === accountReference
    || x.providerRequestId === body.checkoutRequestID
    || x.providerRequestId === body.request_id
    || x.providerRequestId === body.requestId
  );
  if (!p) {
    const orphan = { id: generateId(), userId: null, phone: null, amount: 0, purpose: 'orphan-callback', status: 'orphan', createdAt: new Date().toISOString(), providerResponse: body };
    payments.push(orphan);
    await writePayments(payments);
    await appendLog('warn', 'Orphan callback recorded', { body });
    return res.json({ ok: true, note: 'orphaned callback recorded' });
  }

  // Normalize status detection (accept numeric 0, 'SUCCESS', 'success', 'Completed', etc.)
  const s = String(transactionStatus).toLowerCase();
  const successKeywords = ['success', '0', 'completed', 'ok'];
  const isSuccess = successKeywords.some(k => s === k || s.includes(k));

  p.status = isSuccess ? 'success' : 'failed';
  // preserve full provider payload for debugging
  p.providerResponse = body;
  // store provider's request id / reference for future lookups
  p.providerRequestId = p.providerRequestId || body.request_id || body.requestId || body.checkoutRequestID || body.checkoutRequestId || body.reference;
  p.updatedAt = new Date().toISOString();

  await writePayments(payments);
  await appendLog('info', 'Payment updated from callback', { paymentId: p.id, status: p.status, providerResponse: body });
  return res.json({ ok: true });
}
