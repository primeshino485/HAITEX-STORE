import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Media } from '../../../types.js';
import { api } from '../../../lib/api.js';
import {
  Upload,
  Image as ImageIcon,
  Copy,
  Check,
  Download,
  Trash2,
  Edit2,
  Eye,
  Share2,
  Search,
  Filter,
  RefreshCw,
  FolderOpen,
  Camera,
  AlertTriangle,
  X,
  ExternalLink,
  Layers,
  Sparkles,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

interface EnrichedMedia extends Media {
  usageCount: number;
  usedInProducts: { id: string; name: string }[];
}

export const AdminMediaUpload: React.FC = () => {
  const [mediaList, setMediaList] = useState<EnrichedMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'used' | 'unused'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Upload modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [altTextInput, setAltTextInput] = useState('');
  const [selectedFilePreview, setSelectedFilePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Preview modal state
  const [previewMedia, setPreviewMedia] = useState<EnrichedMedia | null>(null);

  // Edit alt text modal state
  const [editingMedia, setEditingMedia] = useState<EnrichedMedia | null>(null);
  const [editAltText, setEditAltText] = useState('');
  const [editOriginalName, setEditOriginalName] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete modal state
  const [deletingMedia, setDeletingMedia] = useState<EnrichedMedia | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Load media list on mount
  useEffect(() => {
    loadMedia();
  }, []);

  const loadMedia = async () => {
    try {
      setRefreshing(true);
      const res = await api.admin.getMedia();
      setMediaList((res.media as EnrichedMedia[]) || []);
    } catch (err: any) {
      console.error('Failed to load media:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Filter & search media
  const filteredMedia = useMemo(() => {
    return mediaList.filter(item => {
      // Tab filter
      if (filterTab === 'used' && item.usageCount === 0) return false;
      if (filterTab === 'unused' && item.usageCount > 0) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.originalFilename.toLowerCase().includes(q);
        const matchesFile = item.filename.toLowerCase().includes(q);
        const matchesAlt = item.altText?.toLowerCase().includes(q);
        return matchesName || matchesFile || matchesAlt;
      }
      return true;
    });
  }, [mediaList, filterTab, searchQuery]);

  // Usage counts
  const totalCount = mediaList.length;
  const usedCount = mediaList.filter(m => m.usageCount > 0).length;
  const unusedCount = mediaList.filter(m => m.usageCount === 0).length;

  // Copy link
  const handleCopyLink = (media: EnrichedMedia) => {
    const fullUrl = media.url.startsWith('http')
      ? media.url
      : `${window.location.origin}${media.url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(media.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Share link / file
  const handleShare = async (media: EnrichedMedia) => {
    const fullUrl = media.url.startsWith('http')
      ? media.url
      : `${window.location.origin}${media.url}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: media.originalFilename,
          text: `Image: ${media.originalFilename}`,
          url: fullUrl,
        });
      } catch (err) {
        // Fallback copy
        handleCopyLink(media);
      }
    } else {
      handleCopyLink(media);
    }
  };

  // Direct download
  const handleDownload = (media: EnrichedMedia) => {
    const a = document.createElement('a');
    a.href = media.url;
    a.download = media.originalFilename || media.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Handle client-side file selection for upload
  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Format non supporté. Formats acceptés : JPG, PNG, WEBP.');
      return;
    }

    setSelectedFile(file);
    setUploadError(null);

    // Generate local preview
    const reader = new FileReader();
    reader.onload = ev => {
      setSelectedFilePreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Process and perform persistent server upload
  const handleExecuteUpload = async () => {
    if (!selectedFile || !selectedFilePreview) {
      setUploadError('Veuillez sélectionner un fichier image.');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      // Optimize via Canvas before sending to reduce bandwidth while maintaining crispness
      const img = new Image();
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1600;
          const scale = Math.min(1, MAX_WIDTH / img.width);
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);

          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Impossible d\'initialiser le contexte graphique.');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Convert to WebP or JPEG base64
          const optimizedBase64 = canvas.toDataURL('image/webp', 0.88);

          // Send to server
          const res = await api.uploadImage(
            optimizedBase64,
            selectedFile.name,
            altTextInput.trim() || selectedFile.name
          );

          if (res.media) {
            const enriched: EnrichedMedia = {
              ...res.media,
              usageCount: 0,
              usedInProducts: [],
            };
            setMediaList(prev => [enriched, ...prev]);
            setUploadSuccess('Image téléversée et enregistrée dans la bibliothèque !');
            setTimeout(() => {
              setIsUploadModalOpen(false);
              setSelectedFile(null);
              setSelectedFilePreview(null);
              setAltTextInput('');
              setUploadSuccess(null);
            }, 1200);
          }
        } catch (canvasErr: any) {
          setUploadError(canvasErr.message || 'Erreur lors du traitement de l\'image.');
        } finally {
          setUploading(false);
        }
      };
      img.onerror = () => {
        setUploadError('Impossible de charger le fichier image sélectionné.');
        setUploading(false);
      };
      img.src = selectedFilePreview;
    } catch (err: any) {
      setUploadError(err.message || 'Erreur lors du téléversement.');
      setUploading(false);
    }
  };

  // Save edited alt text / display name
  const handleSaveEdit = async () => {
    if (!editingMedia) return;
    setIsSavingEdit(true);
    try {
      const res = await api.admin.updateMedia(editingMedia.id, {
        altText: editAltText.trim(),
        originalFilename: editOriginalName.trim() || editingMedia.originalFilename,
      });

      setMediaList(prev =>
        prev.map(m => (m.id === editingMedia.id ? { ...m, ...res.media } : m))
      );
      setEditingMedia(null);
    } catch (err: any) {
      alert('Erreur lors de la mise à jour : ' + err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Delete media handler
  const handleConfirmDelete = async (force = false) => {
    if (!deletingMedia) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await api.admin.deleteMedia(deletingMedia.id, force);
      if (res.success) {
        setMediaList(prev => prev.filter(m => m.id !== deletingMedia.id));
        setDeletingMedia(null);
      } else {
        setDeleteError(res.message);
      }
    } catch (err: any) {
      setDeleteError(err.message || 'Erreur lors de la suppression.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Header & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-[#0e1422] to-slate-900 border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
              <ImageIcon className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-black text-white font-['Chakra_Petch'] uppercase tracking-wider">
              Bibliothèque d'Images & Médias
            </h2>
          </div>
          <p className="text-xs text-slate-400 max-w-xl">
            Stockage persistant des images de votre boutique. Les images restent enregistrées sur le serveur et sont réutilisables à tout moment.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="refresh-media-btn"
            onClick={loadMedia}
            disabled={refreshing}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700"
            title="Actualiser la liste"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          <button
            id="open-upload-modal-btn"
            onClick={() => {
              setSelectedFile(null);
              setSelectedFilePreview(null);
              setUploadError(null);
              setUploadSuccess(null);
              setIsUploadModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-cyan-500/20 font-['Chakra_Petch'] uppercase tracking-wider"
          >
            <Upload className="w-4 h-4 stroke-[2.5]" />
            <span>Ajouter une image</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-slate-800 overflow-x-auto">
          <button
            id="filter-all-media"
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterTab === 'all'
                ? 'bg-cyan-500 text-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Toutes les images ({totalCount})
          </button>
          <button
            id="filter-used-media"
            onClick={() => setFilterTab('used')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              filterTab === 'used'
                ? 'bg-emerald-500 text-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Utilisées ({usedCount})</span>
          </button>
          <button
            id="filter-unused-media"
            onClick={() => setFilterTab('unused')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
              filterTab === 'unused'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>Non utilisées ({unusedCount})</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            id="search-media-input"
            type="text"
            placeholder="Rechercher par nom de fichier ou texte alt..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 transition-colors"
          />
        </div>
      </div>

      {/* Main Media Grid */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          <p className="text-xs font-medium">Chargement de vos médias...</p>
        </div>
      ) : filteredMedia.length === 0 ? (
        <div className="py-20 text-center rounded-2xl bg-[#0e1422] border border-slate-800/80 p-8">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/60 text-slate-500 flex items-center justify-center mx-auto mb-3">
            <ImageIcon className="w-8 h-8" />
          </div>
          <h3 className="text-sm sm:text-base font-bold text-white mb-1">
            {searchQuery ? 'Aucune image correspondante' : 'Aucune image dans cette catégorie'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-5">
            {searchQuery
              ? 'Essayez avec un autre mot-clé ou réinitialisez le filtre.'
              : 'Téléversez une photo depuis votre téléphone, tablette ou ordinateur pour commencer.'}
          </p>
          <button
            onClick={() => {
              setSelectedFile(null);
              setSelectedFilePreview(null);
              setUploadError(null);
              setIsUploadModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Téléverser une image</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredMedia.map(item => {
            const sizeFormatted =
              item.size > 1024 * 1024
                ? `${(item.size / (1024 * 1024)).toFixed(1)} Mo`
                : `${Math.round(item.size / 1024)} Ko`;
            const isCopied = copiedId === item.id;
            const isUsed = item.usageCount > 0;

            return (
              <div
                key={item.id}
                id={`media-card-${item.id}`}
                className="group flex flex-col rounded-2xl bg-[#0e1422] border border-slate-800 hover:border-slate-700 overflow-hidden transition-all duration-200 hover:shadow-xl hover:shadow-cyan-950/20"
              >
                {/* Image Container with Badge */}
                <div className="relative aspect-video w-full bg-black/60 overflow-hidden flex items-center justify-center">
                  <img
                    src={item.url}
                    alt={item.altText || item.originalFilename}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />

                  {/* Usage Badge */}
                  <div className="absolute top-2.5 left-2.5">
                    {isUsed ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/90 text-black flex items-center gap-1 shadow-md">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Utilisée ({item.usageCount})</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800/90 text-slate-300 border border-slate-700 shadow-md">
                        Non utilisée
                      </span>
                    )}
                  </div>

                  {/* Quick Preview Hover Button */}
                  <button
                    onClick={() => setPreviewMedia(item)}
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                    title="Aperçu grand format"
                  >
                    <div className="p-2 rounded-xl bg-cyan-500 text-black shadow-lg">
                      <Eye className="w-5 h-5" />
                    </div>
                  </button>
                </div>

                {/* Details */}
                <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h4
                      className="text-xs font-bold text-white truncate"
                      title={item.originalFilename}
                    >
                      {item.originalFilename}
                    </h4>
                    {item.altText && (
                      <p className="text-[11px] text-slate-400 truncate italic">
                        "{item.altText}"
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400">
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono">
                        {item.width && item.height ? `${item.width}×${item.height}` : item.mimeType.split('/')[1]?.toUpperCase()}
                      </span>
                      <span>{sizeFormatted}</span>
                      <span>•</span>
                      <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Action Buttons Toolbar */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1 text-slate-400">
                    <div className="flex items-center gap-1">
                      {/* Copy link */}
                      <button
                        id={`copy-link-btn-${item.id}`}
                        onClick={() => handleCopyLink(item)}
                        className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-cyan-400 transition-colors cursor-pointer"
                        title={isCopied ? 'Lien copié !' : 'Copier le lien permanent'}
                      >
                        {isCopied ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>

                      {/* Download */}
                      <button
                        onClick={() => handleDownload(item)}
                        className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
                        title="Télécharger l'image"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      {/* Share */}
                      <button
                        onClick={() => handleShare(item)}
                        className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
                        title="Partager"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>

                      {/* Edit Metadata */}
                      <button
                        onClick={() => {
                          setEditingMedia(item);
                          setEditAltText(item.altText || '');
                          setEditOriginalName(item.originalFilename || '');
                        }}
                        className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
                        title="Modifier le nom ou le texte alt"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Delete */}
                    <button
                      id={`delete-media-btn-${item.id}`}
                      onClick={() => {
                        setDeletingMedia(item);
                        setDeleteError(null);
                      }}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                      title="Supprimer définitivement"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ==================== UPLOAD MODAL ==================== */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-[#0b0f19] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white font-['Chakra_Petch'] uppercase tracking-wide">
                    Téléverser une image réelle
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Stockage persistant sur le serveur avec URL permanente
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {uploadError && (
                <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs">
                  {uploadError}
                </div>
              )}

              {uploadSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{uploadSuccess}</span>
                </div>
              )}

              {/* File Picker or Preview */}
              {!selectedFilePreview ? (
                <div className="p-6 rounded-2xl bg-slate-950/60 border-2 border-dashed border-slate-700 text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto">
                    <ImageIcon className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-white mb-1">
                      Sélectionnez une image depuis votre appareil
                    </h4>
                    <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                      Formats supportés : JPG, JPEG, PNG, WEBP (Max 10 Mo).
                    </p>
                  </div>

                  {/* Hidden inputs */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    onChange={handleFilePicked}
                    className="hidden"
                  />
                  <input
                    type="file"
                    ref={cameraInputRef}
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    capture="environment"
                    onChange={handleFilePicked}
                    className="hidden"
                  />

                  {/* Mobile Actions */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <FolderOpen className="w-4 h-4" />
                      <span>Galerie & Fichiers</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors border border-slate-700 cursor-pointer"
                    >
                      <Camera className="w-4 h-4 text-cyan-400" />
                      <span>Appareil photo</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Selected File Preview & Metadata */
                <div className="space-y-3">
                  <div className="relative aspect-video rounded-xl bg-black border border-slate-800 overflow-hidden flex items-center justify-center">
                    <img
                      src={selectedFilePreview}
                      alt="Aperçu avant upload"
                      className="max-h-56 object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setSelectedFilePreview(null);
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 hover:bg-red-500 text-white transition-colors cursor-pointer"
                      title="Changer d'image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="text-xs text-slate-300">
                    <span className="font-bold text-white">{selectedFile?.name}</span>
                    <span className="text-slate-500 ml-2">
                      ({Math.round((selectedFile?.size || 0) / 1024)} Ko)
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Description / Texte alternatif (Optionnel)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex : Diamants Free Fire 100 unités"
                      value={altTextInput}
                      onChange={e => setAltTextInput(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/60 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                disabled={uploading}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
              >
                Annuler
              </button>

              {selectedFilePreview && (
                <button
                  type="button"
                  id="confirm-upload-btn"
                  onClick={handleExecuteUpload}
                  disabled={uploading}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sauvegarde sur le serveur...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 stroke-[2.5]" />
                      <span>Enregistrer dans la bibliothèque</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== FULLSCREEN PREVIEW MODAL ==================== */}
      {previewMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl max-h-[95vh] flex flex-col bg-[#0b0f19] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/70">
              <div className="flex items-center gap-2 truncate">
                <ImageIcon className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="text-xs sm:text-sm font-bold text-white truncate font-mono">
                  {previewMedia.originalFilename}
                </span>
              </div>
              <button
                onClick={() => setPreviewMedia(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body: Image & Info Side by Side / Stacked */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col md:flex-row gap-6 items-center">
              {/* Image */}
              <div className="flex-1 w-full bg-black/60 rounded-xl border border-slate-800/80 p-2 flex items-center justify-center min-h-[260px] max-h-[500px]">
                <img
                  src={previewMedia.url}
                  alt={previewMedia.altText || previewMedia.originalFilename}
                  className="max-w-full max-h-[480px] object-contain rounded-lg"
                />
              </div>

              {/* Info Table */}
              <div className="w-full md:w-80 space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
                  <h4 className="text-[11px] font-black text-cyan-400 uppercase tracking-wider font-['Chakra_Petch']">
                    Informations du Média
                  </h4>

                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Dimensions</span>
                    <span className="text-white font-mono">
                      {previewMedia.width && previewMedia.height
                        ? `${previewMedia.width} × ${previewMedia.height} px`
                        : 'Non détecté'}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Taille</span>
                    <span className="text-white font-mono">
                      {previewMedia.size > 1024 * 1024
                        ? `${(previewMedia.size / (1024 * 1024)).toFixed(2)} Mo`
                        : `${Math.round(previewMedia.size / 1024)} Ko`}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Format MIME</span>
                    <span className="text-white font-mono uppercase">
                      {previewMedia.mimeType}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Date d'ajout</span>
                    <span className="text-white font-mono">
                      {new Date(previewMedia.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Utilisation</span>
                    <span
                      className={`font-bold ${
                        previewMedia.usageCount > 0 ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      {previewMedia.usageCount > 0
                        ? `${previewMedia.usageCount} produit(s)`
                        : 'Aucun produit'}
                    </span>
                  </div>
                </div>

                {/* Products Using this Image */}
                {previewMedia.usageCount > 0 && (
                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                    <span className="text-[11px] font-bold text-slate-300">
                      Produits associés :
                    </span>
                    <ul className="space-y-1 max-h-32 overflow-y-auto">
                      {previewMedia.usedInProducts.map(p => (
                        <li
                          key={p.id}
                          className="px-2 py-1 rounded bg-slate-950/80 border border-slate-800/60 text-white text-[11px] truncate flex items-center justify-between"
                        >
                          <span className="truncate">{p.name}</span>
                          <span className="text-[10px] text-cyan-400 font-mono">#{p.id}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Quick actions */}
                <div className="space-y-2">
                  <button
                    onClick={() => handleCopyLink(previewMedia)}
                    className="w-full py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedId === previewMedia.id ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    <span>
                      {copiedId === previewMedia.id ? 'URL permanente copiée !' : 'Copier l\'URL permanente'}
                    </span>
                  </button>

                  <button
                    onClick={() => handleDownload(previewMedia)}
                    className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                  >
                    <Download className="w-4 h-4" />
                    <span>Télécharger le fichier original</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== EDIT METADATA MODAL ==================== */}
      {editingMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-[#0b0f19] border border-slate-800 rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Modifier les métadonnées</h3>
              <button
                onClick={() => setEditingMedia(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Nom d'affichage</label>
                <input
                  type="text"
                  value={editOriginalName}
                  onChange={e => setEditOriginalName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Texte alternatif (Alt text)
                </label>
                <input
                  type="text"
                  placeholder="Description pour accessibilité"
                  value={editAltText}
                  onChange={e => setEditAltText(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingMedia(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="px-4 py-1.5 rounded-xl bg-cyan-500 text-black font-bold text-xs hover:bg-cyan-400"
              >
                {isSavingEdit ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== DELETE CONFIRMATION MODAL ==================== */}
      {deletingMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-[#0b0f19] border border-red-500/40 rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center border border-red-500/20 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Supprimer l'image ?</h3>
                <p className="text-xs text-slate-400">
                  Cette action supprimera le fichier du serveur.
                </p>
              </div>
            </div>

            {deletingMedia.usageCount > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs space-y-1.5">
                <p className="font-bold">
                  ⚠️ Attention : cette image est utilisée par {deletingMedia.usageCount} produit(s) :
                </p>
                <ul className="list-disc list-inside space-y-0.5 max-h-24 overflow-y-auto font-mono text-[11px]">
                  {deletingMedia.usedInProducts.map(p => (
                    <li key={p.id}>{p.name}</li>
                  ))}
                </ul>
                <p className="text-[10px] text-amber-400/80">
                  Si vous la supprimez, l'affichage de ces produits pourra être affecté.
                </p>
              </div>
            )}

            {deleteError && (
              <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs">
                {deleteError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingMedia(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
              >
                Annuler
              </button>

              <button
                type="button"
                id="confirm-delete-media-btn"
                onClick={() => handleConfirmDelete(deletingMedia.usageCount > 0)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeleting
                  ? 'Suppression en cours...'
                  : deletingMedia.usageCount > 0
                  ? 'Forcer la suppression'
                  : 'Supprimer définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
