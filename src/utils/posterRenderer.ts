import { PromotionalPoster, PosterFormat, PosterTemplateType, PosterThemeStyle } from '../types';

export interface RenderPosterOptions {
  scale?: number; // 1 for standard preview, 2 for ultra-high res export
  targetFormat?: PosterFormat;
}

export const POSTER_DIMENSIONS: Record<PosterFormat, { width: number; height: number; label: string; aspect: string }> = {
  '1:1': { width: 1080, height: 1080, label: 'Carré (1:1)', aspect: 'aspect-square' },
  '4:5': { width: 1080, height: 1350, label: 'Portrait (4:5)', aspect: 'aspect-[4/5]' },
  '9:16': { width: 1080, height: 1920, label: 'Story (9:16)', aspect: 'aspect-[9/16]' },
  'banner': { width: 1200, height: 480, label: 'Bannière (2.5:1)', aspect: 'aspect-[5/2]' },
};

export const THEME_CONFIGS: Record<PosterThemeStyle, {
  name: string;
  bgGradient: [string, string, string];
  accent: string;
  accentSecondary: string;
  accentText: string;
  badgeBg: string;
  badgeBorder: string;
  codeBg: string;
  codeBorder: string;
}> = {
  cyber_cyan: {
    name: 'Cyber Cyan (Néon)',
    bgGradient: ['#050b14', '#0d1a2d', '#03070d'],
    accent: '#06b6d4',
    accentSecondary: '#3b82f6',
    accentText: '#000000',
    badgeBg: 'rgba(6, 182, 212, 0.15)',
    badgeBorder: '#06b6d4',
    codeBg: 'rgba(6, 182, 212, 0.12)',
    codeBorder: '#22d3ee',
  },
  midnight_blue: {
    name: 'Midnight Blue (Royal)',
    bgGradient: ['#020617', '#0f172a', '#020617'],
    accent: '#38bdf8',
    accentSecondary: '#818cf8',
    accentText: '#000000',
    badgeBg: 'rgba(56, 189, 248, 0.15)',
    badgeBorder: '#38bdf8',
    codeBg: 'rgba(56, 189, 248, 0.12)',
    codeBorder: '#38bdf8',
  },
  gold_luxury: {
    name: 'Gold Luxury (Prestige)',
    bgGradient: ['#120e06', '#261c0b', '#0a0803'],
    accent: '#fbbf24',
    accentSecondary: '#f59e0b',
    accentText: '#000000',
    badgeBg: 'rgba(251, 191, 36, 0.15)',
    badgeBorder: '#fbbf24',
    codeBg: 'rgba(251, 191, 36, 0.12)',
    codeBorder: '#fbbf24',
  },
  crimson_gaming: {
    name: 'Crimson Gaming (Action)',
    bgGradient: ['#140407', '#2b070f', '#0a0204'],
    accent: '#f43f5e',
    accentSecondary: '#fb7185',
    accentText: '#ffffff',
    badgeBg: 'rgba(244, 63, 94, 0.15)',
    badgeBorder: '#f43f5e',
    codeBg: 'rgba(244, 63, 94, 0.12)',
    codeBorder: '#fb7185',
  },
  emerald_pro: {
    name: 'Emerald Pro (Légendaire)',
    bgGradient: ['#02120a', '#062615', '#010b05'],
    accent: '#10b981',
    accentSecondary: '#34d399',
    accentText: '#000000',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    badgeBorder: '#10b981',
    codeBg: 'rgba(16, 185, 129, 0.12)',
    codeBorder: '#34d399',
  },
  violet_neon: {
    name: 'Violet Neon (Futuriste)',
    bgGradient: ['#0d041a', '#1e0a38', '#07020e'],
    accent: '#c084fc',
    accentSecondary: '#e879f9',
    accentText: '#000000',
    badgeBg: 'rgba(192, 132, 252, 0.15)',
    badgeBorder: '#c084fc',
    codeBg: 'rgba(192, 132, 252, 0.12)',
    codeBorder: '#e879f9',
  },
};

