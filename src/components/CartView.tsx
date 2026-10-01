import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../context/StoreContext.js';
import { useI18n } from '../context/I18nContext.js';
import { api } from '../lib/api.js';
import { PlayerVerificationCard } from './PlayerVerificationCard.js';
import { normalizeWhatsAppNumber } from '../lib/phoneUtils.js';
import { Order, CustomerLibraryItem, CouponValidationResult, PromotionalCoupon } from '../types.js';
import { 
  Trash2, 
  ShoppingBag, 
  Zap, 
  Wallet, 
  AlertCircle, 
  CheckCircle2, 
  ShieldCheck,
  MessageSquare,
  ArrowLeft,
  ArrowRight,
  Copy,
  Check,
  Lock,
  Clock,
  Sparkles,
  Tag,
  Gift,
  X,
  Eye,
  EyeOff,
  Download
} from 'lucide-react';

export const CartView: React.FC = () => {
  const { 
    cart, 
    cartTotalHTG, 
    updateCartQuantity, 
    updateCartItemVerification,
    removeFromCart, 
    clearCart, 
    platforms,
    user, 
    wallet, 
    setActiveTab, 
    setAccountSubTab,
    setIsAuthModalOpen, 
    setIsRechargeModalOpen,
    refreshUserAndWallet,
    refreshNotifications,
    appliedCouponCode,
    setAppliedCouponCode,
  } = useStore();
  const { t, getProductName } = useI18n();

  // Navigation steps: 'cart' -> 'review' -> 'confirmation'
  const [step, setStep] = useState<'cart' | 'review' | 'confirmation'>('cart');
  const [confirmedOrder, setConfirmedOrder] = useState<{
    order: Order;
    libraryItems: CustomerLibraryItem[];
  } | null>(null);

  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeVerificationItemId, setActiveVerificationItemId] = useState<string | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [revealedOrderPasswords, setRevealedOrderPasswords] = useState<Record<string, boolean>>({});

  // Coupon state (Loyalty & Promotional)
  const [couponInput, setCouponInput] = useState(appliedCouponCode || '');
  const [couponValidation, setCouponValidation] = useState<CouponValidationResult | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null);
  const [availablePromos, setAvailablePromos] = useState<PromotionalCoupon[]>([]);

  // Fetch available promotional coupons for easy discovery
  useEffect(() => {
    let isMounted = true;
    api.getAvailablePromotionalCoupons()
      .then(promos => {
        if (isMounted) setAvailablePromos(promos || []);
      })
      .catch(() => {
        // Soft fail if none
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Unique Idempotency Key per checkout attempt to guarantee single charge
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);

  // WhatsApp requirement detection
  const itemsRequiringWhatsApp = cart.filter(item => item.product.requiresWhatsApp);
  const hasWhatsAppRequirement = itemsRequiringWhatsApp.length > 0;
  const initialWhatsApp = cart.find(item => item.customerWhatsApp)?.customerWhatsApp || '';
  const [customerWhatsApp, setCustomerWhatsApp] = useState(initialWhatsApp);

  // Calculate discount & final total
  const discountHTG = couponValidation?.valid ? (couponValidation.discountHTG || 0) : 0;
  const finalTotalHTG = Math.max(0, cartTotalHTG - discountHTG);
  const canAfford = wallet ? wallet.balanceHTG >= finalTotalHTG : false;
  const balanceRemaining = (wallet?.balanceHTG || 0) - finalTotalHTG;

  // Check if any cart item requires verification but is not verified
  const unverifiedItems = cart.filter(item => {
    const plat = platforms.find(p => p.id === item.product.platformId);
    return plat?.idVerification?.verificationEnabled && (!item.verificationToken || !item.playerConfirmed);
  });
  const hasUnverifiedItems = unverifiedItems.length > 0;

  // Track last attempted coupon to prevent infinite loops on error
  const lastAttemptedCouponRef = useRef<string | null>(null);

  // Auto-apply coupon if code was sent from "Mes Récompenses"
  useEffect(() => {
    if (
      appliedCouponCode &&
      user &&
      cartTotalHTG > 0 &&
      lastAttemptedCouponRef.current !== appliedCouponCode &&
      (!couponValidation || couponValidation.code !== appliedCouponCode)
    ) {
      lastAttemptedCouponRef.current = appliedCouponCode;
      setCouponInput(appliedCouponCode);
      handleApplyCoupon(appliedCouponCode);
    }
  }, [appliedCouponCode, user, cartTotalHTG, couponValidation]);

  const handleApplyCoupon = async (codeToValidate?: string) => {
    const code = (codeToValidate || couponInput).trim();
    if (!code) {
      setCouponError('Veuillez entrer un code de réduction.');
      return;
    }
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    setValidatingCoupon(true);
    setCouponError(null);
    setCouponSuccess(null);
    try {
      const res = await api.validateCoupon(code, cartTotalHTG);
      if (res.valid) {
        setCouponValidation(res);
        setAppliedCouponCode(res.code);
        setCouponSuccess(t.loyalty.couponApplied || `Coupon de -${res.discountPercent}% appliqué !`);
      } else {
        setCouponValidation(null);
        setCouponError(res.message || 'Coupon invalide.');
        setAppliedCouponCode(null);
      }
    } catch (err: any) {
      setCouponValidation(null);
      setCouponError(err.message || 'Erreur lors de la validation du coupon.');
      setAppliedCouponCode(null);
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponValidation(null);
    setCouponInput('');
    setAppliedCouponCode(null);
    setCouponError(null);
    setCouponSuccess(null);
  };

  // Refresh idempotency key when entering review step
  useEffect(() => {
    if (step === 'review') {
      setIdempotencyKey(`idemp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);
    }
  }, [step]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2500);
  };

  const handleProceedToReview = () => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    if (hasUnverifiedItems) {
      const firstUnverified = unverifiedItems[0];
      const plat = platforms.find(p => p.id === firstUnverified.product.platformId);
      setError(`${t.playerVerification.mustVerifyError} : "${getProductName(firstUnverified.product)}" (${plat?.name || 'Plateforme'})`);
      setActiveVerificationItemId(firstUnverified.product.id);
      return;
    }

    setError(null);
    setStep('review');
  };

  const handleCheckout = async () => {
    if (loadingCheckout) return;
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    if (hasUnverifiedItems) {
      const firstUnverified = unverifiedItems[0];
      const plat = platforms.find(p => p.id === firstUnverified.product.platformId);
      setError(`${t.playerVerification.mustVerifyError} : "${getProductName(firstUnverified.product)}" (${plat?.name || 'Plateforme'})`);
      setStep('cart');
      setActiveVerificationItemId(firstUnverified.product.id);
      return;
    }

    let cleanWhatsApp: string | undefined = undefined;
    if (hasWhatsAppRequirement) {
      const norm = normalizeWhatsAppNumber(customerWhatsApp);
      if (!norm.valid) {
        setError(norm.error || 'Veuillez saisir un numéro WhatsApp valide (+509...) requis pour finaliser votre commande.');
        return;
      }
      cleanWhatsApp = norm.normalized;
    }

    if (!canAfford) {
      setError(`${t.cart.balanceLow} (${(wallet?.balanceHTG ?? 0).toLocaleString()} HTG disponible, ${(finalTotalHTG ?? 0).toLocaleString()} HTG requis).`);
      return;
    }

    setLoadingCheckout(true);
    setError(null);

    try {
      const itemsPayload = cart.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        playerIdentifier: item.playerIdentifier,
        verificationToken: item.verificationToken,
        customerWhatsApp: item.customerWhatsApp || cleanWhatsApp,
        accountEmail: item.accountEmail,
        accountName: item.accountName,
        customRequirement: item.customRequirement,
      }));

      const activeCoupon = couponValidation?.valid ? couponValidation.code : undefined;
      const res = await api.checkout(itemsPayload, cleanWhatsApp, idempotencyKey, activeCoupon);
      
      setConfirmedOrder({
        order: res.order,
        libraryItems: res.libraryItems,
      });
      clearCart();
      setAppliedCouponCode(null);
      setCouponValidation(null);
      await refreshUserAndWallet();
      await refreshNotifications();

      setStep('confirmation');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la validation du panier.');
    } finally {
      setLoadingCheckout(false);
    }
  };

  // ==========================================
  // STEP 3: CONFIRMATION VIEW
  // ==========================================
  if (step === 'confirmation' && confirmedOrder) {
    const isManualService = confirmedOrder.order.requiresWhatsApp || confirmedOrder.order.digitalDeliveryStatus === 'PROCESSING';

    return (
      <div className="py-6 px-3 max-w-lg mx-auto space-y-5 animate-in zoom-in-95 duration-200">
        <div className="p-6 rounded-3xl bg-[#0e1422] border border-emerald-500/30 text-center relative overflow-hidden shadow-2xl shadow-emerald-950/20">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-12 bg-emerald-500/10 blur-xl pointer-events-none" />

          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <h1 className="text-xl font-black text-white font-['Chakra_Petch'] uppercase tracking-wide">
            Achat Réussi !
          </h1>
          <p className="text-xs font-mono font-bold text-cyan-400 mt-1">
            Commande #{confirmedOrder.order.orderNumber}
          </p>
          <p className="text-xs text-slate-300 mt-0.5">
            Votre commande a été enregistrée avec succès.
          </p>

          <div className="mt-5 p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-left space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-400">
              <span>Numéro de commande :</span>
              <span className="font-mono font-black text-white">#{confirmedOrder.order.orderNumber}</span>
            </div>

            {(confirmedOrder.order.discountHTG ?? 0) > 0 && (
              <>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Sous-total :</span>
                  <span className="font-mono text-slate-300">
                    {(confirmedOrder.order.subtotalHTG ?? 0).toLocaleString()} HTG
                  </span>
                </div>
                <div className="flex justify-between items-center text-emerald-400">
                  <span>{confirmedOrder.order.couponType === 'PROMOTIONAL' ? 'Remise promotionnelle' : 'Remise fidélité'} ({confirmedOrder.order.couponCode}) :</span>
                  <span className="font-mono font-bold">
                    -{(confirmedOrder.order.discountHTG ?? 0).toLocaleString()} HTG
                  </span>
                </div>
              </>
            )}

            <div className="flex justify-between items-center text-slate-400">
              <span>Montant payé :</span>
              <span className="font-mono font-black text-emerald-400">
                {(confirmedOrder.order.totalHTG || confirmedOrder.order.totalAmountHTG || 0).toLocaleString()} HTG
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Statut :</span>
              <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                isManualService 
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' 
                  : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              }`}>
                {isManualService ? 'PAYÉ / EN ATTENTE DE TRAITEMENT' : 'PAYÉ / LIVRÉ'}
              </span>
            </div>
          </div>

          {/* Explanation message */}
          {isManualService ? (
            <div className="mt-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-left text-xs text-amber-200 flex items-start gap-2.5">
              <Clock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-white">Service en cours de traitement</p>
                <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                  Votre commande a été reçue avec succès. Notre équipe va vous contacter sur WhatsApp au{' '}
                  <strong className="text-emerald-400 font-mono">{confirmedOrder.order.customerWhatsApp}</strong> pour finaliser la livraison de votre service.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-left text-xs text-emerald-200 flex items-start gap-2.5">
              <Sparkles className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-white">Livraison numérique instantanée</p>
                <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                  Vos codes ou accès numériques sont disponibles immédiatement ci-dessous et enregistrés dans votre bibliothèque.
                </p>
              </div>
            </div>
          )}

          {/* Delivered Digital Accounts Display */}
          {confirmedOrder.libraryItems.some(i => !!i.deliveredAccount) && (
            <div className="mt-5 text-left space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5 font-['Chakra_Petch']">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  Vos identifiants de compte privé
                </h3>
                <span className="text-[10px] text-emerald-400 font-bold px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/30">
                  Prêt à l'emploi
                </span>
              </div>

              {confirmedOrder.libraryItems.filter(i => !!i.deliveredAccount).map((item, idx) => {
                const acc = item.deliveredAccount!;
                const isPasswordRevealed = !!revealedOrderPasswords[item.id];
                return (
                  <div key={idx} className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/40 space-y-3">
                    <div className="flex items-center justify-between gap-2 border-b border-indigo-500/20 pb-2">
                      <div className="min-w-0">
                        <p className="text-xs font-black text-white truncate">{item.productName}</p>
                        <p className="text-[10px] text-indigo-300/80">
                          {acc.platformName} • {acc.durationDays ? `${acc.durationDays} jours` : 'Accès complet'}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold border border-indigo-500/30">
                        {acc.profileName || 'Compte Dédié'}
                      </span>
                    </div>

                    {/* Email / Username field */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                        Identifiant / E-mail :
                      </span>
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-black/60 border border-slate-700/80 font-mono text-xs text-white">
                        <span className="select-all break-all">{acc.loginEmail}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(acc.loginEmail, `acc-user-${item.id}`)}
                          className="p-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-black transition-colors flex-shrink-0"
                          title="Copier l'identifiant"
                        >
                          {copiedCodeId === `acc-user-${item.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Password field */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                        Mot de passe :
                      </span>
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-black/60 border border-slate-700/80 font-mono text-xs text-white">
                        <span className="select-all break-all">
                          {isPasswordRevealed ? acc.password : '••••••••••••'}
                        </span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => setRevealedOrderPasswords(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                            title={isPasswordRevealed ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                          >
                            {isPasswordRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(acc.password, `acc-pass-${item.id}`)}
                            className="p-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-black transition-colors"
                            title="Copier le mot de passe"
                          >
                            {copiedCodeId === `acc-pass-${item.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Instructions if any */}
                    {acc.instructions && (
                      <p className="text-[10px] text-indigo-200/80 bg-indigo-950/40 p-2 rounded-xl border border-indigo-500/20">
                        ℹ️ {acc.instructions}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Download Delivery Display if present */}
          {confirmedOrder.libraryItems.some(i => !!i.downloadUrl || !!i.deliveredDownloadUrl) && (
            <div className="mt-5 text-left space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5 font-['Chakra_Petch']">
                  <Download className="w-4 h-4 text-cyan-400" />
                  Votre téléchargement
                </h3>
                <span className="text-[10px] text-emerald-400 font-bold px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/30">
                  Disponible
                </span>
              </div>

              {confirmedOrder.libraryItems
                .filter(i => !!i.downloadUrl || !!i.deliveredDownloadUrl)
                .map((item, idx) => {
                  const targetUrl = item.downloadUrl || item.deliveredDownloadUrl!;
                  return (
                    <div key={idx} className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/40 to-blue-950/40 border border-cyan-500/40 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {item.productImage && (
                            <img
                              src={item.productImage}
                              alt={item.productName}
                              className="w-9 h-9 rounded-lg object-cover border border-cyan-500/30 flex-shrink-0"
                            />
                          )}
                          <div className="truncate">
                            <p className="text-xs font-bold text-white truncate">{item.productName}</p>
                            <span className="text-[10px] text-cyan-300 font-mono">Téléchargement disponible</span>
                          </div>
                        </div>
                      </div>

                      {item.instructions && (
                        <p className="text-[11px] text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                          ℹ️ {item.instructions}
                        </p>
                      )}

                      <a
                        href={targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-500/20 cursor-pointer text-center"
                      >
                        <Download className="w-4 h-4" />
                        Télécharger
                      </a>
                    </div>
                  );
                })}

              <p className="text-[11px] text-slate-400 text-center">
                Vous pouvez retrouver ce téléchargement à tout moment dans votre bibliothèque.
              </p>
            </div>
          )}

          {/* Digital Codes Quick Display if present */}
          {confirmedOrder.libraryItems.some(i => i.digitalCode) && (
            <div className="mt-5 text-left space-y-2.5">
              <h3 className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5 font-['Chakra_Petch']">
                <Lock className="w-3.5 h-3.5" />
                Vos codes d'activation
              </h3>
              {confirmedOrder.libraryItems.filter(i => i.digitalCode).map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-black/60 border border-slate-700 flex items-center justify-between gap-2 font-mono">
                  <div className="truncate">
                    <p className="text-[10px] text-slate-400 truncate">{item.productName}</p>
                    <p className="text-xs sm:text-sm font-black text-white tracking-widest">{item.digitalCode}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(item.digitalCode!, item.id)}
                    className="px-2.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500 hover:text-black text-cyan-400 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer flex-shrink-0"
                  >
                    {copiedCodeId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCodeId === item.id ? 'Copié' : 'Copier'}</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 3 Clear Action Buttons */}
          <div className="mt-6 space-y-2.5">
            <button
              onClick={() => {
                setAccountSubTab('orders');
                setActiveTab('account');
              }}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
            >
              Voir ma commande
            </button>

            <button
              onClick={() => {
                setStep('cart');
                setConfirmedOrder(null);
                setActiveTab('catalog');
              }}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
            >
              Continuer mes achats
            </button>

            <button
              onClick={() => {
                setAccountSubTab('library');
                setActiveTab('account');
              }}
              className="w-full py-3 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-500/40 text-indigo-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
            >
              Aller à ma bibliothèque
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // EMPTY CART VIEW
  // ==========================================
  if (cart.length === 0) {
    return (
      <div className="py-20 text-center max-w-sm mx-auto px-4 animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center mx-auto mb-4">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h2 className="text-base font-black text-white font-['Chakra_Petch'] uppercase">
          {t.cart.emptyTitle}
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          {t.cart.emptyDesc}
        </p>
        <button
          onClick={() => setActiveTab('catalog')}
          className="mt-5 px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
        >
          {t.cart.browseCatalog}
        </button>
      </div>
    );
  }

  // ==========================================
  // STEP 2: CHECKOUT REVIEW ("Vérification de la commande")
  // ==========================================
  if (step === 'review') {
    const isWhatsAppValid = hasWhatsAppRequirement ? normalizeWhatsAppNumber(customerWhatsApp).valid : true;

    return (
      <div className="pb-24 max-w-xl mx-auto space-y-4 animate-in fade-in duration-150">
        {/* Back and Title */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              setError(null);
              setStep('cart');
            }}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Modifier mon panier</span>
          </button>
          <span className="text-[11px] text-slate-400 uppercase tracking-widest font-mono">
            Étape 2 / 2
          </span>
        </div>

        <h1 className="text-lg font-black text-white font-['Chakra_Petch'] uppercase tracking-wide flex items-center gap-2">
          <span>Vérification de la commande</span>
        </h1>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs flex items-center justify-between gap-2 animate-in shake">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
            {!canAfford && (
              <button
                onClick={() => setIsRechargeModalOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-cyan-500 text-black font-bold text-[11px] whitespace-nowrap cursor-pointer"
              >
                {t.wallet.depositTitle}
              </button>
            )}
          </div>
        )}

        {/* 1. PRODUITS RECAP */}
        <div className="p-4 rounded-2xl bg-[#0e1422] border border-slate-800 space-y-3">
          <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Produits de la commande
          </h2>

          <div className="divide-y divide-slate-800/80">
            {cart.map(item => {
              const displayName = getProductName(item.product);
              const subtotal = item.product.priceHTG * item.quantity;

              return (
                <div key={item.product.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={item.product.image}
                      alt={displayName}
                      className="w-10 h-10 rounded-lg object-cover border border-slate-700/60 flex-shrink-0"
                    />
                    <div className="truncate">
                      <p className="font-bold text-white truncate">{displayName}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {item.quantity} × {item.product.priceHTG.toLocaleString()} HTG
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-cyan-400 font-mono text-xs whitespace-nowrap">
                    {subtotal.toLocaleString()} HTG
                  </span>
                </div>
              );
            })}
          </div>

          {/* FINANCIAL BREAKDOWN */}
          <div className="pt-3 border-t border-slate-800/90 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Sous-total :</span>
              <span className="font-mono font-bold text-white">{cartTotalHTG.toLocaleString()} HTG</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Réduction :</span>
              <span className="font-mono text-slate-400">0 HTG</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Frais de livraison :</span>
              <span className="text-emerald-400 font-bold">0 HTG (Instantané)</span>
            </div>
            <div className="pt-2 border-t border-slate-800 flex justify-between text-sm">
              <span className="font-bold text-white">Total :</span>
              <span className="font-black text-cyan-400 font-['Chakra_Petch'] text-base">
                {cartTotalHTG.toLocaleString()} HTG
              </span>
            </div>
          </div>
        </div>

        {/* 2. REQUIRED CUSTOMER INFORMATION */}
        {(hasWhatsAppRequirement || cart.some(i => i.playerIdentifier)) && (
          <div className="p-4 rounded-2xl bg-[#0e1422] border border-slate-800 space-y-3">
            <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Informations requises
            </h2>

            {/* WhatsApp Requirement */}
            {hasWhatsAppRequirement && (
              <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
                <label className="text-xs font-bold text-emerald-400 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    Numéro WhatsApp pour livraison / contact *
                  </span>
                  {customerWhatsApp && (
                    <span className={`text-[10px] font-mono ${isWhatsAppValid ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {isWhatsAppValid ? 'Format valide' : 'Format invalide'}
                    </span>
                  )}
                </label>
                <input
                  type="tel"
                  value={customerWhatsApp}
                  onChange={e => {
                    setCustomerWhatsApp(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Ex: +509 34 58 4287 ou 34584287"
                  className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none"
                />
                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                  Donnée confidentielle, utilisée uniquement pour le traitement de votre commande.
                </p>
              </div>
            )}

            {/* Verified Player IDs Recap */}
            {cart.filter(i => i.playerIdentifier).map(item => (
              <div key={item.product.id} className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs flex items-center justify-between">
                <div>
                  <span className="text-slate-400">{getProductName(item.product)} :</span>
                  <p className="font-bold text-white mt-0.5">
                    {item.verifiedInfo?.playerName || 'Joueur vérifié'}
                  </p>
                </div>
                <span className="font-mono font-bold text-cyan-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                  UID: {item.playerIdentifier}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 3. WALLET & PAYMENT METHOD */}
        <div className="p-4 rounded-2xl bg-[#0e1422] border border-slate-800 space-y-3">
          <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-cyan-400" />
            Mode de paiement : Portefeuille My Store (HTG)
          </h2>

          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-300">
              <span>Solde disponible :</span>
              <span className="font-mono font-bold text-white">
                {wallet ? `${wallet.balanceHTG.toLocaleString()} HTG` : '0 HTG'}
              </span>
            </div>

            <div className="flex justify-between items-center text-slate-300">
              <span>Sous-total commande :</span>
              <span className="font-mono font-bold text-white">
                {cartTotalHTG.toLocaleString()} HTG
              </span>
            </div>

            {discountHTG > 0 && (
              <div className="flex justify-between items-center text-emerald-400">
                <span className="flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  <span>
                    {couponValidation?.type === 'PROMOTIONAL'
                      ? `Remise promo ${couponValidation.campaignName ? `(${couponValidation.campaignName})` : ''}`
                      : 'Remise fidélité'} (-{couponValidation?.discountPercent}%) :
                  </span>
                </span>
                <span className="font-mono font-bold">
                  -{discountHTG.toLocaleString()} HTG
                </span>
              </div>
            )}

            <div className="flex justify-between items-center text-slate-300 pt-1 border-t border-slate-800/80">
              <span className="font-bold text-white">Total à débiter :</span>
              <span className="font-mono font-black text-cyan-400">
                {finalTotalHTG.toLocaleString()} HTG
              </span>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
              <span className="text-slate-400">Solde après paiement :</span>
              <span className={`font-mono font-bold ${canAfford ? 'text-emerald-400' : 'text-red-400'}`}>
                {(canAfford ? balanceRemaining : 0).toLocaleString()} HTG
              </span>
            </div>

            {!canAfford && (
              <div className="pt-2 mt-2 border-t border-red-500/20 flex items-center justify-between">
                <span className="text-[11px] text-red-400 font-bold">Solde insuffisant.</span>
                <button
                  onClick={() => setIsRechargeModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-black text-[11px] uppercase tracking-wider cursor-pointer"
                >
                  Recharger mon portefeuille
                </button>
              </div>
            )}
          </div>

          {/* Warning before debit */}
          <p className="text-[11px] text-slate-400 italic px-1">
            En confirmant, votre portefeuille sera débité du montant indiqué ({finalTotalHTG.toLocaleString()} HTG).
          </p>

          {/* Action button */}
          <button
            disabled={loadingCheckout || !canAfford || (hasWhatsAppRequirement && !isWhatsAppValid)}
            onClick={handleCheckout}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 via-cyan-400 to-emerald-400 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 hover:opacity-95 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {loadingCheckout ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                Traitement sécurisé...
              </span>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-black" />
                <span>Confirmer et Payer ({finalTotalHTG.toLocaleString()} HTG)</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // STEP 1: CART VIEW
  // ==========================================
  return (
    <div className="pb-24 space-y-4 animate-in fade-in duration-200">
      {/* Title & Clear */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-black text-white font-['Chakra_Petch'] uppercase tracking-wide flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-cyan-400" />
          <span>{t.cart.title} ({cart.length})</span>
        </h1>
        <button
          onClick={clearCart}
          className="text-xs text-red-400 hover:text-red-300 underline font-medium cursor-pointer"
        >
          {t.cart.clearCart}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          {!canAfford && (
            <button
              onClick={() => setIsRechargeModalOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-cyan-500 text-black font-bold text-[11px] whitespace-nowrap cursor-pointer"
            >
              {t.wallet.depositTitle}
            </button>
          )}
        </div>
      )}

      {/* Items List */}
      <div className="space-y-3">
        {cart.map(item => {
          const itemPlat = platforms.find(p => p.id === item.product.platformId);
          const isVerifRequired = !!itemPlat?.idVerification?.verificationEnabled;
          const isItemConfirmed = !!(item.playerConfirmed && item.verificationToken);
          const isVerifyingThis = activeVerificationItemId === item.product.id;
          const displayName = getProductName(item.product);
          const maxAllowed = Math.min(item.product.stock, 50);

          return (
            <div
              key={item.product.id}
              className={`p-3.5 rounded-2xl bg-[#0e1422] border transition-all ${
                isVerifRequired && !isItemConfirmed
                  ? 'border-amber-500/50 shadow-md shadow-amber-950/20'
                  : 'border-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <img
                  src={item.product.image}
                  alt={displayName}
                  className="w-16 h-16 rounded-xl object-cover border border-slate-700/60 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xs font-bold text-white truncate">
                      {displayName}
                    </h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                      Stock: {item.product.stock}
                    </span>
                  </div>

                  <p className="text-[11px] text-cyan-400 font-mono mt-0.5">
                    {item.product.priceHTG.toLocaleString()} HTG
                  </p>

                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
                      <button
                        onClick={() => updateCartQuantity(item.product.id, Math.max(1, item.quantity - 1))}
                        disabled={item.quantity <= 1}
                        className="px-2.5 py-1 text-xs text-slate-300 hover:text-white font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        -
                      </button>
                      <span className="px-2 text-xs font-bold font-mono text-white min-w-[24px] text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                        disabled={item.quantity >= maxAllowed}
                        className="px-2.5 py-1 text-xs text-slate-300 hover:text-white font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-xs font-black text-white font-['Chakra_Petch'] ml-auto">
                      {(item.product.priceHTG * item.quantity).toLocaleString()} HTG
                    </span>
                  </div>
                </div>

                {/* Remove button */}
                <button
                  onClick={() => removeFromCart(item.product.id)}
                  className="p-2 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                  title={t.common.delete}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* WhatsApp requirement badge */}
              {item.product.requiresWhatsApp && (
                <div className="mt-2.5 text-[11px] text-emerald-400 bg-emerald-950/30 border border-emerald-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Contact WhatsApp requis pour ce service</span>
                </div>
              )}

              {/* Player verification status block */}
              {isVerifRequired && itemPlat && (
                <div className="mt-2.5 pt-2.5 border-t border-slate-800/80">
                  {isItemConfirmed ? (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-[11px]">
                      <div className="flex items-center gap-1.5 text-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        <span>
                          <strong className="text-white">{item.verifiedInfo?.playerName || item.playerIdentifier}</strong>
                          {item.playerIdentifier && (
                            <span className="text-slate-400 ml-1 font-mono">({itemPlat.idVerification?.idFieldName || 'UID'}: {item.playerIdentifier})</span>
                          )}
                        </span>
                      </div>
                      <button
                        onClick={() => setActiveVerificationItemId(isVerifyingThis ? null : item.product.id)}
                        className="text-[10px] text-cyan-400 hover:underline font-medium cursor-pointer"
                      >
                        {isVerifyingThis ? t.common.close : t.playerVerification.changeId}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px]">
                      <div className="flex items-center gap-1.5 text-amber-300">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                        <span className="font-semibold">{t.playerVerification.mustVerifyError} ({itemPlat.idVerification?.idFieldName || 'UID'})</span>
                      </div>
                      <button
                        onClick={() => setActiveVerificationItemId(isVerifyingThis ? null : item.product.id)}
                        className="px-2.5 py-1 rounded-lg bg-amber-500 text-black text-[10px] font-black uppercase hover:bg-amber-400 transition-colors cursor-pointer"
                      >
                        {isVerifyingThis ? t.common.close : t.playerVerification.verifyBtn}
                      </button>
                    </div>
                  )}

                  {/* Inline Verification Form */}
                  {isVerifyingThis && (
                    <div className="mt-2">
                      <PlayerVerificationCard
                        platform={itemPlat}
                        productId={item.product.id}
                        initialIdentifier={item.playerIdentifier}
                        initialToken={item.verificationToken}
                        initialVerifiedInfo={item.verifiedInfo}
                        initialConfirmed={item.playerConfirmed}
                        onVerificationConfirmed={({ playerIdentifier, verificationToken, verifiedInfo }) => {
                          updateCartItemVerification(
                            item.product.id,
                            playerIdentifier,
                            verificationToken,
                            verifiedInfo
                          );
                          setActiveVerificationItemId(null);
                          setError(null);
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary Box */}
      <div className="p-4 rounded-2xl bg-[#0e1422] border border-slate-800 space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          {t.cart.summary}
        </h3>

        {/* Loyalty Coupon Input / Applied Badge */}
        <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-cyan-400" />
              <span>{t.loyalty.cartCouponLabel}</span>
            </span>
            {couponValidation?.valid && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                -{couponValidation.discountPercent}%
              </span>
            )}
          </div>

          {couponValidation?.valid ? (
            <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/30">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-black text-xs text-white">
                      {couponValidation.code}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                      {couponValidation.type === 'PROMOTIONAL' ? (couponValidation.campaignName || 'Promo') : 'Fidélité'}
                    </span>
                  </div>
                  <p className="text-[10px] text-emerald-400 mt-0.5">
                    -{couponValidation.discountPercent}% ({couponValidation.discountHTG.toLocaleString()} HTG d'économie)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveCoupon}
                className="p-1 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                title={t.loyalty.removeBtn}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={e => {
                    setCouponInput(e.target.value.toUpperCase());
                    if (couponError) setCouponError(null);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApplyCoupon();
                    }
                  }}
                  placeholder={t.loyalty.cartCouponPlaceholder}
                  className="flex-1 bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-lg px-3 py-1.5 text-xs text-white uppercase placeholder-slate-500 font-mono focus:outline-none"
                />
                <button
                  type="button"
                  disabled={validatingCoupon || !couponInput.trim()}
                  onClick={() => handleApplyCoupon()}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  {validatingCoupon ? '...' : t.loyalty.applyBtn}
                </button>
              </div>

              {availablePromos.length > 0 && (
                <div className="pt-1">
                  <span className="text-[10px] text-slate-400 block mb-1">
                    Offres promotionnelles en cours :
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {availablePromos.slice(0, 3).map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setCouponInput(p.code);
                          handleApplyCoupon(p.code);
                        }}
                        className="px-2 py-0.5 rounded-md bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Tag className="w-2.5 h-2.5" />
                        <span>{p.code} (-{p.discountPercent}%)</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {couponError && (
                <p className="text-[11px] text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  <span>{couponError}</span>
                </p>
              )}

              {couponSuccess && (
                <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                  <span>{couponSuccess}</span>
                </p>
              )}
            </div>
          )}
        </div>
        
        <div className="flex justify-between text-xs text-slate-300">
          <span>{t.cart.subtotal} :</span>
          <span className="font-mono font-bold">{cartTotalHTG.toLocaleString()} HTG</span>
        </div>

        {discountHTG > 0 && (
          <div className="flex justify-between text-xs text-emerald-400 font-medium">
            <span className="flex items-center gap-1">
              <Tag className="w-3 h-3" />
              <span>
                {couponValidation?.type === 'PROMOTIONAL'
                  ? `Remise promo ${couponValidation.campaignName ? `(${couponValidation.campaignName})` : ''}`
                  : 'Remise fidélité'} (-{couponValidation?.discountPercent}%) :
              </span>
            </span>
            <span className="font-mono font-bold">-{discountHTG.toLocaleString()} HTG</span>
          </div>
        )}

        <div className="flex justify-between text-xs text-slate-300">
          <span>{t.cart.deliveryFee} :</span>
          <span className="text-emerald-400 font-bold">0 HTG ({t.common.instant})</span>
        </div>

        <div className="pt-2 border-t border-slate-800 flex justify-between text-sm">
          <span className="font-bold text-white">{t.cart.totalToPay} :</span>
          <span className="font-black text-cyan-400 font-['Chakra_Petch'] text-base">
            {finalTotalHTG.toLocaleString()} HTG
          </span>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 space-y-2">
          {!user ? (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 cursor-pointer"
            >
              {t.cart.loginToPay}
            </button>
          ) : (
            <button
              onClick={handleProceedToReview}
              className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${
                hasUnverifiedItems
                  ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-cyan-500/25'
              }`}
            >
              {hasUnverifiedItems ? (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Vérification requise ({unverifiedItems.length})</span>
                </>
              ) : (
                <>
                  <span>Passer à la commande</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}

          <button
            onClick={() => setActiveTab('catalog')}
            className="w-full py-2.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Continuer les achats
          </button>
        </div>
      </div>
    </div>
  );
};
