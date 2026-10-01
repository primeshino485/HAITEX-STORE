import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext.js';
import { useI18n } from '../../context/I18nContext.js';
import { api } from '../../lib/api.js';
import { 
  LayoutDashboard, 
  Package, 
  Gamepad2, 
  Tv, 
  Cpu, 
  Layers, 
  ShoppingBag, 
  Users, 
  Wallet, 
  Smartphone, 
  CreditCard, 
  Image as ImageIcon, 
  Star, 
  Bell, 
  Settings, 
  FileText, 
  LogOut, 
  Menu, 
  X,
  ChevronRight,
  ShieldCheck,
  ArrowLeft,
  Loader2,
  Gift,
  Tag,
  Megaphone
} from 'lucide-react';

import { AdminLoginView } from './AdminLoginView.js';
import { AdminOverview } from './views/AdminOverview.js';
import { AdminProducts } from './views/AdminProducts.js';
import { AdminPlatforms } from './views/AdminPlatforms.js';
import { AdminOrders } from './views/AdminOrders.js';
import { AdminCustomers } from './views/AdminCustomers.js';
import { AdminRecharges } from './views/AdminRecharges.js';
import { AdminPaymentMethods } from './views/AdminPaymentMethods.js';
import { AdminMediaUpload } from './views/AdminMediaUpload.js';
import { AdminTransactions } from './views/AdminTransactions.js';
import { AdminSettingsAndLogs } from './views/AdminSettingsAndLogs.js';
import { AdminLoyalty } from './views/AdminLoyalty.js';
import { AdminPromotionalCoupons } from './views/AdminPromotionalCoupons.js';
import { AdminPosters } from './views/AdminPosters.js';
import { AdminCategories } from './views/AdminCategories.js';
import { AdminNotifications } from './views/AdminNotifications.js';

