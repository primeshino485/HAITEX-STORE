import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api.js';
import { PaymentMethodConfig } from '../../../types.js';
import { Smartphone, Check, ShieldCheck, Copy, Info, AlertTriangle } from 'lucide-react';

export const AdminPaymentMethods: React.FC = () => {
  const [methods, setMethods] = useState<PaymentMethodConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState<string | null>(null);

  const fetchMethods = async () => {
    setLoading(true);
    try {
      const data = await api.getPaymentMethods();
      setMethods(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMethods();
  }, []);

  const handleUpdate = async (key: string, updates: Partial<PaymentMethodConfig>) => {
    try {
      await api.admin.updatePaymentMethod(key as any, updates);
      setSavedSuccess(`Configuration ${key.toUpperCase()} enregistrée avec succès !`);
      setTimeout(() => setSavedSuccess(null), 3000);
      await fetchMethods();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la mise à jour');
    }
  };

  if (loading) {
    return <div className="py-16 text-center text-slate-500 text-xs">Chargement des modes de paiement...</div>;
  }

  const moncash = methods.find(m => m.key === 'moncash');
  const natcash = methods.find(m => m.key === 'natcash');

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div>
        <h2 className="text-sm sm:text-base font-black text-white font-['Chakra_Petch'] uppercase tracking-wider">
          Moyens de Paiement & Réception des Fonds
        </h2>
        <p className="text-xs text-slate-400">
          Gérez les coordonnées de réception MonCash et NatCash affichées aux clients pour les recharges de solde.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 flex-shrink-0" />
          <span>{savedSuccess}</span>
        </div>
      )}

      {/* MonCash Card (Primary) */}
      {moncash && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#0e1422] border border-red-500/40 space-y-4 shadow-xl shadow-red-500/5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center font-bold">
                MC
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white uppercase font-['Chakra_Petch']">
                    {moncash.name} (Paiement Réel Principal)
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold border border-red-500/30">
                    Officiel Haïti
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  Opérateur Digicel Haïti • Réseau de transfert mobile
                </span>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className={`text-xs font-semibold ${moncash.isActive ? 'text-emerald-400' : 'text-slate-400'}`}>
                {moncash.isActive ? 'Activé (Visible aux clients)' : 'Désactivé'}
              </span>
              <input
                type="checkbox"
                checked={moncash.isActive}
                onChange={e => handleUpdate('moncash', { isActive: e.target.checked })}
                className="w-4 h-4 rounded text-red-500 bg-slate-900 border-slate-700 cursor-pointer"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                Numéro MonCash de réception
              </label>
              <input
                type="text"
                defaultValue={moncash.phoneNumber || '34584287'}
                onBlur={e => handleUpdate('moncash', { phoneNumber: e.target.value.trim() })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm text-red-400 focus:border-red-500 outline-none"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Numéro auquel les clients doivent envoyer leur transfert MonCash.
              </p>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                Nom du bénéficiaire
              </label>
              <input
                type="text"
                defaultValue={moncash.recipientName || 'carlentz'}
                onBlur={e => handleUpdate('moncash', { recipientName: e.target.value.trim() })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm uppercase focus:border-red-500 outline-none"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Nom du titulaire du compte MonCash pour confirmer le destinataire.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1 text-xs">
              Instructions affichées au client
            </label>
            <input
              type="text"
              defaultValue={moncash.instructions || 'Transférez le montant au 34584287 (carlentz) puis indiquez le transcode SMS reçu.'}
              onBlur={e => handleUpdate('moncash', { instructions: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:border-red-500 outline-none"
            />
          </div>

          {/* Security & Validation Notice */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-[11px]">
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              <span>Protocole Strict de Sécurité MonCash : Mode Manuel & Anti-Doublon</span>
            </div>
            <ul className="text-[11px] text-slate-400 space-y-1 pl-4 list-disc">
              <li>
                <strong>Aucun crédit automatique :</strong> Lorsqu'un client soumet une demande, son solde reste inchangé et la demande passe au statut <span className="text-amber-400 font-mono font-bold">PENDING</span>.
              </li>
              <li>
                <strong>Validation obligatoire :</strong> Vous vérifiez personnellement la réception du SMS ou transfert MonCash sur votre téléphone avant de cliquer sur <span className="text-emerald-400 font-bold">Confirmer</span> dans l'onglet Recharges.
              </li>
              <li>
                <strong>Contrôle d'unicité :</strong> Chaque numéro de référence/transcode est unique. Une référence déjà utilisée ne peut plus jamais être validée ou soumise une seconde fois.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* NatCash Card (Secondary) */}
      {natcash && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#0e1422] border border-cyan-500/30 space-y-4 shadow-xl shadow-cyan-500/5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                NC
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase font-['Chakra_Petch']">
                  {natcash.name} (Second Moyen de Paiement HTG)
                </h3>
                <span className="text-[10px] text-cyan-400 font-mono">
                  Opérateur Natcom Haïti
                </span>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-xs font-semibold text-slate-300">
                {natcash.isActive ? 'Activé' : 'Désactivé'}
              </span>
              <input
                type="checkbox"
                checked={natcash.isActive}
                onChange={e => handleUpdate('natcash', { isActive: e.target.checked })}
                className="w-4 h-4 rounded text-cyan-500 bg-slate-900 border-slate-700"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                Numéro NatCash Récepteur (HTG)
              </label>
              <input
                type="text"
                defaultValue={natcash.phoneNumber || '43854650'}
                onBlur={e => handleUpdate('natcash', { phoneNumber: e.target.value.trim() })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm text-cyan-400 outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                Nom du bénéficiaire
              </label>
              <input
                type="text"
                defaultValue={natcash.recipientName || 'My Store Digital'}
                onBlur={e => handleUpdate('natcash', { recipientName: e.target.value.trim() })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
