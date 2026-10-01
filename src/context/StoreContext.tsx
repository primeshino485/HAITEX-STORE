import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  User,
  Wallet,
  CartItem,
  Product,
  Category,
  PlatformOrGame,
  SiteSettings,
  AppNotification,
} from '../types.js';
import { api } from '../lib/api.js';

interface StoreContextType {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  wallet: Wallet | null;
  token: string | null;
  cart: CartItem[];
  cartCount: number;
  cartTotalHTG: number;
  notifications: AppNotification[];
  unreadNotificationsCount: number;
  siteSettings: SiteSettings | null;
  setSiteSettings: (settings: SiteSettings) => void;
  categories: Category[];
  platforms: PlatformOrGame[];
  products: Product[];
  
  // Navigation & Modals
  activeTab: 'home' | 'catalog' | 'cart' | 'wallet' | 'account' | 'admin';
  setActiveTab: (tab: 'home' | 'catalog' | 'cart' | 'wallet' | 'account' | 'admin') => void;
  accountSubTab: 'library' | 'orders' | 'rewards' | 'settings' | 'notifications';
  setAccountSubTab: (subTab: 'library' | 'orders' | 'rewards' | 'settings' | 'notifications') => void;
  appliedCouponCode: string | null;
  setAppliedCouponCode: (code: string | null) => void;
  selectedCategorySlug: string | null;
  setSelectedCategorySlug: (slug: string | null) => void;
  selectedPlatform: PlatformOrGame | null;
  setSelectedPlatform: (p: PlatformOrGame | null) => void;
  selectedProduct: Product | null;
  setSelectedProduct: (p: Product | null) => void;
  isRechargeModalOpen: boolean;
  setIsRechargeModalOpen: (open: boolean) => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  authMode: 'login' | 'register';
  setAuthMode: (mode: 'login' | 'register') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Cart operations
  addToCart: (
    product: Product,
    quantity?: number,
    playerIdentifier?: string,
    verificationToken?: string,
    verifiedInfo?: any,
    customerWhatsApp?: string,
    accountEmail?: string,
    accountName?: string,
    customRequirement?: string
  ) => void;
  updateCartItemVerification: (
    productId: string,
    playerIdentifier: string,
    verificationToken: string,
    verifiedInfo: any
  ) => void;
  updateCartItemDetails: (productId: string, details: Partial<CartItem>) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  refreshCart: () => Promise<void>;

  // Actions
  login: (email: string, pass: string) => Promise<void>;
  register: (name: string, email: string, pass: string) => Promise<void>;
  setUserAndToken: (newUser: User, newToken: string) => Promise<void>;
  logout: () => void;
  refreshUserAndWallet: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  refreshCatalog: () => Promise<void>;
}

