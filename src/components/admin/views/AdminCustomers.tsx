import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api.js';
import { User } from '../../../types.js';
import { Users, Search, Wallet, Ban, CheckCircle, PlusCircle, MinusCircle, X } from 'lucide-react';

type CustomerWithMeta = User & {
  walletBalance: number;
  ordersCount: number;
  totalSpentHTG: number;
};

export const AdminCustomers: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [adjustCustomer, setAdjustCustomer] = useState<CustomerWithMeta | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number>(500);
  const [adjustType, setAdjustType] = useState<'credit' | 'debit'>('credit');
  const [adjustReason, setAdjustReason] = useState('Recharge promotionnelle ou correction manuelle');
  const [adjustLoading, setAdjustLoading] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const data = await api.admin.getCustomers();
      setCustomers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleToggleStatus = async (customer: CustomerWithMeta) => {
    const newStatus = customer.status === 'blocked' ? 'active' : 'blocked';
    if (!confirm(`Voulez-vous ${newStatus === 'blocked' ? 'bloquer' : 'débloquer'} le compte de "${customer.name}" ?`)) return;
    try {
      await api.admin.updateCustomerStatus(customer.id, newStatus);
      await fetchCustomers();
    } catch (err: any) {
      alert(err.message || 'Erreur');
    }
  };

  const handleAdjustWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustCustomer) return;
    const finalAmount = adjustType === 'credit' ? Math.abs(adjustAmount) : -Math.abs(adjustAmount);
    setAdjustLoading(true);
    try {
      await api.admin.adjustWallet(adjustCustomer.id, finalAmount, adjustReason);
      setAdjustCustomer(null);
      await fetchCustomers();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de l\'ajustement du portefeuille');
    } finally {
      setAdjustLoading(false);
    }
  };

  const filtered = customers.filter(c => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div>
        <h2 className="text-sm sm:text-base font-black text-white font-['Chakra_Petch'] uppercase tracking-wider">
          Gestion des Clients & Soldes Portefeuilles
        </h2>
        <p className="text-xs text-slate-400">
          Contrôlez les comptes utilisateurs, leurs soldes en Gourdes et leurs permissions
        </p>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom ou email..."
          className="w-full bg-[#0e1422] border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        />
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-500 text-xs">Chargement des clients...</div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400">
          Aucun client trouvé.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(cust => (
            <div
              key={cust.id}
              className="p-3.5 rounded-xl bg-[#0e1422] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-sm">
                  {(cust.name || cust.email || 'C').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-white text-xs sm:text-sm">{cust.name}</h4>
                    {cust.role === 'ADMIN' && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold uppercase">
                        Admin
                      </span>
                    )}
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                      cust.status === 'blocked' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {cust.status === 'blocked' ? 'Bloqué' : 'Actif'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">{cust.email}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Commandes : {cust.ordersCount ?? 0} • Total dépensé : {(cust.totalSpentHTG ?? 0).toLocaleString()} HTG
                  </p>
                </div>
              </div>

              {/* Balance & Actions */}
              <div className="flex items-center justify-between sm:justify-end gap-3 self-end sm:self-center">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase">Solde Portefeuille</span>
                  <span className="font-black text-cyan-400 font-['Chakra_Petch'] text-sm sm:text-base">
                    {(cust.walletBalance ?? 0).toLocaleString()} HTG
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setAdjustCustomer(cust);
                      setAdjustAmount(500);
                      setAdjustType('credit');
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500 hover:text-black text-cyan-300 text-xs font-bold transition-colors flex items-center gap-1"
                    title="Ajuster le solde"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Ajuster</span>
                  </button>

                  {cust.role !== 'ADMIN' && (
                    <button
                      onClick={() => handleToggleStatus(cust)}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        cust.status === 'blocked'
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25'
                          : 'bg-red-500/15 border-red-500/40 text-red-400 hover:bg-red-500/25'
                      }`}
                      title={cust.status === 'blocked' ? 'Débloquer le compte' : 'Bloquer le compte'}
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Adjust Wallet Modal */}
      {adjustCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#0e1422] border border-cyan-500/30 rounded-2xl p-5 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <h3 className="text-sm font-bold text-white font-['Chakra_Petch'] uppercase">
                Ajuster Portefeuille Client
              </h3>
              <button onClick={() => setAdjustCustomer(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-slate-300 mb-1">
              Client : <span className="text-white font-bold">{adjustCustomer.name}</span>
            </p>
            <p className="text-slate-400 mb-4">
              Solde actuel : <span className="font-mono font-bold text-cyan-400">{(adjustCustomer.walletBalance ?? 0).toLocaleString()} HTG</span>
            </p>

            <form onSubmit={handleAdjustWallet} className="space-y-3">
              <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setAdjustType('credit')}
                  className={`flex-1 py-1.5 font-bold rounded-lg ${
                    adjustType === 'credit' ? 'bg-emerald-500 text-black' : 'text-slate-400'
                  }`}
                >
                  + Créditer (Ajouter)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType('debit')}
                  className={`flex-1 py-1.5 font-bold rounded-lg ${
                    adjustType === 'debit' ? 'bg-red-500 text-white' : 'text-slate-400'
                  }`}
                >
                  - Débiter (Retirer)
                </button>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Montant en Gourdes (HTG) *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={adjustAmount}
                  onChange={e => setAdjustAmount(Math.abs(parseFloat(e.target.value) || 0))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Raison administrative (Audit) *</label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  placeholder="Ex: Correction après recharge manuelle"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustCustomer(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={adjustLoading}
                  className="px-4 py-1.5 rounded-lg bg-cyan-500 text-black font-bold uppercase"
                >
                  {adjustLoading ? 'Validation...' : 'Appliquer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
