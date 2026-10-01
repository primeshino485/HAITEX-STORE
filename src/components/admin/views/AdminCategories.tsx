import React, { useState, useEffect } from 'react';
import {
  Gamepad2,
  Tv,
  Cpu,
  Film,
  Sparkles,
  Layers,
  Shield,
  Zap,
  Flame,
  Star,
  ShoppingBag,
  Globe,
  Key,
  Headphones,
  Smartphone,
  Monitor,
  Plus,
  Edit2,
  Trash2,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Search,
  Check,
  X,
  AlertTriangle,
  Package,
  RefreshCw,
  FolderSync,
  Info
} from 'lucide-react';
import { api } from '../../../lib/api.js';
import { useStore } from '../../../context/StoreContext.js';
import { Category } from '../../../types.js';

// Safe curated icon set for categories
export const AVAILABLE_CATEGORY_ICONS: { key: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'Gamepad2', label: 'Gaming (Manette)', icon: Gamepad2 },
  { key: 'Tv', label: 'Streaming (TV)', icon: Tv },
  { key: 'Cpu', label: 'Tech & Logiciels (CPU)', icon: Cpu },
  { key: 'Film', label: 'Cinéma & Vidéo', icon: Film },
  { key: 'Sparkles', label: 'Spécial / Premium', icon: Sparkles },
  { key: 'Layers', label: 'Catégorie Générale', icon: Layers },
  { key: 'Shield', label: 'Sécurité & VPN', icon: Shield },
  { key: 'Zap', label: 'Recharge Rapide', icon: Zap },
  { key: 'Flame', label: 'Tendances / Populaire', icon: Flame },
  { key: 'Star', label: 'Favoris & VIP', icon: Star },
  { key: 'ShoppingBag', label: 'Boutique Numérique', icon: ShoppingBag },
  { key: 'Globe', label: 'Services Web', icon: Globe },
  { key: 'Key', label: 'Clés & Licences', icon: Key },
  { key: 'Headphones', label: 'Musique & Audio', icon: Headphones },
  { key: 'Smartphone', label: 'Mobile & Téléphonie', icon: Smartphone },
  { key: 'Monitor', label: 'Panels & PC', icon: Monitor },
];

export const renderCategoryIcon = (iconName?: string, className = 'w-5 h-5') => {
  const item = AVAILABLE_CATEGORY_ICONS.find(i => i.key.toLowerCase() === (iconName || '').toLowerCase());
  const IconComponent = item ? item.icon : Layers;
  return <IconComponent className={className} />;
};

