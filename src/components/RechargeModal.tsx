import React, { useState } from 'react';
import { useStore } from '../context/StoreContext.js';
import { useI18n } from '../context/I18nContext.js';
import { api } from '../lib/api.js';
import { 
  X, 
  Copy, 
  Check, 
  Upload, 
  Smartphone, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  ShieldCheck,
  Info
} from 'lucide-react';

const QUICK_AMOUNTS = [250, 500, 1000, 2500, 5000];

export const RechargeModal: React.FC = () => {
  const { isRechargeModalOpen, setIsRechargeModalOpen, user, refreshUserAndWallet } = useStore();
  const { t, language } = useI18n();
  const [selectedMethod, setSelectedMethod] = useState<'moncash' | 'natcash'>('moncash');
  const [amount, setAmount] = useState<number | string>(1000);
  const [transcode, setTranscode] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [copiedNumber, setCopiedNumber] = useState(false);
  const [copiedBeneficiary, setCopiedBeneficiary] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ message: string; transcode: string; amount: number; method: string } | null>(null);

  if (!isRechargeModalOpen) return null;

  // Real receiver information localized
  const getInstructions = (method: 'moncash' | 'natcash') => {
    if (method === 'moncash') {
      if (language === 'ht') {
        return [
          'Louvri aplikasyon MonCash ou oswa fè *202#',
          'Fè transfè a sou nimewo 34584287 (Moun k ap resevwa a : carlentz)',
          'Kopye referans / kòd tranzaksyon ou resevwa nan SMS MonCash la',
          'Ranpli fòmilè anba a epi voye demand ou a',
        ];
      }
      if (language === 'en') {
        return [
          'Open your MonCash app or dial *202#',
          'Transfer to number 34584287 (Beneficiary: carlentz)',
          'Copy the transaction reference / transcode received by MonCash SMS',
          'Fill out the form below and submit your request',
        ];
      }
      return [
        'Ouvrez votre application MonCash ou composez *202#',
        'Effectuez un transfert vers le numéro 34584287 (Bénéficiaire : carlentz)',
        'Copiez la référence / transcode de transaction reçu par SMS MonCash',
        'Remplissez le formulaire ci-dessous et soumettez votre demande',
      ];
    } else {
      if (language === 'ht') {
        return [
          'Fè *202# oswa louvri aplikasyon NatCash ou',
          'Transfere kantite kòb la sou nimewo 43854650',
          'Gade kòd referans ki nan SMS konfimasyon an',
          'Mete montan an ak kòd la nan fòmilè sa a',
        ];
      }
      if (language === 'en') {
        return [
          'Dial *202# or open your NatCash app',
          'Transfer the amount to number 43854650',
          'Note the reference code in the confirmation SMS',
          'Enter the amount and code in this form',
        ];
      }
      return [
        'Composez *202# ou ouvrez votre app NatCash',
        'Transférez le montant au numéro 43854650',
        'Relevez le code de référence figurant dans le SMS de confirmation',
        'Saisissez le montant et le code dans ce formulaire',
      ];
    }
  };

  const paymentDetails = {
    moncash: {
      name: 'MonCash',
      number: '34584287',
      beneficiary: 'carlentz',
      operator: 'Digicel Haïti',
      color: 'from-red-500 to-rose-600',
      badgeColor: 'bg-red-500/15 border-red-500/30 text-red-400',
      codePrefix: language === 'ht' ? 'Eg: Ref SMS / Transcode MonCash' : language === 'en' ? 'Ex: SMS Ref / MonCash Transcode' : 'Ex: Réf SMS / Transcode MonCash',
      instructions: getInstructions('moncash'),
    },
    natcash: {
      name: 'NatCash',
      number: '43854650',
      beneficiary: 'My Store Digital',
      operator: 'Natcom Haïti',
      color: 'from-cyan-500 to-blue-600',
      badgeColor: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400',
      codePrefix: language === 'ht' ? 'Eg: NC-43854650-XXXX oswa ID SMS' : language === 'en' ? 'Ex: NC-43854650-XXXX or SMS ID' : 'Ex: NC-43854650-XXXX ou ID SMS',
      instructions: getInstructions('natcash'),
    },
  };

  const activePayment = paymentDetails[selectedMethod];

  const copyToClipboard = (text: string, isBen = false) => {
    navigator.clipboard.writeText(text);
    if (isBen) {
      setCopiedBeneficiary(true);
      setTimeout(() => setCopiedBeneficiary(false), 2000);
    } else {
      setCopiedNumber(true);
      setTimeout(() => setCopiedNumber(false), 2000);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(file.type)) {
      setError(language === 'ht' ? 'Fòma foto sa a pa sipòte. Itilize JPG, PNG oswa WEBP.' : language === 'en' ? 'Unsupported image format. Use JPG, PNG, or WEBP.' : 'Format d\'image non supporté. Utilisez JPG, PNG ou WEBP.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setScreenshotUrl(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError(language === 'ht' ? 'Tanpri konekte pou w soumèt rechaj ou a.' : language === 'en' ? 'Please sign in to submit your recharge.' : 'Veuillez vous connecter pour soumettre votre recharge.');
      return;
    }

    const numAmount = typeof amount === 'number' ? amount : parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError(language === 'ht' ? 'Tanpri antre yon montan valab an Goud (HTG).' : language === 'en' ? 'Please enter a valid amount in Gourdes (HTG).' : 'Veuillez saisir un montant valide en Gourdes (HTG).');
      return;
    }

    const cleanTranscode = transcode.trim();
    if (!cleanTranscode || cleanTranscode.length < 4) {
      setError(language === 'ht' ? 'Tanpri mete nimewo tranzaksyon oswa kòd referans SMS ou resevwa a.' : language === 'en' ? 'Please enter the transaction reference or SMS transcode received.' : 'Veuillez fournir le numéro de transaction ou code de référence SMS reçu.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.submitManualRecharge({
        amountHTG: numAmount,
        transcode: cleanTranscode,
        paymentDate,
        screenshotUrl: screenshotUrl || undefined,
        paymentMethod: selectedMethod,
      });

      setSuccessData({
        message: res.message,
        transcode: cleanTranscode,
        amount: numAmount,
        method: activePayment.name,
      });

      await refreshUserAndWallet();
    } catch (err: any) {
      setError(err.message || t.common.error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsRechargeModalOpen(false);
    setSuccessData(null);
    setTranscode('');
    setScreenshotUrl(null);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-[#0e1422] border border-slate-800 rounded-2xl shadow-2xl p-5 sm:p-6 relative max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-red-500 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-red-500/20 flex-shrink-0">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-white font-['Chakra_Petch'] uppercase tracking-wide">
              {t.recharge.title}
            </h2>
            <p className="text-xs text-slate-400">
              {t.recharge.subtitle}
            </p>
          </div>
        </div>

        {/* Success Alert */}
        {successData ? (
          <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-center my-4 space-y-4">
            <div className="w-14 h-14 bg-emerald-500 text-black rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            
            <div>
              <h3 className="text-lg font-bold text-white font-['Chakra_Petch']">
                {t.recharge.requestSuccess}
              </h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {successData.message}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-left space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">{language === 'ht' ? 'Mwayen peman :' : language === 'en' ? 'Payment method:' : 'Moyen de paiement :'}</span>
                <span className="font-bold text-white">{successData.method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{language === 'ht' ? 'Kantite mande :' : language === 'en' ? 'Amount requested:' : 'Montant demandé :'}</span>
                <span className="font-mono font-bold text-emerald-400">+{successData.amount.toLocaleString()} HTG</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{language === 'ht' ? 'Referans / Kòd SMS :' : language === 'en' ? 'Reference / Transcode:' : 'Référence / Transcode :'}</span>
                <span className="font-mono text-cyan-400">{successData.transcode}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-800">
                <span className="text-slate-400">{language === 'ht' ? 'Eta kounye a :' : language === 'en' ? 'Current status:' : 'Statut actuel :'}</span>
                <span className="font-bold text-amber-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {t.recharge.pendingAdmin}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              {t.recharge.creditNotice}
            </p>

            <button
              type="button"
              onClick={handleClose}
              className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs uppercase tracking-wide cursor-pointer transition-colors"
            >
              {t.recharge.closeAndCheck}
            </button>
          </div>
        ) : (
          <>
            {/* Payment Method Selector */}
            <div className="mb-4">
              <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                {t.recharge.selectMethod}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedMethod('moncash')}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                    selectedMethod === 'moncash'
                      ? 'bg-red-500/15 border-red-500/50 shadow-md shadow-red-500/10'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700 opacity-70'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    MC
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>MonCash</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 font-mono">
                        {language === 'ht' ? 'Defo' : language === 'en' ? 'Default' : 'Défaut'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">34584287 • carlentz</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMethod('natcash')}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                    selectedMethod === 'natcash'
                      ? 'bg-cyan-500/15 border-cyan-500/50 shadow-md shadow-cyan-500/10'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700 opacity-70'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    NC
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white">NatCash</div>
                    <div className="text-[10px] text-slate-400 truncate">43854650</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Official Receiver Details Box */}
            <div className="mb-4 p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                  {t.recharge.receiverInfo} {activePayment.name}
                </span>
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  <ShieldCheck className="w-3 h-3" />
                  {t.recharge.accountVerified}
                </span>
              </div>

              {/* Number and Beneficiary Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Number */}
                <div className="p-2.5 rounded-lg bg-black/60 border border-slate-700/60 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block">{t.recharge.receiverNumber} {activePayment.name}</span>
                    <span className="text-base font-black text-cyan-400 font-mono tracking-wider">
                      {activePayment.number}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(activePayment.number, false)}
                    className="p-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500 hover:text-black text-cyan-400 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                    title={t.common.copy}
                  >
                    {copiedNumber ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="text-[10px]">{copiedNumber ? t.common.copied : t.common.copy}</span>
                  </button>
                </div>

                {/* Beneficiary Name */}
                <div className="p-2.5 rounded-lg bg-black/60 border border-slate-700/60 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block">{t.recharge.beneficiaryName}</span>
                    <span className="text-sm font-black text-white font-mono uppercase">
                      {activePayment.beneficiary}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(activePayment.beneficiary, true)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                    title={t.common.copy}
                  >
                    {copiedBeneficiary ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="text-[10px]">{copiedBeneficiary ? t.common.copied : t.common.copy}</span>
                  </button>
                </div>
              </div>

              {/* Instructions list */}
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                <div className="font-bold text-slate-200 mb-1 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-cyan-400" />
                  {t.recharge.paymentSteps}
                </div>
                {activePayment.instructions.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 text-slate-400">
                    <span className="text-cyan-400 font-bold">{idx + 1}.</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Strict Notice regarding Admin validation */}
            <div className="mb-4 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300/90 text-[11px] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
              <span>
                {t.recharge.secureNotice}
              </span>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Quick Amount Select */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                  {t.recharge.transferredAmount}
                </label>
                <div className="grid grid-cols-5 gap-1.5 mb-2">
                  {QUICK_AMOUNTS.map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAmount(amt)}
                      className={`py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                        Number(amount) === amt
                          ? 'bg-cyan-500 text-black border-cyan-400 shadow-md shadow-cyan-500/20'
                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      {amt}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min={25}
                    step={5}
                    required
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder={t.recharge.customAmount}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors font-mono"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    HTG
                  </span>
                </div>
              </div>

              {/* Transcode / Reference SMS */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  {t.recharge.transcodeLabel} ({activePayment.name})
                </label>
                <input
                  type="text"
                  required
                  value={transcode}
                  onChange={e => setTranscode(e.target.value)}
                  placeholder={activePayment.codePrefix}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors font-mono uppercase"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  {t.recharge.transcodeHelp}
                </p>
              </div>

              {/* Date */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  {t.recharge.transferDate}
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              {/* Screenshot Upload (Optional) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  {t.recharge.proofLabel}
                </label>
                {screenshotUrl ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-700 max-h-36 flex items-center justify-center bg-black/40">
                    <img src={screenshotUrl} alt="Screenshot proof" className="max-h-36 object-contain" />
                    <button
                      type="button"
                      onClick={() => setScreenshotUrl(null)}
                      className="absolute top-2 right-2 p-1 rounded-md bg-black/80 text-white hover:bg-red-500 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-3 rounded-xl border border-dashed border-slate-700 hover:border-cyan-500/50 bg-slate-900/50 cursor-pointer transition-colors group">
                    <Upload className="w-5 h-5 text-slate-400 group-hover:text-cyan-400 mb-1" />
                    <span className="text-[11px] text-slate-400 group-hover:text-slate-200">
                      {t.recharge.addProofPhoto}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/jpg"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500 hover:opacity-90 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-red-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {loading ? t.recharge.submitting : `${t.recharge.submitRequest} (${amount} HTG)`}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
