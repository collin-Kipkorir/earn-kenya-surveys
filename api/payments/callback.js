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
  const accountReference = body.accountReference || body.data?.accountReference || body.metadata?.accountReference || body.checkoutRequestID || body.checkoutRequestId;
  const transactionStatus = body.status || body.result || body.resultCode || 'unknown';

  const payments = await readPayments();
  const p = payments.find(x => x.id === accountReference || x.providerRequestId === accountReference || x.providerRequestId === body.checkoutRequestID);
  if (!p) {
    const orphan = { id: generateId(), userId: null, phone: null, amount: 0, purpose: 'orphan-callback', status: 'orphan', createdAt: new Date().toISOString(), providerResponse: body };
    payments.push(orphan);
    await writePayments(payments);
    await appendLog('warn', 'Orphan callback recorded', { body });
    return res.json({ ok: true, note: 'orphaned callback recorded' });
  }

  const successCodes = ['SUCCESS', '0', 0, 'Success', 'success'];
  const isSuccess = successCodes.includes(String(transactionStatus));
  p.status = isSuccess ? 'success' : 'failed';
  p.providerResponse = body;
  p.updatedAt = new Date().toISOString();

  await writePayments(payments);
  await appendLog('info', 'Payment updated from callback', { paymentId: p.id, status: p.status, providerResponse: body });
  return res.json({ ok: true });
}