export const AdminCategories: React.FC = () => {
  const { refreshCatalog } = useStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [reassignCategory, setReassignCategory] = useState<Category | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Form state for create / edit
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    subtitle: '',
    badge: '',
    icon: 'Layers',
    description: '',
    active: true,
  });

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.admin.getCategories();
      setCategories(data);
      refreshCatalog().catch(err => console.warn('Could not refresh public store catalog:', err));
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des catégories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const handleOpenCreate = () => {
    setFormData({
      name: '',
      slug: '',
      subtitle: '',
      badge: '',
      icon: 'Layers',
      description: '',
      active: true,
    });
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      slug: category.slug,
      subtitle: category.subtitle || '',
      badge: category.badge || '',
      icon: category.icon || 'Layers',
      description: category.description || '',
      active: category.active,
    });
  };

  const handleNameChange = (name: string) => {
    // Auto-generate slug if user is creating or slug matches previous slug pattern
    const generatedSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    setFormData(prev => ({
      ...prev,
      name,
      slug: !editingCategory ? generatedSlug : prev.slug,
    }));
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Le nom de la catégorie est obligatoire.');
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      if (editingCategory) {
        await api.admin.updateCategory(editingCategory.id, formData);
        showSuccess(`Catégorie "${formData.name}" mise à jour avec succès.`);
        setEditingCategory(null);
      } else {
        await api.admin.createCategory(formData);
        showSuccess(`Catégorie "${formData.name}" créée avec succès.`);
        setIsCreateOpen(false);
      }
      await fetchCategories();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'enregistrement de la catégorie.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActive = async (category: Category) => {
    try {
      await api.admin.updateCategory(category.id, { active: !category.active });
      showSuccess(`Visibilité de "${category.name}" mise à jour (${!category.active ? 'Visible' : 'Masquée'}).`);
      await fetchCategories();
    } catch (err: any) {
      setError(err.message || 'Erreur lors du changement de visibilité');
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === categories.length - 1)
    ) {
      return;
    }

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newCategories = [...categories];
    const temp = newCategories[index];
    newCategories[index] = newCategories[targetIndex];
    newCategories[targetIndex] = temp;

    const orderedIds = newCategories.map(c => c.id);
    setCategories(newCategories); // Optimistic UI update

    try {
      await api.admin.reorderCategories(orderedIds);
      showSuccess('Ordre des catégories mis à jour.');
    } catch (err: any) {
      setError(err.message || 'Erreur lors du réordonnancement.');
      await fetchCategories(); // Revert on failure
    }
  };

  const handleDelete = async () => {
    if (!deletingCategory) return;
    setActionLoading(true);
    setError(null);
    try {
      await api.admin.deleteCategory(deletingCategory.id);
      showSuccess(`Catégorie "${deletingCategory.name}" supprimée avec succès.`);
      setDeletingCategory(null);
      await fetchCategories();
    } catch (err: any) {
      setError(err.message || 'Impossible de supprimer cette catégorie.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReassign = async () => {
    if (!reassignCategory || !reassignTargetId) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await api.admin.reassignCategoryProducts(reassignCategory.id, reassignTargetId);
      showSuccess(`${res.reassignedCount} produit(s) réaffecté(s) avec succès.`);
      setReassignCategory(null);
      setReassignTargetId('');
      await fetchCategories();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la réaffectation des produits.');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredCategories = categories.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.subtitle && c.subtitle.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6" id="admin-categories-view">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800 shadow-lg">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-emerald-400" />
            Gestion des Catégories
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Gérez dynamiquement les catégories de la boutique, leur ordre d'affichage, leur visibilité et leurs icônes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchCategories}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition border border-slate-700/60"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold rounded-xl transition shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" />
            Nouvelle Catégorie
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex items-start gap-3 animate-fade-in">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
          <div className="flex-1 font-medium">{error}</div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm flex items-start gap-3 animate-fade-in">
          <Check className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-400" />
          <div className="flex-1 font-medium">{successMessage}</div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher une catégorie par nom ou slug..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50"
          />
        </div>
      </div>

      {/* Categories List */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/70 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-5 py-4 w-20">Ordre</th>
                <th className="px-5 py-4">Catégorie</th>
                <th className="px-5 py-4">Slug & Identifiant</th>
                <th className="px-5 py-4">Badge</th>
                <th className="px-5 py-4 text-center">Produits</th>
                <th className="px-5 py-4 text-center">Visibilité</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-400 mb-2" />
                    Chargement des catégories...
                  </td>
                </tr>
              ) : filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <Package className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    Aucune catégorie trouvée.
                  </td>
                </tr>
              ) : (
                filteredCategories.map((category, index) => (
                  <tr
                    key={category.id}
                    className={`hover:bg-slate-800/30 transition ${
                      !category.active ? 'opacity-60 bg-slate-950/20' : ''
                    }`}
                  >
                    {/* Reorder Buttons */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs text-slate-500 w-5 text-center">
                          {index + 1}
                        </span>
                        <div className="flex flex-col gap-0.5">
                          <button
                            disabled={index === 0}
                            onClick={() => handleMove(index, 'up')}
                            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent"
                            title="Monter"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            disabled={index === categories.length - 1}
                            onClick={() => handleMove(index, 'down')}
                            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent"
                            title="Descendre"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Category Title & Icon */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400 flex-shrink-0 shadow-inner">
                          {renderCategoryIcon(category.icon, 'w-5 h-5')}
                        </div>
                        <div>
                          <div className="font-semibold text-white flex items-center gap-2">
                            {category.name}
                            {!category.active && (
                              <span className="px-2 py-0.5 bg-slate-800 text-slate-400 text-[10px] font-medium rounded-full">
                                Masquée
                              </span>
                            )}
                          </div>
                          {category.subtitle && (
                            <div className="text-xs text-slate-400 mt-0.5">
                              {category.subtitle}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Slug */}
                    <td className="px-5 py-4 font-mono text-xs text-slate-400">
                      <div>/{category.slug}</div>
                      <div className="text-[10px] text-slate-600 mt-0.5">{category.id}</div>
                    </td>

                    {/* Badge */}
                    <td className="px-5 py-4">
                      {category.badge ? (
                        <span className="px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-lg uppercase tracking-wide">
                          {category.badge}
                        </span>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>

                    {/* Products Count */}
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        (category.productsCount || 0) > 0 
                          ? 'bg-slate-800 text-emerald-300 border border-slate-700' 
                          : 'bg-slate-900 text-slate-500'
                      }`}>
                        <Package className="w-3.5 h-3.5" />
                        {category.productsCount || 0}
                      </span>
                    </td>

                    {/* Visibility Toggle */}
                    <td className="px-5 py-4 text-center">
                      <button
                        onClick={() => handleToggleActive(category)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition border ${
                          category.active
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                            : 'bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-rose-500/25'
                        }`}
                      >
                        {category.active ? (
                          <>
                            <Eye className="w-3 h-3" />
                            Actif
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3 h-3" />
                            Inactif
                          </>
                        )}
                      </button>
                    </td>

                    {/* Action Buttons */}
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {(category.productsCount || 0) > 0 && (
                          <button
                            onClick={() => {
                              setReassignCategory(category);
                              // Default target to first other category
                              const other = categories.find(c => c.id !== category.id);
                              setReassignTargetId(other ? other.id : '');
                            }}
                            className="p-2 hover:bg-slate-800 text-slate-400 hover:text-amber-400 rounded-lg transition"
                            title="Réaffecter les produits vers une autre catégorie"
                          >
                            <FolderSync className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEdit(category)}
                          className="p-2 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 rounded-lg transition"
                          title="Modifier"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingCategory(category)}
                          className="p-2 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded-lg transition"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {(isCreateOpen || editingCategory) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                {editingCategory ? 'Modifier la Catégorie' : 'Nouvelle Catégorie'}
              </h3>
              <button
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingCategory(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-6 space-y-4">
              {/* Category Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Nom de la catégorie *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Gaming Top-Up, Streaming, Logiciels..."
                  value={formData.name}
                  onChange={e => handleNameChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Subtitle */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Sous-titre / Accroche
                </label>
                <input
                  type="text"
                  placeholder="Ex: Diamants, Pass & Recharges officielles"
                  value={formData.subtitle}
                  onChange={e => setFormData(prev => ({ ...prev, subtitle: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Slug & Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Slug d'URL
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: gaming, streaming"
                    value={formData.slug}
                    onChange={e => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Badge court (Optionnel)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: POPULAIRE, NOUVEAU"
                    value={formData.badge}
                    onChange={e => setFormData(prev => ({ ...prev, badge: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Icon Selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Icône visuelle
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                  {AVAILABLE_CATEGORY_ICONS.map(iconItem => {
                    const isSelected = formData.icon.toLowerCase() === iconItem.key.toLowerCase();
                    const IconComp = iconItem.icon;
                    return (
                      <button
                        key={iconItem.key}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, icon: iconItem.key }))}
                        title={iconItem.label}
                        className={`p-2.5 flex items-center justify-center rounded-lg transition border ${
                          isSelected
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500 shadow-md shadow-emerald-500/20'
                            : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        <IconComp className="w-5 h-5" />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Description détaillée
                </label>
                <textarea
                  rows={2}
                  placeholder="Brève description pour le SEO et le catalogue..."
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3.5 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-3.5 bg-slate-950/50 border border-slate-800 rounded-xl">
                <div>
                  <div className="text-sm font-semibold text-white">Catégorie active</div>
                  <div className="text-xs text-slate-400">Rendre visible dans le catalogue public et la navigation</div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={e => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                  className="w-5 h-5 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-800 border-slate-700"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setEditingCategory(null);
                  }}
                  className="px-4 py-2 text-slate-400 hover:text-white text-sm font-medium transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-sm font-semibold rounded-xl transition flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {editingCategory ? 'Enregistrer les modifications' : 'Créer la catégorie'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REASSIGN PRODUCTS MODAL */}
      {reassignCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-5">
            <div className="flex items-center gap-3 text-amber-400">
              <FolderSync className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-lg font-bold text-white">Réaffecter les produits</h3>
            </div>

            <p className="text-sm text-slate-300">
              La catégorie <strong className="text-white">"{reassignCategory.name}"</strong> contient actuellement{' '}
              <span className="text-emerald-400 font-semibold">{reassignCategory.productsCount || 0}</span> produit(s).
              Choisissez la nouvelle catégorie vers laquelle les déplacer :
            </p>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Catégorie de destination
              </label>
              <select
                value={reassignTargetId}
                onChange={e => setReassignTargetId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500"
              >
                {categories
                  .filter(c => c.id !== reassignCategory.id)
                  .map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.productsCount || 0} produits)
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setReassignCategory(null)}
                className="px-4 py-2 text-slate-400 hover:text-white text-sm font-medium transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleReassign}
                disabled={actionLoading || !reassignTargetId}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-sm font-semibold rounded-xl transition flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {actionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                Déplacer les produits
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-5">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-lg font-bold text-white">Supprimer la catégorie ?</h3>
            </div>

            {(deletingCategory.productsCount || 0) > 0 ? (
              <div className="space-y-3">
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-sm text-rose-300">
                  <strong>Action bloquée :</strong> Cette catégorie contient{' '}
                  <span className="font-bold">{deletingCategory.productsCount}</span> produit(s) associé(s). Pour protéger le catalogue,
                  vous devez d'abord réaffecter ces produits ou les supprimer.
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const toReassign = deletingCategory;
                    setDeletingCategory(null);
                    setReassignCategory(toReassign);
                    const other = categories.find(c => c.id !== toReassign.id);
                    setReassignTargetId(other ? other.id : '');
                  }}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-sm font-medium rounded-xl transition flex items-center justify-center gap-2 border border-slate-700"
                >
                  <FolderSync className="w-4 h-4" />
                  Réaffecter les {deletingCategory.productsCount} produit(s) maintenant
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-300">
                Êtes-vous sûr de vouloir supprimer définitivement la catégorie{' '}
                <strong className="text-white">"{deletingCategory.name}"</strong> ? Cette action est irréversible.
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingCategory(null)}
                className="px-4 py-2 text-slate-400 hover:text-white text-sm font-medium transition"
              >
                Annuler
              </button>
              {(deletingCategory.productsCount || 0) === 0 && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={actionLoading}
                  className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold rounded-xl transition flex items-center gap-2 shadow-lg shadow-rose-500/20 disabled:opacity-50"
                >
                  {actionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Confirmer la suppression
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
