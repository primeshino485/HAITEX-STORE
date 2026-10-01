import fs from 'fs';
import path from 'path';
import {
  User,
  Wallet,
  WalletTransaction,
  TransactionType,
  Category,
  PlatformOrGame,
  Product,
  Media,
  DigitalCode,
  Order,
  OrderStatus,
  OrderItem,
  CustomerLibraryItem,
  RechargeRequest,
  PaymentMethodConfig,
  SiteSettings,
  AppNotification,
  ActivityLog,
  AdminStats,
  CartItem,
  DeliveryType,
  OrderDeliveryType,
  OrderStatusHistory,
  OrderAdminNote,
  LoyaltyTier,
  LoyaltyReward,
  LoyaltyConfig,
  CustomerLoyaltyStatus,
  CouponValidationResult,
  PromotionalCoupon,
  PromotionalCouponUsage,
  PromotionalCouponStatus,
  CouponType,
  PromotionalPoster,
  PosterTemplateType,
  PosterFormat,
  PosterSnapshotCoupon,
  PromotionalPosterContent,
  DigitalAccount,
  DigitalAccountStatus,
  DeliveredAccountInfo,
  UserPreferences,
  ThemePreference,
  Language,
  CommunicationPreferences,
  ChatbotConfig,
} from '../src/types.js';
import {
  INITIAL_CATEGORIES,
  INITIAL_PLATFORMS,
  INITIAL_PRODUCTS,
  generateInitialCodes,
  INITIAL_SITE_SETTINGS,
  INITIAL_PAYMENT_METHODS,
} from './seedData.js';
import { hashPassword, verifyPassword } from './auth.js';
import { gameVerificationService } from './services/gameVerification.js';
import { normalizeWhatsAppNumber } from '../src/lib/phoneUtils.js';
import { isValidHttpsDownloadUrl } from '../src/lib/urlUtils.js';
import {
  encryptAccountPassword,
  decryptAccountPassword,
  maskPassword,
} from './crypto.js';

export function getProductDeliveryType(product: Product): 'CODE' | 'COMPTE' | 'DOWNLOAD_LINK' | 'MANUEL' {
  if (product.deliveryType === 'DOWNLOAD_LINK') return 'DOWNLOAD_LINK';
  if (product.deliveryType === 'COMPTE') return 'COMPTE';
  if (product.deliveryType === 'MANUEL' || product.deliveryType === 'MANUAL_WHATSAPP' || product.requiresWhatsApp) return 'MANUEL';
  if (product.deliveryType === 'CODE' || product.deliveryType === 'DIGITAL_INSTANT') return 'CODE';
  if (product.productType === 'account') return 'COMPTE';
  if (product.productType === 'service') return 'MANUEL';
  return 'CODE';
}

interface DatabaseSchema {
  users: (User & { passwordHash: string })[];
  wallets: Wallet[];
  walletTransactions: WalletTransaction[];
  categories: Category[];
  platforms: PlatformOrGame[];
  products: Product[];
  digitalCodes: DigitalCode[];
  digitalAccounts: DigitalAccount[];
  orders: Order[];
  customerLibrary: CustomerLibraryItem[];
  rechargeRequests: RechargeRequest[];
  paymentMethods: PaymentMethodConfig[];
  siteSettings: SiteSettings;
  notifications: AppNotification[];
  activityLogs: ActivityLog[];
  media: Media[];
  processedWebhooks: string[];
  carts: Record<string, CartItem[]>;
  loyaltyConfig: LoyaltyConfig;
  loyaltyRewards: LoyaltyReward[];
  promotionalCoupons: PromotionalCoupon[];
  promotionalCouponUsages: PromotionalCouponUsage[];
  promotionalPosters: PromotionalPoster[];
  userPreferences: Record<string, UserPreferences>;
}

