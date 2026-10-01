import React, { useState } from 'react';
import { useStore } from '../context/StoreContext.js';
import { useI18n } from '../context/I18nContext.js';
import { api } from '../lib/api.js';
import { PlayerVerificationCard } from './PlayerVerificationCard.js';
import { normalizeWhatsAppNumber } from '../lib/phoneUtils.js';
import { PlatformOrGame } from '../types.js';
import { 
  X, 
  ShoppingBag, 
  Zap, 
  Check, 
  AlertTriangle, 
  Share2, 
  ShieldCheck, 
  Gamepad2,
  Info,
  MessageSquare,
  Clock,
  AlertCircle,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Lock
} from 'lucide-react';

export const ProductModal: React.FC = () => {
  const { 
    selectedProduct, 
    setSelectedProduct, 
    user, 
    wallet, 
    platforms,
    addToCart, 
    setActiveTab, 
    setIsAuthModalOpen, 
    setIsRechargeModalOpen,
    refreshUserAndWallet,
    refreshNotifications
  } = useStore();
  const { t, getProductName, getProductDescription } = useI18n();

  const [quantity, setQuantity] = useState(1);
  const [playerIdentifier, setPlayerIdentifier] = useState('');
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [verifiedInfo, setVerifiedInfo] = useState<any>(null);
  const [playerConfirmed, setPlayerConfirmed] = useState(false);
  const [customerWhatsApp, setCustomerWhatsApp] = useState('');

  const [loadingPurchase, setLoadingPurchase] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [addedToCartToast, setAddedToCartToast] = useState(false);

  // Gallery multi-images state & full screen viewer
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  // Reset active image when product changes
  React.useEffect(() => {
    setActiveImageIndex(0);
    setIsViewerOpen(false);
    setImageErrors({});
  }, [selectedProduct?.id]);

  if (!selectedProduct) return null;

  const galleryList = Array.from(new Set([selectedProduct.image, ...(selectedProduct.galleryImages || [])].filter(Boolean)));
  const currentImage = galleryList[activeImageIndex] || selectedProduct.image;

  const displayName = getProductName(selectedProduct);
  const displayDesc = getProductDescription(selectedProduct);

  // Find associated platform
  const rawPlatform = platforms.find(p => p.id === (selectedProduct.platformId || selectedProduct.subcategoryId));
  const requiresVerification = !!(selectedProduct.requiresPlayerIdVerification || rawPlatform?.idVerification?.verificationEnabled);
  const platform: PlatformOrGame | undefined = rawPlatform || (requiresVerification ? {
    id: selectedProduct.subcategoryId || 'game',
    name: selectedProduct.subcategoryName || selectedProduct.name,
    description: selectedProduct.description || '',
    categoryId: selectedProduct.categoryId,
    slug: 'game',
    image: selectedProduct.image,
    type: 'game' as const,
    active: true,
    orderIndex: 0,
    idVerification: {
      verificationEnabled: true,
      provider: 'local_validator' as const,
      idType: 'alphanumeric' as const,
      idFieldName: selectedProduct.verificationIdFieldName || 'UID Joueur (Free Fire...)',
      idRegex: '^[0-9A-Za-z_-]{4,20}$',
      idPlaceholder: '512893041',
      idFormatHelp: 'Saisissez votre identifiant officiel de joueur.',
      regionRequired: true,
      regionOptions: ['LATAM', 'NA', 'EU', 'GLOBAL'],
    },
  } : undefined);
  const isOutOfStock = selectedProduct.stock <= 0;
  const isGameTopup = selectedProduct.categoryId === 'cat-gaming';
  const isManualWhatsApp = Boolean(selectedProduct.requiresWhatsApp || selectedProduct.deliveryType === 'MANUAL_WHATSAPP');
  const totalPriceHTG = (selectedProduct.priceHTG ?? 0) * quantity;
  const canAfford = wallet ? (wallet.balanceHTG ?? 0) >= totalPriceHTG : false;

  const handleAddToCart = () => {
    if (addedToCartToast || isOutOfStock) return;

    if (requiresVerification && (!playerConfirmed || !verificationToken)) {
      setErrorMessage(
        t.playerVerification.mustVerifyError
      );
      return;
    }

    let cleanWhatsApp: string | undefined = undefined;
    if (isManualWhatsApp) {
      const norm = normalizeWhatsAppNumber(customerWhatsApp);
      if (!norm.valid) {
        setErrorMessage(norm.error || 'Veuillez saisir un numéro WhatsApp valide (+509...) pour ce service.');
        return;
      }
      cleanWhatsApp = norm.normalized;
    }

    addToCart(
      selectedProduct,
      quantity,
      playerIdentifier || undefined,
      verificationToken || undefined,
      verifiedInfo,
      cleanWhatsApp
    );
    setAddedToCartToast(true);
    setTimeout(() => {
      setAddedToCartToast(false);
      setSelectedProduct(null);
    }, 1200);
  };

  const handleInstantBuy = async () => {
    if (loadingPurchase || isOutOfStock) return;

    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    if (requiresVerification && (!playerConfirmed || !verificationToken)) {
      setErrorMessage(
        t.playerVerification.mustVerifyError
      );
      return;
    }

    let cleanWhatsApp: string | undefined = undefined;
    if (isManualWhatsApp) {
      const norm = normalizeWhatsAppNumber(customerWhatsApp);
      if (!norm.valid) {
        setErrorMessage(norm.error || 'Veuillez saisir un numéro WhatsApp valide (+509...) pour ce service.');
        return;
      }
      cleanWhatsApp = norm.normalized;
    }

    if (!canAfford) {
      setErrorMessage(`${t.cart.balanceLow} (${(wallet?.balanceHTG || 0).toLocaleString()} HTG / ${totalPriceHTG.toLocaleString()} HTG).`);
      return;
    }

    setLoadingPurchase(true);
    setErrorMessage(null);

    try {
      const res = await api.checkout([
        {
          productId: selectedProduct.id,
          quantity,
          playerIdentifier: playerIdentifier || undefined,
          verificationToken: verificationToken || undefined,
        }
      ], cleanWhatsApp);

      setPurchaseSuccess(`${t.cart.orderSuccessTitle} - #${res.order.orderNumber}`);
      await refreshUserAndWallet();
      await refreshNotifications();

      setTimeout(() => {
        setPurchaseSuccess(null);
        setSelectedProduct(null);
        setActiveTab('account'); // Navigate to "Mes Achats" library
      }, 2500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors du paiement.');
    } finally {
      setLoadingPurchase(false);
    }
  };

  const handleShareOrDownload = () => {
    if (navigator.share) {
      navigator.share({
        title: displayName,
        text: `${displayName} - ${selectedProduct.priceHTG} HTG`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      window.open(selectedProduct.image, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-[#0e1422] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden relative max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={() => setSelectedProduct(null)}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/70 text-white hover:bg-slate-800 transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-5">
          {/* Product Image & Badges */}
          <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800 mb-2 group aspect-video sm:aspect-[16/10]">
            <img
              src={imageErrors[currentImage] ? 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect fill="%230b0f19" width="400" height="300"/><text fill="%2364748b" font-family="sans-serif" font-size="14" dy="10.5" font-weight="bold" x="50%" y="50%" text-anchor="middle">Image non disponible</text></svg>' : currentImage}
              alt={`${displayName} - Image ${activeImageIndex + 1}`}
              onError={() => setImageErrors(prev => ({ ...prev, [currentImage]: true }))}
              className="w-full h-full object-cover transition-all duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />

            {/* Subcategory & Type badge */}
            <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 pointer-events-none">
              {selectedProduct.subcategoryName && (
                <span className="px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md text-cyan-400 text-[10px] font-bold uppercase tracking-wider border border-cyan-500/30">
                  {selectedProduct.subcategoryName}
                </span>
              )}
              <span className="px-2.5 py-1 rounded-lg bg-slate-900/80 backdrop-blur-md text-slate-300 text-[10px] font-semibold uppercase">
                {selectedProduct.productType}
              </span>
            </div>

            {/* Top Right Action: Fullscreen View & Share */}
            <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsViewerOpen(true)}
                className="p-2 rounded-lg bg-black/60 hover:bg-black/90 backdrop-blur-md text-white transition-all text-xs flex items-center gap-1 cursor-pointer"
                title="Agrandir l'image"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="text-[10px] font-medium hidden sm:inline">Plein écran</span>
              </button>

              <button
                type="button"
                onClick={handleShareOrDownload}
                className="p-2 rounded-lg bg-black/60 hover:bg-black/90 backdrop-blur-md text-white transition-all text-xs flex items-center gap-1 cursor-pointer"
                title={t.common.share}
              >
                <Share2 className="w-3.5 h-3.5" />
                <span className="text-[10px] font-medium">{t.common.share}</span>
              </button>
            </div>

            {/* Price tag on image */}
            <div className="absolute bottom-3 left-3 pointer-events-none">
              {selectedProduct.originalPriceHTG && selectedProduct.originalPriceHTG > selectedProduct.priceHTG && (
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs text-slate-300 line-through font-mono bg-black/60 px-1.5 py-0.5 rounded">
                    {selectedProduct.originalPriceHTG.toLocaleString()} HTG
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-red-600 text-white font-black text-[9px] uppercase tracking-wider">
                    -{Math.round(((selectedProduct.originalPriceHTG - selectedProduct.priceHTG) / selectedProduct.originalPriceHTG) * 100)}%
                  </span>
                </div>
              )}
              <span className="text-xl sm:text-2xl font-black text-white font-['Chakra_Petch'] drop-shadow-md">
                {(selectedProduct.priceHTG ?? 0).toLocaleString()} <span className="text-sm font-bold text-cyan-400">HTG</span>
              </span>
            </div>
          </div>

          {/* Multi-images Thumbnail strip (Scrollable horizontally on Android/mobile) */}
          {galleryList.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-3 scrollbar-none px-0.5">
              {galleryList.map((imgUrl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImageIndex(idx)}
                  className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all cursor-pointer ${
                    idx === activeImageIndex
                      ? 'border-cyan-400 ring-2 ring-cyan-500/40 scale-102 shadow-lg shadow-cyan-500/20'
                      : 'border-slate-800 opacity-60 hover:opacity-100 hover:border-slate-600'
                  }`}
                  title={`Vue ${idx + 1}`}
                >
                  <img
                    src={imageErrors[imgUrl] ? 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50"><rect fill="%231e293b" width="50" height="50"/></svg>' : imgUrl}
                    alt={`Miniature ${idx + 1}`}
                    className="w-full h-full object-cover"
                    onError={() => setImageErrors(prev => ({ ...prev, [imgUrl]: true }))}
                  />
                  <span className="absolute bottom-0.5 right-1 text-[9px] font-mono font-bold text-white drop-shadow">
                    #{idx + 1}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Protected Content Callout badge */}
          {((selectedProduct as any).hasProtectedContent || (selectedProduct as any).protectedContentTitle || selectedProduct.downloadUrl) && (
            <div className="mb-3 p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 flex items-start gap-2.5 text-xs text-indigo-200">
              <Lock className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white block">
                  {(selectedProduct as any).protectedContentTitle || 'Tutoriel / Ressource réservée incluse'}
                </span>
                <p className="text-[11px] text-indigo-300/80 mt-0.5">
                  Ce guide ou fichier est protégé. Il sera automatiquement débloqué et accessible dans votre bibliothèque après confirmation de commande.
                </p>
              </div>
            </div>
          )}

          {/* Title & SKU */}
          <div className="mb-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg sm:text-xl font-black text-white font-['Chakra_Petch'] tracking-wide">
                {displayName}
              </h2>
              <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                {selectedProduct.sku}
              </span>
            </div>
          </div>

          {/* Delivery Mode & Delay Info */}
          <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
            <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${
              isManualWhatsApp
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                : 'bg-cyan-950/30 border-cyan-500/40 text-cyan-300'
            }`}>
              {isManualWhatsApp ? (
                <MessageSquare className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : (
                <Zap className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              )}
              <div className="truncate">
                <span className="font-bold block text-[11px] truncate">
                  {isManualWhatsApp ? 'Traitement WhatsApp' : 'Livraison Immédiate'}
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  {isManualWhatsApp ? 'Prise en charge directe' : 'Code numérique instantané'}
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-2 text-slate-300">
              <Clock className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <div className="truncate">
                <span className="font-bold block text-[11px] truncate">Délai estimé</span>
                <span className="text-[10px] text-cyan-300 font-medium block truncate">
                  {selectedProduct.processingTime || (isManualWhatsApp ? '15 à 60 minutes' : 'Instantané (0 - 5 min)')}
                </span>
              </div>
            </div>
          </div>

          {/* Stock Alert Banner */}
          <div className="mb-4">
            {isOutOfStock ? (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-xs font-black tracking-wider uppercase font-['Chakra_Petch']">
                    {t.common.outOfStock}
                  </span>
                </div>
                <span className="text-[10px] font-medium text-red-300">
                  {t.product.restocking}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  {isManualWhatsApp ? 'Disponibilité du service :' : `${t.product.instantDelivery} :`}
                </span>
                <span className="font-bold text-emerald-400 font-mono">
                  {selectedProduct.stock} {t.catalog.inStock}
                </span>
              </div>
            )}
          </div>

          {/* Description & Customer Instructions */}
          <div className="mb-4 text-xs text-slate-300 leading-relaxed bg-slate-900/40 p-3 rounded-xl border border-slate-800/80">
            <p>{displayDesc}</p>
            {(selectedProduct.customerInstructions || selectedProduct.deliveryInstructions) && (
              <div className="mt-2 pt-2 border-t border-slate-800 flex items-start gap-1.5 text-slate-300 text-[11px]">
                <Info className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 mt-0.5" />
                <span>{selectedProduct.customerInstructions || selectedProduct.deliveryInstructions}</span>
              </div>
            )}
          </div>

          {/* Additional Verification notice if required */}
          {selectedProduct.requiresAdditionalVerification && (
            <div className="mb-4 p-2.5 rounded-xl bg-blue-950/30 border border-blue-500/30 text-[11px] text-blue-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Vérification manuelle requise</span>
                <p className="text-[10px] text-slate-300">
                  {selectedProduct.additionalVerificationInstructions || 'Cette commande fera l\'objet d\'une validation de sécurité avant traitement final.'}
                </p>
              </div>
            </div>
          )}

          {/* Game Player ID Verification Module */}
          {requiresVerification && platform ? (
            <div className="mb-4">
              <PlayerVerificationCard
                platform={platform}
                productId={selectedProduct.id}
                initialIdentifier={playerIdentifier}
                initialToken={verificationToken || undefined}
                initialVerifiedInfo={verifiedInfo}
                initialConfirmed={playerConfirmed}
                onVerificationConfirmed={({ playerIdentifier: id, verificationToken: token, verifiedInfo: info }) => {
                  setPlayerIdentifier(id);
                  setVerificationToken(token);
                  setVerifiedInfo(info);
                  setPlayerConfirmed(true);
                  setErrorMessage(null);
                }}
                onResetVerification={() => {
                  setPlayerConfirmed(false);
                  setVerificationToken(null);
                  setVerifiedInfo(null);
                }}
              />
            </div>
          ) : isGameTopup ? (
            <div className="mb-4 p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/20">
              <label className="block text-[11px] font-bold text-cyan-300 mb-1 flex items-center gap-1.5">
                <Gamepad2 className="w-3.5 h-3.5 text-cyan-400" />
                UID / ID Joueur (Optionnel pour recharge directe)
              </label>
              <input
                type="text"
                value={playerIdentifier}
                onChange={e => setPlayerIdentifier(e.target.value)}
                placeholder="Ex: 512893041 (Free Fire UID)"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Si laissé vide, un code numérique d'activation instantané vous sera remis.
              </p>
            </div>
          ) : null}

          {/* WhatsApp Requirement Input */}
          {isManualWhatsApp && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
              <label className="block text-xs font-bold text-emerald-400 mb-1 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                Numéro WhatsApp requis *
              </label>
              <p className="text-[11px] text-slate-300 mb-2">
                Ce service nécessite un contact direct par notre équipe. Veuillez saisir votre numéro WhatsApp pour la validation et livraison :
              </p>
              <input
                type="tel"
                value={customerWhatsApp}
                onChange={e => {
                  setCustomerWhatsApp(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Ex: +509 34 58 4287 ou 34584287"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                Donnée strictement confidentielle, uniquement utilisée pour le traitement de votre commande.
              </p>
            </div>
          )}

          {/* Quantity Selector */}
          {!isOutOfStock && (
            <div className="flex items-center justify-between mb-4 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <span className="text-xs font-medium text-slate-300">{t.common.quantity} :</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-7 h-7 rounded-lg bg-slate-800 text-white font-bold flex items-center justify-center hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  -
                </button>
                <span className="w-8 text-center text-xs font-bold font-mono text-white">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(Math.min(selectedProduct.stock, quantity + 1))}
                  className="w-7 h-7 rounded-lg bg-slate-800 text-white font-bold flex items-center justify-center hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-3 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs flex items-center justify-between gap-2">
              <span>{errorMessage}</span>
              {!canAfford && (
                <button
                  onClick={() => { setSelectedProduct(null); setIsRechargeModalOpen(true); }}
                  className="px-2.5 py-1 rounded bg-cyan-500 text-black font-bold text-[11px] whitespace-nowrap cursor-pointer"
                >
                  {t.wallet.depositTitle}
                </button>
              )}
            </div>
          )}

          {/* Purchase Success Feedback */}
          {purchaseSuccess && (
            <div className="mb-3 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{purchaseSuccess}</span>
            </div>
          )}

          {/* Added to cart toast */}
          {addedToCartToast && (
            <div className="mb-3 p-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs text-center font-bold">
              {t.product.addedToCart}
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="p-3 sm:p-4 bg-slate-900/95 border-t border-slate-800 flex items-center gap-2">
          {isOutOfStock ? (
            <button
              disabled
              className="w-full py-3 rounded-xl bg-slate-800 text-slate-500 font-bold text-xs uppercase tracking-wider cursor-not-allowed"
            >
              {t.common.outOfStock}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleAddToCart}
                className={`flex-1 py-3 px-3 rounded-xl text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer border ${
                  requiresVerification && !playerConfirmed
                    ? 'bg-slate-900 border-slate-800 text-slate-400'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700'
                }`}
              >
                <ShoppingBag className="w-4 h-4 text-cyan-400" />
                <span className="truncate">{t.common.cart}</span>
              </button>

              <button
                type="button"
                disabled={loadingPurchase}
                onClick={handleInstantBuy}
                className={`flex-[2] py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer ${
                  requiresVerification && !playerConfirmed
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black shadow-amber-500/20'
                    : 'bg-gradient-to-r from-cyan-500 via-cyan-400 to-emerald-400 hover:opacity-90 text-black shadow-cyan-500/25'
                }`}
              >
                {requiresVerification && !playerConfirmed ? (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span className="truncate">{t.playerVerification.title}</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-black" />
                    <span className="truncate">
                      {loadingPurchase ? t.common.loading : `${t.common.buy} (${(totalPriceHTG ?? 0).toLocaleString()} HTG)`}
                    </span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Fullscreen Image Viewer Modal */}
      {isViewerOpen && (
        <div 
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-3 select-none animate-in fade-in duration-200"
        >
          {/* Top Bar with counter & close */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-30">
            <span className="text-xs font-mono font-bold text-slate-300 bg-black/60 px-3 py-1.5 rounded-full border border-slate-800">
              {activeImageIndex + 1} / {galleryList.length}
            </span>
            <button
              type="button"
              onClick={() => setIsViewerOpen(false)}
              className="p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700 transition-colors cursor-pointer"
              title="Fermer le plein écran"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Fullscreen Image Container */}
          <div className="relative w-full max-w-4xl max-h-[80vh] flex items-center justify-center">
            {galleryList.length > 1 && (
              <button
                type="button"
                onClick={() => setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : galleryList.length - 1))}
                className="absolute left-2 sm:left-4 z-20 p-2.5 rounded-full bg-black/70 hover:bg-black text-white border border-white/20 transition-all cursor-pointer"
                title="Image précédente"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}

            <img
              src={currentImage}
              alt={displayName}
              className="max-w-full max-h-[78vh] object-contain rounded-xl shadow-2xl"
            />

            {galleryList.length > 1 && (
              <button
                type="button"
                onClick={() => setActiveImageIndex((prev) => (prev < galleryList.length - 1 ? prev + 1 : 0))}
                className="absolute right-2 sm:right-4 z-20 p-2.5 rounded-full bg-black/70 hover:bg-black text-white border border-white/20 transition-all cursor-pointer"
                title="Image suivante"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
