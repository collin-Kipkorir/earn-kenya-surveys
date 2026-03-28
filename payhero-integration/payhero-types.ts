// payhero-integration/payhero-types.ts

export interface InitiateResponse {
  success: boolean;
  providerReference?: string | null;
  providerRequestId?: string | null;
  raw?: any;
}

export interface StatusResponse {
  success: boolean;
  status?: string;
  providerReference?: string | null;
  providerRequestId?: string | null;
  raw?: any;
}

export interface WebhookPayload {
  accountReference?: string;
  status?: string;
  request_id?: string;
  checkoutRequestID?: string;
  [k: string]: any;
}
