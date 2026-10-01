import React, { useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext.js';
import { useI18n } from '../context/I18nContext.js';
import { api } from '../lib/api.js';
import { Product, PlatformOrGame } from '../types.js';
import { ProductCard } from './ProductCard.js';
import { 
  Search, 
  ArrowUpDown, 
  Gamepad2, 
  Tv, 
  Cpu, 
  X, 
  ChevronLeft
} from 'lucide-react';
import { renderCategoryIcon } from './admin/views/AdminCategories.js';

export const CatalogView: React.FC = () => {
  const { 
    categories, 
    platforms, 
    selectedCategorySlug, 
    setSelectedCategorySlug, 
    selectedPlatform, 
    setSelectedPlatform, 
    setSelectedProduct,
    searchQuery,
    setSearchQuery
  } = useStore();
  const { t, getProductName, getProductDescription } = useI18n();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'newest' | 'priceAsc' | 'priceDesc' | 'name'>('newest');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchQuery || '');

  // Determine current active category ID
  const activeCategory = categories.find(c => c.slug === selectedCategorySlug);
  const activeCategoryId = activeCategory ? activeCategory.id : undefined;

  useEffect(() => {
    const fetchCatalog = async () => {
      setLoading(true);
      try {
        const data = await api.getProducts({
          categoryId: activeCategoryId,
          subcategoryId: selectedPlatform?.id,
          search: localSearch.trim() || undefined,
          sortBy,
        });
        const genuine = Array.isArray(data)
          ? data.filter(p => p && p.id && !p.id.startsWith('poster-') && typeof p.priceHTG === 'number')
          : [];
        setProducts(genuine);
      } catch (err) {
        console.error('Failed to load products in catalog:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCatalog();
  }, [activeCategoryId, selectedPlatform, localSearch, sortBy]);

  const displayedProducts = inStockOnly 
    ? products.filter(p => p.stock > 0)
    : products;

  const relevantPlatforms = platforms.filter(p => {
    if (!activeCategoryId) return p.active;
    return p.categoryId === activeCategoryId && p.active;
  });

  return (
    <div className="pb-24 space-y-4 animate-in fade-in duration-200">
      {/* If subcategory/game is specifically selected (e.g. Free Fire), show dedicated game banner & back button */}
      {selectedPlatform ? (
        <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 p-4 sm:p-5 mb-2">
          {selectedPlatform.bannerImage && (
            <div className="absolute inset-0 z-0 opacity-20">
              <img src={selectedPlatform.bannerImage} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0c121e] via-[#0c121e]/90 to-transparent" />
            </div>
          )}
          <div className="relative z-10">
            <button
              onClick={() => setSelectedPlatform(null)}
              className="inline-flex items-center gap-1 text-xs text-cyan-400 font-bold hover:underline mb-2 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>{t.common.back}</span>
            </button>
            <div className="flex items-center gap-3">
              <img
                src={selectedPlatform.image}
                alt={selectedPlatform.name}
                className="w-14 h-14 rounded-xl object-cover border border-cyan-500/40 shadow-md"
              />
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white font-['Chakra_Petch'] uppercase tracking-wide">
                  {selectedPlatform.name}
                </h1>
                <p className="text-xs text-slate-300 mt-0.5 line-clamp-2">
                  {selectedPlatform.description}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Top Search & Filter Bar */
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={localSearch}
              onChange={e => {
                setLocalSearch(e.target.value);
                setSearchQuery(e.target.value);
              }}
              placeholder={t.catalog.searchPlaceholder}
              className="w-full bg-[#0e1422] border border-slate-800 rounded-xl pl-10 pr-9 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors shadow-sm"
            />
            {localSearch && (
              <button
                onClick={() => { setLocalSearch(''); setSearchQuery(''); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => {
                setSelectedCategorySlug(null);
                setSelectedPlatform(null);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                !selectedCategorySlug
                  ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.catalog.allCategories}
            </button>

            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategorySlug(cat.slug);
                  setSelectedPlatform(null);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategorySlug === cat.slug
                    ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {renderCategoryIcon(cat.icon || cat.iconName, 'w-3.5 h-3.5')}
                <span>{cat.name}</span>
                {cat.badge && (
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${
                    selectedCategorySlug === cat.slug
                      ? 'bg-black/20 text-black'
                      : 'bg-cyan-500/20 text-cyan-400'
                  }`}>
                    {cat.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Subcategory / Platforms / Games Chips */}
          {relevantPlatforms.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
              {relevantPlatforms.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlatform(selectedPlatform?.id === p.id ? null : p)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full whitespace-nowrap border transition-all cursor-pointer ${
                    selectedPlatform?.id === p.id
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold'
                      : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sorting & Availability Filter Controls */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-xs">
        {/* Availability Switch */}
        <label className="flex items-center gap-2 cursor-pointer select-none text-slate-400 text-[11px]">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={e => setInStockOnly(e.target.checked)}
            className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0 focus:ring-offset-0"
          />
          <span>{t.catalog.inStock}</span>
        </label>

        {/* Sort selector */}
        <div className="flex items-center gap-1.5">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="newest">{t.common.instant}</option>
            <option value="priceAsc">{t.common.price} ↑</option>
            <option value="priceDesc">{t.common.price} ↓</option>
            <option value="name">A-Z</option>
          </select>
        </div>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
          <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <span>{t.common.loading}</span>
        </div>
      ) : displayedProducts.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-slate-900/40 border border-slate-800 p-6">
          <p className="text-slate-400 text-sm font-semibold">{t.catalog.noResultsTitle}</p>
          <p className="text-slate-500 text-xs mt-1">{t.catalog.noResultsDesc}</p>
          <button
            onClick={() => {
              setLocalSearch('');
              setSelectedCategorySlug(null);
              setSelectedPlatform(null);
              setInStockOnly(false);
            }}
            className="mt-3 px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 font-bold text-xs cursor-pointer"
          >
            {t.catalog.resetFilter}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {displayedProducts.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              onSelect={setSelectedProduct}
            />
          ))}
        </div>
      )}
    </div>
  );
};
