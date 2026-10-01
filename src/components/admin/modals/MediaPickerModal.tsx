import React, { useState, useEffect, useMemo } from 'react';
import { Media } from '../../../types.js';
import { api } from '../../../lib/api.js';
import {
  X,
  Search,
  Upload,
  Check,
  Image as ImageIcon,
  Loader2,
  Camera,
  FolderOpen,
  Filter,
} from 'lucide-react';

interface MediaPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMedia: (media: Media) => void;
  selectedMediaId?: string;
  title?: string;
}

export const MediaPickerModal: React.FC<MediaPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectMedia,
  selectedMediaId,
  title = 'Choisir une image dans la bibliothèque',
}) => {
  const [mediaList, setMediaList] = useState<Media[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'library' | 'upload'>('library');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Load media list on open
  useEffect(() => {
    if (isOpen) {
      loadMedia();
    }
  }, [isOpen]);

  const loadMedia = async () => {
    try {
      setLoading(true);
      const res = await api.admin.getMedia();
      setMediaList(res.media || []);
    } catch (err: any) {
      console.error('Failed to load media list:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered media by search query
  const filteredMedia = useMemo(() => {
    if (!searchQuery.trim()) return mediaList;
    const q = searchQuery.toLowerCase();
    return mediaList.filter(
      m =>
        m.originalFilename.toLowerCase().includes(q) ||
        m.filename.toLowerCase().includes(q) ||
        (m.altText && m.altText.toLowerCase().includes(q))
    );
  }, [mediaList, searchQuery]);

  // Handle client-side canvas optimization & real upload
  const handleUploadFile = async (file: File) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Format d\'image non supporté. Formats acceptés : JPG, JPEG, PNG, WEBP.');
      return;
    }

    setUploading(true);
    setUploadError(null);

    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1400;
          const scale = Math.min(1, MAX_WIDTH / img.width);
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);

          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Impossible d\'initialiser le contexte graphique.');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Compress to WebP or JPEG
          const compressedBase64 = canvas.toDataURL('image/webp', 0.88);

          const res = await api.uploadImage(compressedBase64, file.name);
          if (res.media) {
            // Prepend new media
            setMediaList(prev => [res.media, ...prev]);
            // Automatically select and close
            onSelectMedia(res.media);
            onClose();
          }
        } catch (err: any) {
          setUploadError(err.message || 'Erreur lors du téléversement.');
        } finally {
          setUploading(false);
        }
      };
      img.onerror = () => {
        setUploadError('Impossible de charger l\'image sélectionnée.');
        setUploading(false);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div
      id="media-picker-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        id="media-picker-modal-content"
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#0b0f19] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white font-['Chakra_Petch'] uppercase tracking-wide">
                {title}
              </h3>
              <p className="text-[11px] text-slate-400">
                Sélectionnez une image existante ou téléversez un nouveau fichier persistant
              </p>
            </div>
          </div>
          <button
            id="close-media-picker-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs & Search */}
        <div className="px-5 py-3 border-b border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/30">
          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('library')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'library'
                  ? 'bg-cyan-500 text-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Bibliothèque ({mediaList.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-cyan-500 text-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Nouveau fichier</span>
            </button>
          </div>

          {/* Search */}
          {activeTab === 'library' && (
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Rechercher une image..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 min-h-[320px]">
          {activeTab === 'library' ? (
            <>
              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                  <span className="text-xs">Chargement de la bibliothèque...</span>
                </div>
              ) : filteredMedia.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-slate-800/60 text-slate-500 flex items-center justify-center mx-auto mb-3">
                    <ImageIcon className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1">
                    {searchQuery ? 'Aucune image trouvée' : 'Bibliothèque vide'}
                  </h4>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto mb-4">
                    {searchQuery
                      ? 'Aucun média ne correspond à votre recherche.'
                      : 'Vous n\'avez pas encore téléversé d\'image dans la bibliothèque.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('upload')}
                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Ajouter une première image</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filteredMedia.map(media => {
                    const isSelected = selectedMediaId === media.id;
                    const sizeFormatted =
                      media.size > 1024 * 1024
                        ? `${(media.size / (1024 * 1024)).toFixed(1)} Mo`
                        : `${Math.round(media.size / 1024)} Ko`;

                    return (
                      <div
                        key={media.id}
                        id={`media-item-${media.id}`}
                        onClick={() => {
                          onSelectMedia(media);
                          onClose();
                        }}
                        className={`group relative rounded-xl overflow-hidden border transition-all cursor-pointer bg-slate-900/60 hover:border-cyan-500/80 ${
                          isSelected
                            ? 'border-cyan-500 ring-2 ring-cyan-500/30'
                            : 'border-slate-800 hover:bg-slate-900'
                        }`}
                      >
                        {/* Thumbnail */}
                        <div className="aspect-square w-full bg-black/40 relative overflow-hidden flex items-center justify-center">
                          <img
                            src={media.url}
                            alt={media.altText || media.originalFilename}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            loading="lazy"
                          />
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-cyan-500 text-black flex items-center justify-center shadow-lg">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          )}
                        </div>

                        {/* Info Footer */}
                        <div className="p-2.5 space-y-1">
                          <p
                            className="text-xs font-bold text-white truncate group-hover:text-cyan-400 transition-colors"
                            title={media.originalFilename}
                          >
                            {media.originalFilename}
                          </p>
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>
                              {media.width && media.height ? `${media.width}×${media.height}` : media.mimeType.split('/')[1]?.toUpperCase()}
                            </span>
                            <span>{sizeFormatted}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* Upload Tab */
            <div className="max-w-md mx-auto py-6 space-y-4 text-center">
              <div className="p-8 rounded-2xl bg-slate-950/60 border-2 border-dashed border-slate-700 hover:border-cyan-500/50 transition-colors">
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-white mb-1">
                  Téléverser une image persistante
                </h4>
                <p className="text-xs text-slate-400 mb-5">
                  Prenez une photo ou sélectionnez un fichier depuis votre galerie. L'image sera sauvegardée de manière permanente sur le serveur.
                </p>

                {uploadError && (
                  <div className="mb-4 p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs text-left">
                    {uploadError}
                  </div>
                )}

                {uploading ? (
                  <div className="py-4 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                    <span className="text-xs text-cyan-400 font-bold">
                      Optimisation et enregistrement sur le serveur...
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <label className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg shadow-cyan-500/20">
                      <FolderOpen className="w-4 h-4" />
                      <span>Galerie / Fichiers</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/jpg"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) handleUploadFile(f);
                        }}
                        className="hidden"
                      />
                    </label>

                    <label className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors border border-slate-700 cursor-pointer">
                      <Camera className="w-4 h-4 text-cyan-400" />
                      <span>Appareil photo</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/jpg"
                        capture="environment"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) handleUploadFile(f);
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs">
          <span className="text-slate-400">
            {mediaList.length} image{mediaList.length > 1 ? 's' : ''} enregistrée{mediaList.length > 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
