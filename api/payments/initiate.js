import { appendLog, readPayments, writePayments, generateId } from '../_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, phone, amount, purpose } = req.body || {};
  if (!userId || !phone || !amount) return res.status(400).json({ error: 'userId, phone and amount required' });

  const payments = await readPayments();
  const payment = {
    id: generateId(),
    userId,
    phone,
    amount,
    purpose: purpose || 'activation',
    status: 'pending',
    createdAt: new Date().toISOString(),
    providerResponse: null,
  };

  const base = process.env.PAYHERO_BASE_URL;
  const apiKey = process.env.PAYHERO_API_KEY;
  const authToken = process.env.PAYHERO_AUTH_TOKEN;
  const callbackUrl = process.env.PUBLIC_CALLBACK_URL || process.env.PAYHERO_CALLBACK_URL || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/payments/callback`;

  if (base && (apiKey || authToken)) {
    const accountId = process.env.PAYHERO_ACCOUNT_ID;
    const channelId = process.env.PAYHERO_CHANNEL_ID;
    try {
      await appendLog('info', 'Initiating STK push', { paymentId: payment.id, userId, phone, amount, purpose });
      const payload = {
        phone,
        amount,
        accountReference: payment.id,
        callbackUrl,
        description: `Payment for ${payment.purpose} (user ${userId})`,
        ...(accountId ? { accountId } : {}),
        ...(channelId ? { channelId } : {}),
      };

      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = authToken;
      else headers['Authorization'] = `Bearer ${apiKey}`;

      const r = await fetch(`${base}/stk/push`, { method: 'POST', headers, body: JSON.stringify(payload) });
      const j = await r.json().catch(() => null);
      payment.providerResponse = { ok: r.ok, status: r.status, body: j };
      await appendLog('info', 'Payhero response', { paymentId: payment.id, status: r.status, body: j });
      if (j && (j.checkoutRequestID || j.data?.checkoutRequestID || j.requestId)) payment.providerRequestId = j.checkoutRequestID || j.data?.checkoutRequestID || j.requestId;
    } catch (err) {
      payment.providerResponse = { ok: false, error: String(err) };
      await appendLog('error', 'Exception while calling Payhero', { paymentId: payment.id, error: String(err) });
    }
  } else {
    payment.providerResponse = { ok: false, error: 'PAYHERO_BASE_URL or PAYHERO_API_KEY not set on server' };
    await appendLog('warn', 'Payhero credentials missing', { paymentId: payment.id });
  }

  payments.push(payment);
  await writePayments(payments);
  await appendLog('info', 'Payment record created', { paymentId: payment.id, providerResponse: payment.providerResponse });
  return res.json({ paymentId: payment.id, providerResponse: payment.providerResponse });
}
