export interface PayHeroPaymentRequest {
  amount: number;
  phone_number: string;
  channel_id: number | string;
  provider: string;
  external_reference?: string;
  customer_name?: string;
  callback_url?: string;
}

export interface PayHeroResponse {
  success: boolean;
  status?: string;
  reference?: string;
  CheckoutRequestID?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface PayHeroStatusResponse {
  success: boolean;
  status?: 'SUCCESS' | 'QUEUED' | 'FAILED' | 'PENDING';
  reference?: string;
  provider_reference?: string;
  third_party_reference?: string;
  transaction_date?: string;
  message?: string;
  receipt?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
