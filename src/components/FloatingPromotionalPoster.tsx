import React, { useEffect } from 'react';
import { PromotionalPoster } from '../types.js';
import { X } from 'lucide-react';

interface FloatingPromotionalPosterProps {
  poster: PromotionalPoster | null;
  isOpen: boolean;
  onClose: () => void;
  onAction?: (poster: PromotionalPoster) => void;
  // Optional legacy props kept for backward type compatibility
  allPosters?: PromotionalPoster[];
  currentIndex?: number;
  onNavigate?: (index: number) => void;
}

/**
 * FloatingPromotionalPoster
 * 
 * RÈGLE ABSOLUE : IMAGE UPLOADÉE = IMAGE AFFICHÉE
 * - Uniquement un overlay flottant (position: fixed) qui ne participe JAMAIS au flux du document
 * - Rend strictement NULL s'il n'y a pas d'affiche active ou si l'overlay est fermé (aucun espace réservé)
 * - Aucune altération graphique : pas de cadre, pas de fond coloré, pas de boîte décorative
 * - Les images PNG transparentes conservent intégralement leur transparence
 * - Respect strict du ratio d'origine (object-fit: contain)
 * - Aucun texte, coupon, badge, remise ou bouton automatique généré
 * - Uniquement : Backdrop séparé + Image 100% originale + Bouton X de fermeture
 * - Clic sur l'image redirige vers poster.actionUrl si configuré
 */
export const FloatingPromotionalPoster: React.FC<FloatingPromotionalPosterProps> = ({
  poster,
  isOpen,
  onClose,
  onAction,
}) => {
  // ESC key dismissal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Strict guard: if not open or no poster, render absolutely NOTHING
  if (
    !isOpen ||
    !poster ||
    typeof poster !== 'object' ||
    (poster as any).priceHTG !== undefined
  ) {
    return null;
  }

  const posterImg =
    poster.imageUrl ||
    poster.renderedImageUrl ||
    poster.thumbnailUrl ||
    poster.content?.imageUrl ||
    '';

  if (!posterImg) {
    return null;
  }

  const handleClickImage = () => {
    if (poster.actionUrl) {
      onClose();
      if (onAction) {
        onAction(poster);
      } else if (poster.actionUrl.startsWith('http://') || poster.actionUrl.startsWith('https://')) {
        window.open(poster.actionUrl, '_blank', 'noopener,noreferrer');
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={poster.title || 'Affiche promotionnelle'}
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 md:p-6 select-none"
    >
      {/* 1. Backdrop: independent semi-transparent dark overlay separating poster from page */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 bg-black/80 backdrop-blur-xs transition-opacity duration-200 cursor-pointer"
      />

      {/* 2. Floating Image Container: NO border, NO card background, NO decorative frame */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 flex items-center justify-center max-w-[92vw] sm:max-w-[85vw] md:max-w-2xl lg:max-w-3xl max-h-[85vh] animate-in zoom-in-95 duration-200"
      >
        {/* Simple & clearly accessible close button X */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          title="Fermer"
          className="absolute -top-3 -right-3 sm:-top-4 sm:-right-4 z-20 p-2 sm:p-2.5 rounded-full bg-black/85 hover:bg-black text-white border border-white/20 shadow-2xl backdrop-blur-md cursor-pointer transition-transform active:scale-90 flex items-center justify-center min-w-[38px] min-h-[38px]"
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </button>

        {/* 100% Original Image: contain fit, preserving aspect ratio & transparency */}
        <img
          src={posterImg}
          alt={poster.title || 'Affiche promotionnelle'}
          onClick={poster.actionUrl ? handleClickImage : undefined}
          className={`max-w-full max-h-[82vh] object-contain block transition-transform ${
            poster.actionUrl ? 'cursor-pointer hover:opacity-95' : 'cursor-default'
          }`}
          style={{ background: 'transparent' }}
        />
      </div>
    </div>
  );
};
