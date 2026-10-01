import React from 'react';
import { useStore } from '../context/StoreContext.js';
import { useI18n } from '../context/I18nContext.js';
import { 
  Home, 
  LayoutGrid, 
  ShoppingBag, 
  Wallet, 
  Sparkles
} from 'lucide-react';

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab, cartCount } = useStore();
  const { t } = useI18n();

  const handleNav = (tab: any) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0c121e]/95 backdrop-blur-xl border-t border-slate-800/80 px-2 py-1.5 transition-all">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {/* 1. Accueil / Akey */}
        <button
          onClick={() => handleNav('home')}
          className={`flex flex-col items-center justify-center w-14 py-1 rounded-xl transition-all ${
            activeTab === 'home'
              ? 'text-cyan-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <Home className="w-5 h-5" />
            {activeTab === 'home' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight truncate max-w-[54px]">{t.nav.home}</span>
        </button>

        {/* 2. Catalogue / Magazen */}
        <button
          onClick={() => handleNav('catalog')}
          className={`flex flex-col items-center justify-center w-14 py-1 rounded-xl transition-all ${
            activeTab === 'catalog'
              ? 'text-cyan-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <LayoutGrid className="w-5 h-5" />
            {activeTab === 'catalog' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight truncate max-w-[54px]">{t.nav.catalog}</span>
        </button>

        {/* 3. Panier / Panyen */}
        <button
          onClick={() => handleNav('cart')}
          className={`flex flex-col items-center justify-center w-14 py-1 rounded-xl transition-all ${
            activeTab === 'cart'
              ? 'text-cyan-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-2 px-1.5 py-0.2 min-w-[16px] h-4 rounded-full bg-cyan-500 text-black text-[10px] font-black flex items-center justify-center shadow-lg shadow-cyan-500/50">
                {cartCount}
              </span>
            )}
            {activeTab === 'cart' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight truncate max-w-[54px]">{t.nav.cart}</span>
        </button>

        {/* 4. Portefeuille / Bonbo */}
        <button
          onClick={() => handleNav('wallet')}
          className={`flex flex-col items-center justify-center w-14 py-1 rounded-xl transition-all ${
            activeTab === 'wallet'
              ? 'text-cyan-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <Wallet className="w-5 h-5" />
            {activeTab === 'wallet' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight truncate max-w-[54px]">{t.nav.wallet}</span>
        </button>

        {/* 5. Mes Produits / Acha Mwen */}
        <button
          onClick={() => handleNav('account')}
          className={`flex flex-col items-center justify-center w-14 py-1 rounded-xl transition-all ${
            activeTab === 'account'
              ? 'text-cyan-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <Sparkles className="w-5 h-5" />
            {activeTab === 'account' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight truncate max-w-[54px]">{t.nav.account}</span>
        </button>
      </div>
    </nav>
  );
};
