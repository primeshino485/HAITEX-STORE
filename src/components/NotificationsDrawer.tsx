import React, { useState } from 'react';
import { useStore } from '../context/StoreContext.js';
import { useI18n } from '../context/I18nContext.js';
import { api } from '../lib/api.js';
import { 
  X, 
  Bell, 
  CheckCheck, 
  ShoppingBag, 
  Smartphone, 
  AlertTriangle, 
  Info,
  Clock,
  Trash2,
  Package,
  Megaphone,
  ExternalLink
} from 'lucide-react';

export const NotificationsDrawer: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { notifications, refreshNotifications, user, setActiveTab, setAccountSubTab } = useStore();
  const { t, language } = useI18n();
  const [filter, setFilter] = useState<'all' | 'unread' | 'order' | 'recharge' | 'delivery' | 'promotion' | 'stock'>('all');

  if (!isOpen) return null;

  const filteredNotifs = notifications.filter(n => {
    const isUnread = !n.isRead && !n.read;
    if (filter === 'unread') return isUnread;
    if (filter === 'all') return true;
    return n.type?.toLowerCase() === filter;
  });

  const unreadCount = notifications.filter(n => !n.isRead && !n.read).length;

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.markNotificationRead(id);
      await refreshNotifications();
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
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
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const handleGoToOrder = (orderId?: string) => {
    setActiveTab('account');
    setAccountSubTab('orders');
    onClose();
  };

  const getIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'order':
        return <ShoppingBag className="w-4 h-4 text-cyan-400" />;
      case 'recharge':
        return <Smartphone className="w-4 h-4 text-emerald-400" />;
      case 'delivery':
        return <Package className="w-4 h-4 text-purple-400" />;
      case 'promotion':
        return <Megaphone className="w-4 h-4 text-pink-400" />;
      case 'stock':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      default:
        return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  const dateLocale = language === 'en' ? 'en-US' : language === 'ht' ? 'fr-HT' : 'fr-FR';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-sm sm:max-w-md bg-[#0e1422] border-l border-slate-800 h-full flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-cyan-400" />
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-['Chakra_Petch']">
                {t.notifications.title}
              </h2>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-[10px] border border-cyan-500/30">
                  {unreadCount}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 text-xs flex items-center gap-1 cursor-pointer transition-colors"
                title={t.notifications.markAllRead}
              >
                <CheckCheck className="w-4 h-4" />
                <span className="text-[10px] hidden sm:inline">{t.notifications.readAll}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex gap-1.5 p-3 border-b border-slate-800/80 overflow-x-auto text-[11px]">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
              filter === 'all' ? 'bg-cyan-500 text-black font-bold' : 'bg-slate-900 text-slate-400'
            }`}
          >
            {t.notifications.all}
          </button>
          {unreadCount > 0 && (
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
                filter === 'unread' ? 'bg-cyan-500 text-black font-bold' : 'bg-slate-900 text-slate-400'
              }`}
            >
              {language === 'ht' ? 'Pa li' : 'Non lues'} ({unreadCount})
            </button>
          )}
          <button
            onClick={() => setFilter('order')}
            className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
              filter === 'order' ? 'bg-cyan-500 text-black font-bold' : 'bg-slate-900 text-slate-400'
            }`}
          >
            {t.notifications.orders}
          </button>
          <button
            onClick={() => setFilter('delivery')}
            className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
              filter === 'delivery' ? 'bg-cyan-500 text-black font-bold' : 'bg-slate-900 text-slate-400'
            }`}
          >
            {language === 'ht' ? 'Livrezon' : 'Livraisons'}
          </button>
          <button
            onClick={() => setFilter('recharge')}
            className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
              filter === 'recharge' ? 'bg-cyan-500 text-black font-bold' : 'bg-slate-900 text-slate-400'
            }`}
          >
            {t.notifications.recharges}
          </button>
          {user?.role === 'ADMIN' && (
            <button
              onClick={() => setFilter('stock')}
              className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
                filter === 'stock' ? 'bg-cyan-500 text-black font-bold' : 'bg-slate-900 text-slate-400'
              }`}
            >
              {t.notifications.stocks}
            </button>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {filteredNotifs.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-xs">
              {t.notifications.noNotifications}
            </div>
          ) : (
            filteredNotifs.map(n => {
              const isUnread = !n.isRead && !n.read;
              const hasOrderLink = n.relatedEntityType === 'order' || (n.metadata && n.metadata.orderNumber);

              return (
                <div
                  key={n.id}
                  onClick={() => {
                    if (isUnread) handleMarkAsRead(n.id);
                  }}
                  className={`p-3 rounded-xl border transition-all ${
                    isUnread
                      ? 'bg-slate-900/90 border-cyan-500/40 shadow-sm'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 mt-0.5 shrink-0">
                      {getIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <h3 className={`text-xs font-bold truncate ${isUnread ? 'text-white' : 'text-slate-300'}`}>
                          {n.title}
                        </h3>
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0 animate-pulse" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed break-words">
                        {n.message}
                      </p>

                      <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-slate-800/60 text-[10px]">
                        <div className="flex items-center gap-1 text-slate-500">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(n.createdAt).toLocaleDateString(dateLocale, { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {hasOrderLink && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleGoToOrder(n.relatedEntityId);
                              }}
                              className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 cursor-pointer font-bold px-1.5 py-0.5 rounded bg-cyan-950/40 border border-cyan-500/30"
                            >
                              <span>{language === 'ht' ? 'Kòmand' : 'Commande'}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => handleDeleteNotif(n.id, e)}
                            className="text-slate-500 hover:text-red-400 p-0.5 transition-colors cursor-pointer"
                            title={language === 'ht' ? 'Efase' : 'Supprimer'}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
