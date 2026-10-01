import { BasePaymentProvider } from '../PaymentProvider.js';
import { 
  CreatePaymentInput, 
  PaymentInitResult, 
  PaymentVerificationResult, 
  WebhookProcessingResult 
} from '../types.js';

export class ManualPaymentAdapter extends BasePaymentProvider {
  readonly id = 'manual';
  readonly name = 'Paiement Manuel (MonCash & NatCash Haïti)';
  readonly supportedMethods = ['moncash', 'natcash', 'manual'];

  isConfigured(): boolean {
    return true;
  }

  isManual(): boolean {
    return true;
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentInitResult> {
    const isMoncash = input.paymentMethod.toLowerCase().includes('moncash');
    const receiverNumber = isMoncash ? '34584287' : '43854650';
    const receiverName = isMoncash ? 'carlentz' : 'My Store Digital';
    const operator = isMoncash ? 'Digicel MonCash' : 'Natcom NatCash';

    const reference = input.transcode || input.customReference || `MANUAL-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const instructions = isMoncash
      ? `Effectuez un transfert MonCash de ${input.amountHTG} HTG vers le numéro ${receiverNumber} (Bénéficiaire : ${receiverName}). Notez le code de transaction / transcode reçu par SMS et soumettez la demande.`
      : `Effectuez un transfert NatCash de ${input.amountHTG} HTG vers le numéro ${receiverNumber} (Bénéficiaire : ${receiverName}). Saisissez la référence du transfert dans le formulaire.`;

    return {
      success: true,
      paymentId: `pay_man_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      provider: this.id,
      method: input.paymentMethod,
      amountHTG: input.amountHTG,
      feeHTG: 0,
      finalAmountHTG: input.amountHTG,
      status: 'PENDING',
      instructions,
      receiverNumber,
      receiverName,
      reference,
      isManual: true,
    };
  }

  async verifyPayment(referenceId: string): Promise<PaymentVerificationResult> {
    return {
      verified: false,
      status: 'PENDING',
      amountHTG: 0,
      providerRef: referenceId,
      internalRef: referenceId,
      errorMessage: 'Le mode manuel requiert la vérification humaine par un administrateur.',
    };
  }

  async handleWebhook(payload: any, headers?: Record<string, string>): Promise<WebhookProcessingResult> {
    return {
      success: false,
      handled: false,
      message: 'Les paiements manuels ne possèdent pas de webhook automatisé.',
      httpStatus: 400,
    };
  }
}
