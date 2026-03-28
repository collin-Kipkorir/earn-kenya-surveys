// payhero-integration/payhero-webhook.ts
import { Request, Response } from 'express';

export type WebhookOptions = {
  verifySecret?: string | boolean;
  // Provide a handler that will be called when a payment is confirmed
  onConfirmed?: (payload: any) => Promise<void> | void;
};

export function makePayheroWebhookHandler(opts: WebhookOptions) {
  return async function handler(req: Request, res: Response) {
    try {
      const payload = req.body || {};

      // Basic secret header check (if verifySecret is set)
      if (opts.verifySecret) {
        const incoming = req.headers['x-payhero-signature'] || req.headers['x-payhero-secret'] || req.headers['x-webhook-secret'];
        if (!incoming || String(incoming) !== String(opts.verifySecret)) {
          return res.status(403).json({ ok: false, error: 'invalid signature' });
        }
      }

      // Detect payment reference fields
      const accountReference = payload.accountReference || payload.external_reference || payload.request_id || payload.checkoutRequestID || payload.reference || payload.requestId;
      const transactionStatus = payload.status || payload.result || payload.resultCode || payload.data?.status || 'unknown';

      // Determine success heuristics
      const s = String(transactionStatus).toLowerCase();
      const successKeywords = ['success', '0', 'completed', 'ok'];
      const isSuccess = successKeywords.some(k => s === k || s.includes(k)) || payload.success === true || payload.data?.success === true;

      // Call the onConfirmed hook if success (the app should ensure idempotency)
      if (isSuccess) {
        if (opts.onConfirmed) await opts.onConfirmed(payload);
      }

      return res.json({ ok: true, received: true, accountReference, isSuccess });
    } catch (err) {
      console.error('Webhook handler error', err);
      return res.status(500).json({ ok: false, error: String(err) });
    }
  };
}

export default makePayheroWebhookHandler;
