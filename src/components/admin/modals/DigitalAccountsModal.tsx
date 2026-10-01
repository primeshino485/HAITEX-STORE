import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../../lib/api.js';
import { Product, DigitalAccount } from '../../../types.js';
import { 
  X, 
  Key, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  Trash2, 
  Edit3, 
  Plus, 
  Upload, 
  ShieldCheck, 
  AlertCircle, 
  Calendar, 
  Clock, 
  User, 
  FileText, 
  Sparkles, 
  RefreshCw, 
  Search,
  Lock,
  Mail,
  HelpCircle,
  Tag
} from 'lucide-react';

interface DigitalAccountsModalProps {
  product: Product;
  onClose: () => void;
  onStockUpdated: () => void;
}

type SafeAccount = Omit<DigitalAccount, 'passwordEncrypted'> & { passwordMasked: string };

export const DigitalAccountsModal: React.FC<DigitalAccountsModalProps> = ({
  product,
  onClose,
  onStockUpdated,
}) => {
  const [accounts, setAccounts] = useState<SafeAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Tab: 'list' | 'add-single' | 'batch-import'
  const [activeTab, setActiveTab] = useState<'list' | 'add-single' | 'batch-import'>('list');
  const [filterStatus, setFilterStatus] = useState<'all' | 'AVAILABLE' | 'DELIVERED' | 'EXPIRED'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Passwords revealed cache: accountId -> plain password
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Single Add Form State
  const [singleEmail, setSingleEmail] = useState('');
  const [singlePassword, setSinglePassword] = useState('');
  const [showSinglePassword, setShowSinglePassword] = useState(false);
  const [singleDuration, setSingleDuration] = useState('30 jours');
  const [singleExpiresAt, setSingleExpiresAt] = useState('');
  const [singleInstructions, setSingleInstructions] = useState('');
  const [singleAdminNotes, setSingleAdminNotes] = useState('');
  const [isSubmittingSingle, setIsSubmittingSingle] = useState(false);

  // Batch Import Form State
  const [batchText, setBatchText] = useState('');
  const [batchDefaultDuration, setBatchDefaultDuration] = useState('30 jours');
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);
  const [batchResult, setBatchResult] = useState<{
    totalGiven: number;
    addedCount: number;
    newStock: number;
    errors: { line: number; text: string; error: string }[];
  } | null>(null);

  // Edit Modal State
  const [editingAccount, setEditingAccount] = useState<SafeAccount | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [editExpiresAt, setEditExpiresAt] = useState('');
  const [editInstructions, setEditInstructions] = useState('');
  const [editAdminNotes, setEditAdminNotes] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const fetchAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.admin.getProductDigitalAccounts(product.id);
      setAccounts(data);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des comptes numériques.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [product.id]);

  const showNotification = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Toggle reveal sensitive password with server call & audit log
  const handleToggleReveal = async (accountId: string) => {
    if (revealedPasswords[accountId]) {
      // Hide
      setRevealedPasswords(prev => {
        const next = { ...prev };
        delete next[accountId];
        return next;
      });
      return;
    }

    setRevealingId(accountId);
    try {
      const res = await api.admin.revealAccountPassword(accountId);
      setRevealedPasswords(prev => ({ ...prev, [accountId]: res.password }));
    } catch (err: any) {
      alert(err.message || 'Impossible de récupérer le mot de passe.');
    } finally {
      setRevealingId(null);
    }
  };

  // Handle single account creation
  const handleCreateSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleEmail.trim() || !singlePassword.trim()) {
      alert('Veuillez renseigner l\'identifiant et le mot de passe.');
      return;
    }

    setIsSubmittingSingle(true);
    try {
      await api.admin.addDigitalAccount(product.id, {
        email: singleEmail.trim(),
        password: singlePassword.trim(),
        durationText: singleDuration.trim() || '30 jours',
        expiresAt: singleExpiresAt ? new Date(singleExpiresAt).toISOString() : undefined,
        customerInstructions: singleInstructions.trim() || undefined,
        adminNotes: singleAdminNotes.trim() || undefined,
      });

      showNotification('Compte numérique ajouté avec succès.');
      setSingleEmail('');
      setSinglePassword('');
      setSingleExpiresAt('');
      setSingleInstructions('');
      setSingleAdminNotes('');
      setActiveTab('list');
      await fetchAccounts();
      onStockUpdated();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de l\'ajout du compte');
    } finally {
      setIsSubmittingSingle(false);
    }
  };

  // Handle batch accounts import
  const handleImportBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchText.trim()) {
      alert('Veuillez coller la liste des comptes à importer.');
      return;
    }

    setIsSubmittingBatch(true);
    try {
      const res = await api.admin.importDigitalAccountsBatch(
        product.id,
        batchText,
        batchDefaultDuration
      );
      setBatchResult(res);
      showNotification(`${res.addedCount} compte(s) ajouté(s) avec succès (Stock: ${res.newStock}).`);
      if (res.addedCount > 0) {
        setBatchText('');
        await fetchAccounts();
        onStockUpdated();
      }
    } catch (err: any) {
      alert(err.message || 'Erreur lors de l\'import par lot');
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  // Open Edit modal
  const openEditModal = (acc: SafeAccount) => {
    setEditingAccount(acc);
    setEditEmail(acc.email);
    setEditPassword('');
    setEditDuration(acc.durationText || '');
    setEditExpiresAt(acc.expiresAt ? acc.expiresAt.slice(0, 10) : '');
    setEditInstructions(acc.customerInstructions || '');
    setEditAdminNotes(acc.adminNotes || '');
  };

  // Submit Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;

    setIsSubmittingEdit(true);
    try {
      await api.admin.updateDigitalAccount(editingAccount.id, {
        email: editEmail.trim(),
        password: editPassword.trim() || undefined,
        durationText: editDuration.trim() || undefined,
        expiresAt: editExpiresAt ? new Date(editExpiresAt).toISOString() : undefined,
        customerInstructions: editInstructions.trim() || undefined,
        adminNotes: editAdminNotes.trim() || undefined,
      });

      showNotification('Compte mis à jour.');
      setEditingAccount(null);
      await fetchAccounts();
      onStockUpdated();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la mise à jour');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Handle Delete
  const handleDelete = async (acc: SafeAccount) => {
    if (acc.status !== 'AVAILABLE') {
      alert('Impossible de supprimer un compte déjà attribué ou livré au client.');
      return;
    }
    if (!window.confirm(`Confirmez-vous la suppression du compte disponible "${acc.email}" ?`)) {
      return;
    }

    try {
      await api.admin.deleteDigitalAccount(acc.id);
      showNotification('Compte supprimé avec succès.');
      await fetchAccounts();
      onStockUpdated();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la suppression');
    }
  };

  // Stats calculation
  const stats = useMemo(() => {
    const available = accounts.filter(a => a.status === 'AVAILABLE').length;
    const delivered = accounts.filter(a => a.status === 'DELIVERED' || a.status === 'ASSIGNED').length;
    const expired = accounts.filter(a => a.status === 'EXPIRED').length;
    return { available, delivered, expired, total: accounts.length };
  }, [accounts]);

  // Filtered accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter(acc => {
      if (filterStatus !== 'all' && acc.status !== filterStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchEmail = acc.email.toLowerCase().includes(q);
        const matchId = acc.id.toLowerCase().includes(q);
        const matchUser = (acc.userEmail || '').toLowerCase().includes(q);
        const matchOrder = (acc.orderId || '').toLowerCase().includes(q);
        if (!matchEmail && !matchId && !matchUser && !matchOrder) return false;
      }
      return true;
    });
  }, [accounts, filterStatus, searchQuery]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div 
        className="w-full max-w-4xl bg-[#0b101b] border border-indigo-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-indigo-500/20 bg-indigo-950/20 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white font-['Chakra_Petch'] tracking-wide">
                  Gestion des Comptes Numériques
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  COMPTE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Produit : <span className="text-white font-medium">{product.name}</span> (ID: {product.id})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className="mx-5 mt-4 p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Stats Bar */}
        <div className="px-5 py-3.5 bg-slate-900/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-slate-400">Comptes disponibles (Stock) :</span>
              <span className="font-bold text-emerald-400 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                {stats.available}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              <span className="text-slate-400">Attribués / Livrés :</span>
              <span className="font-bold text-cyan-400 px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20">
                {stats.delivered}
              </span>
            </div>
            {stats.expired > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                <span className="text-slate-400">Expirés :</span>
                <span className="font-bold text-rose-400 px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20">
                  {stats.expired}
                </span>
              </div>
            )}
          </div>

          {/* Tab Navigation Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'list'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Liste des comptes ({stats.total})
            </button>
            <button
              onClick={() => setActiveTab('add-single')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                activeTab === 'add-single'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter un compte
            </button>
            <button
              onClick={() => setActiveTab('batch-import')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                activeTab === 'batch-import'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              Importer en masse
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: ACCOUNTS LIST */}
          {activeTab === 'list' && (
            <div className="space-y-4">
              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Rechercher par email, commande ou ID..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 bg-slate-900/60 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setFilterStatus('all')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                      filterStatus === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    Tous ({stats.total})
                  </button>
                  <button
                    onClick={() => setFilterStatus('AVAILABLE')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                      filterStatus === 'AVAILABLE' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    Disponibles ({stats.available})
                  </button>
                  <button
                    onClick={() => setFilterStatus('DELIVERED')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                      filterStatus === 'DELIVERED' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    Livrés ({stats.delivered})
                  </button>
                </div>
              </div>

              {/* Accounts Cards List */}
              {loading ? (
                <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                  Chargement des comptes en cours...
                </div>
              ) : filteredAccounts.length === 0 ? (
                <div className="py-14 text-center border border-dashed border-slate-800/80 rounded-2xl bg-slate-900/30 p-6 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white">Aucun compte numérique trouvé</p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      {searchQuery || filterStatus !== 'all' 
                        ? 'Aucun compte ne correspond à vos filtres actuels.'
                        : 'Ce produit n\'a aucun compte numérique en stock. Ajoutez-en un manuellement ou importez un lot.'}
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                      onClick={() => setActiveTab('add-single')}
                      className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Ajouter un compte
                    </button>
                    <button
                      onClick={() => setActiveTab('batch-import')}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Importer un lot
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAccounts.map(acc => {
                    const isRevealed = !!revealedPasswords[acc.id];
                    const displayedPass = isRevealed ? revealedPasswords[acc.id] : acc.passwordMasked;
                    const isAvailable = acc.status === 'AVAILABLE';

                    return (
                      <div
                        key={acc.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          isAvailable
                            ? 'bg-slate-900/70 border-slate-800/80 hover:border-slate-700'
                            : 'bg-slate-950/80 border-slate-800/50 opacity-90'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* Left: Account ID & Status */}
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5 ${
                                isAvailable
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : acc.status === 'DELIVERED' || acc.status === 'ASSIGNED'
                                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                              {isAvailable ? 'Disponible' : acc.status === 'DELIVERED' ? 'Livré au client' : acc.status}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              #{acc.id.slice(-6)}
                            </span>
                            {acc.durationText && (
                              <span className="text-[11px] text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-md border border-slate-700/50">
                                {acc.durationText}
                              </span>
                            )}
                          </div>

                          {/* Right: Actions */}
                          <div className="flex items-center gap-1.5 self-end sm:self-auto">
                            {isAvailable && (
                              <>
                                <button
                                  onClick={() => openEditModal(acc)}
                                  title="Modifier les informations"
                                  className="p-1.5 text-slate-400 hover:text-indigo-300 rounded-lg hover:bg-slate-800 transition-colors"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(acc)}
                                  title="Supprimer ce compte disponible"
                                  className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Credentials block */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-800/60 text-xs">
                          {/* Email / Username */}
                          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                            <div className="min-w-0 pr-2">
                              <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">
                                Identifiant / Email
                              </span>
                              <span className="text-white font-mono font-medium truncate block select-all">
                                {acc.email}
                              </span>
                            </div>
                            <button
                              onClick={() => copyToClipboard(acc.email, `email-${acc.id}`)}
                              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0"
                              title="Copier l'identifiant"
                            >
                              {copiedKey === `email-${acc.id}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>

                          {/* Password */}
                          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                            <div className="min-w-0 pr-2">
                              <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">
                                Mot de passe
                              </span>
                              <span className="text-white font-mono font-medium truncate block select-all">
                                {displayedPass}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleToggleReveal(acc.id)}
                                disabled={revealingId === acc.id}
                                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                                title={isRevealed ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                              >
                                {revealingId === acc.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                                ) : isRevealed ? (
                                  <EyeOff className="w-3.5 h-3.5 text-indigo-400" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </button>
                              {isRevealed && (
                                <button
                                  onClick={() => copyToClipboard(displayedPass, `pass-${acc.id}`)}
                                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                                  title="Copier le mot de passe"
                                >
                                  {copiedKey === `pass-${acc.id}` ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Extra info / delivery info */}
                        <div className="mt-2.5 flex flex-wrap items-center gap-y-1 gap-x-4 text-[11px] text-slate-400">
                          {acc.expiresAt && (
                            <span className="flex items-center gap-1 text-slate-400">
                              <Clock className="w-3 h-3 text-slate-500" />
                              Expire le : <strong className="text-slate-300 font-medium">{new Date(acc.expiresAt).toLocaleDateString('fr-FR')}</strong>
                            </span>
                          )}
                          {acc.deliveredAt && acc.userEmail && (
                            <span className="flex items-center gap-1 text-cyan-300">
                              <User className="w-3 h-3 text-cyan-400" />
                              Livré à : <strong className="text-white">{acc.userEmail}</strong> ({acc.orderId ? `Cmd: ${acc.orderId}` : 'Achat direct'})
                            </span>
                          )}
                          {acc.customerInstructions && (
                            <div className="w-full mt-1 p-2 rounded-xl bg-slate-950/40 border border-slate-800/80 text-[11px] text-slate-300">
                              <span className="text-slate-500 font-semibold mr-1">Instructions client :</span>
                              {acc.customerInstructions}
                            </div>
                          )}
                          {acc.adminNotes && (
                            <div className="w-full mt-1 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300/90">
                              <span className="text-amber-400 font-semibold mr-1">Note admin interne :</span>
                              {acc.adminNotes}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ADD SINGLE ACCOUNT */}
          {activeTab === 'add-single' && (
            <form onSubmit={handleCreateSingle} className="space-y-4 max-w-xl mx-auto">
              <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 text-xs text-indigo-300 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  Sécurité et chiffrement réversible
                </p>
                <p className="text-slate-400 text-[11px]">
                  Le mot de passe sera chiffré via l'algorithme AES-256-GCM côté serveur. Il ne sera accessible en clair que par l'acheteur légitime après validation de commande et par l'administrateur sous journalisation d'audit.
                </p>
              </div>

              <div className="space-y-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Identifiant / Email du compte <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={singleEmail}
                      onChange={e => setSingleEmail(e.target.value)}
                      placeholder="ex: netflix.priv.ht@mystore.ht"
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Mot de passe du compte <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showSinglePassword ? 'text' : 'password'}
                      required
                      value={singlePassword}
                      onChange={e => setSinglePassword(e.target.value)}
                      placeholder="Mot de passe confidentiel"
                      className="w-full pl-9 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSinglePassword(!showSinglePassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showSinglePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Durée affichée
                    </label>
                    <input
                      type="text"
                      value={singleDuration}
                      onChange={e => setSingleDuration(e.target.value)}
                      placeholder="ex: 30 jours, 3 mois"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Date d'expiration (optionnelle)
                    </label>
                    <input
                      type="date"
                      value={singleExpiresAt}
                      onChange={e => setSingleExpiresAt(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Instructions spécifiques pour le client
                  </label>
                  <textarea
                    rows={2}
                    value={singleInstructions}
                    onChange={e => setSingleInstructions(e.target.value)}
                    placeholder="ex: Utilisez impérativement le profil 1 avec le PIN 2026. Ne modifiez jamais le mot de passe."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Note interne administrateur (invisible pour le client)
                  </label>
                  <input
                    type="text"
                    value={singleAdminNotes}
                    onChange={e => setSingleAdminNotes(e.target.value)}
                    placeholder="ex: Acheté chez le grossiste #X le 15/09"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSingle}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 disabled:opacity-50"
                >
                  {isSubmittingSingle ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      Ajouter au stock
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: BATCH IMPORT */}
          {activeTab === 'batch-import' && (
            <form onSubmit={handleImportBatch} className="space-y-4 max-w-2xl mx-auto">
              <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 text-xs text-indigo-300 space-y-2">
                <p className="font-semibold flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-indigo-400" />
                  Format d'importation par lot
                </p>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Collez une liste de comptes, <strong>1 compte par ligne</strong>, en séparant les colonnes avec une barre verticale <code className="text-indigo-300 bg-slate-900 px-1 py-0.5 rounded">|</code> :
                </p>
                <div className="p-2.5 rounded-xl bg-slate-950 font-mono text-[11px] text-slate-300 space-y-1 select-all border border-slate-800">
                  <p>identifiant@email.com | mot_de_passe | 30 jours | Profil 1 (PIN: 1234)</p>
                  <p>compte2@netflix.ht | MonPass4K! | 1 mois | Profil 2</p>
                  <p>compte3@stream.ht | Stream2026</p>
                </div>
              </div>

              <div className="space-y-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-300">
                    Comptes à importer <span className="text-rose-400">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Durée par défaut :</span>
                    <input
                      type="text"
                      value={batchDefaultDuration}
                      onChange={e => setBatchDefaultDuration(e.target.value)}
                      placeholder="30 jours"
                      className="w-24 px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                    />
                  </div>
                </div>

                <textarea
                  rows={8}
                  required
                  value={batchText}
                  onChange={e => setBatchText(e.target.value)}
                  placeholder={`compte1@stream.ht | Pass123 | 30 jours | Profil 1\ncompte2@stream.ht | Pass456 | 30 jours | Profil 2\ncompte3@stream.ht | Pass789`}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />

                {batchResult && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-emerald-400">
                        {batchResult.addedCount} compte(s) ajouté(s) avec succès
                      </span>
                      <span className="text-slate-400">
                        Nouveau stock : {batchResult.newStock}
                      </span>
                    </div>
                    {batchResult.errors.length > 0 && (
                      <div className="space-y-1 text-rose-300 text-[11px]">
                        <p className="font-semibold text-rose-400">Lignes ignorées ({batchResult.errors.length}) :</p>
                        {batchResult.errors.map((err, idx) => (
                          <p key={idx}>• Ligne {err.line} : {err.error}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  Retour à la liste
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBatch}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 disabled:opacity-50"
                >
                  {isSubmittingBatch ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Importation en cours...
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      Lancer l'importation
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between text-xs text-slate-400">
          <p>
            Les comptes sont distribués de manière atomique lors de chaque commande payée.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>

      {/* MODAL EDIT SINGLE ACCOUNT */}
      {editingAccount && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#0c121e] border border-indigo-500/40 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-400" />
                Modifier le compte disponible
              </h3>
              <button
                onClick={() => setEditingAccount(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Identifiant / Email</label>
                <input
                  type="text"
                  required
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Nouveau mot de passe (laisser vide pour ne pas modifier)
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={e => setEditPassword(e.target.value)}
                  placeholder="Laisser vide pour conserver"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Durée</label>
                  <input
                    type="text"
                    value={editDuration}
                    onChange={e => setEditDuration(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Expiration</label>
                  <input
                    type="date"
                    value={editExpiresAt}
                    onChange={e => setEditExpiresAt(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Instructions client</label>
                <textarea
                  rows={2}
                  value={editInstructions}
                  onChange={e => setEditInstructions(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Note admin interne</label>
                <input
                  type="text"
                  value={editAdminNotes}
                  onChange={e => setEditAdminNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="px-3 py-1.5 text-slate-400 hover:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1"
                >
                  {isSubmittingEdit && <RefreshCw className="w-3 h-3 animate-spin" />}
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
