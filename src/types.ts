export type UserRole = 'ADMIN' | 'CUSTOMER';
export type Language = 'ht' | 'fr' | 'en';
export type AuthMethod = 'EMAIL' | 'GOOGLE' | 'FACEBOOK';
export type ThemePreference = 'dark' | 'light' | 'system';

export interface CommunicationPreferences {
  emailNotifications: boolean;
  orderUpdatesWhatsApp: boolean;
  promotions: boolean;
}

export interface UserPreferences {
  userId: string;
  theme: ThemePreference;
  language: Language;
  communicationPreferences: CommunicationPreferences;
  currencyDisplay?: 'HTG' | 'USD';
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: 'active' | 'blocked' | 'pending';
  preferredLanguage?: Language;
  createdAt: string;
  emailVerified?: boolean;
  termsAccepted?: boolean;
  termsAcceptedAt?: string;
  authMethod?: AuthMethod;
  lastLogin?: string;
  whatsappNumber?: string;
  phone?: string;
}

export interface Wallet {
  id: string;
  userId: string;
  balanceHTG: number;
  currency: 'HTG';
  updatedAt: string;
}

export type TransactionType = 
  | 'DEPOSIT' 
  | 'PURCHASE' 
  | 'REFUND' 
  | 'ADJUSTMENT' 
  | 'RECHARGE' 
  | 'ACHAT' 
  | 'REMBOURSEMENT' 
  | 'AJUSTEMENT_ADMIN';

export interface WalletTransaction {
  id: string;
  walletId: string;
  userId: string;
  type: TransactionType;
  amountHTG: number;
  previousBalanceHTG: number;
  newBalanceHTG: number;
  referenceId?: string;
  reference?: string;
  description: string;
  provider?: string;
  paymentMethod?: string;
  externalReference?: string;
  idempotencyKey?: string;
  status?: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'CANCELLED';
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  subtitle?: string;
  icon?: string;
  iconName?: string;
  badge?: string;
  description?: string;
  displayOrder: number;
  orderIndex?: number; // backwards-compatible alias
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  productsCount?: number;
}

export type GameIdType = 'uid' | 'player_id' | 'user_id' | 'account_id' | 'custom';
export type VerificationProviderType = 'lapakgaming' | 'unipin' | 'garena_official' | 'direct_api' | 'custom_api' | 'manual' | 'none' | 'NOT_CONFIGURED';

export interface GameIdVerificationConfig {
  verificationEnabled: boolean;
  idFieldName: string; // e.g. "UID du joueur", "Player ID", "User ID", "Account ID"
  idType: GameIdType | string;
  idFormatHelp?: string;
  idPlaceholder?: string;
  idRegex?: string; // e.g. "^[0-9]{8,12}$"
  idMinLength?: number;
  idMaxLength?: number;
  minLength?: number;
  maxLength?: number;
  regionRequired?: boolean;
  regionOptions?: string[]; // e.g. ["LATAM", "NA", "BR", "EU", "GLOBAL"]
  serverRequired?: boolean;
  serverOptions?: string[]; // e.g. ["Global", "Europe", "Asia"]
  provider: VerificationProviderType | string;
  providerGameKey?: string;
  customEndpointUrl?: string;
  apiKey?: string;
  providerConfig?: {
    apiUrl?: string;
    apiKey?: string;
    merchantId?: string;
    gameCode?: string;
    apiSecret?: string;
    sandboxMode?: boolean;
  };
}

export interface PlayerVerificationResult {
  verified: boolean;
  verificationToken: string;
  gameId: string;
  gameName: string;
  playerIdentifier: string;
  playerName?: string;
  region?: string;
  server?: string;
  provider: string;
  providerRef?: string;
  verifiedAt: string;
  expiresAt: string;
  errorMessage?: string;
  errorCode?: 'INVALID_ID' | 'INVALID_REGION' | 'API_UNAVAILABLE' | 'GAME_NOT_SUPPORTED' | 'NETWORK_ERROR' | 'INVALID_SERVER';
}

export interface PlatformOrGame {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  image: string;
  bannerImage?: string;
  description: string;
  type: 'game' | 'streaming' | 'panel';
  active: boolean;
  orderIndex: number;
  idVerification?: GameIdVerificationConfig;
}

