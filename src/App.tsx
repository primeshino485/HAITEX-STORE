import React, { useState, useEffect } from 'react';
import { StoreProvider, useStore } from './context/StoreContext.js';
import { I18nProvider, useI18n } from './context/I18nContext.js';
import { ThemeProvider } from './context/ThemeContext.js';
import { Header } from './components/Header.js';
import { BottomNav } from './components/BottomNav.js';
import { HomeView } from './components/HomeView.js';
import { CatalogView } from './components/CatalogView.js';
import { CartView } from './components/CartView.js';
import { WalletView } from './components/WalletView.js';
import { AccountView } from './components/AccountView.js';
import { AdminDashboard } from './components/admin/AdminDashboard.js';
import { ShieldCheck } from 'lucide-react';

import { AuthModal } from './components/AuthModal.js';
import { RechargeModal } from './components/RechargeModal.js';
import { ProductModal } from './components/ProductModal.js';
import { NotificationsDrawer } from './components/NotificationsDrawer.js';
import { ChatbotWidget } from './components/chatbot/ChatbotWidget.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';

const MainLayout: React.FC = () => {
  const { 
    activeTab, 
    setActiveTab, 
    siteSettings, 
    setIsAuthModalOpen, 
    setAuthMode,
    isAuthModalOpen,
    selectedProduct,
    setSelectedProduct,
    isRechargeModalOpen,
    setIsRechargeModalOpen
  } = useStore();
  const { t } = useI18n();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Guarantee pristine body scroll state on mount / refresh
  useEffect(() => {
    document.body.style.overflow = '';
  }, []);

  // Android Hardware / System Back Button handling
  useEffect(() => {
    const handlePopState = () => {
      if (selectedProduct) {
        setSelectedProduct(null);
        return;
      }
      if (isNotificationsOpen) {
        setIsNotificationsOpen(false);
        return;
      }
      if (isAuthModalOpen) {
        setIsAuthModalOpen(false);
        return;
      }
      if (isRechargeModalOpen) {
        setIsRechargeModalOpen(false);
        return;
      }
      if (activeTab === 'cart') {
        setActiveTab('catalog');
        return;
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [
    selectedProduct,
    setSelectedProduct,
    isNotificationsOpen,
    isAuthModalOpen,
    setIsAuthModalOpen,
    isRechargeModalOpen,
    setIsRechargeModalOpen,
    activeTab,
    setActiveTab
  ]);

  // Sync document title, favicon, and accent color from siteSettings
  useEffect(() => {
    if (siteSettings?.siteName) {
      document.title = `${siteSettings.siteName}${siteSettings.siteSlogan ? ` - ${siteSettings.siteSlogan}` : ''}`;
    }
    if (siteSettings?.faviconUrl) {
      let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = siteSettings.faviconUrl;
    }
    if (siteSettings?.accentColor) {
      document.documentElement.style.setProperty('--store-accent', siteSettings.accentColor);
    }
  }, [siteSettings]);

  // URL Route & Hash support for /admin/login, #admin, #login, #reset-password
  useEffect(() => {
    const handleRoute = () => {
      const hash = window.location.hash.toLowerCase();
      const path = window.location.pathname.toLowerCase();

      // Admin portal route detection (Dedicated non-public route)
      if (
        hash === '#admin' ||
        hash === '#/admin' ||
        hash === '#admin/login' ||
        hash === '#/admin/login' ||
        hash === '#admin/connexion' ||
        hash === '#/admin/connexion' ||
        path === '/admin' ||
        path === '/admin/' ||
        path === '/admin/login' ||
        path === '/admin/login/' ||
        path === '/admin/connexion' ||
        path === '/admin/connexion/' ||
        path.startsWith('/admin')
      ) {
        setActiveTab('admin');
        return;
      }

      // Password Reset route detection
      if (hash.includes('reset-password') || path.includes('reset-password')) {
        setIsAuthModalOpen(true);
        return;
      }

      // Public Customer Login/Register route detection
      if (
        hash === '#login' ||
        hash === '#/login' ||
        hash === '#connexion' ||
        hash === '#/connexion' ||
        path === '/login' ||
        path === '/connexion'
      ) {
        setAuthMode('login');
        setIsAuthModalOpen(true);
      } else if (hash === '#register' || hash === '#/register' || path === '/register') {
        setAuthMode('register');
        setIsAuthModalOpen(true);
      }
    };
    handleRoute();
    window.addEventListener('hashchange', handleRoute);
    window.addEventListener('popstate', handleRoute);
    return () => {
      window.removeEventListener('hashchange', handleRoute);
      window.removeEventListener('popstate', handleRoute);
    };
  }, [setActiveTab, setIsAuthModalOpen, setAuthMode]);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#070b13] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black overflow-x-hidden">
      {/* Announcement top bar if active */}
      {siteSettings?.announcementMessage && (
        <div className="bg-gradient-to-r from-cyan-950 via-slate-900 to-cyan-950 border-b border-cyan-500/20 py-1.5 px-3 text-center">
          <p className="text-[11px] font-medium text-cyan-300 tracking-wide truncate max-w-2xl mx-auto">
            ⚡ {siteSettings.announcementMessage}
          </p>
        </div>
      )}

      {/* Main Header */}
      <Header onOpenNotifications={() => setIsNotificationsOpen(true)} />

      {/* Main View Container (Optimized for Android smartphones and tablets) */}
      <main className="flex-1 max-w-xl md:max-w-2xl w-full mx-auto px-3 sm:px-4 pt-3 sm:pt-4">
        <ErrorBoundary>
          {activeTab === 'home' && <HomeView />}
          {activeTab === 'catalog' && <CatalogView />}
          {activeTab === 'cart' && <CartView />}
          {activeTab === 'wallet' && <WalletView />}
          {activeTab === 'account' && <AccountView />}
          {activeTab === 'admin' && <AdminDashboard />}
        </ErrorBoundary>
      </main>

      {/* Public Footer */}
      {activeTab !== 'admin' && (
        <footer className="pb-24 pt-6 text-center text-slate-500 text-[11px] border-t border-slate-900/80 px-4 mt-6">
          <p>© {new Date().getFullYear()} {siteSettings?.siteName || 'MY STORE'} • Port-au-Prince, Haïti</p>
          <p className="mt-1 text-[10px] text-slate-600">Boutik dijital sekirize pou livrezon rapid pwodwi dijital.</p>
        </footer>
      )}

      {/* Global Modals & Drawers */}
      <ErrorBoundary>
        <AuthModal />
        <RechargeModal />
        <ProductModal />
        <NotificationsDrawer
          isOpen={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
        />
      </ErrorBoundary>

      {/* Floating AI Assistant Chatbot for Customer Pages */}
      {activeTab !== 'admin' && <ChatbotWidget />}

      {/* Fixed Bottom Navigation (Android Native Feel) */}
      <BottomNav />
    </div>
  );
};

export default function App() {
  return (
    <StoreProvider>
      <I18nProvider>
        <ThemeProvider>
          <MainLayout />
        </ThemeProvider>
      </I18nProvider>
    </StoreProvider>
  );
}
