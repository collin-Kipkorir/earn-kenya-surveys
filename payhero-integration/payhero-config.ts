// PayHero configuration (copy and set environment variables in your project)
export const PAYHERO_CONFIG = {
  BASE_URL: process.env.PAYHERO_BASE_URL || 'https://backend.payhero.co.ke',
  ACCOUNT_ID: process.env.VITE_PAYHERO_ACCOUNT_ID || process.env.PAYHERO_ACCOUNT_ID || '',
  CHANNEL_ID: process.env.VITE_PAYHERO_CHANNEL_ID || process.env.PAYHERO_CHANNEL_ID || '',
  // Default AUTH_TOKEN copied from this repository for convenience when integrating locally.
  // In production, override via environment variables and keep secrets out of source control.
  AUTH_TOKEN: process.env.VITE_PAYHERO_AUTH_TOKEN || process.env.PAYHERO_AUTH_TOKEN || 'Basic OWZZWVUwTG9SSkdnZ0pvUmhwQ3M6SDREdWwxQTVTT0N2QksxUk85dTE1eUJoazFXWHhJNFZMcm80Sks0MA==',
  CALLBACK_URL: process.env.VITE_PAYHERO_CALLBACK_URL || process.env.PAYHERO_CALLBACK_URL || 'http://localhost:5000/api/payment-callback',
  API_BASE_URL: process.env.VITE_API_BASE_URL || ''
};

export const PAYHERO_ENDPOINTS = {
  INITIATE_PAYMENT: '/api/v2/payments',
  CHECK_STATUS: '/api/v2/transaction-status',
  CHECK_TRANSACTION: '/api/v2/transactions',
  WEBHOOK: '/api/v2/payments/webhook'
};

export const PAYMENT_PROVIDERS = {
  MPESA: 'm-pesa',
  AIRTEL: 'airtel-money',
  TKASH: 't-kash'
} as const;

export const CURRENCIES = {
  KES: 'KES',
  USD: 'USD'
} as const;

export type PaymentProvider = typeof PAYMENT_PROVIDERS[keyof typeof PAYMENT_PROVIDERS];
export type Currency = typeof CURRENCIES[keyof typeof CURRENCIES];
