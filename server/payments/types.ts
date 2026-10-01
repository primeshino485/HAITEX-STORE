import { RechargeStatus, TransactionType } from '../../src/types.js';

export type PaymentStatus = 
  | 'PENDING' 
  | 'APPROVED' 
  | 'CONFIRMED' 
  | 'REJECTED' 
  | 'FAILED' 
  | 'CANCELLED' 
  | 'EXPIRED';

export interface CreatePaymentInput {
  userId: string;
  userEmail?: string;
  userName?: string;
  amountHTG: number;
  paymentMethod: string;
  customerPhone?: string;
  transcode?: string;
  paymentDate?: string;
  screenshotUrl?: string;
  idempotencyKey?: string;
  customReference?: string;
  returnUrl?: string;
}

export interface PaymentInitResult {
  success: boolean;
  paymentId: string;
  provider: string;
  method: string;
  amountHTG: number;
  feeHTG: number;
  finalAmountHTG: number;
  status: PaymentStatus;
  redirectUrl?: string;
  instructions?: string;
  receiverNumber?: string;
  receiverName?: string;
  reference: string;
  isManual: boolean;
  expiresAt?: string;
  errorMessage?: string;
}

export interface PaymentVerificationResult {
  verified: boolean;
  status: PaymentStatus;
  amountHTG: number;
  providerRef: string;
  internalRef: string;
  paidAt?: string;
  rawResponse?: any;
  errorMessage?: string;
}

export interface WebhookProcessingResult {
  success: boolean;
  handled: boolean;
  alreadyProcessed?: boolean;
  transactionId?: string;
  rechargeId?: string;
  status?: PaymentStatus;
  amountHTG?: number;
  userId?: string;
  message: string;
  httpStatus?: number;
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  amountHTG: number;
  message: string;
}

export interface PaymentProvider {
  readonly id: string;
  readonly name: string;
  readonly supportedMethods: string[];
  isConfigured(): boolean;
  isManual(): boolean;
  createPayment(input: CreatePaymentInput): Promise<PaymentInitResult>;
  verifyPayment(referenceId: string): Promise<PaymentVerificationResult>;
  handleWebhook(payload: any, headers?: Record<string, string>): Promise<WebhookProcessingResult>;
  refundPayment?(referenceId: string, amountHTG: number, reason?: string): Promise<RefundResult>;
}
