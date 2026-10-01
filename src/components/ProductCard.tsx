import React, { useState } from 'react';
import { Product } from '../types.js';
import { useI18n } from '../context/I18nContext.js';
import { Download, MessageSquare, Zap, Layers } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
  variant?: 'standard' | 'compact';
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onSelect,
  variant = 'standard'
}) => {
  const { t, getProductName, getProductDescription } = useI18n();

  // Strict guard: ensure item is a valid Product and NEVER an affiche / promotional poster
  if (
    !product ||
    typeof product !== 'object' ||
    typeof product.priceHTG !== 'number' ||
    product.id.startsWith('poster-') ||
    (product as any).templateType !== undefined
  ) {
    return null;
  }

  const displayName = getProductName(product);
  const displayDesc = getProductDescription(product);
  const isOutOfStock = product.stock <= 0;
  const hasDiscount = product.originalPriceHTG && product.originalPriceHTG > product.priceHTG;
  const discountPercent = hasDiscount
    ? Math.round(((product.originalPriceHTG! - product.priceHTG) / product.originalPriceHTG!) * 100)
    : 0;

  if (variant === 'compact') {
    return (
      <div
        onClick={() => onSelect(product)}
        className="group relative bg-[#0e1422] border border-slate-800 hover:border-purple-500/50 rounded-xl overflow-hidden cursor-pointer flex flex-col justify-between transition-all hover:-translate-y-0.5 shadow-sm hover:shadow-purple-500/10"
      >
        <div className="relative aspect-square w-full overflow-hidden bg-slate-900">
          <img
            src={product.image}
            alt={displayName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-purple-600/90 text-white text-[8px] font-black uppercase">
            {product.subcategoryName || 'NOUVEAU'}
          </span>
          {isOutOfStock && (
            <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-red-600 text-white text-[8px] font-black uppercase">
              {t.common.outOfStock}
            </span>
          )}
        </div>

        <div className="p-2 flex-1 flex flex-col justify-between">
          <h3 className="text-[11px] sm:text-xs font-bold text-white line-clamp-1 group-hover:text-purple-300 transition-colors">
            {displayName}
          </h3>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[11px] font-black text-white font-mono">
              {(product.priceHTG ?? 0).toLocaleString()} <span className="text-[9px] text-purple-400 font-bold">HTG</span>
            </span>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onSelect(product);
              }}
              className="px-2 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500 hover:text-black text-purple-300 text-[9px] font-bold uppercase transition-colors cursor-pointer"
            >
              {isOutOfStock ? t.common.outOfStock : 'Voir'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => onSelect(product)}
      className={`group relative bg-[#0e1422] border rounded-2xl overflow-hidden cursor-pointer flex flex-col justify-between transition-all hover:-translate-y-1 shadow-md ${
        isOutOfStock
          ? 'border-red-950/60 opacity-80'
          : 'border-slate-800 hover:border-cyan-500/50 hover:shadow-cyan-500/10'
      }`}
    >
      {/* Product Image & Badges */}
      <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
        <img
          src={product.image}
          alt={displayName}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect fill="%230f172a" width="300" height="200"/><text fill="%23475569" font-family="sans-serif" font-size="12" dy="10.5" font-weight="bold" x="50%" y="50%" text-anchor="middle">Image non disponible</text></svg>';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

        {/* Subcategory / Platform tag */}
        <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/75 backdrop-blur-md text-cyan-400 text-[9px] font-extrabold uppercase border border-cyan-500/30">
          {product.subcategoryName || product.productType || 'PRODUIT'}
        </span>

        {/* Multi-image indicator badge */}
        {product.galleryImages && product.galleryImages.length > 0 && (
          <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-md text-slate-300 text-[8px] font-mono font-bold flex items-center gap-1 border border-slate-700/80">
            <Layers className="w-2.5 h-2.5 text-cyan-400" />
            <span>{product.galleryImages.length + 1} photos</span>
          </span>
        )}

        {/* Delivery mode mini badge */}
        <span
          className={`absolute bottom-2 left-2 px-1.5 py-0.5 rounded text-[8px] font-black uppercase flex items-center gap-1 backdrop-blur-md ${
            product.deliveryType === 'DOWNLOAD_LINK'
              ? 'bg-blue-950/80 border border-blue-500/40 text-blue-300'
              : product.deliveryType === 'MANUAL_WHATSAPP' || product.requiresWhatsApp
              ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-300'
              : 'bg-cyan-950/80 border border-cyan-500/40 text-cyan-300'
          }`}
        >
          {product.deliveryType === 'DOWNLOAD_LINK' ? (
            <>
              <Download className="w-2.5 h-2.5 text-blue-400" />
              <span>Téléchargement</span>
            </>
          ) : product.deliveryType === 'MANUAL_WHATSAPP' || product.requiresWhatsApp ? (
            <>
              <MessageSquare className="w-2.5 h-2.5 text-emerald-400" />
              <span>WhatsApp</span>
            </>
          ) : (
            <>
              <Zap className="w-2.5 h-2.5 text-cyan-400" />
              <span>Instant</span>
            </>
          )}
        </span>

        {/* Stock status badge */}
        {isOutOfStock ? (
          <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-red-600 text-white text-[9px] font-black uppercase">
            {t.common.outOfStock}
          </span>
        ) : product.lowStockThreshold && product.stock <= product.lowStockThreshold ? (
          <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-amber-500/90 border border-amber-300/40 text-black text-[9px] font-black uppercase">
            Plus que {product.stock} !
          </span>
        ) : (
          <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-[9px] font-bold">
            {t.common.stock}: {product.stock}
          </span>
        )}
      </div>

      {/* Product Content Details & Buy Action */}
      <div className="p-3 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-xs sm:text-sm font-bold text-white line-clamp-1 group-hover:text-cyan-400 transition-colors">
            {displayName}
          </h3>
          <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
            {displayDesc}
          </p>
        </div>

        <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1">
          <div>
            {hasDiscount && (
              <div className="flex items-center gap-1 leading-none mb-0.5">
                <span className="text-[10px] text-slate-500 line-through font-mono">
                  {product.originalPriceHTG!.toLocaleString()}
                </span>
                <span className="text-[9px] text-red-400 font-bold">
                  -{discountPercent}%
                </span>
              </div>
            )}
            <span className="text-xs sm:text-sm font-black text-white font-['Chakra_Petch']">
              {(product.priceHTG ?? 0).toLocaleString()}{' '}
              <span className="text-[10px] text-cyan-400 font-bold">HTG</span>
            </span>
          </div>

          {isOutOfStock ? (
            <span className="text-[10px] font-black text-red-400 uppercase px-2 py-0.5 rounded bg-red-950/40 border border-red-900/50">
              {t.common.outOfStock}
            </span>
          ) : (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onSelect(product);
              }}
              className="px-2.5 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-[10px] uppercase shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              {t.common.buy}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
