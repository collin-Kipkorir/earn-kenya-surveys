import { readPayments } from '../_lib.js';

export default async function handler(req, res) {
  const { id } = req.query || {};
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!id) return res.status(400).json({ error: 'id required' });
  const payments = await readPayments();
  const p = payments.find(x => x.id === id);
  if (!p) return res.status(404).json({ error: 'payment not found' });
  return res.json(p);
}
