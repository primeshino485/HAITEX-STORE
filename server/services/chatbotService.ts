import { GoogleGenAI } from '@google/genai';
import { db, getProductDeliveryType } from '../db.js';
import { Product, Order, ChatAction, EscalationSummary, ChatbotConfig } from '../../src/types.js';

interface ChatRequestPayload {
  message: string;
  history?: Array<{ sender: 'user' | 'assistant'; text: string }>;
  userId?: string;
  lang?: string;
}

interface ChatResponsePayload {
  reply: string;
  actions: ChatAction[];
  escalation?: EscalationSummary;
  detectedLang?: string;
}

// Helper to detect language
export function detectLanguage(text: string, defaultLang: string = 'ht'): 'ht' | 'fr' | 'en' {
  const lower = ' ' + text.toLowerCase().replace(/[.,!?;:()]/g, ' ') + ' ';

  // French specific words / patterns
  const frenchPatterns = ['\\bbonjour\\b', '\\bcomment\\b', '\\bacheter\\b', '\\bcommande\\b', '\\bcombien\\b', '\\bdisponible\\b', '\\blivraison\\b', '\\btélécharger\\b', '\\btelecharger\\b', '\\bportefeuille\\b', '\\brecharge\\b', '\\bmerci\\b', '\\bproblème\\b', '\\baide\\b', '\\bcompte\\b', '\\bje\\b', '\\bvous\\b', '\\bmon\\b', '\\bma\\b', '\\bmes\\b', '\\bsouhaite\\b'];
  const frenchScore = frenchPatterns.filter(p => new RegExp(p).test(lower)).length;

  // Haitian Creole triggers
  const creolePatterns = ['\\bbonjou\\b', '\\bbonswa\\b', '\\bsak pase\\b', '\\bkijan\\b', '\\bki jan\\b', '\\bkòmand\\b', '\\bkomand\\b', '\\bmwen\\b', '\\bbous\\b', '\\bkòb\\b', '\\bkonbyen\\b', '\\bachte\\b', '\\bkouman\\b', '\\blivrezon\\b', '\\bpwodwi\\b', '\\bèske\\b', '\\beske\\b', '\\bsouple\\b', '\\btanpri\\b', '\\btelechaje\\b', '\\byon\\b', '\\bnan\\b'];
  const creoleScore = creolePatterns.filter(p => new RegExp(p).test(lower)).length;

  // English triggers
  const englishPatterns = ['\\bhello\\b', '\\bhi\\b', '\\bhow\\b', '\\bbuy\\b', '\\border\\b', '\\bstatus\\b', '\\bavailable\\b', '\\bdownload\\b', '\\bwallet\\b', '\\bprice\\b', '\\bproduct\\b', '\\bhelp\\b', '\\bsupport\\b', '\\baccount\\b', '\\bstock\\b', '\\bwhat\\b', '\\bcan\\b', '\\byou\\b'];
  const englishScore = englishPatterns.filter(p => new RegExp(p).test(lower)).length;

  if (creoleScore > frenchScore && creoleScore > englishScore) return 'ht';
  if (frenchScore > creoleScore && frenchScore > englishScore) return 'fr';
  if (englishScore > creoleScore && englishScore > frenchScore) return 'en';

  if (creoleScore > 0) return 'ht';
  if (frenchScore > 0) return 'fr';
  if (englishScore > 0) return 'en';

  if (defaultLang === 'fr' || defaultLang === 'en') return defaultLang;
  return 'ht';
}

export class ChatbotService {
  private static geminiClient: GoogleGenAI | null = null;

  private static getGeminiClient(): GoogleGenAI | null {
    if (!this.geminiClient && process.env.GEMINI_API_KEY) {
      this.geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return this.geminiClient;
  }

  public static async processMessage(payload: ChatRequestPayload): Promise<ChatResponsePayload> {
    const { message, history = [], userId, lang = 'ht' } = payload;
    const settings = db.getSiteSettings();
    const botConfig: ChatbotConfig = db.getChatbotConfig();

    if (!botConfig.enabled) {
      return {
        reply: 'Le service d\'assistance automatique est actuellement désactivé. Veuillez contacter le support direct.',
        actions: [
          {
            type: 'contact_support',
            label: 'Contacter le support',
            payload: { phone: settings.supportPhone || '+509 4385-4650' }
          }
        ]
      };
    }

    const detectedLang = detectLanguage(message, lang);

    // 1. Gather strictly authorized real data
    const activeCategories = db.getCategories(false).map(c => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description || c.subtitle || '',
    }));

