import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '../../../context/I18nContext.js';
import { api } from '../../../lib/api.js';
import { PromotionalPoster, Media } from '../../../types.js';
import { MediaPickerModal } from '../modals/MediaPickerModal.js';
import {
  Plus,
  Image as ImageIcon,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Calendar,
  Check,
  X,
  Upload,
  Clock,
  Eye,
  EyeOff,
  Power,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';

export const AdminPosters: React.FC = () => {
  const { t } = useI18n();

  // Navigation tab: create or gallery
  const [activeTab, setActiveTab] = useState<'create' | 'gallery'>('gallery');
  const [posters, setPosters] = useState<PromotionalPoster[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Edit state
  const [editingPosterId, setEditingPosterId] = useState<string | null>(null);
  const [existingPosterData, setExistingPosterData] = useState<PromotionalPoster | null>(null);

  // Modals & pickers
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [previewPoster, setPreviewPoster] = useState<PromotionalPoster | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [publishLoadingId, setPublishLoadingId] = useState<string | null>(null);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ==========================================
  // FORM STATE SIMPLIFIÉ (RÈGLE: IMAGE UPLOADÉE = IMAGE AFFICHÉE)
  // ==========================================
  const [imageUrl, setImageUrl] = useState<string>('');
  const [title, setTitle] = useState<string>(''); // Nom interne de l'affiche
  const [actionUrl, setActionUrl] = useState<string>(''); // Lien au clic - optionnel
  const [startAt, setStartAt] = useState<string>(''); // Date de début - optionnelle
  const [expiresAt, setExpiresAt] = useState<string>(''); // Date d'expiration - optionnelle
  const [isPublished, setIsPublished] = useState<boolean>(true); // Afficher sur la boutique [ON / OFF]
  const [active, setActive] = useState<boolean>(true); // ACTIVÉE / DÉSACTIVÉE

  // Load posters
  const loadPosters = async () => {
    try {
      setLoading(true);
      const data = await api.admin.getPosters();
      setPosters(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load posters:', err);
      setErrorMessage(err.message || 'Impossible de charger les affiches.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosters();
  }, []);

  const resetForm = () => {
    setEditingPosterId(null);
    setExistingPosterData(null);
    setImageUrl('');
    setTitle('');
    setActionUrl('');
    setStartAt('');
    setExpiresAt('');
    setIsPublished(true);
    setActive(true);
    setErrorMessage(null);
  };

  // Handle local file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Veuillez sélectionner un fichier image valide (PNG, JPEG, WEBP, SVG).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result);
        setErrorMessage(null);
      }
    };
    reader.onerror = () => {
      setErrorMessage('Erreur lors de la lecture du fichier image.');
    };
    reader.readAsDataURL(file);
  };

  // Handle media selection from library
  const handleMediaSelect = (media: Media) => {
    if (media.url) {
      setImageUrl(media.url);
      setIsMediaPickerOpen(false);
      setErrorMessage(null);
    }
  };

  // Open edit mode
  const handleStartEdit = (poster: PromotionalPoster) => {
    setEditingPosterId(poster.id);
    setExistingPosterData(poster);
    setImageUrl(poster.imageUrl || poster.renderedImageUrl || poster.thumbnailUrl || poster.content?.imageUrl || '');
    setTitle(poster.title || '');
    setActionUrl(poster.actionUrl || '');
    
    // Format dates for datetime-local input
    if (poster.startAt) {
      const d = new Date(poster.startAt);
      setStartAt(isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 16));
    } else {
      setStartAt('');
    }

    if (poster.expiresAt) {
      const d = new Date(poster.expiresAt);
      setExpiresAt(isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 16));
    } else {
      setExpiresAt('');
    }

    setIsPublished(poster.published ?? poster.isPublished ?? true);
    setActive(poster.active ?? true);
    setActiveTab('create');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Save or Update Poster
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!imageUrl.trim()) {
      setErrorMessage("Veuillez sélectionner ou téléverser l'image de l'affiche.");
      return;
    }

    if (!title.trim()) {
      setErrorMessage("Le nom interne de l'affiche est obligatoire.");
      return;
    }

    try {
      setSaving(true);

      const payload: Partial<PromotionalPoster> = {
        title: title.trim(),
        imageUrl: imageUrl.trim(),
        renderedImageUrl: imageUrl.trim(),
        thumbnailUrl: imageUrl.trim(),
        actionUrl: actionUrl.trim() || null,
        startAt: startAt ? new Date(startAt).toISOString() : null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        published: isPublished,
        isPublished: isPublished,
        active: active,
      };

      if (editingPosterId) {
        // Update existing (preserve existing metadata fields for complete backward compatibility)
        if (existingPosterData) {
          payload.type = existingPosterData.type || 'PROMOTION';
          payload.templateType = existingPosterData.templateType;
          payload.format = existingPosterData.format;
          payload.couponId = existingPosterData.couponId;
          payload.couponSnapshot = existingPosterData.couponSnapshot;
          payload.content = {
            ...existingPosterData.content,
            imageUrl: imageUrl.trim(),
            title: title.trim(),
          } as any;
        }

        await api.admin.updatePoster(editingPosterId, payload);
        setSuccessMessage('Affiche modifiée avec succès.');
      } else {
        // Create new
        await api.admin.createPoster(payload);
        setSuccessMessage('Affiche créée et enregistrée avec succès.');
      }

      await loadPosters();
      resetForm();
      setActiveTab('gallery');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('Save poster error:', err);
      setErrorMessage(err.message || "Erreur lors de l'enregistrement de l'affiche.");
    } finally {
      setSaving(false);
    }
  };

  // Delete poster
  const handleDelete = async (id: string) => {
    try {
      await api.admin.deletePoster(id);
      setDeleteConfirmId(null);
      setSuccessMessage('Affiche supprimée.');
      loadPosters();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || "Impossible de supprimer l'affiche.");
    }
  };

  // Fast Publication Toggle
  const handleTogglePublish = async (poster: PromotionalPoster) => {
    try {
      setPublishLoadingId(poster.id);
      const nextState = !(poster.published ?? poster.isPublished);
      await api.admin.updatePoster(poster.id, {
        published: nextState,
        isPublished: nextState,
      });
      await loadPosters();
      setSuccessMessage(nextState ? 'Affiche affichée sur la boutique.' : 'Affiche masquée de la boutique.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors du changement de publication.');
    } finally {
      setPublishLoadingId(null);
    }
  };

  // Fast Active Toggle
  const handleToggleActive = async (poster: PromotionalPoster) => {
    try {
      const nextState = !poster.active;
      await api.admin.updatePoster(poster.id, { active: nextState });
      await loadPosters();
      setSuccessMessage(nextState ? 'Affiche activée.' : 'Affiche désactivée.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || "Erreur lors de l'activation/désactivation.");
    }
  };

  // Reorder posters
  const handleMoveOrder = async (id: string, delta: number) => {
    const currentIndex = posters.findIndex((p) => p.id === id);
    if (currentIndex === -1) return;

    const targetIndex = currentIndex + delta;
    if (targetIndex < 0 || targetIndex >= posters.length) return;

    const newOrder = [...posters];
    const [moved] = newOrder.splice(currentIndex, 1);
    newOrder.splice(targetIndex, 0, moved);

    setPosters(newOrder);

    try {
      await api.admin.reorderPosters(newOrder.map((p) => p.id));
    } catch (err: any) {
      console.error('Reorder error:', err);
      loadPosters();
    }
  };

  // Determine visual badge for status
  const getPosterStatusBadge = (poster: PromotionalPoster) => {
    const isPub = poster.published ?? poster.isPublished ?? false;
    const isAct = poster.active ?? true;
    const now = Date.now();
    const isExpired = poster.expiresAt ? new Date(poster.expiresAt).getTime() < now : false;

    if (!isAct) {
      return { label: 'Désactivée', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
    }
    if (isExpired) {
      return { label: 'Expirée', color: 'bg-red-500/15 text-red-300 border-red-500/30' };
    }
    if (isPub) {
      return { label: 'Affichée sur la boutique', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
    }
    return { label: 'Masquée', color: 'bg-slate-700/40 text-slate-400 border-slate-700' };
  };

  return (
    <div className="space-y-6">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Media Picker Modal */}
      <MediaPickerModal
        isOpen={isMediaPickerOpen}
        onClose={() => setIsMediaPickerOpen(false)}
        onSelectMedia={handleMediaSelect}
        title="Sélectionner une affiche dans la médiathèque"
      />

      {/* Notifications */}
      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="p-1 rounded-lg hover:bg-red-500/20 text-red-300 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider font-['Chakra_Petch']">
            Affiches Promotionnelles
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Système d'affiches publicitaires directes : téléversez votre image conçue et elle s'affiche telle quelle en overlay flottant.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              resetForm();
              setActiveTab('create');
            }}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-all shadow-md ${
              activeTab === 'create' && !editingPosterId
                ? 'bg-amber-500 text-black shadow-amber-500/20'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>+ Nouvelle affiche</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('gallery');
            }}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-all ${
              activeTab === 'gallery'
                ? 'bg-amber-500 text-black shadow-amber-500/20'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>Galerie ({posters.length})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. TAB: CRÉATION / MODIFICATION SIMPLIFIÉE                                */}
      {/* ========================================================================= */}
      {activeTab === 'create' && (
        <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
          <div className="p-5 sm:p-7 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wide font-['Chakra_Petch']">
                  {editingPosterId ? "Modifier l'affiche" : "Créer une affiche"}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Image uploadée = image affichée. HAITEX ne modifie ni le cadrage, ni les couleurs, ni le texte.
                </p>
              </div>

              {editingPosterId && (
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setActiveTab('gallery');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Annuler
                </button>
              )}
            </div>

            {/* SECTION: IMAGE DE L'AFFICHE */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Image de l'affiche <span className="text-red-400">*</span>
              </label>

              {/* Action Buttons for Image */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-md shadow-amber-500/20 transition-all active:scale-95"
                >
                  <Upload className="w-4 h-4" />
                  <span>Télécharger une image</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsMediaPickerOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider border border-slate-700 flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                >
                  <FolderOpen className="w-4 h-4 text-amber-400" />
                  <span>Choisir dans la médiathèque</span>
                </button>

                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="px-3 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-bold border border-red-500/30 flex items-center gap-1.5 cursor-pointer ml-auto"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Retirer l'image</span>
                  </button>
                )}
              </div>

              {/* URL Direct Fallback */}
              <div className="pt-1">
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Ou collez ici une URL directe d'image (https://...)"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:outline-none focus:border-amber-500/50"
                />
              </div>

              {/* Prévisualisation IMAGE ORIGINALE */}
              <div className="pt-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Prévisualisation — IMAGE ORIGINALE
                </span>

                <div className="relative rounded-2xl bg-[#090d16] border border-slate-800 p-4 sm:p-6 flex flex-col items-center justify-center min-h-[220px] overflow-hidden">
                  {imageUrl ? (
                    <div className="flex flex-col items-center space-y-3">
                      <img
                        src={imageUrl}
                        alt="Prévisualisation originale"
                        className="max-h-[360px] max-w-full object-contain block rounded-lg select-none"
                        style={{ background: 'transparent' }}
                      />
                      <span className="text-[11px] text-emerald-400 font-medium">
                        ✓ Image originale telle qu'elle sera affichée (ratio et transparence 100% préservés)
                      </span>
                    </div>
                  ) : (
                    <div className="text-center p-8 space-y-2 text-slate-500">
                      <ImageIcon className="w-12 h-12 mx-auto opacity-40 text-slate-400" />
                      <p className="text-xs font-medium text-slate-400">
                        Aucune image sélectionnée pour le moment.
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Cliquez sur "Télécharger une image" ou "Choisir dans la médiathèque".
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION: NOM INTERNE */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Nom interne de l'affiche <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ex: Anniversaire 2026, Vente Flash Été, Promo Spéciale..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                required
              />
              <p className="text-[11px] text-slate-400">
                Ce champ sert uniquement à identifier l'affiche dans l'administration. Il n'apparaît pas au-dessus de l'image côté client.
              </p>
            </div>

            {/* SECTION: LIEN AU CLIC */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                Lien au clic — optionnel
              </label>
              <input
                type="text"
                value={actionUrl}
                onChange={(e) => setActionUrl(e.target.value)}
                placeholder="ex: /catalog, /recharge, https://..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
              <p className="text-[11px] text-slate-400">
                Redirige le client lorsqu'il clique sur l'image (laisser vide pour aucun lien). Aucun bouton graphique artificiel n'est ajouté.
              </p>
            </div>

            {/* SECTION: DATES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  <span>Date de début — optionnelle</span>
                </label>
                <input
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Date d'expiration — optionnelle</span>
                </label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            {/* SECTION: PUBLICATION & ACTIVATION */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
              {/* Afficher sur la boutique [ON / OFF] */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">
                    Afficher sur la boutique
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {isPublished ? 'Visible en overlay flottant' : 'Masquée côté boutique'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsPublished(!isPublished)}
                  className={`w-12 h-6.5 rounded-full transition-colors relative cursor-pointer ${
                    isPublished ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white transition-transform transform shadow-md ${
                      isPublished ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Activer / Désactiver */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">
                    Statut de l'affiche
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {active ? 'ACTIVÉE' : 'DÉSACTIVÉE'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setActive(!active)}
                  className={`w-12 h-6.5 rounded-full transition-colors relative cursor-pointer ${
                    active ? 'bg-amber-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white transition-transform transform shadow-md ${
                      active ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* BOUTON DE PUBLICATION */}
            <div className="pt-4 border-t border-slate-800 flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-black font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Enregistrement en cours...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>{editingPosterId ? "Enregistrer les modifications" : "Publier l'affiche"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* 2. TAB: GALERIE & GESTION DES AFFICHES                                    */}
      {/* ========================================================================= */}
      {activeTab === 'gallery' && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-300 text-xs flex items-center justify-between">
            <span>
              <strong className="text-white">{posters.length}</strong> affiche(s) enregistrée(s). Seule la première affiche active et publiée est affichée en overlay flottant sur la boutique.
            </span>
            <button
              type="button"
              onClick={loadPosters}
              disabled={loading}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              title="Rafraîchir"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-400">Chargement des affiches...</p>
            </div>
          ) : posters.length === 0 ? (
            <div className="py-16 text-center rounded-2xl bg-slate-900 border border-slate-800 p-8 space-y-4 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
                <ImageIcon className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-white">Aucune affiche pour le moment</h3>
              <p className="text-xs text-slate-400">
                Téléversez votre première affiche pour informer vos clients de vos offres et promotions.
              </p>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setActiveTab('create');
                }}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 mx-auto cursor-pointer shadow-lg shadow-amber-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>Créer une affiche</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {posters.map((poster, index) => {
                const status = getPosterStatusBadge(poster);
                const displayImg = poster.imageUrl || poster.renderedImageUrl || poster.thumbnailUrl || poster.content?.imageUrl;

                return (
                  <div
                    key={poster.id}
                    className="group rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500/40 overflow-hidden flex flex-col justify-between transition-all duration-200 shadow-lg"
                  >
                    {/* Visual Preview */}
                    <div className="relative bg-[#070b13] p-3 flex items-center justify-center aspect-square max-h-[300px] overflow-hidden">
                      {displayImg ? (
                        <img
                          src={displayImg}
                          alt={poster.title}
                          className="max-h-full max-w-full object-contain select-none"
                          style={{ background: 'transparent' }}
                        />
                      ) : (
                        <div className="text-center p-6 text-slate-600">
                          <ImageIcon className="w-10 h-10 mx-auto mb-1 opacity-50" />
                          <span className="text-[11px]">Pas d'image</span>
                        </div>
                      )}

                      {/* Top Left: Order Badge */}
                      <div className="absolute top-3 left-3 z-10">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-amber-300 border border-amber-500/30">
                          #{index + 1} {index === 0 && '• En tête'}
                        </span>
                      </div>

                      {/* Top Right: Status Badge */}
                      <div className="absolute top-3 right-3 z-10">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border backdrop-blur-md ${status.color}`}>
                          {status.label}
                        </span>
                      </div>

                      {/* Quick Fullscreen Preview Icon on hover */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-xs">
                        <button
                          type="button"
                          onClick={() => setPreviewPoster(poster)}
                          className="p-2.5 rounded-full bg-amber-500 hover:bg-amber-400 text-black shadow-lg cursor-pointer"
                          title="Aperçu overlay"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Details & Controls */}
                    <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-wide font-['Chakra_Petch'] line-clamp-1">
                          {poster.title}
                        </h3>

                        {poster.actionUrl && (
                          <div className="flex items-center gap-1 text-[11px] text-cyan-400 font-mono mt-1 line-clamp-1">
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span>{poster.actionUrl}</span>
                          </div>
                        )}

                        {poster.expiresAt && (
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono mt-1">
                            <Clock className="w-3 h-3 text-amber-400" />
                            <span>Expire : {new Date(poster.expiresAt).toLocaleDateString('fr-FR')}</span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="pt-2 border-t border-slate-800 space-y-2">
                        {/* Order Reorder */}
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span className="text-[11px]">Ordre d'affichage :</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleMoveOrder(poster.id, -1)}
                              disabled={index === 0}
                              className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 cursor-pointer"
                              title="Monter"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveOrder(poster.id, 1)}
                              disabled={index === posters.length - 1}
                              className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 cursor-pointer"
                              title="Descendre"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Fast Toggle Publish */}
                        <div className="flex items-center justify-between gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => handleTogglePublish(poster)}
                            disabled={publishLoadingId === poster.id}
                            className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer transition-all ${
                              poster.published ?? poster.isPublished
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                          >
                            {poster.published ?? poster.isPublished ? (
                              <>
                                <Eye className="w-3 h-3 text-emerald-400" />
                                <span>Publiée</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3 h-3" />
                                <span>Masquée</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleActive(poster)}
                            className={`py-1.5 px-2 rounded-lg text-[11px] font-bold uppercase flex items-center justify-center cursor-pointer transition-all ${
                              poster.active
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-500'
                            }`}
                            title={poster.active ? 'Désactiver' : 'Activer'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStartEdit(poster)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                            title="Modifier"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {deleteConfirmId === poster.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDelete(poster.id)}
                                className="px-2 py-1 rounded bg-red-600 text-white text-[10px] font-bold cursor-pointer"
                              >
                                Oui
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-[10px] cursor-pointer"
                              >
                                Non
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(poster.id)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 cursor-pointer"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Fullscreen Overlay Preview Modal */}
      {previewPoster && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div
            onClick={() => setPreviewPoster(null)}
            className="fixed inset-0 bg-black/85 backdrop-blur-xs cursor-pointer"
          />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 flex flex-col items-center justify-center max-w-[92vw] max-h-[85vh] animate-in zoom-in-95"
          >
            <button
              type="button"
              onClick={() => setPreviewPoster(null)}
              className="absolute -top-4 -right-4 z-20 p-2 rounded-full bg-black/80 hover:bg-black text-white border border-white/20 shadow-2xl cursor-pointer"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            <img
              src={previewPoster.imageUrl || previewPoster.renderedImageUrl || previewPoster.thumbnailUrl || previewPoster.content?.imageUrl}
              alt={previewPoster.title}
              className="max-w-full max-h-[80vh] object-contain block select-none"
              style={{ background: 'transparent' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
