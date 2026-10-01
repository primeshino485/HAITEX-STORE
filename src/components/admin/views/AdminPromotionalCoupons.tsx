import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api.js';
import { PromotionalCoupon, PromotionalCouponUsage, PromotionalCouponStatus } from '../../../types.js';
import {
  Tag,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Copy,
  Check,
  Percent,
  TrendingUp,
  Users,
  ShieldCheck,
  X,
  Calendar,
  Layers,
  ChevronRight,
  RotateCcw
} from 'lucide-react';

export const AdminPromotionalCoupons: React.FC = () => {
  const [coupons, setCoupons] = useState<PromotionalCoupon[]>([]);
  const [stats, setStats] = useState<{
    totalCoupons: number;
    activeCoupons: number;
    expiredCoupons: number;
    exhaustedCoupons: number;
    disabledCoupons: number;
    totalRedemptions: number;
    totalDiscountsGivenHTG: number;
  }>({
    totalCoupons: 0,
    activeCoupons: 0,
    expiredCoupons: 0,
    exhaustedCoupons: 0,
    disabledCoupons: 0,
    totalRedemptions: 0,
    totalDiscountsGivenHTG: 0,
  });

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Copy code feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modal Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditingNew, setIsEditingNew] = useState(true);
  const [formData, setFormData] = useState<{
    id?: string;
    campaignName: string;
    code: string;
    description: string;
    discountPercent: number;
    minOrderAmountHTG: number;
    maxDiscountHTG: string;
    maxGlobalUses: string;
    maxUsesPerCustomer: number;
    startDate: string;
    expiresAt: string;
    isActive: boolean;
  }>({
    campaignName: '',
    code: '',
    description: '',
    discountPercent: 10,
    minOrderAmountHTG: 0,
    maxDiscountHTG: '',
    maxGlobalUses: '',
    maxUsesPerCustomer: 1,
    startDate: '',
    expiresAt: '',
    isActive: true,
  });

  // Usages Modal
  const [selectedCouponForUsages, setSelectedCouponForUsages] = useState<PromotionalCoupon | null>(null);
  const [couponUsages, setCouponUsages] = useState<PromotionalCouponUsage[]>([]);
  const [loadingUsages, setLoadingUsages] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.admin.getPromotionalCoupons();
      setCoupons(res.coupons || []);
      setStats(res.stats || {
        totalCoupons: 0,
        activeCoupons: 0,
        expiredCoupons: 0,
        exhaustedCoupons: 0,
        disabledCoupons: 0,
        totalRedemptions: 0,
        totalDiscountsGivenHTG: 0,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors du chargement des coupons promotionnels.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleOpenCreateModal = () => {
    setIsEditingNew(true);
    setFormData({
      campaignName: '',
      code: '',
      description: '',
      discountPercent: 15,
      minOrderAmountHTG: 0,
      maxDiscountHTG: '',
      maxGlobalUses: '',
      maxUsesPerCustomer: 1,
      startDate: '',
      expiresAt: '',
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (c: PromotionalCoupon) => {
    setIsEditingNew(false);
    setFormData({
      id: c.id,
      campaignName: c.campaignName || '',
      code: c.code,
      description: c.description || '',
      discountPercent: c.discountPercent,
      minOrderAmountHTG: c.minOrderAmountHTG || 0,
      maxDiscountHTG: c.maxDiscountHTG ? String(c.maxDiscountHTG) : '',
      maxGlobalUses: c.maxGlobalUses ? String(c.maxGlobalUses) : '',
      maxUsesPerCustomer: c.maxUsesPerCustomer || 1,
      startDate: c.startDate ? c.startDate.slice(0, 16) : '',
      expiresAt: c.expiresAt ? c.expiresAt.slice(0, 16) : '',
      isActive: c.isActive,
    });
    setIsModalOpen(true);
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.campaignName.trim()) {
      alert('Veuillez renseigner le nom de la campagne.');
      return;
    }
    const cleanCode = formData.code.trim().toUpperCase().replace(/\s+/g, '');
    if (!cleanCode || cleanCode.length < 3) {
      alert('Le code coupon doit comporter au moins 3 caractères alphanumériques.');
      return;
    }
    if (formData.discountPercent < 1 || formData.discountPercent > 100) {
      alert('Le pourcentage de remise doit être compris entre 1% et 100%.');
      return;
    }

    const payload = {
      campaignName: formData.campaignName.trim(),
      code: cleanCode,
      description: formData.description.trim() || undefined,
      discountPercent: Number(formData.discountPercent),
      minOrderAmountHTG: Number(formData.minOrderAmountHTG || 0),
      maxDiscountHTG: formData.maxDiscountHTG ? Number(formData.maxDiscountHTG) : undefined,
      maxGlobalUses: formData.maxGlobalUses ? Number(formData.maxGlobalUses) : undefined,
      maxUsesPerCustomer: Number(formData.maxUsesPerCustomer || 1),
      startDate: formData.startDate ? new Date(formData.startDate).toISOString() : undefined,
      expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : undefined,
      isActive: formData.isActive,
    };

    setActionLoading('saving');
    try {
      if (isEditingNew) {
        await api.admin.createPromotionalCoupon(payload);
        showSuccess(`Coupon promotionnel "${cleanCode}" créé avec succès !`);
      } else if (formData.id) {
        await api.admin.updatePromotionalCoupon(formData.id, payload);
        showSuccess(`Coupon promotionnel "${cleanCode}" mis à jour avec succès !`);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de l\'enregistrement du coupon.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleActive = async (coupon: PromotionalCoupon) => {
    setActionLoading(`toggle-${coupon.id}`);
    try {
      const updated = await api.admin.togglePromotionalCoupon(coupon.id);
      showSuccess(`Coupon "${updated.code}" ${updated.isActive ? 'activé' : 'désactivé'}.`);
      setCoupons(prev => prev.map(c => c.id === updated.id ? updated : c));
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la modification du statut.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteCoupon = async (coupon: PromotionalCoupon) => {
    const confirmMsg = `Êtes-vous sûr de vouloir supprimer définitivement le coupon "${coupon.code}" ?\n\nAttention : Si ce coupon a déjà été utilisé dans des commandes antérieures, la suppression sera bloquée pour préserver l'historique comptable.`;
    if (!window.confirm(confirmMsg)) return;

    setActionLoading(`delete-${coupon.id}`);
    try {
      await api.admin.deletePromotionalCoupon(coupon.id);
      showSuccess(`Coupon "${coupon.code}" supprimé avec succès.`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la suppression.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewUsages = async (coupon: PromotionalCoupon) => {
    setSelectedCouponForUsages(coupon);
    setLoadingUsages(true);
    try {
      const usages = await api.admin.getPromotionalCouponUsages(coupon.id);
      setCouponUsages(usages);
    } catch (err: any) {
      alert(err.message || 'Erreur lors du chargement des utilisations.');
    } finally {
      setLoadingUsages(false);
    }
  };

  const handleTriggerAutoRefunds = async () => {
    if (!window.confirm('Vérifier et exécuter le remboursement automatique pour toutes les commandes en attente (PROCESSING) depuis plus de 24 heures ?')) {
      return;
    }
    setActionLoading('auto-refund');
    try {
      const res = await api.admin.processAutoRefunds24h();
      showSuccess(res.message);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Erreur lors du traitement des remboursements automatiques.');
    } finally {
      setActionLoading(null);
    }
  };

  // Filtered coupons
  const filteredCoupons = coupons.filter(c => {
    const matchSearch =
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.campaignName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.description || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchSearch) return false;

    if (statusFilter === 'ACTIVE') return c.status === 'ACTIVE';
    if (statusFilter === 'DISABLED') return c.status === 'DISABLED';
    if (statusFilter === 'EXHAUSTED') return c.status === 'EXHAUSTED';
    if (statusFilter === 'EXPIRED') return c.status === 'EXPIRED';

    return true;
  });

  const getStatusBadge = (status: PromotionalCouponStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
            <CheckCircle2 className="w-3 h-3" />
            <span>Actif</span>
          </span>
        );
      case 'DISABLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-700/40 border border-slate-600/40 text-slate-400 text-[11px] font-bold">
            <X className="w-3 h-3" />
            <span>Désactivé</span>
          </span>
        );
      case 'EXHAUSTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[11px] font-bold">
            <AlertCircle className="w-3 h-3" />
            <span>Épuisé</span>
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[11px] font-bold">
            <Clock className="w-3 h-3" />
            <span>Expiré</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-slate-900 to-indigo-950/30 border border-cyan-500/30 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/20">
            <Tag className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white font-['Chakra_Petch'] uppercase tracking-wider">
                Coupons Promotionnels Admin
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold border border-cyan-500/30 uppercase">
                Marketing & Campagnes
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Créez et pilotez vos offres promotionnelles indépendantes, configurez les plafonds et suivez l'historique d'utilisation.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleTriggerAutoRefunds}
            disabled={actionLoading === 'auto-refund'}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition-all cursor-pointer shadow-sm"
            title="Exécute les remboursements de commandes en attente depuis plus de 24h"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${actionLoading === 'auto-refund' ? 'animate-spin' : ''}`} />
            <span>Remboursement Auto 24h</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-cyan-500/20"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Nouveau Coupon</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Stats Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Total Coupons</span>
            <Tag className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <p className="text-2xl font-black text-white font-mono">{stats.totalCoupons}</p>
          <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
            <span>{stats.activeCoupons} actifs actuellement</span>
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Épuisés / Expirés</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <p className="text-2xl font-black text-amber-400 font-mono">
            {stats.exhaustedCoupons + stats.expiredCoupons}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">
            {stats.exhaustedCoupons} épuisés • {stats.expiredCoupons} expirés
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Utilisations Totales</span>
            <Users className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <p className="text-2xl font-black text-indigo-400 font-mono">
            {stats.totalRedemptions}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">
            Commandes ayant bénéficié d'un coupon
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Remises Accordées</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <p className="text-xl font-black text-emerald-400 font-mono">
            {stats.totalDiscountsGivenHTG.toLocaleString()} <span className="text-xs">HTG</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-1">
            Économies totales offertes aux clients
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher par code ou campagne..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-transparent text-slate-300 text-xs px-2 py-1 focus:outline-none cursor-pointer"
            >
              <option value="all">Tous les statuts ({coupons.length})</option>
              <option value="ACTIVE">Actifs ({stats.activeCoupons})</option>
              <option value="DISABLED">Désactivés ({stats.disabledCoupons})</option>
              <option value="EXHAUSTED">Épuisés ({stats.exhaustedCoupons})</option>
              <option value="EXPIRED">Expirés ({stats.expiredCoupons})</option>
            </select>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Actualiser la liste"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Coupons List */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-16 text-center text-slate-500 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
            Chargement des coupons promotionnels...
          </div>
        ) : filteredCoupons.length === 0 ? (
          <div className="py-16 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-slate-500 text-xs">
            <Tag className="w-8 h-8 mx-auto mb-2 opacity-30 text-cyan-400" />
            <p className="font-bold text-slate-400">Aucun coupon trouvé</p>
            <p className="text-[11px] mt-1">
              {searchQuery ? 'Aucun résultat ne correspond à votre recherche.' : 'Créez votre première offre promotionnelle en cliquant sur "Nouveau Coupon".'}
            </p>
          </div>
        ) : (
          filteredCoupons.map(coupon => {
            const hasMaxUses = typeof coupon.maxGlobalUses === 'number' && coupon.maxGlobalUses > 0;
            const currentUses = coupon.currentUses || 0;
            const usagePercent = hasMaxUses ? Math.min(100, Math.round((currentUses / coupon.maxGlobalUses!) * 100)) : 0;

            return (
              <div
                key={coupon.id}
                className={`p-4 rounded-2xl bg-slate-900 border transition-all hover:border-slate-700 ${
                  coupon.status === 'ACTIVE'
                    ? 'border-slate-800'
                    : coupon.status === 'EXHAUSTED'
                    ? 'border-amber-900/40 bg-amber-950/10'
                    : coupon.status === 'EXPIRED'
                    ? 'border-red-900/40 bg-red-950/10'
                    : 'border-slate-800/60 opacity-75'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Left info */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
                        <span className="font-mono font-black text-sm text-cyan-400 tracking-wider">
                          {coupon.code}
                        </span>
                        <button
                          onClick={() => handleCopyCode(coupon.code)}
                          className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title="Copier le code"
                        >
                          {copiedCode === coupon.code ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>

                      <span className="font-bold text-white text-xs">
                        {coupon.campaignName}
                      </span>

                      {getStatusBadge(coupon.status)}

                      <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[10px] font-bold">
                        -{coupon.discountPercent}%
                      </span>
                    </div>

                    {coupon.description && (
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {coupon.description}
                      </p>
                    )}

                    {/* Conditions metadata */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 pt-1">
                      <div>
                        <span className="text-slate-500">Minimum requis : </span>
                        <strong className="text-slate-300 font-mono">
                          {coupon.minOrderAmountHTG && coupon.minOrderAmountHTG > 0
                            ? `${coupon.minOrderAmountHTG.toLocaleString()} HTG`
                            : 'Aucun'}
                        </strong>
                      </div>

                      {coupon.maxDiscountHTG && (
                        <div>
                          <span className="text-slate-500">Plafond remise : </span>
                          <strong className="text-slate-300 font-mono">
                            {coupon.maxDiscountHTG.toLocaleString()} HTG
                          </strong>
                        </div>
                      )}

                      <div>
                        <span className="text-slate-500">Limite / client : </span>
                        <strong className="text-slate-300 font-mono">
                          {coupon.maxUsesPerCustomer ? `${coupon.maxUsesPerCustomer}x` : '1x'}
                        </strong>
                      </div>

                      {coupon.expiresAt && (
                        <div>
                          <span className="text-slate-500">Expiration : </span>
                          <strong className={`font-mono ${new Date(coupon.expiresAt) < new Date() ? 'text-red-400' : 'text-slate-300'}`}>
                            {new Date(coupon.expiresAt).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </strong>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Middle Usage Progress */}
                  <div className="w-full lg:w-48 bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400">Utilisations :</span>
                      <span className="font-mono font-bold text-white">
                        {currentUses} {hasMaxUses ? `/ ${coupon.maxGlobalUses}` : '(Illimité)'}
                      </span>
                    </div>

                    {hasMaxUses ? (
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            usagePercent >= 100
                              ? 'bg-amber-500'
                              : usagePercent > 80
                              ? 'bg-amber-400'
                              : 'bg-cyan-500'
                          }`}
                          style={{ width: `${usagePercent}%` }}
                        />
                      </div>
                    ) : (
                      <div className="w-full h-1 bg-cyan-500/20 rounded-full" />
                    )}

                    <div className="text-right">
                      <button
                        onClick={() => handleViewUsages(coupon)}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                      >
                        Voir les commandes ({currentUses})
                      </button>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 self-end lg:self-center">
                    {/* Toggle activation */}
                    <button
                      onClick={() => handleToggleActive(coupon)}
                      disabled={actionLoading === `toggle-${coupon.id}`}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                        coupon.isActive
                          ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                          : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                      }`}
                      title={coupon.isActive ? 'Désactiver le coupon' : 'Activer le coupon'}
                    >
                      {coupon.isActive ? 'Actif' : 'Inactif'}
                    </button>

                    {/* Edit button */}
                    <button
                      onClick={() => handleOpenEditModal(coupon)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700"
                      title="Modifier les paramètres"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={() => handleDeleteCoupon(coupon)}
                      disabled={actionLoading === `delete-${coupon.id}`}
                      className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors cursor-pointer"
                      title="Supprimer (si aucune commande associée)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Create / Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-black text-white font-['Chakra_Petch'] uppercase tracking-wider">
                  {isEditingNew ? 'Créer un Coupon Promotionnel' : 'Modifier le Coupon'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCoupon} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Campaign Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    Nom de la Campagne *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.campaignName}
                    onChange={e => setFormData({ ...formData, campaignName: e.target.value })}
                    placeholder="Ex : Soldes d'Automne"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none font-medium"
                  />
                </div>

                {/* Coupon Code */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    Code Coupon *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                    placeholder="Ex : PROMO20"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none font-mono uppercase font-bold"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  Description / Détails de l'offre
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ex : Réduction spéciale réservée aux 50 premières recharges"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Discount % */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    Remise (%) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min={1}
                      max={100}
                      value={formData.discountPercent}
                      onChange={e => setFormData({ ...formData, discountPercent: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono font-bold"
                    />
                    <Percent className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Min Order Amount */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    Achat minimum (HTG)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.minOrderAmountHTG}
                    onChange={e => setFormData({ ...formData, minOrderAmountHTG: Number(e.target.value) })}
                    placeholder="0 = Sans min"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono"
                  />
                </div>

                {/* Max Discount Cap */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    Plafond remise (HTG)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.maxDiscountHTG}
                    onChange={e => setFormData({ ...formData, maxDiscountHTG: e.target.value })}
                    placeholder="Vide = Illimité"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Max Global Uses */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    Limite globale d'utilisations
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.maxGlobalUses}
                    onChange={e => setFormData({ ...formData, maxGlobalUses: e.target.value })}
                    placeholder="Ex : 50 (Vide = Illimité)"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono"
                  />
                </div>

                {/* Max Uses Per Customer */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    Limite par client
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.maxUsesPerCustomer}
                    onChange={e => setFormData({ ...formData, maxUsesPerCustomer: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Start Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    Date de Début (Optionnel)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.startDate}
                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono"
                  />
                </div>

                {/* End Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    Date d'Expiration (Optionnel)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.expiresAt}
                    onChange={e => setFormData({ ...formData, expiresAt: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="text-xs font-bold text-white block">
                    Statut Actif
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Le coupon peut être utilisé par les clients immédiatement si la date est valide.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-500 border-slate-700 bg-slate-900 cursor-pointer"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'saving'}
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-wider cursor-pointer transition-all shadow-lg shadow-cyan-500/20"
                >
                  {actionLoading === 'saving' ? 'Enregistrement...' : isEditingNew ? 'Créer le Coupon' : 'Sauvegarder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Usages Modal */}
      {selectedCouponForUsages && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Tag className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-base font-black text-white font-['Chakra_Petch'] uppercase tracking-wider">
                    Historique du Coupon : {selectedCouponForUsages.code}
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Campagne : {selectedCouponForUsages.campaignName} • {selectedCouponForUsages.discountPercent}% de réduction
                </p>
              </div>
              <button
                onClick={() => setSelectedCouponForUsages(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingUsages ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-cyan-400" />
                Chargement de l'historique...
              </div>
            ) : couponUsages.length === 0 ? (
              <div className="py-12 text-center rounded-2xl bg-slate-950 border border-slate-800 text-slate-500 text-xs">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
                <p className="font-bold text-slate-400">Aucune utilisation enregistrée</p>
                <p className="text-[11px] mt-1">
                  Ce coupon n'a pas encore été appliqué dans une commande.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs text-slate-400 flex justify-between items-center px-1">
                  <span>Total utilisations : <strong className="text-white">{couponUsages.length}</strong></span>
                  <span>Total remises : <strong className="text-emerald-400">{couponUsages.reduce((s, u) => s + (u.discountHTG || 0), 0).toLocaleString()} HTG</strong></span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Commande</th>
                        <th className="py-2.5 px-3">Client</th>
                        <th className="py-2.5 px-3">Sous-total</th>
                        <th className="py-2.5 px-3">Remise</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {couponUsages.map(usage => (
                        <tr key={usage.id} className="hover:bg-slate-800/40">
                          <td className="py-2 px-3 font-mono font-bold text-white">
                            #{usage.orderNumber}
                          </td>
                          <td className="py-2 px-3">
                            <div className="font-medium text-white">{usage.userName}</div>
                            <div className="text-[10px] text-slate-400">{usage.userEmail}</div>
                          </td>
                          <td className="py-2 px-3 font-mono">
                            {usage.subtotalHTG.toLocaleString()} HTG
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-emerald-400">
                            -{usage.discountHTG.toLocaleString()} HTG
                          </td>
                          <td className="py-2 px-3 text-[11px] text-slate-400">
                            {new Date(usage.usedAt).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="py-2 px-3">
                            {usage.isRefunded ? (
                              <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[10px] font-bold border border-red-500/30">
                                Remboursée
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                                Validée
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="text-right pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelectedCouponForUsages(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