    const activeProducts = db.getProducts({ status: 'published' }).map(p => ({
      id: p.id,
      name: p.name,
      categoryId: p.categoryId,
      priceHTG: p.priceHTG,
      stock: p.stock,
      isAvailable: p.stock > 0,
      deliveryType: getProductDeliveryType(p),
      requiresWhatsApp: !!(p.requiresWhatsApp || p.deliveryType === 'MANUAL_WHATSAPP'),
    }));

    // User data (strictly scoped to this user only)
    let userOrders: Order[] = [];
    let userWalletBalance: number | null = null;
    let userLibraryCount = 0;

    if (userId) {
      const user = db.getUserById(userId);
      if (user) {
        userOrders = db.getOrdersForUser(userId).slice(0, 5); // 5 most recent orders
        const wallet = db.getWalletByUserId(userId);
        userWalletBalance = wallet ? wallet.balanceHTG : 0;
        userLibraryCount = db.getCustomerLibrary(userId).length;
      }
    }

    const paymentMethods = db.getPaymentMethods().filter(m => m.isActive).map(m => ({
      name: m.name,
      key: m.key,
      phone: m.phoneNumber,
      mode: m.mode || (m.isManualModeOnly ? 'manual' : 'automatic'),
      instructions: m.instructions
    }));

    // 2. Try Gemini AI if API Key is available
    const gemini = this.getGeminiClient();
    if (gemini) {
      try {
        const response = await this.generateGeminiResponse({
          gemini,
          message,
          history,
          detectedLang,
          botConfig,
          settings,
          activeCategories,
          activeProducts,
          userOrders,
          userWalletBalance,
          userLibraryCount,
          paymentMethods,
          isAuthenticated: !!userId
        });
        if (response) {
          return response;
        }
      } catch {
        // Graceful switch to deterministic response if Gemini API is unreachable, overloaded, or exhausted
      }
    }

