import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api.js';
import { WalletTransaction } from '../../../types.js';
import { Search, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

export const AdminTransactions: React.FC = () => {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchTxs = async () => {
      setLoading(true);
      try {
        const data = await api.admin.getTransactions();
        setTransactions(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTxs();
  }, []);

  const filtered = transactions.filter(t => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const refStr = t.referenceId || (t as any).reference || '';
    const descStr = t.description || '';
    const userStr = t.userId || '';
    return refStr.toLowerCase().includes(q) || descStr.toLowerCase().includes(q) || userStr.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div>
        <h2 className="text-sm sm:text-base font-black text-white font-['Chakra_Petch'] uppercase tracking-wider">
          Journal Général des Transactions (HTG)
        </h2>
        <p className="text-xs text-slate-400">
          Traçabilité complète de tous les dépôts, achats, remboursements et ajustements
        </p>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par référence, description ou client..."
          className="w-full bg-[#0e1422] border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        />
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-500 text-xs">Chargement des transactions...</div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400">
          Aucune transaction enregistrée.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(tx => {
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
                    <h4 className="font-bold text-white text-xs">{tx.description}</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                      Réf : {tx.referenceId || (tx as any).reference || 'N/A'} • Client : {(tx.userId || '').slice(0, 8)}... • {new Date(tx.createdAt).toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`font-black font-['Chakra_Petch'] text-xs sm:text-sm ${
                    isPositive ? 'text-emerald-400' : 'text-slate-200'
                  }`}>
                    {isPositive ? '+' : '-'}{Math.abs(tx.amountHTG ?? 0).toLocaleString()} HTG
                  </span>
                  <span className="block text-[9px] uppercase font-bold text-slate-500 mt-0.5">
                    {tx.type}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
