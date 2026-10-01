import {
  User,
  Wallet,
  WalletTransaction,
  Category,
  PlatformOrGame,
  Product,
  Media,
  Order,
  CustomerLibraryItem,
  RechargeRequest,
  PaymentMethodConfig,
  SiteSettings,
  AppNotification,
  ActivityLog,
  AdminStats,
  DigitalCode,
  PlayerVerificationResult,
  CartItem,
  OrderStatus,
  LoyaltyTier,
  LoyaltyReward,
  LoyaltyConfig,
  CustomerLoyaltyStatus,
  CouponValidationResult,
  PromotionalCoupon,
  PromotionalCouponUsage,
  PromotionalPoster,
  DigitalAccount,
  DeliveredAccountInfo,
  UserPreferences,
  ChatbotConfig,
  ChatAction,
  EscalationSummary,
} from '../types.js';

export class ApiError extends Error {
  public status: number;
  public isNetworkError: boolean;
  public isTimeout: boolean;
  public data: any;

  constructor(message: string, status = 0, data: any = null, isNetworkError = false, isTimeout = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.isNetworkError = isNetworkError;
    this.isTimeout = isTimeout;
  }
}

// Base API fetch helper with automatic retry for idempotent requests
async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const isGet = method === 'GET';
  const maxRetries = isGet ? 2 : 0;
  let attempt = 0;

  while (true) {
    attempt++;
    const customerToken = localStorage.getItem('mystore_token');
    const adminToken = localStorage.getItem('mystore_admin_token') || sessionStorage.getItem('mystore_admin_token');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const isAdminRoute =
      endpoint.startsWith('/api/admin') ||
      endpoint.startsWith('/admin') ||
      endpoint.includes('/upload');

    if (isAdminRoute) {
      if (adminToken) {
        headers['x-admin-token'] = adminToken;
        headers['Authorization'] = `Bearer ${adminToken}`;
      }
      // Strict isolation: Never send customer token to admin endpoints
    } else {
      if (customerToken) {
        headers['Authorization'] = `Bearer ${customerToken}`;
      }
    }

    // Mobile resilience: Timeout controller (15s for GET, 25s for POST/write)
    const controller = new AbortController();
    const timeoutMs = isGet ? 15000 : 25000;
    let didTimeout = false;
    const timeoutId = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, timeoutMs);

    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort());
    }

    let response: Response;
    try {
      response = await fetch(endpoint, {
        credentials: 'include', // Ensures HTTP-only admin cookies are sent when supported
        ...options,
        signal: controller.signal,
        headers,
      });
    } catch (err: any) {
      clearTimeout(timeoutId);

      // Caller intentionally aborted
      if (options.signal?.aborted && !didTimeout) {
        throw err;
      }

      // Retry idempotent GET requests if network glitch
      if (attempt <= maxRetries) {
        await new Promise(res => setTimeout(res, attempt * 500));
        continue;
      }

      if (didTimeout) {
        throw new ApiError(
          'Délai d\'attente dépassé (timeout). Tanpri verifye koneksyon entènèt ou epi eseye ankò.',
          408,
          null,
          true,
          true
        );
      }
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      const msg = isOffline
        ? 'Aparèy ou an pa konekte sou entènèt. Tanpri verifye koneksyon Wi-Fi oswa Done mobil ou.'
        : 'Enposib pou kontakte sèvè a. Tanpri verifye koneksyon entènèt ou epi eseye ankò.';
      throw new ApiError(msg, 0, null, true, false);
    } finally {
      clearTimeout(timeoutId);
    }

    // Auto-retry on transient server gateway errors (502, 503, 504)
    if ((response.status === 502 || response.status === 503 || response.status === 504) && attempt <= maxRetries) {
      await new Promise(res => setTimeout(res, attempt * 500));
      continue;
    }

  let data: any = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    let errorMsg = data.error || data.message;
    if (!errorMsg) {
      switch (response.status) {
        case 401:
          errorMsg = 'Sesyon ou an ekspire. Tanpri rekonekte.';
          break;
        case 403:
          errorMsg = 'Aksè refize. Ou pa gen otorizasyon pou aksyon sa a.';
          break;
        case 404:
          errorMsg = 'Resous ou mande a pa egziste sou sèvè a.';
          break;
        case 409:
          errorMsg = 'Konfli nan operasyon an (deja trete oswa egziste deja).';
          break;
        case 422:
          errorMsg = 'Enfòmasyon ou voye yo pa konfòm.';
          break;
        case 429:
          errorMsg = 'Twòp demann an menm tan. Tanpri pran yon ti pasyans epi re-eseye.';
          break;
        case 500:
        case 502:
        case 503:
          errorMsg = 'Erè entèn nan sèvè a. Ekip la ap travay sou li.';
          break;
        default:
          errorMsg = `Erè sèvè (${response.status})`;
      }
    }
    throw new ApiError(errorMsg, response.status, data, false, false);
  }

  return data as T;
  }
}