export const AdminDashboard: React.FC = () => {
  const { setActiveTab, categories, platforms } = useStore();
  const { t } = useI18n();
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean | null>(null);
  const [currentSection, setCurrentSection] = useState<string>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [adminUnreadCount, setAdminUnreadCount] = useState<number>(0);

  // Poll admin notifications for real unread count
  useEffect(() => {
    if (!isAdminAuthenticated) return;
    let isMounted = true;

    const fetchUnread = async () => {
      try {
        const notifs = await api.admin.getNotifications();
        if (isMounted && Array.isArray(notifs)) {
          const unread = notifs.filter(n => !n.isRead && !n.read).length;
          setAdminUnreadCount(unread);
        }
      } catch (err) {
        // Silent fail on polling error
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 15000); // Poll every 15s
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isAdminAuthenticated]);

  // Server-side check of the HTTP-only admin session
  useEffect(() => {
    let isMounted = true;
    const verifyAdmin = async () => {
      try {
        const res = await api.adminAuth.check();
        if (isMounted) {
          setIsAdminAuthenticated(res.authenticated);
        }
      } catch (err: any) {
        if (isMounted) {
          const hasAdminToken = !!(
            localStorage.getItem('mystore_admin_token') ||
            sessionStorage.getItem('mystore_admin_token')
          );
          // Only de-authenticate if the server explicitly rejected the credentials (401 or 403)
          if (err?.status === 401 || err?.status === 403 || !hasAdminToken) {
            setIsAdminAuthenticated(false);
          } else {
            // Mobile network glitch/timeout: maintain admin session rather than booting admin out
            console.warn('Network issue during admin session check, retaining authenticated state:', err?.message || err);
            setIsAdminAuthenticated(true);
          }
        }
      }
    };
    verifyAdmin();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleAdminLogout = async () => {
    try {
      await api.adminAuth.logout();
    } catch (err) {
      console.error('Error logging out admin:', err);
    }
    localStorage.removeItem('mystore_admin_token');
    sessionStorage.removeItem('mystore_admin_token');
    setIsAdminAuthenticated(false);
    try {
      window.history.pushState(null, '', '/admin/connexion');
    } catch {
      window.location.hash = 'admin/connexion';
    }
  };

  // 1. Loading verification state
  if (isAdminAuthenticated === null) {
    return (
      <div className="py-24 text-center max-w-sm mx-auto p-6">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto mb-3" />
        <p className="text-xs text-slate-400 font-medium font-mono">
          {t.admin.verifyingSession}
        </p>
      </div>
    );
  }

  // 2. Not authenticated: show dedicated Admin Login Screen
  if (!isAdminAuthenticated) {
    return (
      <AdminLoginView
        onSuccess={() => setIsAdminAuthenticated(true)}
        onBackToStore={() => setActiveTab('home')}
      />
    );
  }

  const menuItems = [
    { id: 'overview', label: t.admin.menuDashboard, icon: LayoutDashboard },
    { id: 'notifications', label: adminUnreadCount > 0 ? `Notifications (${adminUnreadCount})` : 'Notifications', icon: Bell },
    { id: 'categories', label: 'Catalogue → Catégories', icon: Layers },
    { id: 'products', label: t.admin.menuProducts, icon: Package },
    { id: 'gaming', label: t.admin.menuGaming, icon: Gamepad2 },
    { id: 'streaming', label: t.admin.menuStreaming, icon: Tv },
    { id: 'panels', label: t.admin.menuPanels, icon: Cpu },
    { id: 'orders', label: t.admin.menuOrders, icon: ShoppingBag },
    { id: 'customers', label: t.admin.menuCustomers, icon: Users },
    { id: 'wallets', label: t.admin.menuWallets, icon: Wallet },
    { id: 'recharges', label: t.admin.menuRecharges, icon: Smartphone },
    { id: 'transactions', label: t.admin.menuTransactions, icon: CreditCard },
    { id: 'payment-methods', label: t.admin.menuPaymentMethods, icon: CreditCard },
    { id: 'posters', label: 'Marketing → Affiches promo', icon: Megaphone },
    { id: 'promotions', label: 'Coupons Promo Admin', icon: Tag },
    { id: 'loyalty', label: t.admin.menuLoyalty || 'Fidélité & Réductions', icon: Gift },
    { id: 'media', label: t.admin.menuMedia, icon: ImageIcon },
    { id: 'featured', label: t.admin.menuFeatured, icon: Star },
    { id: 'settings', label: t.admin.menuSettings, icon: Settings },
    { id: 'logs', label: t.admin.menuLogs, icon: FileText },
  ];

  const handleSelectSection = (id: string) => {
    setCurrentSection(id);
    setIsSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="pb-24 animate-in fade-in duration-200">
      {/* Admin Top Banner / Controls */}
      <div className="p-3.5 rounded-2xl bg-slate-900 border border-amber-500/40 mb-4 flex items-center justify-between shadow-lg shadow-amber-500/5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('home')}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title={t.admin.backToStore}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <h1 className="text-xs sm:text-sm font-black text-amber-300 uppercase tracking-wider font-['Chakra_Petch']">
              {t.admin.adminMaster}
            </h1>
          </div>
        </div>

        {/* Right actions: Menu button & direct Logout */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSelectSection('notifications')}
            className={`relative p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
              currentSection === 'notifications'
                ? 'bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/20'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 border-slate-700'
            }`}
            title={`Notifications (${adminUnreadCount} non lues)`}
          >
            <Bell className="w-4 h-4" />
            {adminUnreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-amber-400 text-black font-black text-[9px] rounded-full flex items-center justify-center animate-pulse">
                {adminUnreadCount > 9 ? '9+' : adminUnreadCount}
              </span>
            )}
          </button>

          <button
            onClick={handleAdminLogout}
            className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold transition-all cursor-pointer"
            title={t.admin.closeSession}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t.admin.logoutBtn}</span>
          </button>

          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500 hover:text-black border border-amber-500/40 text-amber-300 text-xs font-bold transition-all cursor-pointer"
          >
            <Menu className="w-4 h-4" />
            <span>{t.admin.menu} ({menuItems.length})</span>
          </button>
        </div>
      </div>

      {/* Mobile Drawer / Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div 
            className="w-4/5 max-w-xs bg-[#0b101c] border-r border-slate-800 h-full flex flex-col p-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <span className="text-xs font-bold text-white uppercase font-['Chakra_Petch']">
                  {t.admin.navAdmin}
                </span>
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 pr-1 text-xs">
              {menuItems.map(item => {
                const Icon = item.icon;
                const isActive = currentSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectSection(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                      isActive
                        ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300 font-bold'
                        : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-500'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {isActive && <ChevronRight className="w-3.5 h-3.5 text-amber-400" />}
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-800">
              <button
                onClick={handleAdminLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>{t.admin.logoutBtn}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area based on currentSection */}
      <div className="transition-all">
        {currentSection === 'overview' && (
          <AdminOverview onNavigate={handleSelectSection} />
        )}

        {currentSection === 'notifications' && (
          <AdminNotifications onNavigateSection={handleSelectSection} />
        )}

        {currentSection === 'categories' && (
          <AdminCategories />
        )}

        {currentSection === 'products' && (
          <AdminProducts categories={categories} platforms={platforms} />
        )}

        {currentSection === 'gaming' && (
          <AdminPlatforms categories={categories} initialCategorySlug="gaming" />
        )}

        {currentSection === 'streaming' && (
          <AdminPlatforms categories={categories} initialCategorySlug="streaming" />
        )}

        {currentSection === 'panels' && (
          <AdminPlatforms categories={categories} initialCategorySlug="panels" />
        )}

        {currentSection === 'orders' && (
          <AdminOrders />
        )}

        {(currentSection === 'customers' || currentSection === 'wallets') && (
          <AdminCustomers />
        )}

        {currentSection === 'recharges' && (
          <AdminRecharges />
        )}

        {currentSection === 'transactions' && (
          <AdminTransactions />
        )}

        {currentSection === 'payment-methods' && (
          <AdminPaymentMethods />
        )}

        {currentSection === 'posters' && (
          <AdminPosters />
        )}

        {currentSection === 'promotions' && (
          <AdminPromotionalCoupons />
        )}

        {currentSection === 'loyalty' && (
          <AdminLoyalty />
        )}

        {currentSection === 'media' && (
          <AdminMediaUpload />
        )}

        {currentSection === 'featured' && (
          <AdminProducts 
            categories={categories} 
            platforms={platforms} 
          />
        )}

        {(currentSection === 'settings' || currentSection === 'logs') && (
          <AdminSettingsAndLogs />
        )}
      </div>
    </div>
  );
};
