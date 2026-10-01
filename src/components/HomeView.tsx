import React, { useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext.js';
import { useI18n } from '../context/I18nContext.js';
import { api } from '../lib/api.js';
import { Product, PlatformOrGame, PromotionalPoster } from '../types.js';
import { ProductCard } from './ProductCard.js';
import { FloatingPromotionalPoster } from './FloatingPromotionalPoster.js';
import { 
  Gamepad2, 
  Tv, 
  Flame, 
  ArrowRight, 
  Sparkles, 
  Zap, 
  ShieldCheck, 
  Smartphone,
  ChevronRight,
  PackageCheck,
  Layers,
  Clock,
  ExternalLink
} from 'lucide-react';
import { renderCategoryIcon } from './admin/views/AdminCategories.js';

export const HomeView: React.FC = () => {
  const { 
    siteSettings, 
    categories, 
    platforms, 
    setActiveTab, 
    setSelectedCategorySlug, 
    setSelectedPlatform, 
    setSelectedProduct,
    setIsRechargeModalOpen
  } = useStore();
  const { t, getProductName, getProductDescription } = useI18n();

  const [publishedPosters, setPublishedPosters] = useState<PromotionalPoster[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [isFloatingOpen, setIsFloatingOpen] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  const [loading, setLoading] = useState(true);

  // Auto-open floating promotional poster on first load when boutique data is ready
  useEffect(() => {
    if (publishedPosters.length > 0 && !hasAutoOpened && !loading) {
      const alreadyDismissed = sessionStorage.getItem('mystore_floating_poster_dismissed');
      if (!alreadyDismissed) {
        const timer = setTimeout(() => {
          setIsFloatingOpen(true);
          setHasAutoOpened(true);
        }, 750);
        return () => clearTimeout(timer);
      }
    }
  }, [publishedPosters.length, hasAutoOpened, loading]);

  const handleOpenFloatingPoster = () => {
    setIsFloatingOpen(true);
  };

  const handleCloseFloatingPoster = () => {
    setIsFloatingOpen(false);
    sessionStorage.setItem('mystore_floating_poster_dismissed', 'true');
  };

  useEffect(() => {
    let isMounted = true;
    const fetchHomeData = async () => {
      try {
        const [productsRes, postersRes] = await Promise.all([
          api.getProducts().catch(() => [] as Product[]),
          api.getPosters().catch(() => api.getPublishedPromotionalPosters().catch(() => [] as PromotionalPoster[])),
        ]);

        if (!isMounted) return;

        // Extract products strictly (separately from posters: must have numeric priceHTG and not start with poster-)
        const publishedProducts = (productsRes || []).filter(
          p => p && p.id && !p.id.startsWith('poster-') && typeof p.priceHTG === 'number' && p.status !== 'hidden' && p.status !== 'draft'
        );
        const featured = publishedProducts.filter(p => p.isFeatured || (p as any).featured);
        const news = [...publishedProducts].reverse().slice(0, 6);
        const inStock = publishedProducts.filter(p => p.stock > 0);

        // Extract posters strictly (separately from products: must be published and active, cannot have priceHTG)
        const validPosters = (postersRes || []).filter(
          p => p && p.id && (p.published || p.isPublished) && p.active !== false && (p as any).priceHTG === undefined
        );

        setFeaturedProducts(featured.length > 0 ? featured : publishedProducts.slice(0, 4));
        setNewArrivals(news);
        setAvailableProducts(inStock.slice(0, 6));
        setPublishedPosters(validPosters);
      } catch (err) {
        console.error('Failed to load home products or posters:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchHomeData();
    return () => {
      isMounted = false;
    };
  }, []);



  const handleCategorySelect = (slug: string) => {
    setSelectedCategorySlug(slug);
    setSelectedPlatform(null);
    setActiveTab('catalog');
  };

  const handlePlatformSelect = (plat: PlatformOrGame) => {
    const cat = categories.find(c => c.id === plat.categoryId);
    setSelectedCategorySlug(cat ? cat.slug : null);
    setSelectedPlatform(plat);
    setActiveTab('catalog');
  };

  const handlePosterAction = (poster: PromotionalPoster) => {
    if (poster.actionUrl) {
      if (poster.actionUrl.startsWith('http://') || poster.actionUrl.startsWith('https://')) {
        window.open(poster.actionUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      if (poster.actionUrl === 'recharge' || poster.actionUrl === '/recharge') {
        setIsRechargeModalOpen(true);
        return;
      }
      if (poster.actionUrl.startsWith('cat-') || poster.actionUrl.startsWith('category:')) {
        const slug = poster.actionUrl.replace('category:', '').replace('cat-', '');
        handleCategorySelect(slug);
        return;
      }
      setActiveTab('catalog');
      return;
    }

    // Default CTA behavior
    setActiveTab('catalog');
  };

  const gamingCategory = categories.find(c => c.slug === 'gaming' || c.id === 'cat-gaming');
  const streamingCategory = categories.find(c => c.slug === 'streaming' || c.id === 'cat-streaming');

  const gamingPlatforms = platforms.filter(p => p.categoryId === gamingCategory?.id && p.active);
  const streamingPlatforms = platforms.filter(p => p.categoryId === streamingCategory?.id && p.active);

  return (
    <div className="pb-20 space-y-8 animate-in fade-in duration-300">
      {/* Homepage Welcome Announcement if set */}
      {siteSettings?.homepageWelcomeText && (
        <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold flex items-center gap-2.5 shadow-sm">
          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{siteSettings.homepageWelcomeText}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. STORE HERO BANNER (Toujours dans le flux normal, jamais remplacé par des cartes d'affiches) */}
      {/* ========================================================================= */}
      <section id="section-store-hero" className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-[#0b1322] to-slate-950 border border-slate-800/80 p-5 sm:p-7 shadow-2xl">
        <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-cyan-500/15 via-blue-600/10 to-transparent blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[11px] font-bold mb-3 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t.home.heroBadge}</span>
          </div>
          <h1 className="text-xl sm:text-3xl font-black text-white uppercase tracking-wide font-['Chakra_Petch'] leading-tight mb-2">
            {siteSettings?.bannerTitle || t.home.heroTitle}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mb-4 leading-relaxed font-normal">
            {siteSettings?.bannerSubtitle || t.home.heroSubtitle}
          </p>
          
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => handleCategorySelect('gaming')}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/25 flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-black" />
              <span>{t.home.exploreBtn}</span>
            </button>
            <button
              onClick={() => setIsRechargeModalOpen(true)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 font-bold text-xs border border-cyan-500/30 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Smartphone className="w-4 h-4 text-cyan-400" />
              <span>{t.home.rechargeBtn} ({siteSettings?.moncashNumber || '34584287'})</span>
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. SECTION 2: PRODUITS EN VEDETTE (FEATURED PRODUCTS)                     */}
      {/* ========================================================================= */}
      {featuredProducts.length > 0 && (
        <section id="section-featured-products" aria-label="Produits en vedette">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
                <Flame className="w-4 h-4 text-orange-400 animate-pulse" />
              </div>
              <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-white font-['Chakra_Petch']">
                {t.home.popularTitle || 'Produits en vedette'}
              </h2>
            </div>
            <button
              onClick={() => { setSelectedCategorySlug(null); setActiveTab('catalog'); }}
              className="text-xs text-cyan-400 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>{t.common.viewAll}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {featuredProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onSelect={setSelectedProduct}
              />
            ))}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 3. SECTION 3: NOUVEAUTÉS (NEW ARRIVALS)                                   */}
      {/* ========================================================================= */}
      {newArrivals.length > 0 && (
        <section id="section-new-arrivals" aria-label="Nouveautés du catalogue">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                <Sparkles className="w-4 h-4 text-purple-400" />
              </div>
              <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-white font-['Chakra_Petch']">
                Nouveautés du catalogue
              </h2>
            </div>
            <button
              onClick={() => { setSelectedCategorySlug(null); setActiveTab('catalog'); }}
              className="text-xs text-purple-400 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>{t.common.viewAll}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {newArrivals.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                variant="compact"
                onSelect={setSelectedProduct}
              />
            ))}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 4. SECTION 4: PRODUITS DISPONIBLES (AVAILABLE PRODUCTS)                   */}
      {/* ========================================================================= */}
      {availableProducts.length > 0 && (
        <section id="section-available-products" aria-label="Produits disponibles en stock">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <PackageCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-white font-['Chakra_Petch']">
                Produits disponibles immédiatement
              </h2>
            </div>
            <button
              onClick={() => { setSelectedCategorySlug(null); setActiveTab('catalog'); }}
              className="text-xs text-emerald-400 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>{t.common.viewAll}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
            {availableProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onSelect={setSelectedProduct}
              />
            ))}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 5. SECTION 5: CATÉGORIES & PLATEFORMES                                    */}
      {/* ========================================================================= */}
      <section id="section-categories-platforms" aria-label="Catégories et plateformes" className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-300 font-['Chakra_Petch']">
                {t.home.categoriesTitle || 'Catégories du catalogue'}
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {categories.map((cat, idx) => {
              const THEMES = [
                {
                  border: 'border-cyan-500/30 hover:border-cyan-400 shadow-cyan-500/5 hover:shadow-cyan-500/20',
                  glow: 'bg-cyan-500/10 group-hover:bg-cyan-500/20',
                  iconBox: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-black',
                  badge: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
                  hoverText: 'group-hover:text-cyan-400',
                  subText: 'text-cyan-300',
                  actionText: 'text-cyan-400',
                },
                {
                  border: 'border-purple-500/30 hover:border-purple-400 shadow-purple-500/5 hover:shadow-purple-500/20',
                  glow: 'bg-purple-500/10 group-hover:bg-purple-500/20',
                  iconBox: 'bg-purple-500/20 border-purple-500/40 text-purple-400 group-hover:bg-purple-500 group-hover:text-black',
                  badge: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
                  hoverText: 'group-hover:text-purple-400',
                  subText: 'text-purple-300',
                  actionText: 'text-purple-400',
                },
                {
                  border: 'border-emerald-500/30 hover:border-emerald-400 shadow-emerald-500/5 hover:shadow-emerald-500/20',
                  glow: 'bg-emerald-500/10 group-hover:bg-emerald-500/20',
                  iconBox: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-black',
                  badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                  hoverText: 'group-hover:text-emerald-400',
                  subText: 'text-emerald-300',
                  actionText: 'text-emerald-400',
                },
                {
                  border: 'border-amber-500/30 hover:border-amber-400 shadow-amber-500/5 hover:shadow-amber-500/20',
                  glow: 'bg-amber-500/10 group-hover:bg-amber-500/20',
                  iconBox: 'bg-amber-500/20 border-amber-500/40 text-amber-400 group-hover:bg-amber-500 group-hover:text-black',
                  badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
                  hoverText: 'group-hover:text-amber-400',
                  subText: 'text-amber-300',
                  actionText: 'text-amber-400',
                },
              ];
              const theme = THEMES[idx % THEMES.length];
              return (
                <div
                  key={cat.id}
                  onClick={() => handleCategorySelect(cat.slug)}
                  className={`group relative overflow-hidden rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border p-5 cursor-pointer transition-all active:scale-98 shadow-lg ${theme.border}`}
                >
                  <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl transition-all ${theme.glow}`} />
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-all shadow-md group-hover:scale-110 ${theme.iconBox}`}>
                      {renderCategoryIcon(cat.icon || cat.iconName, 'w-6 h-6')}
                    </div>
                    {cat.badge ? (
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${theme.badge}`}>
                        {cat.badge}
                      </span>
                    ) : (
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        Dispo
                      </span>
                    )}
                  </div>
                  <h3 className={`text-lg font-black text-white uppercase tracking-wider font-['Chakra_Petch'] transition-colors ${theme.hoverText}`}>
                    {cat.name}
                  </h3>
                  {cat.subtitle && (
                    <p className={`text-xs mt-1 font-semibold uppercase tracking-wider ${theme.subText}`}>
                      {cat.subtitle}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400 mt-2 line-clamp-2">
                    {cat.description || t.home.gamingDesc}
                  </p>
                  <div className={`mt-4 flex items-center text-xs font-bold gap-1 group-hover:translate-x-1 transition-transform ${theme.actionText}`}>
                    <span>{t.common.viewAll}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gaming Games Quick Touch Row */}
        {gamingPlatforms.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <Gamepad2 className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-black uppercase tracking-wider text-white font-['Chakra_Petch']">
                  {t.home.gaming}
                </h3>
              </div>
              <button
                onClick={() => handleCategorySelect('gaming')}
                className="text-xs text-cyan-400 font-bold hover:underline cursor-pointer"
              >
                {t.common.viewAll}
              </button>
            </div>

            <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none">
              {gamingPlatforms.map(game => (
                <div
                  key={game.id}
                  onClick={() => handlePlatformSelect(game)}
                  className="flex-shrink-0 w-32 sm:w-36 bg-[#0e1422] border border-slate-800 hover:border-cyan-500/50 rounded-xl overflow-hidden cursor-pointer group transition-all"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
                    <img
                      src={game.image}
                      alt={game.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-2 text-center">
                    <h4 className="text-xs font-bold text-slate-200 group-hover:text-cyan-400 truncate">
                      {game.name}
                    </h4>
                    <span className="text-[10px] text-cyan-400/80 font-semibold block mt-0.5">
                      {t.common.instant}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Streaming Platforms Quick Touch Row */}
        {streamingPlatforms.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <Tv className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-black uppercase tracking-wider text-white font-['Chakra_Petch']">
                  {t.home.streaming}
                </h3>
              </div>
              <button
                onClick={() => handleCategorySelect('streaming')}
                className="text-xs text-purple-400 font-bold hover:underline cursor-pointer"
              >
                {t.common.viewAll}
              </button>
            </div>

            <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none">
              {streamingPlatforms.map(plat => (
                <div
                  key={plat.id}
                  onClick={() => handlePlatformSelect(plat)}
                  className="flex-shrink-0 w-32 sm:w-36 bg-[#0e1422] border border-slate-800 hover:border-purple-500/50 rounded-xl overflow-hidden cursor-pointer group transition-all"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
                    <img
                      src={plat.image}
                      alt={plat.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-2 text-center">
                    <h4 className="text-xs font-bold text-slate-200 group-hover:text-purple-400 truncate">
                      {plat.name}
                    </h4>
                    <span className="text-[10px] text-purple-400/80 font-semibold block mt-0.5">
                      Ultra HD 4K
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trust & Guarantee Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-slate-800 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                {t.home.trustSecureTitle} • {t.home.trustInstantTitle}
              </h4>
              <p className="text-[11px] text-slate-400">
                {t.home.trustSecureDesc}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsRechargeModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 hover:text-black border border-emerald-500/40 text-emerald-300 font-bold text-xs whitespace-nowrap transition-all cursor-pointer"
          >
            {t.common.recharge} ({siteSettings?.moncashNumber || '34584287'})
          </button>
        </div>
      </section>

      {/* Floating Promotional Poster Overlay (Exactly 1 active poster, position fixed, 0 impact on layout) */}
      <FloatingPromotionalPoster
        poster={publishedPosters.length > 0 ? publishedPosters[0] : null}
        isOpen={isFloatingOpen}
        onClose={handleCloseFloatingPoster}
        onAction={handlePosterAction}
      />
    </div>
  );
};
