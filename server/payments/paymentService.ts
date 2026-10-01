import { PaymentProvider, CreatePaymentInput, PaymentInitResult, WebhookProcessingResult } from './types.js';
import { ManualPaymentAdapter } from './adapters/ManualPaymentAdapter.js';
import { MonCashAdapter } from './adapters/MonCashAdapter.js';
import { NatCashAdapter } from './adapters/NatCashAdapter.js';
import { RechargeRequest, RechargeStatus, WalletTransaction } from '../../src/types.js';
import { db } from '../db.js';

export class PaymentService {
  private static instance: PaymentService;
  private providers: Map<string, PaymentProvider> = new Map();
  private processedIdempotencyKeys: Map<string, RechargeRequest> = new Map();
  private processingRechargeIds: Set<string> = new Set<string>();

  private constructor() {
    this.registerProvider(new ManualPaymentAdapter());
    this.registerProvider(new MonCashAdapter());
    this.registerProvider(new NatCashAdapter());
  }

  public static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  public registerProvider(provider: PaymentProvider): void {
    this.providers.set(provider.id.toLowerCase(), provider);
  }

  public getProvider(providerOrMethod: string): PaymentProvider {
    const key = providerOrMethod.toLowerCase().trim();
    if (this.providers.has(key)) {
      return this.providers.get(key)!;
    }

    // Look by supported method
    for (const provider of this.providers.values()) {
      if (provider.supportedMethods.map(m => m.toLowerCase()).includes(key)) {
        return provider;
      }
    }

    // Default fallback to manual adapter
    return this.providers.get('manual')!;
  }

  public listProviders(): Array<{
    id: string;
    name: string;
    isConfigured: boolean;
    isManual: boolean;
    supportedMethods: string[];
  }> {
    return Array.from(this.providers.values()).map(p => ({
      id: p.id,
      name: p.name,
      isConfigured: p.isConfigured(),
      isManual: p.isManual(),
      supportedMethods: p.supportedMethods,
    }));
  }

  /**
   * Calcul serveur strict des frais et montant final (Aucun calcul frontend accepté)
   */
  public calculateFees(amountHTG: number, methodKey: string): { feeHTG: number; finalAmountHTG: number } {
    if (typeof amountHTG !== 'number' || isNaN(amountHTG) || amountHTG <= 0 || !isFinite(amountHTG)) {
      throw new Error('Montant invalide.');
    }

    const roundedAmount = Math.round(amountHTG * 100) / 100;
    const paymentMethodConfig = db.data.paymentMethods.find(m => m.key.toLowerCase() === methodKey.toLowerCase());

    let feeHTG = 0;
    if (paymentMethodConfig?.feePercentage) {
      feeHTG += (roundedAmount * paymentMethodConfig.feePercentage) / 100;
    }
    if (paymentMethodConfig?.fixedFeeHTG) {
      feeHTG += paymentMethodConfig.fixedFeeHTG;
    }

    feeHTG = Math.round(feeHTG * 100) / 100;
    const finalAmountHTG = Math.round((roundedAmount + feeHTG) * 100) / 100;

    return {
      feeHTG,
      finalAmountHTG,
    };
  }

