import { readUsers, upsertUser } from '../_lib.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query || {};
  if (!id) return res.status(400).json({ error: 'missing id' });

  if (req.method === 'GET') {
    const users = await readUsers();
    const u = users.find(x => String(x.id) === String(id));
    if (!u) return res.status(404).json({ error: 'not found' });
    return res.json({ ok: true, user: u });
  }

  if (req.method === 'POST') {
    // accept a partial user update body and upsert
    const body = req.body || {};
    const toUpsert = { id, ...body };
    await upsertUser(toUpsert);
    return res.json({ ok: true, user: toUpsert });
  }

  return res.status(405).json({ error: 'method not allowed' });
}
