/**
 * Test Suite: Phase 6 - Digital Delivery & Advanced Catalog Management
 */
import { db } from '../server/db.js';

async function runPhase6Tests() {
  console.log('====================================================');
  console.log('🧪 RUNNING PHASE 6 DIGITAL DELIVERY & CATALOG SUITE');
  console.log('====================================================');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, desc: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] Assert ${total} : ${desc}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] Assert ${total} : ${desc}`);
      process.exit(1);
    }
  }

  // Ensure test customer user
  const customerId = 'usr-test-phase6-customer';
  let existingCust = db.getUserById(customerId);
  if (!existingCust) {
    (db as any).data.users.push({
      id: customerId,
      email: 'phase6@test.ht',
      name: 'Client Phase 6',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      phone: '+50934584287',
      isEmailVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  // Ensure rich wallet balance
  let wallet = db.getWalletByUserId(customerId);
  wallet.balanceHTG = 50000;

  // Ensure clean test data
  const p1Id = 'prod-phase6-instant-test';
  const p2Id = 'prod-phase6-whatsapp-test';
  (db as any).data.digitalCodes = (db as any).data.digitalCodes.filter((c: any) => c.productId !== p1Id && c.productId !== p2Id);
  (db as any).data.products = (db as any).data.products.filter((p: any) => p.id !== p1Id && p.id !== p2Id);

  // ----------------------------------------------------
  // TEST 1: Save product with Phase 6 fields
  // ----------------------------------------------------
  const savedP1 = db.saveProduct({
    id: p1Id,
    name: 'Netflix 4K Instant Ultra',
    description: 'Abonnement Netflix 1 mois',
    priceHTG: 1200,
    originalPriceHTG: 1500,
    categoryId: 'cat-streaming',
    productType: 'code',
    deliveryType: 'DIGITAL_INSTANT',
    processingTime: 'Instantané (0 - 5 min)',
    customerInstructions: 'Activez le code sur netflix.com/redeem',
    adminInstructions: 'Fournisseur A - Compte Premium',
    lowStockThreshold: 3,
    status: 'published',
    requiresWhatsApp: false,
    requiresPlayerIdVerification: false,
    stock: 0
  }, 'admin@mystore.ht');

  assert(savedP1.deliveryType === 'DIGITAL_INSTANT', 'Product has deliveryType = DIGITAL_INSTANT');
  assert(savedP1.originalPriceHTG === 1500, 'Product has originalPriceHTG = 1500');
  assert(savedP1.lowStockThreshold === 3, 'Product has lowStockThreshold = 3');
  assert(savedP1.customerInstructions === 'Activez le code sur netflix.com/redeem', 'Product has customerInstructions');
  assert(savedP1.adminInstructions === 'Fournisseur A - Compte Premium', 'Product has adminInstructions');

  // ----------------------------------------------------
  // TEST 2: Preview batch codes (duplicate detection)
  // ----------------------------------------------------
  const preview = db.previewDigitalCodes(p1Id, [
    'NETFLIX-TEST-001',
    'NETFLIX-TEST-002',
    'NETFLIX-TEST-001', // duplicate in batch
    'NETFLIX-TEST-003',
    '  ' // empty
  ]);

  assert(preview.validCount === 3, 'Preview identifies 3 valid unique codes');
  assert(preview.duplicateCount === 1, 'Preview identifies 1 duplicate code inside the batch');
  assert(preview.toAdd.includes('NETFLIX-TEST-001'), 'Preview contains unique codes');

  // ----------------------------------------------------
  // TEST 3: Add batch codes & sync stock
  // ----------------------------------------------------
  const addResult = db.addDigitalCodes(p1Id, [
    'NETFLIX-TEST-001',
    'NETFLIX-TEST-002',
    'NETFLIX-TEST-003',
    'NETFLIX-TEST-004'
  ], 'admin@mystore.ht');

  assert(addResult.addedCount === 4, 'Successfully added 4 digital codes');
  assert(addResult.newStock === 4, 'Stock automatically synchronized to 4');

  const loadedCodes = db.getCodesForProduct(p1Id);
  assert(loadedCodes.length === 4, 'Loaded 4 codes from inventory');
  assert(loadedCodes.every(c => !c.isUsed), 'All newly added codes are marked unused');

  // ----------------------------------------------------
  // TEST 4: Second preview detects codes already in database
  // ----------------------------------------------------
  const preview2 = db.previewDigitalCodes(p1Id, [
    'NETFLIX-TEST-001', // already in DB
    'NETFLIX-TEST-005'  // new
  ]);

  assert(preview2.existingCount === 1, 'Preview detects 1 code already in database');
  assert(preview2.validCount === 1, 'Preview only accepts the 1 new code');
  assert(preview2.toAdd[0] === 'NETFLIX-TEST-005', 'Valid code is NETFLIX-TEST-005');

  // ----------------------------------------------------
  // TEST 5: DIGITAL_INSTANT Checkout consumes digital code
  // ----------------------------------------------------
  const checkoutInstant = db.executeAtomicCheckout(
    customerId,
    [{ productId: p1Id, quantity: 1 }],
    undefined,
    'idem-phase6-test-instant-1'
  );

  assert(checkoutInstant.order.status === 'COMPLETED', 'DIGITAL_INSTANT order status is COMPLETED');
  assert(checkoutInstant.libraryItems.length === 1, '1 library item created for customer');
  assert(!!checkoutInstant.libraryItems[0].digitalCode && checkoutInstant.libraryItems[0].digitalCode.startsWith('NETFLIX-TEST-'), 'Delivered valid Netflix code');

  const updatedP1 = db.getProductById(p1Id);
  assert(updatedP1?.stock === 3, 'Product stock decremented to 3');

  const codesAfter = db.getCodesForProduct(p1Id);
  const usedCode = codesAfter.find(c => c.code === checkoutInstant.libraryItems[0].digitalCode);
  assert(usedCode?.isUsed === true, 'Delivered code is marked as used');
  assert(usedCode?.usedAtOrderId === checkoutInstant.order.id, 'Code records order ID');

  // ----------------------------------------------------
  // TEST 6: MANUAL_WHATSAPP Product & Checkout
  // ----------------------------------------------------
  db.saveProduct({
    id: p2Id,
    name: 'Recharge Diamants Blood Strike Manuel',
    description: 'Recharge manuelle par agent sur WhatsApp',
    priceHTG: 800,
    categoryId: 'cat-gaming',
    productType: 'code',
    deliveryType: 'MANUAL_WHATSAPP',
    processingTime: '15 à 30 minutes',
    customerInstructions: 'Envoyez la capture de votre profil après achat',
    stock: 10,
    status: 'published',
    requiresWhatsApp: true,
    requiresPlayerIdVerification: false
  }, 'admin@mystore.ht');

  const checkoutWhatsApp = db.executeAtomicCheckout(
    customerId,
    [{ productId: p2Id, quantity: 1, customerWhatsApp: '+50934584287' }],
    '+50934584287',
    'idem-phase6-test-whatsapp-1'
  );

  assert(checkoutWhatsApp.order.status === 'PROCESSING', 'MANUAL_WHATSAPP order status is PROCESSING');
  assert(checkoutWhatsApp.order.customerWhatsApp === '+50934584287', 'Order contains normalized customer WhatsApp number');
  assert(!checkoutWhatsApp.libraryItems[0].digitalCode, 'MANUAL_WHATSAPP order does not consume digital codes');

  const updatedP2 = db.getProductById(p2Id);
  assert(updatedP2?.stock === 9, 'Stock decremented for manual product');

  console.log('====================================================');
  console.log(`🏁 PHASE 6 TEST RESULTS: ${passed}/${total} PASSED (100%)`);
  console.log('====================================================');
}

runPhase6Tests().catch(err => {
  console.error('Phase 6 Test failed:', err);
  process.exit(1);
});
