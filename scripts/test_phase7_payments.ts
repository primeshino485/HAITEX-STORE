import assert from 'assert';
import { db } from '../server/db.js';
import { paymentService } from '../server/payments/paymentService.js';
import { NatCashAdapter } from '../server/payments/adapters/NatCashAdapter.js';
import { MonCashAdapter } from '../server/payments/adapters/MonCashAdapter.js';

console.log('====================================================');
console.log('🧪 RUNNING PHASE 7 REAL PAYMENTS & WALLET TEST SUITE');
console.log('====================================================');

async function runPhase7Tests() {
  let passed = 0;
  function testAssert(condition: boolean, msg: string) {
    assert(condition, msg);
    passed++;
    console.log(`✅ [PASS] Assert ${passed} : ${msg}`);
  }

  // Set up test customer
  const testUserId = `usr-test-p7-${Date.now()}`;
  const testEmail = `customer-${Date.now()}@mystore.ht`;
  db.data.users.push({
    id: testUserId,
    email: testEmail,
    name: 'Client Test Phase 7',
    role: 'CUSTOMER',
    status: 'active',
    passwordHash: 'hash123',
    createdAt: new Date().toISOString()
  });
  const wallet = db.getWalletByUserId(testUserId);
  testAssert(wallet.balanceHTG === 0, 'Nouveau portefeuille initialisé avec solde 0 HTG');

  // 1. Adapter & Providers Registration Check
  const providers = paymentService.listProviders();
  testAssert(providers.some(p => p.id === 'natcash'), 'Fournisseur NatCash enregistré dans le PaymentService');
  testAssert(providers.some(p => p.id === 'moncash'), 'Fournisseur MonCash enregistré dans le PaymentService');

  // 2. Server-side Fee Calculation (No client-side fee calculations allowed)
  const calc1 = paymentService.calculateFees(1000, 'moncash');
  testAssert(typeof calc1.feeHTG === 'number' && typeof calc1.finalAmountHTG === 'number', 'Calcul serveur des frais exécuté');
  testAssert(calc1.finalAmountHTG >= 1000, 'Montant final calculé avec intégrité');

  // 4. Invalid amounts rejected
  let invalidAmountRejected = false;
  try {
    paymentService.calculateFees(-50, 'moncash');
  } catch (e) {
    invalidAmountRejected = true;
  }
  testAssert(invalidAmountRejected, 'Montant négatif rejeté par le calcul serveur');

  // 5. Create Recharge via PaymentService
  const transcode1 = `TRX-${Date.now()}-A1`;
  const recharge1 = await paymentService.createRecharge({
    userId: testUserId,
    amountHTG: 500,
    paymentMethod: 'natcash',
    transcode: transcode1,
    idempotencyKey: `idem-p7-${Date.now()}-1`
  });
  testAssert(recharge1.status === 'PENDING', 'Nouvelle demande de recharge au statut PENDING');
  testAssert(recharge1.amountHTG === 500, 'Montant exact enregistré (500 HTG)');
  testAssert(wallet.balanceHTG === 0, 'Solde inchangé (aucun crédit avant approbation)');

  // 6. Idempotency on Recharge Creation (same idempotencyKey returns existing)
  const recharge1Retry = await paymentService.createRecharge({
    userId: testUserId,
    amountHTG: 500,
    paymentMethod: 'natcash',
    transcode: transcode1,
    idempotencyKey: recharge1.idempotencyKey
  });
  testAssert(recharge1Retry.id === recharge1.id, 'Idempotence : même demande retournée sur double-soumission');

  // 7. Duplicate transcode rejection
  let duplicateRejected = false;
  try {
    await paymentService.createRecharge({
      userId: testUserId,
      amountHTG: 300,
      paymentMethod: 'natcash',
      transcode: transcode1, // same transcode
      idempotencyKey: `idem-other-${Date.now()}`
    });
  } catch (e: any) {
    duplicateRejected = e.message.includes('déjà été soumis');
  }
  testAssert(duplicateRejected, 'Anti-doublon strict : transcode déjà utilisé rejeté');

  // 8. Admin Approval & Atomic Wallet Credit
  const approved = await paymentService.approveManualRecharge(recharge1.id, 'admin@mystore.ht', 'Vérifié reçu sur 43854650');
  testAssert(approved.status === 'CONFIRMED', 'Recharge passe au statut CONFIRMED');
  const walletAfterApproval = db.getWalletByUserId(testUserId);
  testAssert(walletAfterApproval.balanceHTG === 500, 'Portefeuille crédité exactement de +500 HTG');

  // 9. Prevent Double-Credit / Re-approval
  let doubleCreditPrevented = false;
  try {
    await paymentService.approveManualRecharge(recharge1.id, 'admin@mystore.ht');
  } catch (e: any) {
    doubleCreditPrevented = e.message.includes('Impossible d\'approuver');
  }
  testAssert(doubleCreditPrevented, 'Sécurité anti-double crédit : recharge déjà confirmée ne peut être ré-approuvée');
  testAssert(db.getWalletByUserId(testUserId).balanceHTG === 500, 'Solde reste strictement à 500 HTG');

  // 10. Admin Rejection
  const transcode2 = `TRX-${Date.now()}-B2`;
  const recharge2 = await paymentService.createRecharge({
    userId: testUserId,
    amountHTG: 1000,
    paymentMethod: 'moncash',
    transcode: transcode2,
  });
  const rejected = await paymentService.rejectManualRecharge(recharge2.id, 'admin@mystore.ht', 'Transcode introuvable');
  testAssert(rejected.status === 'REJECTED', 'Recharge refusée avec statut REJECTED');
  testAssert(db.getWalletByUserId(testUserId).balanceHTG === 500, 'Solde inchangé après rejet');

  // 11. Webhook processing with idempotency
  const webhookTxId = `WH-NC-${Date.now()}`;
  const webhookResult1 = await paymentService.handleProviderWebhook('natcash', {
    transactionId: webhookTxId,
    amount: 250,
    currency: 'HTG',
    userId: testUserId
  });
  testAssert(webhookResult1.success === true, 'Webhook NatCash traité avec succès');
  testAssert(db.getWalletByUserId(testUserId).balanceHTG === 750, 'Portefeuille crédité de +250 HTG via webhook (Total 750 HTG)');

  // 12. Webhook duplicate blocked (Idempotency)
  const webhookResult2 = await paymentService.handleProviderWebhook('natcash', {
    transactionId: webhookTxId,
    amount: 250,
    currency: 'HTG',
    userId: testUserId
  });
  testAssert(webhookResult2.alreadyProcessed === true, 'Webhook duplicate reconnu et bloqué sans double-crédit');
  testAssert(db.getWalletByUserId(testUserId).balanceHTG === 750, 'Solde reste strictement à 750 HTG après webhook dupliqué');

  // 13. Atomic Debit on Wallet
  const debitTx = db.debitWallet(testUserId, 200, 'ord-test-p7-1', 'Achat test');
  testAssert(debitTx.amountHTG === 200, 'Débit atomique de 200 HTG exécuté');
  testAssert(db.getWalletByUserId(testUserId).balanceHTG === 550, 'Solde restant exact (550 HTG)');

  // 14. Insufficient balance debit blocked
  let debitBlocked = false;
  try {
    db.debitWallet(testUserId, 1000, 'ord-fail', 'Achat trop cher');
  } catch (e: any) {
    debitBlocked = e.message.includes('Solde insuffisant');
  }
  testAssert(debitBlocked, 'Débit bloqué avec message explicite en cas de solde insuffisant');
  testAssert(db.getWalletByUserId(testUserId).balanceHTG === 550, 'Solde préservé sans modification');

  console.log('====================================================');
  console.log(`🏁 PHASE 7 TEST RESULTS: ${passed}/${passed} PASSED (100%)`);
  console.log('====================================================');
}

runPhase7Tests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
