import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const DATA_PATH = path.resolve('./server/payments.json');
const LOG_PATH = path.resolve('./server/payments.log');

async function appendLog(level, message, meta) {
  const entry = { ts: new Date().toISOString(), level, message, meta };
  try {
    await fs.mkdir(path.dirname(LOG_PATH), { recursive: true });
    await fs.appendFile(LOG_PATH, JSON.stringify(entry) + '\n');
  } catch (e) {
    // nothing we can do if logging fails
    // eslint-disable-next-line no-console
    console.error('Failed to write log', e);
  }
}

async function readPayments() {
  try {
    const raw = await fs.readFile(DATA_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

async function writePayments(arr) {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(arr, null, 2));
}

function generateId() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(4);
}

// Initiate payment (STK Push) — frontend calls this to start payment
app.post('/api/payments/initiate', async (req, res) => {
  const { userId, phone, amount, purpose } = req.body;
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

  // If Payhero credentials are configured, attempt to call the Payhero STK endpoint.
  // NOTE: the exact request body/headers depend on Payhero's API — adapt according to their docs.
  const base = process.env.PAYHERO_BASE_URL;
  const apiKey = process.env.PAYHERO_API_KEY;
  const authToken = process.env.PAYHERO_AUTH_TOKEN; // could be 'Basic ...' or 'Bearer ...'
  // Accept either PUBLIC_CALLBACK_URL or PAYHERO_CALLBACK_URL (Vercel env may use the latter)
  const callbackUrl = process.env.PUBLIC_CALLBACK_URL || process.env.PAYHERO_CALLBACK_URL || `${req.protocol}://${req.get('host')}/api/payments/callback`;

  if (base && (apiKey || authToken)) {
    // read optional Payhero-specific envs
    const accountId = process.env.PAYHERO_ACCOUNT_ID;
    const channelId = process.env.PAYHERO_CHANNEL_ID;
    try {
      await appendLog('info', 'Initiating STK push', { paymentId: payment.id, userId, phone, amount, purpose });
      // Example payload; change fields to match Payhero's API.
      // Build payload matching Payhero v2 payments endpoint
      const payload = {
        amount,
        phone_number: phone,
        external_reference: payment.id,
        customer_name: `user:${userId}`,
        callback_url: callbackUrl,
        provider: 'm-pesa',
        // include optional channel/account if provided
        ...(channelId ? { channel_id: channelId } : {}),
      };

      const headers = { 'Content-Type': 'application/json' };
      // Support a few auth styles: full header string, or api key as Bearer
      if (authToken) {
        headers['Authorization'] = authToken;
      } else if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      // Use Payhero v2 payments endpoint (working implementation uses /api/v2/payments)
      const endpoint = base.endsWith('/') ? `${base}api/v2/payments` : `${base}/api/v2/payments`;
      const r = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(payload) });
      let j = null;
      try { j = await r.json(); } catch (e) { j = null; }
      payment.providerResponse = { ok: r.ok, status: r.status, body: j };
      await appendLog('info', 'Payhero response', { paymentId: payment.id, status: r.status, body: j, endpoint });

      // store provider's request/reference id if present in response
      if (j) {
        const findProviderRef = (obj) => {
          if (!obj || typeof obj !== 'object') return null;
          const candidates = [
            'request_id','requestId','requestID','requestid',
            'checkoutRequestID','CheckoutRequestID','CheckoutRequestId','checkoutRequestId','checkoutrequestid',
            'provider_request_id','providerRequestId','providerRequestID',
            'reference','ref','external_reference','externalReference','external_reference',
          ];
          const map = {};
          for (const k of Object.keys(obj)) map[k.toLowerCase()] = obj[k];
          for (const c of candidates) {
            const v = map[c.toLowerCase()];
            if (v) return v;
          }
          return null;
        };

        let providerReq = findProviderRef(j) || findProviderRef(j.data) || findProviderRef(j.body) || findProviderRef(j.result) || null;
        // as a last resort, check nested data.transaction
        if (!providerReq && j.data && j.data.transaction) providerReq = findProviderRef(j.data.transaction);
        if (providerReq) payment.providerRequestId = providerReq;
      }
    } catch (err) {
      payment.providerResponse = { ok: false, error: String(err) };
      await appendLog('error', 'Exception while calling Payhero', { paymentId: payment.id, error: String(err) });
    }
  } else {
    // No credentials configured — we still create a pending payment so the frontend can poll.
    payment.providerResponse = { ok: false, error: 'PAYHERO_BASE_URL or PAYHERO_API_KEY not set on server' };
    await appendLog('warn', 'Payhero credentials missing', { paymentId: payment.id });
  }

  payments.push(payment);
  await writePayments(payments);

  await appendLog('info', 'Payment record created', { paymentId: payment.id, providerResponse: payment.providerResponse });
  res.json({ paymentId: payment.id, providerResponse: payment.providerResponse });
});

// Get payment by id
app.get('/api/payments/:id', async (req, res) => {
  const payments = await readPayments();
  const p = payments.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'payment not found' });
  res.json(p);
});

// Webhook / callback endpoint — Payhero should POST the transaction result here.
app.post('/api/payments/callback', async (req, res) => {
  // Basic validation with a shared secret header if configured
  const secret = process.env.PAYHERO_CALLBACK_SECRET;
  if (secret) {
    const incoming = req.get('x-payhero-signature') || req.get('x-payhero-secret');
    if (!incoming || incoming !== secret) {
      await appendLog('warn', 'Invalid callback signature', { incoming: req.get('x-payhero-signature'), headers: req.headers });
      return res.status(403).json({ error: 'invalid signature' });
    }
  }

  const body = req.body;
  await appendLog('info', 'Callback received', { headers: req.headers, body });
  // Expect the provider to include our accountReference/payment id
  const accountReference = body.accountReference || body.data?.accountReference || body.metadata?.accountReference || body.checkoutRequestID || body.checkoutRequestId;
  const transactionStatus = body.status || body.result || body.resultCode || 'unknown';

  const payments = await readPayments();
  // try to find by accountReference or providerRequestId
  const p = payments.find(x => x.id === accountReference || x.providerRequestId === accountReference || x.providerRequestId === body.checkoutRequestID);
  if (!p) {
    // If not found, respond 200 to acknowledge and persist as orphan callback
    const orphan = { id: generateId(), userId: null, phone: null, amount: 0, purpose: 'orphan-callback', status: 'orphan', createdAt: new Date().toISOString(), providerResponse: body };
    payments.push(orphan);
    await writePayments(payments);
    await appendLog('warn', 'Orphan callback recorded', { body });
    return res.json({ ok: true, note: 'orphaned callback recorded' });
  }

  // Map common provider result codes to success/failed
  const successCodes = ['SUCCESS', '0', 0, 'Success', 'success'];
  const isSuccess = successCodes.includes(String(transactionStatus));
  p.status = isSuccess ? 'success' : 'failed';
  p.providerResponse = body;
  p.updatedAt = new Date().toISOString();

  await writePayments(payments);
  await appendLog('info', 'Payment updated from callback', { paymentId: p.id, status: p.status, providerResponse: body });
  // Acknowledge
  res.json({ ok: true });
});

// Simple logs endpoint for debugging (dev only)
app.get('/api/payments/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '200', 10);
    const raw = await fs.readFile(LOG_PATH, 'utf8').catch(() => '');
    const lines = raw.trim().split('\n').filter(Boolean);
    const tail = lines.slice(-limit).map(l => JSON.parse(l));
    res.json({ ok: true, logs: tail });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Payhero server listening on http://localhost:${port}`));