export type ProductType = 
  | 'topup' 
  | 'code' 
  | 'giftcard' 
  | 'subscription' 
  | 'panel' 
  | 'file' 
  | 'access' 
  | 'service'
  | 'account';

export interface DigitalCode {
  id: string;
  productId: string;
  code: string;
  isUsed: boolean;
  usedByUserId?: string;
  usedAtOrderId?: string;
  usedAt?: string;
  createdAt: string;
}

export type DigitalAccountStatus = 'AVAILABLE' | 'RESERVED' | 'ASSIGNED' | 'DELIVERED' | 'EXPIRED';

export interface DigitalAccount {
  id: string;
  productId: string;
  productName?: string;
  email: string;
  passwordEncrypted: string;
  thankYouMessage?: string;
  durationText?: string;
  durationDays?: number;
  expiresAt?: string;
  customerInstructions?: string;
  adminNotes?: string;
  status: DigitalAccountStatus;
  orderId?: string;
  userId?: string;
  userEmail?: string;
  assignedAt?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveredAccountInfo {
  id: string;
  productId: string;
  productName?: string;
  email: string;
  loginEmail?: string;
  password?: string;
  thankYouMessage?: string;
  durationText?: string;
  durationDays?: number;
  expiresAt?: string;
  status: 'ACTIVE' | 'EXPIRED';
  customerInstructions?: string;
  instructions?: string;
  profileName?: string;
  platformName?: string;
  assignedAt?: string;
  notes?: string;
}

export type DeliveryType = 'CODE' | 'COMPTE' | 'DOWNLOAD_LINK' | 'MANUEL' | 'DIGITAL_INSTANT' | 'MANUAL_WHATSAPP';

export interface Media {
  id: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  url: string;
  storageKey: string;
  width?: number;
  height?: number;
  createdAt: string;
  updatedAt: string;
  uploadedBy: string;
  altText?: string;
}

export interface Product {
  id: string;
  name: string;
  name_ht?: string;
  name_fr?: string;
  name_en?: string;
  description: string;
  description_ht?: string;
  description_fr?: string;
  description_en?: string;
  image: string;
  imageId?: string;
  galleryImages?: string[];
  galleryMediaIds?: string[];
  categoryId: string;
  subcategoryId?: string; // Game or Platform ID
  platformId?: string; // Game or Platform ID
  subcategoryName?: string;
  priceHTG: number;
  sku: string;
  stock: number;
  productType: ProductType;
  status: 'published' | 'hidden' | 'draft' | 'out_of_stock' | 'archived';
  isFeatured: boolean;
  featuredOrder?: number;
  deliveryInstructions?: string;
  customerInstructions?: string;
  adminInstructions?: string;
  thankYouMessage?: string;
  originalPriceHTG?: number;
  deliveryType?: DeliveryType;
  downloadUrl?: string;
  hasProtectedContent?: boolean;
  protectedContentTitle?: string;
  protectedContent?: string;
  protectedTutorial?: string;
  processingTime?: string;
  lowStockThreshold?: number;
  requiresPlayerIdVerification?: boolean;
  verificationIdFieldName?: string;
  requiresWhatsApp?: boolean;
  requiresAdditionalVerification?: boolean;
  additionalVerificationInstructions?: string;
  accountCredentials?: {
    email?: string;
    password?: string;
    profile?: string;
  };
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  playerIdentifier?: string; // Player ID / UID for top-up
  verificationToken?: string; // Server verification token confirming verified ID
  playerConfirmed?: boolean;
  customerWhatsApp?: string;
  accountEmail?: string;
  accountName?: string;
  customRequirement?: string;
  verifiedInfo?: {
    playerName?: string;
    region?: string;
    server?: string;
    provider?: string;
    verifiedAt?: string;
  };
}

export interface UserCart {
  userId: string;
  items: CartItem[];
  updatedAt: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  productImage: string;
  priceHTG: number;
  quantity: number;
  productType: ProductType;
  assignedCode?: string;
  deliveryDetails?: string;
  playerIdentifier?: string;
  accountEmail?: string;
  accountName?: string;
  customRequirement?: string;
  verifiedPlayerName?: string;
  verifiedRegion?: string;
  verifiedServer?: string;
  verificationDate?: string;
  verificationStatus?: 'VERIFIED' | 'UNVERIFIED' | 'NOT_REQUIRED';
  verificationProvider?: string;
  verificationRef?: string;
  digitalCodesDelivered?: string[];
  deliveredAccount?: DeliveredAccountInfo;
  thankYouMessage?: string;
  deliveredDownloadUrl?: string;
  downloadUrl?: string;
  requiresWhatsApp?: boolean;
  customerWhatsApp?: string;
}

export type OrderStatus = 'PENDING' | 'PAID' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
export type OrderDeliveryType = 'DIGITAL_INSTANT' | 'MANUAL_SERVICE';

export interface OrderStatusHistory {
  status: OrderStatus;
  timestamp: string;
  updatedBy: string;
  note?: string;
}

export interface OrderAdminNote {
  id: string;
  note: string;
  createdAt: string;
  adminEmail: string;
  author?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  customerEmail: string;
  customerName: string;
  totalHTG: number;
  totalAmountHTG?: number;
  subtotalHTG?: number;
  discountHTG?: number;
  couponCode?: string;
  couponType?: CouponType;
  couponId?: string;
  discountPercent?: number;
  status: OrderStatus;
  paymentStatus: 'PAID' | 'FAILED' | 'REFUNDED';
  digitalDeliveryStatus: 'DELIVERED' | 'PROCESSING' | 'FAILED';
  deliveryType?: OrderDeliveryType;
  transactionId: string;
  items: OrderItem[];
  requiresWhatsApp?: boolean;
  customerWhatsApp?: string;
  deliveryNote?: string;
  statusHistory?: OrderStatusHistory[];
  adminNotes?: OrderAdminNote[];
  refundReason?: string;
  refundedAt?: string;
  createdAt: string;
}

export interface CustomerLibraryItem {
  id: string;
  userId: string;
  orderId: string;
  productId: string;
  productName: string;
  productImage: string;
  productType: ProductType;
  deliveryType?: DeliveryType;
  digitalCode?: string;
  accessDetails?: string;
  playerIdentifier?: string;
  verifiedPlayerName?: string;
  verifiedRegion?: string;
  verifiedServer?: string;
  verificationStatus?: 'VERIFIED' | 'UNVERIFIED' | 'NOT_REQUIRED';
  requiresWhatsApp?: boolean;
  customerWhatsApp?: string;
  accountCredentials?: {
    email?: string;
    password?: string;
    profile?: string;
  };
  accountEmail?: string;
  accountName?: string;
  accessInstructions?: string;
  deliveredAccount?: DeliveredAccountInfo;
  thankYouMessage?: string;
  downloadUrl?: string;
  deliveredDownloadUrl?: string;
  instructions: string;
  purchasedAt: string;
}

export type RechargeStatus = 
  | 'PENDING' 
  | 'APPROVED' 
  | 'CONFIRMED' 
  | 'REJECTED' 
  | 'REFUSED'
  | 'FAILED' 
  | 'CANCELLED' 
  | 'EXPIRED';

export interface RechargeRequest {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  amountHTG: number;
  feeHTG?: number;
  finalAmountHTG?: number;
  paymentMethod: 'natcash' | 'moncash' | string;
  paymentMethodKey?: string;
  provider?: string;
  transcode: string; // reference SMS / transaction ID
  externalReference?: string;
  idempotencyKey?: string;
  paymentDate: string;
  screenshotUrl?: string;
  status: RechargeStatus;
  adminNote?: string;
  processedAt?: string;
  processedByAdmin?: string;
  confirmedAt?: string;
  isManual?: boolean;
  createdAt: string;
}

export interface PaymentMethodConfig {
  id: string;
  key: 'natcash' | 'moncash' | string;
  name: string;
  phoneNumber?: string;
  recipientName?: string;
  isActive: boolean;
  isManualModeOnly: boolean;
  mode?: 'manual' | 'automatic';
  description: string;
  instructions: string;
  feePercentage?: number;
  fixedFeeHTG?: number;
}

export interface ChatbotConfig {
  enabled: boolean;
  botName: string;
  welcomeMessage_ht?: string;
  welcomeMessage_fr?: string;
  welcomeMessage_en?: string;
  fallbackMessage?: string;
  customKnowledge?: string;
  supportPhone?: string;
}

export type ChatActionType = 
  | 'view_product' 
  | 'view_order' 
  | 'open_library' 
  | 'open_wallet' 
  | 'open_coupons' 
  | 'contact_support' 
  | 'quick_reply';

export interface ChatAction {
  type: ChatActionType;
  label: string;
  payload?: any;
}

export interface EscalationSummary {
  orderNumber?: string;
  productName?: string;
  issueDescription?: string;
  whatsappUrl?: string;
  supportPhone?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  actions?: ChatAction[];
  escalationSummary?: EscalationSummary;
}

export interface SiteSettings {
  siteName: string;
  brandBadge?: string;
  logoText: string;
  logoUrl?: string;
  faviconUrl?: string;
  siteSlogan?: string;
  slogan: string;
  description: string;
  bannerTitle: string;
  bannerSubtitle: string;
  bannerImage: string;
  featuredSectionTitle: string;
  natcashNumber: string;
  moncashEnabled: boolean;
  moncashNumber?: string;
  accentColor?: string;
  primaryAccentColor: string;
  homepageWelcomeText?: string;
  supportPhone: string;
  supportEmail?: string;
  whatsappNumber?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  announcementMessage?: string;
  chatbotConfig?: ChatbotConfig;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  target: 'all' | 'admin' | string; // user ID or 'admin' or 'all'
  userId?: string;
  title: string;
  message: string;
  type: 'order' | 'recharge' | 'stock' | 'system' | 'delivery' | 'promotion' | 'payment';
  isRead: boolean;
  read?: boolean;
  relatedEntityId?: string;
  relatedEntityType?: 'order' | 'recharge' | 'product' | 'poster' | 'system';
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  adminEmail: string;
  performedBy?: string;
  action: string;
  targetObject: string;
  details: string;
  createdAt: string;
}

export interface AdminStats {
  todaySalesHTG: number;
  totalSalesHTG: number;
  totalRechargesHTG: number;
  ordersCount: number;
  customersCount: number;
  productsCount: number;
  totalWalletBalanceHTG: number;
  lowStockCount: number;
  outOfStockCount?: number;
  pendingRechargesCount: number;
  recentOrders: Order[];
  recentRecharges: RechargeRequest[];
  topSellingProducts: { product: Product; soldCount: number }[];
  salesByDay: { date: string; amountHTG: number; ordersCount: number }[];
}

// ==================== LOYALTY & REWARDS SYSTEM ====================
export interface LoyaltyTier {
  id: string;
  minSpendHTG: number; // Montant nécessaire en HTG (ex: 1000, 2500, 5000, 10000)
  discountPercent: number; // Pourcentage de réduction (ex: 15, 20, 25, 30)
  validityDays: number; // Durée du coupon en jours (ex: 30)
  minOrderAmountHTG: number; // Montant minimum de commande (ex: 0)
  maxDiscountHTG?: number; // Réduction maximale autorisée en HTG
  maxUses: number; // Nombre maximal d'utilisations (1 par défaut)
  isActive: boolean;
  createdAt: string;
}

export interface LoyaltyReward {
  id: string;
  tierId: string;
  tierName?: string;
  userId: string;
  userEmail: string;
  userName: string;
  code: string; // Ex: FIDELITE15-XXXX
  discountPercent: number;
  minOrderAmountHTG: number;
  maxDiscountHTG?: number;
  maxUses: number;
  usedCount: number;
  status: 'available' | 'used' | 'expired' | 'AVAILABLE' | 'USED' | 'EXPIRED';
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
  usedAtOrderId?: string;
  thresholdHTG: number; // Montant nécessaire ayant généré la récompense
}

export interface LoyaltyConfig {
  enabled: boolean;
  tiers: LoyaltyTier[];
}

export interface CustomerLoyaltyStatus {
  totalSpentHTG: number;
  nextTier: LoyaltyTier | null;
  currentTier: LoyaltyTier | null;
  progressPercent: number;
  targetSpendHTG: number;
  amountNeededHTG?: number;
  rewards: LoyaltyReward[];
  availableCoupons: LoyaltyReward[];
  systemEnabled: boolean;
}

export type CouponType = 'PROMOTIONAL' | 'LOYALTY';
export type PromotionalCouponStatus = 'DRAFT' | 'ACTIVE' | 'DISABLED' | 'EXHAUSTED' | 'EXPIRED';

export interface PromotionalCoupon {
  id: string;
  code: string; // code unique, normalisé en majuscules sans espaces
  campaignName: string; // Nom interne de la campagne
  description?: string; // Description interne facultative
  type: 'PROMOTIONAL';
  discountPercent: number; // 1 à 100
  minOrderAmountHTG: number; // 0 si aucun minimum
  maxDiscountHTG?: number; // Plafond en HTG (optionnel)
  maxGlobalUses?: number; // Limite globale (ex: 10, 14, 50, 100, ou indéfini pour illimité)
  currentUses: number; // Nombre d'utilisations validées
  maxUsesPerCustomer: number; // 1 par défaut, ou plusieurs
  startDate?: string; // Date de début éventuelle (ISO)
  expiresAt?: string; // Date d'expiration (ISO)
  isActive: boolean;
  status: PromotionalCouponStatus; // DRAFT | ACTIVE | DISABLED | EXHAUSTED | EXPIRED
  createdAt: string;
  updatedAt: string;
}

export interface PromotionalCouponUsage {
  id: string;
  couponId: string;
  couponCode: string;
  userId: string;
  userEmail: string;
  userName?: string;
  orderId: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  subtotalHTG: number;
  discountHTG: number;
  finalTotalHTG: number;
  usedAt: string;
  isRefunded?: boolean;
}

export interface CouponValidationResult {
  valid: boolean;
  code: string;
  type?: CouponType;
  campaignName?: string;
  couponId?: string;
  discountPercent: number;
  discountHTG: number;
  subtotalHTG: number;
  newTotalHTG: number;
  reward?: LoyaltyReward;
  promotionalCoupon?: PromotionalCoupon;
  message?: string;
}

export type UnifiedCouponValidationResult = CouponValidationResult;

// ==================== PROMOTIONAL POSTERS ====================

export type PosterTemplateType =
  | 'PROMOTION'
  | 'ANNIVERSARY'
  | 'NEW_PRODUCT'
  | 'NEW_SERVICE'
  | 'LIMITED_OFFER'
  | 'CUSTOMER_THANKS'
  | 'COUPON'
  | 'CUSTOM';

export type PosterType =
  | 'PROMOTION'
  | 'FLASH_SALE'
  | 'NEW_ARRIVALS'
  | 'DISCOUNT'
  | 'ANNIVERSARY'
  | 'CUSTOM';

export type PosterFormat = '1:1' | '4:5' | '9:16' | 'banner';

export type PosterThemeStyle =
  | 'cyber_cyan'
  | 'midnight_blue'
  | 'gold_luxury'
  | 'crimson_gaming'
  | 'emerald_pro'
  | 'violet_neon';

export interface PosterSnapshotCoupon {
  couponId?: string;
  code: string;
  discountPercent: number;
  minOrderAmountHTG?: number;
  maxDiscountHTG?: number;
  expiresAt?: string;
  campaignName?: string;
}

export interface PromotionalPosterContent {
  title?: string;
  headline?: string;
  secondaryText?: string;
  discountValue?: string; // e.g. "20%" or "20% OFF"
  couponCode?: string;
  expirationText?: string;
  callToAction?: string; // e.g. "PROFITEZ DE L'OFFRE"
  badgeText?: string; // e.g. "OFFRE SPÉCIALE"
  imageUrl?: string;
  logoUrl?: string;
  themeStyle: PosterThemeStyle;
  customAccentColor?: string;
  showStoreBranding: boolean;
  storeName?: string;
  tagline?: string;
}

export type PosterStatus = 'BROUILLON' | 'PUBLIEE' | 'ACTIVE' | 'EXPIREE' | 'DESACTIVEE';

export interface PromotionalPoster {
  id: string;
  imageUrl: string;
  renderedImageUrl?: string;
  thumbnailUrl?: string;
  title: string;
  description?: string;
  type: string;
  templateType?: PosterTemplateType;
  format?: PosterFormat;
  couponId?: string | null;
  couponSnapshot?: PosterSnapshotCoupon;
  actionLabel?: string | null;
  actionUrl?: string | null;
  startAt?: string | null;
  expiresAt?: string | null;
  active: boolean;
  published: boolean;
  isPublished: boolean; // Gardé synchronisé avec published pour rétro-compatibilité
  displayOrder: number;
  content?: PromotionalPosterContent;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}


