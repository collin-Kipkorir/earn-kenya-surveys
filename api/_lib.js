import fs from 'fs/promises';
import path from 'path';

const DATA_PATH = path.join(process.cwd(), 'server', 'payments.json');
const LOG_PATH = path.join(process.cwd(), 'server', 'payments.log');

export async function appendLog(level, message, meta) {
  const entry = { ts: new Date().toISOString(), level, message, meta };
  try {
    await fs.mkdir(path.dirname(LOG_PATH), { recursive: true });
    await fs.appendFile(LOG_PATH, JSON.stringify(entry) + '\n');
  } catch (e) {
    // best-effort logging in serverless environment
    console.error('Failed to write log', e);
  }
}

export async function readPayments() {
  try {
    const raw = await fs.readFile(DATA_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export async function writePayments(arr) {
  try {
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    await fs.writeFile(DATA_PATH, JSON.stringify(arr, null, 2));
  } catch (e) {
    // ignore write errors in ephemeral env
    console.error('Failed to write payments', e);
  }
}

export function generateId() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(4);
}