export const TEMPLATE_PRESETS: Record<PosterTemplateType, {
  label: string;
  defaultBadge: string;
  defaultTitle: string;
  defaultHeadline: string;
  defaultSecondary: string;
  defaultDiscount: string;
  defaultCta: string;
  suggestedTheme: PosterThemeStyle;
}> = {
  PROMOTION: {
    label: 'Promotion Générale',
    defaultBadge: 'PROMOTION EXCLUSIVE',
    defaultTitle: 'MÉGA PROMOTION DU MOIS',
    defaultHeadline: 'Des réductions exceptionnelles sur tout le store !',
    defaultSecondary: 'Recharges Free Fire, Call of Duty, Netflix, Spotify et plus.',
    defaultDiscount: '-25%',
    defaultCta: 'COMMANDER MAINTENANT',
    suggestedTheme: 'cyber_cyan',
  },
  ANNIVERSARY: {
    label: 'Anniversaire',
    defaultBadge: 'CÉLÉBRATION ANNIVERSAIRE',
    defaultTitle: 'NOTRE PREMIER ANNIVERSAIRE',
    defaultHeadline: "Aujourd'hui est notre premier anniversaire !",
    defaultSecondary: 'Pour vous remercier de vos achats réguliers, profitez de cette offre spéciale.',
    defaultDiscount: '-20%',
    defaultCta: "PROFITEZ DE L'OFFRE",
    suggestedTheme: 'gold_luxury',
  },
  NEW_PRODUCT: {
    label: 'Nouveau Produit',
    defaultBadge: 'NOUVEAUTÉ EN STOCK',
    defaultTitle: 'NOUVEL ARRIVAGE GAMING',
    defaultHeadline: 'Découvrez nos derniers pass et packs numériques !',
    defaultSecondary: 'Livraison instantanée 24/7 sur votre compte.',
    defaultDiscount: 'EXCLUSIVITÉ',
    defaultCta: 'DÉCOUVRIR LE PRODUIT',
    suggestedTheme: 'crimson_gaming',
  },
  NEW_SERVICE: {
    label: 'Nouveau Service',
    defaultBadge: 'NOUVEAU SERVICE DISPONIBLE',
    defaultTitle: 'ABONNEMENTS STREAMING HD',
    defaultHeadline: 'Accédez aux meilleures séries et musiques sans interruption.',
    defaultSecondary: 'Activation ultra-rapide avec paiement MonCash ou NatCash.',
    defaultDiscount: 'NOUVEAU',
    defaultCta: 'S\'ABONNER AUJOURD\'HUI',
    suggestedTheme: 'midnight_blue',
  },
  LIMITED_OFFER: {
    label: 'Offre Limitée',
    defaultBadge: 'FLASH SALE • TEMPS LIMITÉ',
    defaultTitle: 'VENTE FLASH DU WEEK-END',
    defaultHeadline: 'Quantités limitées ! Premiers arrivés, premiers servis.',
    defaultSecondary: 'Valable sur une sélection exclusive de recharges numériques.',
    defaultDiscount: '-30%',
    defaultCta: 'EN PROFITER AVANT LA FIN',
    suggestedTheme: 'crimson_gaming',
  },
  CUSTOMER_THANKS: {
    label: 'Remerciement Client',
    defaultBadge: 'MERCI POUR VOTRE FIDÉLITÉ',
    defaultTitle: 'UN CADEAU POUR NOS CLIENTS',
    defaultHeadline: 'Votre fidélité est notre plus belle récompense.',
    defaultSecondary: 'Voici une réduction spéciale sur votre prochaine commande.',
    defaultDiscount: '-15%',
    defaultCta: 'RÉCLAMER MA RÉDUCTION',
    suggestedTheme: 'emerald_pro',
  },
  COUPON: {
    label: 'Coupon Spécial',
    defaultBadge: 'BON DE RÉDUCTION',
    defaultTitle: 'VOTRE CODE PROMO EXCLUSIF',
    defaultHeadline: 'Appliquez votre code promo dès maintenant au panier !',
    defaultSecondary: 'Économisez instantanément sur votre solde ou votre commande.',
    defaultDiscount: '-20%',
    defaultCta: 'UTILISER LE CODE',
    suggestedTheme: 'cyber_cyan',
  },
  CUSTOM: {
    label: 'Annonce Personnalisée',
    defaultBadge: 'ANNONCE OFFICIELLE',
    defaultTitle: 'ANNONCE MY STORE',
    defaultHeadline: 'Message important pour toute notre communauté.',
    defaultSecondary: 'Suivez nos actualités et restez connectés.',
    defaultDiscount: '',
    defaultCta: 'VISITER LA BOUTIQUE',
    suggestedTheme: 'violet_neon',
  },
};

