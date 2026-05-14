import { PAYHERO_CONFIG, PAYHERO_ENDPOINTS, PAYMENT_PROVIDERS } from './payhero-config';
import type { PayHeroResponse, PayHeroStatusResponse } from './payhero-types';

interface STKPushRequest {
	amount: number;
	customerName: string;
	phoneNumber: string;
	provider?: string;
	reference?: string;
	currency?: string;
}

class PayHeroService {
	private channelId: string;
	private callbackUrl: string;
	private baseUrl: string;
	private authToken: string;

	constructor() {
		this.channelId = String(PAYHERO_CONFIG.CHANNEL_ID);
		this.callbackUrl = PAYHERO_CONFIG.CALLBACK_URL;
		this.baseUrl = PAYHERO_CONFIG.BASE_URL;
		this.authToken = String(PAYHERO_CONFIG.AUTH_TOKEN);
	}

	private generateReference(): string {
		return `TX${Date.now()}${Math.random().toString(36).substring(2, 6)}`;
	}

	validatePhoneNumber(phoneNumber: string): { isValid: boolean; formattedNumber?: string; error?: string } {
		try {
			let cleaned = phoneNumber.replace(/\D/g, "");
			if (cleaned.startsWith("0")) {
				cleaned = "254" + cleaned.slice(1);
			} else if (cleaned.startsWith("+")) {
				cleaned = cleaned.slice(1);
			} else if (!cleaned.startsWith("254")) {
				cleaned = "254" + cleaned;
			}

			if (cleaned.length !== 12) {
				return {
					isValid: false,
					error: "Phone number must be 9 digits excluding the country code"
				};
			}

			if (!cleaned.match(/^254(7[0-9]{8})$/)) {
				return {
					isValid: false,
					error: "Please enter a valid Safaricom number (07xx xxx xxx)"
				};
			}

			return {
				isValid: true,
				formattedNumber: cleaned
			};
		} catch (error) {
			return {
				isValid: false,
				error: "Invalid phone number format"
			};
		}
	}

	async initiateSTKPush({ amount, customerName, phoneNumber, provider = PAYMENT_PROVIDERS.MPESA, reference, currency = 'KES' }: STKPushRequest): Promise<PayHeroResponse> {
		try {
			const validation = this.validatePhoneNumber(phoneNumber);
			if (!validation.isValid) {
				throw new Error(validation.error || "Invalid phone number");
			}
			const formattedPhone = validation.formattedNumber!;
			const paymentReference = reference || this.generateReference();

			const requestBody = {
				amount: Number(amount),
				phone_number: formattedPhone,
				channel_id: this.channelId,
				currency: currency,
				reference: paymentReference,
				customer_name: customerName,
				provider: provider,
				callback_url: this.callbackUrl
			};

			const url = `${this.baseUrl}${PAYHERO_ENDPOINTS.INITIATE_PAYMENT}`;
			const headers = {
				"Content-Type": "application/json",
				"Accept": "application/json",
				"Authorization": this.authToken
			};

			const response = await fetch(url, {
				method: "POST",
				headers,
				body: JSON.stringify(requestBody)
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Payment initiation failed: ${response.statusText} - ${errorText}`);
			}

			const data = await response.json();

			if (data.status === "success" || data.message === "Success" || data.success === true) {
				return {
					success: true,
					status: data.status || 'SUCCESS',
					reference: paymentReference,
					CheckoutRequestID: data.checkout_request_id || data.CheckoutRequestID
				} as PayHeroResponse;
			}

			return {
				success: false,
				reference: paymentReference,
				error: {
					code: "PAYMENT_FAILED",
					message: data.message || "Failed to initiate payment"
				}
			};
		} catch (error) {
			return {
				success: false,
				error: {
					code: "API_ERROR",
					message: error instanceof Error ? error.message : "An error occurred while processing payment"
				}
			};
		}
	}

	async checkPaymentStatus(reference: string): Promise<PayHeroStatusResponse> {
		try {
			const statusUrl = `${this.baseUrl}${PAYHERO_ENDPOINTS.CHECK_STATUS}?reference=${reference}`;
			const transactionUrl = `${this.baseUrl}${PAYHERO_ENDPOINTS.CHECK_TRANSACTION}/${reference}`;

			const statusResponse = await fetch(statusUrl, {
				method: "GET",
				headers: {
					"Authorization": this.authToken,
					"Accept": "application/json"
				}
			});

			if (statusResponse.ok) {
				const statusData = await statusResponse.json();
				if (statusData.response) {
					const { ResultCode, ResultDesc, MpesaReceiptNumber } = statusData.response;
					return {
						success: ResultCode === 0,
						status: ResultCode === 0 ? 'SUCCESS' : 'FAILED',
						reference: reference,
						provider_reference: MpesaReceiptNumber,
						transaction_date: new Date().toISOString(),
						error: ResultCode !== 0 ? { code: String(ResultCode), message: ResultDesc } : undefined
					} as PayHeroStatusResponse;
				}

				return {
					success: true,
					status: statusData.status || "PENDING",
					reference: reference,
					provider_reference: statusData.provider_reference,
					third_party_reference: statusData.third_party_reference,
					transaction_date: statusData.transaction_date
				} as PayHeroStatusResponse;
			}

			const transactionResponse = await fetch(transactionUrl, {
				method: "GET",
				headers: {
					"Authorization": this.authToken,
					"Accept": "application/json"
				}
			});

			if (transactionResponse.status === 404) {
				return {
					success: false,
					status: 'PENDING',
					error: {
						code: 'NOT_FOUND',
						message: 'Transaction not found or still processing'
					}
				} as PayHeroStatusResponse;
			}

			if (!transactionResponse.ok) {
				const errText = await transactionResponse.text();
				throw new Error(`Failed to check transaction: ${errText}`);
			}

			const transactionData = await transactionResponse.json();
			if (transactionData.response) {
				const { ResultCode, ResultDesc, MpesaReceiptNumber } = transactionData.response;
				return {
					success: ResultCode === 0,
					status: ResultCode === 0 ? 'SUCCESS' : 'FAILED',
					reference: reference,
					provider_reference: MpesaReceiptNumber,
					transaction_date: new Date().toISOString(),
					error: ResultCode !== 0 ? { code: String(ResultCode), message: ResultDesc } : undefined
				} as PayHeroStatusResponse;
			}

			return {
				success: true,
				status: transactionData.status || "PENDING",
				reference: reference,
				provider_reference: transactionData.provider_reference,
				third_party_reference: transactionData.third_party_reference,
				transaction_date: transactionData.transaction_date
			} as PayHeroStatusResponse;

		} catch (error) {
			return {
				success: false,
				status: "FAILED",
				reference: reference,
				error: {
					code: "STATUS_CHECK_FAILED",
					message: error instanceof Error ? error.message : "Failed to check payment status"
				}
			} as PayHeroStatusResponse;
		}
}

}

export const payHeroService = new PayHeroService();
