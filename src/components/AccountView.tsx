import React, { useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext.js';
import { useI18n } from '../context/I18nContext.js';
import { api } from '../lib/api.js';
import { CustomerLibraryItem, Order, CustomerLoyaltyStatus, AppNotification } from '../types.js';
import { 
  User as UserIcon, 
  Sparkles, 
  ShoppingBag, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  LogOut, 
  ShieldAlert, 
  ShieldCheck,
  CheckCircle2, 
  Key,
  Lock,
  Gift,
  Percent,
  Clock,
  ArrowRight,
  TrendingUp,
  Settings,
  Loader2,
  Download,
  Bell,
  Trash2,
  CheckCheck,
  Smartphone,
  Package,
  Megaphone,
  Info,
  ExternalLink,
  X,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { SettingsView } from './SettingsView.js';

export const AccountView: React.FC = () => {
  const { user, logout, setActiveTab, setIsAuthModalOpen, accountSubTab, setAccountSubTab, setAppliedCouponCode, notifications, unreadNotificationsCount, refreshNotifications } = useStore();
  const { t, language } = useI18n();
  const [library, setLibrary] = useState<CustomerLibraryItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loyalty, setLoyalty] = useState<CustomerLoyaltyStatus | null>(null);
  const activeSubTab = accountSubTab;
  const setActiveSubTab = setAccountSubTab;
  const [revealedCodes, setRevealedCodes] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread' | 'order' | 'recharge' | 'delivery' | 'promotion'>('all');
  const [selectedNotif, setSelectedNotif] = useState<AppNotification | null>(null);

  const fetchUserData = async (isManual = false) => {
    if (!user) return;
    setLoading(true);
    if (isManual) {
      setFetchError(null);
    }
    try {
      const [libResult, ordersResult, loyaltyResult] = await Promise.allSettled([
        api.getLibrary(),
        api.getOrders(),
        api.getLoyaltyStatus(),
      ]);

      let hadSuccess = false;

      if (libResult.status === 'fulfilled') {
        setLibrary(libResult.value || []);
        hadSuccess = true;
      }
      if (ordersResult.status === 'fulfilled') {
        setOrders(ordersResult.value || []);
        hadSuccess = true;
      }
      if (loyaltyResult.status === 'fulfilled') {
        setLoyalty(loyaltyResult.value || null);
      }

      if (hadSuccess) {
        setFetchError(null);
      } else {
        const firstFailure = libResult.status === 'rejected' ? libResult.reason : (ordersResult.status === 'rejected' ? ordersResult.reason : null);
        const errMsg = firstFailure?.message || 'Erè pandan chajman done kont ou an.';
        setFetchError(errMsg);
      }
    } catch (err: any) {
      setFetchError(err?.message || 'Erè rezo oswa koneksyon.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [user]);

  const dateLocale = language === 'en' ? 'en-US' : language === 'ht' ? 'fr-HT' : 'fr-FR';

  if (!user) {
    return (
      <div className="py-20 text-center max-w-sm mx-auto px-4">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto mb-4">
          <UserIcon className="w-8 h-8" />
        </div>
        <h2 className="text-base font-black text-white font-['Chakra_Petch'] uppercase">
          {t.account.title}
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          {t.account.subtitle}
        </p>
        <button
          onClick={() => setIsAuthModalOpen(true)}
          className="mt-5 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
        >
          {t.auth.loginTitle}
        </button>
      </div>
    );
  }

  const toggleReveal = (id: string) => {
    setRevealedCodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleMarkNotifAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.markNotificationRead(id);
      await refreshNotifications();
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllNotifsAsRead = async () => {
    try {
      await api.markAllNotificationsRead();
      await refreshNotifications();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleDeleteNotif = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.deleteNotification(id);
      await refreshNotifications();
      if (selectedNotif?.id === id) {
        setSelectedNotif(null);
      }
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const getNotifIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'order':
        return <ShoppingBag className="w-4 h-4 text-cyan-400" />;
      case 'recharge':
        return <Smartphone className="w-4 h-4 text-emerald-400" />;
      case 'delivery':
        return <Package className="w-4 h-4 text-purple-400" />;
      case 'promotion':
        return <Megaphone className="w-4 h-4 text-pink-400" />;
      default:
        return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="pb-24 space-y-4 animate-in fade-in duration-200">
      {/* Profile Header */}
      <div className="p-4 rounded-2xl bg-[#0e1422] border border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-black flex items-center justify-center font-black text-lg shadow-md shadow-cyan-500/20">
            {(user.name || user.email || 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white font-['Chakra_Petch']">
                {user.name}
              </h1>
              {user.role === 'ADMIN' && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase">
                  Admin
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">{user.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {user.role === 'ADMIN' && (
            <button
              onClick={() => setActiveTab('admin')}
              className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          )}
          <button
            onClick={() => setShowLogoutModal(true)}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-red-400 hover:border-red-500/40 transition-colors cursor-pointer"
            title={t.account.logout}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs: Mes Produits / Mes Commandes / Notifikasyon / Mes Récompenses / Paramètres */}
      <div className="grid grid-cols-2 sm:grid-cols-5 bg-slate-900/90 p-1 rounded-xl border border-slate-800 gap-1">
        <button
          onClick={() => setActiveSubTab('library')}
          className={`py-2 px-1 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeSubTab === 'library'
              ? 'bg-cyan-500 text-black shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="truncate">{t.account.myProducts} ({library.length})</span>
        </button>
        <button
          onClick={() => setActiveSubTab('orders')}
          className={`py-2 px-1 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeSubTab === 'orders'
              ? 'bg-cyan-500 text-black shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span className="truncate">{t.account.orderHistory} ({orders.length})</span>
        </button>
        <button
          onClick={() => setActiveSubTab('notifications')}
          className={`py-2 px-1 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer relative ${
            activeSubTab === 'notifications'
              ? 'bg-cyan-500 text-black shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span className="truncate">
            {language === 'ht' ? 'Notifikasyon' : 'Notifications'}
            {unreadNotificationsCount > 0 && ` (${unreadNotificationsCount})`}
          </span>
          {unreadNotificationsCount > 0 && activeSubTab !== 'notifications' && (
            <span className="w-2 h-2 rounded-full bg-cyan-400 absolute top-1 right-1 animate-pulse" />
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('rewards')}
          className={`py-2 px-1 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeSubTab === 'rewards'
              ? 'bg-cyan-500 text-black shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Gift className="w-3.5 h-3.5" />
          <span className="truncate">{t.account.rewardsTab} ({loyalty?.rewards?.filter(r => r.status === 'AVAILABLE').length || 0})</span>
        </button>
        <button
          onClick={() => setActiveSubTab('settings')}
          className={`py-2 px-1 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer col-span-2 sm:col-span-1 ${
            activeSubTab === 'settings'
              ? 'bg-cyan-500 text-black shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span className="truncate">{language === 'ht' ? 'Paramèt' : language === 'en' ? 'Settings' : 'Paramètres'}</span>
        </button>
      </div>

      {/* Fetch Error Banner with Manual Retry */}
      {fetchError && (
        <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="truncate text-xs font-medium">{fetchError}</span>
          </div>
          <button
            onClick={() => fetchUserData(true)}
            disabled={loading}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer flex-shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{language === 'ht' ? 'Rechaje' : language === 'en' ? 'Retry' : 'Actualiser'}</span>
          </button>
        </div>
      )}

      {/* Content: Digital Library ("MES PRODUITS") */}
      {activeSubTab === 'library' && (
        <div className="space-y-3">
          {library.length === 0 ? (
            <div className="p-10 text-center rounded-2xl bg-slate-900/40 border border-slate-800">
              <Key className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400 font-medium">{t.account.noProducts}</p>
              <button
                onClick={() => setActiveTab('catalog')}
                className="mt-3 px-4 py-2 rounded-xl bg-cyan-500 text-black font-bold text-xs cursor-pointer"
              >
                {t.cart.browseCatalog}
              </button>
            </div>
          ) : (
            library.map(item => {
              const isRevealed = !!revealedCodes[item.id];
              const downloadLink = item.downloadUrl || item.deliveredDownloadUrl;
              return (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-[#0e1422] border border-cyan-500/30 shadow-lg space-y-3 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {item.productImage && (
                        <img
                          src={item.productImage}
                          alt={item.productName}
                          className="w-12 h-12 rounded-xl object-cover border border-cyan-500/30 flex-shrink-0"
                        />
                      )}
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                            {item.deliveryType === 'DOWNLOAD_LINK' ? 'Téléchargement' : item.productType}
                          </span>
                          {downloadLink && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Disponible
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-black text-white font-['Chakra_Petch'] mt-1">
                          {item.productName}
                        </h3>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {t.account.order} : #{item.orderId.slice(0, 8)} • {new Date(item.purchasedAt).toLocaleDateString(dateLocale)}
                        </p>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1 flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3" />
                      {t.account.delivered}
                    </span>
                  </div>

                  {/* Download Link Delivery Box */}
                  {downloadLink && (
                    <div className="p-3.5 rounded-2xl bg-gradient-to-r from-cyan-950/40 to-blue-950/40 border border-cyan-500/40 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5 font-['Chakra_Petch']">
                          <Download className="w-4 h-4 text-cyan-400" />
                          Ressource numérique
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          Accès direct
                        </span>
                      </div>

                      {(item.instructions || item.accessInstructions) && (
                        <p className="text-[11px] text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                          ℹ️ {item.instructions || item.accessInstructions}
                        </p>
                      )}

                      <a
                        href={downloadLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-500/20 cursor-pointer text-center"
                      >
                        <Download className="w-4 h-4" />
                        Télécharger
                      </a>
                    </div>
                  )}

                  {/* Digital Code Box */}
                  {item.digitalCode && (
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="font-semibold uppercase tracking-wider text-cyan-400">
                          {t.account.activationCode} :
                        </span>
                        <button
                          onClick={() => toggleReveal(item.id)}
                          className="flex items-center gap-1 hover:text-white cursor-pointer"
                        >
                          {isRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          <span>{isRevealed ? t.common.hide : t.common.show}</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2 bg-black/60 p-2.5 rounded-lg border border-slate-700 font-mono">
                        <span className="text-xs sm:text-sm font-black text-white tracking-wider truncate">
                          {isRevealed ? item.digitalCode : '••••••••••••••••••••'}
                        </span>
                        <button
                          onClick={() => copyToClipboard(item.digitalCode!, item.id)}
                          className="px-2.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500 hover:text-black text-cyan-400 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer flex-shrink-0"
                        >
                          {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedId === item.id ? t.common.copied : t.common.copy}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Account credentials if provided */}
                  {(item.deliveredAccount || item.accountCredentials) && (
                    <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-slate-900/80 border border-indigo-500/40 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 font-['Chakra_Petch']">
                          <ShieldCheck className="w-4 h-4 text-indigo-400" />
                          INFORMATIONS DE VOTRE COMPTE
                        </span>
                        {(item.deliveredAccount?.durationDays || (item.accountCredentials as any)?.durationDays) && (
                          <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                            {item.deliveredAccount?.durationDays || (item.accountCredentials as any)?.durationDays} jours
                          </span>
                        )}
                      </div>

                      {/* Username / Email */}
                      {(item.deliveredAccount?.loginEmail || item.deliveredAccount?.email || item.accountCredentials?.email) && (
                        <div className="flex items-center justify-between gap-2 bg-black/60 p-2.5 rounded-xl border border-slate-800">
                          <div className="truncate font-mono">
                            <span className="text-[10px] text-slate-400 block font-sans">Email / Identifiant</span>
                            <span className="text-white font-bold select-all">
                              {item.deliveredAccount?.loginEmail || item.deliveredAccount?.email || item.accountCredentials?.email}
                            </span>
                          </div>
                          <button
                            onClick={() => copyToClipboard(item.deliveredAccount?.loginEmail || item.deliveredAccount?.email || item.accountCredentials?.email || '', `email-${item.id}`)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500 hover:text-black text-indigo-300 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer flex-shrink-0"
                            title="Copier l'identifiant"
                          >
                            {copiedId === `email-${item.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedId === `email-${item.id}` ? t.common.copied : t.common.copy}</span>
                          </button>
                        </div>
                      )}

                      {/* Password */}
                      {(item.deliveredAccount?.password || item.accountCredentials?.password) && (
                        <div className="flex items-center justify-between gap-2 bg-black/60 p-2.5 rounded-xl border border-slate-800">
                          <div className="truncate font-mono">
                            <span className="text-[10px] text-slate-400 block font-sans">Mot de passe</span>
                            <span className="text-white font-bold select-all">
                              {isRevealed 
                                ? (item.deliveredAccount?.password || item.accountCredentials?.password) 
                                : '••••••••••••'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => toggleReveal(item.id)}
                              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                              title={isRevealed ? t.common.hide : t.common.show}
                            >
                              {isRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              <span>{isRevealed ? t.common.hide : t.common.show}</span>
                            </button>
                            <button
                              onClick={() => copyToClipboard(item.deliveredAccount?.password || item.accountCredentials?.password || '', `pass-${item.id}`)}
                              className="px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500 hover:text-black text-indigo-300 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                              title="Copier le mot de passe"
                            >
                              {copiedId === `pass-${item.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedId === `pass-${item.id}` ? t.common.copied : t.common.copy}</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Profile if specified */}
                      {(item.deliveredAccount?.profileName || item.accountCredentials?.profile) && (
                        <p className="text-[11px] text-indigo-300/90 font-mono">
                          Profil / Écran : <span className="text-white font-bold">{item.deliveredAccount?.profileName || item.accountCredentials?.profile}</span>
                        </p>
                      )}

                      {/* MESSAGE (Thank you message - only shown if defined) */}
                      {(item.deliveredAccount?.thankYouMessage || item.thankYouMessage) && (
                        <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30">
                          <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block mb-0.5 font-['Chakra_Petch']">
                            MESSAGE
                          </span>
                          <p className="text-cyan-100 text-xs whitespace-pre-wrap">
                            {item.deliveredAccount?.thankYouMessage || item.thankYouMessage}
                          </p>
                        </div>
                      )}

                      {/* INSTRUCTIONS (Usage instructions - only shown if defined) */}
                      {(item.deliveredAccount?.customerInstructions || item.deliveredAccount?.instructions || item.instructions) && (
                        <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/60">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5 font-['Chakra_Petch']">
                            INSTRUCTIONS
                          </span>
                          <p className="text-slate-300 text-xs whitespace-pre-wrap">
                            {item.deliveredAccount?.customerInstructions || item.deliveredAccount?.instructions || item.instructions}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Player identifier if topup */}
                  {item.playerIdentifier && (
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
                      <span className="text-slate-400">{t.account.playerUid} :</span>
                      <span className="font-mono font-bold text-cyan-400">{item.playerIdentifier}</span>
                    </div>
                  )}

                  {/* Access instructions */}
                  {item.accessInstructions && (
                    <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-900/60 p-2 rounded-lg">
                      💡 {item.accessInstructions}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Content: Orders History */}
      {activeSubTab === 'orders' && (
        <div className="space-y-3">
          {orders.length === 0 ? (
            <div className="p-10 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-xs text-slate-500">
              {t.account.noOrders}
            </div>
          ) : (
            orders.map(order => (
              <div
                key={order.id}
                className="p-4 rounded-2xl bg-[#0e1422] border border-slate-800 space-y-2.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white font-['Chakra_Petch']">
                      {t.account.order} #{order.orderNumber}
                    </span>
                    <p className="text-[10px] text-slate-400">
                      {new Date(order.createdAt).toLocaleDateString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {order.status === 'REFUNDED' ? (
                    <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 text-[10px] font-bold">
                      REMBOURSÉ
                    </span>
                  ) : order.status === 'COMPLETED' || order.digitalDeliveryStatus === 'DELIVERED' ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                      LIVRÉ / COMPLÉTÉ
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-bold">
                      EN COURS DE TRAITEMENT
                    </span>
                  )}
                </div>

                {order.status === 'REFUNDED' && (
                  <div className="p-2.5 rounded-xl bg-red-950/20 border border-red-500/20 text-[11px] text-red-300">
                    ℹ️ Cette commande a été remboursée sur votre portefeuille.
                  </div>
                )}

                {order.customerWhatsApp && order.status === 'PROCESSING' && (
                  <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-[11px] text-emerald-300">
                    💬 Traitement en cours via WhatsApp ({order.customerWhatsApp}). Notre équipe vous contactera dans les plus brefs délais.
                  </div>
                )}

                {/* Items in order */}
                <div className="divide-y divide-slate-800/80">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="py-2.5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate">
                          <p className="font-medium text-slate-200 truncate">{item.productName}</p>
                          <p className="text-[10px] text-slate-400">
                            {item.quantity ?? 1} x {(item.priceHTG ?? 0).toLocaleString()} HTG
                            {item.playerIdentifier && ` • UID: ${item.playerIdentifier}`}
                          </p>
                        </div>
                        <span className="font-bold text-white font-mono whitespace-nowrap">
                          {((item.quantity ?? 1) * (item.priceHTG ?? 0)).toLocaleString()} HTG
                        </span>
                      </div>

                      {item.deliveredDownloadUrl && (
                        <div className="mt-1">
                          <a
                            href={item.deliveredDownloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-[11px] transition-all"
                          >
                            <Download className="w-3 h-3" />
                            Télécharger
                          </a>
                        </div>
                      )}

                      {/* Delivered Digital Account (Visible when order is completed/delivered) */}
                      {(order.status === 'COMPLETED' || order.digitalDeliveryStatus === 'DELIVERED') && item.deliveredAccount && (() => {
                        const orderItemKey = `order-${order.id}-${idx}`;
                        const isRevealedInOrder = !!revealedCodes[orderItemKey];
                        return (
                          <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 space-y-2 text-xs">
                            <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1 font-['Chakra_Petch']">
                              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                              INFORMATIONS DE VOTRE COMPTE
                            </span>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {/* Email */}
                              {(item.deliveredAccount.loginEmail || item.deliveredAccount.email) && (
                                <div className="flex items-center justify-between gap-2 bg-black/60 p-2 rounded-lg border border-slate-800">
                                  <div className="truncate font-mono">
                                    <span className="text-[9px] text-slate-400 block font-sans">Email / Identifiant</span>
                                    <span className="text-white font-bold select-all truncate block">
                                      {item.deliveredAccount.loginEmail || item.deliveredAccount.email}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => copyToClipboard(item.deliveredAccount?.loginEmail || item.deliveredAccount?.email || '', `order-email-${idx}`)}
                                    className="p-1 rounded bg-indigo-500/20 hover:bg-indigo-500 hover:text-black text-indigo-300 transition-all cursor-pointer flex-shrink-0"
                                    title="Copier"
                                  >
                                    {copiedId === `order-email-${idx}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                              )}

                              {/* Password */}
                              {item.deliveredAccount.password && (
                                <div className="flex items-center justify-between gap-2 bg-black/60 p-2 rounded-lg border border-slate-800">
                                  <div className="truncate font-mono">
                                    <span className="text-[9px] text-slate-400 block font-sans">Mot de passe</span>
                                    <span className="text-white font-bold select-all">
                                      {isRevealedInOrder ? item.deliveredAccount.password : '••••••••••••'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <button
                                      onClick={() => toggleReveal(orderItemKey)}
                                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
                                    >
                                      {isRevealedInOrder ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                    </button>
                                    <button
                                      onClick={() => copyToClipboard(item.deliveredAccount?.password || '', `order-pass-${idx}`)}
                                      className="p-1 rounded bg-indigo-500/20 hover:bg-indigo-500 hover:text-black text-indigo-300 transition-all cursor-pointer"
                                      title="Copier"
                                    >
                                      {copiedId === `order-pass-${idx}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Message */}
                            {(item.deliveredAccount.thankYouMessage || item.thankYouMessage) && (
                              <div className="p-2 rounded-lg bg-cyan-950/30 border border-cyan-500/20">
                                <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider block font-['Chakra_Petch']">
                                  MESSAGE
                                </span>
                                <p className="text-cyan-100 text-[11px] whitespace-pre-wrap">
                                  {item.deliveredAccount.thankYouMessage || item.thankYouMessage}
                                </p>
                              </div>
                            )}

                            {/* Instructions */}
                            {(item.deliveredAccount.customerInstructions || item.deliveredAccount.instructions) && (
                              <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-700/50">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block font-['Chakra_Petch']">
                                  INSTRUCTIONS
                                </span>
                                <p className="text-slate-300 text-[11px] whitespace-pre-wrap">
                                  {item.deliveredAccount.customerInstructions || item.deliveredAccount.instructions}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">{t.cart.totalToPay} :</span>
                  <span className="font-black text-cyan-400 font-['Chakra_Petch'] text-sm">
                    {(order.totalHTG ?? (order as any).totalAmountHTG ?? 0).toLocaleString()} HTG
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Content: Client Notifications Center */}
      {activeSubTab === 'notifications' && (
        <div className="space-y-3">
          {/* Header Bar */}
          <div className="p-4 rounded-2xl bg-[#0e1422] border border-cyan-500/30 shadow-lg flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-bold text-white uppercase font-['Chakra_Petch']">
                    {language === 'ht' ? 'Sant Notifikasyon' : 'Centre de Notifications'}
                  </h2>
                  {unreadNotificationsCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-bold border border-cyan-500/30">
                      {unreadNotificationsCount} {language === 'ht' ? 'nouvo' : 'nouveau(x)'}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  {language === 'ht' ? 'Swiv tout mizajou kòmand, peman, ak mesaj ou yo.' : 'Historique complet des mises à jour de commandes et alertes.'}
                </p>
              </div>
            </div>

            {unreadNotificationsCount > 0 && (
              <button
                onClick={handleMarkAllNotifsAsRead}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <CheckCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">{language === 'ht' ? 'Tout make kòm li' : 'Tout marquer lu'}</span>
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex gap-1 overflow-x-auto pb-1 text-xs">
            {[
              { id: 'all', label: language === 'ht' ? 'Tout' : 'Toutes' },
              { id: 'unread', label: `${language === 'ht' ? 'Pa li' : 'Non lues'} (${unreadNotificationsCount})` },
              { id: 'order', label: language === 'ht' ? 'Kòmand' : 'Commandes' },
              { id: 'recharge', label: language === 'ht' ? 'Rechaj' : 'Recharges' },
              { id: 'delivery', label: language === 'ht' ? 'Livrezon' : 'Livraisons' },
              { id: 'promotion', label: language === 'ht' ? 'Promosyon' : 'Promotions' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setNotifFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap font-semibold transition-all cursor-pointer ${
                  notifFilter === f.id
                    ? 'bg-cyan-500 text-black shadow-md'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Notifications List */}
          {notifications.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800">
              <Bell className="w-10 h-10 text-slate-600 mx-auto mb-2 opacity-40" />
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                {language === 'ht' ? 'Ou pa gen okenn notifikasyon pou kounye a.' : 'Aucune notification pour le moment.'}
              </p>
            </div>
          ) : (
            (() => {
              const filtered = notifications.filter(n => {
                const isUnread = !n.isRead && !n.read;
                if (notifFilter === 'unread' && !isUnread) return false;
                if (notifFilter !== 'all' && notifFilter !== 'unread' && n.type?.toLowerCase() !== notifFilter) return false;
                return true;
              });

              if (filtered.length === 0) {
                return (
                  <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800">
                    <p className="text-xs text-slate-500">
                      {language === 'ht' ? 'Pa gen notifikasyon nan kategori sa a.' : 'Aucune notification dans cette catégorie.'}
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-2">
                  {filtered.map(n => {
                    const isUnread = !n.isRead && !n.read;
                    const hasOrderLink = n.relatedEntityType === 'order' || (n.metadata && n.metadata.orderNumber);

                    return (
                      <div
                        key={n.id}
                        onClick={() => {
                          setSelectedNotif(n);
                          if (isUnread) handleMarkNotifAsRead(n.id);
                        }}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                          isUnread
                            ? 'bg-slate-900/90 border-cyan-500/40 shadow-sm'
                            : 'bg-[#0e1422] border-slate-800/80 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 shrink-0 mt-0.5">
                            {getNotifIcon(n.type)}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <h3 className={`text-xs font-bold truncate ${isUnread ? 'text-white' : 'text-slate-300'}`}>
                                {n.title}
                              </h3>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {isUnread && (
                                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                                )}
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {new Date(n.createdAt).toLocaleDateString(dateLocale, {
                                    day: '2-digit',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                            </div>

                            <p className="text-xs text-slate-300 leading-relaxed break-words">
                              {n.message}
                            </p>

                            <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-[11px]">
                              <div>
                                {hasOrderLink && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveSubTab('orders');
                                    }}
                                    className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-colors"
                                  >
                                    <span>{language === 'ht' ? 'Gade kòmand lan' : 'Voir la commande'}</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                {isUnread && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleMarkNotifAsRead(n.id, e)}
                                    className="text-slate-400 hover:text-cyan-400 text-[10px] font-semibold transition-colors cursor-pointer"
                                  >
                                    {language === 'ht' ? 'Make li' : 'Marquer lu'}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteNotif(n.id, e)}
                                  className="text-slate-500 hover:text-red-400 p-1 transition-colors cursor-pointer"
                                  title={language === 'ht' ? 'Efase' : 'Supprimer'}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}

          {/* Client Notification Detail Modal */}
          {selectedNotif && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
              <div
                className="w-full max-w-md bg-[#0e1422] border border-cyan-500/40 rounded-2xl p-5 shadow-2xl space-y-4"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      {getNotifIcon(selectedNotif.type)}
                    </div>
                    <span className="text-xs font-bold text-white uppercase font-['Chakra_Petch']">
                      {language === 'ht' ? 'Detay Notifikasyon' : 'Détail de la notification'}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedNotif(null)}
                    className="p-1 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white">
                    {selectedNotif.title}
                  </h3>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed whitespace-pre-wrap bg-slate-950 p-3 rounded-xl border border-slate-800">
                    {selectedNotif.message}
                  </p>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-900/50 p-3 rounded-xl border border-slate-800/80">
                  <span>{language === 'ht' ? 'Dat' : 'Date'} :</span>
                  <span className="font-mono text-slate-300">
                    {new Date(selectedNotif.createdAt).toLocaleString(dateLocale)}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  {(selectedNotif.relatedEntityType === 'order' || (selectedNotif.metadata && selectedNotif.metadata.orderNumber)) && (
                    <button
                      onClick={() => {
                        setSelectedNotif(null);
                        setActiveSubTab('orders');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <span>{language === 'ht' ? 'Gade kòmand' : 'Voir la commande'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteNotif(selectedNotif.id)}
                    className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition-colors cursor-pointer"
                  >
                    {language === 'ht' ? 'Efase' : 'Supprimer'}
                  </button>
                  <button
                    onClick={() => setSelectedNotif(null)}
                    className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                  >
                    {language === 'ht' ? 'Fèmen' : 'Fermer'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Content: Mes Récompenses */}
      {activeSubTab === 'rewards' && (
        <div className="space-y-4">
          {/* Overview Card with Total Spent & Progress Bar */}
          <div className="p-5 rounded-2xl bg-[#0e1422] border border-cyan-500/30 shadow-lg space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {t.loyalty.totalSpent}
                  </h3>
                  <p className="text-xl font-black text-white font-['Chakra_Petch']">
                    {(loyalty?.totalSpentHTG ?? 0).toLocaleString()} HTG
                  </p>
                </div>
              </div>

              {loyalty?.currentTier ? (
                <span className="px-3 py-1 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-black">
                  -{loyalty.currentTier.discountPercent}% Débloqué
                </span>
              ) : (
                <span className="px-3 py-1 rounded-xl bg-slate-800 text-slate-400 text-[11px] font-semibold">
                  Premier achat en cours
                </span>
              )}
            </div>

            {/* Progress Bar & Next Tier */}
            <div className="space-y-2 pt-1 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">
                  {loyalty?.nextTier
                    ? `${t.loyalty.nextReward} -${loyalty.nextTier.discountPercent}% (${loyalty.nextTier.minSpendHTG.toLocaleString()} HTG)`
                    : t.loyalty.maxTierReached}
                </span>
                <span className="font-bold text-cyan-400 font-mono">
                  {Math.round(loyalty?.progressPercent ?? 0)}%
                </span>
              </div>

              <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, loyalty?.progressPercent ?? 0))}%` }}
                />
              </div>

              {loyalty?.nextTier && (
                <p className="text-[11px] text-slate-400">
                  {t.loyalty.spendMoreToUnlock
                    .replace('{amount}', (loyalty.amountNeededHTG ?? 0).toLocaleString())
                    .replace('{percent}', String(loyalty.nextTier.discountPercent))}
                </p>
              )}
            </div>

            {/* Loyalty Milestone Steps */}
            <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-800/60 text-center">
              {[
                { spend: 1000, pct: 15 },
                { spend: 2500, pct: 20 },
                { spend: 5000, pct: 25 },
                { spend: 10000, pct: 30 },
              ].map(step => {
                const unlocked = (loyalty?.totalSpentHTG ?? 0) >= step.spend;
                return (
                  <div
                    key={step.spend}
                    className={`p-2 rounded-xl border text-[10px] transition-all ${
                      unlocked
                        ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
                        : 'bg-slate-950/40 border-slate-800/80 text-slate-400'
                    }`}
                  >
                    <div className="font-black text-xs">{step.pct}%</div>
                    <div className="text-[9px]">{step.spend >= 1000 ? `${step.spend / 1000}k` : step.spend} HTG</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Available Rewards / Coupons */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-white uppercase tracking-wider font-['Chakra_Petch'] flex items-center gap-2">
              <Gift className="w-4 h-4 text-cyan-400" />
              <span>{t.loyalty.myCoupons}</span>
            </h3>

            {(!loyalty?.rewards || loyalty.rewards.filter(r => r.status === 'AVAILABLE').length === 0) ? (
              <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800 space-y-2">
                <Gift className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  {t.loyalty.noCoupons}
                </p>
                <button
                  onClick={() => setActiveTab('catalog')}
                  className="mt-2 px-4 py-2 rounded-xl bg-cyan-500 text-black font-bold text-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span>{t.cart.browseCatalog}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              loyalty.rewards
                .filter(r => r.status === 'AVAILABLE')
                .map(reward => (
                  <div
                    key={reward.id}
                    className="p-4 rounded-2xl bg-[#0e1422] border border-cyan-500/40 shadow-lg space-y-3 relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-500 text-black font-black text-base flex items-center justify-center shadow-md">
                          -{reward.discountPercent}%
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">
                              {reward.tierName || `Réduction Fidélité ${reward.discountPercent}%`}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                              {t.loyalty.available}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>
                              {t.loyalty.expiresAt} : {new Date(reward.expiresAt).toLocaleDateString(dateLocale)}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Code display & Action buttons */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <div className="font-mono text-xs sm:text-sm font-black text-cyan-300 tracking-wider px-2">
                        {reward.code}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => copyToClipboard(reward.code, reward.id)}
                          className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          {copiedId === reward.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">{t.loyalty.copied}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>{t.loyalty.copyCode}</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setAppliedCouponCode(reward.code);
                            setActiveTab('cart');
                          }}
                          className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-sm"
                        >
                          <span>{t.loyalty.applyInCart}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>

          {/* Used or Expired History */}
          {loyalty?.rewards && loyalty.rewards.some(r => r.status !== 'AVAILABLE') && (
            <div className="space-y-2 pt-3 border-t border-slate-800/80">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {t.loyalty.historyCoupons}
              </h4>
              <div className="space-y-2">
                {loyalty.rewards
                  .filter(r => r.status !== 'AVAILABLE')
                  .map(reward => (
                    <div
                      key={reward.id}
                      className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/80 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-400">{reward.code}</span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-bold">
                          -{reward.discountPercent}%
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        reward.status === 'USED'
                          ? 'bg-slate-800 text-slate-400'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {reward.status === 'USED' ? t.loyalty.used : t.loyalty.expired}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Content: Settings & Personalization */}
      {activeSubTab === 'settings' && (
        <SettingsView />
      )}

      {/* CUSTOM LOGOUT CONFIRMATION MODAL (Strictly NO window.confirm) */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#0e1422] border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <LogOut className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-white font-['Chakra_Petch']">
                {language === 'ht' ? 'Dekonekte de kont ou a ?' : 'Confirmer la déconnexion ?'}
              </h3>
              <p className="text-xs text-slate-400">
                {language === 'ht' 
                  ? 'W ap bezwen konekte ankò pou jwenn aksè ak kòd ou yo ak kòmand ou yo.'
                  : 'Vous devrez vous reconnecter pour accéder à votre bibliothèque et à vos commandes.'}
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs transition-colors cursor-pointer border border-slate-800"
              >
                {language === 'ht' ? 'Anile' : 'Annuler'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutModal(false);
                  logout();
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold text-xs transition-colors cursor-pointer shadow-lg shadow-red-500/20 flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{language === 'ht' ? 'Wi, Dekonekte' : 'Se Déconnecter'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
