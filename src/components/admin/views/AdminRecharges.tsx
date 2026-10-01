import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api.js';
import { RechargeRequest } from '../../../types.js';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Image as ImageIcon, 
  ShieldCheck,
  X,
  AlertCircle,
  Loader2,
  RefreshCw,
  Search
} from 'lucide-react';

interface ConfirmActionState {
  recharge: RechargeRequest;
  action: 'APPROVED' | 'REJECTED';
}

export const AdminRecharges: React.FC = () => {
  const [recharges, setRecharges] = useState<RechargeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'PENDING' | 'APPROVED' | 'REJECTED'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // Dialog de confirmation intégré dans l'UI (sans window.confirm bloquant les iframes)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmActionState | null>(null);
  const [dialogNote, setDialogNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Feedback visuel clair (sans window.alert)
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchRecharges = async () => {
    setLoading(true);
    try {
      const data = await api.admin.getRecharges();
      setRecharges(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('[AdminRecharges] Erreur chargement:', err);
      setBanner({
        type: 'error',
        message: err?.message || 'Erreur lors du chargement des recharges.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecharges();
  }, []);

  const isApproved = (status: string) => status === 'APPROVED' || status === 'CONFIRMED';
  const isRejected = (status: string) => status === 'REJECTED' || status === 'REFUSED' || status === 'CANCELLED';
  const isPending = (status: string) => status === 'PENDING';

  const pendingCount = recharges.filter(r => isPending(r.status)).length;
  const approvedCount = recharges.filter(r => isApproved(r.status)).length;
  const rejectedCount = recharges.filter(r => isRejected(r.status)).length;

  const handleOpenConfirm = (recharge: RechargeRequest, action: 'APPROVED' | 'REJECTED') => {
    setBanner(null);
    setDialogNote('');
    setConfirmDialog({ recharge, action });
  };

  const handleExecuteAction = async () => {
    if (!confirmDialog || isSubmitting) return;

    const { recharge, action } = confirmDialog;
    setIsSubmitting(true);
    setBanner(null);

    try {
      // Appel API avec protection anti-double clic
      const result = await api.admin.processRecharge(recharge.id, action, dialogNote || undefined);
      
      const updatedRecharge: RechargeRequest = result.recharge || {
        ...recharge,
        status: action === 'APPROVED' ? 'CONFIRMED' : 'REJECTED',
        adminNote: dialogNote || (action === 'APPROVED' ? 'Validé par admin' : 'Refusé par admin'),
        processedAt: new Date().toISOString(),
      };

      // Mise à jour immédiate et réactive de l'état local
      setRecharges(prev => prev.map(r => r.id === recharge.id ? updatedRecharge : r));
      
      setBanner({
        type: 'success',
        message: action === 'APPROVED'
          ? `✓ Recharge de ${recharge.amountHTG.toLocaleString()} HTG approuvée avec succès ! Le portefeuille de ${recharge.userEmail} a été crédité.`
          : `✓ Demande de recharge ${recharge.transcode} refusée. Aucun montant n'a été crédité.`,
      });

      setConfirmDialog(null);
      setDialogNote('');

      // Rafraîchir en arrière-plan pour synchroniser
      await fetchRecharges();
    } catch (err: any) {
      console.error('[AdminRecharges] Erreur traitement:', err);
      setBanner({
        type: 'error',
        message: err?.message || 'Erreur lors du traitement de la demande de recharge.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = recharges.filter(r => {
    // Filtre d'onglet
    if (filterStatus === 'PENDING' && !isPending(r.status)) return false;
    if (filterStatus === 'APPROVED' && !isApproved(r.status)) return false;
    if (filterStatus === 'REJECTED' && !isRejected(r.status)) return false;

    // Filtre de recherche
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchEmail = (r.userEmail || '').toLowerCase().includes(q);
      const matchTranscode = (r.transcode || '').toLowerCase().includes(q);
      const matchId = (r.id || '').toLowerCase().includes(q);
      const matchMethod = (r.paymentMethod || '').toLowerCase().includes(q);
      return matchEmail || matchTranscode || matchId || matchMethod;
    }

    return true;
  });

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm sm:text-base font-black text-white font-['Chakra_Petch'] uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            Validation des Recharges de Portefeuille
          </h2>
          <p className="text-xs text-slate-400">
            Vérifiez les codes SMS / reçus et validez pour créditer instantanément les portefeuilles clients
          </p>
        </div>

        <button
          onClick={fetchRecharges}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualiser</span>
        </button>
      </div>

      {/* Bannière de notification (Succès ou Erreur) */}
      {banner && (
        <div 
          className={`p-3.5 rounded-2xl border flex items-start justify-between gap-3 text-xs animate-in slide-in-from-top-2 duration-200 ${
            banner.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          <div className="flex items-start gap-2">
            {banner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            )}
            <p className="font-medium leading-relaxed">{banner.message}</p>
          </div>
          <button 
            onClick={() => setBanner(null)}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex gap-2 overflow-x-auto text-xs pb-1 sm:pb-0">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              filterStatus === 'all'
                ? 'bg-cyan-500 text-black shadow-md'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            <span>Toutes</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-black/20 rounded-full">{recharges.length}</span>
          </button>

          <button
            onClick={() => setFilterStatus('PENDING')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              filterStatus === 'PENDING'
                ? 'bg-amber-500 text-black shadow-md'
                : 'bg-slate-900 text-amber-400/90 border border-slate-800 hover:border-amber-500/40'
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>En Attente</span>
            {pendingCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 bg-amber-400/20 text-amber-300 font-black rounded-full">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setFilterStatus('APPROVED')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              filterStatus === 'APPROVED'
                ? 'bg-emerald-500 text-black shadow-md'
                : 'bg-slate-900 text-emerald-400/90 border border-slate-800 hover:border-emerald-500/40'
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>Approuvées / Confirmées</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-black/20 rounded-full">{approvedCount}</span>
          </button>

          <button
            onClick={() => setFilterStatus('REJECTED')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              filterStatus === 'REJECTED'
                ? 'bg-red-500 text-white shadow-md'
                : 'bg-slate-900 text-red-400/90 border border-slate-800 hover:border-red-500/40'
            }`}
          >
            <XCircle className="w-3 h-3" />
            <span>Refusées</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-black/20 rounded-full">{rejectedCount}</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative min-w-[200px] sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher transcode, email..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-900/90 border border-slate-800 focus:border-cyan-500/50 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-colors"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-16 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
          <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
          <span>Chargement des demandes de recharge...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400">
          Aucune demande de recharge trouvée dans cette sélection.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => {
            const pending = isPending(req.status);
            const approved = isApproved(req.status);
            const rejected = isRejected(req.status);

            return (
              <div
                key={req.id}
                className={`p-4 rounded-2xl bg-[#0e1422] border transition-all text-xs space-y-3 ${
                  pending 
                    ? 'border-amber-500/50 shadow-lg shadow-amber-500/5 ring-1 ring-amber-500/20' 
                    : approved
                    ? 'border-emerald-500/30'
                    : 'border-slate-800 opacity-90'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-black text-cyan-400 font-['Chakra_Petch']">
                        +{(req.amountHTG ?? 0).toLocaleString()} HTG
                      </span>
                      <span className="text-slate-500">•</span>
                      <span className="text-white font-bold tracking-wide uppercase px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/60 text-[11px]">
                        {(req.paymentMethodKey || req.paymentMethod || 'NATCASH').toUpperCase()}
                      </span>
                      
                      {pending && (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3 animate-spin" />
                          EN ATTENTE (Action requise)
                        </span>
                      )}
                      {approved && (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1 shadow-sm">
                          <CheckCircle2 className="w-3 h-3" />
                          CONFIRMÉ (Solde crédité)
                        </span>
                      )}
                      {rejected && (
                        <span className="px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 text-[10px] font-bold flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          REFUSÉ (Non crédité)
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-300 font-mono flex items-center gap-2">
                      <span>Transcode SMS / Référence :</span>
                      <span className="text-cyan-300 font-black text-xs bg-slate-900 px-2 py-0.5 rounded border border-cyan-500/30">
                        {req.transcode || 'N/A'}
                      </span>
                    </p>

                    <p className="text-[11px] text-slate-400">
                      Client : <span className="text-slate-200 font-semibold">{req.userEmail || req.userName || req.userId}</span>
                      {req.paymentDate && <span> • Date indiquée : <span className="text-slate-300">{req.paymentDate}</span></span>}
                      {req.createdAt && <span> • Soumis le {new Date(req.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
                    </p>
                  </div>

                  {/* Screenshot trigger */}
                  {req.screenshotUrl && (
                    <button
                      onClick={() => setPreviewImage(req.screenshotUrl!)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold self-start sm:self-center transition-colors shadow-sm"
                    >
                      <ImageIcon className="w-4 h-4 text-cyan-400" />
                      <span>Voir la preuve de paiement</span>
                    </button>
                  )}
                </div>

                {/* Admin Note display */}
                {req.adminNote && (
                  <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-300 flex items-start gap-2">
                    <span className="text-slate-500 font-bold uppercase shrink-0">Note Admin :</span>
                    <span className="italic">{req.adminNote}</span>
                  </div>
                )}

                {/* Action buttons if PENDING */}
                {pending && (
                  <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
                    <button
                      onClick={() => handleOpenConfirm(req, 'REJECTED')}
                      className="px-3.5 py-2 rounded-xl bg-red-500/15 hover:bg-red-500 hover:text-white border border-red-500/30 text-red-300 font-bold text-xs uppercase transition-all"
                    >
                      Refuser
                    </button>
                    <button
                      onClick={() => handleOpenConfirm(req, 'APPROVED')}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approuver & Créditer (+{(req.amountHTG ?? 0).toLocaleString()} HTG)</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* In-App Confirmation Modal (Garantie de fonctionnement sans iframe modal blocking) */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="max-w-md w-full bg-[#0e1422] rounded-2xl border border-slate-700 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white font-['Chakra_Petch'] uppercase tracking-wider flex items-center gap-2">
                {confirmDialog.action === 'APPROVED' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Confirmer l'approbation</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-red-400" />
                    <span>Confirmer le refus</span>
                  </>
                )}
              </h3>
              <button
                onClick={() => !isSubmitting && setConfirmDialog(null)}
                disabled={isSubmitting}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Montant :</span>
                  <span className="font-bold text-cyan-400">+{confirmDialog.recharge.amountHTG.toLocaleString()} HTG</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Client :</span>
                  <span className="font-semibold text-white">{confirmDialog.recharge.userEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Transcode :</span>
                  <span className="font-mono text-cyan-300">{confirmDialog.recharge.transcode}</span>
                </div>
              </div>

              {confirmDialog.action === 'APPROVED' ? (
                <p className="text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl">
                  En approuvant, le portefeuille du client sera <strong className="font-black">immédiatement et irréversiblement crédité de {confirmDialog.recharge.amountHTG.toLocaleString()} HTG</strong>.
                </p>
              ) : (
                <p className="text-red-300 bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl">
                  En refusant, cette demande sera marquée comme rejetée. <strong className="font-black">Aucun montant ne sera crédité.</strong>
                </p>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  Note ou motif {confirmDialog.action === 'REJECTED' ? '(recommandé)' : '(facultatif)'}
                </label>
                <input
                  type="text"
                  value={dialogNote}
                  onChange={e => setDialogNote(e.target.value)}
                  placeholder={
                    confirmDialog.action === 'APPROVED'
                      ? 'Ex: Virement reçu et vérifié'
                      : 'Ex: Numéro de référence introuvable'
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500/50"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                disabled={isSubmitting}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              
              <button
                type="button"
                onClick={handleExecuteAction}
                disabled={isSubmitting}
                className={`px-4 py-2 rounded-xl font-black text-xs uppercase shadow-md transition-all flex items-center gap-1.5 ${
                  confirmDialog.action === 'APPROVED'
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
                    : 'bg-red-500 hover:bg-red-400 text-white shadow-red-500/20'
                } disabled:opacity-50`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Traitement en cours...</span>
                  </>
                ) : confirmDialog.action === 'APPROVED' ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirmer & Créditer</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Confirmer le refus</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screenshot Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/90 backdrop-blur-md">
          <div className="max-w-lg w-full bg-[#0e1422] rounded-2xl border border-slate-800 p-4 relative">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
            <h4 className="text-xs font-bold text-white uppercase mb-3">Preuve de virement</h4>
            <div className="rounded-xl overflow-hidden border border-slate-800 bg-black flex items-center justify-center max-h-[75vh]">
              <img src={previewImage} alt="Capture transfert" className="max-h-[75vh] object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
