import { appendLog } from '../_lib.js';
import fs from 'fs/promises';
import path from 'path';

const LOG_PATH = path.join(process.cwd(), 'server', 'payments.log');

export default async function handler(req, res) {
  try {
    const limit = parseInt((req.query && req.query.limit) || '200', 10);
    const raw = await fs.readFile(LOG_PATH, 'utf8').catch(() => '');
    const lines = raw.trim().split('\n').filter(Boolean);
    const tail = lines.slice(-limit).map(l => {
      try { return JSON.parse(l); } catch { return { raw: l }; }
    });
    return res.json({ ok: true, logs: tail });
  } catch (e) {
    console.error('Logs handler error', e);
    await appendLog('error', 'Failed to read logs', { error: String(e) });
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
