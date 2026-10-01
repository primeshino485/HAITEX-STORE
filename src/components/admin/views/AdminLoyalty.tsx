import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api.js';
import { LoyaltyConfig, LoyaltyTier, LoyaltyReward } from '../../../types.js';
import { 
  Gift, 
  Check, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Save, 
  TrendingUp, 
  CheckCircle2, 
  XCircle, 
  Percent, 
  Search,
  Filter,
  RefreshCw,
  Clock,
  Edit2
} from 'lucide-react';

export const AdminLoyalty: React.FC = () => {
  const [config, setConfig] = useState<LoyaltyConfig | null>(null);
  const [rewards, setRewards] = useState<(LoyaltyReward & { totalSpentHTG?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Rewards list filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal / Form state to create or edit a tier
  const [editingTier, setEditingTier] = useState<Partial<LoyaltyTier> | null>(null);
  const [isEditingNew, setIsEditingNew] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await api.admin.getLoyalty();
      setConfig(data.config);
      setRewards(data.rewards);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors du chargement des données de fidélité.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleSystem = async () => {
    if (!config) return;
    setSavingConfig(true);
    setErrorMessage(null);
    try {
      const newEnabled = !config.enabled;
      const res = await api.admin.updateLoyaltyConfig(newEnabled);
      setConfig(res.config);
      setSuccessMessage(newEnabled ? 'Système de fidélité activé !' : 'Système de fidélité désactivé.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors du changement de statut.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleOpenCreateTier = () => {
    setIsEditingNew(true);
    setEditingTier({
      minSpendHTG: 1000,
      discountPercent: 15,
      validityDays: 30,
      minOrderAmountHTG: 0,
      maxDiscountHTG: undefined,
      maxUses: 1,
      isActive: true,
    });
  };

  const handleOpenEditTier = (tier: LoyaltyTier) => {
    setIsEditingNew(false);
    setEditingTier({ ...tier });
  };

  const handleSaveTierForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTier) return;
    if (!editingTier.minSpendHTG || editingTier.minSpendHTG <= 0) {
      alert('Veuillez spécifier un seuil de dépense supérieur à 0 HTG.');
      return;
    }
    if (!editingTier.discountPercent || editingTier.discountPercent <= 0 || editingTier.discountPercent > 100) {
      alert('Le pourcentage de réduction doit être compris entre 1% et 100%.');
      return;
    }

    setActionLoading('saveTier');
    setErrorMessage(null);
    try {
      if (isEditingNew) {
        await api.admin.createLoyaltyTier({
          minSpendHTG: Number(editingTier.minSpendHTG),
          discountPercent: Number(editingTier.discountPercent),
          validityDays: Number(editingTier.validityDays) || 30,
          minOrderAmountHTG: Number(editingTier.minOrderAmountHTG) || 0,
          maxDiscountHTG: editingTier.maxDiscountHTG ? Number(editingTier.maxDiscountHTG) : undefined,
          maxUses: Number(editingTier.maxUses) || 1,
          isActive: editingTier.isActive !== undefined ? editingTier.isActive : true,
        });
        setSuccessMessage('Nouveau palier créé avec succès !');
      } else if (editingTier.id) {
        await api.admin.updateLoyaltyTier(editingTier.id, {
          minSpendHTG: Number(editingTier.minSpendHTG),
          discountPercent: Number(editingTier.discountPercent),
          validityDays: Number(editingTier.validityDays) || 30,
          minOrderAmountHTG: Number(editingTier.minOrderAmountHTG) || 0,
          maxDiscountHTG: editingTier.maxDiscountHTG ? Number(editingTier.maxDiscountHTG) : undefined,
          maxUses: Number(editingTier.maxUses) || 1,
          isActive: editingTier.isActive !== undefined ? editingTier.isActive : true,
        });
        setSuccessMessage('Palier mis à jour avec succès !');
      }
      setEditingTier(null);
      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de la sauvegarde du palier.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteTier = async (id: string, minSpendHTG: number) => {
    if (!confirm(`Confirmez-vous la suppression du palier ${minSpendHTG.toLocaleString()} HTG ?`)) {
      return;
    }
    setActionLoading(`delete_${id}`);
    try {
      await api.admin.deleteLoyaltyTier(id);
      setSuccessMessage('Palier supprimé.');
      setTimeout(() => setSuccessMessage(null), 3000);
      await fetchData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de la suppression.');
    } finally {
      setActionLoading(null);
    }
  };

  // Filter rewards
  const filteredRewards = rewards.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.code.toLowerCase().includes(q) ||
        r.userEmail.toLowerCase().includes(q) ||
        r.userId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalRewardsCount = rewards.length;
  const availableRewardsCount = rewards.filter(r => r.status === 'available').length;
  const usedRewardsCount = rewards.filter(r => r.status === 'used').length;
  const expiredRewardsCount = rewards.filter(r => r.status === 'expired').length;

  if (loading) {
    return (
      <div className="py-16 text-center text-slate-500 text-xs font-mono">
        Chargement de la gestion de la fidélité...
      </div>
    );
  }

  const tiers = config?.tiers || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm sm:text-base font-black text-white font-['Chakra_Petch'] uppercase tracking-wider flex items-center gap-2">
            <Gift className="w-5 h-5 text-cyan-400" />
            <span>Système de Fidélité par Réductions</span>
          </h2>
          <p className="text-xs text-slate-400">
            Cumul automatique des commandes payées/validées et déblocage de codes promotionnels.
          </p>
        </div>

        <button
          onClick={fetchData}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Actualiser</span>
        </button>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3.5 rounded-2xl bg-[#0e1422] border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Statut Général</span>
          <div className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${config?.enabled ? 'bg-emerald-400' : 'bg-red-400'}`} />
            <span className="text-sm font-black text-white font-['Chakra_Petch']">
              {config?.enabled ? 'ACTIF' : 'DÉSACTIVÉ'}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#0e1422] border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Coupons Générés</span>
          <p className="text-lg font-black text-white font-['Chakra_Petch']">
            {totalRewardsCount}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#0e1422] border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Coupons Disponibles</span>
          <p className="text-lg font-black text-emerald-400 font-['Chakra_Petch']">
            {availableRewardsCount}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#0e1422] border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Coupons Utilisés</span>
          <p className="text-lg font-black text-cyan-400 font-['Chakra_Petch']">
            {usedRewardsCount}
          </p>
        </div>
      </div>

      {/* Section 1: Activation Switch & Tiers Management */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0e1422] border border-cyan-500/30 space-y-4 shadow-xl shadow-cyan-500/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white uppercase font-['Chakra_Petch']">
              Paliers de Récompenses
            </h3>
            <p className="text-[11px] text-slate-400">
              Configurez les seuils de dépenses requis et le pourcentage de coupon attribué aux clients.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-300 font-medium">
              {config?.enabled ? 'Fidélité Active' : 'Fidélité Désactivée'}
            </span>
            <button
              type="button"
              disabled={savingConfig}
              onClick={handleToggleSystem}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                config?.enabled
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
                  : 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
              }`}
            >
              {savingConfig ? '...' : config?.enabled ? 'Désactiver' : 'Activer'}
            </button>
          </div>
        </div>

        {/* Tiers List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {tiers.map(tier => (
            <div
              key={tier.id}
              className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 text-xs font-mono font-black">
                    -{tier.discountPercent}%
                  </span>
                  <span className="text-xs font-bold text-white font-['Chakra_Petch']">
                    Dès {tier.minSpendHTG.toLocaleString()} HTG
                  </span>
                  {!tier.isActive && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      Inactif
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-3 font-mono">
                  <span>Validité : {tier.validityDays}j</span>
                  <span>Min cmd : {tier.minOrderAmountHTG} HTG</span>
                  {tier.maxDiscountHTG && <span>Plafond : {tier.maxDiscountHTG.toLocaleString()} HTG</span>}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleOpenEditTier(tier)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors cursor-pointer"
                  title="Modifier ce palier"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={actionLoading === `delete_${tier.id}`}
                  onClick={() => handleDeleteTier(tier.id, tier.minSpendHTG)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-40"
                  title="Supprimer ce palier"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add Tier Action */}
        <div className="pt-2 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={handleOpenCreateTier}
            className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-cyan-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Palier de Réduction</span>
          </button>
        </div>
      </div>

      {/* Tier Create/Edit Modal */}
      {editingTier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div 
            className="w-full max-w-md bg-[#0e1422] border border-cyan-500/40 rounded-2xl p-5 space-y-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h4 className="text-sm font-bold text-white font-['Chakra_Petch'] uppercase">
                {isEditingNew ? 'Créer un Palier de Réduction' : 'Modifier le Palier'}
              </h4>
              <button
                type="button"
                onClick={() => setEditingTier(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTierForm} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Seuil de Dépenses Cumulées (HTG) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="50"
                  value={editingTier.minSpendHTG || ''}
                  onChange={e => setEditingTier({ ...editingTier, minSpendHTG: Number(e.target.value) })}
                  placeholder="Ex: 1000"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-lg px-3 py-2 text-white font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Montant total de commandes payées/validées à atteindre pour débloquer la réduction.
                </p>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Pourcentage de Réduction (%) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max="100"
                  value={editingTier.discountPercent || ''}
                  onChange={e => setEditingTier({ ...editingTier, discountPercent: Number(e.target.value) })}
                  placeholder="Ex: 15"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-lg px-3 py-2 text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Durée de Validité (jours)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editingTier.validityDays || 30}
                    onChange={e => setEditingTier({ ...editingTier, validityDays: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Plafond Remise (HTG optionnel)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Illimité"
                    value={editingTier.maxDiscountHTG || ''}
                    onChange={e => setEditingTier({ ...editingTier, maxDiscountHTG: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="tierActiveCheck"
                  checked={editingTier.isActive !== false}
                  onChange={e => setEditingTier({ ...editingTier, isActive: e.target.checked })}
                  className="rounded bg-slate-900 border-slate-700 text-cyan-500"
                />
                <label htmlFor="tierActiveCheck" className="text-slate-300 select-none cursor-pointer">
                  Palier actif (émettra des coupons si le client atteint le seuil)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTier(null)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'saveTier'}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{actionLoading === 'saveTier' ? 'Sauvegarde...' : 'Enregistrer le Palier'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Section 2: Unlocked Rewards / Coupons Monitoring */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0e1422] border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white uppercase font-['Chakra_Petch'] flex items-center gap-2">
              <span>Récompenses Débloquées par les Clients</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-mono">
                {filteredRewards.length}
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Surveillance en temps réel des codes promo générés, de leur état d'utilisation et expiration.
            </p>
          </div>

          {/* Search & Status Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Rechercher code, email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex rounded-lg bg-slate-900 border border-slate-700 p-0.5 text-xs">
              {(['all', 'available', 'used', 'expired'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    statusFilter === st
                      ? 'bg-cyan-500 text-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st === 'all' ? 'Tous' : st === 'available' ? 'Disponibles' : st === 'used' ? 'Utilisés' : 'Expirés'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Rewards table */}
        {filteredRewards.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            Aucun coupon trouvé avec les critères actuels.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                  <th className="pb-2 font-medium">Code Promo</th>
                  <th className="pb-2 font-medium">Client</th>
                  <th className="pb-2 font-medium">Réduction</th>
                  <th className="pb-2 font-medium">Palier Déclenché</th>
                  <th className="pb-2 font-medium">Statut</th>
                  <th className="pb-2 font-medium">Débloqué le</th>
                  <th className="pb-2 font-medium">Expiration / Utilisation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredRewards.map(rw => (
                  <tr key={rw.id} className="hover:bg-slate-900/30 transition-colors">
                    <td className="py-2.5 font-mono font-black text-cyan-300">
                      {rw.code}
                    </td>
                    <td className="py-2.5 text-slate-300">
                      <div>{rw.userEmail}</div>
                      {rw.totalSpentHTG !== undefined && (
                        <div className="text-[10px] text-slate-500 font-mono">
                          Dépenses : {rw.totalSpentHTG.toLocaleString()} HTG
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 font-bold text-white font-mono">
                      -{rw.discountPercent}%
                    </td>
                    <td className="py-2.5 text-slate-400 font-mono">
                      {rw.thresholdHTG ? `${rw.thresholdHTG.toLocaleString()} HTG` : '-'}
                    </td>
                    <td className="py-2.5">
                      {rw.status === 'available' ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                          Disponible
                        </span>
                      ) : rw.status === 'used' ? (
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold">
                          Utilisé {rw.usedAtOrderId ? `#${rw.usedAtOrderId.substring(0, 8)}` : ''}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 text-[10px] font-bold">
                          Expiré
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-slate-400 font-mono text-[11px]">
                      {new Date(rw.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="py-2.5 text-slate-400 font-mono text-[11px]">
                      {rw.status === 'used' && rw.usedAt
                        ? `Utilisé le ${new Date(rw.usedAt).toLocaleDateString('fr-FR')}`
                        : `Expire le ${new Date(rw.expiresAt).toLocaleDateString('fr-FR')}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