    // 3. Deterministic Grounded Fallback
    return this.generateDeterministicResponse({
      message,
      history,
      detectedLang,
      botConfig,
      settings,
      activeCategories,
      activeProducts,
      userOrders,
      userWalletBalance,
      userLibraryCount,
      paymentMethods,
      isAuthenticated: !!userId
    });
  }

  // ==================== GEMINI AI ENGINE ====================
  private static async generateGeminiResponse(params: {
    gemini: GoogleGenAI;
    message: string;
    history: Array<{ sender: 'user' | 'assistant'; text: string }>;
    detectedLang: 'ht' | 'fr' | 'en';
    botConfig: ChatbotConfig;
    settings: any;
    activeCategories: any[];
    activeProducts: any[];
    userOrders: Order[];
    userWalletBalance: number | null;
    userLibraryCount: number;
    paymentMethods: any[];
    isAuthenticated: boolean;
  }): Promise<ChatResponsePayload | null> {
    const {
      gemini,
      message,
      history,
      detectedLang,
      botConfig,
      settings,
      activeCategories,
      activeProducts,
      userOrders,
      userWalletBalance,
      userLibraryCount,
      paymentMethods,
      isAuthenticated
    } = params;

    const supportPhone = botConfig.supportPhone || settings.supportPhone || '+509 4385-4650';
    const siteName = settings.siteName || 'MY STORE';
    const botName = botConfig.botName || `Assistant ${siteName}`;

    // Build system instruction with strict security rules and ground truth
    const systemInstruction = `Tu es "${botName}", l'assistant virtuel intelligent officiel de la boutique en ligne "${siteName}".
Ton rôle est d'aider les clients avec bienveillance, précision et honnêteté.

RÈGLES STRICTES D'ANTI-HALLUCINATION ET DE SÉCURITÉ :
1. Tu dois te baser UNIQUEMENT sur les données réelles fournies ci-dessous. Il est STRICTEMENT INTERDIT d'inventer :
   - une catégorie, un produit ou un service
   - un prix ou un stock
   - une commande
   - un coupon de réduction
   - des identifiants de compte (email, mot de passe)
   - un lien de téléchargement direct
   - des informations d'administration
2. DISPONIBILITÉ ET STOCK :
   - Si le stock d'un produit est égal à 0 ou négatif, dis clairement qu'il est en rupture de stock. Ne dis JAMAIS "Oui, disponible".
   - Si tu n'as pas l'information ou que le produit n'existe pas dans la liste fournie, dis :
     * Kreyòl : "Mwen pa ka konfime enfòmasyon sa a pou kounye a."
     * Français : "Je ne peux pas confirmer cette information pour le moment."
     * English : "I cannot confirm this information right now."
3. MODES DE LIVRAISON :
   - "CODE" : Code numérique délivré directement dans la bibliothèque de l'acheteur ("Mes Produits").
   - "COMPTE" : Compte numérique sécurisé avec identifiants consultables dans "Mes Produits". NE JAMAIS ÉCRIRE DE MOT DE PASSE DANS LA CONVERSATION.
   - "DOWNLOAD_LINK" : Lien de téléchargement sécurisé HTTPS accessible dans "Mes Produits" et sur la confirmation de commande après paiement. Ne donne jamais de lien brut non sécurisé.
   - "MANUEL" : Service manuel traité par l'équipe, notamment via WhatsApp.
4. CATÉGORIES DYNAMIQUES DU CATALOGUE :
   - Les catégories actives du catalogue sont UNIQUEMENT celles listées ci-dessous : ${activeCategories.map(c => c.name).join(', ')}.
   - Si le client demande quelles catégories existent ou ce que vend la boutique, cite fidèlement ces catégories. Ne cite AUCUNE catégorie disparue, renommée ou désactivée.
5. COMPTES CLIENTS & COMMANDES :
   - Utilisateur authentifié : ${isAuthenticated ? 'OUI' : 'NON (Visiteur)'}
   - Si l'utilisateur n'est PAS authentifié et demande ses commandes ou son solde, invite-le poliment à se connecter.
   - Si l'utilisateur est authentifié, tu as accès UNIQUEMENT à ses commandes personnelles ci-dessous. Ne cite jamais les données d'un autre client.
6. PORTEFEUILLE & PAIEMENT :
   - Tout achat se fait via le solde du portefeuille en Gourdes (HTG).
   - Recharges réelles acceptées : ${paymentMethods.map(p => p.name).join(', ')}.
7. LANGUE DE RÉPONSE :
   - Langue détectée : ${detectedLang === 'ht' ? 'Kreyòl Ayisyen' : detectedLang === 'en' ? 'English' : 'Français'}.
   - Réponds TOUJOURS dans la langue utilisée par le client (${detectedLang}).
8. ACTIONS & ESCALADE :
   - Si le client a un litige, un paiement rejeté ou bloqué, ou demande à parler à un humain, propose de contacter le support WhatsApp (${supportPhone}).

CATÉGORIES OFFICIELLES DU CATALOGUE :
${JSON.stringify(activeCategories, null, 2)}

DONNÉES DU CATALOGUE ACTIF :
${JSON.stringify(activeProducts, null, 2)}

MODES DE PAIEMENT DISPONIBLES :
${JSON.stringify(paymentMethods, null, 2)}

DONNÉES DU CLIENT CONNECTÉ :
- Authentifié : ${isAuthenticated}
- Solde portefeuille actuel : ${userWalletBalance !== null ? `${userWalletBalance.toLocaleString()} HTG` : 'Non connecté'}
- Nombre de produits dans la bibliothèque : ${userLibraryCount}
- 5 dernières commandes : ${JSON.stringify(userOrders.map(o => ({
  numero: o.orderNumber,
  date: o.createdAt,
  statut: o.status,
  livraison: o.deliveryType,
  totalHTG: o.totalHTG,
  articles: o.items.map(i => i.productName)
})), null, 2)}

CONNAISSANCES ADDITIONNELLES DE LA BOUTIQUE :
${botConfig.customKnowledge || ''}`;

    // Format conversation history for Gemini
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    
    // Add past turns
    for (const h of history.slice(-6)) {
      contents.push({
        role: h.sender === 'user' ? 'user' : 'model',
        parts: [{ text: h.text }]
      });
    }

    // Add current user prompt
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const callModelWithTimeout = async (modelName: string, timeoutMs: number = 8000) => {
      let timer: NodeJS.Timeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Gemini API call timed out after ${timeoutMs / 1000}s`)), timeoutMs);
      });

      try {
        const res = await Promise.race([
          gemini.models.generateContent({
            model: modelName,
            contents,
            config: {
              systemInstruction,
              temperature: 0.3,
              maxOutputTokens: 500,
            }
          }),
          timeoutPromise
        ]);
        clearTimeout(timer!);
        return res;
      } catch (err) {
        clearTimeout(timer!);
        throw err;
      }
    };

    let response: any = null;
    const candidateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];

    for (const modelName of candidateModels) {
      try {
        response = await callModelWithTimeout(modelName, 8000);
        if (response?.text) break;
      } catch (err: any) {
        // If quota exceeded, overloaded, or timed out, attempt next model if available
        const isQuotaOrOverload =
          err?.message?.includes('429') ||
          err?.message?.includes('resource_exhausted') ||
          err?.message?.includes('overloaded') ||
          err?.message?.includes('timed out');
        if (isQuotaOrOverload && modelName !== candidateModels[candidateModels.length - 1]) {
          continue;
        }
        throw err;
      }
    }

    const replyText = response?.text || '';
    if (!replyText.trim()) return null;

    // Detect actions to return alongside reply
    const actions = this.extractActions(replyText, message, activeProducts, userOrders, supportPhone, isAuthenticated);
    const escalation = this.extractEscalation(message, replyText, userOrders, supportPhone);

    return {
      reply: replyText,
      actions,
      escalation,
      detectedLang
    };
  }

  // ==================== DETERMINISTIC GROUNDED ENGINE ====================
  public static generateDeterministicResponse(params: {
    message: string;
    history: Array<{ sender: 'user' | 'assistant'; text: string }>;
    detectedLang: 'ht' | 'fr' | 'en';
    botConfig: ChatbotConfig;
    settings: any;
    activeCategories?: any[];
    activeProducts: any[];
    userOrders: Order[];
    userWalletBalance: number | null;
    userLibraryCount: number;
    paymentMethods: any[];
    isAuthenticated: boolean;
  }): ChatResponsePayload {
    const {
      message,
      detectedLang,
      botConfig,
      settings,
      activeCategories,
      activeProducts,
      userOrders,
      userWalletBalance,
      paymentMethods,
      isAuthenticated
    } = params;

    const lower = message.toLowerCase().trim();
    const supportPhone = botConfig.supportPhone || settings.supportPhone || '+509 4385-4650';
    const siteName = settings.siteName || 'MY STORE';
    const botName = botConfig.botName || `Assistant ${siteName}`;
    const actions: ChatAction[] = [];
    let escalation: EscalationSummary | undefined = undefined;
    let reply = '';
    const resolvedCats = activeCategories || (db ? db.getCategories(false) : []);
    const catNames = resolvedCats.map((c: any) => c.name).join(', ') || 'Produits numériques';

    // 1. Order Status Tracking
    if (lower.includes('kòmand') || lower.includes('komand') || lower.includes('commande') || lower.includes('order')) {
      if (!isAuthenticated) {
        reply = detectedLang === 'ht'
          ? 'Pou w ka verifye eta kòmand ou yo, tanpri konekte sou kont ou.'
          : detectedLang === 'en'
          ? 'To track your orders, please log into your account.'
          : 'Pour vérifier l\'état de vos commandes, veuillez vous connecter à votre compte.';
        actions.push({ type: 'view_order', label: 'Se connecter' });
      } else if (userOrders.length === 0) {
        reply = detectedLang === 'ht'
          ? 'Ou pa gen okenn kòmand anrejistre pou moman an sou kont ou.'
          : detectedLang === 'en'
          ? 'You do not have any registered orders on your account yet.'
          : 'Vous n\'avez aucune commande enregistrée pour le moment sur votre compte.';
        actions.push({ type: 'view_product', label: 'Voir le catalogue' });
      } else {
        const latest = userOrders[0];
        const statusMapFr: Record<string, string> = {
          COMPLETED: 'Livrée / Complétée',
          PROCESSING: 'En cours de traitement',
          PENDING: 'En attente',
          REFUNDED: 'Remboursée',
          CANCELLED: 'Annulée'
        };
        const statusFr = statusMapFr[latest.status] || latest.status;

        if (detectedLang === 'ht') {
          reply = `Dènye kòmand ou an se #${latest.orderNumber}.\n- Atik : ${latest.items.map(i => i.productName).join(', ')}\n- Montan : ${latest.totalHTG.toLocaleString()} HTG\n- Eta : ${statusFr}.\nOu ka wè tout detay yo dirèkteman nan espas Kòmand ou a.`;
        } else if (detectedLang === 'en') {
          reply = `Your latest order is #${latest.orderNumber}.\n- Items: ${latest.items.map(i => i.productName).join(', ')}\n- Total: ${latest.totalHTG.toLocaleString()} HTG\n- Status: ${statusFr}.\nYou can view full details in your Orders page.`;
        } else {
          reply = `Votre dernière commande est #${latest.orderNumber}.\n- Articles : ${latest.items.map(i => i.productName).join(', ')}\n- Total : ${latest.totalHTG.toLocaleString()} HTG\n- Statut : ${statusFr}.\nVous pouvez consulter tous les détails dans votre espace Commandes.`;
        }
        actions.push({ type: 'view_order', label: 'Voir ma commande' });
      }
    }

    // 2. Specific Catalog Product Inquiry (Direct product match takes priority over generic keywords)
    else if (activeProducts.some(p => lower.includes(p.name.toLowerCase()))) {
      const matched = activeProducts.find(p => lower.includes(p.name.toLowerCase()))!;
      const stockStatus = matched.stock > 0 
        ? (detectedLang === 'ht' ? `Disponib (${matched.stock} an stòk)` : detectedLang === 'en' ? `In stock (${matched.stock} available)` : `Disponible (${matched.stock} en stock)`)
        : (detectedLang === 'ht' ? 'Aktyèlman epwize' : detectedLang === 'en' ? 'Currently out of stock' : 'Actuellement en rupture de stock');

      reply = detectedLang === 'ht'
        ? `Men enfòmasyon sou "${matched.name}" :\n- Pri : ${matched.priceHTG.toLocaleString()} HTG\n- Disponibilite : ${stockStatus}\n- Livrezon : ${matched.deliveryType}`
        : detectedLang === 'en'
        ? `Information for "${matched.name}":\n- Price: ${matched.priceHTG.toLocaleString()} HTG\n- Availability: ${stockStatus}\n- Delivery: ${matched.deliveryType}`
        : `Informations sur "${matched.name}" :\n- Prix : ${matched.priceHTG.toLocaleString()} HTG\n- Disponibilité : ${stockStatus}\n- Mode de livraison : ${matched.deliveryType}`;
      actions.push({ type: 'view_product', label: 'Voir le produit', payload: { productId: matched.id } });
    }

    // 2. Download / Téléchargement
    else if (lower.includes('telechaje') || lower.includes('télécharg') || lower.includes('telecharg') || lower.includes('download')) {
      reply = detectedLang === 'ht'
        ? 'Pou pwodwi ak livrezon pa telechajman (tankou Panel FF oswa APK), bouton telechaje a disponib nan espas "Pwodwi Mwen" touswit apre ou fin peye.'
        : detectedLang === 'en'
        ? 'For digital download products (such as Panel FF or APK), your download button is available in "My Products" right after confirmed payment.'
        : 'Pour les produits avec lien de téléchargement (tels que Panel FF ou APK), le bouton de téléchargement sécurisé est disponible dans "Mes Produits" dès la confirmation du paiement.';
      actions.push({ type: 'open_library', label: 'Ouvrir Mes Produits' });
    }

    // 3. Compte numérique / Account credentials
    else if (lower.includes('compte numerique') || lower.includes('kont dijital') || lower.includes('identifiant') || lower.includes('mot de passe') || lower.includes('password') || lower.includes('netflix') || lower.includes('streaming')) {
      reply = detectedLang === 'ht'
        ? 'Pou pwodwi COMPTE, tout enfòmasyon sekirize yo (imèl ak modpas) disponib nan espas "Pwodwi Mwen". Nou pa janm voye modpas dirèkteman nan chat la pou sekirite ou.'
        : detectedLang === 'en'
        ? 'For digital accounts, your login credentials are securely accessible in "My Products". We never send passwords directly in chat for security.'
        : 'Pour les produits sous mode COMPTE, vos identifiants de connexion sont accessibles en toute sécurité dans votre espace "Mes Produits". Aucun mot de passe n\'est divulgué dans le chat pour protéger votre compte.';
      actions.push({ type: 'open_library', label: 'Ouvrir Mes Produits' });
    }

    // 4. Wallet / Portefeuille / Bous
    else if (lower.includes('portefeuille') || lower.includes('bous') || lower.includes('solde') || lower.includes('wallet') || lower.includes('recharge')) {
      if (isAuthenticated && userWalletBalance !== null) {
        reply = detectedLang === 'ht'
          ? `Solde bous ou kounye a se : ${userWalletBalance.toLocaleString()} HTG. Ou ka klike anba a pou w fè yon nouvo recharge pa NatCash oswa MonCash.`
          : detectedLang === 'en'
          ? `Your current wallet balance is: ${userWalletBalance.toLocaleString()} HTG. You can tap below to recharge via NatCash or MonCash.`
          : `Votre solde de portefeuille actuel est de : ${userWalletBalance.toLocaleString()} HTG. Vous pouvez cliquer ci-dessous pour effectuer une recharge via NatCash ou MonCash.`;
      } else {
        reply = detectedLang === 'ht'
          ? 'Bous la pèmèt ou peye tout acha ou yo an Goud (HTG) fasilman. Ou ka recharge li nenpòt lè avèk NatCash oswa MonCash.'
          : detectedLang === 'en'
          ? 'The wallet lets you pay for all digital products in Haitian Gourdes (HTG). You can recharge anytime using NatCash or MonCash.'
          : 'Le portefeuille vous permet de régler instantanément tous vos achats en Gourdes (HTG). Vous pouvez le recharger facilement avec NatCash ou MonCash.';
      }
      actions.push({ type: 'open_wallet', label: 'Recharger mon portefeuille' });
    }

    // 5. Payment Methods
    else if (lower.includes('payer') || lower.includes('peye') || lower.includes('pay') || lower.includes('natcash') || lower.includes('moncash')) {
      const nat = paymentMethods.find(p => p.key === 'natcash');
      const natNum = nat?.phone || settings.natcashNumber || '43854650';
      reply = detectedLang === 'ht'
        ? `Pou w peye nan boutik la, ou itilize bous HTG ou. Ou ka recharge li pa NatCash (${natNum}) oswa MonCash. Lè ou fin voye kòb la, mete nimewo tranzaksyon an pou resevwa kòb la sou bous ou.`
        : detectedLang === 'en'
        ? `Payments are made via your store wallet in HTG. You can recharge using NatCash (${natNum}) or MonCash. After transfer, submit your transaction reference to fund your balance.`
        : `Les paiements s'effectuent via votre portefeuille en Gourdes (HTG). Vous pouvez le recharger par NatCash (${natNum}) ou MonCash. Après transfert, entrez votre référence de transaction pour créditer votre solde.`;
      actions.push({ type: 'open_wallet', label: 'Recharger mon portefeuille' });
    }

    // 6. How to buy / Comment acheter
    else if (lower.includes('comment acheter') || lower.includes('kijan pou achte') || lower.includes('how to buy')) {
      reply = detectedLang === 'ht'
        ? 'Men etap pou w achte :\n1. Chwazi pwodwi ou vle a nan katalòg la.\n2. Si se yon jwèt (Free Fire, elatriye), mete Player ID ou.\n3. Ajoute nan panyen epi konfime avèk bous ou.\n4. Si w bezwen kòb sou bous la, recharge li pa NatCash.'
        : detectedLang === 'en'
        ? 'Here are the purchase steps:\n1. Choose your item from the catalog.\n2. For gaming top-ups, enter your Player ID.\n3. Add to cart and pay with your wallet.\n4. Recharge your wallet via NatCash if needed.'
        : 'Voici les étapes simples pour acheter :\n1. Choisissez votre produit dans le catalogue.\n2. Pour les jeux (Free Fire, etc.), saisissez votre Player ID.\n3. Ajoutez au panier et confirmez avec votre portefeuille.\n4. Si nécessaire, rechargez votre portefeuille par NatCash.';
      actions.push({ type: 'view_product', label: 'Voir les produits' });
    }

    // 7. Coupons & Promotions
    else if (lower.includes('coupon') || lower.includes('kod') || lower.includes('code promo') || lower.includes('promo') || lower.includes('remise') || lower.includes('discount')) {
      reply = detectedLang === 'ht'
        ? 'Ou ka antre yon kòd koupon valab nan panyen an anvan ou valide peman an. Rabè a ap aplike dirèkteman sou total la si kondisyon yo respekte.'
        : detectedLang === 'en'
        ? 'You can enter a valid coupon code in your cart before checkout. The discount will be applied automatically if conditions are met.'
        : 'Vous pouvez saisir un code promo valide directement dans votre panier avant le paiement. La réduction sera calculée et appliquée immédiatement.';
      actions.push({ type: 'open_coupons', label: 'Voir mes offres' });
    }

    // 8. Categories Inquiry (Dynamic)
    else if (
      lower.includes('catégorie') ||
      lower.includes('categorie') ||
      lower.includes('kategori') ||
      lower.includes('category') ||
      lower.includes('categories')
    ) {
      reply = detectedLang === 'ht'
        ? `Men kategori ki disponib nan boutik la kounye a : ${catNames}. Klike anba a pou w wè tout pwodwi yo.`
        : detectedLang === 'en'
        ? `Here are the categories currently available in the store: ${catNames}. Click below to browse them.`
        : `Voici les catégories actuellement disponibles dans la boutique : ${catNames}. Cliquez ci-dessous pour les explorer.`;
      actions.push({ type: 'view_product', label: 'Voir le catalogue' });
    }

    // 9. Product Search / Inquiries
    else {
      // Look for a matching product first (more specific than an entire category)
      const matched = activeProducts.find(p => lower.includes(p.name.toLowerCase()));
      if (matched) {
        const stockStatus = matched.stock > 0 
          ? (detectedLang === 'ht' ? `Disponib (${matched.stock} an stòk)` : detectedLang === 'en' ? `In stock (${matched.stock} available)` : `Disponible (${matched.stock} en stock)`)
          : (detectedLang === 'ht' ? 'Aktyèlman epwize' : detectedLang === 'en' ? 'Currently out of stock' : 'Actuellement en rupture de stock');

        reply = detectedLang === 'ht'
          ? `Men enfòmasyon sou "${matched.name}" :\n- Pri : ${matched.priceHTG.toLocaleString()} HTG\n- Disponibilite : ${stockStatus}\n- Livrezon : ${matched.deliveryType}`
          : detectedLang === 'en'
          ? `Information for "${matched.name}":\n- Price: ${matched.priceHTG.toLocaleString()} HTG\n- Availability: ${stockStatus}\n- Delivery: ${matched.deliveryType}`
          : `Informations sur "${matched.name}" :\n- Prix : ${matched.priceHTG.toLocaleString()} HTG\n- Disponibilité : ${stockStatus}\n- Mode de livraison : ${matched.deliveryType}`;
        actions.push({ type: 'view_product', label: 'Voir le produit', payload: { productId: matched.id } });
      } else {
        // Look for a matching category directly
        const matchedCategory = resolvedCats.find((c: any) => lower.includes(c.name.toLowerCase()) || (c.slug && lower.includes(c.slug.toLowerCase())));
        if (matchedCategory) {
          const categoryProducts = activeProducts.filter(p => p.categoryId === matchedCategory.id);
          const count = categoryProducts.length;
          reply = detectedLang === 'ht'
            ? `Kategori "${matchedCategory.name}" gen ${count} pwodwi disponib nan boutik la. Klike anba a pou w wè yo.`
            : detectedLang === 'en'
            ? `The "${matchedCategory.name}" category has ${count} available product(s). Click below to view them.`
            : `La catégorie "${matchedCategory.name}" contient ${count} produit(s) disponible(s). Cliquez ci-dessous pour les consulter.`;
          actions.push({ type: 'view_product', label: `Voir ${matchedCategory.name}` });
        } else if (lower.includes('produit') || lower.includes('pwodwi') || lower.includes('product') || lower.includes('katalòg') || lower.includes('catalog')) {
          const count = activeProducts.length;
          reply = detectedLang === 'ht'
            ? `Boutik la gen ${count} pwodwi disponib nan kategori sa yo : ${catNames}. Klike anba a pou w wè tout katalòg la.`
            : detectedLang === 'en'
            ? `The store has ${count} available products across these categories: ${catNames}. Click below to view the catalog.`
            : `La boutique propose ${count} produits actifs répartis dans les catégories : ${catNames}. Cliquez ci-dessous pour voir le catalogue.`;
          actions.push({ type: 'view_product', label: 'Voir le catalogue' });
        } else if (lower.includes('support') || lower.includes('sipò') || lower.includes('sipo') || lower.includes('aide') || lower.includes('problem') || lower.includes('problème') || lower.includes('kontakte')) {
          reply = detectedLang === 'ht'
            ? `Ekip sipò nou an la pou ede w sou WhatsApp nan nimewo ${supportPhone}. Klike sou bouton ki anba a pou w kòmanse diskisyon an dirèkteman.`
            : detectedLang === 'en'
            ? `Our customer support team is available on WhatsApp at ${supportPhone}. Click the button below to reach out directly.`
            : `Notre équipe de support client est disponible sur WhatsApp au ${supportPhone}. Cliquez sur le bouton ci-dessous pour échanger directement.`;
          actions.push({ type: 'contact_support', label: 'Contacter le support', payload: { phone: supportPhone } });
          escalation = this.extractEscalation(message, reply, userOrders, supportPhone);
        } else {
          reply = detectedLang === 'ht'
            ? `Bonjou ! Mwen se ${botName}. Mwen ka ede w jwenn yon pwodwi, verifye yon kòmand, konprann livrezon oswa kontakte sipò a.`
            : detectedLang === 'en'
            ? `Hello! I am ${botName}. I can help you find products, check order status, understand delivery options, or contact support.`
            : `Bonjour ! Je suis ${botName}. Je peux vous aider à trouver un produit, suivre une commande, comprendre nos modes de livraison ou contacter le support.`;
          actions.push({ type: 'view_product', label: 'Voir les produits' });
          actions.push({ type: 'contact_support', label: 'Contacter le support', payload: { phone: supportPhone } });
        }
      }
    }

    return {
      reply,
      actions,
      escalation,
      detectedLang
    };
  }

  // ==================== HELPER METHODS ====================
  private static extractActions(
    replyText: string,
    userMessage: string,
    products: any[],
    orders: Order[],
    supportPhone: string,
    isAuthenticated: boolean
  ): ChatAction[] {
    const actions: ChatAction[] = [];
    const lowerMsg = userMessage.toLowerCase();
    const lowerReply = replyText.toLowerCase();

    // Check if any product is explicitly referenced
    for (const p of products) {
      if (lowerReply.includes(p.name.toLowerCase()) || lowerMsg.includes(p.name.toLowerCase())) {
        if (!actions.some(a => a.type === 'view_product' && a.payload?.productId === p.id)) {
          actions.push({
            type: 'view_product',
            label: `Voir ${p.name}`,
            payload: { productId: p.id }
          });
        }
        if (actions.length >= 2) break;
      }
    }

    // Orders action
    if (lowerMsg.includes('kòmand') || lowerMsg.includes('commande') || lowerMsg.includes('order')) {
      if (isAuthenticated) {
        actions.push({ type: 'view_order', label: 'Voir mes commandes' });
      }
    }

    // Library action
    if (lowerMsg.includes('telechaj') || lowerMsg.includes('download') || lowerMsg.includes('compte') || lowerMsg.includes('kont')) {
      actions.push({ type: 'open_library', label: 'Ouvrir Mes Produits' });
    }

    // Wallet action
    if (lowerMsg.includes('bous') || lowerMsg.includes('portefeuille') || lowerMsg.includes('wallet') || lowerMsg.includes('recharge') || lowerMsg.includes('solde')) {
      actions.push({ type: 'open_wallet', label: 'Mon Portefeuille' });
    }

    // Support action if problem or support mentioned
    if (lowerMsg.includes('support') || lowerMsg.includes('sipò') || lowerMsg.includes('aide') || lowerMsg.includes('bloqué') || lowerMsg.includes('rejeté') || lowerMsg.includes('problem')) {
      actions.push({
        type: 'contact_support',
        label: 'Contacter le support',
        payload: { phone: supportPhone }
      });
    }

    return actions.slice(0, 3);
  }

  private static extractEscalation(
    userMessage: string,
    assistantReply: string,
    orders: Order[],
    supportPhone: string
  ): EscalationSummary | undefined {
    const lower = (userMessage + ' ' + assistantReply).toLowerCase();
    const isEscalationTrigger = 
      lower.includes('support') || 
      lower.includes('sipò') || 
      lower.includes('aide') || 
      lower.includes('problème') || 
      lower.includes('pwoblèm') || 
      lower.includes('bloqué') || 
      lower.includes('rejeté') || 
      lower.includes('humain');

    if (!isEscalationTrigger) return undefined;

    const latestOrder = orders.length > 0 ? orders[0] : undefined;
    const cleanPhone = supportPhone.replace(/[^0-9]/g, '');
    const prefilled = encodeURIComponent(`Bonjour support, j'ai besoin d'aide pour : ${userMessage.slice(0, 100)}`);

    return {
      orderNumber: latestOrder?.orderNumber,
      productName: latestOrder?.items[0]?.productName,
      issueDescription: userMessage.slice(0, 150),
      supportPhone,
      whatsappUrl: `https://wa.me/${cleanPhone}?text=${prefilled}`
    };
  }
}