export const api = {
  // Public
  getSettings: () => fetchApi<SiteSettings>('/api/site-settings'),
  getCategories: () => fetchApi<Category[]>('/api/categories'),
  getPlatforms: (categoryId?: string) => 
    fetchApi<PlatformOrGame[]>(`/api/platforms${categoryId ? `?categoryId=${categoryId}` : ''}`),
  getProducts: (params?: Record<string, string | boolean | undefined>) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) query.append(k, String(v));
      });
    }
    return fetchApi<Product[]>(`/api/products?${query.toString()}`);
  },
  getProduct: (id: string) => fetchApi<Product>(`/api/products/${id}`),
  getProtectedProductContent: (productId: string) =>
    fetchApi<{ productId: string; title: string; content: string; downloadUrl: string | null }>(
      `/api/products/${productId}/protected-content`
    ),
  getPaymentMethods: () => fetchApi<PaymentMethodConfig[]>('/api/payment-methods'),

  // Auth
  register: (data: { name?: string; email: string; password: string; confirmPassword?: string; termsAccepted?: boolean }) =>
    fetchApi<{ success: boolean; email: string; message: string; cooldownSeconds?: number }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  verifyEmail: (data: { email: string; code: string }) =>
    fetchApi<{ success: boolean; user: User; token: string; message: string }>('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  resendCode: (email: string) =>
    fetchApi<{ success: boolean; message: string; cooldownSeconds?: number }>('/api/auth/resend-code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  forgotPassword: (email: string) =>
    fetchApi<{ success: boolean; message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetPassword: (data: { token: string; email: string; newPassword: string; confirmPassword: string }) =>
    fetchApi<{ success: boolean; message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getOAuthStatus: () =>
    fetchApi<{ emailConfigured: boolean }>('/api/auth/oauth/status'),
  checkFlow: (email: string) =>
    fetchApi<{ flow: 'admin' | 'customer'; redirectTo?: string }>('/api/auth/check-flow', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  login: (data: { email: string; password?: string }) =>
    fetchApi<{ success: boolean; user?: User; token?: string; message?: string; redirectTo?: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getMe: () => fetchApi<{ user: User; wallet: Wallet }>('/api/auth/me'),
  logout: () => fetchApi<{ success: boolean; message: string }>('/api/auth/logout', { method: 'POST' }),
  updateLanguage: (language: string) =>
    fetchApi<{ success: boolean; language: string }>('/api/user/language', {
      method: 'POST',
      body: JSON.stringify({ language }),
    }),
  getPreferences: () => fetchApi<UserPreferences>('/api/user/preferences'),
  updatePreferences: (preferences: Partial<UserPreferences>) =>
    fetchApi<UserPreferences>('/api/user/preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    }),
  updateProfile: (data: { name?: string; whatsappNumber?: string; phone?: string }) =>
    fetchApi<{ success: boolean; user: User }>('/api/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    fetchApi<{ success: boolean; message: string }>('/api/user/password', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Wallet & Recharges
  getWallet: () => fetchApi<Wallet>('/api/wallet'),
  getWalletTransactions: () => fetchApi<WalletTransaction[]>('/api/wallet/transactions'),
  submitManualRecharge: (data: { amountHTG: number; transcode: string; paymentDate: string; screenshotUrl?: string; paymentMethod?: string }) =>
    fetchApi<{ message: string; request: RechargeRequest }>('/api/recharges/manual', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getMyRecharges: () => fetchApi<RechargeRequest[]>('/api/recharges/my'),

  // Universal Game Player ID Verification
  verifyPlayerId: (data: {
    platformId?: string;
    productId?: string;
    playerIdentifier: string;
    region?: string;
    server?: string;
  }) =>
    fetchApi<{ success: boolean; result: PlayerVerificationResult; message?: string }>('/api/games/verify-id', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Cart Persistence & Synchronization
  cart: {
    get: () => fetchApi<{ success: boolean; items: CartItem[] }>('/api/cart'),
    sync: (items: CartItem[]) =>
      fetchApi<{ success: boolean; items: CartItem[] }>('/api/cart', {
        method: 'POST',
        body: JSON.stringify({ items }),
      }),
    add: (item: CartItem) =>
      fetchApi<{ success: boolean; items: CartItem[] }>('/api/cart/add', {
        method: 'POST',
        body: JSON.stringify({ item }),
      }),
    updateItem: (productId: string, quantity: number, details?: Partial<CartItem>) =>
      fetchApi<{ success: boolean; items: CartItem[] }>('/api/cart/item', {
        method: 'PUT',
        body: JSON.stringify({ productId, quantity, details }),
      }),
    removeItem: (productId: string) =>
      fetchApi<{ success: boolean; items: CartItem[] }>(`/api/cart/item/${productId}`, {
        method: 'DELETE',
      }),
    clear: () =>
      fetchApi<{ success: boolean; items: CartItem[] }>('/api/cart', {
        method: 'DELETE',
      }),
  },

  // Checkout & Orders
  checkout: (
    items: {
      productId: string;
      quantity: number;
      playerIdentifier?: string;
      verificationToken?: string;
      customerWhatsApp?: string;
      accountEmail?: string;
      accountName?: string;
      customRequirement?: string;
    }[],
    customerWhatsApp?: string,
    idempotencyKey?: string,
    couponCode?: string
  ) =>
    fetchApi<{ message: string; order: Order; libraryItems: CustomerLibraryItem[] }>('/api/cart/checkout', {
      method: 'POST',
      body: JSON.stringify({ items, customerWhatsApp, idempotencyKey, couponCode }),
    }),
  getOrders: () => fetchApi<Order[]>('/api/orders'),
  getOrder: (id: string) => fetchApi<Order>(`/api/orders/${id}`),
  getOrderDigitalAccount: (orderId: string) =>
    fetchApi<{ orderId: string; orderNumber: string; deliveredAccounts: DeliveredAccountInfo[] }>(`/api/orders/${orderId}/digital-account`),
  getLibrary: () => fetchApi<CustomerLibraryItem[]>('/api/library'),

  // Customer Loyalty & Rewards
  getLoyaltyStatus: () => fetchApi<CustomerLoyaltyStatus>('/api/loyalty/status'),
  validateCoupon: (code: string, subtotalHTG: number) =>
    fetchApi<CouponValidationResult>('/api/coupons/validate', {
      method: 'POST',
      body: JSON.stringify({ code, subtotalHTG }),
    }),
  getAvailablePromotionalCoupons: () => fetchApi<PromotionalCoupon[]>('/api/promotional-coupons/available'),

  // Notifications
  getNotifications: () => fetchApi<AppNotification[]>('/api/notifications'),
  markNotificationRead: (id: string) => fetchApi<{ success: boolean }>(`/api/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => fetchApi<{ success: boolean }>('/api/notifications/read-all', { method: 'POST' }),
  deleteNotification: (id: string) => fetchApi<{ success: boolean }>(`/api/notifications/${id}`, { method: 'DELETE' }),

  // Media upload (real persistent storage)
  uploadImage: (imageBase64: string, filename?: string, altText?: string) =>
    fetchApi<{ success: boolean; media: Media; url: string; name: string; message: string }>('/api/upload', {
      method: 'POST',
      body: JSON.stringify({ imageBase64, filename, altText }),
    }),

  // Public Promotional Posters for storefront (strictly visual marketing announcements)
  getPosters: () => fetchApi<PromotionalPoster[]>('/api/posters'),
  getPublishedPromotionalPosters: () => fetchApi<PromotionalPoster[]>('/api/promotional-posters'),

  // Chatbot Assistant
  chatbot: {
    getConfig: () => fetchApi<ChatbotConfig>('/api/chatbot/config'),
    sendMessage: (data: { message: string; history?: Array<{ sender: 'user' | 'assistant'; text: string }>; lang?: string }) =>
      fetchApi<{ reply: string; actions: ChatAction[]; escalation?: EscalationSummary; detectedLang?: string }>('/api/chatbot/message', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateConfig: (config: Partial<ChatbotConfig>) =>
      fetchApi<ChatbotConfig>('/api/admin/chatbot/config', {
        method: 'PUT',
        body: JSON.stringify(config),
      }),
  },

  // Dedicated Admin Auth
  adminAuth: {
    login: async (data: { email: string; password: string }) => {
      const res = await fetchApi<{ success: boolean; token?: string; user: User; message: string }>('/api/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (res.token) {
        localStorage.setItem('mystore_admin_token', res.token);
        sessionStorage.setItem('mystore_admin_token', res.token);
      }
      return res;
    },
    check: () =>
      fetchApi<{ authenticated: boolean; user?: User }>('/api/admin/auth/check'),
    logout: async () => {
      try {
        return await fetchApi<{ success: boolean; message: string }>('/api/admin/auth/logout', {
          method: 'POST',
        });
      } finally {
        localStorage.removeItem('mystore_admin_token');
        sessionStorage.removeItem('mystore_admin_token');
      }
    },
  },

  // Admin APIs
  admin: {
    getStats: () => fetchApi<AdminStats>('/api/admin/stats'),
    getAllProducts: () => fetchApi<Product[]>('/api/admin/products'),
    saveProduct: (product: Partial<Product>) =>
      fetchApi<Product>('/api/admin/products', {
        method: 'POST',
        body: JSON.stringify(product),
      }),
    updateProduct: (id: string, product: Partial<Product>) =>
      fetchApi<Product>(`/api/admin/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(product),
      }),
    publishProduct: (id: string) =>
      fetchApi<Product>(`/api/admin/products/${id}/publish`, { method: 'POST' }),
    hideProduct: (id: string) =>
      fetchApi<Product>(`/api/admin/products/${id}/hide`, { method: 'POST' }),
    featureProduct: (id: string, isFeatured: boolean = true) =>
      fetchApi<Product>(`/api/admin/products/${id}/feature`, {
        method: 'POST',
        body: JSON.stringify({ isFeatured }),
      }),
    deleteProduct: (id: string) =>
      fetchApi<{ success: boolean }>(`/api/admin/products/${id}`, { method: 'DELETE' }),
    duplicateProduct: (id: string) =>
      fetchApi<Product>(`/api/admin/products/${id}/duplicate`, { method: 'POST' }),
    updateStock: (id: string, action: 'set' | 'add' | 'remove', quantity: number) =>
      fetchApi<Product>(`/api/admin/products/${id}/stock`, {
        method: 'POST',
        body: JSON.stringify({ action, quantity }),
      }),
    getProductCodes: (productId: string) => fetchApi<DigitalCode[]>(`/api/admin/products/${productId}/codes`),
    previewCodes: (productId: string, codes: string[]) =>
      fetchApi<{
        totalGiven: number;
        validCount: number;
        duplicateCount: number;
        existingCount: number;
        toAdd: string[];
        ignored: { code: string; reason: string }[];
      }>(`/api/admin/products/${productId}/codes/preview`, {
        method: 'POST',
        body: JSON.stringify({ codes }),
      }),
    addCodes: (productId: string, codes: string[]) =>
      fetchApi<{ addedCount: number; newStock: number }>(`/api/admin/products/${productId}/codes`, {
        method: 'POST',
        body: JSON.stringify({ codes }),
      }),
    deleteCode: (codeId: string) =>
      fetchApi<{ success: boolean }>(`/api/admin/codes/${codeId}`, { method: 'DELETE' }),

    // Digital Accounts Inventory Management
    getProductDigitalAccounts: (productId: string) =>
      fetchApi<(Omit<DigitalAccount, 'passwordEncrypted'> & { passwordMasked: string; thankYouMessage?: string })[]>(
        `/api/admin/products/${productId}/digital-accounts`
      ),
    getProductAccountCredentials: (productId: string) =>
      fetchApi<{
        email?: string;
        password?: string;
        thankYouMessage?: string;
        customerInstructions?: string;
        accountId?: string;
      }>(`/api/admin/products/${productId}/account-credentials`),
    addDigitalAccount: (
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
      }
    ) =>
      fetchApi<Omit<DigitalAccount, 'passwordEncrypted'> & { passwordMasked: string }>(
        `/api/admin/products/${productId}/digital-accounts`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      ),
    importDigitalAccountsBatch: (productId: string, batchText: string, defaultDuration: string = '30 jours') =>
      fetchApi<{
        totalGiven: number;
        addedCount: number;
        newStock: number;
        errors: { line: number; text: string; error: string }[];
      }>(`/api/admin/products/${productId}/digital-accounts/batch`, {
        method: 'POST',
        body: JSON.stringify({ batchText, defaultDuration }),
      }),
    updateDigitalAccount: (
      accountId: string,
      data: Partial<{
        email: string;
        password?: string;
        thankYouMessage?: string;
        durationText?: string;
        durationDays?: number;
        expiresAt?: string;
        customerInstructions?: string;
        adminNotes?: string;
      }>
    ) =>
      fetchApi<Omit<DigitalAccount, 'passwordEncrypted'> & { passwordMasked: string }>(
        `/api/admin/digital-accounts/${accountId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(data),
        }
      ),
    deleteDigitalAccount: (accountId: string) =>
      fetchApi<{ success: boolean; message?: string }>(`/api/admin/digital-accounts/${accountId}`, {
        method: 'DELETE',
      }),
    revealAccountPassword: (accountId: string) =>
      fetchApi<{ password: string }>(`/api/admin/digital-accounts/${accountId}/reveal`, {
        method: 'POST',
      }),

    savePlatform: (platform: Partial<PlatformOrGame>) =>
      fetchApi<PlatformOrGame>('/api/admin/platforms', {
        method: 'POST',
        body: JSON.stringify(platform),
      }),
    deletePlatform: (id: string) =>
      fetchApi<{ success: boolean }>(`/api/admin/platforms/${id}`, { method: 'DELETE' }),

    getCustomers: () =>
      fetchApi<(User & { walletBalance: number; ordersCount: number; totalSpentHTG: number })[]>('/api/admin/customers'),
    updateCustomerStatus: (id: string, status: 'active' | 'blocked') =>
      fetchApi<User>(`/api/admin/customers/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      }),
    adjustWallet: (userId: string, amountHTG: number, reason: string) =>
      fetchApi<{ success: boolean; transaction: WalletTransaction }>('/api/admin/wallets/adjust', {
        method: 'POST',
        body: JSON.stringify({ userId, amountHTG, reason }),
      }),

    getRecharges: () => fetchApi<RechargeRequest[]>('/api/admin/recharges'),
    processRecharge: (id: string, status: 'APPROVED' | 'CONFIRMED' | 'REJECTED' | 'REFUSED', adminNote?: string) =>
      fetchApi<{ success: boolean; message: string; recharge: RechargeRequest } & RechargeRequest>(`/api/admin/recharges/${id}/process`, {
        method: 'POST',
        body: JSON.stringify({ status, adminNote }),
      }),

    getOrders: () => fetchApi<Order[]>('/api/admin/orders'),
    updateOrderStatus: (id: string, status: OrderStatus | 'DELIVERED' | 'PROCESSING' | 'FAILED', note?: string) =>
      fetchApi<Order>(`/api/admin/orders/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status, note }),
      }),
    addOrderNote: (id: string, note: string) =>
      fetchApi<Order>(`/api/admin/orders/${id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ note }),
      }),
    refundOrder: (id: string, reason?: string) =>
      fetchApi<{ success: boolean; message: string; order: Order }>(`/api/admin/orders/${id}/refund`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    getTransactions: () => fetchApi<WalletTransaction[]>('/api/admin/transactions'),
    updateSettings: (settings: Partial<SiteSettings>) =>
      fetchApi<SiteSettings>('/api/admin/site-settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      }),
    updatePaymentMethod: (key: 'natcash' | 'moncash', updates: Partial<PaymentMethodConfig>) =>
      fetchApi<PaymentMethodConfig>(`/api/admin/payment-methods/${key}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    getLogs: () => fetchApi<ActivityLog[]>('/api/admin/logs'),
    testVerification: (data: {
      platformId?: string;
      playerIdentifier: string;
      region?: string;
      server?: string;
      customConfig?: any;
    }) =>
      fetchApi<{ success: boolean; result: PlayerVerificationResult }>('/api/admin/verification/test', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    resetDemoData: () => fetchApi<{ success: boolean; message: string }>('/api/admin/demo-reset', { method: 'POST' }),

    // Media Library Management
    getMedia: () =>
      fetchApi<{ media: (Media & { usageCount: number; usedInProducts: { id: string; name: string }[] })[]; total: number }>('/api/admin/media'),
    getMediaItem: (id: string) =>
      fetchApi<{ media: Media; usageCount: number; usedInProducts: { id: string; name: string }[] }>(`/api/admin/media/${id}`),
    updateMedia: (id: string, data: { altText?: string; originalFilename?: string }) =>
      fetchApi<{ success: boolean; media: Media }>(`/api/admin/media/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    deleteMedia: (id: string, force = false) =>
      fetchApi<{ success: boolean; message: string; usedInProducts?: { id: string; name: string }[] }>(
        `/api/admin/media/${id}${force ? '?force=true' : ''}`,
        { method: 'DELETE' }
      ),

    // Loyalty Management
    getLoyalty: () =>
      fetchApi<{ config: LoyaltyConfig; rewards: (LoyaltyReward & { totalSpentHTG: number })[] }>('/api/admin/loyalty'),
    updateLoyaltyConfig: (enabled: boolean) =>
      fetchApi<{ success: boolean; config: LoyaltyConfig }>('/api/admin/loyalty/config', {
        method: 'PUT',
        body: JSON.stringify({ enabled }),
      }),
    createLoyaltyTier: (tier: {
      minSpendHTG: number;
      discountPercent: number;
      validityDays: number;
      minOrderAmountHTG?: number;
      maxDiscountHTG?: number;
      maxUses?: number;
      isActive?: boolean;
    }) =>
      fetchApi<LoyaltyTier>('/api/admin/loyalty/tiers', {
        method: 'POST',
        body: JSON.stringify(tier),
      }),
    updateLoyaltyTier: (id: string, updates: Partial<LoyaltyTier>) =>
      fetchApi<LoyaltyTier>(`/api/admin/loyalty/tiers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    deleteLoyaltyTier: (id: string) =>
      fetchApi<{ success: boolean }>(`/api/admin/loyalty/tiers/${id}`, {
        method: 'DELETE',
      }),

    // Promotional Coupons Admin Management
    getPromotionalCoupons: () =>
      fetchApi<{
        coupons: PromotionalCoupon[];
        stats: {
          totalCoupons: number;
          activeCoupons: number;
          expiredCoupons: number;
          exhaustedCoupons: number;
          disabledCoupons: number;
          totalRedemptions: number;
          totalDiscountsGivenHTG: number;
        };
      }>('/api/admin/promotional-coupons'),
    getPromotionalCoupon: (id: string) =>
      fetchApi<{ coupon: PromotionalCoupon; usages: PromotionalCouponUsage[] }>(`/api/admin/promotional-coupons/${id}`),
    createPromotionalCoupon: (data: {
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
    }) =>
      fetchApi<PromotionalCoupon>('/api/admin/promotional-coupons', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updatePromotionalCoupon: (id: string, updates: Partial<PromotionalCoupon>) =>
      fetchApi<PromotionalCoupon>(`/api/admin/promotional-coupons/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    togglePromotionalCoupon: (id: string) =>
      fetchApi<PromotionalCoupon>(`/api/admin/promotional-coupons/${id}/toggle`, {
        method: 'PATCH',
      }),
    deletePromotionalCoupon: (id: string) =>
      fetchApi<{ success: boolean; message: string }>(`/api/admin/promotional-coupons/${id}`, {
        method: 'DELETE',
      }),
    getPromotionalCouponUsages: (couponId?: string) =>
      fetchApi<PromotionalCouponUsage[]>(
        couponId ? `/api/admin/promotional-coupons/${couponId}/usages` : '/api/admin/promotional-coupons-usages/all'
      ),
    processAutoRefunds24h: () =>
      fetchApi<{ success: boolean; message: string; result: { count: number; refundedOrders: string[] } }>(
        '/api/admin/orders/process-auto-refunds',
        { method: 'POST' }
      ),

    // Promotional Posters Admin Management (Entité dédiée et totalement séparée de Product)
    getPosters: () => fetchApi<PromotionalPoster[]>('/api/admin/posters'),
    getPoster: (id: string) => fetchApi<PromotionalPoster>(`/api/admin/posters/${id}`),
    createPoster: (data: Partial<PromotionalPoster>) =>
      fetchApi<PromotionalPoster>('/api/admin/posters', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updatePoster: (id: string, updates: Partial<PromotionalPoster>) =>
      fetchApi<PromotionalPoster>(`/api/admin/posters/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    publishPoster: (id: string) =>
      fetchApi<PromotionalPoster>(`/api/admin/posters/${id}/publish`, {
        method: 'PUT',
      }),
    unpublishPoster: (id: string) =>
      fetchApi<PromotionalPoster>(`/api/admin/posters/${id}/unpublish`, {
        method: 'PUT',
      }),
    activatePoster: (id: string) =>
      fetchApi<PromotionalPoster>(`/api/admin/posters/${id}/activate`, {
        method: 'PUT',
      }),
    deactivatePoster: (id: string) =>
      fetchApi<PromotionalPoster>(`/api/admin/posters/${id}/deactivate`, {
        method: 'PUT',
      }),
    reorderPosters: (orderedIds: string[]) =>
      fetchApi<PromotionalPoster[]>('/api/admin/posters/reorder', {
        method: 'PUT',
        body: JSON.stringify({ orderedIds }),
      }),
    deletePoster: (id: string) =>
      fetchApi<{ success: boolean; message: string }>(`/api/admin/posters/${id}`, {
        method: 'DELETE',
      }),

    // Aliases pour rétro-compatibilité
    getPromotionalPosters: () =>
      fetchApi<PromotionalPoster[]>('/api/admin/promotional-posters'),
    getPromotionalPoster: (id: string) =>
      fetchApi<PromotionalPoster>(`/api/admin/promotional-posters/${id}`),
    createPromotionalPoster: (data: Partial<PromotionalPoster>) =>
      fetchApi<PromotionalPoster>('/api/admin/promotional-posters', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updatePromotionalPoster: (id: string, updates: Partial<PromotionalPoster>) =>
      fetchApi<PromotionalPoster>(`/api/admin/promotional-posters/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    duplicatePromotionalPoster: (id: string) =>
      fetchApi<PromotionalPoster>(`/api/admin/promotional-posters/${id}/duplicate`, {
        method: 'POST',
      }),
    setPromotionalPosterPublication: (id: string, isPublished: boolean) =>
      fetchApi<PromotionalPoster>(`/api/admin/promotional-posters/${id}/publication`, {
        method: 'PATCH',
        body: JSON.stringify({ isPublished }),
      }),
    togglePromotionalPosterPublish: (id: string) =>
      fetchApi<PromotionalPoster>(`/api/admin/promotional-posters/${id}/toggle-publish`, {
        method: 'PATCH',
      }),
    deletePromotionalPoster: (id: string) =>
      fetchApi<{ success: boolean; message: string }>(`/api/admin/promotional-posters/${id}`, {
        method: 'DELETE',
      }),

    // Categories Admin Management
    getCategories: () => fetchApi<Category[]>('/api/admin/categories'),
    getCategory: (id: string) => fetchApi<Category>(`/api/admin/categories/${id}`),
    createCategory: (data: Partial<Category>) =>
      fetchApi<Category>('/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateCategory: (id: string, updates: Partial<Category>) =>
      fetchApi<Category>(`/api/admin/categories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }),
    reorderCategories: (orderedIds: string[]) =>
      fetchApi<Category[]>('/api/admin/categories/reorder', {
        method: 'PATCH',
        body: JSON.stringify({ orderedIds }),
      }),
    deleteCategory: (id: string) =>
      fetchApi<{ success: boolean; message: string }>(`/api/admin/categories/${id}`, {
        method: 'DELETE',
      }),
    reassignCategoryProducts: (sourceCategoryId: string, targetCategoryId: string) =>
      fetchApi<{ success: boolean; reassignedCount: number }>(`/api/admin/categories/${sourceCategoryId}/reassign`, {
        method: 'POST',
        body: JSON.stringify({ targetCategoryId }),
      }),
    getNotifications: () => fetchApi<AppNotification[]>('/api/admin/notifications'),
    sendNotification: (data: {
      target?: string;
      title: string;
      message: string;
      type?: string;
      relatedEntityId?: string;
      relatedEntityType?: 'order' | 'recharge' | 'product' | 'poster' | 'system';
      metadata?: Record<string, any>;
    }) =>
      fetchApi<{ success: boolean; notification: AppNotification }>('/api/admin/notifications/send', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    deleteNotification: (id: string) =>
      fetchApi<{ success: boolean }>(`/api/admin/notifications/${id}`, {
        method: 'DELETE',
      }),
  },
};