  /**
   * Création d'une demande de recharge sécurisée avec idempotence et anti-doublon
   */
  public async createRecharge(input: CreatePaymentInput): Promise<RechargeRequest> {
    // 1. Validation de l'utilisateur
    if (!input.userId) {
      throw new Error('Utilisateur non spécifié.');
    }
    const user = db.data.users.find(u => u.id === input.userId);
    if (!user) {
      throw new Error('Utilisateur introuvable dans le système.');
    }

    // 2. Validation stricte du montant
    if (typeof input.amountHTG !== 'number' || isNaN(input.amountHTG) || input.amountHTG <= 0 || !isFinite(input.amountHTG)) {
      throw new Error('Le montant de la recharge doit être un nombre strictement positif en Gourdes (HTG).');
    }

    const cleanAmount = Math.round(input.amountHTG * 100) / 100;
    if (cleanAmount < 10) {
      throw new Error('Le montant minimum de recharge est de 10 HTG.');
    }
    if (cleanAmount > 500000) {
      throw new Error('Le montant maximum de recharge par transaction est de 500 000 HTG.');
    }

    // 3. Contrôle d'idempotence
    if (input.idempotencyKey) {
      const cached = this.processedIdempotencyKeys.get(input.idempotencyKey);
      if (cached) {
        return cached;
      }
      const existingInDb = db.data.rechargeRequests.find(r => r.idempotencyKey === input.idempotencyKey);
      if (existingInDb) {
        this.processedIdempotencyKeys.set(input.idempotencyKey, existingInDb);
        return existingInDb;
      }
    }

    // 4. Contrôle d'unicité de la référence/transcode
    const cleanTranscode = (input.transcode || input.customReference || '').trim();
    if (cleanTranscode) {
      const duplicate = db.data.rechargeRequests.find(
        r => r.transcode.toLowerCase() === cleanTranscode.toLowerCase()
      );
      if (duplicate) {
        throw new Error(`Le code de transaction / référence "${cleanTranscode}" a déjà été soumis pour la demande ${duplicate.id}. Chaque transaction doit être unique.`);
      }

      // Vérifier également qu'une transaction de portefeuille n'utilise pas déjà cette référence
      const duplicateTx = db.data.walletTransactions.find(
        t => (t.referenceId?.toLowerCase() === cleanTranscode.toLowerCase() || t.reference?.toLowerCase() === cleanTranscode.toLowerCase())
      );
      if (duplicateTx) {
        throw new Error(`Cette référence de paiement a déjà été créditée sur un portefeuille.`);
      }
    }

    // 5. Calcul serveur des frais
    const { feeHTG, finalAmountHTG } = this.calculateFees(cleanAmount, input.paymentMethod);

    // 6. Résolution du provider
    const provider = this.getProvider(input.paymentMethod);
    const initResult = await provider.createPayment({
      ...input,
      amountHTG: cleanAmount,
    });

    const now = new Date().toISOString();
    const effectiveTranscode = cleanTranscode || initResult.reference;

    // 7. Création de l'enregistrement de recharge
    const recharge: RechargeRequest = {
      id: `rech_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      amountHTG: cleanAmount,
      feeHTG,
      finalAmountHTG,
      paymentMethod: input.paymentMethod.toLowerCase(),
      paymentMethodKey: input.paymentMethod.toLowerCase(),
      provider: provider.id,
      transcode: effectiveTranscode,
      externalReference: initResult.paymentId || effectiveTranscode,
      idempotencyKey: input.idempotencyKey,
      paymentDate: input.paymentDate || now.split('T')[0],
      screenshotUrl: input.screenshotUrl,
      status: 'PENDING', // Reste toujours PENDING jusqu'à confirmation fiable
      isManual: provider.isManual(),
      createdAt: now,
    };

    db.data.rechargeRequests.unshift(recharge);
    await db.save();

    if (input.idempotencyKey) {
      this.processedIdempotencyKeys.set(input.idempotencyKey, recharge);
    }

    return recharge;
  }

  /**
   * Traitement d'un Webhook entrant avec vérification d'authenticité et crédit atomique unique
   */
  public async handleProviderWebhook(
    providerId: string, 
    payload: any, 
    headers?: Record<string, string>
  ): Promise<WebhookProcessingResult> {
    const provider = this.getProvider(providerId);
    const webhookResult = await provider.handleWebhook(payload, headers);

    if (!webhookResult.success || !webhookResult.handled) {
      return webhookResult;
    }

    const { transactionId, amountHTG, userId } = webhookResult;
    if (!transactionId) {
      return {
        success: false,
        handled: false,
        message: 'Identifiant de transaction manquant.',
        httpStatus: 400,
      };
    }

    // 1. Vérifier si le webhook a déjà été traité (idempotence)
    if (db.data.processedWebhooks.includes(transactionId)) {
      return {
        success: true,
        handled: true,
        alreadyProcessed: true,
        transactionId,
        message: 'Webhook déjà traité précédemment (idempotence).',
        httpStatus: 200,
      };
    }

    // 2. Retrouver la demande de recharge correspondante
    let recharge = db.data.rechargeRequests.find(
      r => r.transcode.toLowerCase() === transactionId.toLowerCase() ||
           r.externalReference?.toLowerCase() === transactionId.toLowerCase()
    );

    // 3. Si non trouvée mais que userId et montant sont fournis, créer ou retrouver
    const effectiveUserId = recharge?.userId || userId;
    const effectiveAmount = recharge?.amountHTG || amountHTG;

    if (!effectiveUserId || !effectiveAmount || effectiveAmount <= 0) {
      return {
        success: false,
        handled: false,
        message: 'Impossible de résoudre le client ou le montant pour ce webhook.',
        httpStatus: 400,
      };
    }

    // 4. Vérifier si déjà confirmée
    if (recharge && (recharge.status === 'CONFIRMED' || recharge.status === 'APPROVED')) {
      db.data.processedWebhooks.push(transactionId);
      await db.save();
      return {
        success: true,
        handled: true,
        alreadyProcessed: true,
        transactionId,
        message: 'Recharge déjà confirmée.',
        httpStatus: 200,
      };
    }

    // 5. Créditer atomiquement le portefeuille une seule fois
    const now = new Date().toISOString();
    await db.creditWallet(
      effectiveUserId, 
      effectiveAmount, 
      transactionId, 
      `Recharge confirmée par webhook ${provider.name} (Réf: ${transactionId})`,
      'RECHARGE'
    );

    // 6. Mettre à jour la recharge
    if (recharge) {
      recharge.status = 'CONFIRMED';
      recharge.confirmedAt = now;
      recharge.processedAt = now;
      recharge.adminNote = `Confirmé automatiquement par webhook ${provider.name}`;
    }

    // 7. Enregistrer le webhook traité
    db.data.processedWebhooks.push(transactionId);
    await db.save();

    return {
      success: true,
      handled: true,
      transactionId,
      amountHTG: effectiveAmount,
      userId: effectiveUserId,
      rechargeId: recharge?.id,
      status: 'CONFIRMED',
      message: 'Portefeuille crédité avec succès via webhook.',
      httpStatus: 200,
    };
  }

  /**
   * Approbation manuelle par l'Administrateur (Atomique, idempotent, anti-double crédit)
   */
  public async approveManualRecharge(
    rechargeId: string, 
    adminEmail: string, 
    note?: string
  ): Promise<RechargeRequest> {
    if (!rechargeId || typeof rechargeId !== 'string') {
      throw new Error('ID de recharge manquant ou invalide.');
    }

    // Protection anti-concurrence : empêche deux requêtes simultanées sur la même recharge
    if (this.processingRechargeIds.has(rechargeId)) {
      throw new Error('Cette demande de recharge est déjà en cours de traitement. Double approbation bloquée.');
    }
    this.processingRechargeIds.add(rechargeId);

    try {
      const recharge = db.data.rechargeRequests.find(r => r.id === rechargeId);
      if (!recharge) {
        throw new Error(`Demande de recharge "${rechargeId}" introuvable.`);
      }

      const statusBefore = recharge.status;
      console.log(`[ADMIN_RECHARGE_DEBUG] ID: ${rechargeId} | Client: ${recharge.userEmail} | Statut initial: ${statusBefore} | Action: APPROBATION | Admin: ${adminEmail}`);

      // Seules les demandes PENDING peuvent être approuvées
      if (recharge.status !== 'PENDING') {
        throw new Error(`Impossible d'approuver : cette recharge a déjà été traitée (statut actuel: "${recharge.status}"). Une recharge confirmée ou refusée ne peut plus être modifiée.`);
      }

      // Vérifier qu'aucun crédit n'a déjà eu lieu pour cette référence (transcode)
      const cleanTranscode = (recharge.transcode || '').trim().toLowerCase();
      const alreadyCredited = db.data.walletTransactions.some(
        t => {
          const ref = (t.referenceId || t.reference || '').trim().toLowerCase();
          return ref === cleanTranscode && (t.type === 'RECHARGE' || t.type === 'DEPOSIT');
        }
      );
      if (alreadyCredited) {
        throw new Error(`Erreur de sécurité : cette transaction (${recharge.transcode}) a déjà été créditée sur un portefeuille. Double crédit bloqué.`);
      }

      const amountToCredit = Number(recharge.amountHTG);
      if (isNaN(amountToCredit) || amountToCredit <= 0) {
        throw new Error(`Montant de recharge invalide: ${recharge.amountHTG} HTG.`);
      }

      const now = new Date().toISOString();
      const methodTitle = (recharge.paymentMethod || recharge.paymentMethodKey || 'NATCASH').toUpperCase();

      // Créditer le portefeuille atomiquement
      const tx = db.creditWallet(
        recharge.userId,
        amountToCredit,
        recharge.transcode,
        `Recharge ${methodTitle} validée par Admin (${recharge.transcode})`,
        'RECHARGE',
        {
          provider: recharge.provider || recharge.paymentMethod,
          paymentMethod: recharge.paymentMethod,
          externalReference: recharge.externalReference || recharge.transcode,
          idempotencyKey: recharge.idempotencyKey,
        }
      );

      // Mettre à jour l'enregistrement de recharge
      recharge.status = 'CONFIRMED';
      recharge.adminNote = note ? note.trim() : `Approuvé et validé par l'administrateur (${adminEmail})`;
      recharge.processedAt = now;
      recharge.processedByAdmin = adminEmail;
      recharge.confirmedAt = now;

      // Journaliser l'activité administrative dans l'audit trail
      db.logActivity(
        adminEmail,
        'VALIDATION_RECHARGE',
        `Recharge ${methodTitle} ${recharge.transcode}`,
        `Validation et crédit de ${amountToCredit} HTG sur le portefeuille de ${recharge.userEmail} (Tx: ${tx.id})`
      );

      await db.save();

      // Notifier le client
      db.addNotification(
        recharge.userId,
        'Recharge de portefeuille confirmée !',
        `Votre recharge de ${amountToCredit.toLocaleString()} HTG par ${methodTitle} a été validée. Votre solde a été mis à jour.`,
        'WALLET'
      );

      console.log(`[ADMIN_RECHARGE_DEBUG] SUCCÈS APPROBATION | ID: ${rechargeId} | Montant crédité: +${amountToCredit} HTG | Statut final: ${recharge.status} | Nouveau solde portefeuille: OK`);
      return recharge;
    } finally {
      this.processingRechargeIds.delete(rechargeId);
    }
  }

  /**
   * Refus d'une recharge par l'Administrateur
   */
  public async rejectManualRecharge(
    rechargeId: string, 
    adminEmail: string, 
    reason?: string
  ): Promise<RechargeRequest> {
    if (!rechargeId || typeof rechargeId !== 'string') {
      throw new Error('ID de recharge manquant ou invalide.');
    }

    if (this.processingRechargeIds.has(rechargeId)) {
      throw new Error('Cette demande de recharge est déjà en cours de traitement.');
    }
    this.processingRechargeIds.add(rechargeId);

    try {
      const recharge = db.data.rechargeRequests.find(r => r.id === rechargeId);
      if (!recharge) {
        throw new Error(`Demande de recharge "${rechargeId}" introuvable.`);
      }

      const statusBefore = recharge.status;
      console.log(`[ADMIN_RECHARGE_DEBUG] ID: ${rechargeId} | Client: ${recharge.userEmail} | Statut initial: ${statusBefore} | Action: REJET | Admin: ${adminEmail}`);

      if (recharge.status !== 'PENDING') {
        throw new Error(`Impossible de refuser : cette demande a déjà été traitée (statut actuel: "${recharge.status}").`);
      }

      const now = new Date().toISOString();
      const methodTitle = (recharge.paymentMethod || recharge.paymentMethodKey || 'NATCASH').toUpperCase();
      const cleanReason = reason ? reason.trim() : `Refusé par l'administrateur (${adminEmail})`;

      recharge.status = 'REJECTED';
      recharge.adminNote = cleanReason;
      recharge.processedAt = now;
      recharge.processedByAdmin = adminEmail;

      // Journaliser l'activité administrative (Audit Log)
      db.logActivity(
        adminEmail,
        'REJET_RECHARGE',
        `Recharge ${methodTitle} ${recharge.transcode}`,
        `Refus de la demande de recharge de ${recharge.amountHTG} HTG pour ${recharge.userEmail}. Motif: ${cleanReason}`
      );

      await db.save();

      // Notifier le client du refus (aucun crédit de portefeuille)
      db.addNotification(
        recharge.userId,
        'Demande de recharge refusée',
        `Votre demande de recharge de ${recharge.amountHTG.toLocaleString()} HTG a été rejetée. Motif : ${cleanReason}.`,
        'WALLET'
      );

      console.log(`[ADMIN_RECHARGE_DEBUG] SUCCÈS REJET | ID: ${rechargeId} | Aucun crédit portefeuille | Statut final: ${recharge.status}`);
      return recharge;
    } finally {
      this.processingRechargeIds.delete(rechargeId);
    }
  }
}

export const paymentService = PaymentService.getInstance();