export const DEFAULT_LOYALTY_TIERS: LoyaltyTier[] = [
  {
    id: 'tier-1000',
    minSpendHTG: 1000,
    discountPercent: 15,
    validityDays: 30,
    minOrderAmountHTG: 0,
    maxDiscountHTG: 1000,
    maxUses: 1,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'tier-2500',
    minSpendHTG: 2500,
    discountPercent: 20,
    validityDays: 30,
    minOrderAmountHTG: 0,
    maxDiscountHTG: 2000,
    maxUses: 1,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'tier-5000',
    minSpendHTG: 5000,
    discountPercent: 25,
    validityDays: 30,
    minOrderAmountHTG: 0,
    maxDiscountHTG: 3000,
    maxUses: 1,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'tier-10000',
    minSpendHTG: 10000,
    discountPercent: 30,
    validityDays: 30,
    minOrderAmountHTG: 0,
    maxDiscountHTG: 5000,
    maxUses: 1,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

export const DEFAULT_PROMOTIONAL_COUPONS: PromotionalCoupon[] = [
  {
    id: 'promo-anniversaire20',
    code: 'ANNIVERSAIRE20',
    campaignName: 'Anniversaire Boutique',
    description: '20% de réduction jusqu\'à 500 HTG de remise pour les 14 premières commandes',
    type: 'PROMOTIONAL',
    discountPercent: 20,
    minOrderAmountHTG: 1000,
    maxDiscountHTG: 500,
    maxGlobalUses: 14,
    currentUses: 0,
    maxUsesPerCustomer: 1,
    isActive: true,
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'promo-bienvenue15',
    code: 'BIENVENUE15',
    campaignName: 'Offre de Bienvenue',
    description: '15% de réduction dès 500 HTG d\'achats',
    type: 'PROMOTIONAL',
    discountPercent: 15,
    minOrderAmountHTG: 500,
    maxDiscountHTG: 1000,
    maxGlobalUses: 100,
    currentUses: 0,
    maxUsesPerCustomer: 1,
    isActive: true,
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'store.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

/**
 * Automatically persists base64 data URLs to disk in the uploads directory,
 * keeping store.json lightweight and preventing oversized payloads.
 */
function persistBase64Image(dataUrl: string | undefined | null, prefix = 'poster'): string {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return dataUrl || '';
  }
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    const matches = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (!matches || !matches[2]) return dataUrl;

    const mime = matches[1];
    let ext = '.jpg';
    if (mime.includes('png')) ext = '.png';
    else if (mime.includes('webp')) ext = '.webp';

    const buffer = Buffer.from(matches[2], 'base64');
    const filename = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    const filePath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filePath, buffer);
    return `/uploads/${filename}`;
  } catch (e) {
    console.error('Failed to persist base64 image to uploads disk:', e);
    return dataUrl;
  }
}

class DatabaseStore {
  public data: DatabaseSchema;
  private isSaving = false;
  private pendingSave = false;
  private idempotencyCache = new Map<string, { order: Order; libraryItems: CustomerLibraryItem[]; timestamp: number }>();

  constructor() {
    this.ensureDataDirectory();
    this.data = this.loadOrInitialize();
  }

  private ensureDataDirectory() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadOrInitialize(): DatabaseSchema {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        // Ensure admin user password matches env var if changed
        this.verifyAndSyncAdmin(parsed);
        // Clean up legacy demo customer and test artifacts if present
        if (Array.isArray(parsed.users)) {
          parsed.users = parsed.users.filter((u: any) => u.id !== 'usr-demo-customer' && u.email !== 'client@grexus.com');
        }
        if (Array.isArray(parsed.wallets)) {
          parsed.wallets = parsed.wallets.filter((w: any) => w.id !== 'wlt-demo-customer' && w.userId !== 'usr-demo-customer');
        }
        if (Array.isArray(parsed.walletTransactions)) {
          parsed.walletTransactions = parsed.walletTransactions.filter((tx: any) => tx.id !== 'tx-welcome-deposit' && tx.userId !== 'usr-demo-customer');
        }
        if (Array.isArray(parsed.rechargeRequests)) {
          parsed.rechargeRequests = parsed.rechargeRequests.filter((r: any) => r.id !== 'rech-demo-pending' && r.userId !== 'usr-demo-customer');
          parsed.rechargeRequests.forEach((r: any) => {
            if (!r.paymentMethodKey) r.paymentMethodKey = r.paymentMethod || 'moncash';
            if (!r.paymentMethod) r.paymentMethod = 'moncash';
          });
        }
        if (Array.isArray(parsed.notifications)) {
          parsed.notifications = parsed.notifications.filter((n: any) => n.target !== 'usr-demo-customer' && n.id !== 'notif-welcome');
        }
        // Ensure MonCash is configured with real receiver info
        if (Array.isArray(parsed.paymentMethods)) {
          let moncash = parsed.paymentMethods.find((m: any) => m.key === 'moncash');
          if (!moncash) {
            moncash = {
              id: 'pay-moncash',
              key: 'moncash',
              name: 'MonCash',
              phoneNumber: '34584287',
              recipientName: 'carlentz',
              isActive: true,
              isManualModeOnly: true,
              mode: 'manual',
              description: 'Paiement et recharge réelle par MonCash (Haïti).',
              instructions: 'Envoyez votre transfert MonCash au 34584287 (Bénéficiaire : carlentz), puis entrez le montant et la référence SMS reçue.',
            };
            parsed.paymentMethods.unshift(moncash);
          } else {
            moncash.phoneNumber = '34584287';
            moncash.recipientName = 'carlentz';
            moncash.isActive = true;
            moncash.isManualModeOnly = true;
            moncash.mode = 'manual';
            moncash.description = 'Paiement et recharge réelle par MonCash (Haïti).';
            moncash.instructions = 'Envoyez votre transfert MonCash au 34584287 (Bénéficiaire : carlentz), puis entrez le montant et la référence SMS reçue.';
          }
        }
        // Ensure initial gaming platforms have their default idVerification settings
        if (Array.isArray(parsed.platforms)) {
          parsed.platforms.forEach((plat: PlatformOrGame) => {
            if (!plat.idVerification) {
              const seedMatch = INITIAL_PLATFORMS.find(p => p.id === plat.id || p.slug === plat.slug);
              if (seedMatch?.idVerification) {
                plat.idVerification = JSON.parse(JSON.stringify(seedMatch.idVerification));
              }
            }
          });
        }
        // Ensure products have requiresWhatsApp properly defined and include DLS service demo
        if (Array.isArray(parsed.products)) {
          parsed.products.forEach((p: any) => {
            if (p.requiresWhatsApp === undefined) {
              p.requiresWhatsApp = false;
            }
          });
          const hasDls = parsed.products.some((p: any) => p.name === 'Service DLS' || p.id === 'prod-dls-service');
          if (!hasDls) {
            const seedDls = INITIAL_PRODUCTS.find(p => p.id === 'prod-dls-service');
            if (seedDls) {
              parsed.products.push(JSON.parse(JSON.stringify(seedDls)));
            }
          }
        }
        if (!Array.isArray(parsed.media)) {
          parsed.media = [];
        }
        if (!parsed.carts || typeof parsed.carts !== 'object') {
          parsed.carts = {};
        }
        if (!parsed.loyaltyConfig || typeof parsed.loyaltyConfig !== 'object') {
          parsed.loyaltyConfig = {
            enabled: true,
            tiers: JSON.parse(JSON.stringify(DEFAULT_LOYALTY_TIERS)),
          };
        }
        if (!Array.isArray(parsed.loyaltyConfig.tiers) || parsed.loyaltyConfig.tiers.length === 0) {
          parsed.loyaltyConfig.tiers = JSON.parse(JSON.stringify(DEFAULT_LOYALTY_TIERS));
        }
        if (!Array.isArray(parsed.loyaltyRewards)) {
          parsed.loyaltyRewards = [];
        }
        if (!Array.isArray(parsed.promotionalCoupons)) {
          parsed.promotionalCoupons = JSON.parse(JSON.stringify(DEFAULT_PROMOTIONAL_COUPONS));
        }
        if (!Array.isArray(parsed.promotionalCouponUsages)) {
          parsed.promotionalCouponUsages = [];
        }
        if (!Array.isArray(parsed.promotionalPosters)) {
          parsed.promotionalPosters = [];
        }
        if (!Array.isArray(parsed.digitalAccounts)) {
          parsed.digitalAccounts = [];
        }
        if (!parsed.userPreferences || typeof parsed.userPreferences !== 'object') {
          parsed.userPreferences = {};
        }
        // Ensure Netflix products use COMPTE deliveryType
        for (const prod of parsed.products) {
          if (prod.subcategoryId === 'plat-netflix' || prod.subcategoryId === 'plat-spotify' || prod.id.startsWith('prod-netflix')) {
            if (!prod.deliveryType || prod.deliveryType === 'DIGITAL_INSTANT') {
              prod.deliveryType = 'COMPTE';
            }
          }
        }
        // Seed initial verified digital accounts for demo netflix if completely empty
        if (parsed.digitalAccounts.length === 0) {
          const nowIso = new Date().toISOString();
          const sampleAccounts = [
            {
              id: 'acc-nflx-demo-1',
              productId: 'prod-netflix-1m',
              productName: 'Netflix 1 mois Ultra HD',
              email: 'grexus.stream.01@mystore.ht',
              passwordEncrypted: encryptAccountPassword('Stream#Ultra2026!'),
              durationText: '30 jours',
              durationDays: 30,
              expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
              customerInstructions: 'Profil 1 (PIN: 2026). Ne modifiez ni le mot de passe ni le nom du profil.',
              status: 'AVAILABLE' as const,
              createdAt: nowIso,
              updatedAt: nowIso,
            },
            {
              id: 'acc-nflx-demo-2',
              productId: 'prod-netflix-1m',
              productName: 'Netflix 1 mois Ultra HD',
              email: 'grexus.stream.02@mystore.ht',
              passwordEncrypted: encryptAccountPassword('Stream#4KSecure88'),
              durationText: '30 jours',
              durationDays: 30,
              expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
              customerInstructions: 'Profil 2 (PIN: 8842). Connexion autorisée sur 1 seul écran simultané.',
              status: 'AVAILABLE' as const,
              createdAt: nowIso,
              updatedAt: nowIso,
            },
            {
              id: 'acc-nflx-demo-3',
              productId: 'prod-netflix-1m',
              productName: 'Netflix 1 mois Ultra HD',
              email: 'grexus.stream.03@mystore.ht',
              passwordEncrypted: encryptAccountPassword('Play4K#Stream991'),
              durationText: '30 jours',
              durationDays: 30,
              expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
              customerInstructions: 'Profil 3 (PIN: 9910). Respectez la charte d\'utilisation.',
              status: 'AVAILABLE' as const,
              createdAt: nowIso,
              updatedAt: nowIso,
            },
          ];
          parsed.digitalAccounts.push(...sampleAccounts);
        }
        // Synchronize stock for all COMPTE products
        for (const prod of parsed.products) {
          if (prod.deliveryType === 'COMPTE') {
            const avail = parsed.digitalAccounts.filter(a => a.productId === prod.id && a.status === 'AVAILABLE').length;
            prod.stock = avail;
          }
        }

        // Ensure categories exist, are migrated to dynamic structure with displayOrder, active, icon, timestamps
        if (!Array.isArray(parsed.categories) || parsed.categories.length === 0) {
          parsed.categories = JSON.parse(JSON.stringify(INITIAL_CATEGORIES));
        } else {
          // Ensure seed categories exist if missing
          for (const seedCat of INITIAL_CATEGORIES) {
            const exists = parsed.categories.some((c: any) => c.id === seedCat.id || c.slug === seedCat.slug);
            if (!exists) {
              parsed.categories.push(JSON.parse(JSON.stringify(seedCat)));
            }
          }
        }

        // Migrate all categories fields
        parsed.categories.forEach((cat: any, idx: number) => {
          if (cat.displayOrder === undefined || typeof cat.displayOrder !== 'number') {
            cat.displayOrder = typeof cat.orderIndex === 'number' ? cat.orderIndex : (idx + 1);
          }
          cat.orderIndex = cat.displayOrder;
          if (cat.active === undefined) {
            cat.active = true;
          }
          if (!cat.icon) {
            cat.icon = cat.iconName || 'Gamepad2';
          }
          if (!cat.iconName) {
            cat.iconName = cat.icon || 'Gamepad2';
          }
          if (!cat.slug) {
            cat.slug = cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          }
          if (!cat.createdAt) {
            cat.createdAt = new Date('2025-01-01T00:00:00.000Z').toISOString();
          }
          if (!cat.updatedAt) {
            cat.updatedAt = new Date().toISOString();
          }
        });

        // Ensure all products are associated with a valid categoryId
        if (Array.isArray(parsed.products)) {
          const categoryIds = new Set(parsed.categories.map((c: any) => c.id));
          parsed.products.forEach((prod: any) => {
            if (!prod.categoryId || !categoryIds.has(prod.categoryId)) {
              if (prod.subcategoryId && Array.isArray(parsed.platforms)) {
                const plat = parsed.platforms.find((p: any) => p.id === prod.subcategoryId);
                if (plat && categoryIds.has(plat.categoryId)) {
                  prod.categoryId = plat.categoryId;
                  return;
                }
              }
              const lower = (prod.name + ' ' + (prod.id || '')).toLowerCase();
              if (lower.includes('freefire') || lower.includes('blood') || lower.includes('cod') || lower.includes('pubg') || lower.includes('game')) {
                prod.categoryId = 'cat-gaming';
              } else if (lower.includes('netflix') || lower.includes('spotify') || lower.includes('stream')) {
                prod.categoryId = 'cat-streaming';
              } else if (lower.includes('panel') || lower.includes('service') || lower.includes('dls')) {
                prod.categoryId = 'cat-panels';
              } else {
                prod.categoryId = parsed.categories[0]?.id || 'cat-gaming';
              }
            }
          });
        }

        // Ensure siteSettings has new identity fields initialized
        if (parsed.siteSettings) {
          if (!parsed.siteSettings.brandBadge) parsed.siteSettings.brandBadge = 'GREXUS';
          if (!parsed.siteSettings.siteSlogan) parsed.siteSettings.siteSlogan = parsed.siteSettings.slogan || 'Votre boutique numérique de référence en Haïti';
          if (parsed.siteSettings.logoUrl === undefined) parsed.siteSettings.logoUrl = '';
          if (parsed.siteSettings.faviconUrl === undefined) parsed.siteSettings.faviconUrl = '';
          if (!parsed.siteSettings.accentColor) parsed.siteSettings.accentColor = parsed.siteSettings.primaryAccentColor || '#06b6d4';
          if (parsed.siteSettings.homepageWelcomeText === undefined) parsed.siteSettings.homepageWelcomeText = parsed.siteSettings.bannerSubtitle || '';
        }

        return parsed;
      } catch (err) {
        console.error('Error reading database file, reinitializing with seeds...', err);
      }
    }
    return this.createInitialDatabase();
  }

  private verifyAndSyncAdmin(db: DatabaseSchema) {
    const adminEmail = 'k6379700@gmail.com';
    const adminPass = process.env.ADMIN_PASSWORD;
    let admin = db.users.find(u => u.email.toLowerCase() === adminEmail.toLowerCase());
    
    if (!admin) {
      const newAdmin: User & { passwordHash: string } = {
        id: 'usr-admin-master',
        email: adminEmail,
        name: 'Administrateur Principal',
        role: 'ADMIN',
        status: 'active',
        passwordHash: adminPass ? hashPassword(adminPass) : '',
        createdAt: new Date().toISOString(),
      };
      db.users.push(newAdmin);
    } else {
      // Always ensure role is ADMIN and sync status and password from environment variable
      admin.role = 'ADMIN';
      admin.status = 'active';
      if (adminPass) {
        admin.passwordHash = hashPassword(adminPass);
      }
    }
  }

  private createInitialDatabase(): DatabaseSchema {
    const adminEmail = 'k6379700@gmail.com';
    const adminPass = process.env.ADMIN_PASSWORD;
    
    const adminUser: User & { passwordHash: string } = {
      id: 'usr-admin-master',
      email: adminEmail,
      name: 'Directeur Grexus Tech',
      role: 'ADMIN',
      status: 'active',
      passwordHash: adminPass ? hashPassword(adminPass) : '',
      createdAt: new Date().toISOString(),
    };

    const initialData: DatabaseSchema = {
      users: [adminUser],
      wallets: [],
      walletTransactions: [],
      categories: INITIAL_CATEGORIES,
      platforms: INITIAL_PLATFORMS,
      products: INITIAL_PRODUCTS,
      digitalCodes: generateInitialCodes(),
      digitalAccounts: [],
      orders: [],
      customerLibrary: [],
      rechargeRequests: [],
      paymentMethods: INITIAL_PAYMENT_METHODS,
      siteSettings: INITIAL_SITE_SETTINGS,
      notifications: [
        {
          id: 'notif-admin-ready',
          target: 'admin',
          title: 'Système MY STORE prêt',
          message: 'Boutique numérique initialisée avec catalogue Gaming, Streaming et Panels.',
          type: 'system',
          isRead: false,
          createdAt: new Date().toISOString(),
        }
      ],
      activityLogs: [
        {
          id: 'log-init',
          adminEmail: adminEmail,
          action: 'INITIALISATION',
          targetObject: 'Boutique MY STORE',
          details: 'Initialisation du catalogue de produits et des modes de paiement.',
          createdAt: new Date().toISOString(),
        }
      ],
      media: [],
      processedWebhooks: [],
      carts: {},
      loyaltyConfig: {
        enabled: true,
        tiers: JSON.parse(JSON.stringify(DEFAULT_LOYALTY_TIERS)),
      },
      loyaltyRewards: [],
      promotionalCoupons: JSON.parse(JSON.stringify(DEFAULT_PROMOTIONAL_COUPONS)),
      promotionalCouponUsages: [],
      promotionalPosters: [],
      userPreferences: {},
    };

    this.saveDirect(initialData);
    return initialData;
  }

  public save() {
    if (this.isSaving) {
      this.pendingSave = true;
      return;
    }
    this.isSaving = true;
    try {
      this.ensureDataDirectory();
      const tmpFile = `${DB_FILE}.tmp.${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      fs.writeFileSync(tmpFile, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (err) {
      console.error('Failed to persist database file:', err);
    } finally {
      this.isSaving = false;
      if (this.pendingSave) {
        this.pendingSave = false;
        setImmediate(() => this.save());
      }
    }
  }

  private saveDirect(data: DatabaseSchema) {
    this.ensureDataDirectory();
    const tmpFile = `${DB_FILE}.tmp.${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  }

  // ==================== USERS & AUTH ====================
  public getUserByEmail(email: string) {
    const clean = email.trim().toLowerCase();
    return this.data.users.find(u => u.email.toLowerCase() === clean);
  }

  public getUsers(): User[] {
    return this.data.users;
  }

  public getUserById(id: string) {
    return this.data.users.find(u => u.id === id);
  }

  public updateUserLanguage(userId: string, language: 'ht' | 'fr' | 'en') {
    const user = this.getUserById(userId);
    if (user) {
      user.preferredLanguage = language;
      this.save();
      return user;
    }
    return null;
  }

  public getUserPreferences(userId: string): UserPreferences {
    if (!this.data.userPreferences) {
      this.data.userPreferences = {};
    }
    if (!this.data.userPreferences[userId]) {
      const user = this.getUserById(userId);
      this.data.userPreferences[userId] = {
        userId,
        theme: 'system',
        language: user?.preferredLanguage || 'ht',
        communicationPreferences: {
          emailNotifications: true,
          orderUpdatesWhatsApp: true,
          promotions: false,
        },
        currencyDisplay: 'HTG',
        updatedAt: new Date().toISOString(),
      };
      this.save();
    }
    return this.data.userPreferences[userId];
  }

  public updateUserPreferences(userId: string, prefs: Partial<UserPreferences>): UserPreferences {
    const existing = this.getUserPreferences(userId);
    const updatedTheme: ThemePreference = (prefs.theme === 'dark' || prefs.theme === 'light' || prefs.theme === 'system')
      ? prefs.theme
      : existing.theme;
    const updatedLang: Language = (prefs.language === 'ht' || prefs.language === 'fr' || prefs.language === 'en')
      ? prefs.language
      : existing.language;
    const updatedCurrency = (prefs.currencyDisplay === 'USD' || prefs.currencyDisplay === 'HTG')
      ? prefs.currencyDisplay
      : existing.currencyDisplay;
    const updatedComm: CommunicationPreferences = {
      emailNotifications: prefs.communicationPreferences?.emailNotifications ?? existing.communicationPreferences?.emailNotifications ?? true,
      orderUpdatesWhatsApp: prefs.communicationPreferences?.orderUpdatesWhatsApp ?? existing.communicationPreferences?.orderUpdatesWhatsApp ?? true,
      promotions: prefs.communicationPreferences?.promotions ?? existing.communicationPreferences?.promotions ?? false,
    };

    const updated: UserPreferences = {
      userId,
      theme: updatedTheme,
      language: updatedLang,
      communicationPreferences: updatedComm,
      currencyDisplay: updatedCurrency,
      updatedAt: new Date().toISOString(),
    };

    this.data.userPreferences[userId] = updated;

    // Sync preferredLanguage on user object
    const user = this.getUserById(userId);
    if (user && user.preferredLanguage !== updatedLang) {
      user.preferredLanguage = updatedLang;
    }

    this.save();
    return updated;
  }

  public updateUserProfile(userId: string, data: { name?: string; whatsappNumber?: string; phone?: string }): User {
    const user = this.getUserById(userId);
    if (!user) throw new Error('Utilisateur introuvable.');

    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      if (trimmed.length > 0) user.name = trimmed;
    }
    if (data.whatsappNumber !== undefined) {
      if (!data.whatsappNumber) {
        user.whatsappNumber = undefined;
      } else {
        const phoneRes = normalizeWhatsAppNumber(data.whatsappNumber);
        user.whatsappNumber = phoneRes.valid ? phoneRes.normalized : data.whatsappNumber.trim();
      }
    }
    if (data.phone !== undefined) {
      user.phone = data.phone.trim();
    }
    this.save();
    return user;
  }

  public changeUserPassword(userId: string, currentPassword: string, newPassword: string): { success: boolean; message: string } {
    const user = this.data.users.find(u => u.id === userId);
    if (!user) throw new Error('Utilisateur introuvable.');

    if (!currentPassword || !newPassword) {
      throw new Error('Le mot de passe actuel et le nouveau mot de passe sont requis.');
    }
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      throw new Error('Le mot de passe actuel est incorrect.');
    }
    if (newPassword.length < 6) {
      throw new Error('Le nouveau mot de passe doit contenir au moins 6 caractères.');
    }
    user.passwordHash = hashPassword(newPassword);
    this.logActivity(user.email, 'MODIFICATION_MOT_DE_PASSE', 'Compte Client', 'Changement sécurisé du mot de passe effectué.');
    this.save();
    return { success: true, message: 'Mot de passe mis à jour avec succès.' };
  }

  public registerCustomer(name: string, email: string, password: string): User {
    const cleanEmail = email.trim().toLowerCase();
    if (this.getUserByEmail(cleanEmail)) {
      throw new Error('Cet email est déjà associé à un compte.');
    }

    // Role is strictly CUSTOMER. No admin account can be created via register
    const newUser: User & { passwordHash: string } = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      email: cleanEmail,
      name: name.trim() || 'Client',
      role: 'CUSTOMER',
      status: 'active',
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };

    this.data.users.push(newUser);

    // Initialize customer wallet
    const newWallet: Wallet = {
      id: `wlt-${newUser.id}`,
      userId: newUser.id,
      balanceHTG: 0,
      currency: 'HTG',
      updatedAt: new Date().toISOString(),
    };
    this.data.wallets.push(newWallet);

    // Welcome notification
    this.data.notifications.push({
      id: `notif-${Date.now()}`,
      target: newUser.id,
      title: 'Bienvenue sur MY STORE !',
      message: 'Votre compte client est actif. Rechargez votre portefeuille en Gourdes avec NatCash pour commander.',
      type: 'system',
      isRead: false,
      createdAt: new Date().toISOString(),
    });

    this.save();
    const { passwordHash, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  }

  public createVerifiedCustomer(data: {
    name: string;
    email: string;
    passwordHash: string;
    authMethod?: 'EMAIL' | 'GOOGLE' | 'FACEBOOK';
    termsAccepted?: boolean;
    termsAcceptedAt?: string;
  }): User {
    const cleanEmail = data.email.trim().toLowerCase();
    if (this.getUserByEmail(cleanEmail)) {
      throw new Error('Cet email est déjà associé à un compte.');
    }

    // Role is strictly CUSTOMER. No admin role can ever be created here.
    const newUser: User & { passwordHash: string } = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      email: cleanEmail,
      name: data.name.trim() || 'Client',
      role: 'CUSTOMER',
      status: 'active',
      passwordHash: data.passwordHash,
      emailVerified: true,
      termsAccepted: data.termsAccepted ?? true,
      termsAcceptedAt: data.termsAcceptedAt || new Date().toISOString(),
      authMethod: data.authMethod || 'EMAIL',
      lastLogin: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    this.data.users.push(newUser);

    // Initialize customer wallet
    const newWallet: Wallet = {
      id: `wlt-${newUser.id}`,
      userId: newUser.id,
      balanceHTG: 0,
      currency: 'HTG',
      updatedAt: new Date().toISOString(),
    };
    this.data.wallets.push(newWallet);

    // Welcome notification
    this.data.notifications.push({
      id: `notif-${Date.now()}`,
      target: newUser.id,
      title: 'Byenveni sou MY STORE !',
      message: 'Kont ou verifye epi li aktif. Ou ka rechaje bonbo ou an Goud ak MonCash / NatCash.',
      type: 'system',
      isRead: false,
      createdAt: new Date().toISOString(),
    });

    this.save();
    const { passwordHash, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  }

  public createOrUpdateUnverifiedCustomer(data: {
    name: string;
    email: string;
    passwordHash: string;
    termsAccepted?: boolean;
    termsAcceptedAt?: string;
  }): User {
    const cleanEmail = data.email.trim().toLowerCase();
    const existing = this.data.users.find(u => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      if (existing.emailVerified && existing.status === 'active') {
        throw new Error('Cet email est déjà associé à un compte vérifié.');
      }
      existing.name = data.name.trim() || existing.name;
      existing.passwordHash = data.passwordHash;
      existing.termsAccepted = data.termsAccepted ?? true;
      existing.termsAcceptedAt = data.termsAcceptedAt || new Date().toISOString();
      existing.emailVerified = false;
      existing.status = 'pending';
      this.save();
      const { passwordHash, ...userWithoutPassword } = existing;
      return userWithoutPassword;
    }

    const newUser: User & { passwordHash: string } = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      email: cleanEmail,
      name: data.name.trim() || 'Client',
      role: 'CUSTOMER',
      status: 'pending',
      passwordHash: data.passwordHash,
      emailVerified: false,
      termsAccepted: data.termsAccepted ?? true,
      termsAcceptedAt: data.termsAcceptedAt || new Date().toISOString(),
      authMethod: 'EMAIL',
      createdAt: new Date().toISOString(),
    };

    this.data.users.push(newUser);

    let wallet = this.data.wallets.find(w => w.userId === newUser.id);
    if (!wallet) {
      const newWallet: Wallet = {
        id: `wlt-${newUser.id}`,
        userId: newUser.id,
        balanceHTG: 0,
        currency: 'HTG',
        updatedAt: new Date().toISOString(),
      };
      this.data.wallets.push(newWallet);
    }

    this.save();
    const { passwordHash, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  }

  public activateCustomer(email: string): User | null {
    const cleanEmail = email.trim().toLowerCase();
    const user = this.data.users.find(u => u.email.toLowerCase() === cleanEmail);
    if (!user) return null;
    user.emailVerified = true;
    user.status = 'active';
    user.lastLogin = new Date().toISOString();

    const hasWelcomeNotif = this.data.notifications.some(n => n.target === user.id);
    if (!hasWelcomeNotif) {
      this.data.notifications.push({
        id: `notif-${Date.now()}`,
        target: user.id,
        title: 'Byenveni sou MY STORE !',
        message: 'Kont ou verifye epi li aktif. Ou ka rechaje bous ou an Goud ak MonCash / NatCash.',
        type: 'system',
        isRead: false,
        createdAt: new Date().toISOString(),
      });
    }

    this.save();
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  public deleteUnverifiedCustomer(email: string): void {
    const cleanEmail = email.trim().toLowerCase();
    const index = this.data.users.findIndex(u => u.email.toLowerCase() === cleanEmail && u.emailVerified === false);
    if (index !== -1) {
      const userId = this.data.users[index].id;
      this.data.users.splice(index, 1);
      this.data.wallets = this.data.wallets.filter(w => w.userId !== userId);
      this.save();
    }
  }

  public updateUserPassword(userId: string, newPasswordHash: string): boolean {
    const user = this.data.users.find(u => u.id === userId);
    if (!user) return false;
    user.passwordHash = newPasswordHash;
    this.save();
    return true;
  }

  public updateUserLastLogin(userId: string): void {
    const user = this.data.users.find(u => u.id === userId);
    if (user) {
      user.lastLogin = new Date().toISOString();
      this.save();
    }
  }

  public findOrCreateOAuthCustomer(data: {
    email: string;
    name: string;
    authMethod: 'GOOGLE' | 'FACEBOOK';
  }): User {
    const cleanEmail = data.email.trim().toLowerCase();
    const existing = this.getUserByEmail(cleanEmail);

    if (existing) {
      // Never allow OAuth to elevate or impersonate ADMIN!
      if (existing.role === 'ADMIN') {
        throw new Error('Ce compte administrateur est strictement protégé et ne peut pas se connecter via OAuth.');
      }
      existing.lastLogin = new Date().toISOString();
      existing.emailVerified = true;
      if (!existing.authMethod) {
        existing.authMethod = data.authMethod;
      }
      this.save();
      const { passwordHash, ...safeUser } = existing;
      return safeUser;
    }

    // Strictly create CUSTOMER role
    return this.createVerifiedCustomer({
      name: data.name,
      email: cleanEmail,
      passwordHash: hashPassword(Math.random().toString(36) + Date.now().toString()),
      authMethod: data.authMethod,
    });
  }

  public getAllCustomers(): (User & { walletBalance: number; ordersCount: number; totalSpentHTG: number })[] {
    return this.data.users
      .filter(u => u.role === 'CUSTOMER')
      .map(u => {
        const wallet = this.getWalletByUserId(u.id);
        const userOrders = this.data.orders.filter(o => o.userId === u.id && o.paymentStatus === 'PAID');
        const totalSpent = userOrders.reduce((acc, o) => acc + o.totalHTG, 0);
        return {
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          status: u.status,
          createdAt: u.createdAt,
          walletBalance: wallet.balanceHTG,
          ordersCount: userOrders.length,
          totalSpentHTG: totalSpent,
        };
      });
  }

  public updateCustomerStatus(userId: string, status: 'active' | 'blocked', adminEmail: string) {
    const user = this.data.users.find(u => u.id === userId);
    if (!user) throw new Error('Utilisateur introuvable');
    if (user.role === 'ADMIN') throw new Error('Impossible de modifier le statut d\'un administrateur');
    user.status = status;
    this.logActivity(adminEmail, 'MODIFICATION_CLIENT', `Client ${user.email}`, `Statut changé en ${status}`);
    this.save();
    return user;
  }

  // ==================== WALLET & TRANSACTIONS ====================
  public getWalletByUserId(userId: string): Wallet {
    let wallet = this.data.wallets.find(w => w.userId === userId);
    if (!wallet) {
      wallet = {
        id: `wlt-${userId}`,
        userId,
        balanceHTG: 0,
        currency: 'HTG',
        updatedAt: new Date().toISOString(),
      };
      this.data.wallets.push(wallet);
      this.save();
    }
    return wallet;
  }

  public creditWallet(
    userId: string, 
    amountHTG: number, 
    referenceId: string, 
    description: string,
    type: TransactionType = 'DEPOSIT',
    metadata?: { provider?: string; paymentMethod?: string; externalReference?: string; idempotencyKey?: string }
  ): WalletTransaction {
    if (typeof amountHTG !== 'number' || isNaN(amountHTG) || amountHTG <= 0 || !isFinite(amountHTG)) {
      throw new Error('Le montant du crédit doit être supérieur à 0 HTG');
    }
    const wallet = this.getWalletByUserId(userId);
    const previousBalance = wallet.balanceHTG;
    wallet.balanceHTG = Math.round((wallet.balanceHTG + amountHTG) * 100) / 100;
    wallet.updatedAt = new Date().toISOString();

    const tx: WalletTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      walletId: wallet.id,
      userId,
      type,
      amountHTG: Math.round(amountHTG * 100) / 100,
      previousBalanceHTG: previousBalance,
      newBalanceHTG: wallet.balanceHTG,
      referenceId,
      reference: referenceId,
      description,
      provider: metadata?.provider,
      paymentMethod: metadata?.paymentMethod,
      externalReference: metadata?.externalReference,
      idempotencyKey: metadata?.idempotencyKey,
      status: 'CONFIRMED',
      createdAt: new Date().toISOString(),
    };

    this.data.walletTransactions.unshift(tx);
    this.save();
    return tx;
  }

  public debitWallet(
    userId: string, 
    amountHTG: number, 
    referenceId: string, 
    description: string,
    type: TransactionType = 'PURCHASE',
    metadata?: { provider?: string; paymentMethod?: string; externalReference?: string; idempotencyKey?: string }
  ): WalletTransaction {
    if (typeof amountHTG !== 'number' || isNaN(amountHTG) || amountHTG <= 0 || !isFinite(amountHTG)) {
      throw new Error('Le montant du débit doit être supérieur à 0 HTG');
    }
    const wallet = this.getWalletByUserId(userId);
    if (wallet.balanceHTG < amountHTG) {
      throw new Error(`Solde insuffisant. Vous avez ${wallet.balanceHTG} HTG, nécessaire: ${amountHTG} HTG.`);
    }

    const previousBalance = wallet.balanceHTG;
    wallet.balanceHTG = Math.round((wallet.balanceHTG - amountHTG) * 100) / 100;
    wallet.updatedAt = new Date().toISOString();

    const tx: WalletTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      walletId: wallet.id,
      userId,
      type,
      amountHTG: Math.round(amountHTG * 100) / 100,
      previousBalanceHTG: previousBalance,
      newBalanceHTG: wallet.balanceHTG,
      referenceId,
      reference: referenceId,
      description,
      provider: metadata?.provider,
      paymentMethod: metadata?.paymentMethod,
      externalReference: metadata?.externalReference,
      idempotencyKey: metadata?.idempotencyKey,
      status: 'CONFIRMED',
      createdAt: new Date().toISOString(),
    };

    this.data.walletTransactions.unshift(tx);
    this.save();
    return tx;
  }

  public adjustWallet(userId: string, amountHTG: number, reason: string, adminEmail: string): WalletTransaction {
    const wallet = this.getWalletByUserId(userId);
    const user = this.getUserById(userId);
    const previousBalance = wallet.balanceHTG;
    const newBalance = Math.max(0, Math.round((wallet.balanceHTG + amountHTG) * 100) / 100);
    wallet.balanceHTG = newBalance;
    wallet.updatedAt = new Date().toISOString();

    const tx: WalletTransaction = {
      id: `tx-adj-${Date.now()}`,
      walletId: wallet.id,
      userId,
      type: 'ADJUSTMENT',
      amountHTG,
      previousBalanceHTG: previousBalance,
      newBalanceHTG: newBalance,
      referenceId: `ADJ-BY-${adminEmail}`,
      description: `Ajustement administrateur : ${reason}`,
      createdAt: new Date().toISOString(),
    };

    this.data.walletTransactions.unshift(tx);
    this.logActivity(adminEmail, 'AJUSTEMENT_PORTEFEUILLE', `Client ${user?.email}`, `Ajustement de ${amountHTG} HTG (${reason})`);
    this.save();
    return tx;
  }

  public getWalletTransactions(userId: string): WalletTransaction[] {
    return this.data.walletTransactions
      .filter(tx => tx.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getAllTransactions(): WalletTransaction[] {
    return this.data.walletTransactions
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // ==================== CATEGORIES & PLATFORMS ====================
  public getCategories(includeInactive: boolean = false): Category[] {
    const list = includeInactive 
      ? this.data.categories 
      : this.data.categories.filter(c => c.active !== false);

    return list
      .map(c => ({
        ...c,
        productsCount: this.data.products.filter(p => p.categoryId === c.id).length,
      }))
      .sort((a, b) => (a.displayOrder ?? a.orderIndex ?? 999) - (b.displayOrder ?? b.orderIndex ?? 999));
  }

  public getCategoryById(id: string): Category | undefined {
    const cat = this.data.categories.find(c => c.id === id);
    if (!cat) return undefined;
    return {
      ...cat,
      productsCount: this.data.products.filter(p => p.categoryId === cat.id).length,
    };
  }

  public getCategoryBySlug(slug: string): Category | undefined {
    const cat = this.data.categories.find(c => c.slug.toLowerCase() === slug.toLowerCase());
    if (!cat) return undefined;
    return {
      ...cat,
      productsCount: this.data.products.filter(p => p.categoryId === cat.id).length,
    };
  }

  public countProductsInCategory(categoryId: string): number {
    return this.data.products.filter(p => p.categoryId === categoryId).length;
  }

  public createCategory(
    data: {
      name: string;
      slug?: string;
      icon?: string;
      iconName?: string;
      description?: string;
      subtitle?: string;
      badge?: string;
      displayOrder?: number;
      active?: boolean;
    },
    adminEmail: string
  ): Category {
    const rawName = (data.name || '').trim();
    if (!rawName) {
      throw new Error('Le nom de la catégorie est obligatoire.');
    }
    if (rawName.length > 60) {
      throw new Error('Le nom de la catégorie ne peut pas dépasser 60 caractères.');
    }

    // Check name uniqueness (case-insensitive)
    const nameExists = this.data.categories.some(c => c.name.trim().toLowerCase() === rawName.toLowerCase());
    if (nameExists) {
      throw new Error(`Une catégorie avec le nom "${rawName}" existe déjà.`);
    }

    // Slug generation and validation
    let slug = (data.slug || '').trim().toLowerCase();
    if (!slug) {
      slug = rawName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    } else {
      slug = slug
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    if (!slug) {
      slug = `cat-${Date.now()}`;
    }

    const slugExists = this.data.categories.some(c => c.slug === slug);
    if (slugExists) {
      throw new Error(`Une catégorie avec le slug "${slug}" existe déjà.`);
    }

    // Safe icon validation
    const safeIcons = [
      'Gamepad2', 'Tv', 'Cpu', 'Laptop', 'Shield', 'Sparkles', 'Smartphone', 'Gift',
      'Code', 'Zap', 'Flame', 'ShoppingBag', 'Music', 'Cloud', 'Server', 'Key',
      'Layers', 'Boxes', 'Headphones', 'Monitor', 'Film', 'Play', 'Radio', 'Tag',
      'Bookmark', 'CheckCircle', 'FolderTree', 'Folder'
    ];
    let icon = data.icon || data.iconName || 'Folder';
    if (!safeIcons.includes(icon)) {
      icon = 'Folder';
    }

    // Display order
    const maxOrder = this.data.categories.reduce((max, c) => Math.max(max, c.displayOrder || c.orderIndex || 0), 0);
    const displayOrder = typeof data.displayOrder === 'number' ? data.displayOrder : maxOrder + 1;

    const now = new Date().toISOString();
    const newCategory: Category = {
      id: `cat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: rawName,
      slug,
      icon,
      iconName: icon,
      description: (data.description || '').trim().slice(0, 255),
      subtitle: (data.subtitle || '').trim().slice(0, 80),
      badge: (data.badge || '').trim().slice(0, 40),
      displayOrder,
      orderIndex: displayOrder,
      active: data.active !== undefined ? Boolean(data.active) : true,
      createdAt: now,
      updatedAt: now,
      productsCount: 0,
    };

    this.data.categories.push(newCategory);
    this.logActivity(adminEmail, 'CATEGORY_CREATED', newCategory.name, `Création de la catégorie "${newCategory.name}" (${newCategory.slug})`);
    this.save();
    return newCategory;
  }

  public updateCategory(
    id: string,
    updates: Partial<Category>,
    adminEmail: string
  ): Category {
    const cat = this.data.categories.find(c => c.id === id);
    if (!cat) {
      throw new Error('Catégorie introuvable.');
    }

    if (updates.name !== undefined) {
      const trimmedName = updates.name.trim();
      if (!trimmedName) {
        throw new Error('Le nom de la catégorie ne peut pas être vide.');
      }
      if (trimmedName.length > 60) {
        throw new Error('Le nom ne peut pas dépasser 60 caractères.');
      }
      const duplicateName = this.data.categories.some(
        c => c.id !== id && c.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (duplicateName) {
        throw new Error(`Une autre catégorie avec le nom "${trimmedName}" existe déjà.`);
      }
      cat.name = trimmedName;
    }

    if (updates.slug !== undefined) {
      let trimmedSlug = updates.slug
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      if (!trimmedSlug) {
        trimmedSlug = cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      }
      const duplicateSlug = this.data.categories.some(
        c => c.id !== id && c.slug === trimmedSlug
      );
      if (duplicateSlug) {
        throw new Error(`Une autre catégorie avec le slug "${trimmedSlug}" existe déjà.`);
      }
      cat.slug = trimmedSlug;
    }

    if (updates.icon !== undefined || updates.iconName !== undefined) {
      const safeIcons = [
        'Gamepad2', 'Tv', 'Cpu', 'Laptop', 'Shield', 'Sparkles', 'Smartphone', 'Gift',
        'Code', 'Zap', 'Flame', 'ShoppingBag', 'Music', 'Cloud', 'Server', 'Key',
        'Layers', 'Boxes', 'Headphones', 'Monitor', 'Film', 'Play', 'Radio', 'Tag',
        'Bookmark', 'CheckCircle', 'FolderTree', 'Folder'
      ];
      const iconCandidate = updates.icon || updates.iconName || 'Folder';
      const cleanIcon = safeIcons.includes(iconCandidate) ? iconCandidate : 'Folder';
      cat.icon = cleanIcon;
      cat.iconName = cleanIcon;
    }

    if (updates.description !== undefined) {
      cat.description = updates.description.trim().slice(0, 255);
    }
    if (updates.subtitle !== undefined) {
      cat.subtitle = updates.subtitle.trim().slice(0, 80);
    }
    if (updates.badge !== undefined) {
      cat.badge = updates.badge.trim().slice(0, 40);
    }

    if (updates.displayOrder !== undefined && typeof updates.displayOrder === 'number') {
      cat.displayOrder = updates.displayOrder;
      cat.orderIndex = updates.displayOrder;
    }

    if (updates.active !== undefined) {
      cat.active = Boolean(updates.active);
    }

    cat.updatedAt = new Date().toISOString();

    const action = updates.active === false ? 'CATEGORY_DEACTIVATED' : 'CATEGORY_UPDATED';
    this.logActivity(adminEmail, action, cat.name, `Mise à jour de la catégorie "${cat.name}"`);
    this.save();

    return {
      ...cat,
      productsCount: this.countProductsInCategory(cat.id),
    };
  }

  public deleteCategory(id: string, adminEmail: string): { success: boolean; message: string } {
    const cat = this.data.categories.find(c => c.id === id);
    if (!cat) {
      throw new Error('Catégorie introuvable.');
    }

    // Check associated products
    const productsCount = this.countProductsInCategory(id);
    if (productsCount > 0) {
      throw new Error(
        `Cette catégorie contient encore des produits (${productsCount}). Réaffectez les produits avant de la supprimer.`
      );
    }

    // Check associated platforms
    const platformsCount = this.data.platforms.filter(p => p.categoryId === id).length;
    if (platformsCount > 0) {
      throw new Error(
        `Cette catégorie contient encore des plateformes/jeux (${platformsCount}). Réaffectez-les avant de la supprimer.`
      );
    }

    const catName = cat.name;
    this.data.categories = this.data.categories.filter(c => c.id !== id);
    this.logActivity(adminEmail, 'CATEGORY_DELETED', catName, `Suppression de la catégorie "${catName}"`);
    this.save();

    return { success: true, message: `Catégorie "${catName}" supprimée avec succès.` };
  }

  public reorderCategories(orderedIds: string[], adminEmail: string): Category[] {
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      throw new Error('Liste d\'IDs invalide pour la réorganisation.');
    }

    orderedIds.forEach((id, index) => {
      const cat = this.data.categories.find(c => c.id === id);
      if (cat) {
        cat.displayOrder = index + 1;
        cat.orderIndex = index + 1;
        cat.updatedAt = new Date().toISOString();
      }
    });

    this.logActivity(adminEmail, 'CATEGORY_REORDERED', 'Catalogue', `Réorganisation de l'ordre de ${orderedIds.length} catégories.`);
    this.save();
    return this.getCategories(true);
  }

  public reassignProductsCategory(fromCategoryId: string, toCategoryId: string, adminEmail: string): number {
    const targetCat = this.data.categories.find(c => c.id === toCategoryId);
    if (!targetCat) {
      throw new Error('Catégorie de destination introuvable.');
    }

    let reassignedCount = 0;
    this.data.products.forEach(p => {
      if (p.categoryId === fromCategoryId) {
        p.categoryId = toCategoryId;
        p.updatedAt = new Date().toISOString();
        reassignedCount++;
      }
    });

    if (reassignedCount > 0) {
      this.logActivity(adminEmail, 'REAFFECTATION_PRODUITS', targetCat.name, `Réaffectation de ${reassignedCount} produits vers "${targetCat.name}"`);
      this.save();
    }

    return reassignedCount;
  }

  public getPlatforms(): PlatformOrGame[] {
    return this.data.platforms.sort((a, b) => a.orderIndex - b.orderIndex);
  }

  public getPlatformsByCategory(categoryId: string): PlatformOrGame[] {
    return this.data.platforms
      .filter(p => p.categoryId === categoryId && p.active)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }

  public savePlatform(platform: Partial<PlatformOrGame> & { name: string; categoryId: string }, adminEmail: string): PlatformOrGame {
    const isNew = !platform.id;
    const id = platform.id || `plat-${Date.now()}`;
    const slug = platform.slug || platform.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const fullPlatform: PlatformOrGame = {
      id,
      categoryId: platform.categoryId,
      name: platform.name,
      slug,
      image: platform.image || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=500&auto=format&fit=crop&q=80',
      bannerImage: platform.bannerImage,
      description: platform.description || '',
      type: platform.type || (platform.categoryId === 'cat-gaming' ? 'game' : platform.categoryId === 'cat-streaming' ? 'streaming' : 'panel'),
      active: platform.active ?? true,
      orderIndex: platform.orderIndex ?? (this.data.platforms.length + 1),
      idVerification: platform.idVerification,
    };

    if (isNew) {
      this.data.platforms.push(fullPlatform);
      this.logActivity(adminEmail, 'CREATION_SOUS_CATEGORIE', fullPlatform.name, `Ajout de la plateforme/jeu ${fullPlatform.name}`);
    } else {
      const idx = this.data.platforms.findIndex(p => p.id === id);
      if (idx !== -1) {
        this.data.platforms[idx] = fullPlatform;
        this.logActivity(adminEmail, 'MODIFICATION_SOUS_CATEGORIE', fullPlatform.name, `Mise à jour des informations`);
      }
    }

    this.save();
    return fullPlatform;
  }

  public deletePlatform(id: string, adminEmail: string) {
    const plat = this.data.platforms.find(p => p.id === id);
    if (!plat) throw new Error('Plateforme introuvable');
    this.data.platforms = this.data.platforms.filter(p => p.id !== id);
    this.logActivity(adminEmail, 'SUPPRESSION_SOUS_CATEGORIE', plat.name, `Suppression de ${plat.name}`);
    this.save();
  }

  // ==================== PRODUCTS ====================
  public getProducts(filters?: {
    categoryId?: string;
    subcategoryId?: string;
    featured?: boolean;
    search?: string;
    status?: 'published' | 'all';
    productType?: string;
    sortBy?: 'priceAsc' | 'priceDesc' | 'newest' | 'name';
  }): Product[] {
    let list = this.data.products.slice();

    // Strict separation: Filter out any entry that might be an affiche or lacks genuine product pricing
    list = list.filter(p => p && p.id && !p.id.startsWith('poster-') && typeof p.priceHTG === 'number');

    if (filters?.status !== 'all') {
      list = list.filter(p => p.status === 'published');
    }

    if (filters?.categoryId) {
      list = list.filter(p => p.categoryId === filters.categoryId);
    }

    if (filters?.subcategoryId) {
      list = list.filter(p => p.subcategoryId === filters.subcategoryId);
    }

    if (filters?.featured) {
      list = list.filter(p => p.isFeatured);
    }

    if (filters?.productType) {
      list = list.filter(p => p.productType === filters.productType);
    }

    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(p => 
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.subcategoryName && p.subcategoryName.toLowerCase().includes(q)) ||
        p.sku.toLowerCase().includes(q)
      );
    }

    if (filters?.sortBy === 'priceAsc') {
      list.sort((a, b) => a.priceHTG - b.priceHTG);
    } else if (filters?.sortBy === 'priceDesc') {
      list.sort((a, b) => b.priceHTG - a.priceHTG);
    } else if (filters?.sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // Newest
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    // Security hardening: NEVER expose sensitive digital account delivery passwords in product lists
    if (filters?.status !== 'all') {
      // Public storefront visitors never receive credentials of any kind
      list = list.map(p => {
        if (p.accountCredentials) {
          const { accountCredentials, ...rest } = p;
          return rest as Product;
        }
        return p;
      });
    } else {
      // Admin product list receives masked password placeholder, never cleartext
      list = list.map(p => {
        if (p.accountCredentials?.password) {
          return {
            ...p,
            accountCredentials: {
              ...p.accountCredentials,
              password: maskPassword(12),
            },
          };
        }
        return p;
      });
    }

    return list;
  }

  public getProductById(id: string): Product | undefined {
    if (!id || id.startsWith('poster-')) return undefined;
    const p = this.data.products.find(p => p.id === id);
    if (!p || typeof p.priceHTG !== 'number') return undefined;
    return p;
  }

  public saveProduct(productData: Partial<Product> & { name: string; priceHTG: number; categoryId: string }, adminEmail: string): Product {
    const isNew = !productData.id || this.data.products.findIndex(p => p.id === productData.id) === -1;
    const id = productData.id || `prod-${Date.now()}`;
    const subcategory = productData.subcategoryId ? this.data.platforms.find(p => p.id === productData.subcategoryId) : undefined;
    
    // Resolve image URL if imageId provided
    let imageUrl = productData.image;
    if (productData.imageId) {
      const media = (this.data.media || []).find(m => m.id === productData.imageId);
      if (media && (!imageUrl || imageUrl.startsWith('blob:') || imageUrl.startsWith('data:'))) {
        imageUrl = media.url;
      }
    }
    if (!imageUrl) {
      imageUrl = 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=500&auto=format&fit=crop&q=80';
    }

    const deliveryType: DeliveryType = 
      productData.deliveryType || 
      ((productData.requiresWhatsApp || productData.productType === 'service') ? 'MANUEL' : 'CODE');

    if (deliveryType === 'DOWNLOAD_LINK') {
      if (!isValidHttpsDownloadUrl(productData.downloadUrl)) {
        throw new Error("Un lien de téléchargement HTTPS est obligatoire pour ce type de produit.");
      }
    }

    const downloadUrl: string | undefined = deliveryType === 'DOWNLOAD_LINK' 
      ? productData.downloadUrl?.trim() 
      : undefined;

    const requiresWhatsApp = deliveryType === 'DOWNLOAD_LINK'
      ? false
      : (productData.requiresWhatsApp ?? (deliveryType === 'MANUEL' || deliveryType === 'MANUAL_WHATSAPP'));
    const originalPriceHTG = productData.originalPriceHTG !== undefined && productData.originalPriceHTG !== null && Number(productData.originalPriceHTG) > 0
      ? Math.max(0, Number(productData.originalPriceHTG))
      : undefined;
    const lowStockThreshold = productData.lowStockThreshold !== undefined && productData.lowStockThreshold !== null
      ? Math.max(0, Number(productData.lowStockThreshold))
      : 5;
    const customerInstructions = productData.customerInstructions || productData.deliveryInstructions || (
      deliveryType === 'COMPTE'
        ? 'Identifiants de compte privé délivrés instantanément après paiement.'
        : deliveryType === 'DOWNLOAD_LINK'
        ? 'Lien de téléchargement sécurisé disponible instantanément après paiement.'
        : (deliveryType === 'CODE' || deliveryType === 'DIGITAL_INSTANT')
        ? 'Livraison numérique immédiate dans votre bibliothèque.'
        : 'Traitement manuel par notre équipe via WhatsApp.'
    );
    const processingTime = productData.processingTime || (
      (deliveryType === 'MANUEL' || deliveryType === 'MANUAL_WHATSAPP') ? '15-60 min' : 'Instantané (0-5 min)'
    );

    const thankYouMessage = productData.thankYouMessage?.trim() || undefined;

    const fullProduct: Product = {
      id,
      name: productData.name,
      description: productData.description || '',
      image: imageUrl,
      imageId: productData.imageId,
      galleryImages: Array.isArray(productData.galleryImages) ? productData.galleryImages : [],
      galleryMediaIds: Array.isArray(productData.galleryMediaIds) ? productData.galleryMediaIds : [],
      categoryId: productData.categoryId,
      subcategoryId: productData.subcategoryId,
      platformId: productData.platformId || productData.subcategoryId,
      subcategoryName: subcategory ? subcategory.name : productData.subcategoryName,
      priceHTG: Math.max(0, productData.priceHTG),
      originalPriceHTG,
      sku: productData.sku || `SKU-${Date.now().toString(36).toUpperCase()}`,
      stock: Math.max(0, productData.stock ?? 10),
      lowStockThreshold,
      productType: productData.productType || 'code',
      deliveryType,
      downloadUrl,
      processingTime,
      status: productData.status || 'published',
      isFeatured: productData.isFeatured ?? false,
      featuredOrder: productData.featuredOrder ?? 0,
      deliveryInstructions: customerInstructions,
      customerInstructions,
      adminInstructions: productData.adminInstructions || '',
      thankYouMessage,
      requiresPlayerIdVerification: productData.requiresPlayerIdVerification ?? false,
      verificationIdFieldName: productData.verificationIdFieldName || '',
      requiresWhatsApp,
      requiresAdditionalVerification: productData.requiresAdditionalVerification ?? false,
      additionalVerificationInstructions: productData.additionalVerificationInstructions || '',
      isDemo: productData.isDemo ?? false,
      createdAt: productData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Digital Account Delivery configuration
    if (deliveryType === 'COMPTE') {
      const email = (productData.accountCredentials?.email || '').trim();
      const rawPassword = (productData.accountCredentials?.password || '').trim();

      if (!Array.isArray(this.data.digitalAccounts)) {
        this.data.digitalAccounts = [];
      }

      if (email) {
        // Find if this product already has an available digital account
        const existingAcc = this.data.digitalAccounts.find(
          a => a.productId === id && a.status === 'AVAILABLE'
        );

        if (existingAcc) {
          existingAcc.email = email;
          if (rawPassword && !rawPassword.includes('••••') && rawPassword.length > 0) {
            existingAcc.passwordEncrypted = encryptAccountPassword(rawPassword);
          }
          existingAcc.thankYouMessage = thankYouMessage;
          existingAcc.customerInstructions = customerInstructions;
          existingAcc.updatedAt = new Date().toISOString();
        } else if (rawPassword && !rawPassword.includes('••••')) {
          const newAccount: DigitalAccount = {
            id: `acc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            productId: id,
            productName: fullProduct.name,
            email,
            passwordEncrypted: encryptAccountPassword(rawPassword),
            thankYouMessage,
            customerInstructions,
            durationText: '30 jours',
            durationDays: 30,
            status: 'AVAILABLE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          this.data.digitalAccounts.push(newAccount);
        }

        // Synchronize product stock with available accounts
        const availableAccountsCount = this.data.digitalAccounts.filter(
          a => a.productId === id && a.status === 'AVAILABLE'
        ).length;
        fullProduct.stock = availableAccountsCount;

        // Store non-sensitive credentials reference on product (password always masked)
        fullProduct.accountCredentials = {
          email,
          password: maskPassword(12),
        };
      }
    }

    if (isNew) {
      this.data.products.push(fullProduct);
      this.logActivity(adminEmail, 'CREATION_PRODUIT', fullProduct.name, `Création du produit ${fullProduct.name} (${fullProduct.priceHTG} HTG, Stock: ${fullProduct.stock})`);
    } else {
      const idx = this.data.products.findIndex(p => p.id === id);
      if (idx !== -1) {
        this.data.products[idx] = fullProduct;
        this.logActivity(adminEmail, 'MODIFICATION_PRODUIT', fullProduct.name, `Mise à jour des informations de ${fullProduct.name}`);
      }
    }

    this.save();
    return fullProduct;
  }

  public duplicateProduct(id: string, adminEmail: string): Product {
    const original = this.getProductById(id);
    if (!original) throw new Error('Produit introuvable');

    const newSku = `SKU-${Date.now().toString(36).toUpperCase()}`;
    const duplicated: Product = {
      ...original,
      id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: `${original.name} (Copie)`,
      sku: newSku,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.data.products.push(duplicated);
    this.logActivity(adminEmail, 'DUPLICATION_PRODUIT', duplicated.name, `Duplication du produit ${original.name} (Nouveau SKU: ${newSku})`);
    this.save();
    return duplicated;
  }

  public setProductStatus(id: string, status: 'draft' | 'published' | 'hidden' | 'out_of_stock', adminEmail: string): Product {
    const p = this.getProductById(id);
    if (!p) throw new Error('Produit introuvable');
    const oldStatus = p.status;
    p.status = status;
    p.updatedAt = new Date().toISOString();
    this.logActivity(adminEmail, 'MODIFICATION_STATUT_PRODUIT', p.name, `Statut modifié de ${oldStatus} à ${status}`);
    this.save();
    return p;
  }

  public setProductFeatured(id: string, isFeatured: boolean, adminEmail: string): Product {
    const p = this.getProductById(id);
    if (!p) throw new Error('Produit introuvable');
    p.isFeatured = isFeatured;
    p.updatedAt = new Date().toISOString();
    this.logActivity(adminEmail, 'MODIFICATION_VEDETTE_PRODUIT', p.name, isFeatured ? 'Mis en avant (⭐ Vedette)' : 'Retiré des vedettes');
    this.save();
    return p;
  }

  public deleteProduct(id: string, adminEmail: string) {
    const p = this.getProductById(id);
    if (!p) throw new Error('Produit introuvable');
    this.data.products = this.data.products.filter(item => item.id !== id);
    this.logActivity(adminEmail, 'SUPPRESSION_PRODUIT', p.name, `Suppression définitive du produit ${p.name}`);
    this.save();
  }

  public updateProductStock(id: string, action: 'set' | 'add' | 'remove', quantity: number, adminEmail: string): Product {
    const p = this.getProductById(id);
    if (!p) throw new Error('Produit introuvable');

    const previousStock = p.stock;
    if (action === 'set') {
      p.stock = Math.max(0, quantity);
    } else if (action === 'add') {
      p.stock += Math.max(0, quantity);
    } else if (action === 'remove') {
      p.stock = Math.max(0, p.stock - quantity);
    }
    p.updatedAt = new Date().toISOString();

    this.logActivity(adminEmail, 'MODIFICATION_STOCK', p.name, `Stock passé de ${previousStock} à ${p.stock} (${action} ${quantity})`);

    // Check low stock / out of stock alerts
    if (p.stock === 0) {
      this.data.notifications.push({
        id: `notif-oos-${Date.now()}`,
        target: 'admin',
        title: 'RUPTURE DE STOCK',
        message: `Le produit "${p.name}" (${p.sku}) est désormais en rupture de stock.`,
        type: 'stock',
        isRead: false,
        createdAt: new Date().toISOString(),
      });
    }

    this.save();
    return p;
  }

  // ==================== DIGITAL CODES INVENTORY ====================
  public getCodesForProduct(productId: string): DigitalCode[] {
    return this.data.digitalCodes.filter(c => c.productId === productId);
  }

  public previewDigitalCodes(productId: string, rawCodes: string[]): {
    totalGiven: number;
    validCount: number;
    duplicateCount: number;
    existingCount: number;
    toAdd: string[];
    ignored: { code: string; reason: string }[];
  } {
    const product = this.getProductById(productId);
    if (!product) throw new Error('Produit introuvable');

    const existingCodes = new Set(
      this.data.digitalCodes.filter(c => c.productId === productId).map(c => c.code.trim())
    );
    const seenInBatch = new Set<string>();
    const toAdd: string[] = [];
    const ignored: { code: string; reason: string }[] = [];

    for (const raw of rawCodes) {
      const trimmed = (raw || '').trim();
      if (!trimmed) continue;

      if (seenInBatch.has(trimmed)) {
        ignored.push({ code: trimmed, reason: 'Doublon dans la liste saisie' });
        continue;
      }
      seenInBatch.add(trimmed);

      if (existingCodes.has(trimmed)) {
        ignored.push({ code: trimmed, reason: 'Code déjà existant dans le stock de ce produit' });
        continue;
      }

      toAdd.push(trimmed);
    }

    return {
      totalGiven: rawCodes.length,
      validCount: toAdd.length,
      duplicateCount: ignored.filter(i => i.reason.includes('Doublon')).length,
      existingCount: ignored.filter(i => i.reason.includes('existant')).length,
      toAdd,
      ignored,
    };
  }

  public addDigitalCodes(productId: string, rawCodes: string[], adminEmail: string): { addedCount: number; newStock: number } {
    const product = this.getProductById(productId);
    if (!product) throw new Error('Produit introuvable');

    const cleanedCodes = rawCodes
      .map(c => c.trim())
      .filter(c => c.length > 0);

    let added = 0;
    for (const codeStr of cleanedCodes) {
      // Avoid duplicate codes for same product
      const exists = this.data.digitalCodes.some(c => c.productId === productId && c.code === codeStr);
      if (!exists) {
        this.data.digitalCodes.push({
          id: `code-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          productId,
          code: codeStr,
          isUsed: false,
          createdAt: new Date().toISOString(),
        });
        added++;
      }
    }

    // Automatically synchronize product stock with available unused codes if it's a code product
    const unusedCount = this.data.digitalCodes.filter(c => c.productId === productId && !c.isUsed).length;
    product.stock = unusedCount;
    product.updatedAt = new Date().toISOString();

    this.logActivity(adminEmail, 'AJOUT_CODES_NUMERIQUES', product.name, `Ajout de ${added} nouveaux codes uniques (Stock total: ${product.stock})`);
    this.save();

    return { addedCount: added, newStock: product.stock };
  }

  public deleteDigitalCode(codeId: string, adminEmail: string) {
    const codeObj = this.data.digitalCodes.find(c => c.id === codeId);
    if (!codeObj) throw new Error('Code introuvable');
    if (codeObj.isUsed) throw new Error('Impossible de supprimer un code déjà vendu et utilisé');

    this.data.digitalCodes = this.data.digitalCodes.filter(c => c.id !== codeId);
    const product = this.getProductById(codeObj.productId);
    if (product) {
      product.stock = this.data.digitalCodes.filter(c => c.productId === product.id && !c.isUsed).length;
      product.updatedAt = new Date().toISOString();
    }

    this.logActivity(adminEmail, 'SUPPRESSION_CODE', `Code ${codeId}`, `Suppression d'un code numérique disponible`);
    this.save();
  }

  // ==================== DIGITAL ACCOUNTS INVENTORY ====================
  public getAccountsForProduct(productId: string): Array<Omit<DigitalAccount, 'passwordEncrypted'> & { passwordMasked: string }> {
    const list = (this.data.digitalAccounts || []).filter(a => a.productId === productId);
    return list.map(acc => {
      // Dynamic expiration check
      let currentStatus = acc.status;
      if (acc.expiresAt && currentStatus !== 'EXPIRED' && new Date(acc.expiresAt).getTime() < Date.now()) {
        if (currentStatus === 'DELIVERED' || currentStatus === 'ASSIGNED') {
          currentStatus = 'EXPIRED';
        }
      }
      return {
        id: acc.id,
        productId: acc.productId,
        productName: acc.productName,
        email: acc.email,
        passwordMasked: maskPassword(12),
        thankYouMessage: acc.thankYouMessage,
        durationText: acc.durationText,
        durationDays: acc.durationDays,
        expiresAt: acc.expiresAt,
        customerInstructions: acc.customerInstructions,
        adminNotes: acc.adminNotes,
        status: currentStatus,
        orderId: acc.orderId,
        userId: acc.userId,
        userEmail: acc.userEmail,
        assignedAt: acc.assignedAt,
        deliveredAt: acc.deliveredAt,
        createdAt: acc.createdAt,
        updatedAt: acc.updatedAt,
      };
    });
  }

  public getAccountById(accountId: string): DigitalAccount | undefined {
    return (this.data.digitalAccounts || []).find(a => a.id === accountId);
  }

  public getAccountCredentialsForAdmin(productId: string, adminEmail: string): {
    email: string;
    password?: string;
    thankYouMessage?: string;
    customerInstructions?: string;
    accountId?: string;
  } | null {
    const product = this.getProductById(productId);
    if (!product) return null;

    const availableAcc = (this.data.digitalAccounts || []).find(
      a => a.productId === productId && a.status === 'AVAILABLE'
    );

    if (availableAcc) {
      this.logActivity(
        adminEmail,
        'CONSULTATION_IDENTIFIANTS_COMPTE',
        product.name,
        `Consultation sécurisée des identifiants du compte ${availableAcc.email}`
      );
      return {
        email: availableAcc.email,
        password: decryptAccountPassword(availableAcc.passwordEncrypted),
        thankYouMessage: availableAcc.thankYouMessage || product.thankYouMessage,
        customerInstructions: availableAcc.customerInstructions || product.customerInstructions,
        accountId: availableAcc.id,
      };
    }

    return {
      email: product.accountCredentials?.email || '',
      password: '',
      thankYouMessage: product.thankYouMessage,
      customerInstructions: product.customerInstructions,
    };
  }

  public addDigitalAccount(
    productId: string,
    data: {
      email: string;
      password: string;
      thankYouMessage?: string;
      durationText?: string;
      durationDays?: number;
      expiresAt?: string;
      customerInstructions?: string;
      adminNotes?: string;
    },
    adminEmail: string
  ): Omit<DigitalAccount, 'passwordEncrypted'> & { passwordMasked: string } {
    const product = this.getProductById(productId);
    if (!product) throw new Error('Produit introuvable.');

    const cleanEmail = (data.email || '').trim();
    const cleanPassword = (data.password || '').trim();

    if (!cleanEmail) throw new Error('L\'identifiant ou adresse email du compte est obligatoire.');
    if (!cleanPassword) throw new Error('Le mot de passe du compte est obligatoire.');

    // Ensure product is recognized as COMPTE delivery type
    if (product.deliveryType !== 'COMPTE') {
      product.deliveryType = 'COMPTE';
      product.updatedAt = new Date().toISOString();
    }

    // Check for duplicate available account with exact same email on this product
    const exists = (this.data.digitalAccounts || []).some(
      a => a.productId === productId && a.status === 'AVAILABLE' && a.email.toLowerCase() === cleanEmail.toLowerCase()
    );
    if (exists) {
      throw new Error(`Un compte disponible avec l'identifiant "${cleanEmail}" existe déjà pour ce produit.`);
    }

    // Compute expiration date if duration specified
    let durationDays = data.durationDays;
    let durationText = (data.durationText || '').trim();
    if (!durationText && !durationDays) {
      durationText = '30 jours';
      durationDays = 30;
    } else if (!durationDays && durationText) {
      const match = durationText.match(/\d+/);
      if (match) durationDays = parseInt(match[0], 10);
    }

    let calculatedExpiresAt = data.expiresAt;
    if (!calculatedExpiresAt && durationDays) {
      calculatedExpiresAt = new Date(Date.now() + durationDays * 86400000).toISOString();
    }

    // Secure reversible AES-256-GCM encryption for stored password
    const encryptedPassword = encryptAccountPassword(cleanPassword);

    const now = new Date().toISOString();
    const newAccount: DigitalAccount = {
      id: `acc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      productId,
      productName: product.name,
      email: cleanEmail,
      passwordEncrypted: encryptedPassword,
      thankYouMessage: (data.thankYouMessage || '').trim() || product.thankYouMessage || undefined,
      durationText: durationText || (durationDays ? `${durationDays} jours` : undefined),
      durationDays,
      expiresAt: calculatedExpiresAt,
      customerInstructions: (data.customerInstructions || '').trim() || undefined,
      adminNotes: (data.adminNotes || '').trim() || undefined,
      status: 'AVAILABLE',
      createdAt: now,
      updatedAt: now,
    };

    if (!Array.isArray(this.data.digitalAccounts)) {
      this.data.digitalAccounts = [];
    }
    this.data.digitalAccounts.push(newAccount);

    // Sync product stock with available accounts
    const availableCount = this.data.digitalAccounts.filter(a => a.productId === productId && a.status === 'AVAILABLE').length;
    product.stock = availableCount;
    product.updatedAt = now;

    // Audit log without exposing password
    this.logActivity(
      adminEmail,
      'AJOUT_COMPTE_NUMERIQUE',
      product.name,
      `Ajout du compte "${cleanEmail}" (${durationText || 'Durée standard'}) (Stock dispo: ${product.stock})`
    );
    this.save();

    return {
      id: newAccount.id,
      productId: newAccount.productId,
      productName: newAccount.productName,
      email: newAccount.email,
      passwordMasked: maskPassword(12),
      thankYouMessage: newAccount.thankYouMessage,
      durationText: newAccount.durationText,
      durationDays: newAccount.durationDays,
      expiresAt: newAccount.expiresAt,
      customerInstructions: newAccount.customerInstructions,
      adminNotes: newAccount.adminNotes,
      status: newAccount.status,
      createdAt: newAccount.createdAt,
      updatedAt: newAccount.updatedAt,
    };
  }

  public importDigitalAccountsBatch(
    productId: string,
    rawBatchText: string,
    defaultDuration: string = '30 jours',
    adminEmail: string
  ): {
    totalGiven: number;
    addedCount: number;
    newStock: number;
    errors: { line: number; text: string; error: string }[];
  } {
    const product = this.getProductById(productId);
    if (!product) throw new Error('Produit introuvable.');

    if (product.deliveryType !== 'COMPTE') {
      product.deliveryType = 'COMPTE';
      product.updatedAt = new Date().toISOString();
    }

    const lines = (rawBatchText || '')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const errors: { line: number; text: string; error: string }[] = [];
    let addedCount = 0;

    const seenInSession = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      // Supported format: email | password | [duration] | [instructions]
      const parts = lineText.split('|').map(p => p.trim());
      if (parts.length < 2) {
        errors.push({
          line: i + 1,
          text: lineText,
          error: 'Format invalide : séparez au minimum l\'identifiant et le mot de passe avec "|" (ex: test@mail.com | pass123)',
        });
        continue;
      }

      const email = parts[0];
      const password = parts[1];
      const duration = parts[2] || defaultDuration || '30 jours';
      const instructions = parts[3] || undefined;

      if (!email || !password) {
        errors.push({
          line: i + 1,
          text: lineText,
          error: 'Identifiant ou mot de passe manquant sur cette ligne',
        });
        continue;
      }

      const emailLower = email.toLowerCase();
      if (seenInSession.has(emailLower)) {
        errors.push({
          line: i + 1,
          text: lineText,
          error: `Doublon détecté dans le lot d'importation (${email})`,
        });
        continue;
      }
      seenInSession.add(emailLower);

      // Check if already available in DB for this product
      const alreadyInDb = (this.data.digitalAccounts || []).some(
        a => a.productId === productId && a.status === 'AVAILABLE' && a.email.toLowerCase() === emailLower
      );
      if (alreadyInDb) {
        errors.push({
          line: i + 1,
          text: lineText,
          error: `Un compte disponible avec l'identifiant "${email}" existe déjà en stock`,
        });
        continue;
      }

      // Compute expiration
      let days = 30;
      const match = duration.match(/\d+/);
      if (match) days = parseInt(match[0], 10);
      const expiresAt = new Date(Date.now() + days * 86400000).toISOString();

      const encryptedPassword = encryptAccountPassword(password);
      const now = new Date().toISOString();

      const newAcc: DigitalAccount = {
        id: `acc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        productId,
        productName: product.name,
        email,
        passwordEncrypted: encryptedPassword,
        durationText: duration,
        durationDays: days,
        expiresAt,
        customerInstructions: instructions,
        status: 'AVAILABLE',
        createdAt: now,
        updatedAt: now,
      };

      if (!Array.isArray(this.data.digitalAccounts)) {
        this.data.digitalAccounts = [];
      }
      this.data.digitalAccounts.push(newAcc);
      addedCount++;
    }

    // Sync product stock
    const availableCount = this.data.digitalAccounts.filter(a => a.productId === productId && a.status === 'AVAILABLE').length;
    product.stock = availableCount;
    product.updatedAt = new Date().toISOString();

    this.logActivity(
      adminEmail,
      'IMPORT_COMPTES_LOT',
      product.name,
      `Import par lot : ${addedCount} comptes ajoutés avec succès sur ${lines.length} lignes soumises (Stock: ${product.stock})`
    );
    this.save();

    return {
      totalGiven: lines.length,
      addedCount,
      newStock: product.stock,
      errors,
    };
  }

  public updateDigitalAccount(
    accountId: string,
    updates: {
      email?: string;
      password?: string;
      thankYouMessage?: string;
      durationText?: string;
      durationDays?: number;
      expiresAt?: string;
      customerInstructions?: string;
      adminNotes?: string;
    },
    adminEmail: string
  ): Omit<DigitalAccount, 'passwordEncrypted'> & { passwordMasked: string } {
    const acc = (this.data.digitalAccounts || []).find(a => a.id === accountId);
    if (!acc) throw new Error('Compte numérique introuvable.');

    // If account was already delivered or assigned, forbid changing critical credentials
    if (acc.status !== 'AVAILABLE') {
      if (updates.email && updates.email.trim().toLowerCase() !== acc.email.toLowerCase()) {
        throw new Error('Impossible de modifier l\'identifiant d\'un compte déjà attribué ou livré à un client.');
      }
      if (updates.password && updates.password.trim()) {
        throw new Error('Impossible de modifier le mot de passe d\'un compte déjà attribué ou livré à un client.');
      }
    }

    if (updates.email && updates.email.trim()) {
      acc.email = updates.email.trim();
    }
    if (updates.password && updates.password.trim()) {
      acc.passwordEncrypted = encryptAccountPassword(updates.password.trim());
    }
    if (updates.thankYouMessage !== undefined) {
      acc.thankYouMessage = updates.thankYouMessage.trim() || undefined;
    }
    if (updates.durationText !== undefined) {
      acc.durationText = updates.durationText.trim();
    }
    if (updates.durationDays !== undefined) {
      acc.durationDays = updates.durationDays;
    }
    if (updates.expiresAt !== undefined) {
      acc.expiresAt = updates.expiresAt;
    }
    if (updates.customerInstructions !== undefined) {
      acc.customerInstructions = updates.customerInstructions.trim();
    }
    if (updates.adminNotes !== undefined) {
      acc.adminNotes = updates.adminNotes.trim();
    }

    acc.updatedAt = new Date().toISOString();
    this.logActivity(
      adminEmail,
      'MODIFICATION_COMPTE_NUMERIQUE',
      acc.productName || acc.productId,
      `Mise à jour des informations du compte "${acc.email}" (ID: ${acc.id})`
    );
    this.save();

    return {
      id: acc.id,
      productId: acc.productId,
      productName: acc.productName,
      email: acc.email,
      passwordMasked: maskPassword(12),
      thankYouMessage: acc.thankYouMessage,
      durationText: acc.durationText,
      durationDays: acc.durationDays,
      expiresAt: acc.expiresAt,
      customerInstructions: acc.customerInstructions,
      adminNotes: acc.adminNotes,
      status: acc.status,
      orderId: acc.orderId,
      userId: acc.userId,
      userEmail: acc.userEmail,
      assignedAt: acc.assignedAt,
      deliveredAt: acc.deliveredAt,
      createdAt: acc.createdAt,
      updatedAt: acc.updatedAt,
    };
  }

  public deleteDigitalAccount(accountId: string, adminEmail: string) {
    const acc = (this.data.digitalAccounts || []).find(a => a.id === accountId);
    if (!acc) throw new Error('Compte numérique introuvable.');

    if (acc.status !== 'AVAILABLE') {
      throw new Error('Impossible de supprimer un compte déjà attribué ou livré. L\'historique d\'achat doit être préservé.');
    }

    const productId = acc.productId;
    const accountEmail = acc.email;

    this.data.digitalAccounts = this.data.digitalAccounts.filter(a => a.id !== accountId);

    const product = this.getProductById(productId);
    if (product) {
      product.stock = this.data.digitalAccounts.filter(a => a.productId === productId && a.status === 'AVAILABLE').length;
      product.updatedAt = new Date().toISOString();
    }

    this.logActivity(
      adminEmail,
      'SUPPRESSION_COMPTE_NUMERIQUE',
      product ? product.name : productId,
      `Suppression du compte disponible "${accountEmail}" (ID: ${accountId})`
    );
    this.save();
  }

  public revealAccountPasswordForAdmin(accountId: string, adminEmail: string): string {
    const acc = (this.data.digitalAccounts || []).find(a => a.id === accountId);
    if (!acc) throw new Error('Compte numérique introuvable.');

    // Security audit log for viewing sensitive password
    this.logActivity(
      adminEmail,
      'CONSULTATION_MDP_COMPTE',
      acc.productName || acc.productId,
      `Consultation sécurisée du mot de passe pour le compte "${acc.email}" (ID: ${acc.id})`
    );
    this.save();

    return decryptAccountPassword(acc.passwordEncrypted);
  }

  // ==================== MEDIA / IMAGES MANAGEMENT ====================

  public getMediaList(): Media[] {
    return [...(this.data.media || [])].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getMediaById(id: string): Media | undefined {
    return (this.data.media || []).find(m => m.id === id);
  }

  public getMediaUsage(mediaIdOrUrl: string): { count: number; products: { id: string; name: string }[] } {
    const media = this.getMediaById(mediaIdOrUrl);
    const url = media ? media.url : mediaIdOrUrl;
    const id = media ? media.id : mediaIdOrUrl;

    const usedInProducts: { id: string; name: string }[] = [];
    for (const p of this.data.products) {
      const isMainImage = p.imageId === id || p.image === url;
      const isGalleryImage = Array.isArray(p.galleryImages) && p.galleryImages.includes(url);
      const isGalleryId = Array.isArray(p.galleryMediaIds) && p.galleryMediaIds.includes(id);
      if (isMainImage || isGalleryImage || isGalleryId) {
        usedInProducts.push({ id: p.id, name: p.name });
      }
    }
    return {
      count: usedInProducts.length,
      products: usedInProducts,
    };
  }

  public saveMedia(
    mediaData: {
      id?: string;
      filename: string;
      originalFilename: string;
      mimeType: string;
      size: number;
      url: string;
      storageKey: string;
      width?: number;
      height?: number;
      uploadedBy: string;
      altText?: string;
    },
    adminEmail: string
  ): Media {
    if (!this.data.media) {
      this.data.media = [];
    }

    const id = mediaData.id || `med-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const existingIndex = this.data.media.findIndex(m => m.id === id);
    if (existingIndex >= 0) {
      const existing = this.data.media[existingIndex];
      const updated: Media = {
        ...existing,
        ...mediaData,
        id,
        updatedAt: now,
      };
      this.data.media[existingIndex] = updated;
      this.logActivity(
        adminEmail,
        'MODIFICATION_MEDIA',
        updated.filename,
        `Mise à jour métadonnées média ${updated.filename}`
      );
      this.save();
      return updated;
    }

    const newMedia: Media = {
      id,
      filename: mediaData.filename,
      originalFilename: mediaData.originalFilename,
      mimeType: mediaData.mimeType,
      size: mediaData.size,
      url: mediaData.url,
      storageKey: mediaData.storageKey,
      width: mediaData.width,
      height: mediaData.height,
      createdAt: now,
      updatedAt: now,
      uploadedBy: adminEmail || mediaData.uploadedBy,
      altText: mediaData.altText || '',
    };

    this.data.media.unshift(newMedia);
    this.logActivity(
      adminEmail,
      'TELEVERSEMENT_MEDIA',
      newMedia.filename,
      `Nouveau média téléversé : ${newMedia.filename} (${Math.round(newMedia.size / 1024)} Ko)`
    );
    this.save();
    return newMedia;
  }

  public updateMediaMetadata(
    id: string,
    updates: { altText?: string; originalFilename?: string },
    adminEmail: string
  ): Media {
    const media = this.getMediaById(id);
    if (!media) throw new Error('Média introuvable');

    if (updates.altText !== undefined) media.altText = updates.altText;
    if (updates.originalFilename !== undefined) media.originalFilename = updates.originalFilename;
    media.updatedAt = new Date().toISOString();

    this.logActivity(
      adminEmail,
      'MODIFICATION_MEDIA',
      media.filename,
      `Mise à jour titre/altText pour ${media.filename}`
    );
    this.save();
    return media;
  }

  public deleteMedia(
    id: string,
    adminEmail: string,
    force = false
  ): { success: boolean; message: string; usedInProducts?: { id: string; name: string }[] } {
    const media = this.getMediaById(id);
    if (!media) throw new Error('Média introuvable');

    const usage = this.getMediaUsage(id);
    if (usage.count > 0 && !force) {
      return {
        success: false,
        message: `Ce média est utilisé par ${usage.count} produit(s). Veuillez retirer son utilisation ou confirmer la suppression forcée.`,
        usedInProducts: usage.products,
      };
    }

    // Delete file from disk in data/uploads/
    try {
      const filePath = path.join(process.cwd(), 'data', 'uploads', media.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.warn(`Could not delete file ${media.filename} from disk:`, err);
    }

    this.data.media = (this.data.media || []).filter(m => m.id !== id);
    this.logActivity(adminEmail, 'SUPPRESSION_MEDIA', media.filename, `Suppression du média ${media.filename}`);
    this.save();

    return {
      success: true,
      message: 'Média supprimé avec succès de la bibliothèque.',
      usedInProducts: usage.products,
    };
  }

  // ==================== CART PERSISTENCE (SERVER AUTHORITATIVE) ====================
  public getUserCart(userId: string): CartItem[] {
    if (!this.data.carts) this.data.carts = {};
    const userItems = this.data.carts[userId] || [];
    const validItems: CartItem[] = [];
    let modified = false;

    for (const item of userItems) {
      if (!item?.product?.id) {
        modified = true;
        continue;
      }
      const p = this.getProductById(item.product.id);
      if (p && p.status === 'published' && p.stock > 0) {
        const qty = Math.min(item.quantity || 1, p.stock);
        if (qty !== item.quantity) modified = true;
        validItems.push({
          ...item,
          product: p,
          quantity: qty,
        });
      } else {
        modified = true;
      }
    }

    if (modified || !this.data.carts[userId]) {
      this.data.carts[userId] = validItems;
      this.save();
    }
    return validItems;
  }

  public setUserCart(userId: string, items: CartItem[]): CartItem[] {
    if (!this.data.carts) this.data.carts = {};
    const cleanItems: CartItem[] = [];

    for (const item of items) {
      if (!item?.product?.id) continue;
      const p = this.getProductById(item.product.id);
      if (p && p.status === 'published' && p.stock > 0) {
        const q = Math.max(1, Math.min(item.quantity || 1, p.stock));
        cleanItems.push({
          ...item,
          product: p,
          quantity: q,
        });
      }
    }

    this.data.carts[userId] = cleanItems;
    this.save();
    return cleanItems;
  }

  public addToUserCart(userId: string, item: CartItem): CartItem[] {
    const current = this.getUserCart(userId);
    const p = this.getProductById(item.product.id);
    if (!p || p.status !== 'published') {
      throw new Error('Pwodui sa a pa disponib kounye a.');
    }
    if (p.stock <= 0) {
      throw new Error('Rupti de stock pou pwodui sa a.');
    }

    const existingIdx = current.findIndex(ci => ci.product.id === item.product.id);
    const addQty = Math.max(1, item.quantity || 1);

    if (existingIdx > -1) {
      const newQty = Math.min(current[existingIdx].quantity + addQty, p.stock);
      current[existingIdx] = {
        ...current[existingIdx],
        product: p,
        quantity: newQty,
        playerIdentifier: item.playerIdentifier || current[existingIdx].playerIdentifier,
        customerWhatsApp: item.customerWhatsApp || current[existingIdx].customerWhatsApp,
        accountEmail: item.accountEmail || current[existingIdx].accountEmail,
        accountName: item.accountName || current[existingIdx].accountName,
        customRequirement: item.customRequirement || current[existingIdx].customRequirement,
        verificationToken: item.verificationToken || current[existingIdx].verificationToken,
        verifiedInfo: item.verifiedInfo || current[existingIdx].verifiedInfo,
      };
    } else {
      current.push({
        ...item,
        product: p,
        quantity: Math.min(addQty, p.stock),
      });
    }

    this.data.carts[userId] = current;
    this.save();
    return current;
  }

  public updateUserCartItem(userId: string, productId: string, quantity: number, details?: Partial<CartItem>): CartItem[] {
    const current = this.getUserCart(userId);
    const p = this.getProductById(productId);

    if (quantity <= 0) {
      this.data.carts[userId] = current.filter(ci => ci.product.id !== productId);
      this.save();
      return this.data.carts[userId];
    }

    const maxStock = p ? p.stock : 50;
    this.data.carts[userId] = current.map(ci => {
      if (ci.product.id === productId) {
        return {
          ...ci,
          ...details,
          quantity: Math.min(quantity, maxStock),
          product: p || ci.product,
        };
      }
      return ci;
    });

    this.save();
    return this.data.carts[userId];
  }

  public removeFromUserCart(userId: string, productId: string): CartItem[] {
    const current = this.getUserCart(userId);
    this.data.carts[userId] = current.filter(ci => ci.product.id !== productId);
    this.save();
    return this.data.carts[userId];
  }

  public clearUserCart(userId: string): void {
    if (!this.data.carts) this.data.carts = {};
    this.data.carts[userId] = [];
    this.save();
  }

  // ==================== ATOMIC CHECKOUT & ORDERS ====================
  public executeAtomicCheckout(
    userId: string,
    cartItems: {
      productId: string;
      quantity: number;
      playerIdentifier?: string;
      verificationToken?: string;
      customerWhatsApp?: string;
      accountEmail?: string;
      accountName?: string;
      customRequirement?: string;
    }[],
    orderWhatsApp?: string,
    idempotencyKey?: string,
    couponCode?: string
  ): { order: Order; libraryItems: CustomerLibraryItem[] } {
    if (!cartItems || cartItems.length === 0) {
      throw new Error('Le panier est vide.');
    }

    // Idempotency check: prevent duplicate checkout on double-clicks or retries
    if (idempotencyKey) {
      const cleanKey = `${userId}:${idempotencyKey.trim()}`;
      const cached = this.idempotencyCache.get(cleanKey);
      if (cached && (Date.now() - cached.timestamp < 15 * 60 * 1000)) {
        return { order: cached.order, libraryItems: cached.libraryItems };
      }
    }

    const user = this.getUserById(userId);
    if (!user) throw new Error('Utilisateur non trouvé.');
    if (user.status === 'blocked') throw new Error('Votre compte est suspendu. Veuillez contacter le support.');

    // 1. Calculate total and verify availability + player verification
    let totalHTG = 0;
    const validatedItems: {
      product: Product;
      quantity: number;
      playerIdentifier?: string;
      verificationToken?: string;
      platform?: PlatformOrGame;
      verifiedSession?: any;
      customerWhatsApp?: string;
      accountEmail?: string;
      accountName?: string;
      customRequirement?: string;
    }[] = [];

    for (const item of cartItems) {
      if (!item.productId || typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new Error(`Quantité invalide pour le produit (ID: ${item.productId}). La quantité doit être un nombre entier strictement supérieur à 0.`);
      }
      if (item.quantity > 50) {
        throw new Error(`Quantité maximale autorisée dépassée (maximum 50 unités par produit).`);
      }

      const p = this.getProductById(item.productId);
      if (!p) throw new Error(`Produit introuvable (ID: ${item.productId})`);
      if (p.status !== 'published') throw new Error(`Le produit "${p.name}" n'est pas disponible.`);
      if (p.stock < item.quantity) {
        throw new Error(`Rupture de stock pour "${p.name}". Stock disponible : ${p.stock}, demandé : ${item.quantity}.`);
      }

      // Check delivery inventory availability based on delivery type
      const deliveryMode = getProductDeliveryType(p);
      if (deliveryMode === 'COMPTE') {
        const availableAccounts = (this.data.digitalAccounts || []).filter(a => a.productId === p.id && a.status === 'AVAILABLE');
        if (availableAccounts.length < item.quantity) {
          throw new Error(`Inventaire insuffisant de comptes numériques pour "${p.name}". Comptes disponibles : ${availableAccounts.length}, demandé : ${item.quantity}.`);
        }
      } else if (deliveryMode === 'CODE') {
        const unusedCodes = this.data.digitalCodes.filter(c => c.productId === p.id && !c.isUsed);
        if (unusedCodes.length < item.quantity) {
          throw new Error(`Inventaire insuffisant de codes pour "${p.name}". Stock de codes disponible : ${unusedCodes.length}, demandé : ${item.quantity}.`);
        }
      }

      // Check Player ID verification requirement if platform demands it or product specifically requires it
      const platform = this.data.platforms.find(pl => pl.id === ((p as any).platformId || p.subcategoryId));
      let verifiedSession: any = null;
      const requiresVerification = !!(platform?.idVerification?.verificationEnabled || p.requiresPlayerIdVerification);

      if (requiresVerification) {
        const idFieldName = p.verificationIdFieldName || platform?.idVerification?.idFieldName || 'identifiant joueur (UID)';
        const cleanId = (item.playerIdentifier || '').trim();
        if (!cleanId) {
          throw new Error(`Le produit "${p.name}" requiert la saisie obligatoire de votre ${idFieldName}.`);
        }

        if (item.verificationToken) {
          const platformIdToUse = platform?.id || 'game';
          verifiedSession = gameVerificationService.validateVerificationToken(
            item.verificationToken,
            platformIdToUse,
            cleanId
          );
        }
      }

      totalHTG += p.priceHTG * item.quantity;
      validatedItems.push({
        product: p,
        quantity: item.quantity,
        playerIdentifier: item.playerIdentifier,
        verificationToken: item.verificationToken,
        platform,
        verifiedSession,
        customerWhatsApp: item.customerWhatsApp,
        accountEmail: item.accountEmail,
        accountName: item.accountName,
        customRequirement: item.customRequirement,
      });
    }

    // Check WhatsApp requirement
    const anyRequiresWhatsApp = validatedItems.some(i => i.product.requiresWhatsApp || i.product.deliveryType === 'MANUAL_WHATSAPP');
    let normalizedWhatsApp: string | undefined = undefined;

    if (anyRequiresWhatsApp) {
      const rawWhatsApp = orderWhatsApp || cartItems.find(i => i.customerWhatsApp)?.customerWhatsApp;
      if (!rawWhatsApp || !rawWhatsApp.trim()) {
        const prodNames = validatedItems.filter(i => i.product.requiresWhatsApp || i.product.deliveryType === 'MANUAL_WHATSAPP').map(i => i.product.name).join(', ');
        throw new Error(`Le numéro WhatsApp est obligatoire pour finaliser la commande de : ${prodNames}.`);
      }

      const phoneResult = normalizeWhatsAppNumber(rawWhatsApp);
      if (!phoneResult.valid) {
        throw new Error(phoneResult.error || 'Format de numéro WhatsApp invalide. Veuillez fournir un numéro valide (ex: +509 34 58 4287).');
      }
      normalizedWhatsApp = phoneResult.normalized;
    }

    // 2. Coupon Validation & Subtotal / Discount Calculation (Server-authoritative)
    const subtotalHTG = totalHTG;
    let discountHTG = 0;
    let appliedCouponValidation: CouponValidationResult | undefined = undefined;

    if (couponCode && couponCode.trim()) {
      const couponValidation = this.validateCoupon(couponCode.trim(), userId, subtotalHTG);
      if (!couponValidation.valid) {
        throw new Error(couponValidation.message || 'Le coupon de réduction fourni est invalide.');
      }
      discountHTG = couponValidation.discountHTG;
      totalHTG = couponValidation.newTotalHTG;
      appliedCouponValidation = couponValidation;
    }

    // 3. Check user wallet balance
    const wallet = this.getWalletByUserId(userId);
    if (wallet.balanceHTG < totalHTG) {
      throw new Error(`Solde insuffisant (${wallet.balanceHTG.toLocaleString()} HTG disponible, ${totalHTG.toLocaleString()} HTG requis). Veuillez recharger votre portefeuille.`);
    }

    // 4. ATOMIC EXECUTION: debit wallet, lock codes, update stocks, create order & library items
    const orderId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randDigits = Math.floor(100000 + Math.random() * 900000);
    const orderNumber = `GT-${dateStr}-${randDigits}`;
    const orderCreatedAt = now.toISOString();

    const isManualService = anyRequiresWhatsApp || validatedItems.some(i => i.product.productType === 'service' || i.product.deliveryType === 'MANUAL_WHATSAPP');
    const orderStatus: OrderStatus = isManualService ? 'PROCESSING' : 'COMPLETED';
    const deliveryType: OrderDeliveryType = isManualService ? 'MANUAL_SERVICE' : 'DIGITAL_INSTANT';

    // Consume coupon if applied
    if (appliedCouponValidation) {
      if (appliedCouponValidation.type === 'PROMOTIONAL') {
        const promoCoupon = this.getPromotionalCouponById(appliedCouponValidation.couponId || '') 
          || this.getPromotionalCouponByCode(appliedCouponValidation.code);
        if (!promoCoupon) {
          throw new Error('Coupon promotionnel introuvable.');
        }
        // Atomic check: re-verify availability inside lock
        const freshStatus = this.computePromotionalCouponStatus(promoCoupon);
        if (freshStatus !== 'ACTIVE' || !promoCoupon.isActive) {
          throw new Error(`Ce coupon promotionnel n'est plus disponible (${freshStatus === 'EXHAUSTED' ? 'épuisé' : 'inactif'}).`);
        }
        const maxPerCust = typeof promoCoupon.maxUsesPerCustomer === 'number' ? promoCoupon.maxUsesPerCustomer : 1;
        if (maxPerCust > 0) {
          const userUsages = (this.data.promotionalCouponUsages || []).filter(
            u => u.couponId === promoCoupon.id && u.userId === userId && !u.isRefunded
          ).length;
          if (userUsages >= maxPerCust) {
            throw new Error('Vous avez déjà atteint la limite d\'utilisations pour ce coupon promotionnel.');
          }
        }
        // Increment usage count atomically
        promoCoupon.currentUses = (promoCoupon.currentUses || 0) + 1;
        promoCoupon.status = this.computePromotionalCouponStatus(promoCoupon);
        promoCoupon.updatedAt = orderCreatedAt;

        // Record usage history
        const promoUsage: PromotionalCouponUsage = {
          id: `usage-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          couponId: promoCoupon.id,
          couponCode: promoCoupon.code,
          userId,
          userEmail: user.email,
          userName: user.name,
          orderId,
          orderNumber,
          orderStatus,
          subtotalHTG,
          discountHTG: appliedCouponValidation.discountHTG,
          finalTotalHTG: totalHTG,
          usedAt: orderCreatedAt,
          isRefunded: false,
        };
        if (!this.data.promotionalCouponUsages) {
          this.data.promotionalCouponUsages = [];
        }
        this.data.promotionalCouponUsages.unshift(promoUsage);
      } else if (appliedCouponValidation.reward) {
        const appliedCouponReward = appliedCouponValidation.reward;
        appliedCouponReward.usedCount = (appliedCouponReward.usedCount || 0) + 1;
        if (appliedCouponReward.usedCount >= (appliedCouponReward.maxUses || 1)) {
          appliedCouponReward.status = 'used';
        }
        appliedCouponReward.usedAt = orderCreatedAt;
        appliedCouponReward.usedAtOrderId = orderId;
      }
    }

    // Debit wallet
    const previousBalance = wallet.balanceHTG;
    wallet.balanceHTG = Math.round((wallet.balanceHTG - totalHTG) * 100) / 100;
    wallet.updatedAt = orderCreatedAt;

    const tx: WalletTransaction = {
      id: `tx-ord-${orderId}`,
      walletId: wallet.id,
      userId,
      type: 'PURCHASE',
      amountHTG: totalHTG,
      previousBalanceHTG: previousBalance,
      newBalanceHTG: wallet.balanceHTG,
      referenceId: orderNumber,
      description: appliedCouponValidation
        ? `Achat commande ${orderNumber} (Remise coupon -${discountHTG.toLocaleString()} HTG)`
        : `Achat commande ${orderNumber} (${validatedItems.map(i => i.product.name).join(', ')})`,
      createdAt: orderCreatedAt,
    };
    this.data.walletTransactions.unshift(tx);

    // Build order items & library items
    const orderItems: OrderItem[] = [];
    const generatedLibraryItems: CustomerLibraryItem[] = [];

    for (const item of validatedItems) {
      const p = item.product;
      const verified = item.verifiedSession;
      const isVerifiedRequired = !!item.platform?.idVerification?.verificationEnabled;
      const itemRequiresWhatsApp = !!(p.requiresWhatsApp || p.deliveryType === 'MANUAL_WHATSAPP');
      const itemWhatsApp = itemRequiresWhatsApp ? (normalizedWhatsApp || (item.customerWhatsApp ? normalizeWhatsAppNumber(item.customerWhatsApp).normalized : undefined)) : undefined;

      const deliveryMode = getProductDeliveryType(p);

      for (let q = 0; q < item.quantity; q++) {
        let assignedCodeStr: string | undefined = undefined;
        let deliveredAccountInfo: DeliveredAccountInfo | undefined = undefined;
        let deliveredDownloadUrl: string | undefined = undefined;

        if (deliveryMode === 'DOWNLOAD_LINK') {
          if (!isValidHttpsDownloadUrl(p.downloadUrl)) {
            throw new Error(`Lien de téléchargement non configuré pour le produit "${p.name}". Contactez l'administrateur.`);
          }
          deliveredDownloadUrl = p.downloadUrl;
          p.stock = Math.max(0, p.stock - 1);
          p.updatedAt = orderCreatedAt;
        } else if (deliveryMode === 'COMPTE') {
          // Atomic assignment of available digital account
          const availableAccount = (this.data.digitalAccounts || []).find(
            a => a.productId === p.id && a.status === 'AVAILABLE'
          );
          if (!availableAccount) {
            // STRICT REQUIREMENT: NEVER return fake dummy values like "NETFLIX-TEST-002"
            throw new Error(`Rupture imprévue : aucun compte numérique disponible pour "${p.name}". Veuillez réapprovisionner.`);
          }

          // Atomic reserve & delivery
          availableAccount.status = 'DELIVERED';
          availableAccount.orderId = orderId;
          availableAccount.userId = userId;
          availableAccount.userEmail = user.email;
          availableAccount.assignedAt = orderCreatedAt;
          availableAccount.deliveredAt = orderCreatedAt;

          if (!availableAccount.expiresAt && availableAccount.durationDays) {
            availableAccount.expiresAt = new Date(Date.now() + availableAccount.durationDays * 86400000).toISOString();
          }

          const plainPassword = decryptAccountPassword(availableAccount.passwordEncrypted);
          deliveredAccountInfo = {
            id: availableAccount.id,
            productId: p.id,
            productName: p.name,
            email: availableAccount.email,
            loginEmail: availableAccount.email,
            password: plainPassword,
            thankYouMessage: availableAccount.thankYouMessage || p.thankYouMessage,
            durationText: availableAccount.durationText || '30 jours',
            durationDays: availableAccount.durationDays,
            expiresAt: availableAccount.expiresAt,
            status: 'ACTIVE',
            customerInstructions: availableAccount.customerInstructions || p.customerInstructions,
            instructions: availableAccount.customerInstructions || p.customerInstructions,
            assignedAt: orderCreatedAt,
          };

          // Synchronize product stock with remaining AVAILABLE accounts
          p.stock = (this.data.digitalAccounts || []).filter(a => a.productId === p.id && a.status === 'AVAILABLE').length;
          p.updatedAt = orderCreatedAt;
        } else if (deliveryMode === 'CODE') {
          // If digital instant code, pop an unused code ONLY IF NOT a manual WhatsApp service
          if (!itemRequiresWhatsApp && p.deliveryType !== 'MANUAL_WHATSAPP') {
            const codeObj = this.data.digitalCodes.find(c => c.productId === p.id && !c.isUsed);
            if (codeObj) {
              codeObj.isUsed = true;
              codeObj.usedByUserId = userId;
              codeObj.usedAtOrderId = orderId;
              codeObj.usedAt = orderCreatedAt;
              assignedCodeStr = codeObj.code;
            }
          }
          p.stock = Math.max(0, p.stock - 1);
          p.updatedAt = orderCreatedAt;
        } else {
          // Manual service
          p.stock = Math.max(0, p.stock - 1);
          p.updatedAt = orderCreatedAt;
        }

        let accessDetails = assignedCodeStr;
        if (deliveredDownloadUrl) {
          accessDetails = 'Téléchargement disponible';
        } else if (deliveredAccountInfo) {
          accessDetails = `Compte numérique : ${deliveredAccountInfo.email}`;
        } else if (!accessDetails) {
          if (verified) {
            accessDetails = `Recharge confirmée : ${verified.playerName} (ID: ${item.playerIdentifier}) - Région : ${verified.region || 'Standard'}`;
          } else if (item.playerIdentifier) {
            accessDetails = `Recharge Player ID : ${item.playerIdentifier}`;
          } else if (itemRequiresWhatsApp) {
            accessDetails = `Service nécessitant un traitement direct par notre équipe via WhatsApp (${itemWhatsApp}).`;
          } else {
            accessDetails = 'Accès activé';
          }
        }

        // Create library item for customer immediate access
        const libItem: CustomerLibraryItem = {
          id: `lib-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          userId,
          orderId,
          productId: p.id,
          productName: p.name,
          productImage: p.image,
          productType: p.productType,
          deliveryType: (p.deliveryType || deliveryMode) as DeliveryType,
          digitalCode: assignedCodeStr,
          deliveredAccount: deliveredAccountInfo,
          thankYouMessage: deliveredAccountInfo?.thankYouMessage || p.thankYouMessage,
          downloadUrl: deliveredDownloadUrl,
          deliveredDownloadUrl,
          accessDetails,
          playerIdentifier: item.playerIdentifier,
          verifiedPlayerName: verified?.playerName,
          verifiedRegion: verified?.region,
          verifiedServer: verified?.server,
          verificationStatus: isVerifiedRequired ? (verified ? 'VERIFIED' : 'UNVERIFIED') : 'NOT_REQUIRED',
          requiresWhatsApp: itemRequiresWhatsApp,
          customerWhatsApp: itemWhatsApp,
          accountCredentials: deliveredAccountInfo ? {
            email: deliveredAccountInfo.email,
            password: deliveredAccountInfo.password,
          } : ((p.productType === 'account' || p.productType === 'access') ? {
            email: item.accountEmail || p.accountCredentials?.email,
            password: p.accountCredentials?.password,
            profile: item.accountName || p.accountCredentials?.profile,
          } : undefined),
          instructions: deliveredDownloadUrl
            ? (p.customerInstructions || p.deliveryInstructions || 'Votre produit numérique est prêt pour le téléchargement. Cliquez sur le bouton Télécharger pour démarrer.')
            : itemRequiresWhatsApp
            ? `Ce service nécessite un traitement direct par notre équipe. Vous serez contacté sur WhatsApp au ${itemWhatsApp}. ${p.customerInstructions || p.deliveryInstructions || ''}`
            : (deliveredAccountInfo?.customerInstructions || p.customerInstructions || p.deliveryInstructions || 'Produit numérique disponible dans votre bibliothèque.'),
          purchasedAt: orderCreatedAt,
        };

        generatedLibraryItems.push(libItem);
        this.data.customerLibrary.unshift(libItem);
      }

      // Mark verification token as consumed
      if (item.verificationToken) {
        gameVerificationService.consumeToken(item.verificationToken);
      }

      const lastDeliveredAccount = generatedLibraryItems.find(l => l.productId === p.id && l.deliveredAccount)?.deliveredAccount;
      const lastDeliveredDownloadUrl = generatedLibraryItems.find(l => l.productId === p.id && l.downloadUrl)?.downloadUrl;

      orderItems.push({
        productId: p.id,
        productName: p.name,
        productImage: p.image,
        priceHTG: p.priceHTG,
        quantity: item.quantity,
        productType: p.productType,
        assignedCode: generatedLibraryItems.filter(l => l.productId === p.id).map(l => l.digitalCode).filter(Boolean).join(' | '),
        deliveredAccount: lastDeliveredAccount,
        thankYouMessage: lastDeliveredAccount?.thankYouMessage || p.thankYouMessage,
        deliveredDownloadUrl: lastDeliveredDownloadUrl,
        downloadUrl: lastDeliveredDownloadUrl,
        deliveryDetails: lastDeliveredDownloadUrl ? `Lien de téléchargement : ${lastDeliveredDownloadUrl}` : undefined,
        playerIdentifier: item.playerIdentifier,
        accountEmail: lastDeliveredAccount?.email || item.accountEmail,
        accountName: item.accountName,
        customRequirement: item.customRequirement,
        verifiedPlayerName: verified?.playerName,
        verifiedRegion: verified?.region,
        verifiedServer: verified?.server,
        verificationDate: verified?.verifiedAt || orderCreatedAt,
        verificationStatus: isVerifiedRequired ? (verified ? 'VERIFIED' : 'UNVERIFIED') : 'NOT_REQUIRED',
        verificationProvider: verified?.provider,
        verificationRef: verified?.providerRef,
        requiresWhatsApp: itemRequiresWhatsApp,
        customerWhatsApp: itemWhatsApp,
      });

      // Stock warning for admin if stock hits 0 or <= lowStockThreshold
      const lowThreshold = p.lowStockThreshold !== undefined ? p.lowStockThreshold : 3;
      if (p.stock <= lowThreshold) {
        this.data.notifications.push({
          id: `notif-stock-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          target: 'admin',
          title: p.stock === 0 ? 'RUPTURE DE STOCK' : 'STOCK FAIBLE',
          message: `Le produit "${p.name}" a maintenant un stock de ${p.stock} (Seuil d'alerte: ${lowThreshold}).`,
          type: 'stock',
          isRead: false,
          createdAt: orderCreatedAt,
        });
      }
    }

    const statusHistory: OrderStatusHistory[] = [
      {
        status: 'PAID',
        timestamp: orderCreatedAt,
        updatedBy: 'SYSTEM',
        note: `Paiement Wallet validé (${totalHTG.toLocaleString()} HTG)`,
      }
    ];

    if (orderStatus === 'PROCESSING') {
      statusHistory.push({
        status: 'PROCESSING',
        timestamp: orderCreatedAt,
        updatedBy: 'SYSTEM',
        note: anyRequiresWhatsApp ? 'En attente de traitement WhatsApp' : 'Commande en cours de traitement',
      });
    } else if (orderStatus === 'COMPLETED') {
      statusHistory.push({
        status: 'COMPLETED',
        timestamp: orderCreatedAt,
        updatedBy: 'SYSTEM',
        note: 'Livraison digitale immédiate',
      });
    }

    const order: Order = {
      id: orderId,
      orderNumber,
      userId,
      customerEmail: user.email,
      customerName: user.name,
      totalHTG,
      totalAmountHTG: totalHTG,
      subtotalHTG,
      discountHTG,
      couponCode: appliedCouponValidation ? appliedCouponValidation.code : undefined,
      couponType: appliedCouponValidation ? appliedCouponValidation.type : undefined,
      couponId: appliedCouponValidation ? (appliedCouponValidation.couponId || (appliedCouponValidation.reward ? appliedCouponValidation.reward.id : undefined)) : undefined,
      discountPercent: appliedCouponValidation ? appliedCouponValidation.discountPercent : undefined,
      status: orderStatus,
      paymentStatus: 'PAID',
      digitalDeliveryStatus: isManualService ? 'PROCESSING' : 'DELIVERED',
      deliveryType,
      transactionId: tx.id,
      items: orderItems,
      requiresWhatsApp: anyRequiresWhatsApp,
      customerWhatsApp: normalizedWhatsApp,
      statusHistory,
      adminNotes: [],
      createdAt: orderCreatedAt,
    };

    this.data.orders.unshift(order);

    // Automatically check and unlock any earned loyalty rewards upon order completion
    this.checkAndUnlockLoyaltyRewards(userId);

    // Save in idempotency cache
    if (idempotencyKey) {
      const cleanKey = `${userId}:${idempotencyKey.trim()}`;
      this.idempotencyCache.set(cleanKey, {
        order,
        libraryItems: generatedLibraryItems,
        timestamp: Date.now(),
      });
    }

    // Clear cart for user after successful checkout
    this.clearUserCart(userId);

    // Customer order notification
    this.addNotification(
      userId,
      isManualService ? 'Kòmand anrejistre (Sèvis WhatsApp)' : 'Kòmand konfime & Peman resevwa !',
      isManualService
        ? `Kòmand #${orderNumber} ou an (${totalHTG.toLocaleString()} HTG) ap trete. Ekip nou an ap kontakte w sou ${normalizedWhatsApp}.`
        : `Kòmand #${orderNumber} ou an (${totalHTG.toLocaleString()} HTG) konfime ak siksè. Gade kòd ak detay ou yo nan "Pwodui Mwen".`,
      'order',
      {
        relatedEntityId: orderId,
        relatedEntityType: 'order',
        metadata: { orderNumber, totalHTG, isManualService, itemsCount: orderItems.length }
      }
    );

    // If order contains downloadable files, notify customer specifically
    const hasDownloadUrl = generatedLibraryItems.some(i => i.downloadUrl);
    if (hasDownloadUrl) {
      this.addNotification(
        userId,
        'Telechajman disponib !',
        `Fichye nimerik ou yo pou kòmand #${orderNumber} disponib pou telechaje nan seksyon "Pwodui Mwen".`,
        'delivery',
        {
          relatedEntityId: orderId,
          relatedEntityType: 'order',
          metadata: { orderNumber }
        }
      );
    }

    // If order contains account credentials, notify customer specifically
    const hasDeliveredAccount = generatedLibraryItems.some(i => i.deliveredAccount);
    if (hasDeliveredAccount) {
      this.addNotification(
        userId,
        'Enfòmasyon kont disponib !',
        `Idantifyan ak aksè pou kòmand #${orderNumber} pare nan seksyon "Pwodui Mwen" ou a.`,
        'delivery',
        {
          relatedEntityId: orderId,
          relatedEntityType: 'order',
          metadata: { orderNumber }
        }
      );
    }

    // Admin notification
    this.addNotification(
      'admin',
      isManualService ? '📱 COMMANDE REQUIS WHATSAPP' : 'Nouvelle commande payée',
      isManualService
        ? `Commande #${orderNumber} passée par ${user.name} (${totalHTG.toLocaleString()} HTG). Contact WhatsApp requis : ${normalizedWhatsApp}.`
        : `Commande #${orderNumber} passée par ${user.name} (${user.email}) pour ${totalHTG.toLocaleString()} HTG.`,
      'order',
      {
        relatedEntityId: orderId,
        relatedEntityType: 'order',
        metadata: { orderNumber, totalHTG, isManualService, userName: user.name, userEmail: user.email, whatsapp: normalizedWhatsApp }
      }
    );

    this.save();
    return { order, libraryItems: generatedLibraryItems };
  }

  public getOrderById(orderId: string): Order | undefined {
    return this.data.orders.find(o => o.id === orderId || o.orderNumber === orderId);
  }

  public updateOrderStatus(
    orderId: string, 
    status: OrderStatus | 'DELIVERED' | 'PROCESSING' | 'FAILED', 
    adminEmail: string,
    note?: string
  ): Order {
    const order = this.data.orders.find(o => o.id === orderId || o.orderNumber === orderId);
    if (!order) throw new Error('Commande introuvable.');

    let normalizedStatus: OrderStatus;
    if (status === 'DELIVERED' || status === 'COMPLETED') {
      normalizedStatus = 'COMPLETED';
      order.digitalDeliveryStatus = 'DELIVERED';
    } else if (status === 'PROCESSING') {
      normalizedStatus = 'PROCESSING';
      order.digitalDeliveryStatus = 'PROCESSING';
    } else if (status === 'FAILED') {
      normalizedStatus = 'FAILED';
      order.digitalDeliveryStatus = 'FAILED';
    } else {
      normalizedStatus = status as OrderStatus;
    }

    order.status = normalizedStatus;
    const now = new Date().toISOString();

    if (!order.statusHistory) {
      order.statusHistory = [];
    }

    order.statusHistory.push({
      status: normalizedStatus,
      timestamp: now,
      updatedBy: adminEmail,
      note: note || `Statut mis à jour : ${normalizedStatus}`,
    });

    let notifTitle = `Mizajou kòmand #${order.orderNumber}`;
    let notifMsg = `Kòmand ou an pase nan estati : ${normalizedStatus}.${note ? ` Note : ${note}` : ''}`;
    let notifType: 'order' | 'delivery' = 'order';

    if ((normalizedStatus as string) === 'PROCESSING') {
      notifTitle = `Kòmand #${order.orderNumber} ap trete`;
      notifMsg = `Kòmand ou an ap prepare pa ekip nou an.${note ? ` Note : ${note}` : ''}`;
    } else if ((normalizedStatus as string) === 'COMPLETED' || (normalizedStatus as string) === 'DELIVERED' || order.digitalDeliveryStatus === 'DELIVERED') {
      notifTitle = `Kòmand #${order.orderNumber} livre ak siksè !`;
      notifMsg = `Kòmand ou an fin trete epi li livre. Gade kòd ak detay ou yo nan "Pwodui Mwen".${note ? ` Note : ${note}` : ''}`;
      notifType = 'delivery';
    } else if (normalizedStatus === 'CANCELLED') {
      notifTitle = `Kòmand #${order.orderNumber} anile`;
      notifMsg = `Kòmand ou an te anile.${note ? ` Rezon : ${note}` : ''}`;
    }

    this.addNotification(
      order.userId,
      notifTitle,
      notifMsg,
      notifType,
      {
        relatedEntityId: order.id,
        relatedEntityType: 'order',
        metadata: { orderNumber: order.orderNumber, status: normalizedStatus, note }
      }
    );

    this.logActivity(adminEmail, 'MISE_A_JOUR_COMMANDE', `Commande #${order.orderNumber}`, `Statut mis à jour : ${normalizedStatus}${note ? ` (${note})` : ''}`);
    this.save();
    return order;
  }

  public addOrderAdminNote(orderId: string, note: string, adminEmail: string): Order {
    const order = this.getOrderById(orderId);
    if (!order) throw new Error('Commande introuvable.');
    if (!order.adminNotes) order.adminNotes = [];

    const newNote: OrderAdminNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      note: note.trim(),
      createdAt: new Date().toISOString(),
      adminEmail,
    };

    order.adminNotes.unshift(newNote);
    this.logActivity(adminEmail, 'NOTE_COMMANDE', `Commande #${order.orderNumber}`, note);
    this.save();
    return order;
  }

  public refundOrder(orderId: string, adminEmail: string, reason?: string): Order {
    const order = this.getOrderById(orderId);
    if (!order) throw new Error('Commande introuvable.');

    if (order.status === 'REFUNDED' || order.paymentStatus === 'REFUNDED') {
      throw new Error('Cette commande a déjà été remboursée.');
    }

    if (order.paymentStatus !== 'PAID') {
      throw new Error('Seules les commandes dont le paiement a été validé peuvent être remboursées.');
    }

    const wallet = this.getWalletByUserId(order.userId);
    if (!wallet) throw new Error('Portefeuille client introuvable.');

    const now = new Date().toISOString();
    const prevBalance = wallet.balanceHTG;
    wallet.balanceHTG = Math.round((wallet.balanceHTG + order.totalHTG) * 100) / 100;
    wallet.updatedAt = now;

    const tx: WalletTransaction = {
      id: `tx-ref-${order.id}-${Date.now()}`,
      walletId: wallet.id,
      userId: order.userId,
      type: 'REFUND',
      amountHTG: order.totalHTG,
      previousBalanceHTG: prevBalance,
      newBalanceHTG: wallet.balanceHTG,
      referenceId: order.orderNumber,
      description: `Remboursement commande #${order.orderNumber}${reason ? ` (${reason})` : ''}`,
      createdAt: now,
    };
    this.data.walletTransactions.unshift(tx);

    order.status = 'REFUNDED';
    order.paymentStatus = 'REFUNDED';
    order.refundReason = reason || 'Remboursement effectué par l\'administration';
    order.refundedAt = now;

    if (!order.statusHistory) order.statusHistory = [];
    order.statusHistory.push({
      status: 'REFUNDED',
      timestamp: now,
      updatedBy: adminEmail,
      note: `Remboursement de ${order.totalHTG.toLocaleString()} HTG crédité au portefeuille client.${reason ? ` Motif : ${reason}` : ''}`,
    });

    if (!order.adminNotes) order.adminNotes = [];
    order.adminNotes.unshift({
      id: `note-ref-${Date.now()}`,
      note: `Remboursement exécuté (${order.totalHTG.toLocaleString()} HTG crédités au wallet). Motif : ${reason || 'Non spécifié'}`,
      createdAt: now,
      adminEmail,
    });

    this.addNotification(
      order.userId,
      'Kòmand Ranbouse',
      `Kòmand #${order.orderNumber} ou an ranbouse. Nou kredite ${order.totalHTG.toLocaleString()} HTG sou bous ou a.${reason ? ` Motif : ${reason}` : ''}`,
      'payment',
      {
        relatedEntityId: order.id,
        relatedEntityType: 'order',
        metadata: { orderNumber: order.orderNumber, refundedAmountHTG: order.totalHTG, reason }
      }
    );

    this.logActivity(adminEmail, 'REMBOURSEMENT_COMMANDE', `Commande #${order.orderNumber}`, `Remboursement de ${order.totalHTG} HTG effectué. Motif : ${reason || 'N/A'}`);

    // If order used a promotional coupon, restore usage counter and update usage record
    if (order.couponCode && (order.couponType === 'PROMOTIONAL' || order.couponId)) {
      if (this.data.promotionalCouponUsages) {
        const usage = this.data.promotionalCouponUsages.find(u => u.orderId === order.id && !u.isRefunded);
        if (usage) {
          usage.isRefunded = true;
          usage.orderStatus = 'REFUNDED';
        }
      }
      const promoCoupon = (this.data.promotionalCoupons || []).find(
        c => (order.couponId && c.id === order.couponId) || c.code.toUpperCase() === (order.couponCode || '').toUpperCase()
      );
      if (promoCoupon) {
        promoCoupon.currentUses = Math.max(0, (promoCoupon.currentUses || 1) - 1);
        promoCoupon.status = this.computePromotionalCouponStatus(promoCoupon);
        promoCoupon.updatedAt = now;
      }
    } else if (order.couponCode && (order.couponType === 'LOYALTY' || !order.couponType)) {
      // Restore loyalty reward if applicable
      const reward = (this.data.loyaltyRewards || []).find(
        r => r.code.toUpperCase() === (order.couponCode || '').toUpperCase() && r.userId === order.userId
      );
      if (reward) {
        reward.usedCount = Math.max(0, (reward.usedCount || 1) - 1);
        if (reward.usedCount < (reward.maxUses || 1)) {
          reward.status = 'available';
        }
      }
    }

    this.save();
    return order;
  }

  // Automatic 24h refund for unvalidated PROCESSING orders
  public processAutoRefunds24h(adminEmail = 'system@mystore.ht'): { count: number; refundedOrders: string[] } {
    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const refundedOrders: string[] = [];

    for (const order of this.data.orders) {
      if (order.status === 'PROCESSING' && order.paymentStatus === 'PAID') {
        const orderAge = now - new Date(order.createdAt).getTime();
        if (orderAge >= TWENTY_FOUR_HOURS) {
          try {
            this.refundOrder(order.id, adminEmail, 'Remboursement automatique : commande non finalisée après 24 heures.');
            refundedOrders.push(order.orderNumber);
          } catch (err) {
            console.error(`Erreur lors du remboursement automatique 24h de la commande ${order.id}:`, err);
          }
        }
      }
    }
    return { count: refundedOrders.length, refundedOrders };
  }

  public getOrdersForUser(userId: string): Order[] {
    const list = this.data.orders.filter(o => o.userId === userId);
    return list.map(order => {
      const isDelivered = order.status === 'COMPLETED' || order.digitalDeliveryStatus === 'DELIVERED';
      if (!isDelivered) {
        return {
          ...order,
          items: (order.items || []).map(item => {
            const { deliveredAccount, thankYouMessage, ...rest } = item;
            return rest as OrderItem;
          }),
        };
      }
      return order;
    });
  }

  public getAllOrders(): Order[] {
    return this.data.orders.slice();
  }

  public getCustomerLibrary(userId: string): CustomerLibraryItem[] {
    return this.data.customerLibrary.filter(item => item.userId === userId);
  }

  // ==================== RECHARGES (MONCASH / NATCASH / PROVIDERS) ====================
  public createRechargeRequest(
    userId: string,
    amountHTG: number,
    transcode: string,
    paymentDate: string,
    screenshotUrl?: string,
    paymentMethod: string = 'moncash',
    options?: {
      idempotencyKey?: string;
      provider?: string;
      feeHTG?: number;
      finalAmountHTG?: number;
      isManual?: boolean;
    }
  ): RechargeRequest {
    if (typeof amountHTG !== 'number' || isNaN(amountHTG) || amountHTG <= 0 || !isFinite(amountHTG)) {
      throw new Error('Le montant de la recharge doit être un nombre strictement supérieur à 0 HTG.');
    }

    // Idempotency check: if key already provided and exists, return existing request
    if (options?.idempotencyKey) {
      const existingReq = this.data.rechargeRequests.find(r => r.idempotencyKey === options.idempotencyKey);
      if (existingReq) {
        return existingReq;
      }
    }

    const cleanTranscode = transcode.trim();
    if (!cleanTranscode || cleanTranscode.length < 4) {
      throw new Error('Veuillez fournir le numéro de référence/transcode de la transaction.');
    }

    // Strict uniqueness verification: check that transcode was never submitted before
    const existsInRecharges = this.data.rechargeRequests.some(
      r => r.transcode.trim().toLowerCase() === cleanTranscode.toLowerCase()
    );
    if (existsInRecharges) {
      throw new Error('Cette référence de transaction a déjà été enregistrée. Une référence ne peut être utilisée qu\'une seule fois.');
    }

    const existsInTransactions = this.data.walletTransactions.some(
      tx => (tx.referenceId || tx.reference || '').trim().toLowerCase() === cleanTranscode.toLowerCase()
    );
    if (existsInTransactions) {
      throw new Error('Cette référence de transaction a déjà été créditée.');
    }

    const user = this.getUserById(userId);
    if (!user) throw new Error('Utilisateur non trouvé.');

    const normalizedMethod = paymentMethod.toLowerCase();
    const methodTitle = normalizedMethod.toUpperCase();

    const roundedAmount = Math.round(amountHTG * 100) / 100;
    const feeHTG = options?.feeHTG !== undefined ? options.feeHTG : 0;
    const finalAmountHTG = options?.finalAmountHTG !== undefined ? options.finalAmountHTG : roundedAmount + feeHTG;

    const request: RechargeRequest = {
      id: `rech-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId,
      userEmail: user.email,
      userName: user.name,
      amountHTG: roundedAmount,
      feeHTG,
      finalAmountHTG,
      paymentMethod: normalizedMethod,
      paymentMethodKey: normalizedMethod,
      provider: options?.provider || normalizedMethod,
      transcode: cleanTranscode,
      externalReference: cleanTranscode,
      idempotencyKey: options?.idempotencyKey,
      paymentDate: paymentDate || new Date().toISOString(),
      screenshotUrl,
      status: 'PENDING',
      isManual: options?.isManual ?? true,
      createdAt: new Date().toISOString(),
    };

    this.data.rechargeRequests.unshift(request);

    // Notify customer that recharge is submitted and pending admin review
    this.addNotification(
      userId,
      `Rechaj ${methodTitle} soumèt`,
      `Demann rechaj ${roundedAmount} HTG ou an (Réf: ${cleanTranscode}) soumèt avèk siksè. L ap valide talè pa administratè a.`,
      'recharge',
      {
        relatedEntityId: request.id,
        relatedEntityType: 'recharge',
        metadata: { amountHTG: roundedAmount, method: methodTitle, transcode: cleanTranscode }
      }
    );

    // Notify admin of new recharge request (PENDING - validation required)
    this.addNotification(
      'admin',
      `Nouvelle demande de recharge ${methodTitle}`,
      `${user.name} (${user.email}) a soumis une recharge ${methodTitle} de ${roundedAmount} HTG (Réf: ${cleanTranscode}). Vérification requise.`,
      'recharge',
      {
        relatedEntityId: request.id,
        relatedEntityType: 'recharge',
        metadata: { amountHTG: roundedAmount, method: methodTitle, transcode: cleanTranscode, userEmail: user.email, userName: user.name }
      }
    );

    this.logActivity(
      'Système',
      'DEMANDE_RECHARGE',
      `Recharge ${methodTitle} ${cleanTranscode}`,
      `Demande de recharge de ${roundedAmount} HTG par ${user.email} (Statut: PENDING - En attente d'approbation admin)`
    );

    this.save();
    return request;
  }

  public getRechargeRequests(userId?: string): RechargeRequest[] {
    const list = userId 
      ? this.data.rechargeRequests.filter(r => r.userId === userId)
      : this.data.rechargeRequests.slice();
    return list.map(r => ({
      ...r,
      paymentMethodKey: r.paymentMethodKey || r.paymentMethod || 'moncash',
      paymentMethod: r.paymentMethod || 'moncash',
    }));
  }

  public processRechargeRequest(
    requestId: string, 
    status: 'APPROVED' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED', 
    adminNote: string | undefined, 
    adminEmail: string
  ): RechargeRequest {
    const req = this.data.rechargeRequests.find(r => r.id === requestId);
    if (!req) throw new Error('Demande de recharge introuvable.');
    if (req.status !== 'PENDING') throw new Error(`Cette demande a déjà été traitée (${req.status}). Action impossible.`);

    const methodTitle = req.paymentMethod.toUpperCase();
    const now = new Date().toISOString();

    req.status = status;
    req.adminNote = adminNote;
    req.processedAt = now;
    req.processedByAdmin = adminEmail;

    if (status === 'APPROVED' || status === 'CONFIRMED') {
      // Idempotency: ensure transcode hasn't been credited yet in walletTransactions
      const alreadyCredited = this.data.walletTransactions.some(
        tx => (tx.referenceId || tx.reference || '').trim().toLowerCase() === req.transcode.trim().toLowerCase()
      );
      if (alreadyCredited) {
        throw new Error('Erreur de sécurité : cette transaction a déjà été créditée.');
      }

      req.confirmedAt = now;

      // Atomically credit user's wallet with type RECHARGE
      this.creditWallet(
        req.userId, 
        req.amountHTG, 
        req.transcode, 
        `Recharge ${methodTitle} validée (Réf: ${req.transcode})`,
        'RECHARGE',
        {
          provider: req.provider || req.paymentMethod,
          paymentMethod: req.paymentMethod,
          externalReference: req.externalReference || req.transcode,
          idempotencyKey: req.idempotencyKey,
        }
      );

      // Notify customer
      this.data.notifications.push({
        id: `notif-rech-appr-${req.id}`,
        target: req.userId,
        title: `Recharge ${methodTitle} confirmée !`,
        message: `Votre portefeuille a été crédité de ${req.amountHTG} HTG après validation par l'administrateur. Vos achats sont désormais possibles.`,
        type: 'recharge',
        isRead: false,
        createdAt: now,
      });

      this.logActivity(
        adminEmail,
        'VALIDATION_RECHARGE',
        `Recharge ${methodTitle} ${req.transcode}`,
        `Validation et crédit de ${req.amountHTG} HTG sur le portefeuille de ${req.userEmail}`
      );
    } else {
      // Rejected / Cancelled
      this.data.notifications.push({
        id: `notif-rech-rej-${req.id}`,
        target: req.userId,
        title: `Recharge ${methodTitle} rejetée`,
        message: `Votre demande de recharge (${req.amountHTG} HTG) a été refusée.${adminNote ? ` Motif: ${adminNote}` : ''}`,
        type: 'recharge',
        isRead: false,
        createdAt: now,
      });

      this.logActivity(
        adminEmail,
        'REJET_RECHARGE',
        `Recharge ${methodTitle} ${req.transcode}`,
        `Refus de la recharge de ${req.amountHTG} HTG pour ${req.userEmail}. Motif: ${adminNote || 'Non précisé'}`
      );
    }

    this.save();
    return req;
  }

  public processNatCashWebhook(payload: {
    transactionId: string;
    amount: number;
    currency: string;
    userId: string;
    signature?: string;
  }): { success: boolean; message: string; transactionId?: string } {
    // Idempotency check: prevent duplicate credits
    if (this.data.processedWebhooks.includes(payload.transactionId)) {
      return { success: true, message: 'Transaction déjà traitée (Idempotence).' };
    }

    if (!payload.userId || payload.amount <= 0 || (payload.currency && payload.currency !== 'HTG')) {
      throw new Error('Données webhook NatCash invalides');
    }

    const user = this.getUserById(payload.userId);
    if (!user) {
      throw new Error('Utilisateur introuvable pour ce paiement.');
    }

    // Atomically credit
    const tx = this.creditWallet(
      payload.userId,
      payload.amount,
      payload.transactionId,
      `Paiement instantané NatCash API (Réf: ${payload.transactionId})`
    );

    this.data.processedWebhooks.push(payload.transactionId);

    // Notify customer
    this.data.notifications.push({
      id: `notif-nc-auto-${payload.transactionId}`,
      target: payload.userId,
      title: 'Paiement NatCash reçu !',
      message: `Votre portefeuille a été automatiquement crédité de ${payload.amount} HTG via NatCash.`,
      type: 'recharge',
      isRead: false,
      createdAt: new Date().toISOString(),
    });

    this.save();
    return { success: true, message: 'Recharge automatique effectuée avec succès.', transactionId: tx.id };
  }

  // ==================== SITE SETTINGS ====================
  public getSiteSettings(): SiteSettings {
    if (!this.data.siteSettings.chatbotConfig) {
      this.data.siteSettings.chatbotConfig = {
        enabled: true,
        botName: 'Assistant HAITEX',
        welcomeMessage_ht: 'Bonjou ! Mwen se asistan dijital ou. Mwen ka ede w jwenn yon pwodwi, konprann kijan pou achte, verifye yon kòmand oswa jwenn èd.',
        welcomeMessage_fr: 'Bonjour ! Je suis votre assistant boutique. Je peux vous aider à trouver un produit, comprendre comment acheter, vérifier une commande ou contacter le support.',
        welcomeMessage_en: 'Hello! I am your store assistant. I can help you find products, understand how to purchase, track orders, or contact support.',
        fallbackMessage: 'Sèvis asistans lan tanporèman pa disponib kounye a. Ou ka kontakte sipò a dirèkteman sou WhatsApp.',
        customKnowledge: 'Boutik MY STORE espesyalize nan livrezon pwodwi dijital: Gaming Top-Up (Free Fire, Blood Strike), Streaming (Netflix, Spotify), Panels ak Outil dijital. Tout peman fèt an Goud (HTG) atravè bous/portefeuille ou recharge pa NatCash oswa MonCash.',
        supportPhone: this.data.siteSettings.supportPhone || '+509 4385-4650'
      };
    }
    return this.data.siteSettings;
  }

  public getChatbotConfig(): ChatbotConfig {
    return this.getSiteSettings().chatbotConfig!;
  }

  public updateChatbotConfig(config: Partial<ChatbotConfig>, adminEmail: string): ChatbotConfig {
    const current = this.getChatbotConfig();
    this.data.siteSettings.chatbotConfig = {
      ...current,
      ...config
    };
    this.data.siteSettings.updatedAt = new Date().toISOString();
    this.logActivity(adminEmail, 'MODIFICATION_CHATBOT', 'Assistant IA', `Mise à jour de la configuration du chatbot assistant (Actif: ${this.data.siteSettings.chatbotConfig.enabled})`);
    this.save();
    return this.data.siteSettings.chatbotConfig;
  }

  public updateSiteSettings(settings: Partial<SiteSettings>, adminEmail: string): SiteSettings {
    this.data.siteSettings = {
      ...this.data.siteSettings,
      ...settings,
      updatedAt: new Date().toISOString(),
    };
    this.logActivity(adminEmail, 'MODIFICATION_PARAMETRES', 'Paramètres du site', 'Mise à jour des informations de personnalisation du site.');
    this.save();
    return this.data.siteSettings;
  }

  // ==================== PAYMENT METHODS ====================
  public getPaymentMethods(): PaymentMethodConfig[] {
    return this.data.paymentMethods;
  }

  public updatePaymentMethod(key: 'natcash' | 'moncash', updates: Partial<PaymentMethodConfig>, adminEmail: string): PaymentMethodConfig {
    const method = this.data.paymentMethods.find(m => m.key === key);
    if (!method) throw new Error('Mode de paiement introuvable');
    Object.assign(method, updates);
    this.logActivity(adminEmail, 'MODIFICATION_PAIEMENT', method.name, `Mise à jour de la configuration ${method.name} (Actif: ${method.isActive})`);
    this.save();
    return method;
  }

  // ==================== NOTIFICATIONS ====================
  public getNotifications(userId?: string): AppNotification[] {
    let list: AppNotification[];
    if (!userId || userId === 'admin') {
      list = this.data.notifications.filter(n => n.target === 'all' || n.target === 'admin');
    } else {
      list = this.data.notifications.filter(n => n.target === 'all' || n.target === userId || n.userId === userId);
    }
    return list.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public markNotificationAsRead(id: string) {
    const notif = this.data.notifications.find(n => n.id === id);
    if (notif) {
      notif.isRead = true;
      notif.read = true;
      this.save();
    }
  }

  public markAllNotificationsAsRead(target: string) {
    this.data.notifications.forEach(n => {
      if (
        n.target === target || 
        (target === 'admin' && n.target === 'admin') || 
        n.target === 'all' ||
        n.userId === target
      ) {
        n.isRead = true;
        n.read = true;
      }
    });
    this.save();
  }

  public deleteNotification(id: string, requesterUserId?: string, isAdmin: boolean = false): boolean {
    const idx = this.data.notifications.findIndex(n => n.id === id);
    if (idx === -1) return false;
    const notif = this.data.notifications[idx];
    if (!isAdmin && requesterUserId && notif.target !== requesterUserId && notif.userId !== requesterUserId && notif.target !== 'all') {
      return false; // Forbid deleting other customer notifications
    }
    this.data.notifications.splice(idx, 1);
    this.save();
    return true;
  }

  public addNotification(
    target: string,
    title: string,
    message: string,
    type: string = 'system',
    options?: {
      relatedEntityId?: string;
      relatedEntityType?: 'order' | 'recharge' | 'product' | 'poster' | 'system';
      metadata?: Record<string, any>;
      userId?: string;
    }
  ): AppNotification {
    const now = new Date().toISOString();
    const notif: AppNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      target,
      userId: options?.userId || (target !== 'admin' && target !== 'all' ? target : undefined),
      title,
      message,
      type: (type.toLowerCase() as any),
      isRead: false,
      read: false,
      relatedEntityId: options?.relatedEntityId,
      relatedEntityType: options?.relatedEntityType,
      metadata: options?.metadata,
      createdAt: now,
    };
    this.data.notifications.unshift(notif);
    // Keep max 500 notifications in storage
    if (this.data.notifications.length > 500) {
      this.data.notifications.pop();
    }
    this.save();
    return notif;
  }

  // ==================== ACTIVITY LOGS ====================
  public getActivityLogs(): ActivityLog[] {
    return this.data.activityLogs
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public logActivity(adminEmail: string, action: string, targetObject: string, details: string) {
    const log: ActivityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      adminEmail,
      action,
      targetObject,
      details,
      createdAt: new Date().toISOString(),
    };
    this.data.activityLogs.unshift(log);
    // Keep max 200 logs
    if (this.data.activityLogs.length > 200) {
      this.data.activityLogs.pop();
    }
  }

  // ==================== ADMIN STATS ====================
  public getAdminStats(): AdminStats {
    const today = new Date().toISOString().split('T')[0];
    const paidOrders = this.data.orders.filter(o => o.paymentStatus === 'PAID');
    
    const todaySalesHTG = paidOrders
      .filter(o => o.createdAt.startsWith(today))
      .reduce((acc, o) => acc + o.totalHTG, 0);

    const totalSalesHTG = paidOrders.reduce((acc, o) => acc + o.totalHTG, 0);
    const approvedRecharges = this.data.rechargeRequests.filter(r => r.status === 'APPROVED');
    const totalRechargesHTG = approvedRecharges.reduce((acc, r) => acc + (r.amountHTG || 0), 0);
    const totalWalletBalanceHTG = this.data.wallets.reduce((acc, w) => acc + w.balanceHTG, 0);
    const lowStockCount = this.data.products.filter(p => p.stock <= 3).length;
    const pendingRechargesCount = this.data.rechargeRequests.filter(r => r.status === 'PENDING').length;

    // Top selling products
    const productSalesMap: { [prodId: string]: number } = {};
    paidOrders.forEach(o => {
      o.items.forEach(item => {
        productSalesMap[item.productId] = (productSalesMap[item.productId] || 0) + item.quantity;
      });
    });

    const topSellingProducts = Object.keys(productSalesMap)
      .map(prodId => {
        const prod = this.getProductById(prodId);
        return prod ? { product: prod, soldCount: productSalesMap[prodId] } : null;
      })
      .filter(Boolean)
      .sort((a, b) => (b?.soldCount || 0) - (a?.soldCount || 0))
      .slice(0, 5) as { product: Product; soldCount: number }[];

    // Sales by day for chart (last 7 days)
    const salesByDay: { date: string; amountHTG: number; ordersCount: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayOrders = paidOrders.filter(o => o.createdAt.startsWith(dateStr));
      salesByDay.push({
        date: dateStr,
        amountHTG: dayOrders.reduce((acc, o) => acc + o.totalHTG, 0),
        ordersCount: dayOrders.length,
      });
    }

    return {
      todaySalesHTG,
      totalSalesHTG,
      totalRechargesHTG,
      ordersCount: paidOrders.length,
      customersCount: this.data.users.filter(u => u.role === 'CUSTOMER').length,
      productsCount: this.data.products.length,
      totalWalletBalanceHTG,
      lowStockCount,
      pendingRechargesCount,
      recentOrders: paidOrders.slice(0, 8),
      recentRecharges: this.data.rechargeRequests.slice(0, 8),
      topSellingProducts,
      salesByDay,
    };
  }

  // ==================== LOYALTY & REWARDS SYSTEM ====================
  public calculateUserTotalSpent(userId: string): number {
    const validOrders = this.data.orders.filter(order => {
      if (order.userId !== userId) return false;
      if (order.paymentStatus !== 'PAID') return false;
      if (order.status === 'CANCELLED' || order.status === 'FAILED' || order.status === 'REFUNDED') {
        return false;
      }
      return true;
    });

    const total = validOrders.reduce((sum, order) => {
      const amt = typeof order.totalHTG === 'number' ? order.totalHTG : (order.totalAmountHTG || 0);
      return sum + amt;
    }, 0);

    return Math.round(total * 100) / 100;
  }

  public refreshLoyaltyRewardStatuses(): void {
    const now = new Date();
    let changed = false;
    if (!this.data.loyaltyRewards) {
      this.data.loyaltyRewards = [];
    }
    for (const reward of this.data.loyaltyRewards) {
      if (reward.status === 'available' && new Date(reward.expiresAt) < now) {
        reward.status = 'expired';
        changed = true;
      }
    }
    if (changed) {
      this.save();
    }
  }

  public checkAndUnlockLoyaltyRewards(userId: string): LoyaltyReward[] {
    const config = this.getLoyaltyConfig();
    if (!config.enabled) return [];

    const user = this.getUserById(userId);
    if (!user) return [];

    const totalSpent = this.calculateUserTotalSpent(userId);
    if (!this.data.loyaltyRewards) {
      this.data.loyaltyRewards = [];
    }

    const userRewards = this.data.loyaltyRewards.filter(r => r.userId === userId);
    const unlockedTierIds = new Set(userRewards.map(r => r.tierId));

    const newlyUnlocked: LoyaltyReward[] = [];
    const activeTiers = [...config.tiers]
      .filter(t => t.isActive)
      .sort((a, b) => a.minSpendHTG - b.minSpendHTG);

    for (const tier of activeTiers) {
      if (totalSpent >= tier.minSpendHTG && !unlockedTierIds.has(tier.id)) {
        const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        const code = `FIDELITE${tier.discountPercent}-${randSuffix}`;
        const now = new Date();
        const expiresAt = new Date(now.getTime() + (tier.validityDays || 30) * 24 * 60 * 60 * 1000).toISOString();

        const reward: LoyaltyReward = {
          id: `rew-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          tierId: tier.id,
          userId,
          userEmail: user.email,
          userName: user.name,
          code,
          discountPercent: tier.discountPercent,
          minOrderAmountHTG: tier.minOrderAmountHTG || 0,
          maxDiscountHTG: tier.maxDiscountHTG,
          maxUses: tier.maxUses || 1,
          usedCount: 0,
          status: 'available',
          createdAt: now.toISOString(),
          expiresAt,
          thresholdHTG: tier.minSpendHTG,
        };

        this.data.loyaltyRewards.unshift(reward);
        unlockedTierIds.add(tier.id);
        newlyUnlocked.push(reward);

        // Client notification of unlocked reward
        const formattedSpend = tier.minSpendHTG.toLocaleString();
        const notifMessage = `Félicitations ! Vous avez dépensé ${formattedSpend} HTG et débloqué une réduction de ${tier.discountPercent} % sur votre prochain achat (Code : ${code}).`;
        
        this.addNotification(
          userId,
          `Réduction de ${tier.discountPercent} % débloquée !`,
          notifMessage,
          'system'
        );
      }
    }

    if (newlyUnlocked.length > 0) {
      this.save();
    }

    return newlyUnlocked;
  }

  public getCustomerLoyaltyStatus(userId: string): CustomerLoyaltyStatus {
    this.refreshLoyaltyRewardStatuses();
    this.checkAndUnlockLoyaltyRewards(userId);

    const config = this.getLoyaltyConfig();
    const totalSpentHTG = this.calculateUserTotalSpent(userId);
    const rewards = (this.data.loyaltyRewards || []).filter(r => r.userId === userId);
    const availableCoupons = rewards.filter(r => r.status === 'available' && new Date(r.expiresAt) > new Date());

    const activeTiers = [...config.tiers]
      .filter(t => t.isActive)
      .sort((a, b) => a.minSpendHTG - b.minSpendHTG);

    // Current tier achieved
    const achievedTiers = activeTiers.filter(t => totalSpentHTG >= t.minSpendHTG);
    const currentTier = achievedTiers.length > 0 ? achievedTiers[achievedTiers.length - 1] : null;

    // Next tier to achieve
    const nextTier = activeTiers.find(t => totalSpentHTG < t.minSpendHTG) || null;

    let progressPercent = 100;
    let targetSpendHTG = totalSpentHTG;

    if (nextTier) {
      targetSpendHTG = nextTier.minSpendHTG;
      const baseSpend = currentTier ? currentTier.minSpendHTG : 0;
      const range = nextTier.minSpendHTG - baseSpend;
      const currentProgress = totalSpentHTG - baseSpend;
      progressPercent = range > 0 ? Math.min(100, Math.max(0, Math.round((currentProgress / range) * 100))) : 0;
    }

    return {
      totalSpentHTG,
      currentTier,
      nextTier,
      progressPercent,
      targetSpendHTG,
      rewards,
      availableCoupons,
      systemEnabled: config.enabled,
    };
  }

  public validateLoyaltyCoupon(rawCode: string, userId: string, subtotalHTG: number): CouponValidationResult {
    this.refreshLoyaltyRewardStatuses();

    const config = this.getLoyaltyConfig();
    if (!config.enabled) {
      return {
        valid: false,
        code: rawCode,
        discountPercent: 0,
        discountHTG: 0,
        subtotalHTG,
        newTotalHTG: subtotalHTG,
        message: 'Le système de fidélité est actuellement désactivé.',
      };
    }

    const cleanCode = (rawCode || '').trim().toUpperCase();
    if (!cleanCode) {
      return {
        valid: false,
        code: '',
        discountPercent: 0,
        discountHTG: 0,
        subtotalHTG,
        newTotalHTG: subtotalHTG,
        message: 'Veuillez saisir un code coupon.',
      };
    }

    const reward = (this.data.loyaltyRewards || []).find(r => r.code.toUpperCase() === cleanCode);
    if (!reward) {
      return {
        valid: false,
        code: cleanCode,
        discountPercent: 0,
        discountHTG: 0,
        subtotalHTG,
        newTotalHTG: subtotalHTG,
        message: 'Code coupon inexistant ou invalide.',
      };
    }

    // Verify ownership
    if (reward.userId !== userId) {
      return {
        valid: false,
        code: cleanCode,
        discountPercent: 0,
        discountHTG: 0,
        subtotalHTG,
        newTotalHTG: subtotalHTG,
        message: 'Ce coupon de réduction ne vous appartient pas.',
      };
    }

    // Verify expiration
    if (new Date(reward.expiresAt) < new Date() || reward.status === 'expired') {
      reward.status = 'expired';
      this.save();
      return {
        valid: false,
        code: cleanCode,
        discountPercent: 0,
        discountHTG: 0,
        subtotalHTG,
        newTotalHTG: subtotalHTG,
        message: 'Ce coupon a expiré.',
      };
    }

    // Verify usage count
    if (reward.status === 'used' || reward.usedCount >= reward.maxUses) {
      return {
        valid: false,
        code: cleanCode,
        discountPercent: 0,
        discountHTG: 0,
        subtotalHTG,
        newTotalHTG: subtotalHTG,
        message: 'Ce coupon a déjà été utilisé.',
      };
    }

    if (reward.status !== 'available') {
      return {
        valid: false,
        code: cleanCode,
        discountPercent: 0,
        discountHTG: 0,
        subtotalHTG,
        newTotalHTG: subtotalHTG,
        message: 'Ce coupon n\'est plus disponible.',
      };
    }

    // Verify minimum order amount
    const minRequired = reward.minOrderAmountHTG || 0;
    if (subtotalHTG < minRequired) {
      return {
        valid: false,
        code: cleanCode,
        discountPercent: 0,
        discountHTG: 0,
        subtotalHTG,
        newTotalHTG: subtotalHTG,
        message: `Montant minimum de commande non atteint (${minRequired.toLocaleString()} HTG requis).`,
      };
    }

    // Calculate discount on server
    let discountHTG = Math.round((subtotalHTG * reward.discountPercent) / 100);
    if (reward.maxDiscountHTG && reward.maxDiscountHTG > 0) {
      discountHTG = Math.min(discountHTG, reward.maxDiscountHTG);
    }
    discountHTG = Math.min(discountHTG, subtotalHTG);
    const newTotalHTG = Math.max(0, Math.round((subtotalHTG - discountHTG) * 100) / 100);

    return {
      valid: true,
      code: cleanCode,
      type: 'LOYALTY',
      discountPercent: reward.discountPercent,
      discountHTG,
      subtotalHTG,
      newTotalHTG,
      reward,
      message: `Réduction de fidélité de ${reward.discountPercent} % appliquée avec succès (-${discountHTG.toLocaleString()} HTG) !`,
    };
  }

  // ==================== PROMOTIONAL COUPONS SYSTEM ====================

  public computePromotionalCouponStatus(coupon: PromotionalCoupon): PromotionalCouponStatus {
    if (!coupon.isActive) {
      return 'DISABLED';
    }
    const now = new Date();
    if (coupon.expiresAt && new Date(coupon.expiresAt) < now) {
      return 'EXPIRED';
    }
    if (typeof coupon.maxGlobalUses === 'number' && coupon.maxGlobalUses > 0 && (coupon.currentUses || 0) >= coupon.maxGlobalUses) {
      return 'EXHAUSTED';
    }
    return 'ACTIVE';
  }

  public validatePromotionalCoupon(rawCode: string, userId: string, subtotalHTG: number): CouponValidationResult {
    const cleanCode = (rawCode || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!cleanCode) {
      return {
        valid: false,
        code: '',
        discountPercent: 0,
        discountHTG: 0,
        subtotalHTG,
        newTotalHTG: subtotalHTG,
        message: 'Veuillez saisir un code coupon.',
      };
    }

    if (!this.data.promotionalCoupons) {
      this.data.promotionalCoupons = [];
    }

    const coupon = this.data.promotionalCoupons.find(c => c.code.toUpperCase() === cleanCode);
    if (!coupon) {
      return {
        valid: false,
        code: cleanCode,
        discountPercent: 0,
        discountHTG: 0,
        subtotalHTG,
        newTotalHTG: subtotalHTG,
        message: 'Code coupon promotionnel inexistant ou invalide.',
      };
    }

    // Refresh dynamic status
    coupon.status = this.computePromotionalCouponStatus(coupon);

    if (!coupon.isActive || coupon.status === 'DISABLED') {
      return {
        valid: false,
        code: cleanCode,
        discountPercent: 0,
        discountHTG: 0,
        subtotalHTG,
        newTotalHTG: subtotalHTG,
        message: 'Ce coupon promotionnel est actuellement désactivé.',
      };
    }

    const now = new Date();
    if (coupon.startDate && new Date(coupon.startDate) > now) {
      return {
        valid: false,
        code: cleanCode,
        discountPercent: 0,
        discountHTG: 0,
        subtotalHTG,
        newTotalHTG: subtotalHTG,
        message: `Cette promotion n'a pas encore débuté (début prévu le ${new Date(coupon.startDate).toLocaleDateString('fr-FR')}).`,
      };
    }

    if (coupon.status === 'EXPIRED' || (coupon.expiresAt && new Date(coupon.expiresAt) < now)) {
      coupon.status = 'EXPIRED';
      this.save();
      return {
        valid: false,
        code: cleanCode,
        discountPercent: 0,
        discountHTG: 0,
        subtotalHTG,
        newTotalHTG: subtotalHTG,
        message: 'Ce coupon promotionnel a expiré.',
      };
    }

    if (coupon.status === 'EXHAUSTED' || (typeof coupon.maxGlobalUses === 'number' && coupon.maxGlobalUses > 0 && (coupon.currentUses || 0) >= coupon.maxGlobalUses)) {
      coupon.status = 'EXHAUSTED';
      this.save();
      return {
        valid: false,
        code: cleanCode,
        discountPercent: 0,
        discountHTG: 0,
        subtotalHTG,
        newTotalHTG: subtotalHTG,
        message: 'Ce coupon promotionnel a atteint sa limite globale d\'utilisations (épuisé).',
      };
    }

    // Check per-customer usage limit
    const maxPerCustomer = typeof coupon.maxUsesPerCustomer === 'number' && coupon.maxUsesPerCustomer > 0 
      ? coupon.maxUsesPerCustomer 
      : 1;

    const userUsages = (this.data.promotionalCouponUsages || []).filter(
      u => u.couponId === coupon.id && u.userId === userId && !u.isRefunded
    ).length;

    if (userUsages >= maxPerCustomer) {
      return {
        valid: false,
        code: cleanCode,
        discountPercent: 0,
        discountHTG: 0,
        subtotalHTG,
        newTotalHTG: subtotalHTG,
        message: maxPerCustomer === 1
          ? 'Vous avez déjà utilisé ce coupon promotionnel (limité à 1 utilisation par client).'
          : `Vous avez atteint la limite de ${maxPerCustomer} utilisations pour ce coupon.`,
      };
    }

    // Check minimum order amount
    const minRequired = coupon.minOrderAmountHTG || 0;
    if (subtotalHTG < minRequired) {
      return {
        valid: false,
        code: cleanCode,
        discountPercent: 0,
        discountHTG: 0,
        subtotalHTG,
        newTotalHTG: subtotalHTG,
        message: `Montant minimum d'achat non atteint (${minRequired.toLocaleString()} HTG requis).`,
      };
    }

    // Calculate discount server-side with optional cap
    let discountHTG = Math.round((subtotalHTG * coupon.discountPercent) / 100);
    if (coupon.maxDiscountHTG && coupon.maxDiscountHTG > 0) {
      discountHTG = Math.min(discountHTG, coupon.maxDiscountHTG);
    }
    discountHTG = Math.min(discountHTG, subtotalHTG);
    const newTotalHTG = Math.max(0, Math.round((subtotalHTG - discountHTG) * 100) / 100);

    return {
      valid: true,
      code: coupon.code,
      type: 'PROMOTIONAL',
      campaignName: coupon.campaignName,
      couponId: coupon.id,
      discountPercent: coupon.discountPercent,
      discountHTG,
      subtotalHTG,
      newTotalHTG,
      promotionalCoupon: coupon,
      message: `Coupon "${coupon.code}" appliqué avec succès (-${coupon.discountPercent}%${coupon.maxDiscountHTG ? `, plafonné à ${coupon.maxDiscountHTG.toLocaleString()} HTG` : ''}) !`,
    };
  }

  // Unified Coupon Validator: handles both promotional and loyalty coupons
  public validateCoupon(rawCode: string, userId: string, subtotalHTG: number): CouponValidationResult {
    const cleanCode = (rawCode || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!cleanCode) {
      return {
        valid: false,
        code: '',
        discountPercent: 0,
        discountHTG: 0,
        subtotalHTG,
        newTotalHTG: subtotalHTG,
        message: 'Veuillez saisir un code coupon.',
      };
    }

    // 1. First check if it matches a promotional coupon
    if (this.data.promotionalCoupons) {
      const isPromo = this.data.promotionalCoupons.some(c => c.code.toUpperCase() === cleanCode);
      if (isPromo) {
        return this.validatePromotionalCoupon(cleanCode, userId, subtotalHTG);
      }
    }

    // 2. Otherwise check if it matches a loyalty coupon
    if (this.data.loyaltyRewards) {
      const isLoyalty = this.data.loyaltyRewards.some(r => r.code.toUpperCase() === cleanCode);
      if (isLoyalty) {
        return this.validateLoyaltyCoupon(cleanCode, userId, subtotalHTG);
      }
    }

    return {
      valid: false,
      code: cleanCode,
      discountPercent: 0,
      discountHTG: 0,
      subtotalHTG,
      newTotalHTG: subtotalHTG,
      message: 'Code coupon inexistant ou invalide.',
    };
  }

  public getPromotionalCoupons(): PromotionalCoupon[] {
    if (!this.data.promotionalCoupons) {
      this.data.promotionalCoupons = JSON.parse(JSON.stringify(DEFAULT_PROMOTIONAL_COUPONS));
    }
    // Update statuses dynamically
    for (const c of this.data.promotionalCoupons) {
      c.status = this.computePromotionalCouponStatus(c);
    }
    return this.data.promotionalCoupons;
  }

  public getPromotionalCouponById(id: string): PromotionalCoupon | undefined {
    const coupon = (this.data.promotionalCoupons || []).find(c => c.id === id);
    if (coupon) {
      coupon.status = this.computePromotionalCouponStatus(coupon);
    }
    return coupon;
  }

  public getPromotionalCouponByCode(code: string): PromotionalCoupon | undefined {
    const clean = (code || '').trim().toUpperCase().replace(/\s+/g, '');
    const coupon = (this.data.promotionalCoupons || []).find(c => c.code.toUpperCase() === clean);
    if (coupon) {
      coupon.status = this.computePromotionalCouponStatus(coupon);
    }
    return coupon;
  }

  public createPromotionalCoupon(
    input: {
      campaignName: string;
      code: string;
      description?: string;
      discountPercent: number;
      minOrderAmountHTG?: number;
      maxDiscountHTG?: number;
      maxGlobalUses?: number;
      maxUsesPerCustomer?: number;
      startDate?: string;
      expiresAt?: string;
      isActive?: boolean;
    },
    adminEmail: string
  ): PromotionalCoupon {
    if (!input.campaignName || !input.campaignName.trim()) {
      throw new Error('Le nom de la campagne est obligatoire.');
    }
    if (!input.code || !input.code.trim()) {
      throw new Error('Le code du coupon est obligatoire.');
    }

    const cleanCode = input.code.trim().toUpperCase().replace(/\s+/g, '');
    if (cleanCode.length < 3) {
      throw new Error('Le code coupon doit comporter au moins 3 caractères.');
    }

    if (!this.data.promotionalCoupons) {
      this.data.promotionalCoupons = [];
    }

    const exists = this.data.promotionalCoupons.some(c => c.code.toUpperCase() === cleanCode);
    if (exists) {
      throw new Error(`Le code coupon "${cleanCode}" existe déjà. Veuillez choisir un code distinct.`);
    }

    const discountPercent = Math.round(input.discountPercent);
    if (isNaN(discountPercent) || discountPercent < 1 || discountPercent > 100) {
      throw new Error('Le pourcentage de réduction doit être compris entre 1% et 100%.');
    }

    const minOrder = input.minOrderAmountHTG !== undefined ? Math.max(0, Math.round(input.minOrderAmountHTG)) : 0;
    const maxDiscount = input.maxDiscountHTG !== undefined && input.maxDiscountHTG > 0 ? Math.round(input.maxDiscountHTG) : undefined;
    const maxGlobalUses = input.maxGlobalUses !== undefined && input.maxGlobalUses > 0 ? Math.round(input.maxGlobalUses) : undefined;
    const maxUsesPerCust = input.maxUsesPerCustomer !== undefined && input.maxUsesPerCustomer > 0 ? Math.round(input.maxUsesPerCustomer) : 1;

    const now = new Date().toISOString();
    const newCoupon: PromotionalCoupon = {
      id: `promo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      code: cleanCode,
      campaignName: input.campaignName.trim(),
      description: input.description?.trim(),
      type: 'PROMOTIONAL',
      discountPercent,
      minOrderAmountHTG: minOrder,
      maxDiscountHTG: maxDiscount,
      maxGlobalUses,
      currentUses: 0,
      maxUsesPerCustomer: maxUsesPerCust,
      startDate: input.startDate || undefined,
      expiresAt: input.expiresAt || undefined,
      isActive: input.isActive !== undefined ? Boolean(input.isActive) : true,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    newCoupon.status = this.computePromotionalCouponStatus(newCoupon);
    this.data.promotionalCoupons.unshift(newCoupon);

    this.logActivity(
      adminEmail,
      'CREATION_COUPON_PROMO',
      `Coupon ${newCoupon.code}`,
      `Création du coupon promo ${newCoupon.code} (${newCoupon.discountPercent}%) pour la campagne "${newCoupon.campaignName}".`
    );
    this.save();
    return newCoupon;
  }

  public updatePromotionalCoupon(
    id: string,
    updates: {
      campaignName?: string;
      code?: string;
      description?: string;
      discountPercent?: number;
      minOrderAmountHTG?: number;
      maxDiscountHTG?: number | null;
      maxGlobalUses?: number | null;
      maxUsesPerCustomer?: number;
      startDate?: string | null;
      expiresAt?: string | null;
      isActive?: boolean;
    },
    adminEmail: string
  ): PromotionalCoupon {
    const coupon = this.getPromotionalCouponById(id);
    if (!coupon) {
      throw new Error('Coupon promotionnel introuvable.');
    }

    if (updates.code) {
      const newCleanCode = updates.code.trim().toUpperCase().replace(/\s+/g, '');
      if (newCleanCode !== coupon.code) {
        const conflict = this.data.promotionalCoupons.some(c => c.id !== id && c.code.toUpperCase() === newCleanCode);
        if (conflict) {
          throw new Error(`Le code "${newCleanCode}" est déjà utilisé par un autre coupon.`);
        }
        coupon.code = newCleanCode;
      }
    }

    if (updates.campaignName !== undefined && updates.campaignName.trim()) {
      coupon.campaignName = updates.campaignName.trim();
    }
    if (updates.description !== undefined) {
      coupon.description = updates.description ? updates.description.trim() : undefined;
    }
    if (updates.discountPercent !== undefined) {
      const p = Math.round(updates.discountPercent);
      if (p >= 1 && p <= 100) {
        coupon.discountPercent = p;
      }
    }
    if (updates.minOrderAmountHTG !== undefined) {
      coupon.minOrderAmountHTG = Math.max(0, Math.round(updates.minOrderAmountHTG));
    }
    if (updates.maxDiscountHTG !== undefined) {
      coupon.maxDiscountHTG = updates.maxDiscountHTG && updates.maxDiscountHTG > 0 ? Math.round(updates.maxDiscountHTG) : undefined;
    }
    if (updates.maxGlobalUses !== undefined) {
      coupon.maxGlobalUses = updates.maxGlobalUses && updates.maxGlobalUses > 0 ? Math.round(updates.maxGlobalUses) : undefined;
    }
    if (updates.maxUsesPerCustomer !== undefined) {
      coupon.maxUsesPerCustomer = Math.max(1, Math.round(updates.maxUsesPerCustomer));
    }
    if (updates.startDate !== undefined) {
      coupon.startDate = updates.startDate ? updates.startDate : undefined;
    }
    if (updates.expiresAt !== undefined) {
      coupon.expiresAt = updates.expiresAt ? updates.expiresAt : undefined;
    }
    if (updates.isActive !== undefined) {
      coupon.isActive = Boolean(updates.isActive);
    }

    coupon.updatedAt = new Date().toISOString();
    coupon.status = this.computePromotionalCouponStatus(coupon);

    this.logActivity(
      adminEmail,
      'MODIFICATION_COUPON_PROMO',
      `Coupon ${coupon.code}`,
      `Mise à jour des paramètres du coupon ${coupon.code}.`
    );
    this.save();
    return coupon;
  }

  public togglePromotionalCoupon(id: string, adminEmail: string): PromotionalCoupon {
    const coupon = this.getPromotionalCouponById(id);
    if (!coupon) {
      throw new Error('Coupon promotionnel introuvable.');
    }
    coupon.isActive = !coupon.isActive;
    coupon.updatedAt = new Date().toISOString();
    coupon.status = this.computePromotionalCouponStatus(coupon);

    this.logActivity(
      adminEmail,
      'TOGGLE_COUPON_PROMO',
      `Coupon ${coupon.code}`,
      `Coupon ${coupon.code} ${coupon.isActive ? 'activé' : 'désactivé'}.`
    );
    this.save();
    return coupon;
  }

  public deletePromotionalCoupon(id: string, adminEmail: string): boolean {
    const index = (this.data.promotionalCoupons || []).findIndex(c => c.id === id);
    if (index === -1) {
      throw new Error('Coupon promotionnel introuvable.');
    }
    const coupon = this.data.promotionalCoupons[index];

    // Check if any order or usage is associated with this coupon
    const orderCount = this.data.orders.filter(
      o => o.couponId === coupon.id || (o.couponCode && o.couponCode.toUpperCase() === coupon.code.toUpperCase())
    ).length;

    const usageCount = (this.data.promotionalCouponUsages || []).filter(u => u.couponId === coupon.id).length;

    if (orderCount > 0 || usageCount > 0 || (coupon.currentUses && coupon.currentUses > 0)) {
      throw new Error(
        `Impossible de supprimer le coupon "${coupon.code}" car il a déjà été utilisé dans ${orderCount || usageCount || coupon.currentUses} commande(s). Veuillez plutôt le désactiver afin de préserver l'historique comptable.`
      );
    }

    const removed = this.data.promotionalCoupons.splice(index, 1)[0];
    this.logActivity(
      adminEmail,
      'SUPPRESSION_COUPON_PROMO',
      `Coupon ${removed.code}`,
      `Suppression définitive du coupon promo "${removed.code}".`
    );
    this.save();
    return true;
  }

  public getPromotionalCouponUsages(couponId?: string): PromotionalCouponUsage[] {
    const usages = this.data.promotionalCouponUsages || [];
    if (couponId) {
      return usages.filter(u => u.couponId === couponId);
    }
    return usages;
  }

  public getAvailablePromotionalCouponsForCustomer(userId: string): PromotionalCoupon[] {
    const coupons = this.getPromotionalCoupons();
    const now = new Date();

    return coupons.filter(c => {
      if (!c.isActive) return false;
      if (c.startDate && new Date(c.startDate) > now) return false;
      if (c.expiresAt && new Date(c.expiresAt) < now) return false;
      if (typeof c.maxGlobalUses === 'number' && c.maxGlobalUses > 0 && c.currentUses >= c.maxGlobalUses) return false;

      const maxPerCustomer = typeof c.maxUsesPerCustomer === 'number' && c.maxUsesPerCustomer > 0 ? c.maxUsesPerCustomer : 1;
      const userUsages = (this.data.promotionalCouponUsages || []).filter(
        u => u.couponId === c.id && u.userId === userId && !u.isRefunded
      ).length;

      if (userUsages >= maxPerCustomer) return false;
      return true;
    });
  }

  // Admin Loyalty Config & Management
  public getLoyaltyConfig(): LoyaltyConfig {
    if (!this.data.loyaltyConfig) {
      this.data.loyaltyConfig = {
        enabled: true,
        tiers: JSON.parse(JSON.stringify(DEFAULT_LOYALTY_TIERS)),
      };
    }
    if (!Array.isArray(this.data.loyaltyConfig.tiers) || this.data.loyaltyConfig.tiers.length === 0) {
      this.data.loyaltyConfig.tiers = JSON.parse(JSON.stringify(DEFAULT_LOYALTY_TIERS));
    }
    return this.data.loyaltyConfig;
  }

  public updateLoyaltyConfig(enabled: boolean, adminEmail: string): LoyaltyConfig {
    this.getLoyaltyConfig();
    this.data.loyaltyConfig.enabled = enabled;
    this.logActivity(
      adminEmail,
      'MODIFICATION_FIDELITE',
      'Système de fidélité',
      `Fidélité ${enabled ? 'activée' : 'désactivée'}.`
    );
    this.save();
    return this.data.loyaltyConfig;
  }

  public createLoyaltyTier(
    tier: {
      minSpendHTG: number;
      discountPercent: number;
      validityDays: number;
      minOrderAmountHTG?: number;
      maxDiscountHTG?: number;
      maxUses?: number;
      isActive?: boolean;
    },
    adminEmail: string
  ): LoyaltyTier {
    this.getLoyaltyConfig();
    if (tier.minSpendHTG <= 0 || tier.discountPercent <= 0 || tier.discountPercent > 100) {
      throw new Error('Valeurs de palier invalides (seuil > 0 et pourcentage entre 1 et 100).');
    }

    const newTier: LoyaltyTier = {
      id: `tier-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      minSpendHTG: Math.round(tier.minSpendHTG),
      discountPercent: Math.round(tier.discountPercent),
      validityDays: Math.max(1, tier.validityDays || 30),
      minOrderAmountHTG: Math.max(0, tier.minOrderAmountHTG || 0),
      maxDiscountHTG: tier.maxDiscountHTG && tier.maxDiscountHTG > 0 ? Math.round(tier.maxDiscountHTG) : undefined,
      maxUses: Math.max(1, tier.maxUses || 1),
      isActive: tier.isActive !== undefined ? tier.isActive : true,
      createdAt: new Date().toISOString(),
    };

    this.data.loyaltyConfig.tiers.push(newTier);
    this.data.loyaltyConfig.tiers.sort((a, b) => a.minSpendHTG - b.minSpendHTG);
    this.logActivity(
      adminEmail,
      'CREATION_PALIER_FIDELITE',
      `Palier ${newTier.minSpendHTG} HTG`,
      `Création du palier ${newTier.minSpendHTG} HTG (${newTier.discountPercent} %).`
    );
    this.save();
    return newTier;
  }

  public updateLoyaltyTier(
    id: string,
    updates: Partial<LoyaltyTier>,
    adminEmail: string
  ): LoyaltyTier {
    this.getLoyaltyConfig();
    const tier = this.data.loyaltyConfig.tiers.find(t => t.id === id);
    if (!tier) throw new Error('Palier introuvable.');

    if (updates.minSpendHTG !== undefined && updates.minSpendHTG > 0) tier.minSpendHTG = Math.round(updates.minSpendHTG);
    if (updates.discountPercent !== undefined && updates.discountPercent > 0 && updates.discountPercent <= 100) {
      tier.discountPercent = Math.round(updates.discountPercent);
    }
    if (updates.validityDays !== undefined) tier.validityDays = Math.max(1, updates.validityDays);
    if (updates.minOrderAmountHTG !== undefined) tier.minOrderAmountHTG = Math.max(0, updates.minOrderAmountHTG);
    if (updates.maxDiscountHTG !== undefined) {
      tier.maxDiscountHTG = updates.maxDiscountHTG > 0 ? Math.round(updates.maxDiscountHTG) : undefined;
    }
    if (updates.maxUses !== undefined) tier.maxUses = Math.max(1, updates.maxUses);
    if (updates.isActive !== undefined) tier.isActive = updates.isActive;

    this.data.loyaltyConfig.tiers.sort((a, b) => a.minSpendHTG - b.minSpendHTG);
    this.logActivity(
      adminEmail,
      'MODIFICATION_PALIER_FIDELITE',
      `Palier ${tier.minSpendHTG} HTG`,
      `Mise à jour du palier ${tier.minSpendHTG} HTG (${tier.discountPercent} %).`
    );
    this.save();
    return tier;
  }

  public deleteLoyaltyTier(id: string, adminEmail: string): boolean {
    this.getLoyaltyConfig();
    const index = this.data.loyaltyConfig.tiers.findIndex(t => t.id === id);
    if (index === -1) throw new Error('Palier introuvable.');
    const removed = this.data.loyaltyConfig.tiers.splice(index, 1)[0];
    this.logActivity(
      adminEmail,
      'SUPPRESSION_PALIER_FIDELITE',
      `Palier ${removed.minSpendHTG} HTG`,
      `Suppression du palier ${removed.minSpendHTG} HTG.`
    );
    this.save();
    return true;
  }

  public getAllLoyaltyRewards(): (LoyaltyReward & { totalSpentHTG: number })[] {
    this.refreshLoyaltyRewardStatuses();
    return (this.data.loyaltyRewards || []).map(reward => ({
      ...reward,
      totalSpentHTG: this.calculateUserTotalSpent(reward.userId),
    }));
  }

  // Reset demo data safely
  public resetDemoData(adminEmail: string) {
    this.data.categories = INITIAL_CATEGORIES;
    this.data.platforms = INITIAL_PLATFORMS;
    this.data.products = INITIAL_PRODUCTS;
    this.data.digitalCodes = generateInitialCodes();
    this.data.siteSettings = INITIAL_SITE_SETTINGS;
    this.data.paymentMethods = INITIAL_PAYMENT_METHODS;
    this.logActivity(adminEmail, 'REINITIALISATION_DEMO', 'Catalogue et paramètres', 'Réinitialisation des données de démonstration vers les valeurs par défaut.');
    this.save();
  }

  // ==================== PROMOTIONAL POSTERS (ENTITÉ INDÉPENDANTE DE PRODUCT) ====================

  private normalizePoster(p: any): PromotionalPoster {
    const isPub = p.published !== undefined ? Boolean(p.published) : Boolean(p.isPublished);
    const isActive = p.active !== undefined ? Boolean(p.active) : true;
    const imgUrl = p.imageUrl || p.renderedImageUrl || p.thumbnailUrl || p.content?.imageUrl || '';
    return {
      id: p.id,
      imageUrl: imgUrl,
      renderedImageUrl: p.renderedImageUrl || imgUrl,
      thumbnailUrl: p.thumbnailUrl || p.renderedImageUrl || imgUrl,
      title: (p.title || '').trim(),
      description: p.description || p.content?.headline || p.content?.secondaryText || '',
      type: p.type || p.templateType || 'PROMOTION',
      templateType: p.templateType || 'PROMOTION',
      format: p.format || 'banner',
      couponId: p.couponId || (p.couponSnapshot ? p.couponSnapshot.couponId : null),
      couponSnapshot: p.couponSnapshot,
      actionLabel: p.actionLabel || p.content?.callToAction || null,
      actionUrl: p.actionUrl || null,
      startAt: p.startAt || null,
      expiresAt: p.expiresAt || null,
      active: isActive,
      published: isPub,
      isPublished: isPub,
      displayOrder: typeof p.displayOrder === 'number' ? p.displayOrder : 0,
      content: p.content,
      createdAt: p.createdAt || new Date().toISOString(),
      updatedAt: p.updatedAt || new Date().toISOString(),
      createdBy: p.createdBy,
    };
  }

  public getPromotionalPosters(filterPublishedAndActiveOnly = false): PromotionalPoster[] {
    if (!this.data.promotionalPosters) {
      this.data.promotionalPosters = [];
    }
    const now = Date.now();
    let list = this.data.promotionalPosters.map(p => this.normalizePoster(p));
    
    if (filterPublishedAndActiveOnly) {
      list = list.filter(p => {
        // 1. Must be published
        if (!p.published && !p.isPublished) return false;
        // 2. Must be active
        if (p.active === false) return false;
        // 3. Must not be expired
        if (p.expiresAt) {
          const expTime = new Date(p.expiresAt).getTime();
          if (!isNaN(expTime) && expTime < now) return false;
        }
        // 4. Must have started if startAt is defined
        if (p.startAt) {
          const startTime = new Date(p.startAt).getTime();
          if (!isNaN(startTime) && startTime > now) return false;
        }
        return true;
      });
    }

    return list.sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) {
        return a.displayOrder - b.displayOrder;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  public getPromotionalPosterById(id: string): PromotionalPoster | undefined {
    const found = (this.data.promotionalPosters || []).find(p => p.id === id);
    return found ? this.normalizePoster(found) : undefined;
  }

  public createPromotionalPoster(input: Partial<PromotionalPoster>, adminEmail: string): PromotionalPoster {
    if (!this.data.promotionalPosters) {
      this.data.promotionalPosters = [];
    }

    const title = (input.title || '').trim();
    if (!title) {
      throw new Error("Le titre de l'affiche est obligatoire.");
    }

    const templateType = input.templateType || 'PROMOTION';
    const type = input.type || templateType;
    const format = input.format || 'banner';
    const now = new Date().toISOString();

    // Handle snapshot coupon if couponId or couponSnapshot is present
    let couponSnapshot: PosterSnapshotCoupon | undefined = input.couponSnapshot;
    if (!couponSnapshot && input.couponId) {
      const c = this.getPromotionalCouponById(input.couponId);
      if (c) {
        couponSnapshot = {
          couponId: c.id,
          code: c.code,
          discountPercent: c.discountPercent,
          minOrderAmountHTG: c.minOrderAmountHTG,
          maxDiscountHTG: c.maxDiscountHTG,
          expiresAt: c.expiresAt,
          campaignName: c.campaignName,
        };
      }
    }

    const isPublished = input.published !== undefined ? Boolean(input.published) : Boolean(input.isPublished);
    const active = input.active !== undefined ? Boolean(input.active) : true;
    const rawImage = input.imageUrl || input.renderedImageUrl || input.content?.imageUrl || '';
    const imageUrl = persistBase64Image(rawImage, 'poster');
    const renderedImageUrl = input.renderedImageUrl ? persistBase64Image(input.renderedImageUrl, 'poster_render') : imageUrl;
    const thumbnailUrl = input.thumbnailUrl ? persistBase64Image(input.thumbnailUrl, 'poster_thumb') : imageUrl;
    const contentImageUrl = input.content?.imageUrl ? persistBase64Image(input.content.imageUrl, 'poster_content') : imageUrl;

    const displayOrder = typeof input.displayOrder === 'number'
      ? input.displayOrder
      : (this.data.promotionalPosters.length > 0
          ? Math.max(...this.data.promotionalPosters.map(p => p.displayOrder || 0)) + 1
          : 0);

    const newPoster: PromotionalPoster = {
      id: `poster-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      imageUrl,
      renderedImageUrl,
      thumbnailUrl,
      title,
      description: input.description || input.content?.headline || input.content?.secondaryText || '',
      type,
      templateType,
      format,
      couponId: input.couponId || (couponSnapshot ? couponSnapshot.couponId : null),
      couponSnapshot,
      actionLabel: input.actionLabel || input.content?.callToAction || null,
      actionUrl: input.actionUrl || null,
      startAt: input.startAt || null,
      expiresAt: input.expiresAt || null,
      active,
      published: isPublished,
      isPublished,
      displayOrder,
      content: {
        title: input.content?.title || title,
        headline: input.content?.headline || input.description || '',
        secondaryText: input.content?.secondaryText || '',
        discountValue: input.content?.discountValue || '',
        couponCode: input.content?.couponCode || (couponSnapshot ? couponSnapshot.code : ''),
        expirationText: input.content?.expirationText || '',
        callToAction: input.content?.callToAction || input.actionLabel || '',
        badgeText: input.content?.badgeText || '',
        imageUrl: contentImageUrl,
        logoUrl: input.content?.logoUrl || '',
        themeStyle: input.content?.themeStyle || 'cyber_cyan',
        customAccentColor: input.content?.customAccentColor || '',
        showStoreBranding: input.content?.showStoreBranding !== false,
        storeName: input.content?.storeName || this.data.siteSettings?.siteName || 'MY STORE',
        tagline: input.content?.tagline || this.data.siteSettings?.slogan || '',
      },
      createdAt: now,
      updatedAt: now,
      createdBy: adminEmail,
    };

    this.data.promotionalPosters.unshift(newPoster);
    this.logActivity(
      adminEmail,
      'CREATION_AFFICHE_PROMO',
      `Affiche "${newPoster.title}"`,
      `Création d'une nouvelle affiche promo [type: ${type}, publiée: ${isPublished}, active: ${active}].`
    );
    this.save();
    return this.normalizePoster(newPoster);
  }

  public updatePromotionalPoster(id: string, updates: Partial<PromotionalPoster>, adminEmail: string): PromotionalPoster {
    if (!this.data.promotionalPosters) {
      this.data.promotionalPosters = [];
    }

    const index = this.data.promotionalPosters.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error('Affiche promotionnelle introuvable.');
    }

    const existing = this.data.promotionalPosters[index];
    const now = new Date().toISOString();

    let couponSnapshot = updates.couponSnapshot !== undefined ? updates.couponSnapshot : existing.couponSnapshot;
    if (updates.couponId && updates.couponId !== existing.couponId && !updates.couponSnapshot) {
      const c = this.getPromotionalCouponById(updates.couponId);
      if (c) {
        couponSnapshot = {
          couponId: c.id,
          code: c.code,
          discountPercent: c.discountPercent,
          minOrderAmountHTG: c.minOrderAmountHTG,
          maxDiscountHTG: c.maxDiscountHTG,
          expiresAt: c.expiresAt,
          campaignName: c.campaignName,
        };
      }
    }

    const isPublished = updates.published !== undefined
      ? Boolean(updates.published)
      : (updates.isPublished !== undefined ? Boolean(updates.isPublished) : existing.published ?? existing.isPublished);

    const active = updates.active !== undefined ? Boolean(updates.active) : (existing.active ?? true);
    const rawImage = updates.imageUrl || updates.renderedImageUrl || updates.content?.imageUrl || existing.imageUrl || existing.renderedImageUrl || '';
    const imageUrl = persistBase64Image(rawImage, 'poster');
    const renderedImageUrl = updates.renderedImageUrl !== undefined ? persistBase64Image(updates.renderedImageUrl, 'poster_render') : (existing.renderedImageUrl || imageUrl);
    const thumbnailUrl = updates.thumbnailUrl !== undefined ? persistBase64Image(updates.thumbnailUrl, 'poster_thumb') : (existing.thumbnailUrl || imageUrl);
    const contentImageUrl = updates.content?.imageUrl ? persistBase64Image(updates.content.imageUrl, 'poster_content') : (existing.content?.imageUrl || imageUrl);

    const updated: PromotionalPoster = {
      ...existing,
      imageUrl,
      renderedImageUrl,
      thumbnailUrl,
      title: updates.title ? updates.title.trim() : existing.title,
      description: updates.description !== undefined ? updates.description : (existing.description || ''),
      type: updates.type || updates.templateType || existing.type || 'PROMOTION',
      templateType: updates.templateType || existing.templateType || 'PROMOTION',
      format: updates.format || existing.format || 'banner',
      couponId: updates.couponId !== undefined ? updates.couponId : existing.couponId,
      couponSnapshot,
      actionLabel: updates.actionLabel !== undefined ? updates.actionLabel : existing.actionLabel,
      actionUrl: updates.actionUrl !== undefined ? updates.actionUrl : existing.actionUrl,
      startAt: updates.startAt !== undefined ? updates.startAt : existing.startAt,
      expiresAt: updates.expiresAt !== undefined ? updates.expiresAt : existing.expiresAt,
      active,
      published: isPublished,
      isPublished,
      displayOrder: typeof updates.displayOrder === 'number' ? updates.displayOrder : existing.displayOrder,
      content: {
        ...existing.content,
        ...(updates.content || {}),
        imageUrl: contentImageUrl,
      },
      updatedAt: now,
    };

    this.data.promotionalPosters[index] = updated;
    this.logActivity(
      adminEmail,
      'MODIFICATION_AFFICHE_PROMO',
      `Affiche "${updated.title}"`,
      `Mise à jour de l'affiche promotionnelle "${updated.title}".`
    );
    this.save();
    return this.normalizePoster(updated);
  }

  public duplicatePromotionalPoster(id: string, adminEmail: string): PromotionalPoster {
    const original = this.getPromotionalPosterById(id);
    if (!original) {
      throw new Error('Affiche originale introuvable pour duplication.');
    }

    const now = new Date().toISOString();
    const duplicated: PromotionalPoster = {
      ...JSON.parse(JSON.stringify(original)),
      id: `poster-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: `Copie de ${original.title}`,
      published: false,
      isPublished: false,
      active: true,
      displayOrder: (this.data.promotionalPosters?.length || 0) + 1,
      createdAt: now,
      updatedAt: now,
      createdBy: adminEmail,
    };

    if (!this.data.promotionalPosters) {
      this.data.promotionalPosters = [];
    }
    this.data.promotionalPosters.unshift(duplicated);
    this.logActivity(
      adminEmail,
      'DUPLICATION_AFFICHE_PROMO',
      `Copie de "${original.title}"`,
      `Duplication de l'affiche "${original.title}".`
    );
    this.save();
    return this.normalizePoster(duplicated);
  }

  public setPromotionalPosterPublish(id: string, isPublished: boolean, adminEmail: string): PromotionalPoster {
    const poster = this.data.promotionalPosters?.find(p => p.id === id);
    if (!poster) {
      throw new Error('Affiche promotionnelle introuvable.');
    }
    poster.published = Boolean(isPublished);
    poster.isPublished = Boolean(isPublished);
    poster.updatedAt = new Date().toISOString();

    if (poster.published) {
      this.addNotification(
        'all',
        'Nouvelle offre publiée !',
        `Découvrez notre nouvelle promotion : ${poster.title}`,
        'promotion',
        { relatedEntityId: poster.id, relatedEntityType: 'poster' }
      );
    }

    this.logActivity(
      adminEmail,
      'STATUT_AFFICHE_PROMO',
      `Affiche "${poster.title}"`,
      poster.published ? 'Publication sur la boutique (Affichée)' : 'Masquage de la boutique (Masquée)'
    );
    this.save();
    return this.normalizePoster(poster);
  }

  public togglePromotionalPosterPublish(id: string, adminEmail: string): PromotionalPoster {
    const poster = this.data.promotionalPosters?.find(p => p.id === id);
    if (!poster) {
      throw new Error('Affiche promotionnelle introuvable.');
    }
    const current = poster.published ?? poster.isPublished;
    return this.setPromotionalPosterPublish(id, !current, adminEmail);
  }

  public activatePromotionalPoster(id: string, adminEmail: string): PromotionalPoster {
    const poster = this.data.promotionalPosters?.find(p => p.id === id);
    if (!poster) {
      throw new Error('Affiche promotionnelle introuvable.');
    }
    poster.active = true;
    poster.updatedAt = new Date().toISOString();
    this.logActivity(adminEmail, 'ACTIVATION_AFFICHE', `Affiche "${poster.title}"`, 'Affiche activée.');
    this.save();
    return this.normalizePoster(poster);
  }

  public deactivatePromotionalPoster(id: string, adminEmail: string): PromotionalPoster {
    const poster = this.data.promotionalPosters?.find(p => p.id === id);
    if (!poster) {
      throw new Error('Affiche promotionnelle introuvable.');
    }
    poster.active = false;
    poster.updatedAt = new Date().toISOString();
    this.logActivity(adminEmail, 'DESACTIVATION_AFFICHE', `Affiche "${poster.title}"`, 'Affiche désactivée.');
    this.save();
    return this.normalizePoster(poster);
  }

  public reorderPromotionalPosters(orderedIds: string[], adminEmail: string): PromotionalPoster[] {
    if (!this.data.promotionalPosters) {
      this.data.promotionalPosters = [];
    }
    orderedIds.forEach((id, index) => {
      const p = this.data.promotionalPosters?.find(item => item.id === id);
      if (p) {
        p.displayOrder = index;
        p.updatedAt = new Date().toISOString();
      }
    });
    this.logActivity(adminEmail, 'REORDONNANCEMENT_AFFICHES', 'Affiches promo', `Réordonnancement de ${orderedIds.length} affiches.`);
    this.save();
    return this.getPromotionalPosters(false);
  }

  public deletePromotionalPoster(id: string, adminEmail: string): boolean {
    if (!this.data.promotionalPosters) {
      this.data.promotionalPosters = [];
    }
    const index = this.data.promotionalPosters.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error('Affiche introuvable pour suppression.');
    }
    const removed = this.data.promotionalPosters.splice(index, 1)[0];
    this.logActivity(
      adminEmail,
      'SUPPRESSION_AFFICHE_PROMO',
      `Affiche "${removed.title}"`,
      `Suppression définitive de l'affiche promotionnelle "${removed.title}".`
    );
    this.save();
    return true;
  }
}

export const db = new DatabaseStore();