/**
 * Loads an image safely with promise
 */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src || typeof src !== 'string' || src.trim() === '') {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Try again without crossOrigin in case it's a relative path or local data URI
      const fallback = new Image();
      fallback.onload = () => resolve(fallback);
      fallback.onerror = () => resolve(null);
      fallback.src = src;
    };
    img.src = src;
  });
}

/**
 * Wraps text into lines for Canvas 2D
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = words[0] || '';

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + ' ' + word).width;
    if (width < maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

/**
 * High-definition Canvas 2D Rendering Engine for Professional Posters
 */
export async function renderPosterToCanvas(
  canvas: HTMLCanvasElement,
  poster: Partial<PromotionalPoster>,
  options: RenderPosterOptions = {}
): Promise<HTMLCanvasElement> {
  const format: PosterFormat = poster.format || options.targetFormat || '1:1';
  const dims = POSTER_DIMENSIONS[format];
  const width = dims.width;
  const height = dims.height;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Impossible d\'obtenir le contexte Canvas 2D.');

  const content = poster.content || {
    themeStyle: 'cyber_cyan',
    showStoreBranding: true,
  };

  const themeStyle = content.themeStyle || 'cyber_cyan';
  const theme = THEME_CONFIGS[themeStyle] || THEME_CONFIGS.cyber_cyan;
  const primaryAccent = content.customAccentColor && content.customAccentColor.startsWith('#')
    ? content.customAccentColor
    : theme.accent;

  // 1. BASE BACKGROUND GRADIENT
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, theme.bgGradient[0]);
  bgGrad.addColorStop(0.5, theme.bgGradient[1]);
  bgGrad.addColorStop(1, theme.bgGradient[2]);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. AMBIENT GLOW EFFECTS & MESH
  const topGlow = ctx.createRadialGradient(width * 0.8, height * 0.15, 50, width * 0.8, height * 0.15, width * 0.7);
  topGlow.addColorStop(0, primaryAccent + '25'); // 15% opacity
  topGlow.addColorStop(0.6, theme.accentSecondary + '10');
  topGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, width, height);

  const bottomGlow = ctx.createRadialGradient(width * 0.2, height * 0.85, 50, width * 0.2, height * 0.85, width * 0.6);
  bottomGlow.addColorStop(0, primaryAccent + '20');
  bottomGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = bottomGlow;
  ctx.fillRect(0, 0, width, height);

  // Subtle Cyber Grid Lines
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  const gridSize = 60;
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();

  // 3. ELEGANT OUTER BORDER ACCENT
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 2;
  ctx.strokeRect(30, 30, width - 60, height - 60);

  // Corner tech ticks
  ctx.strokeStyle = primaryAccent;
  ctx.lineWidth = 4;
  const tickLen = 40;
  // Top-left
  ctx.beginPath();
  ctx.moveTo(30, 30 + tickLen);
  ctx.lineTo(30, 30);
  ctx.lineTo(30 + tickLen, 30);
  ctx.stroke();
  // Top-right
  ctx.beginPath();
  ctx.moveTo(width - 30 - tickLen, 30);
  ctx.lineTo(width - 30, 30);
  ctx.lineTo(width - 30, 30 + tickLen);
  ctx.stroke();
  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(30, height - 30 - tickLen);
  ctx.lineTo(30, height - 30);
  ctx.lineTo(30 + tickLen, height - 30);
  ctx.stroke();
  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(width - 30 - tickLen, height - 30);
  ctx.lineTo(width - 30, height - 30);
  ctx.lineTo(width - 30, height - 30 - tickLen);
  ctx.stroke();
  ctx.restore();

  // Load external images if provided
  const [userImage, logoImg] = await Promise.all([
    loadImage(content.imageUrl || ''),
    loadImage(content.logoUrl || ''),
  ]);

  // Dynamic Layout positioning based on format
  const paddingX = 70;
  let currentY = 75;

  // 4. HEADER: STORE BRANDING
  if (content.showStoreBranding !== false) {
    const storeName = content.storeName || 'MY STORE';
    const tagline = content.tagline || 'DIGITAL GAMING & STREAMING';

    ctx.save();
    if (logoImg) {
      // Draw store logo
      const logoSize = 64;
      ctx.drawImage(logoImg, paddingX, currentY - 5, logoSize, logoSize);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px "Chakra Petch", "Segoe UI", Arial, sans-serif';
      ctx.fillText(storeName.toUpperCase(), paddingX + logoSize + 16, currentY + 28);

      ctx.fillStyle = primaryAccent;
      ctx.font = '600 13px "Chakra Petch", "Segoe UI", Arial, sans-serif';
      ctx.letterSpacing = '2px';
      ctx.fillText(tagline.toUpperCase(), paddingX + logoSize + 16, currentY + 48);
    } else {
      // Text Logo with neon emblem
      ctx.fillStyle = primaryAccent;
      ctx.beginPath();
      ctx.arc(paddingX + 16, currentY + 20, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 34px "Chakra Petch", "Segoe UI", Arial, sans-serif';
      ctx.fillText(storeName.toUpperCase(), paddingX + 40, currentY + 26);

      ctx.fillStyle = primaryAccent;
      ctx.font = 'bold 13px "Chakra Petch", "Segoe UI", Arial, sans-serif';
      ctx.fillText(tagline.toUpperCase(), paddingX + 42, currentY + 48);
    }

    // Top Right verified badge
    const rightBadgeX = width - paddingX;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = 'bold 14px "Chakra Petch", "Segoe UI", Arial, sans-serif';
    ctx.fillText('OFFICIAL DIGITAL STORE', rightBadgeX, currentY + 26);
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 12px "Chakra Petch", "Segoe UI", Arial, sans-serif';
    ctx.fillText('• PAIEMENTS MONCASH & NATCASH', rightBadgeX, currentY + 46);
    ctx.restore();

    currentY += 85;
  } else {
    currentY += 20;
  }

  // 5. BADGE (e.g. "PROMOTION EXCLUSIVE", "ANNIVERSAIRE", etc.)
  const badgeText = (content.badgeText || '').trim();
  if (badgeText) {
    ctx.save();
    ctx.font = 'bold 16px "Chakra Petch", "Segoe UI", Arial, sans-serif';
    const badgeWidth = ctx.measureText(badgeText.toUpperCase()).width + 36;
    const badgeHeight = 36;

    // Draw pill
    ctx.fillStyle = theme.badgeBg;
    ctx.strokeStyle = primaryAccent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(paddingX, currentY, badgeWidth, badgeHeight, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = primaryAccent;
    ctx.textAlign = 'center';
    ctx.fillText(badgeText.toUpperCase(), paddingX + badgeWidth / 2, currentY + 24);
    ctx.restore();

    currentY += 56;
  }

  // 6. MAIN TITLE
  const titleText = (content.title || poster.title || 'MÉGA PROMOTION').trim();
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 46px "Chakra Petch", "Impact", "Segoe UI", Arial, sans-serif';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;

  const titleLines = wrapText(ctx, titleText.toUpperCase(), width - (paddingX * 2));
  for (const line of titleLines) {
    ctx.fillText(line, paddingX, currentY);
    currentY += 54;
  }
  ctx.restore();
  currentY += 10;

  // 7. HEADLINE
  const headlineText = (content.headline || '').trim();
  if (headlineText) {
    ctx.save();
    ctx.fillStyle = primaryAccent;
    ctx.font = '700 24px "Chakra Petch", "Segoe UI", Arial, sans-serif';
    const headlineLines = wrapText(ctx, headlineText, width - (paddingX * 2));
    for (const line of headlineLines) {
      ctx.fillText(line, paddingX, currentY);
      currentY += 34;
    }
    ctx.restore();
    currentY += 8;
  }

  // 8. MIDDLE CONTENT: IMAGE & DISCOUNT HIGHLIGHT
  // Calculate remaining vertical space for middle section & footer
  const footerReserved = format === '9:16' ? 420 : (format === '4:5' ? 380 : 340);
  const middleHeight = Math.max(220, height - currentY - footerReserved);

  // If user image is present
  if (userImage) {
    ctx.save();
    const imgBoxWidth = width - (paddingX * 2);
    const imgBoxHeight = middleHeight - 20;

    // Draw container frame with rounded corners & dark background
    ctx.beginPath();
    ctx.roundRect(paddingX, currentY, imgBoxWidth, imgBoxHeight, 20);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.fill();
    ctx.clip();

    // Calculate aspect ratio fit (cover style)
    const scale = Math.max(imgBoxWidth / userImage.width, imgBoxHeight / userImage.height);
    const drawW = userImage.width * scale;
    const drawH = userImage.height * scale;
    const drawX = paddingX + (imgBoxWidth - drawW) / 2;
    const drawY = currentY + (imgBoxHeight - drawH) / 2;
    ctx.drawImage(userImage, drawX, drawY, drawW, drawH);

    // Subtle dark gradient overlay at the bottom of the image for text clarity
    const imgGrad = ctx.createLinearGradient(0, currentY + imgBoxHeight * 0.5, 0, currentY + imgBoxHeight);
    imgGrad.addColorStop(0, 'transparent');
    imgGrad.addColorStop(1, 'rgba(3, 7, 18, 0.85)');
    ctx.fillStyle = imgGrad;
    ctx.fillRect(paddingX, currentY, imgBoxWidth, imgBoxHeight);

    ctx.restore();

    // Border around image box
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(paddingX, currentY, imgBoxWidth, imgBoxHeight, 20);
    ctx.stroke();
    ctx.restore();

    currentY += imgBoxHeight + 25;
  } else {
    // Graphic Discount Banner if no photo
    const discountVal = (content.discountValue || '').trim();
    if (discountVal) {
      ctx.save();
      const heroBannerH = Math.min(220, middleHeight - 20);
      const bannerGrad = ctx.createLinearGradient(paddingX, currentY, width - paddingX, currentY + heroBannerH);
      bannerGrad.addColorStop(0, 'rgba(255, 255, 255, 0.03)');
      bannerGrad.addColorStop(0.5, theme.badgeBg);
      bannerGrad.addColorStop(1, 'rgba(255, 255, 255, 0.03)');

      ctx.beginPath();
      ctx.roundRect(paddingX, currentY, width - (paddingX * 2), heroBannerH, 20);
      ctx.fillStyle = bannerGrad;
      ctx.fill();
      ctx.strokeStyle = primaryAccent + '40';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Big Discount value
      ctx.textAlign = 'center';
      ctx.fillStyle = primaryAccent;
      ctx.font = '900 88px "Chakra Petch", "Impact", "Segoe UI", Arial, sans-serif';
      ctx.shadowColor = primaryAccent;
      ctx.shadowBlur = 25;
      ctx.fillText(discountVal.toUpperCase(), width / 2, currentY + (heroBannerH / 2) + 20);

      // Label below discount
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px "Chakra Petch", "Segoe UI", Arial, sans-serif';
      ctx.shadowBlur = 0;
      ctx.fillText('RÉDUCTION IMMÉDIATE SUR LE SITE', width / 2, currentY + (heroBannerH / 2) + 60);

      ctx.restore();
      currentY += heroBannerH + 25;
    }
  }

  // 9. SECONDARY TEXT
  const secondaryText = (content.secondaryText || '').trim();
  if (secondaryText) {
    ctx.save();
    ctx.fillStyle = 'rgba(226, 232, 240, 0.9)';
    ctx.font = '400 19px "Segoe UI", Arial, sans-serif';
    const secondaryLines = wrapText(ctx, secondaryText, width - (paddingX * 2));
    for (const line of secondaryLines) {
      ctx.fillText(line, paddingX, currentY);
      currentY += 28;
    }
    ctx.restore();
    currentY += 12;
  }

  // 10. COUPON BOX (If couponCode or couponSnapshot present)
  const couponCode = (content.couponCode || poster.couponSnapshot?.code || '').trim();
  if (couponCode) {
    ctx.save();
    const boxWidth = width - (paddingX * 2);
    const boxHeight = 90;

    // Dashed coupon container
    ctx.fillStyle = theme.codeBg;
    ctx.beginPath();
    ctx.roundRect(paddingX, currentY, boxWidth, boxHeight, 16);
    ctx.fill();

    ctx.strokeStyle = primaryAccent;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.setLineDash([]); // reset

    // Code Icon & Label
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = 'bold 13px "Chakra Petch", "Segoe UI", Arial, sans-serif';
    ctx.fillText('CODE PROMOTIONNEL À UTILISER AU PANIER :', paddingX + 24, currentY + 30);

    // Coupon Code Value
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 32px "Courier New", Courier, monospace';
    ctx.letterSpacing = '3px';
    ctx.fillText(couponCode.toUpperCase(), paddingX + 24, currentY + 68);

    // Right side discount tag
    const discountRight = content.discountValue || (poster.couponSnapshot?.discountPercent ? `-${poster.couponSnapshot.discountPercent}%` : '');
    if (discountRight) {
      ctx.textAlign = 'right';
      ctx.fillStyle = primaryAccent;
      ctx.font = '900 36px "Chakra Petch", "Segoe UI", Arial, sans-serif';
      ctx.fillText(discountRight, width - paddingX - 24, currentY + 56);
    }

    ctx.restore();
    currentY += boxHeight + 14;
  }

  // 11. EXPIRATION TEXT
  const expirationText = (
    content.expirationText ||
    (poster.couponSnapshot?.expiresAt
      ? `Offre valable jusqu'au ${new Date(poster.couponSnapshot.expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
      : '')
  ).trim();

  if (expirationText) {
    ctx.save();
    ctx.fillStyle = 'rgba(251, 191, 36, 0.9)'; // Amber soft
    ctx.font = '600 14px "Chakra Petch", "Segoe UI", Arial, sans-serif';
    ctx.fillText(`⏳ ${expirationText}`, paddingX, currentY + 12);
    ctx.restore();
    currentY += 28;
  }

  // 12. CALL TO ACTION BUTTON (Anchored towards bottom)
  const ctaText = (content.callToAction || "PROFITEZ DE L'OFFRE").trim();
  if (ctaText) {
    const ctaY = height - 120;
    const ctaWidth = width - (paddingX * 2);
    const ctaHeight = 60;

    ctx.save();
    // Gradient Button
    const ctaGrad = ctx.createLinearGradient(paddingX, ctaY, paddingX + ctaWidth, ctaY + ctaHeight);
    ctaGrad.addColorStop(0, primaryAccent);
    ctaGrad.addColorStop(1, theme.accentSecondary);

    ctx.beginPath();
    ctx.roundRect(paddingX, ctaY, ctaWidth, ctaHeight, 14);
    ctx.fillStyle = ctaGrad;
    ctx.shadowColor = primaryAccent;
    ctx.shadowBlur = 20;
    ctx.fill();

    // CTA Text
    ctx.shadowBlur = 0;
    ctx.fillStyle = theme.accentText;
    ctx.textAlign = 'center';
    ctx.font = '900 20px "Chakra Petch", "Segoe UI", Arial, sans-serif';
    ctx.letterSpacing = '1.5px';
    ctx.fillText(ctaText.toUpperCase(), width / 2, ctaY + 38);
    ctx.restore();
  }

  // 13. BOTTOM FOOTER NOTE
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.textAlign = 'center';
  ctx.font = '12px "Segoe UI", Arial, sans-serif';
  ctx.fillText('mystore.ht • Service client instantané WhatsApp • MonCash & NatCash', width / 2, height - 42);
  ctx.restore();

  return canvas;
}

/**
 * Exports canvas as PNG or JPG file and triggers browser download
 */
export function exportPosterAsFile(
  canvas: HTMLCanvasElement,
  format: 'png' | 'jpg' = 'png',
  filenameBase: string = 'affiche-promo'
): string {
  const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
  const quality = format === 'jpg' ? 0.95 : undefined;
  const dataUrl = canvas.toDataURL(mimeType, quality);

  const cleanName = filenameBase
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `${cleanName}-${dateStr}.${format}`;

  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return dataUrl;
}

/**
 * Creates compressed thumbnail data URL from canvas
 */
export function createPosterThumbnail(canvas: HTMLCanvasElement, maxDim: number = 320): string {
  const thumbCanvas = document.createElement('canvas');
  const scale = maxDim / Math.max(canvas.width, canvas.height);
  thumbCanvas.width = Math.round(canvas.width * scale);
  thumbCanvas.height = Math.round(canvas.height * scale);

  const ctx = thumbCanvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
  }
  return thumbCanvas.toDataURL('image/jpeg', 0.82);
}
