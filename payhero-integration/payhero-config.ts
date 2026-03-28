// payhero-integration/payhero-config.ts
// Configuration helpers for PayHero integration. Use Vite envs on the frontend and Node envs on the server.

export const FRONTEND = typeof window !== 'undefined';

export const CLIENT_AUTH_TOKEN = (import.meta.env && (import.meta.env.VITE_PAYHERO_AUTH_TOKEN as string)) || '';
export const CLIENT_CHANNEL_ID = (import.meta.env && (import.meta.env.VITE_PAYHERO_CHANNEL_ID as string)) || '';
export const CLIENT_ACCOUNT_ID = (import.meta.env && (import.meta.env.VITE_PAYHERO_ACCOUNT_ID as string)) || '';
export const CLIENT_CALLBACK_URL = (import.meta.env && (import.meta.env.VITE_PAYHERO_CALLBACK_URL as string)) || '';

// Server-side config
export const SERVER_AUTH_TOKEN = process.env.PAYHERO_AUTH_TOKEN || '';
export const SERVER_API_URL = process.env.PAYHERO_API_URL || 'https://backend.payhero.co.ke';
export const SERVER_API_KEY = process.env.PAYHERO_API_KEY || '';
export const WEBHOOK_SECRET = process.env.PAYHERO_WEBHOOK_SECRET || '';

// Timeouts and tuning
export const DEFAULT_STATUS_POLL_INTERVAL_MS = Number((import.meta.env && (import.meta.env.VITE_PAYHERO_POLL_INTERVAL_MS as string)) || 2000);
export const DEFAULT_SUCCESS_GAP_MS = Number((import.meta.env && (import.meta.env.VITE_PAYHERO_SUCCESS_GAP_MS as string)) || 3000);
