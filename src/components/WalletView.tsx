import React, { useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext.js';
import { useI18n } from '../context/I18nContext.js';
import { api } from '../lib/api.js';
import { WalletTransaction, RechargeRequest } from '../types.js';
import { 
  Wallet as WalletIcon, 
  Smartphone, 
  RefreshCw, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Copy,
  Check,
  ShieldCheck
} from 'lucide-react';

export const WalletView: React.FC = () => {
  const { wallet, user, setIsRechargeModalOpen, setIsAuthModalOpen, refreshUserAndWallet } = useStore();
  const { t, language } = useI18n();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [recharges, setRecharges] = useState<RechargeRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedNum, setCopiedNum] = useState(false);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [txs, reqs] = await Promise.all([
        api.getWalletTransactions(),
        api.getMyRecharges(),
      ]);
      setTransactions(txs);
      setRecharges(reqs);
      await refreshUserAndWallet();
    } catch (err) {
      console.error('Failed to load wallet data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  if (!user) {
    return (
      <div className="py-20 text-center max-w-sm mx-auto px-4">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto mb-4">
          <WalletIcon className="w-8 h-8" />
        </div>
        <h2 className="text-base font-black text-white font-['Chakra_Petch'] uppercase">
          {t.wallet.title}
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          {t.wallet.subtitle}
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

  const copyNatcash = () => {
    navigator.clipboard.writeText('43854650');
    setCopiedNum(true);
    setTimeout(() => setCopiedNum(false), 2000);
  };

  const dateLocale = language === 'en' ? 'en-US' : language === 'ht' ? 'fr-HT' : 'fr-FR';

  return (
    <div className="pb-24 space-y-5 animate-in fade-in duration-200">
      {/* Big Balance Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-[#0a1324] to-slate-950 border border-cyan-500/30 p-5 sm:p-6 shadow-2xl">
        <div className="absolute top-0 right-0 w-56 h-56 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 tracking-wider">
              {t.wallet.currentBalance} (HTG)
            </span>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            title={t.common.refresh}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>

        {/* Amount */}
        <div className="mb-6">
          <span className="text-3xl sm:text-4xl font-black text-white font-['Chakra_Petch'] tracking-tight drop-shadow-md">
            {(wallet?.balanceHTG ?? 0).toLocaleString()}{' '}
            <span className="text-xl sm:text-2xl text-cyan-400 font-bold">HTG</span>
          </span>
          <p className="text-xs text-slate-400 mt-1">
            {t.wallet.subtitle}
          </p>
        </div>

        {/* Big CTA Button */}
        <button
          onClick={() => setIsRechargeModalOpen(true)}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-cyan-400 to-emerald-400 hover:opacity-95 text-black font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl shadow-cyan-500/25 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
        >
          <Smartphone className="w-4 h-4 fill-black" />
          <span>{t.wallet.depositTitle}</span>
        </button>
      </div>

      {/* NatCash Fast Info Box */}
      <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-white">{t.recharge.agentNumber} :</span>
            <span className="font-mono text-cyan-400 text-xs font-black ml-1.5">43854650</span>
          </div>
        </div>
        <button
          onClick={copyNatcash}
          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
        >
          {copiedNum ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copiedNum ? t.common.copied : t.common.copy}</span>
        </button>
      </div>

      {/* Pending Recharges Section */}
      {recharges.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 font-['Chakra_Petch']">
            {t.wallet.recharges}
          </h2>
          <div className="space-y-2">
            {recharges.map(req => (
              <div
                key={req.id}
                className="p-3 rounded-xl bg-[#0e1422] border border-slate-800 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white font-mono">
                      +{ (req.amountHTG ?? 0).toLocaleString() } HTG
                    </span>
                    {req.status === 'PENDING' && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3 animate-spin" />
                        {t.common.pending}
                      </span>
                    )}
                    {req.status === 'APPROVED' && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {t.common.approved}
                      </span>
                    )}
                    {req.status === 'REJECTED' && (
                      <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 text-[10px] font-bold flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        {t.common.rejected}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 font-mono">
                    Réf SMS : {req.transcode} • {new Date(req.createdAt).toLocaleDateString(dateLocale)}
                  </p>
                  {req.adminNote && (
                    <p className="text-[10px] text-slate-300 mt-0.5 italic">
                      Note : {req.adminNote}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transactions History */}
      <div className="space-y-2">
        <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 font-['Chakra_Petch']">
          {t.wallet.transactions}
        </h2>

        {transactions.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-xs text-slate-500">
            {t.wallet.noTransactions}
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map(tx => {
              const isPositive = tx.type === 'DEPOSIT' || tx.type === 'REFUND' || tx.amountHTG > 0;
              return (
                <div
                  key={tx.id}
                  className="p-3 rounded-xl bg-[#0e1422] border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {isPositive ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-xs">
                        {tx.description}
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(tx.createdAt).toLocaleDateString(dateLocale, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })} • Réf : {tx.reference}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`font-black font-['Chakra_Petch'] text-xs sm:text-sm ${
                      isPositive ? 'text-emerald-400' : 'text-slate-200'
                    }`}>
                      {isPositive ? '+' : '-'}{Math.abs(tx.amountHTG ?? 0).toLocaleString()} HTG
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
