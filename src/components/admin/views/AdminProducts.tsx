import React, { useEffect, useState, useMemo, useRef } from 'react';
import { api } from '../../../lib/api.js';
import { useStore } from '../../../context/StoreContext.js';
import { Product, DigitalCode, Category, PlatformOrGame, Media } from '../../../types.js';
import { isValidHttpsDownloadUrl } from '../../../lib/urlUtils.js';
import { MediaPickerModal } from '../modals/MediaPickerModal.js';
import { DigitalAccountsModal } from '../modals/DigitalAccountsModal.js';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  Copy,
  Eye,
  EyeOff,
  Star, 
  Package, 
  Key, 
  AlertTriangle, 
  Check, 
  X, 
  Upload,
  RefreshCw,
  ArrowUpDown,
  Filter,
  ShieldCheck,
  Gamepad2,
  Tv,
  Cpu,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Layers,
  TrendingDown,
  ChevronRight,
  ChevronLeft,
  Lock,
  MessageSquare,
  Zap,
  Clock,
  Info,
  AlertCircle,
  Download,
  KeyRound,
  CheckCircle2
} from 'lucide-react';

export const AdminProducts: React.FC<{
  categories: Category[];
  platforms: PlatformOrGame[];
  initialCategoryFilter?: string;
}> = ({ categories, platforms: initialPlatforms, initialCategoryFilter }) => {
  const { refreshCatalog } = useStore();

  const [products, setProducts] = useState<Product[]>([]);
  const [platformsList, setPlatformsList] = useState<PlatformOrGame[]>(initialPlatforms);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters and Sorting
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>(initialCategoryFilter || 'all');
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterStock, setFilterStock] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');

  // Modals state
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // Digital Account Delivery State for Product Form
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountThankYouMessage, setAccountThankYouMessage] = useState('');
  const [accountInstructions, setAccountInstructions] = useState('');
  const [showAccountPassword, setShowAccountPassword] = useState(false);
  const [isLoadingAccountCredentials, setIsLoadingAccountCredentials] = useState(false);
  const [managingCodesProduct, setManagingCodesProduct] = useState<Product | null>(null);
  const [managingAccountsProduct, setManagingAccountsProduct] = useState<Product | null>(null);
  const [currentCodes, setCurrentCodes] = useState<DigitalCode[]>([]);
  const [codesFilter, setCodesFilter] = useState<'all' | 'unused' | 'used'>('all');
  const [codesBatchText, setCodesBatchText] = useState('');
  const [singleCodeText, setSingleCodeText] = useState('');
  const [isAddingCodes, setIsAddingCodes] = useState(false);
  const [previewBatchResult, setPreviewBatchResult] = useState<{
    totalGiven: number;
    validCount: number;
    duplicateCount: number;
    existingCount: number;
    toAdd: string[];
    ignored: { code: string; reason: string }[];
  } | null>(null);
  const [isPreviewingCodes, setIsPreviewingCodes] = useState(false);
  
  const [stockModalProduct, setStockModalProduct] = useState<Product | null>(null);
  const [stockAction, setStockAction] = useState<'set' | 'add' | 'remove'>('set');
  const [stockQuantity, setStockQuantity] = useState(10);
  const [isUpdatingStock, setIsUpdatingStock] = useState(false);

  // Inline Quick Platform / Game Creation Modal
  const [isCreatingPlatform, setIsCreatingPlatform] = useState(false);
  const [newPlatformName, setNewPlatformName] = useState('');
  const [newPlatformCategory, setNewPlatformCategory] = useState('cat-gaming');
  const [newPlatformImage, setNewPlatformImage] = useState('https://images.unsplash.com/photo-1542751371-adc38448a05e?w=500&auto=format&fit=crop');
  const [isSavingPlatform, setIsSavingPlatform] = useState(false);

  // Image Upload reference & compression state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isCompressingImage, setIsCompressingImage] = useState(false);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<'main' | 'gallery'>('main');

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const data = await api.admin.getAllProducts();
      setProducts(data);
    } catch (err) {
      console.error('Failed to load admin products:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlatforms = async () => {
    try {
      const plats = await api.getPlatforms();
      setPlatformsList(plats);
    } catch (err) {
      console.error('Failed to reload platforms:', err);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchPlatforms();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Image upload and client-side canvas compression handler
  const handleImageFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      alert('Format d\'image non supporté. Veuillez utiliser un fichier JPG, PNG ou WEBP.');
      return;
    }

    setIsCompressingImage(true);
    try {
      // Read file into image element
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = async () => {
          // Draw to canvas with max dimension of 1000px
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1000;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas context non disponible');
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to WebP or JPEG base64 (quality 0.85)
          const compressedBase64 = canvas.toDataURL('image/webp', 0.85);

          // Upload via API
          try {
            const uploadRes = await api.uploadImage(compressedBase64, file.name);
            if (editingProduct) {
              if (mediaPickerTarget === 'gallery') {
                setEditingProduct(prev =>
                  prev
                    ? {
                        ...prev,
                        galleryImages: [...(prev.galleryImages || []), uploadRes.url],
                        galleryMediaIds: [...(prev.galleryMediaIds || []), uploadRes.media?.id || ''],
                      }
                    : null
                );
                showToast('Image ajoutée à la galerie !');
              } else {
                setEditingProduct(prev =>
                  prev
                    ? {
                        ...prev,
                        image: uploadRes.url,
                        imageId: uploadRes.media?.id,
                      }
                    : null
                );
                showToast('Image principale optimisée et enregistrée !');
              }
            }
          } catch (uploadErr: any) {
            // Fallback: use the compressed base64 directly
            if (editingProduct) {
              if (mediaPickerTarget === 'gallery') {
                setEditingProduct(prev =>
                  prev ? { ...prev, galleryImages: [...(prev.galleryImages || []), compressedBase64] } : null
                );
              } else {
                setEditingProduct(prev => (prev ? { ...prev, image: compressedBase64 } : null));
              }
            }
            showToast('Image locale prête !');
          } finally {
            setIsCompressingImage(false);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error(err);
      alert('Erreur lors du traitement de l\'image: ' + err.message);
      setIsCompressingImage(false);
    }
  };

  // Handlers for creating and editing products with digital account support
  const handleStartNewProduct = () => {
    setAccountEmail('');
    setAccountPassword('');
    setAccountThankYouMessage('');
    setAccountInstructions('');
    setShowAccountPassword(false);
    setEditingProduct({
      name: '',
      priceHTG: 500,
      categoryId: categories[0]?.id || 'cat-gaming',
      subcategoryId: platformsList[0]?.id || '',
      platformId: platformsList[0]?.id || '',
      image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop',
      stock: 10,
      productType: 'code',
      deliveryType: 'CODE',
      status: 'published',
      isFeatured: false,
      featuredOrder: 0,
      requiresPlayerIdVerification: false,
      verificationIdFieldName: 'UID Free Fire',
      requiresWhatsApp: false,
      description: '',
      deliveryInstructions: 'Code délivré instantanément après validation du paiement.',
    });
  };

  const handleStartEditProduct = async (prod: Product) => {
    setShowAccountPassword(false);
    setAccountEmail(prod.accountCredentials?.email || '');
    setAccountPassword('');
    setAccountThankYouMessage(prod.thankYouMessage || '');
    setAccountInstructions(prod.customerInstructions || prod.deliveryInstructions || '');
    setEditingProduct(prod);

    if (prod.deliveryType === 'COMPTE' && prod.id) {
      setIsLoadingAccountCredentials(true);
      try {
        const creds = await api.admin.getProductAccountCredentials(prod.id);
        if (creds) {
          if (creds.email) setAccountEmail(creds.email);
          if (creds.password) setAccountPassword(creds.password);
          if (creds.thankYouMessage) setAccountThankYouMessage(creds.thankYouMessage);
          if (creds.customerInstructions) setAccountInstructions(creds.customerInstructions);
        }
      } catch (err) {
        console.warn('Could not load account credentials:', err);
      } finally {
        setIsLoadingAccountCredentials(false);
      }
    }
  };

  const toggleRevealAccountPassword = async () => {
    if (!showAccountPassword && !accountPassword && editingProduct?.id) {
      setIsLoadingAccountCredentials(true);
      try {
        const creds = await api.admin.getProductAccountCredentials(editingProduct.id);
        if (creds?.password) {
          setAccountPassword(creds.password);
        }
      } catch (err) {
        console.warn('Could not fetch account password:', err);
      } finally {
        setIsLoadingAccountCredentials(false);
      }
    }
    setShowAccountPassword(prev => !prev);
  };

  // Save product
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    if (!editingProduct.name?.trim()) {
      alert('Veuillez renseigner le nom du produit.');
      return;
    }
    if ((editingProduct.priceHTG ?? 0) < 0) {
      alert('Le prix en Gourdes doit être supérieur ou égal à 0 HTG.');
      return;
    }

    if (editingProduct.deliveryType === 'DOWNLOAD_LINK') {
      if (!isValidHttpsDownloadUrl(editingProduct.downloadUrl)) {
        alert("Un lien de téléchargement HTTPS est obligatoire pour ce type de produit.");
        return;
      }
    }

    if (editingProduct.deliveryType === 'COMPTE') {
      const cleanEmail = accountEmail.trim();
      const cleanPass = accountPassword.trim();
      if (!cleanEmail) {
        alert("L'Email / Identifiant du compte numérique est obligatoire.");
        return;
      }
      if (!cleanPass && !editingProduct.id) {
        alert("Le mot de passe du compte numérique est obligatoire.");
        return;
      }
    }

    setIsSavingProduct(true);
    try {
      const productPayload: Partial<Product> = {
        ...editingProduct,
        thankYouMessage: editingProduct.deliveryType === 'COMPTE'
          ? (accountThankYouMessage.trim() || undefined)
          : editingProduct.thankYouMessage,
        customerInstructions: editingProduct.deliveryType === 'COMPTE'
          ? (accountInstructions.trim() || undefined)
          : (editingProduct.customerInstructions || editingProduct.deliveryInstructions),
        deliveryInstructions: editingProduct.deliveryType === 'COMPTE'
          ? (accountInstructions.trim() || undefined)
          : (editingProduct.customerInstructions || editingProduct.deliveryInstructions),
        accountCredentials: editingProduct.deliveryType === 'COMPTE' ? {
          email: accountEmail.trim(),
          password: accountPassword.trim() || undefined,
        } : editingProduct.accountCredentials,
      };

      await api.admin.saveProduct(productPayload);
      showToast(editingProduct.id ? 'Produit mis à jour avec succès !' : 'Nouveau produit créé et prêt pour la boutique !');
      setEditingProduct(null);
      await fetchProducts();
      await refreshCatalog();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de l\'enregistrement du produit.');
    } finally {
      setIsSavingProduct(false);
    }
  };

  // Duplicate product
  const handleDuplicateProduct = async (prod: Product) => {
    try {
      const duplicated = await api.admin.duplicateProduct(prod.id);
      showToast(`Produit dupliqué avec succès : "${duplicated.name}" (Statut: Brouillon).`);
      await fetchProducts();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la duplication.');
    }
  };

  // Toggle Visibility (Publish / Hide)
  const handleToggleVisibility = async (prod: Product) => {
    try {
      if (prod.status === 'published') {
        await api.admin.hideProduct(prod.id);
        showToast(`"${prod.name}" est maintenant MASQUÉ.`);
      } else {
        await api.admin.publishProduct(prod.id);
        showToast(`"${prod.name}" est maintenant PUBLIÉ dans la boutique.`);
      }
      await fetchProducts();
      await refreshCatalog();
    } catch (err: any) {
      alert(err.message || 'Erreur lors du changement de statut.');
    }
  };

  // Toggle Featured
  const handleToggleFeatured = async (product: Product) => {
    try {
      await api.admin.featureProduct(product.id, !product.isFeatured);
      showToast(`Produit ${!product.isFeatured ? 'mis en avant ⭐' : 'retiré des offres en vedette'}.`);
      await fetchProducts();
      await refreshCatalog();
    } catch (err: any) {
      alert(err.message || 'Erreur');
    }
  };

  // Delete product
  const handleDeleteProduct = async (id: string, name: string) => {
    if (!confirm(`Confirmez-vous la suppression définitive du produit "${name}" ? Cette action est irréversible.`)) return;
    try {
      await api.admin.deleteProduct(id);
      showToast('Produit définitivement supprimé.');
      await fetchProducts();
      await refreshCatalog();
    } catch (err: any) {
      alert(err.message || 'Erreur de suppression.');
    }
  };

  // Stock update
  const handleStockUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockModalProduct) return;
    setIsUpdatingStock(true);
    try {
      await api.admin.updateStock(stockModalProduct.id, stockAction, stockQuantity);
      showToast('Stock mis à jour avec succès.');
      setStockModalProduct(null);
      await fetchProducts();
    } catch (err: any) {
      alert(err.message || 'Erreur');
    } finally {
      setIsUpdatingStock(false);
    }
  };

  // Open Codes manager
  const openCodesManager = async (prod: Product) => {
    setManagingCodesProduct(prod);
    setCodesBatchText('');
    setSingleCodeText('');
    setPreviewBatchResult(null);
    setCodesFilter('all');
    try {
      const codes = await api.admin.getProductCodes(prod.id);
      setCurrentCodes(codes);
    } catch (err) {
      console.error(err);
    }
  };

  // Preview codes batch to detect duplicates before insertion
  const handlePreviewCodes = async () => {
    if (!managingCodesProduct || !codesBatchText.trim()) return;
    const lines = codesBatchText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);
    if (lines.length === 0) return;

    setIsPreviewingCodes(true);
    try {
      const preview = await api.admin.previewCodes(managingCodesProduct.id, lines);
      setPreviewBatchResult(preview);
      if (preview.duplicateCount > 0 || preview.existingCount > 0) {
        showToast(`Analyse : ${preview.validCount} code(s) valide(s), ${preview.duplicateCount + preview.existingCount} doublon(s) détecté(s).`);
      } else {
        showToast(`Analyse : ${preview.validCount} code(s) prêts à être importés (0 doublon).`);
      }
    } catch (err: any) {
      alert(err.message || 'Erreur lors de l\'analyse des codes');
    } finally {
      setIsPreviewingCodes(false);
    }
  };

  // Add single code
  const handleAddSingleCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingCodesProduct || !singleCodeText.trim()) return;
    const code = singleCodeText.trim();
    setIsAddingCodes(true);
    try {
      const res = await api.admin.addCodes(managingCodesProduct.id, [code]);
      if (res.addedCount === 0) {
        alert('Ce code existe déjà dans la base pour ce produit.');
      } else {
        showToast(`Code ajouté avec succès. Stock synchronisé : ${res.newStock}`);
        setSingleCodeText('');
        const updatedCodes = await api.admin.getProductCodes(managingCodesProduct.id);
        setCurrentCodes(updatedCodes);
        await fetchProducts();
      }
    } catch (err: any) {
      alert(err.message || 'Erreur');
    } finally {
      setIsAddingCodes(false);
    }
  };

  // Batch add digital codes
  const handleAddCodesBatch = async () => {
    if (!managingCodesProduct || !codesBatchText.trim()) return;
    const lines = codesBatchText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);
    
    if (lines.length === 0) return;

    setIsAddingCodes(true);
    try {
      const res = await api.admin.addCodes(managingCodesProduct.id, lines);
      showToast(`${res.addedCount} code(s) ajouté(s). Stock synchronisé : ${res.newStock}`);
      setCodesBatchText('');
      setPreviewBatchResult(null);
      const updatedCodes = await api.admin.getProductCodes(managingCodesProduct.id);
      setCurrentCodes(updatedCodes);
      await fetchProducts();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de l\'ajout des codes');
    } finally {
      setIsAddingCodes(false);
    }
  };

  // Delete single code
  const handleDeleteCode = async (codeId: string) => {
    if (!managingCodesProduct) return;
    if (!confirm('Voulez-vous supprimer ce code disponible ?')) return;
    try {
      await api.admin.deleteCode(codeId);
      setCurrentCodes(prev => prev.filter(c => c.id !== codeId));
      await fetchProducts();
      showToast('Code supprimé.');
    } catch (err: any) {
      alert(err.message || 'Erreur');
    }
  };

  // Create new Platform / Game inline
  const handleCreatePlatformInline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlatformName.trim()) return;

    setIsSavingPlatform(true);
    try {
      const cat = categories.find(c => c.id === newPlatformCategory);
      const plat = await api.admin.savePlatform({
        name: newPlatformName.trim(),
        categoryId: newPlatformCategory,
        image: newPlatformImage.trim(),
        type: newPlatformCategory === 'cat-gaming' ? 'game' : newPlatformCategory === 'cat-streaming' ? 'streaming' : 'panel',
        active: true,
        idVerification: newPlatformCategory === 'cat-gaming' ? {
          verificationEnabled: true,
          provider: 'local_validator',
          idType: 'alphanumeric',
          idFieldName: `UID ${newPlatformName.trim()}`,
          idRegex: '^[0-9A-Za-z_-]{4,20}$',
          idPlaceholder: '512893041',
          idFormatHelp: `Saisissez votre identifiant officiel pour ${newPlatformName.trim()}.`,
          regionRequired: true,
          regionOptions: ['LATAM', 'NA', 'EU', 'GLOBAL'],
        } : undefined,
      });

      showToast(`Plateforme / Jeu "${plat.name}" créé avec succès !`);
      await fetchPlatforms();
      await refreshCatalog();

      // Automatically select in editing product
      if (editingProduct) {
        setEditingProduct({
          ...editingProduct,
          categoryId: plat.categoryId,
          subcategoryId: plat.id,
          platformId: plat.id,
          subcategoryName: plat.name,
        });
      }

      setIsCreatingPlatform(false);
      setNewPlatformName('');
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la création de la plateforme');
    } finally {
      setIsSavingPlatform(false);
    }
  };

  // Metrics summary
  const metrics = useMemo(() => {
    const total = products.length;
    const inStock = products.filter(p => p.stock > 0).length;
    const lowStock = products.filter(p => p.stock > 0 && p.stock <= 3).length;
    const outOfStock = products.filter(p => p.stock <= 0).length;
    const featured = products.filter(p => p.isFeatured).length;
    const published = products.filter(p => p.status === 'published').length;
    return { total, inStock, lowStock, outOfStock, featured, published };
  }, [products]);

  // Filtered & Sorted products list
  const filteredProducts = useMemo(() => {
    let list = [...products];

    // Category filter
    if (filterCategory !== 'all') {
      list = list.filter(p => p.categoryId === filterCategory);
    }

    // Platform / Game filter
    if (filterPlatform !== 'all') {
      list = list.filter(p => (p.subcategoryId === filterPlatform || p.platformId === filterPlatform));
    }

    // Status filter
    if (filterStatus !== 'all') {
      if (filterStatus === 'out_of_stock') {
        list = list.filter(p => p.stock <= 0 || p.status === 'out_of_stock');
      } else {
        list = list.filter(p => p.status === filterStatus);
      }
    }

    // Stock filter
    if (filterStock === 'in_stock') {
      list = list.filter(p => p.stock > 0);
    } else if (filterStock === 'low_stock') {
      list = list.filter(p => p.stock > 0 && p.stock <= 3);
    } else if (filterStock === 'out_of_stock') {
      list = list.filter(p => p.stock <= 0);
    }

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => 
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.subcategoryName && p.subcategoryName.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    }

    // Sorting
    if (sortBy === 'priceAsc') {
      list.sort((a, b) => a.priceHTG - b.priceHTG);
    } else if (sortBy === 'priceDesc') {
      list.sort((a, b) => b.priceHTG - a.priceHTG);
    } else if (sortBy === 'alphaAsc') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'alphaDesc') {
      list.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sortBy === 'featured') {
      list.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
    } else if (sortBy === 'oldest') {
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else {
      // newest
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return list;
  }, [products, filterCategory, filterPlatform, filterStatus, filterStock, search, sortBy]);

  // Platforms filtered for currently selected category in editing modal
  const platformsForCurrentEditCategory = useMemo(() => {
    if (!editingProduct?.categoryId) return platformsList;
    return platformsList.filter(p => p.categoryId === editingProduct.categoryId);
  }, [platformsList, editingProduct?.categoryId]);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Toast alert */}
      {toastMessage && (
        <div className="fixed top-14 right-4 z-50 p-3.5 rounded-xl bg-cyan-500 text-black font-extrabold text-xs shadow-2xl flex items-center gap-2 border border-cyan-300 animate-in slide-in-from-top-2">
          <Check className="w-4 h-4 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-[#0e1626] to-slate-900 border border-slate-800 shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Package className="w-4 h-4" />
            </span>
            <h2 className="text-sm sm:text-base font-black text-white font-['Chakra_Petch'] uppercase tracking-wider">
              Gestion des Produits, Stocks & Codes
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Gérez votre boutique numérique 100% en direct : prix en HTG, décrémentation atomique, codes d'activation et jeux
          </p>
        </div>

        <button
          onClick={handleStartNewProduct}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer whitespace-nowrap min-h-[44px]"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Nouveau Produit</span>
        </button>
      </div>

      {/* KPI / Metrics Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        <div className="p-3 rounded-xl bg-[#0e1422] border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Produits</span>
            <span className="text-base sm:text-lg font-black text-white font-mono">{metrics.total}</span>
          </div>
          <Layers className="w-5 h-5 text-slate-500" />
        </div>

        <div className="p-3 rounded-xl bg-[#0e1422] border border-emerald-950/60 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-emerald-400 block">En Stock</span>
            <span className="text-base sm:text-lg font-black text-emerald-400 font-mono">{metrics.inStock}</span>
          </div>
          <Package className="w-5 h-5 text-emerald-500" />
        </div>

        <div className="p-3 rounded-xl bg-[#0e1422] border border-amber-950/60 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-amber-400 block">Stock Faible (≤3)</span>
            <span className="text-base sm:text-lg font-black text-amber-400 font-mono">{metrics.lowStock}</span>
          </div>
          <TrendingDown className="w-5 h-5 text-amber-500" />
        </div>

        <div className="p-3 rounded-xl bg-[#0e1422] border border-red-950/60 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-red-400 block">Rupture (0)</span>
            <span className="text-base sm:text-lg font-black text-red-400 font-mono">{metrics.outOfStock}</span>
          </div>
          <AlertTriangle className="w-5 h-5 text-red-500" />
        </div>

        <div className="p-3 rounded-xl bg-[#0e1422] border border-cyan-950/60 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-cyan-400 block">Publiés</span>
            <span className="text-base sm:text-lg font-black text-cyan-400 font-mono">{metrics.published}</span>
          </div>
          <Eye className="w-5 h-5 text-cyan-500" />
        </div>

        <div className="p-3 rounded-xl bg-[#0e1422] border border-amber-500/30 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-amber-300 block">En Vedette ⭐</span>
            <span className="text-base sm:text-lg font-black text-amber-300 font-mono">{metrics.featured}</span>
          </div>
          <Star className="w-5 h-5 text-amber-400 fill-amber-400/30" />
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-3.5 rounded-2xl bg-[#0e1422] border border-slate-800 space-y-3">
        {/* Quick Filter Pills (Mobile-First Touch Bar) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            onClick={() => {
              setFilterCategory('all');
              setFilterPlatform('all');
              setFilterStatus('all');
              setFilterStock('all');
            }}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer min-h-[34px] ${
              filterCategory === 'all' && filterStatus === 'all' && filterStock === 'all'
                ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            Tous
          </button>

          <button
            onClick={() => {
              setFilterCategory('cat-gaming');
              setFilterPlatform('all');
              setFilterStatus('all');
              setFilterStock('all');
            }}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer min-h-[34px] flex items-center gap-1.5 ${
              filterCategory === 'cat-gaming' && filterStatus === 'all' && filterStock === 'all'
                ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span>Gaming</span>
          </button>

          <button
            onClick={() => {
              setFilterCategory('cat-streaming');
              setFilterPlatform('all');
              setFilterStatus('all');
              setFilterStock('all');
            }}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer min-h-[34px] flex items-center gap-1.5 ${
              filterCategory === 'cat-streaming' && filterStatus === 'all' && filterStock === 'all'
                ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>Streaming</span>
          </button>

          <button
            onClick={() => {
              setFilterCategory('cat-panels');
              setFilterPlatform('all');
              setFilterStatus('all');
              setFilterStock('all');
            }}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer min-h-[34px] flex items-center gap-1.5 ${
              filterCategory === 'cat-panels' && filterStatus === 'all' && filterStock === 'all'
                ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Panels</span>
          </button>

          <button
            onClick={() => {
              setFilterStatus('published');
              setFilterStock('all');
            }}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer min-h-[34px] flex items-center gap-1 ${
              filterStatus === 'published'
                ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                : 'bg-slate-900 border border-slate-800 text-emerald-400 hover:bg-slate-800'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>Publiés</span>
          </button>

          <button
            onClick={() => {
              setFilterStatus('hidden');
              setFilterStock('all');
            }}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer min-h-[34px] flex items-center gap-1 ${
              filterStatus === 'hidden'
                ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20'
                : 'bg-slate-900 border border-slate-800 text-purple-300 hover:bg-slate-800'
            }`}
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>Masqués</span>
          </button>

          <button
            onClick={() => {
              setFilterStatus('all');
              setFilterStock('out_of_stock');
            }}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer min-h-[34px] flex items-center gap-1 ${
              filterStock === 'out_of_stock'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                : 'bg-slate-900 border border-slate-800 text-red-400 hover:bg-slate-800'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Rupture de stock</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par nom, SKU, jeu ou description..."
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-10 pr-8 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors min-h-[42px]"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sort selector */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5 min-h-[42px]">
            <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="bg-transparent text-xs text-slate-300 focus:outline-none cursor-pointer w-full"
            >
              <option value="newest">Plus récent</option>
              <option value="oldest">Plus ancien</option>
              <option value="priceAsc">Prix croissant</option>
              <option value="priceDesc">Prix décroissant</option>
              <option value="alphaAsc">Nom A-Z</option>
              <option value="alphaDesc">Nom Z-A</option>
              <option value="featured">⭐ En vedette</option>
            </select>
          </div>
        </div>

        {/* Filter chips row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-800/80 text-xs">
          {/* Category */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Catégorie</label>
            <select
              value={filterCategory}
              onChange={e => {
                setFilterCategory(e.target.value);
                setFilterPlatform('all');
              }}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
            >
              <option value="all">Toutes les catégories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Platform / Game */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Jeu / Plateforme</label>
            <select
              value={filterPlatform}
              onChange={e => setFilterPlatform(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
            >
              <option value="all">Tous les jeux / plateformes</option>
              {platformsList
                .filter(p => filterCategory === 'all' || p.categoryId === filterCategory)
                .map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Statut Boutique</label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
            >
              <option value="all">Tous les statuts</option>
              <option value="published">Publiés (En ligne)</option>
              <option value="draft">Brouillons</option>
              <option value="hidden">Masqués</option>
              <option value="out_of_stock">Rupture de stock</option>
            </select>
          </div>

          {/* Stock Level */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Niveau de Stock</label>
            <select
              value={filterStock}
              onChange={e => setFilterStock(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
            >
              <option value="all">Tous les niveaux</option>
              <option value="in_stock">En stock (&gt; 0)</option>
              <option value="low_stock">Stock faible (1 à 3)</option>
              <option value="out_of_stock">Épuisé (0)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products List (Cards mobile-first with desktop layout) */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
          <span>Chargement du catalogue des produits...</span>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400 space-y-3">
          <Package className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="font-semibold">Aucun produit ne correspond aux filtres actuels.</p>
          <button
            onClick={() => {
              setSearch('');
              setFilterCategory('all');
              setFilterPlatform('all');
              setFilterStatus('all');
              setFilterStock('all');
            }}
            className="px-3.5 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 font-bold hover:bg-cyan-500/30"
          >
            Réinitialiser tous les filtres
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>Affichage de <strong>{filteredProducts.length}</strong> produit(s)</span>
            <button
              onClick={fetchProducts}
              className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Actualiser</span>
            </button>
          </div>

          {filteredProducts.map(p => {
            const isOutOfStock = p.stock <= 0;
            const isLowStock = p.stock > 0 && p.stock <= 3;
            const creationDate = p.createdAt ? new Date(p.createdAt).toLocaleDateString('fr-FR') : 'Récent';

            return (
              <div
                key={p.id}
                className={`p-3 sm:p-4 rounded-2xl bg-[#0e1422] border transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-md ${
                  isOutOfStock 
                    ? 'border-red-900/40 hover:border-red-800/60' 
                    : p.status === 'hidden'
                    ? 'border-purple-900/40 opacity-90'
                    : p.status === 'draft'
                    ? 'border-amber-900/40'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Left: Image & Info */}
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                  <div className="relative flex-shrink-0">
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-slate-700/60 bg-slate-900"
                    />
                    {p.isFeatured && (
                      <span className="absolute -top-1.5 -left-1.5 p-1 rounded-full bg-amber-500 text-black shadow-md" title="En Vedette">
                        <Star className="w-3 h-3 fill-black stroke-black" />
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="text-sm font-bold text-white truncate max-w-sm">
                        {p.name}
                      </h4>
                      <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                        {p.sku}
                      </span>
                      {p.requiresPlayerIdVerification && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          <ShieldCheck className="w-3 h-3" />
                          <span>UID Requis</span>
                        </span>
                      )}
                      {p.requiresWhatsApp && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <MessageSquare className="w-3 h-3" />
                          <span>WhatsApp Requis</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs flex-wrap text-slate-400">
                      <span className="font-extrabold text-cyan-400 font-mono text-sm">
                        {(p.priceHTG ?? 0).toLocaleString()} <span className="text-[10px] text-cyan-300">HTG</span>
                      </span>
                      <span className="text-slate-600">•</span>
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-bold text-slate-300 uppercase">
                        {p.subcategoryName || p.categoryId.replace('cat-', '')}
                      </span>
                      <span className="text-slate-600">•</span>
                      <span className="text-[10px] text-slate-500">Créé le {creationDate}</span>
                    </div>

                    {/* Status & Stock Badges */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {/* Status badge */}
                      {p.status === 'published' ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-black text-[9px] uppercase border border-emerald-500/30 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          PUBLIÉ
                        </span>
                      ) : p.status === 'draft' ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-black text-[9px] uppercase border border-amber-500/30 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          BROUILLON
                        </span>
                      ) : p.status === 'hidden' ? (
                        <span className="px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 font-black text-[9px] uppercase border border-purple-500/30 flex items-center gap-1">
                          <EyeOff className="w-2.5 h-2.5" />
                          MASQUÉ
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-black text-[9px] uppercase border border-slate-700">
                          {p.status}
                        </span>
                      )}

                      {/* Stock badge */}
                      {isOutOfStock ? (
                        <span className="px-2 py-0.5 rounded-full bg-red-600/20 text-red-400 font-black text-[9px] uppercase border border-red-500/40 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
                          STOCK ÉPUISÉ
                        </span>
                      ) : isLowStock ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[10px] border border-amber-500/40">
                          Stock Faible : {p.stock} restant(s)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 font-bold text-[10px] border border-emerald-500/40">
                          Stock Réel : {p.stock}
                        </span>
                      )}

                      {/* Product delivery type badge */}
                      {(() => {
                        if (p.deliveryType === 'DOWNLOAD_LINK') {
                          return (
                            <span className="px-2 py-0.5 rounded-full bg-cyan-950/90 text-cyan-300 font-bold text-[10px] border border-cyan-500/50 flex items-center gap-1 shadow-sm">
                              <Download className="w-3 h-3 text-cyan-400" />
                              LIEN DE TÉLÉCHARGEMENT
                            </span>
                          );
                        }
                        const isAccount = p.deliveryType === 'COMPTE' || p.productType === 'account' || p.subcategoryId === 'plat-netflix' || p.subcategoryId === 'plat-spotify' || p.id.startsWith('prod-netflix');
                        const isManual = p.deliveryType === 'MANUAL_WHATSAPP' || p.requiresWhatsApp;
                        const isCode = p.deliveryType === 'CODE' || (!isManual && !isAccount && (p.productType === 'code' || p.deliveryType === 'DIGITAL_INSTANT'));

                        if (isAccount) {
                          return (
                            <span className="px-2 py-0.5 rounded-full bg-indigo-950/90 text-indigo-300 font-bold text-[10px] border border-indigo-500/50 flex items-center gap-1 shadow-sm">
                              <ShieldCheck className="w-3 h-3 text-indigo-400" />
                              COMPTE NUMÉRIQUE
                            </span>
                          );
                        }
                        if (isCode) {
                          return (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-950/90 text-emerald-300 font-bold text-[10px] border border-emerald-500/50 flex items-center gap-1 shadow-sm">
                              <Key className="w-3 h-3 text-emerald-400" />
                              CODE INSTANTANÉ
                            </span>
                          );
                        }
                        return (
                          <span className="px-2 py-0.5 rounded-full bg-amber-950/90 text-amber-300 font-bold text-[10px] border border-amber-500/50 flex items-center gap-1 shadow-sm">
                            <MessageSquare className="w-3 h-3 text-amber-400" />
                            LIVRAISON MANUELLE
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Right: Actions bar (touch-friendly on mobile) */}
                <div className="flex items-center gap-1.5 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800 flex-wrap justify-end">
                  {/* Toggle Published / Hidden */}
                  <button
                    onClick={() => handleToggleVisibility(p)}
                    className={`p-2 rounded-xl border transition-all cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center ${
                      p.status === 'published'
                        ? 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-800'
                        : 'bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30'
                    }`}
                    title={p.status === 'published' ? 'Masquer le produit' : 'Publier dans la boutique'}
                  >
                    {p.status === 'published' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>

                  {/* Toggle Featured ⭐ */}
                  <button
                    onClick={() => handleToggleFeatured(p)}
                    className={`p-2 rounded-xl border transition-all cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center ${
                      p.isFeatured
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-sm'
                        : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300 hover:bg-slate-800'
                    }`}
                    title={p.isFeatured ? 'Retirer des offres en vedette' : 'Mettre en avant dans OFFRES EN VEDETTE'}
                  >
                    <Star className={`w-4 h-4 ${p.isFeatured ? 'fill-amber-400' : ''}`} />
                  </button>

                  {/* Adjust Stock */}
                  <button
                    onClick={() => {
                      setStockModalProduct(p);
                      setStockQuantity(p.stock);
                    }}
                    className="px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer min-h-[40px]"
                    title="Gérer le stock réel"
                  >
                    <Package className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Stock</span>
                  </button>

                  {/* Digital Accounts Inventory button */}
                  {(p.deliveryType === 'COMPTE' || p.productType === 'account' || p.subcategoryId === 'plat-netflix' || p.subcategoryId === 'plat-spotify' || p.id.startsWith('prod-netflix')) && (
                    <button
                      onClick={() => setManagingAccountsProduct(p)}
                      className="px-2.5 py-2 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/90 border border-indigo-500/60 text-indigo-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer min-h-[40px]"
                      title="Gérer les identifiants et comptes numériques de ce produit"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Comptes</span>
                    </button>
                  )}

                  {/* Digital Codes Inventory button */}
                  {(p.deliveryType === 'CODE' || (!p.requiresWhatsApp && p.deliveryType !== 'MANUAL_WHATSAPP' && p.deliveryType !== 'COMPTE' && (p.productType === 'code' || p.productType === 'access'))) && (
                    <button
                      onClick={() => openCodesManager(p)}
                      className="px-2.5 py-2 rounded-xl bg-emerald-950/40 hover:bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer min-h-[40px]"
                      title="Gérer les clés et codes numériques uniques"
                    >
                      <Key className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Codes</span>
                    </button>
                  )}

                  {/* Duplicate */}
                  <button
                    onClick={() => handleDuplicateProduct(p)}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
                    title="Dupliquer le produit"
                  >
                    <Copy className="w-4 h-4" />
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => handleStartEditProduct(p)}
                    className="px-3 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer min-h-[40px]"
                    title="Modifier le produit"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Modifier</span>
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDeleteProduct(p.id, p.name)}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-red-500/20 border border-slate-700 text-slate-400 hover:text-red-400 transition-all cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
                    title="Supprimer définitivement"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ==================== MODAL 1: ADD / EDIT PRODUCT ==================== */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div 
            className="w-full max-w-2xl bg-[#0c121e] border border-cyan-500/40 rounded-3xl shadow-2xl p-5 sm:p-6 max-h-[92vh] overflow-y-auto space-y-4"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <Package className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white font-['Chakra_Petch'] uppercase tracking-wider">
                    {editingProduct.id ? `Modifier : ${editingProduct.name}` : 'Ajouter un Nouveau Produit'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Définissez les détails, le stock en HTG et les options de livraison
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              {/* Product Name */}
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Nom du produit *
                </label>
                <input
                  type="text"
                  required
                  value={editingProduct.name || ''}
                  onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  placeholder="Ex: Free Fire 520 Diamants, Netflix 1 mois 4K, Panel Pro VIP..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-medium"
                />
              </div>

              {/* Price & Stock Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Prix en Gourdes (HTG) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min={0}
                      step="any"
                      value={editingProduct.priceHTG ?? 0}
                      onChange={e => setEditingProduct({ ...editingProduct, priceHTG: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-3 pr-11 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-cyan-500"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-cyan-400 font-black font-['Chakra_Petch'] text-xs">
                      HTG
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Prix barré / Promo (HTG)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={editingProduct.originalPriceHTG ?? ''}
                      onChange={e => setEditingProduct({ ...editingProduct, originalPriceHTG: e.target.value ? parseFloat(e.target.value) : undefined })}
                      placeholder="Ex: 500"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-3 pr-11 py-2 text-slate-300 font-mono text-sm focus:outline-none focus:border-cyan-500"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">
                      HTG
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Stock Réel *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={editingProduct.stock ?? 10}
                    onChange={e => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1 flex items-center justify-between">
                    <span>Alerte stock bas</span>
                    <span className="text-[10px] text-amber-400 font-normal">Seuil</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editingProduct.lowStockThreshold ?? 5}
                    onChange={e => setEditingProduct({ ...editingProduct, lowStockThreshold: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-mono font-bold text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Delivery Mode & Estimated Time Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-2xl bg-cyan-950/20 border border-cyan-500/20">
                <div>
                  <label className="block text-cyan-300 font-bold mb-1 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-cyan-400" />
                    Mode de livraison numérique *
                  </label>
                  <select
                    value={
                      editingProduct.deliveryType === 'DOWNLOAD_LINK'
                        ? 'DOWNLOAD_LINK'
                        : editingProduct.deliveryType === 'COMPTE' || editingProduct.productType === 'account'
                        ? 'COMPTE'
                        : editingProduct.deliveryType === 'MANUAL_WHATSAPP' || editingProduct.deliveryType === 'MANUEL' || editingProduct.requiresWhatsApp
                        ? 'MANUEL'
                        : 'CODE'
                    }
                    onChange={e => {
                      const val = e.target.value as 'CODE' | 'COMPTE' | 'DOWNLOAD_LINK' | 'MANUEL';
                      let deliveryTypeVal: 'CODE' | 'COMPTE' | 'DOWNLOAD_LINK' | 'MANUEL' = val;
                      let reqWhatsApp = val === 'MANUEL';
                      let pType = editingProduct.productType;
                      if (val === 'COMPTE') {
                        pType = 'account';
                      } else if (val === 'CODE' && pType === 'account') {
                        pType = 'code';
                      }

                      setEditingProduct({
                        ...editingProduct,
                        deliveryType: deliveryTypeVal,
                        productType: pType,
                        requiresWhatsApp: reqWhatsApp,
                        processingTime: val === 'MANUEL' 
                          ? (editingProduct.processingTime || '15-60 min') 
                          : (editingProduct.processingTime || 'Instantané (0-5 min)'),
                        deliveryInstructions: val === 'COMPTE'
                          ? (editingProduct.deliveryInstructions || 'Identifiants de compte privé délivrés instantanément après paiement.')
                          : val === 'DOWNLOAD_LINK'
                          ? (editingProduct.deliveryInstructions || 'Lien de téléchargement sécurisé disponible instantanément après validation du paiement.')
                          : val === 'CODE'
                          ? (editingProduct.deliveryInstructions || 'Code numérique délivré instantanément après validation du paiement.')
                          : (editingProduct.deliveryInstructions || 'Notre équipe vous contactera sur WhatsApp pour activer votre service.'),
                      });
                    }}
                    className="w-full bg-slate-900 border border-cyan-500/30 rounded-xl px-3 py-2 text-white font-semibold focus:outline-none focus:border-cyan-500"
                  >
                    <option value="CODE">🔑 CODE — Code d'activation ou clé instantanée</option>
                    <option value="COMPTE">🛡️ COMPTE — Compte numérique privé (Netflix, Spotify, streaming...)</option>
                    <option value="DOWNLOAD_LINK">📥 LIEN DE TÉLÉCHARGEMENT — Fichier, outil, logiciel, APK, ressource</option>
                    <option value="MANUEL">💬 MANUEL — Traitement manuel par WhatsApp</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {editingProduct.deliveryType === 'DOWNLOAD_LINK'
                      ? 'L\'administrateur configure un lien HTTPS sécurisé qui sera automatiquement remis au client après validation du paiement.'
                      : editingProduct.deliveryType === 'COMPTE'
                      ? 'Chaque commande déduit 1 compte réel dans l\'inventaire des comptes (mot de passe chiffré AES-256).'
                      : editingProduct.deliveryType === 'MANUEL' || editingProduct.requiresWhatsApp
                      ? 'Recharge manuelle par l\'équipe après contact WhatsApp du client.'
                      : 'Un code numérique sera automatiquement déduit du stock et délivré dans la bibliothèque.'}
                  </p>
                </div>

                <div>
                  <label className="block text-cyan-300 font-bold mb-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    Délai estimé de livraison
                  </label>
                  <input
                    type="text"
                    value={editingProduct.processingTime || ''}
                    onChange={e => setEditingProduct({ ...editingProduct, processingTime: e.target.value })}
                    placeholder="Ex: Instantané (0-5 min) ou 15-45 minutes"
                    className="w-full bg-slate-900 border border-cyan-500/30 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {['Instantané (0-5 min)', '10-30 min', '1-2 heures', '24h max'].map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setEditingProduct({ ...editingProduct, processingTime: preset })}
                        className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] text-cyan-300 border border-slate-700 transition-colors"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Mandatory HTTPS URL for DOWNLOAD_LINK */}
              {editingProduct.deliveryType === 'DOWNLOAD_LINK' && (
                <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-cyan-300 font-bold text-sm flex items-center gap-1.5">
                      <Download className="w-4 h-4 text-cyan-400" />
                      Lien de téléchargement HTTPS *
                    </label>
                    {editingProduct.downloadUrl && (
                      isValidHttpsDownloadUrl(editingProduct.downloadUrl) ? (
                        <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                          <Check className="w-3 h-3" /> URL HTTPS valide
                        </span>
                      ) : (
                        <span className="text-[11px] text-amber-400 font-semibold flex items-center gap-1 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-500/30">
                          <AlertTriangle className="w-3 h-3" /> URL HTTPS obligatoire (ex: https://...)
                        </span>
                      )
                    )}
                  </div>
                  <input
                    type="url"
                    required
                    value={editingProduct.downloadUrl || ''}
                    onChange={e => setEditingProduct({ ...editingProduct, downloadUrl: e.target.value })}
                    placeholder="https://example.com/download/mon-fichier.zip"
                    className={`w-full bg-slate-900 border rounded-xl px-3.5 py-2.5 text-white font-mono text-sm placeholder-slate-500 focus:outline-none transition-colors ${
                      editingProduct.downloadUrl && !isValidHttpsDownloadUrl(editingProduct.downloadUrl)
                        ? 'border-amber-500 focus:border-amber-400'
                        : 'border-cyan-500/40 focus:border-cyan-400'
                    }`}
                  />
                  <div className="text-xs text-slate-400 space-y-1">
                    <p>
                      Entrez l'URL HTTPS réelle du fichier, outil, APK ou ressource (Google Drive, Mega, serveur sécurisé).
                    </p>
                    <p className="text-[11px] text-cyan-400/90 font-medium">
                      🔒 Sécurité garantie : Ce lien n'est jamais affiché publiquement sur la vitrine et ne sera remis au client qu'après paiement validé.
                    </p>
                  </div>
                </div>
              )}

              {/* Dynamic Digital Account Delivery Section (Visible strictly when deliveryType === 'COMPTE') */}
              {editingProduct.deliveryType === 'COMPTE' && (
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900/70 to-purple-950/30 border border-indigo-500/40 shadow-xl space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-indigo-500/20">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white font-['Chakra_Petch'] tracking-wide">
                          INFORMATIONS DU COMPTE
                        </h4>
                        <p className="text-[11px] text-indigo-300/80">
                          Identifiants et message de livraison pour le compte streaming ou numérique
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Chiffrement AES-256
                    </span>
                  </div>

                  {isLoadingAccountCredentials && (
                    <div className="p-2 rounded-xl bg-indigo-950/50 border border-indigo-500/30 flex items-center gap-2 text-xs text-indigo-300">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                      <span>Chargement sécurisé des identifiants enregistrés...</span>
                    </div>
                  )}

                  {/* Form fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {/* Email / Identifiant */}
                    <div className="space-y-1">
                      <label className="block text-indigo-200 font-bold text-xs">
                        Email / Identifiant *
                      </label>
                      <input
                        type="text"
                        required
                        value={accountEmail}
                        onChange={e => setAccountEmail(e.target.value)}
                        placeholder="email@example.com"
                        className="w-full bg-slate-900/90 border border-indigo-500/40 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-400 transition-colors"
                      />
                      <p className="text-[10px] text-slate-400">
                        Adresse e-mail ou identifiant du compte livré.
                      </p>
                    </div>

                    {/* Mot de passe */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="block text-indigo-200 font-bold text-xs">
                          Mot de passe *
                        </label>
                        <button
                          type="button"
                          onClick={toggleRevealAccountPassword}
                          className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          {showAccountPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          <span>{showAccountPassword ? 'Masquer' : 'Afficher'}</span>
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showAccountPassword ? 'text' : 'password'}
                          required={!editingProduct.id}
                          value={accountPassword}
                          onChange={e => setAccountPassword(e.target.value)}
                          placeholder={editingProduct.id ? '•••••••••••• (Inchangé si vide)' : 'Mot de passe sécurisé'}
                          className="w-full bg-slate-900/90 border border-indigo-500/40 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-400 transition-colors pr-20"
                        />
                        <button
                          type="button"
                          onClick={toggleRevealAccountPassword}
                          className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-[10px] font-bold border border-indigo-500/20 transition-all cursor-pointer flex items-center gap-1"
                        >
                          {showAccountPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          <span>{showAccountPassword ? 'Masquer' : 'Afficher'}</span>
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Chiffré en AES-256. Révélé uniquement au client après confirmation de paiement.
                      </p>
                    </div>
                  </div>

                  {/* Message de remerciement */}
                  <div className="space-y-1">
                    <label className="block text-indigo-200 font-bold text-xs flex items-center justify-between">
                      <span>Message de remerciement</span>
                      <span className="text-[10px] font-normal text-slate-400">Optionnel</span>
                    </label>
                    <textarea
                      rows={2}
                      value={accountThankYouMessage}
                      onChange={e => setAccountThankYouMessage(e.target.value)}
                      placeholder="Merci pour votre achat et votre confiance. Profitez bien de votre abonnement !"
                      className="w-full bg-slate-900/90 border border-indigo-500/40 rounded-xl px-3.5 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-400 transition-colors"
                    />
                    <p className="text-[10px] text-slate-400">
                      Affiché au client avec ses identifiants après commande. Si laissé vide, aucun message ne sera affiché.
                    </p>
                  </div>

                  {/* Instructions d'utilisation */}
                  <div className="space-y-1">
                    <label className="block text-indigo-200 font-bold text-xs flex items-center justify-between">
                      <span>Instructions d'utilisation</span>
                      <span className="text-[10px] font-normal text-slate-400">Optionnel</span>
                    </label>
                    <textarea
                      rows={2}
                      value={accountInstructions}
                      onChange={e => {
                        setAccountInstructions(e.target.value);
                        setEditingProduct({ ...editingProduct, customerInstructions: e.target.value, deliveryInstructions: e.target.value });
                      }}
                      placeholder="Connectez-vous avec les identifiants ci-dessus."
                      className="w-full bg-slate-900/90 border border-indigo-500/40 rounded-xl px-3.5 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-400 transition-colors"
                    />
                    <p className="text-[10px] text-slate-400">
                      Instructions de connexion remises au client (ex: profil à utiliser, restrictions d'appareil).
                    </p>
                  </div>

                  {/* ADMIN PREVIEW CARD (Conforme Spécification Section 13) */}
                  <div className="pt-2 border-t border-indigo-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                        Prévisualisation Livraison Client
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Aperçu exact affiché dans la bibliothèque du client après livraison
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-black/60 border border-indigo-500/30 space-y-2.5 text-xs">
                      <div className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
                        INFORMATIONS DE VOTRE COMPTE
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Email / Identifiant</span>
                          <span className="font-mono text-white font-bold truncate block">
                            {accountEmail || <span className="text-slate-500 italic">email@example.com</span>}
                          </span>
                        </div>

                        <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-slate-400 block">Mot de passe</span>
                            <span className="font-mono text-white font-bold">
                              {showAccountPassword ? (accountPassword || '(Masqué)') : '••••••••••••'}
                            </span>
                          </div>
                          <span className="text-[10px] text-indigo-400 font-semibold">
                            {showAccountPassword ? '[Masqué]' : '[Afficher]'}
                          </span>
                        </div>
                      </div>

                      {accountThankYouMessage.trim() && (
                        <div className="p-2.5 rounded-lg bg-cyan-950/30 border border-cyan-500/30">
                          <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block mb-0.5">
                            MESSAGE
                          </span>
                          <p className="text-cyan-100 text-[11px] whitespace-pre-wrap">
                            {accountThankYouMessage}
                          </p>
                        </div>
                      )}

                      {accountInstructions.trim() && (
                        <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-700/60">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                            INSTRUCTIONS
                          </span>
                          <p className="text-slate-300 text-[11px] whitespace-pre-wrap">
                            {accountInstructions}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Category & Subcategory/Game/Platform Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Catégorie Principale *
                  </label>
                  <select
                    value={editingProduct.categoryId || 'cat-gaming'}
                    onChange={e => {
                      const newCatId = e.target.value;
                      const validPlats = platformsList.filter(p => p.categoryId === newCatId);
                      setEditingProduct({
                        ...editingProduct,
                        categoryId: newCatId,
                        subcategoryId: validPlats[0]?.id || '',
                        platformId: validPlats[0]?.id || '',
                        subcategoryName: validPlats[0]?.name || '',
                      });
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-medium focus:outline-none focus:border-cyan-500"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-bold">
                      Jeu / Plateforme / Service
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setNewPlatformCategory(editingProduct.categoryId || 'cat-gaming');
                        setIsCreatingPlatform(true);
                      }}
                      className="text-[10px] text-cyan-400 font-extrabold hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Créer un nouveau jeu</span>
                    </button>
                  </div>
                  <select
                    value={editingProduct.subcategoryId || editingProduct.platformId || ''}
                    onChange={e => {
                      const plat = platformsList.find(p => p.id === e.target.value);
                      setEditingProduct({
                        ...editingProduct,
                        subcategoryId: e.target.value,
                        platformId: e.target.value,
                        subcategoryName: plat?.name,
                      });
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-medium focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">Aucune plateforme spécifique</option>
                    {platformsForCurrentEditCategory.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Product Type & Status Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Type de produit numérique *
                  </label>
                  <select
                    value={editingProduct.productType || 'code'}
                    onChange={e => setEditingProduct({ ...editingProduct, productType: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-medium focus:outline-none focus:border-cyan-500"
                  >
                    <option value="code">Code d'activation / Clé numérique</option>
                    <option value="topup">Recharge Directe Joueur (UID)</option>
                    <option value="subscription">Compte / Abonnement Streaming</option>
                    <option value="panel">Panel / Clé de Service API</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Statut du produit *
                  </label>
                  <select
                    value={editingProduct.status || 'published'}
                    onChange={e => setEditingProduct({ ...editingProduct, status: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-medium focus:outline-none focus:border-cyan-500"
                  >
                    <option value="published">PUBLIÉ (Visible et achetable en boutique)</option>
                    <option value="draft">BROUILLON (Invisible aux clients)</option>
                    <option value="hidden">MASQUÉ (Désactivé temporairement)</option>
                  </select>
                </div>
              </div>

              {/* Image Input with Upload & Library Picker */}
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-slate-300 font-bold text-xs">
                    Image principale du produit *
                  </label>
                  {editingProduct.imageId && (
                    <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <Check className="w-3 h-3" />
                      Liée à la bibliothèque
                    </span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  {/* Current image preview */}
                  {editingProduct.image && (
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-700 bg-black flex-shrink-0">
                      <img
                        src={editingProduct.image}
                        alt="Aperçu"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="flex-1 w-full space-y-2">
                    <input
                      type="text"
                      required
                      value={editingProduct.image || ''}
                      onChange={e => setEditingProduct({ ...editingProduct, image: e.target.value })}
                      placeholder="URL de l'image (ex: /uploads/... ou https://...)"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs"
                    />

                    {/* Action buttons: Library + Upload */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        id="choose-from-library-btn"
                        onClick={() => {
                          setMediaPickerTarget('main');
                          setIsMediaPickerOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Choisir dans la bibliothèque</span>
                      </button>

                      <button
                        type="button"
                        id="add-new-image-btn"
                        disabled={isCompressingImage}
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer disabled:opacity-50"
                      >
                        {isCompressingImage ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Téléversement...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Ajouter une nouvelle image</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Hidden file input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageFileSelected}
                  accept="image/png,image/jpeg,image/webp,image/jpg"
                  className="hidden"
                />
              </div>

              {/* Optional Gallery Images */}
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label className="block text-slate-300 font-bold text-xs">
                      Galerie d'images (Optionnel)
                    </label>
                    <span className="text-[10px] text-slate-500">
                      Ajoutez, réorganisez ou définissez des images supplémentaires pour ce produit.
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setMediaPickerTarget('gallery');
                        fileInputRef.current?.click();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-[11px] font-bold flex items-center gap-1 transition-colors border border-slate-700 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Téléverser</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMediaPickerTarget('gallery');
                        setIsMediaPickerOpen(true);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500 hover:text-black text-cyan-400 text-[11px] font-bold flex items-center gap-1 transition-colors border border-cyan-500/30 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Médiathèque</span>
                    </button>
                  </div>
                </div>

                {editingProduct.galleryImages && editingProduct.galleryImages.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                    {editingProduct.galleryImages.map((imgUrl, idx) => (
                      <div
                        key={idx}
                        className="relative rounded-xl overflow-hidden border border-slate-700 bg-black/60 p-1 space-y-1.5 group"
                      >
                        <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-950">
                          <img src={imgUrl} alt={`Galerie ${idx + 1}`} className="w-full h-full object-cover" />
                          <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-white font-mono text-[9px] font-bold">
                            #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const newGallery = [...(editingProduct.galleryImages || [])];
                              newGallery.splice(idx, 1);
                              const newMediaIds = [...(editingProduct.galleryMediaIds || [])];
                              newMediaIds.splice(idx, 1);
                              setEditingProduct({
                                ...editingProduct,
                                galleryImages: newGallery,
                                galleryMediaIds: newMediaIds,
                              });
                            }}
                            className="absolute top-1 right-1 p-1 rounded-full bg-black/80 text-white hover:bg-red-500 transition-colors cursor-pointer"
                            title="Supprimer de la galerie"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Reordering & Set Primary Controls */}
                        <div className="flex items-center justify-between gap-1 text-[10px]">
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => {
                                if (idx === 0) return;
                                const newGallery = [...(editingProduct.galleryImages || [])];
                                const temp = newGallery[idx - 1];
                                newGallery[idx - 1] = newGallery[idx];
                                newGallery[idx] = temp;
                                setEditingProduct({ ...editingProduct, galleryImages: newGallery });
                              }}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                              title="Déplacer vers la gauche"
                            >
                              <ChevronLeft className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === (editingProduct.galleryImages?.length ?? 1) - 1}
                              onClick={() => {
                                if (idx >= (editingProduct.galleryImages?.length ?? 1) - 1) return;
                                const newGallery = [...(editingProduct.galleryImages || [])];
                                const temp = newGallery[idx + 1];
                                newGallery[idx + 1] = newGallery[idx];
                                newGallery[idx] = temp;
                                setEditingProduct({ ...editingProduct, galleryImages: newGallery });
                              }}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                              title="Déplacer vers la droite"
                            >
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const currentMain = editingProduct.image;
                              const newGallery = [...(editingProduct.galleryImages || [])];
                              newGallery[idx] = currentMain;
                              setEditingProduct({
                                ...editingProduct,
                                image: imgUrl,
                                galleryImages: newGallery,
                              });
                              showToast('Image définie comme principale !');
                            }}
                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-amber-500/20 hover:text-amber-300 text-slate-400 font-medium text-[9px] flex items-center gap-0.5 cursor-pointer"
                            title="Définir comme image principale"
                          >
                            <Star className="w-2.5 h-2.5" />
                            <span>Principale</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic">
                    Aucune image supplémentaire dans la galerie.
                  </p>
                )}
              </div>

              {/* Protected Content Section */}
              <div className="p-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 space-y-2.5">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-indigo-400" />
                  <div>
                    <label className="block text-indigo-200 font-bold text-xs">
                      Contenu protégé après achat (Optionnel)
                    </label>
                    <span className="text-[10px] text-indigo-300/70">
                      Ressource privée ou tutoriel débloqué automatiquement dans la bibliothèque du client après confirmation de commande.
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={editingProduct.protectedContentTitle || ''}
                    onChange={e => setEditingProduct({ ...editingProduct, protectedContentTitle: e.target.value })}
                    placeholder="Titre de la ressource protégée (ex: Tutoriel d'activation VIP, Guide PDF...)"
                    className="w-full bg-slate-900 border border-indigo-500/30 rounded-xl px-3 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-400"
                  />
                  <textarea
                    rows={2}
                    value={editingProduct.protectedContent || ''}
                    onChange={e => setEditingProduct({ ...editingProduct, protectedContent: e.target.value })}
                    placeholder="Contenu textuel protégé ou instructions confidentielles après commande..."
                    className="w-full bg-slate-900 border border-indigo-500/30 rounded-xl p-2.5 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-400"
                  />
                </div>
              </div>

              {/* Description & Detailed Instructions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Description du produit</label>
                  <textarea
                    rows={2}
                    value={editingProduct.description || ''}
                    onChange={e => setEditingProduct({ ...editingProduct, description: e.target.value })}
                    placeholder="Description concise affichée sur la carte..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Instructions de livraison pour le client</label>
                  <textarea
                    rows={2}
                    value={editingProduct.customerInstructions || editingProduct.deliveryInstructions || ''}
                    onChange={e => setEditingProduct({ 
                      ...editingProduct, 
                      customerInstructions: e.target.value,
                      deliveryInstructions: e.target.value 
                    })}
                    placeholder="Ex: Code délivré instantanément ou consignes d'activation..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              {/* Internal Admin Processing Instructions */}
              <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
                <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-purple-400" />
                  Notes / Procédure interne Admin (Privé)
                </label>
                <textarea
                  rows={2}
                  value={editingProduct.adminInstructions || ''}
                  onChange={e => setEditingProduct({ ...editingProduct, adminInstructions: e.target.value })}
                  placeholder="Ex: Utiliser le portail partenaire X, contacter le fournisseur Y si rupture..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-purple-200 placeholder-slate-600 focus:outline-none focus:border-purple-500 font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Visible uniquement par les administrateurs pour la gestion des commandes.
                </p>
              </div>

              {/* Advanced Options: Featured ⭐, UID Verification 🛡️, WhatsApp 💬, Additional Verification 📋 */}
              <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider block">
                  Options Avancées de Vente & Validation
                </span>

                {/* Toggle Featured */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400/20" />
                    <div>
                      <span className="font-bold text-white block">Mettre en avant dans « OFFRES EN VEDETTE »</span>
                      <span className="text-[10px] text-slate-400">Ce produit apparaîtra directement sur la page d'accueil.</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={editingProduct.isFeatured || false}
                    onChange={e => setEditingProduct({ ...editingProduct, isFeatured: e.target.checked })}
                    className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-cyan-500 cursor-pointer"
                  />
                </div>

                {/* Toggle UID Verification */}
                <div className="space-y-2 p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <div>
                        <span className="font-bold text-white block">Vérification Joueur / UID obligatoire</span>
                        <span className="text-[10px] text-slate-400">Le client doit obligatoirement saisir et valider son identifiant avant achat.</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={editingProduct.requiresPlayerIdVerification || false}
                      onChange={e => setEditingProduct({ ...editingProduct, requiresPlayerIdVerification: e.target.checked })}
                      className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-cyan-500 cursor-pointer"
                    />
                  </div>

                  {editingProduct.requiresPlayerIdVerification && (
                    <div className="pt-2 border-t border-slate-800">
                      <label className="block text-[11px] text-slate-300 font-bold mb-1">
                        Nom de l'identifiant demandé au client :
                      </label>
                      <input
                        type="text"
                        value={editingProduct.verificationIdFieldName || ''}
                        onChange={e => setEditingProduct({ ...editingProduct, verificationIdFieldName: e.target.value })}
                        placeholder="Ex: UID Free Fire, Player ID Blood Strike, Compte ID..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                  )}
                </div>

                {/* Toggle WhatsApp Required */}
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-emerald-400" />
                      <div>
                        <span className="font-bold text-white block">Numéro WhatsApp obligatoire</span>
                        <span className="text-[10px] text-slate-400">
                          Le client doit obligatoirement fournir son numéro WhatsApp pour ce service avant de pouvoir finaliser sa commande.
                        </span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={editingProduct.requiresWhatsApp || editingProduct.deliveryType === 'MANUAL_WHATSAPP' || false}
                      onChange={e => setEditingProduct({ ...editingProduct, requiresWhatsApp: e.target.checked })}
                      className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-emerald-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Toggle Additional Verification */}
                <div className="space-y-2 p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-blue-400" />
                      <div>
                        <span className="font-bold text-white block">Vérification manuelle supplémentaire requise</span>
                        <span className="text-[10px] text-slate-400">
                          Nécessite une validation manuelle par l'administrateur avant expédition finale.
                        </span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={editingProduct.requiresAdditionalVerification || false}
                      onChange={e => setEditingProduct({ ...editingProduct, requiresAdditionalVerification: e.target.checked })}
                      className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-blue-500 cursor-pointer"
                    />
                  </div>

                  {editingProduct.requiresAdditionalVerification && (
                    <div className="pt-2 border-t border-slate-800">
                      <label className="block text-[11px] text-blue-300 font-bold mb-1">
                        Consignes de vérification :
                      </label>
                      <input
                        type="text"
                        value={editingProduct.additionalVerificationInstructions || ''}
                        onChange={e => setEditingProduct({ ...editingProduct, additionalVerificationInstructions: e.target.value })}
                        placeholder="Ex: Confirmer l'historique d'achat ou le screenshot du paiement"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer min-h-[44px]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSavingProduct}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-black uppercase tracking-wider text-xs shadow-lg shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50 min-h-[44px] flex items-center gap-1.5"
                >
                  {isSavingProduct ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <span>Enregistrer le Produit</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Media Picker Modal */}
      {isMediaPickerOpen && editingProduct && (
        <MediaPickerModal
          isOpen={isMediaPickerOpen}
          onClose={() => setIsMediaPickerOpen(false)}
          selectedMediaId={editingProduct.imageId}
          onSelectMedia={(selectedMedia: Media) => {
            if (mediaPickerTarget === 'main') {
              setEditingProduct(prev =>
                prev
                  ? {
                      ...prev,
                      image: selectedMedia.url,
                      imageId: selectedMedia.id,
                    }
                  : null
              );
              showToast('Image principale sélectionnée depuis la bibliothèque !');
            } else {
              setEditingProduct(prev =>
                prev
                  ? {
                      ...prev,
                      galleryImages: [...(prev.galleryImages || []), selectedMedia.url],
                      galleryMediaIds: [...(prev.galleryMediaIds || []), selectedMedia.id],
                    }
                  : null
              );
              showToast('Image ajoutée à la galerie du produit !');
            }
          }}
        />
      )}

      {/* ==================== MODAL 2: DIGITAL CODES INVENTORY ==================== */}
      {managingCodesProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div 
            className="w-full max-w-xl bg-[#0c121e] border border-emerald-500/40 rounded-3xl shadow-2xl p-5 max-h-[92vh] overflow-y-auto space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Key className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white font-['Chakra_Petch'] uppercase tracking-wider">
                    Codes Numériques : {managingCodesProduct.name}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Chaque code inutilisé correspond à 1 unité de stock vendable
                  </p>
                </div>
              </div>
              <button
                onClick={() => setManagingCodesProduct(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Counts badge */}
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30">
                <span className="text-[10px] uppercase font-bold text-emerald-400 block">Codes Disponibles</span>
                <span className="text-lg font-black text-emerald-300 font-mono">
                  {currentCodes.filter(c => !c.isUsed).length}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Codes Vendus / Utilisés</span>
                <span className="text-lg font-black text-slate-300 font-mono">
                  {currentCodes.filter(c => c.isUsed).length}
                </span>
              </div>
            </div>

            {/* Unit Add Section */}
            <form onSubmit={handleAddSingleCode} className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
              <label className="block text-slate-300 font-bold text-xs flex items-center justify-between">
                <span>Ajouter un code unitaire :</span>
                <span className="text-[10px] text-emerald-400 font-normal">Ajout direct</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={singleCodeText}
                  onChange={e => setSingleCodeText(e.target.value)}
                  placeholder="Ex: FREEFIRE-7892-XYZ"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-emerald-300 font-mono focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={isAddingCodes || !singleCodeText.trim()}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter</span>
                </button>
              </div>
            </form>

            {/* Batch Add & Duplicate Detection Section */}
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block text-slate-300 font-bold text-xs">
                  Ajout par lot (1 code par ligne) :
                </label>
                <span className="text-[10px] text-slate-400">Détection auto des doublons</span>
              </div>
              <textarea
                rows={3}
                value={codesBatchText}
                onChange={e => {
                  setCodesBatchText(e.target.value);
                  if (previewBatchResult) setPreviewBatchResult(null);
                }}
                placeholder="CODE-AAA-111&#10;CODE-BBB-222&#10;CODE-CCC-333"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-emerald-300 font-mono focus:outline-none focus:border-emerald-500"
              />

              {/* Duplicate preview results box */}
              {previewBatchResult && (
                <div className="p-3 rounded-xl bg-slate-950/80 border border-cyan-500/30 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-cyan-400">Rapport d'analyse :</span>
                    <span className="text-white font-mono">{previewBatchResult.validCount} / {previewBatchResult.totalGiven} valides</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                    <div className="p-1.5 rounded bg-emerald-950/40 border border-emerald-500/30 text-emerald-300">
                      <span className="font-bold block text-emerald-400 font-mono text-xs">{previewBatchResult.validCount}</span>
                      À ajouter
                    </div>
                    <div className="p-1.5 rounded bg-amber-950/40 border border-amber-500/30 text-amber-300">
                      <span className="font-bold block text-amber-400 font-mono text-xs">{previewBatchResult.duplicateCount}</span>
                      Doublons lot
                    </div>
                    <div className="p-1.5 rounded bg-red-950/40 border border-red-500/30 text-red-300">
                      <span className="font-bold block text-red-400 font-mono text-xs">{previewBatchResult.existingCount}</span>
                      Déjà en base
                    </div>
                  </div>
                  {previewBatchResult.ignored.length > 0 && (
                    <p className="text-[10px] text-amber-300">
                      ⚠️ {previewBatchResult.ignored.length} code(s) seront automatiquement ignorés car ils existent déjà ou sont en double.
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isPreviewingCodes || !codesBatchText.trim()}
                  onClick={handlePreviewCodes}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs border border-cyan-500/30 transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1"
                >
                  {isPreviewingCodes ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>Vérifier doublons</span>
                </button>

                <button
                  type="button"
                  disabled={isAddingCodes || !codesBatchText.trim()}
                  onClick={handleAddCodesBatch}
                  className="py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold uppercase text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1"
                >
                  {isAddingCodes ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Ajout...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Importer & Sync Stock</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Existing Codes List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-bold">Inventaire existant ({currentCodes.length})</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCodesFilter('all')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${codesFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}
                  >
                    Tous
                  </button>
                  <button
                    onClick={() => setCodesFilter('unused')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${codesFilter === 'unused' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500'}`}
                  >
                    Disponibles
                  </button>
                  <button
                    onClick={() => setCodesFilter('used')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${codesFilter === 'used' ? 'bg-slate-800 text-slate-300' : 'text-slate-500'}`}
                  >
                    Utilisés
                  </button>
                </div>
              </div>

              <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                {currentCodes.length === 0 ? (
                  <p className="text-center py-6 text-slate-500 text-xs">Aucun code enregistré pour ce produit.</p>
                ) : (
                  currentCodes
                    .filter(c => {
                      if (codesFilter === 'unused') return !c.isUsed;
                      if (codesFilter === 'used') return c.isUsed;
                      return true;
                    })
                    .map(codeItem => (
                      <div
                        key={codeItem.id}
                        className={`p-2 rounded-xl flex items-center justify-between gap-2 text-xs font-mono border ${
                          codeItem.isUsed
                            ? 'bg-slate-950/60 border-slate-800/80 text-slate-500'
                            : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                        }`}
                      >
                        <div className="truncate">
                          <span className="font-bold select-all">{codeItem.code}</span>
                          {codeItem.isUsed && (
                            <span className="text-[10px] text-slate-500 block">
                              Vendu {codeItem.usedAt ? `le ${new Date(codeItem.usedAt).toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''} 
                              {codeItem.usedAtOrderId ? ` (Cmd: #${codeItem.usedAtOrderId})` : ''}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(codeItem.code);
                              showToast('Code copié dans le presse-papier !');
                            }}
                            className="p-1 text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
                            title="Copier le code"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          {codeItem.isUsed ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 uppercase font-sans">
                              Utilisé
                            </span>
                          ) : (
                            <>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 uppercase font-sans font-bold">
                                Dispo
                              </span>
                              <button
                                onClick={() => handleDeleteCode(codeItem.id)}
                                className="p-1 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                                title="Supprimer ce code"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL 3: STOCK ADJUSTMENT ==================== */}
      {stockModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div 
            className="w-full max-w-sm bg-[#0c121e] border border-cyan-500/40 rounded-3xl shadow-2xl p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-xs sm:text-sm font-bold text-white uppercase font-['Chakra_Petch']">
                Ajuster le Stock : {stockModalProduct.name}
              </h3>
              <button
                onClick={() => setStockModalProduct(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStockUpdate} className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900 text-center border border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-0.5">Stock actuel en base :</span>
                <span className="text-xl font-black text-white font-mono">{stockModalProduct.stock}</span>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Action sur le stock :</label>
                <select
                  value={stockAction}
                  onChange={e => setStockAction(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                >
                  <option value="set">Définir une valeur exacte (Remplacer)</option>
                  <option value="add">Ajouter au stock existant (+)</option>
                  <option value="remove">Retirer du stock existant (-)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Quantité :</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={stockQuantity}
                  onChange={e => setStockQuantity(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-500/20 text-center text-xs">
                <span className="text-slate-400">Stock calculé après opération : </span>
                <strong className="text-cyan-400 font-mono font-bold">
                  {stockAction === 'set' 
                    ? Math.max(0, stockQuantity)
                    : stockAction === 'add'
                    ? stockModalProduct.stock + Math.max(0, stockQuantity)
                    : Math.max(0, stockModalProduct.stock - Math.max(0, stockQuantity))}
                </strong>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStockModalProduct(null)}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingStock}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase text-xs transition-all active:scale-95 disabled:opacity-50"
                >
                  {isUpdatingStock ? 'Mise à jour...' : 'Appliquer le Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL 4: INLINE CREATE PLATFORM / GAME ==================== */}
      {isCreatingPlatform && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm animate-in fade-in">
          <div 
            className="w-full max-w-md bg-[#0c121e] border border-cyan-500/40 rounded-3xl shadow-2xl p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-xs sm:text-sm font-bold text-white uppercase font-['Chakra_Petch'] flex items-center gap-1.5">
                <Gamepad2 className="w-4 h-4 text-cyan-400" />
                <span>Nouveau Jeu / Plateforme</span>
              </h3>
              <button
                onClick={() => setIsCreatingPlatform(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePlatformInline} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Nom du jeu ou service *</label>
                <input
                  type="text"
                  required
                  value={newPlatformName}
                  onChange={e => setNewPlatformName(e.target.value)}
                  placeholder="Ex: Blood Strike, DLS 2024, Crunchyroll, Panel Pro..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Catégorie parente *</label>
                <select
                  value={newPlatformCategory}
                  onChange={e => setNewPlatformCategory(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">URL de l'icône / image</label>
                <input
                  type="text"
                  value={newPlatformImage}
                  onChange={e => setNewPlatformImage(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingPlatform(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSavingPlatform}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase text-xs"
                >
                  {isSavingPlatform ? 'Création...' : 'Créer et Sélectionner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL 5: DIGITAL ACCOUNTS INVENTORY ==================== */}
      {managingAccountsProduct && (
        <DigitalAccountsModal
          product={managingAccountsProduct}
          onClose={() => setManagingAccountsProduct(null)}
          onStockUpdated={async () => {
            await fetchProducts();
            await refreshCatalog();
          }}
        />
      )}
    </div>
  );
};
