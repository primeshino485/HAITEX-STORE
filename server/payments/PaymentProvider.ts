import { 
  PaymentProvider, 
  CreatePaymentInput, 
  PaymentInitResult, 
  PaymentVerificationResult, 
  WebhookProcessingResult, 
  RefundResult 
} from './types.js';

export abstract class BasePaymentProvider implements PaymentProvider {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly supportedMethods: string[];

  abstract isConfigured(): boolean;
  abstract isManual(): boolean;

  abstract createPayment(input: CreatePaymentInput): Promise<PaymentInitResult>;
  abstract verifyPayment(referenceId: string): Promise<PaymentVerificationResult>;
  abstract handleWebhook(payload: any, headers?: Record<string, string>): Promise<WebhookProcessingResult>;

  async refundPayment?(referenceId: string, amountHTG: number, reason?: string): Promise<RefundResult> {
    return {
      success: false,
      refundId: '',
      amountHTG,
      message: `Le remboursement automatique n'est pas supporté par le fournisseur ${this.name}. Utilisez le remboursement manuel administrateur.`,
    };
  }
}
