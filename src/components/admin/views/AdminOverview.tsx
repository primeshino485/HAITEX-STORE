import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api.js';
import { AdminStats } from '../../../types.js';
import { useI18n } from '../../../context/I18nContext.js';
import { 
  TrendingUp, 
  ShoppingBag, 
  Users, 
  Smartphone, 
  AlertTriangle, 
  RefreshCw,
  Wallet,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

export const AdminOverview: React.FC<{ onNavigate: (section: string) => void }> = ({ onNavigate }) => {
  const { t, language } = useI18n();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.admin.getStats();
      setStats(data);
    } catch (err: any) {
      console.error('Failed to load admin stats:', err);
      setError(err.message || (language === 'ht' ? 'Enposib pou chaje estatistik yo.' : language === 'en' ? 'Failed to load metrics.' : 'Impossible de charger les métriques.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading && !stats) {
    return (
      <div className="py-16 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
        <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <span>{language === 'ht' ? 'Chajman estatistik yo...' : language === 'en' ? 'Loading metrics...' : 'Chargement des métriques...'}</span>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="py-12 px-4 max-w-md mx-auto text-center space-y-4">
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
          <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-white mb-1">
            {language === 'ht' ? 'Erè nan chajman estatistik yo' : language === 'en' ? 'Error loading statistics' : 'Erreur de chargement des statistiques'}
          </h4>
          <p className="text-xs text-rose-200/90">{error}</p>
        </div>
        <button
          onClick={fetchStats}
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-colors shadow-lg shadow-amber-500/20 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {language === 'ht' ? 'Re-eseye' : language === 'en' ? 'Retry' : 'Réessayer'}
        </button>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Pending Recharges Alert if any */}
      {stats.pendingRechargesCount > 0 && (
        <div 
          onClick={() => onNavigate('recharges')}
          className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-300 flex items-center justify-between cursor-pointer hover:bg-amber-500/20 transition-colors shadow-lg shadow-amber-500/10"
        >
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-5 h-5 text-amber-400 animate-bounce" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider">
                {stats.pendingRechargesCount} {language === 'ht' ? 'Rechaj NatCash k ap tann' : language === 'en' ? 'Pending NatCash top-up(s)' : `Recharge${stats.pendingRechargesCount > 1 ? 's' : ''} NatCash en attente`}
              </h4>
              <p className="text-[10px] text-amber-400/90">
                {language === 'ht' ? 'Gen kliyan k ap tann validasyon transfè Goud yo.' : language === 'en' ? 'Customers are waiting for confirmation of their Gourdes transfer.' : 'Des clients attendent la validation de leur transfert en Gourdes.'}
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-black font-extrabold text-[10px] uppercase">
            {language === 'ht' ? 'Verifye' : language === 'en' ? 'Review' : 'Vérifier'}
          </span>
        </div>
      )}

      {/* Out of Stock Alert if any */}
      {stats.outOfStockCount > 0 && (
        <div 
          onClick={() => onNavigate('products')}
          className="p-3.5 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-300 flex items-center justify-between cursor-pointer hover:bg-red-500/20 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider">
                {stats.outOfStockCount} {language === 'ht' ? 'Pwodui ki pa nan stòk' : language === 'en' ? 'Product(s) out of stock' : `Produit${stats.outOfStockCount > 1 ? 's' : ''} en rupture de stock`}
              </h4>
              <p className="text-[10px] text-red-400/80">
                {language === 'ht' ? 'Ajoute nouvo kòd pou relanse vant yo.' : language === 'en' ? 'Add new codes to reactivate sales.' : 'Ajoutez de nouveaux codes pour réactiver les ventes.'}
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-red-500 text-white font-extrabold text-[10px] uppercase">
            {language === 'ht' ? 'Jere' : language === 'en' ? 'Manage' : 'Gérer'}
          </span>
        </div>
      )}

      {/* Top Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Total Sales */}
        <div className="p-3.5 rounded-2xl bg-[#0e1422] border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">{t.admin.totalSales}</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-base sm:text-lg font-black text-white font-['Chakra_Petch']">
            {(stats.totalSalesHTG ?? 0).toLocaleString()} <span className="text-[11px] text-emerald-400 font-bold">HTG</span>
          </p>
          <p className="text-[10px] text-slate-500">{stats.ordersCount ?? 0} {language === 'ht' ? 'kòmand regle' : language === 'en' ? 'paid orders' : 'commandes réglées'}</p>
        </div>

        {/* Total Recharged */}
        <div className="p-3.5 rounded-2xl bg-[#0e1422] border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">{t.admin.tabRecharges}</span>
            <Smartphone className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-base sm:text-lg font-black text-white font-['Chakra_Petch']">
            {(stats.totalRechargesHTG ?? 0).toLocaleString()} <span className="text-[11px] text-cyan-400 font-bold">HTG</span>
          </p>
          <p className="text-[10px] text-slate-500">NatCash 43854650</p>
        </div>

        {/* Total Customers */}
        <div className="p-3.5 rounded-2xl bg-[#0e1422] border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">{t.admin.customersCount}</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-base sm:text-lg font-black text-white font-['Chakra_Petch']">
            {stats.customersCount}
          </p>
          <p className="text-[10px] text-slate-500">{language === 'ht' ? 'Pòtfèy aktif' : language === 'en' ? 'Active wallets' : 'Portefeuilles actifs'}</p>
        </div>

        {/* Total Catalog Products */}
        <div className="p-3.5 rounded-2xl bg-[#0e1422] border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">{t.admin.productsCount}</span>
            <ShoppingBag className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-base sm:text-lg font-black text-white font-['Chakra_Petch']">
            {stats.productsCount} <span className="text-xs text-slate-400 font-normal">{language === 'ht' ? 'atik' : language === 'en' ? 'items' : 'articles'}</span>
          </p>
          <p className="text-[10px] text-slate-500">Gaming, Streaming, Panels</p>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="p-4 rounded-2xl bg-[#0e1422] border border-slate-800 space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          {language === 'ht' ? 'Aksyon Administrasyon Priyoritè' : language === 'en' ? 'Priority Administration Actions' : 'Actions d\'Administration Prioritaires'}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <button
            onClick={() => onNavigate('recharges')}
            className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left space-y-1 transition-colors group cursor-pointer"
          >
            <span className="font-bold text-cyan-400 block group-hover:translate-x-0.5 transition-transform">
              {language === 'ht' ? 'Rechaj NatCash →' : language === 'en' ? 'NatCash Top-ups →' : 'Recharges NatCash →'}
            </span>
            <span className="text-[10px] text-slate-400 block">
              {language === 'ht' ? 'Valide transfè manyèl yo' : language === 'en' ? 'Verify manual transfers' : 'Valider les transferts manuels'}
            </span>
          </button>

          <button
            onClick={() => onNavigate('products')}
            className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left space-y-1 transition-colors group cursor-pointer"
          >
            <span className="font-bold text-cyan-400 block group-hover:translate-x-0.5 transition-transform">
              {language === 'ht' ? 'Jere Stòk & Kòd yo →' : language === 'en' ? 'Manage Stock & Codes →' : 'Gérer les Stocks & Codes →'}
            </span>
            <span className="text-[10px] text-slate-400 block">
              {language === 'ht' ? 'Ajoute nouvo kòd dijital' : language === 'en' ? 'Add new digital codes' : 'Injecter de nouveaux codes'}
            </span>
          </button>

          <button
            onClick={() => onNavigate('media')}
            className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left space-y-1 transition-colors group cursor-pointer"
          >
            <span className="font-bold text-cyan-400 block group-hover:translate-x-0.5 transition-transform">
              {language === 'ht' ? 'Ajoute Imaj →' : language === 'en' ? 'Add Images →' : 'Ajouter des Images →'}
            </span>
            <span className="text-[10px] text-slate-400 block">
              {language === 'ht' ? 'Voye imaj depi sou telefòn' : language === 'en' ? 'Upload from your phone' : 'Téléverser depuis le téléphone'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
