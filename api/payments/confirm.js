import { appendLog, readPayments, writePayments, generateId, upsertUser, getProviderReference, setReferenceMapping } from '../_lib.js';

export default async function handler(req, res) {
  try {
    // Allow CORS for client-side confirmation requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { reference, providerRequestId, external_reference, userId, phone, amount, purpose } = req.body || {};
    let lookup = reference || providerRequestId || external_reference;
    if (!lookup) return res.status(400).json({ error: 'reference, providerRequestId or external_reference required' });

    // If the client passed our external_reference, translate to provider reference if mapping exists
    try {
      const mapped = await getProviderReference(lookup);
      if (mapped) lookup = mapped;
    } catch (e) {
      console.error('Failed to lookup provider reference mapping', e);
    }

    const PAYHERO_BASE = process.env.PAYHERO_BASE_URL || 'https://api.payhero.co.ke';
    const AUTH = process.env.PAYHERO_AUTH_TOKEN || process.env.PAYHERO_API_KEY || '';
    if (!AUTH) return res.status(500).json({ error: 'Server configuration error: PAYHERO_AUTH_TOKEN not set' });

    const authHeader = AUTH.startsWith('Basic ') ? AUTH : `Basic ${AUTH}`;
    const url = `${PAYHERO_BASE}/api/v2/transaction-status?reference=${encodeURIComponent(lookup)}`;
    const response = await fetch(url, { method: 'GET', headers: { 'Authorization': authHeader, 'Accept': 'application/json' } });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { raw: text }; }

    // Determine account/reference and transaction status from provider response (follow Payhero docs)
    const accountReference = data.accountReference
      || data.external_reference
      || data.reference
      || data.provider_reference
      || data.third_party_reference
      || data.payment_reference
      || data.request_id
      || data.requestId
      || data.CheckoutRequestID
      || data.checkout_request_id
      || data.checkoutRequestID
      || data.data?.accountReference
      || data.metadata?.accountReference
      || null;

    // transaction status: prefer explicit boolean `success`, otherwise inspect status fields
    const transactionStatus = (typeof data.success === 'boolean') ? (data.success ? 'SUCCESS' : 'FAILED') : (data.status || data.result || data.resultCode || data.data?.status || (data.data && data.data.transaction && data.data.transaction.status) || 'unknown');

    // If provider returned its authoritative reference in the status response, persist mapping
    try {
      const provRef = data.reference || data.data?.reference || null;
      if (provRef && external_reference) {
        await setReferenceMapping(external_reference, provRef);
        try { await appendLog('info', 'Persisted reference mapping from confirm', { external_reference, providerReference: provRef, lookup }); } catch (e) { /* ignore */ }
      }
    } catch (e) {
      console.error('Failed to persist reference mapping from confirm', e);
    }

  const s = String(transactionStatus).toLowerCase();
  const successKeywords = ['success', '0', 'completed', 'ok'];
  const isSuccess = (data.success === true) || successKeywords.some(k => s === k || s.includes(k));
  const isQueued = s === 'queued' || s.includes('queued');

    const payments = await readPayments();
    let p = payments.find(x =>
      x.id === accountReference
      || x.providerRequestId === accountReference
      || x.providerRequestId === lookup
      || x.id === external_reference
    );

    if (!p) {
      p = {
        id: external_reference || accountReference || generateId(),
        userId: userId || null,
        phone: phone || null,
        amount: amount || 0,
        purpose: purpose || 'activation',
        status: isSuccess ? 'success' : (isQueued ? 'pending' : 'failed'),
        createdAt: new Date().toISOString(),
        providerResponse: data,
        providerRequestId: lookup,
      };
      payments.push(p);
      await writePayments(payments);
      await appendLog('info', 'Payment confirmed and saved', { paymentId: p.id, status: p.status, lookup, providerResponseSummary: { ok: response.ok, status: response.status } });
    } else {
  p.status = isSuccess ? 'success' : (isQueued ? 'pending' : 'failed');
      p.providerResponse = data;
      p.providerRequestId = p.providerRequestId || lookup;
      p.updatedAt = new Date().toISOString();
      await writePayments(payments);
      await appendLog('info', 'Payment updated from confirm', { paymentId: p.id, status: p.status, lookup });
    }

    // Ensure we have userId/phone/amount on the payment record (if provided in the confirm request)
    p.userId = p.userId || userId || null;
    p.phone = p.phone || phone || null;
    p.amount = p.amount || amount || 0;

    // If success, attempt to upsert minimal user state. Prefer payment.userId but fall back to the userId provided
    // in the confirm request so client-confirmation is idempotent even when server-side persisted records are missing
    const targetUserId = p.userId || userId || null;
    if (isSuccess && targetUserId) {
      try {
        const userUpdate = { id: targetUserId };
        if (p.purpose === 'activation') {
          userUpdate.isActivated = true;
          userUpdate.balance = (p.amount || 0) + 100;
        } else if (p.purpose && p.purpose.startsWith('upgrade')) {
          const parts = p.purpose.split(':');
          const tier = parts[1] || 'premium';
          userUpdate.tier = tier;
          userUpdate.dailySurveyLimit = tier === 'gold' ? 10 : 5;
        }
        await upsertUser(userUpdate);
        await appendLog('info', 'Upserted server user from confirm', { userId: targetUserId, userUpdate });
      } catch (err) {
        await appendLog('error', 'Failed to upsert user from confirm', { err: String(err), paymentId: p.id });
      }
    }

    return res.json({ ok: true, payment: p, providerResponse: data });
  } catch (err) {
    console.error('Confirm handler error', err);
    await appendLog('error', 'Error in /payments/confirm', { err: String(err) });
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(500).json({ error: 'handler_exception', detail: err && err.message ? err.message : String(err) });
  }
}
