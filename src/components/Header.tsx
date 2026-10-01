import React from 'react';
import { useStore } from '../context/StoreContext.js';
import { useI18n } from '../context/I18nContext.js';
import { LanguageSelector } from './LanguageSelector.js';
import { 
  Wallet as WalletIcon, 
  Bell, 
  ShieldCheck, 
  User as UserIcon,
  Plus,
  Sun,
  Moon,
  Monitor,
  MessageSquare
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext.js';

export const Header: React.FC<{ onOpenNotifications: () => void }> = ({ onOpenNotifications }) => {
  const { 
    user, 
    wallet, 
    unreadNotificationsCount, 
    siteSettings, 
    setActiveTab, 
    activeTab, 
    setIsRechargeModalOpen, 
    setIsAuthModalOpen,
  } = useStore();
  const { t } = useI18n();
  const { theme, cycleTheme } = useTheme();

  const handleWalletClick = () => {
    if (!user) {
      setIsAuthModalOpen(true);
    } else {
      setActiveTab('wallet');
    }
  };

  const handleRechargeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      setIsAuthModalOpen(true);
    } else {
      setIsRechargeModalOpen(true);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0c121e]/95 backdrop-blur-md border-b border-slate-800/80 px-2 sm:px-4 py-2 sm:py-2.5 transition-all w-full">
      <div className="max-w-5xl mx-auto">
        {/* Row 1: Brand & Primary Action Controls */}
        <div className="flex items-center justify-between gap-1 sm:gap-2 w-full">
          {/* Brand & Logo: Never shrinks out of proportion, text truncates cleanly if narrow */}
          <div 
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-1.5 sm:gap-2 cursor-pointer select-none group min-w-0 flex-shrink"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-cyan-600 via-cyan-500 to-emerald-400 p-[1.5px] shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform shrink-0">
              <div className="w-full h-full bg-[#0b0f19] rounded-[10px] flex items-center justify-center overflow-hidden">
                {siteSettings?.logoUrl ? (
                  <img src={siteSettings.logoUrl} alt="Logo" className="w-full h-full object-contain p-0.5" />
                ) : (
                  <span className="font-extrabold text-cyan-400 text-xs tracking-tighter font-mono">
                    {(siteSettings?.siteName || 'HAITEX').slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 sm:gap-1.5">
                <span className="font-black text-xs sm:text-sm tracking-wider text-white uppercase font-['Chakra_Petch'] truncate">
                  {siteSettings?.siteName || 'HAITEX STORE'}
                </span>
                <span className="hidden sm:inline-flex text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 tracking-widest uppercase shrink-0">
                  {siteSettings?.brandBadge || siteSettings?.logoText || 'HAITEX'}
                </span>
              </div>
              <p className="hidden sm:block text-[10px] text-slate-400 font-medium truncate max-w-[180px] md:max-w-[240px]">
                {siteSettings?.siteSlogan || siteSettings?.slogan || t.header.brandTag}
              </p>
            </div>
          </div>

          {/* Right Actions: Compact and guaranteed to fit on all mobile viewports without overflowing */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Wallet HTG Pill (Desktop & Tablet: hidden on small mobile, relocated to Row 2) */}
            <div 
              onClick={handleWalletClick}
              className="hidden sm:flex items-center bg-slate-900/90 border border-cyan-500/30 hover:border-cyan-400/60 rounded-xl px-2.5 py-1.5 cursor-pointer transition-all shadow-sm group shrink-0"
            >
              <div className="flex items-center gap-1.5 mr-2">
                <WalletIcon className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-bold text-slate-200 group-hover:text-white whitespace-nowrap">
                  {wallet ? `${(wallet.balanceHTG ?? 0).toLocaleString()} HTG` : '0 HTG'}
                </span>
              </div>
              <button
                onClick={handleRechargeClick}
                className="w-5 h-5 rounded-md bg-cyan-500/20 hover:bg-cyan-500 hover:text-black text-cyan-400 flex items-center justify-center transition-all cursor-pointer"
                title={t.header.rechargeTooltip}
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            {/* Support WhatsApp (Desktop & Tablet only) */}
            <a
              href={`https://wa.me/${(siteSettings?.supportPhone || '+50943854650').replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Bonjour HAITEX STORE, j\'ai besoin d\'assistance.')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold transition-all shrink-0"
              title="Assistance WhatsApp Directe"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="text-[11px] font-bold">Support</span>
            </a>

            {/* Language Selector Dropdown */}
            <div className="shrink-0">
              <LanguageSelector compact={true} />
            </div>

            {/* Admin badge button if admin logged in */}
            {user?.role === 'ADMIN' && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex items-center justify-center gap-1 h-8 sm:h-9 px-2 sm:px-2.5 rounded-xl text-xs font-semibold border transition-all shrink-0 ${
                  activeTab === 'admin'
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-lg shadow-amber-500/20'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-amber-500/40 hover:text-amber-400'
                }`}
                title={t.header.adminTooltip}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span className="hidden md:inline text-[11px]">Admin</span>
              </button>
            )}

            {/* Theme Quick Toggle (Sombre / Clair / Automatique) */}
            <button
              onClick={cycleTheme}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-cyan-400 flex items-center justify-center transition-all cursor-pointer shrink-0"
              aria-label={`Thème : ${theme === 'dark' ? 'Sombre' : theme === 'light' ? 'Clair' : 'Automatique'}`}
              title={
                theme === 'dark'
                  ? 'Thème : Sombre (Cliquer pour Clair)'
                  : theme === 'light'
                  ? 'Thème : Clair (Cliquer pour Automatique)'
                  : 'Thème : Automatique (Cliquer pour Sombre)'
              }
            >
              {theme === 'dark' ? (
                <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
              ) : theme === 'light' ? (
                <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
              ) : (
                <Monitor className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400" />
              )}
            </button>

            {/* Notifications Bell */}
            <button
              onClick={onOpenNotifications}
              className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-cyan-400 hover:border-slate-700 flex items-center justify-center transition-all cursor-pointer shrink-0"
              aria-label={t.header.notifications}
              title={t.header.notifications}
            >
              <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center animate-bounce">
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              )}
            </button>

            {/* User Account / Connexion button */}
            {!user ? (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs shadow-md shadow-cyan-500/20 flex items-center justify-center gap-1.5 transition-all active:scale-95 shrink-0 cursor-pointer"
                title={t.header.loginBtn}
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">{t.header.loginBtn}</span>
              </button>
            ) : (
              <button
                onClick={() => setActiveTab('account')}
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center border transition-all text-xs font-bold shrink-0 cursor-pointer ${
                  activeTab === 'account'
                    ? 'bg-cyan-500 text-black border-cyan-400 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-800 border-slate-700 text-cyan-400 hover:border-cyan-500/50'
                }`}
                title={user.name || user.email || 'Mon compte'}
              >
                {(user.name || user.email || 'U').charAt(0).toUpperCase()}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
