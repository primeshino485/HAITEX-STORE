import React, { useState } from 'react';
import { PromotionalPoster } from '../types.js';
import { Sparkles, Tag, Clock, ArrowRight, Maximize2, Copy, Check } from 'lucide-react';

interface PromotionalPosterCardProps {
  poster: PromotionalPoster;
  onAction?: (poster: PromotionalPoster) => void;
  onOpenModal?: (poster: PromotionalPoster) => void;
  variant?: 'hero' | 'card';
}

export const PromotionalPosterCard: React.FC<PromotionalPosterCardProps> = ({
  poster,
  onAction,
  onOpenModal,
  variant = 'card',
}) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Strict guard: ensure item is a PromotionalPoster and NEVER a Product
  if (
    !poster ||
    typeof poster !== 'object' ||
    (poster as any).priceHTG !== undefined ||
    (poster as any).sku !== undefined
  ) {
    return null;
  }

  const posterImg =
    poster.imageUrl ||
    poster.renderedImageUrl ||
    poster.thumbnailUrl ||
    poster.content?.imageUrl ||
    '';

  const posterCode =
    poster.couponSnapshot?.code ||
    poster.content?.couponCode ||
    '';

  const posterDiscount =
    poster.content?.discountValue ||
    (poster.couponSnapshot ? `-${poster.couponSnapshot.discountPercent}%` : '');

  const posterHeadline =
    poster.description ||
    poster.content?.headline ||
    '';

  const posterSecondary =
    poster.content?.secondaryText ||
    '';

  const posterBadge =
    poster.content?.badgeText ||
    (poster.type === 'FLASH_SALE'
      ? 'VENTE FLASH'
      : poster.type === 'ANNIVERSARY'
      ? 'ANNIVERSAIRE'
      : poster.type === 'EVENT'
      ? 'ÉVÉNEMENT'
      : 'OFFRE PROMOTIONNELLE');

  const actionText =
    poster.actionLabel ||
    poster.content?.callToAction ||
    (onAction ? 'Découvrir la promotion' : null);

  const handleCopyCode = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  // Hero variant (Full-width banner for main promotional hero spotlight)
  if (variant === 'hero') {
    return (
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-[#0d1527] to-slate-950 border-2 border-amber-500/40 p-5 sm:p-7 shadow-2xl transition-all duration-300">
        {/* Ambient atmospheric lighting */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-amber-500/15 via-cyan-500/10 to-transparent blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-amber-500/10 via-purple-500/10 to-transparent blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 lg:gap-8 justify-between">
          {/* Left: Promotional Copy & Badges */}
          <div className="space-y-3.5 flex-1 min-w-0">
            {/* Top Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[11px] font-black uppercase tracking-wider shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>{posterBadge}</span>
              </span>

              {posterDiscount && (
                <span className="px-2.5 py-0.5 rounded-full bg-red-500/25 border border-red-500/50 text-red-300 text-[11px] font-black uppercase">
                  {posterDiscount}
                </span>
              )}

              {poster.expiresAt && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 text-[10px] font-mono">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>
                    Valable jusqu'au{' '}
                    {new Date(poster.expiresAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </span>
              )}
            </div>

            {/* Poster Title */}
            <h2 className="text-xl sm:text-3xl lg:text-4xl font-black text-white uppercase tracking-wide font-['Chakra_Petch'] leading-tight drop-shadow-md">
              {poster.title}
            </h2>

            {/* Headline / Description */}
            {posterHeadline && (
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium max-w-xl">
                {posterHeadline}
              </p>
            )}

            {posterSecondary && (
              <p className="text-[11px] sm:text-xs text-slate-400 line-clamp-2">
                {posterSecondary}
              </p>
            )}

            {/* Coupon Code & Action CTA */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {posterCode && (
                <div className="flex items-center gap-2 p-1.5 px-3.5 rounded-xl bg-slate-950/90 border border-amber-500/50 shadow-inner">
                  <Tag className="w-4 h-4 text-amber-400" />
                  <span className="text-xs sm:text-sm font-mono font-black text-white tracking-wider">
                    {posterCode}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleCopyCode(e, posterCode)}
                    className="ml-1 p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
                    title="Copier le code promo"
                  >
                    {copiedCode === posterCode ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              )}

              {actionText && onAction && (
                <button
                  type="button"
                  onClick={() => onAction(poster)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/25 flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
                >
                  <span>{actionText}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {Boolean(posterImg) && onOpenModal && (
                <button
                  type="button"
                  onClick={() => onOpenModal(poster)}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Agrandir</span>
                </button>
              )}
            </div>
          </div>

          {/* Right: Billboard Visual Image */}
          {Boolean(posterImg) && (
            <div
              onClick={() => onOpenModal?.(poster)}
              className="w-full sm:w-72 md:w-80 lg:w-96 shrink-0 aspect-[4/3] sm:aspect-square rounded-2xl overflow-hidden border-2 border-amber-500/30 bg-slate-950 shadow-2xl relative group cursor-pointer"
              title="Cliquer pour afficher l'affiche promotionnelle en grand format"
            >
              <img
                src={posterImg}
                alt={poster.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-xs">
                <div className="p-3 rounded-full bg-amber-500 text-black shadow-xl transform scale-90 group-hover:scale-100 transition-transform">
                  <Maximize2 className="w-5 h-5" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Card / Banner Gallery variant
  return (
    <div
      onClick={() => onOpenModal?.(poster)}
      className="group relative bg-[#0e1422] border-2 border-amber-500/30 hover:border-amber-400/60 rounded-2xl overflow-hidden shadow-lg hover:shadow-amber-500/10 transition-all flex flex-col justify-between cursor-pointer"
    >
      {/* Top Banner Visual */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-950">
        {posterImg ? (
          <img
            src={posterImg}
            alt={poster.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-amber-950/30 p-4 text-center">
            <Sparkles className="w-8 h-8 text-amber-400 mb-1" />
            <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
              {posterBadge}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

        {/* Top Badges */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded bg-black/75 backdrop-blur-md text-amber-300 text-[9px] font-extrabold uppercase border border-amber-500/40">
            {posterBadge}
          </span>
          {posterDiscount && (
            <span className="px-2 py-0.5 rounded bg-red-600/90 text-white text-[9px] font-black uppercase">
              {posterDiscount}
            </span>
          )}
        </div>

        {/* Zoom icon affordance */}
        <div className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-slate-300 group-hover:text-amber-300 transition-colors backdrop-blur-xs">
          <Maximize2 className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Content */}
      <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
        <div>
          <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wide font-['Chakra_Petch'] line-clamp-1 group-hover:text-amber-300 transition-colors">
            {poster.title}
          </h3>

          {posterHeadline && (
            <p className="text-[11px] text-slate-300 line-clamp-2 mt-1 font-medium">
              {posterHeadline}
            </p>
          )}

          {posterSecondary && (
            <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
              {posterSecondary}
            </p>
          )}
        </div>

        {/* Promo code & Action footer */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
          {posterCode ? (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[10px] font-mono font-bold text-amber-300">
              <Tag className="w-3 h-3 text-amber-400 shrink-0" />
              <span>{posterCode}</span>
              <button
                type="button"
                onClick={(e) => handleCopyCode(e, posterCode)}
                className="ml-1 p-0.5 hover:text-white transition-colors"
                title="Copier le code"
              >
                {copiedCode === posterCode ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
          ) : (
            <span className="text-[10px] text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Offre spéciale</span>
            </span>
          )}

          {actionText && onAction ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAction(poster);
              }}
              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-[10px] uppercase shadow-sm transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
            >
              <span>{actionText}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenModal?.(poster);
              }}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold uppercase transition-colors"
            >
              Agrandir
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
