import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api.js';
import { Order } from '../../../types.js';
import { 
  ShoppingBag, 
  Search, 
  Eye, 
  CheckCircle2, 
  Clock, 
  X, 
  MessageSquare, 
  ExternalLink,
  CheckCheck,
  RefreshCw,
  AlertCircle,
  Tag
} from 'lucide-react';

export const AdminOrders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [newAdminNote, setNewAdminNote] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [statusChangeNote, setStatusChangeNote] = useState('');
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refunding, setRefunding] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await api.admin.getOrders();
      setOrders(data);
      if (selectedOrder) {
        const refreshed = data.find(o => o.id === selectedOrder.id);
        if (refreshed) setSelectedOrder(refreshed);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleUpdateStatus = async (orderId: string, newStatus: any, customNote?: string) => {
    setUpdatingOrderId(orderId);
    try {
      const updated = await api.admin.updateOrderStatus(orderId, newStatus, customNote || statusChangeNote || undefined);
      showToast(`Statut de la commande #${updated.orderNumber} mis à jour : ${newStatus}`);
      setStatusChangeNote('');
      setSelectedOrder(updated);
      await fetchOrders();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la mise à jour du statut.');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleAddAdminNote = async () => {
    if (!selectedOrder || !newAdminNote.trim()) return;
    setSubmittingNote(true);
    try {
      const updated = await api.admin.addOrderNote(selectedOrder.id, newAdminNote.trim());
      showToast('Note administrative enregistrée.');
      setNewAdminNote('');
      setSelectedOrder(updated);
      await fetchOrders();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de l\'enregistrement de la note.');
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleRefundOrder = async () => {
    if (!selectedOrder) return;
    setRefunding(true);
    try {
      const res = await api.admin.refundOrder(selectedOrder.id, refundReason.trim() || 'Remboursement direct par l\'administrateur');
      showToast(res.message);
      setShowRefundModal(false);
      setRefundReason('');
      setSelectedOrder(res.order);
      await fetchOrders();
    } catch (err: any) {
      alert(err.message || 'Erreur lors du remboursement de la commande.');
    } finally {
      setRefunding(false);
    }
  };

  const filtered = orders.filter(o => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const phone = (o.customerWhatsApp || '').toLowerCase();
    return o.orderNumber.toLowerCase().includes(q) || o.userId.toLowerCase().includes(q) || phone.includes(q);
  });

  const getCleanWhatsAppLink = (phone: string, orderNumber: string) => {
    const cleanDigits = phone.replace(/[^0-9]/g, '');
    const text = encodeURIComponent(`Bonjour ! Nous vous contactons concernant votre commande #${orderNumber} sur notre boutique.`);
    return `https://wa.me/${cleanDigits}?text=${text}`;
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl bg-emerald-500 text-black font-bold text-xs shadow-2xl flex items-center gap-2 animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm sm:text-base font-black text-white font-['Chakra_Petch'] uppercase tracking-wider">
            Commandes Clients & Livraisons Numériques
          </h2>
          <p className="text-xs text-slate-400">
            Suivi des commandes, gestion des services WhatsApp et validation des livraisons
          </p>
        </div>

        <button
          onClick={fetchOrders}
          className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
          <span>Actualiser</span>
        </button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par numéro de commande, Client ID ou WhatsApp..."
          className="w-full bg-[#0e1422] border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        />
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-500 text-xs">Chargement des commandes...</div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400">
          Aucune commande trouvée.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(order => {
            const isProcessing = order.digitalDeliveryStatus === 'PROCESSING' || order.status === 'PROCESSING';
            const isDelivered = order.digitalDeliveryStatus === 'DELIVERED' || order.status === 'COMPLETED';
            const hasWhatsApp = !!order.customerWhatsApp;

            return (
              <div
                key={order.id}
                className={`p-3.5 rounded-xl bg-[#0e1422] border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                  isProcessing 
                    ? 'border-amber-500/50 bg-amber-950/10 shadow-lg shadow-amber-950/20' 
                    : 'border-slate-800'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-black text-white font-['Chakra_Petch'] text-sm">
                      #{order.orderNumber}
                    </span>

                    {/* Order status badge */}
                    {isProcessing ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        EN ATTENTE / EN TRAITEMENT
                      </span>
                    ) : isDelivered ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                        <CheckCheck className="w-3 h-3" />
                        LIVRÉ / COMPLÉTÉ
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold">
                        {order.status}
                      </span>
                    )}

                    {/* WhatsApp badge */}
                    {hasWhatsApp && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        WhatsApp : <strong className="font-mono">{order.customerWhatsApp}</strong>
                      </span>
                    )}

                    {/* Coupon badge */}
                    {order.couponCode && (
                      <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        <span>{order.couponCode} (-{(order.discountHTG || 0).toLocaleString()} HTG)</span>
                      </span>
                    )}
                  </div>

                  <p className="text-[10px] text-slate-400">
                    Client ID : <span className="font-mono text-slate-300">{order.userId.slice(0, 8)}...</span> • {new Date(order.createdAt).toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </p>

                  <p className="text-[11px] text-slate-300 mt-1">
                    {order.items.length} article{order.items.length > 1 ? 's' : ''} : <span className="text-cyan-300 font-medium">{order.items.map(i => i.productName).join(', ')}</span>
                  </p>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2.5 flex-wrap self-end sm:self-center">
                  <span className="font-black text-cyan-400 font-['Chakra_Petch'] text-sm sm:text-base">
                    {(order.totalHTG ?? (order as any).totalAmountHTG ?? 0).toLocaleString()} HTG
                  </span>

                  {/* WhatsApp direct contact button */}
                  {hasWhatsApp && (
                    <a
                      href={getCleanWhatsAppLink(order.customerWhatsApp!, order.orderNumber)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer whitespace-nowrap min-h-[36px]"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Contacter WhatsApp</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}

                  {/* Quick Mark Delivered button if processing */}
                  {isProcessing && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'DELIVERED')}
                      disabled={updatingOrderId === order.id}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition-all cursor-pointer whitespace-nowrap min-h-[36px] disabled:opacity-50"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>{updatingOrderId === order.id ? 'Mise à jour...' : 'Marquer Livré'}</span>
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedOrder(order)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 min-h-[36px]"
                  >
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Détails</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#0e1422] border border-cyan-500/30 rounded-2xl p-5 max-h-[90vh] overflow-y-auto text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white font-['Chakra_Petch'] uppercase">
                  Détails Commande #{selectedOrder.orderNumber}
                </h3>
                <p className="text-[10px] text-slate-400">
                  Passée le {new Date(selectedOrder.createdAt).toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status Transition Control Bar */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Statut de la commande :</span>
                {selectedOrder.status === 'REFUNDED' ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    REMBOURSÉ
                  </span>
                ) : selectedOrder.digitalDeliveryStatus === 'DELIVERED' || selectedOrder.status === 'COMPLETED' ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1">
                    <CheckCheck className="w-3.5 h-3.5" />
                    LIVRÉ / COMPLÉTÉ
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    EN TRAITEMENT
                  </span>
                )}
              </div>

              {selectedOrder.status !== 'REFUNDED' && (
                <>
                  <div className="space-y-1.5 pt-1">
                    <input
                      type="text"
                      value={statusChangeNote}
                      onChange={e => setStatusChangeNote(e.target.value)}
                      placeholder="Note optionnelle pour ce changement de statut..."
                      className="w-full bg-[#0a0f1d] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
                    <button
                      onClick={() => handleUpdateStatus(selectedOrder.id, 'DELIVERED')}
                      disabled={updatingOrderId === selectedOrder.id || selectedOrder.digitalDeliveryStatus === 'DELIVERED'}
                      className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Marquer comme Livré / Terminé</span>
                    </button>

                    <button
                      onClick={() => handleUpdateStatus(selectedOrder.id, 'PROCESSING')}
                      disabled={updatingOrderId === selectedOrder.id || selectedOrder.digitalDeliveryStatus === 'PROCESSING'}
                      className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Remettre en traitement
                    </button>

                    <button
                      onClick={() => setShowRefundModal(true)}
                      className="px-3 py-2 rounded-lg bg-red-950/60 hover:bg-red-900/80 border border-red-500/30 text-red-300 font-bold text-xs transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                      <span>Rembourser</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* WhatsApp Contact Box if order has WhatsApp */}
            {selectedOrder.customerWhatsApp && (
              <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <MessageSquare className="w-4 h-4" />
                    <span>Numéro WhatsApp du client :</span>
                  </div>
                  <span className="text-white font-mono font-bold text-sm bg-black/50 px-2.5 py-1 rounded-lg border border-emerald-500/30 select-all">
                    {selectedOrder.customerWhatsApp}
                  </span>
                </div>

                <p className="text-[11px] text-slate-300">
                  Cette commande nécessite une communication avec le client (ex: autorisation de compte, livraison manuelle ou instructions).
                </p>

                <a
                  href={getCleanWhatsAppLink(selectedOrder.customerWhatsApp, selectedOrder.orderNumber)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Ouvrir la conversation WhatsApp</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <p className="text-[10px] text-slate-400">
                  ℹ️ Donnée confidentielle réservée au traitement de la commande par l'administrateur.
                </p>
              </div>
            )}

            {/* Payment Info */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Information de paiement</span>
              <div className="flex justify-between">
                <span className="text-slate-300">Mode :</span>
                <span className="text-cyan-400 font-bold">Portefeuille (Wallet HTG)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Total réglé :</span>
                <span className="text-white font-mono font-bold">{(selectedOrder.totalHTG ?? (selectedOrder as any).totalAmountHTG ?? 0).toLocaleString()} HTG</span>
              </div>
              {selectedOrder.discountHTG && selectedOrder.discountHTG > 0 && (
                <>
                  <div className="flex justify-between text-slate-400">
                    <span>Sous-total commande :</span>
                    <span className="font-mono">{(selectedOrder.subtotalHTG || 0).toLocaleString()} HTG</span>
                  </div>
                  <div className="flex justify-between text-emerald-400">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      <span>Coupon appliqué ({selectedOrder.couponType === 'PROMOTIONAL' ? 'Promo' : 'Fidélité'}) :</span>
                    </span>
                    <span className="font-mono font-bold">
                      {selectedOrder.couponCode} (-{selectedOrder.discountHTG.toLocaleString()} HTG)
                    </span>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <span className="text-slate-300">ID Client :</span>
                <span className="text-slate-400 font-mono text-[10px]">{selectedOrder.userId}</span>
              </div>
            </div>

            {/* Items List */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Articles de la commande :</span>
              {selectedOrder.items.map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                  <div className="flex justify-between font-bold text-white">
                    <span>{item.productName}</span>
                    <span className="font-mono text-cyan-400">{((item.priceHTG ?? 0) * (item.quantity ?? 1)).toLocaleString()} HTG</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Quantité : {item.quantity ?? 1} x {(item.priceHTG ?? 0).toLocaleString()} HTG
                  </div>
                  {item.playerIdentifier && (
                    <div className="text-[11px] text-emerald-400 font-mono">
                      UID Joueur : {item.playerIdentifier}
                    </div>
                  )}
                  {item.customerWhatsApp && (
                    <div className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      <span>WhatsApp : {item.customerWhatsApp}</span>
                    </div>
                  )}
                  {item.accountEmail && (
                    <div className="text-[11px] text-cyan-400 font-mono">
                      Email compte : {item.accountEmail}
                    </div>
                  )}
                  {item.accountName && (
                    <div className="text-[11px] text-purple-400 font-mono">
                      Nom de compte : {item.accountName}
                    </div>
                  )}
                  {item.customRequirement && (
                    <div className="text-[11px] text-amber-300 bg-amber-950/20 p-1.5 rounded border border-amber-500/20">
                      Instruction client : {item.customRequirement}
                    </div>
                  )}
                  {item.digitalCodesDelivered && item.digitalCodesDelivered.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-800 space-y-1">
                      <span className="text-[10px] font-bold text-cyan-400 uppercase">Codes numériques remis :</span>
                      {item.digitalCodesDelivered.map((code, cIdx) => (
                        <div key={cIdx} className="p-1.5 rounded bg-black/60 font-mono text-xs text-white border border-slate-700 select-all">
                          {code}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Status History */}
            {selectedOrder.statusHistory && selectedOrder.statusHistory.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  Historique des statuts ({selectedOrder.statusHistory.length})
                </span>
                <div className="space-y-1.5">
                  {selectedOrder.statusHistory.map((h, i) => (
                    <div key={i} className="p-2 rounded-lg bg-slate-950 border border-slate-800/80 text-[11px] space-y-0.5">
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="font-bold text-cyan-400">{h.status}</span>
                        <span className="text-[10px]">{new Date(h.timestamp).toLocaleString('fr-FR')}</span>
                      </div>
                      <div className="text-slate-300">Par : {h.updatedBy}</div>
                      {h.note && <div className="text-amber-300/90 italic">« {h.note} »</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Admin Notes */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                Notes Administrateur (Internes)
              </span>

              {selectedOrder.adminNotes && selectedOrder.adminNotes.length > 0 ? (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {selectedOrder.adminNotes.map((n) => (
                    <div key={n.id} className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] space-y-0.5">
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="font-bold text-white">{n.author}</span>
                        <span>{new Date(n.createdAt).toLocaleString('fr-FR')}</span>
                      </div>
                      <p className="text-slate-200">{n.note}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 italic">Aucune note interne pour cette commande.</p>
              )}

              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={newAdminNote}
                  onChange={e => setNewAdminNote(e.target.value)}
                  placeholder="Ajouter une note de suivi interne..."
                  className="flex-1 bg-[#0a0f1d] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddAdminNote();
                    }
                  }}
                />
                <button
                  onClick={handleAddAdminNote}
                  disabled={submittingNote || !newAdminNote.trim()}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-all disabled:opacity-40 cursor-pointer whitespace-nowrap"
                >
                  {submittingNote ? 'Envoi...' : 'Ajouter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Refund Confirmation Modal */}
      {showRefundModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#0e1422] border border-red-500/40 rounded-2xl p-5 text-xs space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-red-400 font-bold font-['Chakra_Petch'] text-sm uppercase">
                <AlertCircle className="w-5 h-5" />
                <span>Remboursement Commande #{selectedOrder.orderNumber}</span>
              </div>
              <button onClick={() => setShowRefundModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-red-950/20 border border-red-500/20 text-slate-300 space-y-1">
              <p className="font-bold text-white">Montant à rembourser au portefeuille client :</p>
              <p className="font-mono text-base font-black text-red-400">
                {(selectedOrder.totalHTG ?? (selectedOrder as any).totalAmountHTG ?? 0).toLocaleString()} HTG
              </p>
              <p className="text-[11px] text-slate-400 pt-1">
                Ce montant sera immédiatement ré-injecté dans le solde Wallet du client ({selectedOrder.userId}). Le statut de la commande passera à REFUNDED.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300">Motif du remboursement :</label>
              <textarea
                value={refundReason}
                onChange={e => setRefundReason(e.target.value)}
                placeholder="Ex: Rupture de service, annulation demandée par le client, problème d'identifiant..."
                rows={3}
                className="w-full bg-[#0a0f1d] border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowRefundModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={handleRefundOrder}
                disabled={refunding}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold flex items-center gap-1.5 shadow-lg shadow-red-950/40 disabled:opacity-50 cursor-pointer"
              >
                {refunding ? 'Traitement...' : 'Confirmer le remboursement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
