import { BasePaymentProvider } from '../PaymentProvider.js';
import { 
  CreatePaymentInput, 
  PaymentInitResult, 
  PaymentVerificationResult, 
  WebhookProcessingResult 
} from '../types.js';

export class MonCashAdapter extends BasePaymentProvider {
  readonly id = 'moncash';
  readonly name = 'Digicel MonCash (Haïti)';
  readonly supportedMethods = ['moncash'];

  private get clientId(): string | undefined {
    return process.env.MONCASH_CLIENT_ID;
  }

  private get clientSecret(): string | undefined {
    return process.env.MONCASH_CLIENT_SECRET;
  }

  private get isSandbox(): boolean {
    return process.env.MONCASH_MODE !== 'live';
  }

  private get apiBaseUrl(): string {
    return this.isSandbox
      ? 'https://sandbox.moncashbutton.digicelgroup.com/Api'
      : 'https://moncashbutton.digicelgroup.com/Api';
  }

  private get gatewayBaseUrl(): string {
    return this.isSandbox
      ? 'https://sandbox.moncashbutton.digicelgroup.com/Moncash-middleware'
      : 'https://moncashbutton.digicelgroup.com/Moncash-middleware';
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  isManual(): boolean {
    return !this.isConfigured();
  }

  private async getAccessToken(): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('MonCash API non configurée : MONCASH_CLIENT_ID et MONCASH_CLIENT_SECRET requis.');
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const res = await fetch(`${this.apiBaseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Échec d'authentification MonCash (${res.status}): ${errBody}`);
    }

    const data = await res.json() as { access_token: string; token_type: string; expires_in: number };
    return data.access_token;
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentInitResult> {
    // If not configured with API credentials, delegate to manual flow or error gracefully
    if (!this.isConfigured()) {
      return {
        success: false,
        paymentId: '',
        provider: this.id,
        method: input.paymentMethod,
        amountHTG: input.amountHTG,
        feeHTG: 0,
        finalAmountHTG: input.amountHTG,
        status: 'FAILED',
        reference: '',
        isManual: true,
        errorMessage: "L'API automatisée MonCash n'est pas configurée dans les variables d'environnement (MONCASH_CLIENT_ID / MONCASH_CLIENT_SECRET). Utilisez le mode de paiement manuel MonCash.",
      };
    }

    try {
      const token = await this.getAccessToken();
      const orderId = input.customReference || `MC-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const res = await fetch(`${this.apiBaseUrl}/v1/CreatePayment`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: input.amountHTG,
          orderId,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        return {
          success: false,
          paymentId: orderId,
          provider: this.id,
          method: input.paymentMethod,
          amountHTG: input.amountHTG,
          feeHTG: 0,
          finalAmountHTG: input.amountHTG,
          status: 'FAILED',
          reference: orderId,
          isManual: false,
          errorMessage: `Erreur API MonCash (${res.status}): ${errorText}`,
        };
      }

      const data = await res.json() as { payment_token: { token: string; expired: string } };
      const redirectUrl = `${this.gatewayBaseUrl}/Payment/Redirect?token=${data.payment_token.token}`;

      return {
        success: true,
        paymentId: orderId,
        provider: this.id,
        method: input.paymentMethod,
        amountHTG: input.amountHTG,
        feeHTG: 0,
        finalAmountHTG: input.amountHTG,
        status: 'PENDING',
        redirectUrl,
        reference: orderId,
        isManual: false,
        expiresAt: data.payment_token.expired,
      };
    } catch (err: any) {
      return {
        success: false,
        paymentId: '',
        provider: this.id,
        method: input.paymentMethod,
        amountHTG: input.amountHTG,
        feeHTG: 0,
        finalAmountHTG: input.amountHTG,
        status: 'FAILED',
        reference: '',
        isManual: false,
        errorMessage: err.message || 'Erreur lors de la communication avec le serveur MonCash.',
      };
    }
  }

  async verifyPayment(referenceId: string): Promise<PaymentVerificationResult> {
    if (!this.isConfigured()) {
      return {
        verified: false,
        status: 'FAILED',
        amountHTG: 0,
        providerRef: referenceId,
        internalRef: referenceId,
        errorMessage: 'MonCash API non configurée.',
      };
    }

    try {
      const token = await this.getAccessToken();
      const res = await fetch(`${this.apiBaseUrl}/v1/RetrieveTransactionPayment`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: referenceId,
        }),
      });

      if (!res.ok) {
        return {
          verified: false,
          status: 'FAILED',
          amountHTG: 0,
          providerRef: referenceId,
          internalRef: referenceId,
          errorMessage: `Échec de vérification MonCash: HTTP ${res.status}`,
        };
      }

      const data = await res.json() as any;
      const payment = data.payment;
      const isSuccess = payment?.status === 'SUCCESS' || payment?.message === 'successful';

      return {
        verified: isSuccess,
        status: isSuccess ? 'CONFIRMED' : 'FAILED',
        amountHTG: Number(payment?.cost || 0),
        providerRef: payment?.reference || referenceId,
        internalRef: referenceId,
        paidAt: payment?.date,
        rawResponse: data,
      };
    } catch (err: any) {
      return {
        verified: false,
        status: 'FAILED',
        amountHTG: 0,
        providerRef: referenceId,
        internalRef: referenceId,
        errorMessage: err.message || 'Erreur lors de la vérification de la transaction MonCash.',
      };
    }
  }

  async handleWebhook(payload: any, headers?: Record<string, string>): Promise<WebhookProcessingResult> {
    // Digicel MonCash uses redirect / query endpoints rather than webhooks, but returns standard response
    return {
      success: false,
      handled: false,
      message: "MonCash ne fournit pas de webhook entrant standard sur ce canal. La vérification s'opère par interrogation de statut (RetrieveTransactionPayment).",
      httpStatus: 400,
    };
  }
}
