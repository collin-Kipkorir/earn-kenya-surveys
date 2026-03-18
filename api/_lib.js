import fs from 'fs/promises';
import path from 'path';

const DATA_PATH = path.join(process.cwd(), 'server', 'payments.json');
const LOG_PATH = path.join(process.cwd(), 'server', 'payments.log');
const USERS_PATH = path.join(process.cwd(), 'server', 'users.json');
const REFMAP_PATH = path.join(process.cwd(), 'server', 'reference-map.json');
// in-memory cache to reduce file reads (behaves like fanaka-loans referenceMap plus persistence)
let REFMAP_CACHE = null;

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

export async function readUsers() {
  try {
    const raw = await fs.readFile(USERS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export async function writeUsers(arr) {
  try {
    await fs.mkdir(path.dirname(USERS_PATH), { recursive: true });
    await fs.writeFile(USERS_PATH, JSON.stringify(arr, null, 2));
  } catch (e) {
    console.error('Failed to write users', e);
  }
}

export async function upsertUser(user) {
  const users = await readUsers();
  const idx = users.findIndex(u => u.id === user.id);
  if (idx === -1) {
    users.push(user);
  } else {
    users[idx] = { ...users[idx], ...user };
  }
  await writeUsers(users);
  return user;
}

// Reference map persistence: maps our external_reference -> provider reference
export async function readReferenceMap() {
  // return in-memory cache if available
  if (REFMAP_CACHE) return REFMAP_CACHE;
  try {
    const raw = await fs.readFile(REFMAP_PATH, 'utf8');
    REFMAP_CACHE = JSON.parse(raw || '{}');
    return REFMAP_CACHE;
  } catch (e) {
    REFMAP_CACHE = {};
    return REFMAP_CACHE;
  }
}

export async function writeReferenceMap(obj) {
  try {
    await fs.mkdir(path.dirname(REFMAP_PATH), { recursive: true });
    await fs.writeFile(REFMAP_PATH, JSON.stringify(obj, null, 2));
    // update cache
    REFMAP_CACHE = obj;
  } catch (e) {
    console.error('Failed to write reference map', e);
  }
}

export async function setReferenceMapping(externalReference, providerReference) {
  if (!externalReference || !providerReference) return null;
  const key = String(externalReference);
  const val = String(providerReference);
  // ensure cache is loaded
  const m = await readReferenceMap();
  m[key] = val;
  await writeReferenceMap(m);
  return m[key];
}

export async function getProviderReference(externalReference) {
  if (!externalReference) return null;
  const m = await readReferenceMap();
  return m[String(externalReference)] || null;
}
