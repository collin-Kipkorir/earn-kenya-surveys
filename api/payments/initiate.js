import { appendLog, readPayments, writePayments, generateId, setReferenceMapping } from '../_lib.js';

export default async function handler(req, res) {
  // top-level invocation guard: catch runtime errors and return helpful JSON
  try {
    // CORS headers similar to reference implementation so browser clients can call this directly.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle CORS preflight
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { userId, phone, amount, purpose } = req.body || {};
    if (!userId || !phone || !amount) return res.status(400).json({ error: 'userId, phone and amount required' });

    const payment = {
      id: generateId(),
      userId,
      phone,
      amount,
      purpose: purpose || 'activation',
      status: 'initiated', // local initiation record
      createdAt: new Date().toISOString(),
      providerResponse: null,
      attemptCount: 1,
    };

    // Use the working STK flow from the reference project.
    const PAYHERO_BASE = process.env.PAYHERO_BASE_URL || 'https://api.payhero.co.ke';
    const AUTH = process.env.PAYHERO_AUTH_TOKEN || process.env.PAYHERO_API_KEY || '';
    const DEFAULT_CHANNEL_ID = process.env.PAYHERO_CHANNEL_ID;

    if (AUTH && DEFAULT_CHANNEL_ID) {
      try {
        // Persist a lightweight initiation record so we can track attempts and avoid
        // re-issuing STK requests (this prevents account request breaches on Payhero).
        const payments = await readPayments();

        const MAX_ATTEMPTS = Number(process.env.PAYHERO_MAX_INITIATE_ATTEMPTS || 3);
        const COOLDOWN_MIN = Number(process.env.PAYHERO_INITIATE_COOLDOWN_MIN || 5);

        // normalize createdAt time window check
        const windowMs = COOLDOWN_MIN * 60 * 1000;
        const recentAttempts = payments.filter(p => p.phone === normPhone && (Date.now() - new Date(p.createdAt)) < windowMs).length;
        if (recentAttempts >= MAX_ATTEMPTS) {
          try { await appendLog('warn', 'Too many initiation attempts', { phone: normPhone, recentAttempts, MAX_ATTEMPTS }); } catch (e) { /* ignore */ }
          return res.status(429).json({ error: 'too_many_attempts', message: `Too many initiation attempts. Wait ${COOLDOWN_MIN} minutes before retrying.` });
        }

        // If there is already a pending/initiated payment for this phone/user/external_reference,
        // return it instead of issuing a new STK request. This prevents duplicate provider calls.
        const existingPending = payments.find(p =>
          (p.userId === userId || p.phone === normPhone || p.id === external_reference)
          && (p.status === 'pending' || p.status === 'queued' || p.status === 'initiated')
        );
        if (existingPending) {
          try { await appendLog('info', 'Returned existing pending initiation to avoid duplicate STK', { paymentId: existingPending.id, phone: normPhone }); } catch (e) { /* ignore */ }
          const providerIdentifiers = { providerRequestId: existingPending.providerRequestId || null, providerReference: existingPending.providerReference || null, checkoutId: existingPending.checkoutId || null };
          const stkSent = Boolean(providerIdentifiers.providerRequestId || providerIdentifiers.providerReference);
          return res.json({ note: 'existing_pending', paymentId: existingPending.id, providerIdentifiers, stkSent, payment: existingPending });
        }

        // Persist initiation record before calling provider so we have a server-side record of attempts
        payments.push(payment);
        await writePayments(payments);

        // Normalize phone
          let normPhone = String(phone || '').replace(/\D/g, '');
          if (normPhone.startsWith('254')) normPhone = '0' + normPhone.slice(3);
          if (normPhone.startsWith('7') && normPhone.length === 9) normPhone = '0' + normPhone;
          if (normPhone.startsWith('+254')) normPhone = '0' + normPhone.slice(4);
          // Validate final format: Kenyan national format 0######### (10 digits)
          if (!/^0\d{9}$/.test(normPhone)) {
            // return a helpful error to the client instead of sending to provider
            return res.status(400).json({ error: 'invalid_phone', message: 'Phone must be Kenyan national format (0XXXXXXXXX), e.g. 0712345678', normalized: normPhone });
          }

        // Build callback URL
        const forwardedHost = req.headers['x-forwarded-host'] || req.headers.host || '';
        const forwardedProto = req.headers['x-forwarded-proto'] || 'https';
        const origin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : '';
        const CALLBACK_URL = process.env.PAYHERO_CALLBACK_URL || '';
        const callback_url = CALLBACK_URL || (origin ? `${origin}/api/payments/callback` : '');

        const channel_id = Number(req.body.channel_id || DEFAULT_CHANNEL_ID);
        const external_reference = req.body.external_reference || req.body.accountReference || payment.id;
        const customer_name = req.body.customer_name || req.body.customerName || 'Customer';

        const payload = {
          amount: Math.round(Number(amount)),
          phone_number: normPhone,
          channel_id: channel_id,
          provider: 'm-pesa',
          external_reference: external_reference,
          customer_name: customer_name,
          callback_url: callback_url,
        };

        // Prepare auth header (Basic expected by the working implementation)
        const authHeader = AUTH.startsWith('Basic ') ? AUTH : `Basic ${AUTH}`;

        const url = `${PAYHERO_BASE}/api/v2/payments`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'Accept': 'application/json' },
          body: JSON.stringify(payload),
        });

        const text = await response.text();
        let data = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch (e) {
          data = { raw: text };
        }

        // Normalize provider response (do not persist or write logs at initiate time)
        // update our persisted initiation record with provider response details
        payment.providerResponse = { ok: response.ok, status: response.status, body: data };
        payment.providerRequestId = data.request_id || data.checkout_request_id || data.requestId || data.CheckoutRequestID || null;
        payment.providerReference = data.reference || data.data?.reference || null;
        payment.updatedAt = new Date().toISOString();
        payment.status = response.ok ? 'pending' : 'failed';
        // write back updated payment record
        try {
          const current = await readPayments();
          const idx = current.findIndex(x => x.id === payment.id);
          if (idx !== -1) { current[idx] = payment; await writePayments(current); }
        } catch (e) {
          console.error('Failed to update persisted initiation record', e);
        }
        if (response.ok) {
          // If provider returned its authoritative reference, persist a mapping from our external_reference -> provider reference
          try {
            const provRef = data.reference || data.data?.reference || null;
            if (provRef && external_reference) {
              await setReferenceMapping(external_reference, provRef);
              try { await appendLog('info', 'Persisted reference mapping', { external_reference, providerReference: provRef, paymentId: payment.id }); } catch (e) { /* ignore */ }
            }
          } catch (e) {
            // non-fatal mapping failure
            console.error('Failed to persist reference mapping', e);
            try { await appendLog('error', 'Failed to persist reference mapping', { err: String(e), paymentId: payment.id, external_reference }); } catch (e2) { /* ignore */ }
          }
        } else {
          // Non-OK status returned; will be surfaced to client in the response
          try { await appendLog('error', 'Payhero initiate returned non-OK', { status: response.status, body: data, external_reference, paymentId: payment.id }); } catch (e) { /* ignore */ }
        }
      } catch (err) {
        payment.providerResponse = { ok: false, error: err && err.message ? err.message : String(err) };
        try { await appendLog('error', 'Initiate handler fetch failed', { err: String(err), paymentId: payment.id, external_reference }); } catch (e) { /* ignore */ }
      }
    } else {
      payment.providerResponse = { ok: false, error: 'Server misconfiguration: PAYHERO_AUTH_TOKEN or PAYHERO_CHANNEL_ID not set' };
    }

  // Do not persist initiation attempt. Return transient payment info to client.
  // Also expose top-level provider identifiers to make client polling reliable and include
  // explicit flags so the client can show where the flow is (STK sent, provider ids, etc.).
  const providerReference = payment.providerResponse?.body?.reference || null;
  const checkoutId = payment.providerResponse?.body?.CheckoutRequestID || payment.providerResponse?.body?.checkout_request_id || payment.providerRequestId || null;
  const stkSent = Boolean(payment.providerRequestId || checkoutId);
  const providerIdentifiers = { providerRequestId: payment.providerRequestId || null, providerReference, checkoutId };
  return res.json({ paymentId: payment.id, payment, providerResponse: payment.providerResponse, providerIdentifiers, stkSent });
  } catch (err) {
    console.error('Initiate handler error', err);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(500).json({ error: 'handler_exception', detail: String(err && err.message ? err.message : err) });
  }
}
