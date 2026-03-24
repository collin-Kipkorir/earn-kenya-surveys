import { appendLog, readPayments, writePayments, readReferenceMap, upsertUser } from '../_lib.js';
import fs from 'fs/promises';
import path from 'path';

const LOG_PATH = path.join(process.cwd(), 'server', 'payments.log');

export default async function handler(req, res) {
  // Simple admin debug endpoint. Protect with ADMIN_SECRET header.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Secret');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const secret = process.env.ADMIN_SECRET;
  const incoming = req.headers['x-admin-secret'] || req.headers['X-Admin-Secret'];
  if (!secret || !incoming || incoming !== secret) {
    await appendLog('warn', 'Unauthorized admin debug access attempt', { headers: req.headers && Object.keys(req.headers) });
    return res.status(403).json({ ok: false, error: 'unauthorized' });
  }

  try {
    if (req.method === 'GET') {
      const limit = parseInt((req.query && req.query.limit) || '20', 10);
      const payments = await readPayments();
      const tail = payments.slice(-limit).reverse();
      const raw = await fs.readFile(LOG_PATH, 'utf8').catch(() => '');
      const lines = raw.trim().split('\n').filter(Boolean).slice(-200).map(l => {
        try { return JSON.parse(l); } catch { return { raw: l }; }
      });
      return res.json({ ok: true, payments: tail, logs: lines });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      // Support a simulated callback: { simulateCallback: true, paymentId }
      if (body.simulateCallback && body.paymentId) {
        const payments = await readPayments();
        const p = payments.find(x => x.id === body.paymentId);
        if (!p) return res.status(404).json({ ok: false, error: 'payment_not_found' });

        // Mark success (simulation) and persist a note
        p.status = 'success';
        p.updatedAt = new Date().toISOString();
        p.providerResponse = p.providerResponse || {};
        p.providerResponse._simulatedBy = 'admin/payments-debug';
        p.providerResponse._simulatedAt = new Date().toISOString();

        await writePayments(payments);
        await appendLog('info', 'Admin simulated callback', { paymentId: p.id });

        // Attempt upsert if userId present
        let upsertAttempted = false;
        let upsertSucceeded = false;
        if (p.userId) {
          upsertAttempted = true;
          try {
            const userUpdate = { id: p.userId };
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
            upsertSucceeded = true;
            await appendLog('info', 'Admin upserted user from simulated callback', { userId: p.userId, paymentId: p.id });
          } catch (err) {
            await appendLog('error', 'Admin failed to upsert user', { err: String(err), paymentId: p.id });
          }
        }

        return res.json({ ok: true, paymentId: p.id, upsertAttempted, upsertSucceeded, payment: p });
      }

      return res.status(400).json({ ok: false, error: 'unknown_action' });
    }

    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  } catch (err) {
    await appendLog('error', 'Admin debug handler error', { err: String(err) });
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
