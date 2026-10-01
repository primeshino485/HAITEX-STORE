import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../../../lib/api.js';
import { AppNotification } from '../../../types.js';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  Trash2,
  Send,
  ShoppingBag,
  Smartphone,
  CreditCard,
  Package,
  Megaphone,
  Info,
  Clock,
  ExternalLink,
  Search,
  Filter,
  RefreshCw,
  PlusCircle,
  X,
  Loader2,
  Users
} from 'lucide-react';

interface AdminNotificationsProps {
  onNavigateSection?: (section: string) => void;
}

export const AdminNotifications: React.FC<AdminNotificationsProps> = ({ onNavigateSection }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'unread' | 'order' | 'recharge' | 'payment' | 'delivery' | 'promotion' | 'system'>('all');
  const [selectedNotif, setSelectedNotif] = useState<AppNotification | null>(null);

  // Broadcast / Compose state
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [composerTarget, setComposerTarget] = useState<'all' | 'user'>('all');
  const [composerUserId, setComposerUserId] = useState('');
  const [composerTitle, setComposerTitle] = useState('');
  const [composerMessage, setComposerMessage] = useState('');
  const [composerType, setComposerType] = useState<'system' | 'promotion' | 'order'>('system');
  const [isSending, setIsSending] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await api.admin.getNotifications();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load admin notifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.markNotificationRead(id);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, isRead: true, read: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev =>
        prev.map(n => ({ ...n, isRead: true, read: true }))
      );
      setBanner({ type: 'success', message: 'Toutes les notifications ont été marquées comme lues.' });
      setTimeout(() => setBanner(null), 3500);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.admin.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (selectedNotif?.id === id) {
        setSelectedNotif(null);
      }
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composerTitle.trim() || !composerMessage.trim()) {
      setBanner({ type: 'error', message: 'Veuillez saisir un titre et un message.' });
      return;
    }
    if (composerTarget === 'user' && !composerUserId.trim()) {
      setBanner({ type: 'error', message: "Veuillez spécifier l'identifiant du client." });
      return;
    }

    setIsSending(true);
    try {
      const res = await api.admin.sendNotification({
        target: composerTarget === 'all' ? 'all' : composerUserId.trim(),
        title: composerTitle.trim(),
        message: composerMessage.trim(),
        type: composerType,
      });

      if (res && res.success) {
        setBanner({
          type: 'success',
          message: composerTarget === 'all' 
            ? 'Notification diffusée avec succès à tous les utilisateurs !' 
            : `Notification envoyée au client ${composerUserId}.`,
        });
        setComposerTitle('');
        setComposerMessage('');
        setComposerUserId('');
        setIsComposerOpen(false);
        fetchNotifications();
        setTimeout(() => setBanner(null), 4000);
      }
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || "Erreur lors de l'envoi de la notification." });
    } finally {
      setIsSending(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'order':
        return <ShoppingBag className="w-4 h-4 text-cyan-400" />;
      case 'recharge':
        return <Smartphone className="w-4 h-4 text-emerald-400" />;
      case 'payment':
        return <CreditCard className="w-4 h-4 text-amber-400" />;
      case 'delivery':
        return <Package className="w-4 h-4 text-purple-400" />;
      case 'promotion':
        return <Megaphone className="w-4 h-4 text-pink-400" />;
      default:
        return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead && !n.read).length;

  const filteredNotifications = notifications.filter(n => {
    // Type filter
    if (typeFilter === 'unread' && (n.isRead || n.read)) return false;
    if (typeFilter !== 'all' && typeFilter !== 'unread' && n.type?.toLowerCase() !== typeFilter) {
      return false;
    }
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = n.title?.toLowerCase().includes(q);
      const matchMessage = n.message?.toLowerCase().includes(q);
      const matchTarget = n.target?.toLowerCase().includes(q);
      const matchEntity = n.relatedEntityId?.toLowerCase().includes(q);
      return matchTitle || matchMessage || matchTarget || matchEntity;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Banner Feedback */}
      {banner && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            banner.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{banner.message}</span>
          </div>
          <button onClick={() => setBanner(null)} className="p-1 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Main Actions */}
      <div className="p-4 rounded-2xl bg-[#0e1422] border border-amber-500/30 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-white font-['Chakra_Petch'] uppercase tracking-wide">
                Notifications ({unreadCount})
              </h2>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold">
                  {unreadCount} non {unreadCount > 1 ? 'lues' : 'lue'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Centre de surveillance des événements réels (commandes, recharges, paiements, livraisons)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsComposerOpen(true)}
            className="px-3 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Envoyer alerte</span>
          </button>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="Tout marquer comme lu"
            >
              <CheckCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Tout marquer lu</span>
            </button>
          )}

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Actualiser les notifications"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher par titre, message, commande..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#0b101c] border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex gap-1 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: 'Toutes' },
            { id: 'unread', label: `Non lues (${unreadCount})` },
            { id: 'order', label: 'Commandes' },
            { id: 'recharge', label: 'Recharges' },
            { id: 'payment', label: 'Paiements' },
            { id: 'delivery', label: 'Livraisons' },
            { id: 'promotion', label: 'Promos' },
            { id: 'system', label: 'Système' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setTypeFilter(f.id as any)}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap font-semibold transition-all cursor-pointer ${
                typeFilter === f.id
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-2">
        {loading ? (
          <div className="p-12 text-center rounded-2xl bg-[#0e1422] border border-slate-800">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-400">Chargement des notifications réelles...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-[#0e1422] border border-slate-800">
            <Bell className="w-10 h-10 text-slate-600 mx-auto mb-2 opacity-40" />
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              Aucune notification trouvée
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Les notifications s'affichent automatiquement dès qu'une action se produit sur la boutique.
            </p>
          </div>
        ) : (
          filteredNotifications.map(n => {
            const isUnread = !n.isRead && !n.read;
            const hasOrderLink = n.relatedEntityType === 'order' || (n.metadata && n.metadata.orderNumber);
            const hasRechargeLink = n.relatedEntityType === 'recharge';

            return (
              <div
                key={n.id}
                onClick={() => {
                  setSelectedNotif(n);
                  if (isUnread) handleMarkAsRead(n.id);
                }}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  isUnread
                    ? 'bg-slate-900/90 border-amber-500/40 shadow-md shadow-amber-500/5'
                    : 'bg-[#0e1422] border-slate-800/80 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 shrink-0 mt-0.5">
                    {getTypeIcon(n.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-xs font-bold truncate ${isUnread ? 'text-white' : 'text-slate-300'}`}>
                          {n.title}
                        </span>
                        <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                          {n.type}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        )}
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(n.createdAt).toLocaleDateString('fr-FR', {
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

                    {/* Metadata & Quick Direct Action Links */}
                    <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-[11px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        {n.target && n.target !== 'admin' && (
                          <span className="text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 flex items-center gap-1">
                            <Users className="w-3 h-3 text-cyan-400" />
                            Cible : {n.target === 'all' ? 'Tous' : n.target}
                          </span>
                        )}

                        {hasOrderLink && onNavigateSection && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateSection('orders');
                            }}
                            className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <span>Voir commandes</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        )}

                        {hasRechargeLink && onNavigateSection && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateSection('recharges');
                            }}
                            className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <span>Voir recharges</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {isUnread && (
                          <button
                            type="button"
                            onClick={(e) => handleMarkAsRead(n.id, e)}
                            className="text-slate-400 hover:text-cyan-400 text-[10px] font-semibold transition-colors cursor-pointer"
                            title="Marquer comme lu"
                          >
                            Marquer lu
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => handleDelete(n.id, e)}
                          className="text-slate-500 hover:text-red-400 p-1 transition-colors cursor-pointer"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* Detail Modal */}
      {selectedNotif && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-md bg-[#0e1422] border border-amber-500/40 rounded-2xl p-5 shadow-2xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {getTypeIcon(selectedNotif.type)}
                </div>
                <span className="text-xs font-bold text-white uppercase font-['Chakra_Petch']">
                  Détail de la notification
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
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700">
                {selectedNotif.type}
              </span>
              <h3 className="text-sm font-bold text-white mt-2">
                {selectedNotif.title}
              </h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed whitespace-pre-wrap bg-slate-950 p-3 rounded-xl border border-slate-800">
                {selectedNotif.message}
              </p>
            </div>

            <div className="space-y-1.5 text-[11px] text-slate-400 bg-slate-900/50 p-3 rounded-xl border border-slate-800/80">
              <div className="flex justify-between">
                <span>Date de réception :</span>
                <span className="font-mono text-slate-300">
                  {new Date(selectedNotif.createdAt).toLocaleString('fr-FR')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Destinataire :</span>
                <span className="font-mono text-cyan-400">
                  {selectedNotif.target === 'all' ? 'Tous les utilisateurs' : selectedNotif.target}
                </span>
              </div>
              {selectedNotif.relatedEntityId && (
                <div className="flex justify-between">
                  <span>Référence associée :</span>
                  <span className="font-mono text-amber-300">
                    {selectedNotif.relatedEntityId}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => handleDelete(selectedNotif.id)}
                className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition-colors cursor-pointer"
              >
                Supprimer
              </button>
              <button
                onClick={() => setSelectedNotif(null)}
                className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Broadcast / Direct Message Modal */}
      {isComposerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleSendNotification}
            className="w-full max-w-lg bg-[#0e1422] border border-cyan-500/40 rounded-2xl p-5 shadow-2xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase font-['Chakra_Petch']">
                  Envoyer une notification / alerte
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsComposerOpen(false)}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Destinataire
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setComposerTarget('all')}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                    composerTarget === 'all'
                      ? 'bg-cyan-500 text-black border-cyan-400 shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Tous les clients (Diffusion)
                </button>
                <button
                  type="button"
                  onClick={() => setComposerTarget('user')}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                    composerTarget === 'user'
                      ? 'bg-cyan-500 text-black border-cyan-400 shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Client spécifique
                </button>
              </div>
            </div>

            {/* If specific user */}
            {composerTarget === 'user' && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  ID du client ou Email
                </label>
                <input
                  type="text"
                  value={composerUserId}
                  onChange={e => setComposerUserId(e.target.value)}
                  placeholder="Ex : usr-1700000000 ou email"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            )}

            {/* Type */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">
                Catégorie de l'alerte
              </label>
              <select
                value={composerType}
                onChange={e => setComposerType(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="system">Système / Message important</option>
                <option value="promotion">Offre / Promotion commerciale</option>
                <option value="order">Information concernant une commande</option>
              </select>
            </div>

            {/* Title */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">
                Titre de la notification *
              </label>
              <input
                type="text"
                value={composerTitle}
                onChange={e => setComposerTitle(e.target.value)}
                placeholder="Ex : Maintenance programmée ou Offre spéciale Free Fire"
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Message */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">
                Message détaillé *
              </label>
              <textarea
                value={composerMessage}
                onChange={e => setComposerMessage(e.target.value)}
                placeholder="Rédigez le message qui apparaîtra dans le centre de notifications du client..."
                rows={4}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsComposerOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSending}
                className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Envoi...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Envoyer la notification</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
