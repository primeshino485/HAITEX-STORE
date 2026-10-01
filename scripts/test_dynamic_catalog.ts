import assert from 'assert';
import { db } from '../server/db.js';
import { ChatbotService } from '../server/services/chatbotService.js';
import { Category, SiteSettings } from '../src/types.js';

console.log('====================================================');
console.log('🧪 RUNNING DYNAMIC CATALOG & STORE IDENTITY TEST SUITE');
console.log('====================================================');

async function runDynamicCatalogTests() {
  let passed = 0;
  function testAssert(condition: boolean, msg: string) {
    assert(condition, msg);
    passed++;
    console.log(`✅ [PASS] Test ${passed} : ${msg}`);
  }

  // 1. Initial State Checks
  const initialCategories = db.getCategories();
  testAssert(Array.isArray(initialCategories) && initialCategories.length >= 3, 'Les catégories initiales existent et sont au moins 3');
  
  const gaming = initialCategories.find(c => c.slug === 'gaming');
  testAssert(gaming !== undefined, 'La catégorie Gaming existe par défaut');
  testAssert(Boolean(gaming?.name), 'Nom défini pour Gaming');
  testAssert(gaming?.active === true, 'Gaming est active par défaut');
  testAssert(typeof gaming?.displayOrder === 'number', 'displayOrder défini pour Gaming');

  const streaming = initialCategories.find(c => c.slug === 'streaming');
  testAssert(streaming !== undefined, 'La catégorie Streaming existe par défaut');
  testAssert(streaming?.active === true, 'Streaming est active');

  const panels = initialCategories.find(c => c.slug === 'panels');
  testAssert(panels !== undefined, 'La catégorie Panels existe par défaut');

  // 2. Active filter on getCategories(false) [includeInactive = false]
  const activeCats = db.getCategories(false);
  testAssert(activeCats.every(c => c.active === true), 'getCategories(false) ne retourne que les catégories actives');

  // 3. Products association with categories
  const products = db.getProducts();
  testAssert(products.length > 0, 'Des produits existent dans la base');
  testAssert(products.every(p => Boolean(p.categoryId)), 'Tous les produits sont associés à un categoryId');

  const gamingProducts = products.filter(p => p.categoryId === gaming?.id);
  testAssert(gamingProducts.length > 0, 'Les produits de jeu sont associés à la catégorie Gaming');

  // Cleanup any test categories from previous runs
  const existingTestCats = db.getCategories(false).filter(c => c.slug.includes('gift-cards') || c.name.includes('Cartes Cadeaux'));
  for (const c of existingTestCats) {
    db.data.categories = db.data.categories.filter(x => x.id !== c.id);
  }
  db.save();

  const ts = Date.now();
  const testName = `Cartes Cadeaux ${ts}`;
  const testSlug = `gift-cards-${ts}`;

  // 4. Create a new category
  const newCatPayload = {
    name: testName,
    slug: testSlug,
    subtitle: 'Amazon, Apple, Google Play',
    badge: 'NOUVEAU',
    icon: 'ShoppingBag',
    description: 'Cartes cadeaux numériques livrées instantanément par code sécurisé.',
    active: true,
  };
  const createdCat = db.createCategory(newCatPayload, 'admin@mystore.ht');
  testAssert(Boolean(createdCat.id), 'Nouvelle catégorie créée avec ID unique');
  testAssert(createdCat.slug === testSlug, 'Slug correct attribué');
  testAssert(createdCat.name === testName, 'Nom correctement persisté');
  testAssert(typeof createdCat.displayOrder === 'number' && createdCat.displayOrder > 0, 'displayOrder incrémenté et supérieur à 0');

  // 5. Slug uniqueness enforcement
  let duplicateRejected = false;
  try {
    db.createCategory({
      name: `Autre Nom ${ts}`,
      slug: testSlug, // Colliding slug
      active: true,
    }, 'admin@mystore.ht');
  } catch (err: any) {
    duplicateRejected = err.message.includes('existe déjà');
  }
  testAssert(duplicateRejected, 'Les doublons de slug sont strictement rejetés par la base de données');

  const duplicateCat = db.createCategory({
    name: `Cartes Cadeaux 2 ${ts}`,
    slug: `${testSlug}-2`,
    active: true,
  }, 'admin@mystore.ht');
  testAssert(duplicateCat.slug === `${testSlug}-2`, 'Catégorie secondaire créée avec slug unique');

  // 6. Update Category details
  const updated = db.updateCategory(createdCat.id, {
    subtitle: 'Amazon, Steam, PlayStation Store',
    badge: 'POPULAIRE',
    icon: 'Key',
  }, 'admin@mystore.ht');
  testAssert(updated !== null, 'Mise à jour de catégorie réussie');
  testAssert(updated?.subtitle === 'Amazon, Steam, PlayStation Store', 'Sous-titre mis à jour');
  testAssert(updated?.badge === 'POPULAIRE', 'Badge mis à jour');
  testAssert(updated?.icon === 'Key', 'Icône mise à jour');

  // 7. Product attachment persists across category name update
  const originalGamingName = gaming!.name;
  db.updateCategory(gaming!.id, { name: 'Gaming Elite Pro' }, 'admin@mystore.ht');
  const reloadedGaming = db.getCategoryById(gaming!.id);
  testAssert(reloadedGaming?.name === 'Gaming Elite Pro', 'Renommage de la catégorie pris en compte');
  
  const reloadedGamingProducts = db.getProducts().filter(p => p.categoryId === gaming!.id);
  testAssert(reloadedGamingProducts.length === gamingProducts.length, 'Aucun produit perdu après renommage de la catégorie');
  // Revert back
  db.updateCategory(gaming!.id, { name: originalGamingName }, 'admin@mystore.ht');

  // 8. Visibility toggle (Active / Inactive)
  db.updateCategory(createdCat.id, { active: false }, 'admin@mystore.ht');
  const activeAfterHide = db.getCategories(false);
  testAssert(!activeAfterHide.some(c => c.id === createdCat.id), 'Catégorie masquée exclue de la vue publique getCategories(false)');
  
  const allIncludingHidden = db.getCategories(true);
  testAssert(allIncludingHidden.some(c => c.id === createdCat.id), 'Catégorie masquée conservée dans l\'administration getCategories(true)');

  // Re-enable
  db.updateCategory(createdCat.id, { active: true }, 'admin@mystore.ht');

  // 9. Reorder categories
  const currentCats = db.getCategories(true);
  const reversedIds = [...currentCats].reverse().map(c => c.id);
  const reordered = db.reorderCategories(reversedIds, 'admin@mystore.ht');
  testAssert(reordered[0].id === reversedIds[0], 'Le premier élément réordonné est bien le premier');
  testAssert(reordered[0].displayOrder === 1, 'displayOrder commence à 1');
  testAssert(reordered[reordered.length - 1].displayOrder === reordered.length, 'displayOrder se termine au bon index');

  // 10. Safe deletion rule: Block delete if products exist
  const catWithProducts = db.getCategoryById(gaming!.id)!;
  const countBefore = db.countProductsInCategory(catWithProducts.id);
  testAssert(countBefore > 0, 'La catégorie ciblée contient des produits');

  let deleteBlocked = false;
  try {
    db.deleteCategory(catWithProducts.id, 'admin@mystore.ht');
  } catch (e: any) {
    deleteBlocked = e.message.includes('contient encore');
  }
  testAssert(deleteBlocked, 'Suppression bloquée en toute sécurité car des produits y sont associés');
  testAssert(db.getCategoryById(catWithProducts.id) !== undefined, 'La catégorie n\'a pas été supprimée');

  // 11. Associate a dummy product to createdCat to test reassignment
  const tempProduct = db.saveProduct({
    name: 'Carte Cadeau Test $10',
    description: 'Produit de test réaffectation',
    productType: 'code',
    categoryId: createdCat.id,
    deliveryType: 'CODE',
    priceHTG: 1500,
    stock: 5,
    status: 'published',
  }, 'admin@mystore.ht');
  testAssert(tempProduct.categoryId === createdCat.id, 'Produit temporaire associé à la nouvelle catégorie');
  testAssert(db.countProductsInCategory(createdCat.id) === 1, 'Compteur de produits de la catégorie = 1');

  // 12. Reassign products from createdCat to duplicateCat
  const reassignedCount = db.reassignProductsCategory(createdCat.id, duplicateCat.id, 'admin@mystore.ht');
  testAssert(reassignedCount === 1, '1 produit réaffecté avec succès');
  
  const updatedTempProduct = db.getProducts().find(p => p.id === tempProduct.id);
  testAssert(updatedTempProduct?.categoryId === duplicateCat.id, 'Le produit pointe désormais vers la catégorie cible');
  testAssert(db.countProductsInCategory(createdCat.id) === 0, 'L\'ancienne catégorie a maintenant 0 produits');

  // 13. Delete empty category
  const deleteResult = db.deleteCategory(createdCat.id, 'admin@mystore.ht');
  testAssert(deleteResult.success === true, 'Suppression d\'une catégorie vide autorisée avec succès');
  testAssert(db.getCategoryById(createdCat.id) === undefined, 'Catégorie supprimée de la base de données');

  // Clean up temp product and duplicateCat
  db.data.products = db.data.products.filter(p => p.id !== tempProduct.id);
  db.deleteCategory(duplicateCat.id, 'admin@mystore.ht');

  // 14. Site Settings & Brand Identity Management
  const currentSettings = db.getSiteSettings();
  testAssert(typeof currentSettings.siteName === 'string', 'siteName configuré dans les paramètres');
  testAssert(typeof currentSettings.brandBadge === 'string' || currentSettings.brandBadge === undefined, 'brandBadge supporté');
  testAssert(typeof currentSettings.siteSlogan === 'string' || currentSettings.siteSlogan === undefined, 'siteSlogan supporté');

  const updatedSettings = db.updateSiteSettings({
    siteName: 'GREXUS DIGITAL STORE',
    brandBadge: 'OFFICIEL HAÏTI',
    siteSlogan: 'La référence des recharges et abonnements numériques en Haïti',
    logoUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&q=80',
    faviconUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=32&q=80',
    accentColor: '#06b6d4',
    homepageWelcomeText: 'Bienvenue sur notre plateforme officielle de distribution numérique sécurisée.',
  }, 'admin@mystore.ht');
  testAssert(updatedSettings.siteName === 'GREXUS DIGITAL STORE', 'siteName mis à jour avec persistance');
  testAssert(updatedSettings.brandBadge === 'OFFICIEL HAÏTI', 'brandBadge mis à jour avec persistance');
  testAssert(updatedSettings.siteSlogan === 'La référence des recharges et abonnements numériques en Haïti', 'siteSlogan mis à jour');
  testAssert(updatedSettings.accentColor === '#06b6d4', 'accentColor mis à jour');
  testAssert(updatedSettings.homepageWelcomeText?.includes('Bienvenue'), 'homepageWelcomeText mis à jour');

  // 15. Chatbot Service Dynamic Categories Knowledge
  const chatbotReply = await ChatbotService.processMessage({
    userId: 'guest',
    message: 'Quelles sont les catégories de produits disponibles sur votre boutique ?',
    lang: 'fr',
  });
  testAssert(typeof chatbotReply.reply === 'string' && chatbotReply.reply.length > 10, 'Le chatbot répond avec pertinence');
  testAssert(!chatbotReply.reply.toLowerCase().includes('undefined'), 'Aucune référence indéfinie dans le prompt du chatbot');

  // 16. Non-regression: Verify Core Systems intact
  const users = db.getUsers();
  testAssert(users.some(u => u.role === 'ADMIN'), 'Administrateur présent et configuré');
  testAssert(users.some(u => u.role === 'CUSTOMER'), 'Clients présents et configurés');

  const adminWallets = db.data.wallets;
  testAssert(Array.isArray(adminWallets) && adminWallets.length > 0, 'Système de portefeuilles intact');

  console.log('====================================================');
  console.log(`🎉 ALL ${passed} TESTS PASSED SUCCESSFULLY!`);
  console.log('====================================================');
}

runDynamicCatalogTests().catch(err => {
  console.error('❌ TEST FAILURE:', err);
  process.exit(1);
});