const StoreContext = createContext<StoreContextType | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('mystore_token'));
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [platforms, setPlatforms] = useState<PlatformOrGame[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Navigation
  const [activeTab, setActiveTab] = useState<'home' | 'catalog' | 'cart' | 'wallet' | 'account' | 'admin'>('home');
  const [accountSubTab, setAccountSubTab] = useState<'library' | 'orders' | 'rewards' | 'settings' | 'notifications'>('library');
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(null);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformOrGame | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [searchQuery, setSearchQuery] = useState('');

  // Cart stored in localStorage & synchronized with server for authenticated users
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('mystore_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const refreshCart = useCallback(async () => {
    const currentToken = localStorage.getItem('mystore_token');
    if (!currentToken) return;
    try {
      const res = await api.cart.get();
      if (res.success && Array.isArray(res.items)) {
        setCart(res.items);
        localStorage.setItem('mystore_cart', JSON.stringify(res.items));
      }
    } catch (err) {
      console.warn('Failed to load server cart:', err);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('mystore_cart', JSON.stringify(cart));
    } catch (e) {
      console.warn('LocalStorage quota or access issue for cart:', e);
    }
    const currentToken = localStorage.getItem('mystore_token');
    if (currentToken && cart) {
      // Debounced background sync to avoid network flooding on rapid quantity clicks
      const syncTimer = setTimeout(() => {
        api.cart.sync(cart).catch(err => console.warn('Background cart sync error:', err?.message || err));
      }, 500);
      return () => clearTimeout(syncTimer);
    }
  }, [cart]);

  const refreshUserAndWallet = useCallback(async () => {
    const currentToken = localStorage.getItem('mystore_token');
    if (!currentToken) {
      setUser(null);
      setWallet(null);
      return;
    }
    try {
      const res = await api.getMe();
      setUser(res.user);
      setWallet(res.wallet);
      await refreshCart();
    } catch (err: any) {
      // ONLY clear session if server explicitly returned 401 or 403 (expired/invalid credentials)
      // Never wipe user session on temporary connection errors, timeouts, or 500s!
      if (err?.status === 401 || err?.status === 403) {
        console.warn('Session expired or invalid credentials (401/403): clearing session');
        localStorage.removeItem('mystore_token');
        setToken(null);
        setUser(null);
        setWallet(null);
      } else {
        console.warn('Temporary network/server issue during profile sync, retaining local session state:', err?.message || err);
      }
    }
  }, [refreshCart]);

  const refreshNotifications = useCallback(async () => {
    try {
      const notifs = await api.getNotifications();
      setNotifications(notifs);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, []);

  const setSafeSelectedProduct = useCallback((p: Product | null) => {
    if (p && (p.id?.startsWith('poster-') || typeof p.priceHTG !== 'number' || (p as any).templateType !== undefined)) {
      console.warn('Rejected setting promotional poster or non-product as selected product:', p);
      return;
    }
    setSelectedProduct(p);
  }, []);

  const refreshCatalog = useCallback(async () => {
    try {
      const [settingsData, catsData, platsData, prodsData] = await Promise.all([
        api.getSettings(),
        api.getCategories(),
        api.getPlatforms(),
        api.getProducts().catch(() => []),
      ]);
      setSiteSettings(settingsData);
      setCategories(catsData);
      setPlatforms(platsData);
      if (Array.isArray(prodsData)) {
        const genuineProducts = prodsData.filter(
          p => p && p.id && !p.id.startsWith('poster-') && typeof p.priceHTG === 'number'
        );
        setProducts(genuineProducts);
      }
    } catch (err) {
      console.error('Failed to load initial catalog data:', err);
    }
  }, []);

  useEffect(() => {
    refreshCatalog();
    if (token) {
      refreshUserAndWallet();
      refreshNotifications();
    }
  }, [token, refreshCatalog, refreshUserAndWallet, refreshNotifications]);

  // Cart operations
  const addToCart = useCallback((
    product: Product,
    quantity = 1,
    playerIdentifier?: string,
    verificationToken?: string,
    verifiedInfo?: any,
    customerWhatsApp?: string,
    accountEmail?: string,
    accountName?: string,
    customRequirement?: string
  ) => {
    // Strict guard: Never add an affiche to cart
    if (!product || !product.id || product.id.startsWith('poster-') || typeof product.priceHTG !== 'number') {
      console.warn('Cannot add non-product or promotional poster to cart:', product);
      return;
    }

    setCart(prev => {
      const existingIdx = prev.findIndex(item => item.product.id === product.id);
      if (existingIdx > -1) {
        const next = [...prev];
        const newQty = next[existingIdx].quantity + quantity;
        next[existingIdx] = {
          ...next[existingIdx],
          quantity: Math.min(newQty, product.stock),
          playerIdentifier: playerIdentifier || next[existingIdx].playerIdentifier,
          verificationToken: verificationToken || next[existingIdx].verificationToken,
          playerConfirmed: verificationToken ? true : next[existingIdx].playerConfirmed,
          verifiedInfo: verifiedInfo || next[existingIdx].verifiedInfo,
          customerWhatsApp: customerWhatsApp || next[existingIdx].customerWhatsApp,
          accountEmail: accountEmail || next[existingIdx].accountEmail,
          accountName: accountName || next[existingIdx].accountName,
          customRequirement: customRequirement || next[existingIdx].customRequirement,
        };
        return next;
      } else {
        return [
          ...prev,
          {
            product,
            quantity: Math.min(quantity, product.stock),
            playerIdentifier,
            verificationToken,
            playerConfirmed: !!verificationToken,
            verifiedInfo,
            customerWhatsApp,
            accountEmail,
            accountName,
            customRequirement,
          },
        ];
      }
    });
  }, []);

  const updateCartItemVerification = useCallback((
    productId: string,
    playerIdentifier: string,
    verificationToken: string,
    verifiedInfo: any
  ) => {
    setCart(prev =>
      prev.map(item => {
        if (item.product.id === productId) {
          return {
            ...item,
            playerIdentifier,
            verificationToken,
            playerConfirmed: true,
            verifiedInfo,
          };
        }
        return item;
      })
    );
  }, []);

  const updateCartItemDetails = useCallback((
    productId: string,
    details: Partial<CartItem>
  ) => {
    setCart(prev =>
      prev.map(item => {
        if (item.product.id === productId) {
          return {
            ...item,
            ...details,
          };
        }
        return item;
      })
    );
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  }, []);

  const updateCartQuantity = useCallback((productId: string, quantity: number) => {
    setCart(prev => {
      if (quantity <= 0) {
        return prev.filter(item => item.product.id !== productId);
      }
      return prev.map(item => {
        if (item.product.id === productId) {
          return { ...item, quantity: Math.min(quantity, item.product.stock) };
        }
        return item;
      });
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  // Auth actions
  const login = async (email: string, pass: string) => {
    const res = await api.login({ email, password: pass });
    localStorage.setItem('mystore_token', res.token);
    setToken(res.token);
    setUser(res.user);
    await refreshUserAndWallet();
    await refreshNotifications();
    setIsAuthModalOpen(false);
  };

  const register = async (name: string, email: string, pass: string) => {
    await api.register({ name, email, password: pass, termsAccepted: true });
  };

  const setUserAndToken = async (newUser: User, newToken: string) => {
    localStorage.setItem('mystore_token', newToken);
    setToken(newToken);
    setUser(newUser);
    await refreshUserAndWallet();
    await refreshNotifications();
    setIsAuthModalOpen(false);
  };

  const logout = () => {
    localStorage.removeItem('mystore_token');
    setToken(null);
    setUser(null);
    setWallet(null);
    if (activeTab === 'admin') {
      setActiveTab('home');
    }
  };

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const cartTotalHTG = cart.reduce((acc, item) => acc + (item.product.priceHTG * item.quantity), 0);
  const unreadNotificationsCount = notifications.filter(n => !n.isRead && !n.read).length;

  return (
    <StoreContext.Provider
      value={{
        user,
        setUser,
        wallet,
        token,
        cart,
        cartCount,
        cartTotalHTG,
        notifications,
        unreadNotificationsCount,
        siteSettings,
        setSiteSettings,
        categories,
        platforms,
        products,
        activeTab,
        setActiveTab,
        accountSubTab,
        setAccountSubTab,
        appliedCouponCode,
        setAppliedCouponCode,
        selectedCategorySlug,
        setSelectedCategorySlug,
        selectedPlatform,
        setSelectedPlatform,
        selectedProduct,
        setSelectedProduct: setSafeSelectedProduct,
        isRechargeModalOpen,
        setIsRechargeModalOpen,
        isAuthModalOpen,
        setIsAuthModalOpen,
        authMode,
        setAuthMode,
        searchQuery,
        setSearchQuery,
        addToCart,
        updateCartItemVerification,
        updateCartItemDetails,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        refreshCart,
        login,
        register,
        setUserAndToken,
        logout,
        refreshUserAndWallet,
        refreshNotifications,
        refreshCatalog,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStore must be used within StoreProvider');
  }
  return ctx;
};
