import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api.js';
import { PlatformOrGame, Category, GameIdVerificationConfig, PlayerVerificationResult, Media } from '../../../types.js';
import { MediaPickerModal } from '../modals/MediaPickerModal.js';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  X, 
  Check, 
  Gamepad2, 
  Tv, 
  Cpu, 
  ShieldCheck, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Sliders,
  Image as ImageIcon
} from 'lucide-react';

export const AdminPlatforms: React.FC<{
  categories: Category[];
  initialCategorySlug?: string;
}> = ({ categories, initialCategorySlug }) => {
  const [platforms, setPlatforms] = useState<PlatformOrGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategorySlug, setActiveCategorySlug] = useState<string>(initialCategorySlug || 'gaming');
  const [editingPlatform, setEditingPlatform] = useState<Partial<PlatformOrGame> | null>(null);

  // Admin live test state
  const [testPlayerId, setTestPlayerId] = useState('512893041');
  const [testRegion, setTestRegion] = useState('LATAM');
  const [testServer, setTestServer] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<PlayerVerificationResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<'image' | 'bannerImage'>('image');

  const fetchPlatforms = async () => {
    setLoading(true);
    try {
      const data = await api.getPlatforms();
      setPlatforms(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlatforms();
  }, []);

  const activeCategory = categories.find(c => c.slug === activeCategorySlug);
  const filtered = platforms.filter(p => p.categoryId === activeCategory?.id);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlatform) return;
    try {
      await api.admin.savePlatform(editingPlatform);
      setEditingPlatform(null);
      await fetchPlatforms();
    } catch (err: any) {
      alert(err.message || 'Erreur d\'enregistrement');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Supprimer définitivement "${name}" ?`)) return;
    try {
      await api.admin.deletePlatform(id);
      await fetchPlatforms();
    } catch (err: any) {
      alert(err.message || 'Erreur de suppression');
    }
  };

  const handleRunAdminTest = async () => {
    if (!testPlayerId.trim()) {
      setTestError('Saisissez un identifiant pour le test.');
      return;
    }

    setTestLoading(true);
    setTestError(null);
    setTestResult(null);

    try {
      const res = await api.admin.testVerification({
        platformId: editingPlatform?.id,
        playerIdentifier: testPlayerId.trim(),
        region: testRegion,
        server: testServer,
        customConfig: editingPlatform?.idVerification,
      });

      if (res.success && res.result && res.result.verified) {
        setTestResult(res.result);
      } else {
        setTestError(res.result?.errorMessage || 'Joueur introuvable ou erreur de fournisseur.');
      }
    } catch (err: any) {
      setTestError(err.message || 'Erreur de connexion API.');
    } finally {
      setTestLoading(false);
    }
  };

  const updateVerificationConfig = (patch: Partial<GameIdVerificationConfig>) => {
    if (!editingPlatform) return;
    const current = editingPlatform.idVerification || {
      verificationEnabled: true,
      idFieldName: 'UID DU JOUEUR',
      idPlaceholder: 'Ex: 123456789',
      idType: 'numeric',
      minLength: 8,
      maxLength: 12,
      idFormatHelp: 'Entrez les 8 à 12 chiffres de votre compte',
      regionRequired: false,
      regionOptions: ['LATAM', 'GLOBAL', 'NA', 'BR', 'EU'],
      serverRequired: false,
      serverOptions: [],
      provider: 'none',
      providerGameKey: '',
    };
    setEditingPlatform({
      ...editingPlatform,
      idVerification: {
        ...current,
        ...patch,
      },
    });
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Category selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <h2 className="text-sm sm:text-base font-black text-white font-['Chakra_Petch'] uppercase tracking-wider flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-cyan-400" />
            <span>Gestion des Jeux & Plateformes</span>
          </h2>
          <p className="text-xs text-slate-400">
            Configurez les jeux (Free Fire, Blood Strike, eFootball, etc.), la vérification d'UID et les plateformes
          </p>
        </div>

        <button
          onClick={() => {
            setTestResult(null);
            setTestError(null);
            setEditingPlatform({
              categoryId: activeCategory?.id || 'cat-gaming',
              name: '',
              slug: '',
              image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop',
              description: '',
              active: true,
              idVerification: {
                verificationEnabled: activeCategorySlug === 'gaming',
                idFieldName: 'UID DU JOUEUR',
                idPlaceholder: 'Ex: 123456789',
                idType: 'numeric',
                minLength: 8,
                maxLength: 12,
                idFormatHelp: 'Entrez votre identifiant de compte',
                regionRequired: false,
                regionOptions: ['LATAM', 'GLOBAL', 'NA', 'BR', 'EU'],
                serverRequired: false,
                serverOptions: [],
                provider: 'none',
                providerGameKey: '',
              },
            });
          }}
          className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Ajouter ({activeCategory?.name})</span>
        </button>
      </div>

      {/* Category switcher tabs */}
      <div className="flex bg-slate-900/90 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => setActiveCategorySlug('gaming')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            activeCategorySlug === 'gaming' ? 'bg-cyan-500 text-black shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Gamepad2 className="w-4 h-4" />
          <span>Jeux (Gaming)</span>
        </button>
        <button
          onClick={() => setActiveCategorySlug('streaming')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            activeCategorySlug === 'streaming' ? 'bg-cyan-500 text-black shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Tv className="w-4 h-4" />
          <span>Streaming</span>
        </button>
        <button
          onClick={() => setActiveCategorySlug('panels')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            activeCategorySlug === 'panels' ? 'bg-cyan-500 text-black shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>Panels</span>
        </button>
      </div>

      {/* Items list */}
      {loading ? (
        <div className="py-16 text-center text-slate-500 text-xs">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400">
          Aucun élément dans cette catégorie.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map(item => {
            const hasVerif = item.idVerification?.verificationEnabled;
            return (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-[#0e1422] border border-slate-800 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-12 h-12 rounded-xl object-cover border border-slate-700 flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white truncate">{item.name}</h4>
                      <span className={`text-[9px] font-bold uppercase ${item.active ? 'text-emerald-400' : 'text-red-400'}`}>
                        {item.active ? 'Actif' : 'Désactivé'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">{item.description}</p>
                    {hasVerif ? (
                      <span className="text-[10px] font-mono text-cyan-400 flex items-center gap-1 mt-0.5">
                        <ShieldCheck className="w-3 h-3 text-cyan-400" />
                        Vérif: {item.idVerification?.idFieldName || 'UID'} ({item.idVerification?.provider || 'Non configuré'})
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        Vérification ID désactivée
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => {
                      setTestResult(null);
                      setTestError(null);
                      setEditingPlatform({
                        ...item,
                        idVerification: item.idVerification || {
                          verificationEnabled: true,
                          idFieldName: 'UID DU JOUEUR',
                          idPlaceholder: 'Ex: 123456789',
                          idType: 'numeric',
                          minLength: 8,
                          maxLength: 12,
                          idFormatHelp: 'Entrez les 8 à 12 chiffres de votre compte',
                          regionRequired: false,
                          regionOptions: ['LATAM', 'GLOBAL', 'NA', 'BR', 'EU'],
                          serverRequired: false,
                          serverOptions: [],
                          provider: 'none',
                          providerGameKey: item.slug,
                        },
                      });
                    }}
                    className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id, item.name)}
                    className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit modal */}
      {editingPlatform && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-[#0e1422] border border-cyan-500/30 rounded-2xl p-5 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3 flex-shrink-0">
              <h3 className="text-sm font-bold text-white font-['Chakra_Petch'] uppercase">
                {editingPlatform.id ? `Modifier ${editingPlatform.name}` : 'Ajouter une Plateforme / Jeu'}
              </h3>
              <button onClick={() => setEditingPlatform(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs overflow-y-auto flex-1 pr-1">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nom *</label>
                <input
                  type="text"
                  required
                  value={editingPlatform.name || ''}
                  onChange={e => setEditingPlatform({ ...editingPlatform, name: e.target.value })}
                  placeholder="Ex: Free Fire"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Slug (identifiant URL) *</label>
                <input
                  type="text"
                  required
                  value={editingPlatform.slug || ''}
                  onChange={e => setEditingPlatform({ ...editingPlatform, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                  placeholder="Ex: free-fire"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-300 font-semibold">URL Image Logo / Icône *</label>
                  <button
                    type="button"
                    onClick={() => {
                      setMediaPickerTarget('image');
                      setIsMediaPickerOpen(true);
                    }}
                    className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                  >
                    <ImageIcon className="w-3 h-3" />
                    <span>Choisir dans la bibliothèque</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={editingPlatform.image || ''}
                  onChange={e => setEditingPlatform({ ...editingPlatform, image: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-300 font-semibold">URL Bannière Haute Définition</label>
                  <button
                    type="button"
                    onClick={() => {
                      setMediaPickerTarget('bannerImage');
                      setIsMediaPickerOpen(true);
                    }}
                    className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                  >
                    <ImageIcon className="w-3 h-3" />
                    <span>Choisir dans la bibliothèque</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={editingPlatform.bannerImage || ''}
                  onChange={e => setEditingPlatform({ ...editingPlatform, bannerImage: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Description</label>
                <input
                  type="text"
                  value={editingPlatform.description || ''}
                  onChange={e => setEditingPlatform({ ...editingPlatform, description: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              {/* UNIVERSAL PLAYER ID VERIFICATION CONFIGURATION */}
              <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-cyan-500/20">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold text-white uppercase text-[11px] font-['Chakra_Petch']">
                      Vérification Automatique d'Identifiant Joueur
                    </span>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingPlatform.idVerification?.verificationEnabled ?? false}
                      onChange={e => updateVerificationConfig({ verificationEnabled: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-cyan-500"
                    />
                    <span className="text-[10px] font-bold text-cyan-300">
                      {editingPlatform.idVerification?.verificationEnabled ? 'Activée' : 'Désactivée'}
                    </span>
                  </label>
                </div>

                {editingPlatform.idVerification?.verificationEnabled && (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">
                          Nom du champ d'identifiant *
                        </label>
                        <input
                          type="text"
                          value={editingPlatform.idVerification.idFieldName || 'UID DU JOUEUR'}
                          onChange={e => updateVerificationConfig({ idFieldName: e.target.value })}
                          placeholder="Ex: UID DU JOUEUR, PLAYER ID"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">
                          Exemple / Placeholder *
                        </label>
                        <input
                          type="text"
                          value={editingPlatform.idVerification.idPlaceholder || 'Ex: 123456789'}
                          onChange={e => updateVerificationConfig({ idPlaceholder: e.target.value })}
                          placeholder="Ex: 512893041"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">
                          Type d'identifiant
                        </label>
                        <select
                          value={editingPlatform.idVerification.idType || 'numeric'}
                          onChange={e => updateVerificationConfig({ idType: e.target.value as any })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white"
                        >
                          <option value="numeric">Numérique (chiffres)</option>
                          <option value="alphanumeric">Alphanumérique</option>
                          <option value="email">Email</option>
                          <option value="custom">Personnalisé</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">
                          Longueur min
                        </label>
                        <input
                          type="number"
                          value={editingPlatform.idVerification.minLength ?? 6}
                          onChange={e => updateVerificationConfig({ minLength: parseInt(e.target.value) || 0 })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">
                          Longueur max
                        </label>
                        <input
                          type="number"
                          value={editingPlatform.idVerification.maxLength ?? 16}
                          onChange={e => updateVerificationConfig({ maxLength: parseInt(e.target.value) || 32 })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        Aide au format (client)
                      </label>
                      <input
                        type="text"
                        value={editingPlatform.idVerification.idFormatHelp || ''}
                        onChange={e => updateVerificationConfig({ idFormatHelp: e.target.value })}
                        placeholder="Ex: Entrez les 8 à 12 chiffres de votre compte"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      <div>
                        <label className="flex items-center gap-2 text-slate-300 font-semibold cursor-pointer mb-1">
                          <input
                            type="checkbox"
                            checked={editingPlatform.idVerification.regionRequired ?? false}
                            onChange={e => updateVerificationConfig({ regionRequired: e.target.checked })}
                            className="rounded bg-slate-900 border-slate-700 text-cyan-500"
                          />
                          <span>Région nécessaire</span>
                        </label>
                        {editingPlatform.idVerification.regionRequired && (
                          <input
                            type="text"
                            value={(editingPlatform.idVerification.regionOptions || []).join(', ')}
                            onChange={e => updateVerificationConfig({
                              regionOptions: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                            })}
                            placeholder="LATAM, GLOBAL, NA, BR"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1 text-white font-mono text-[11px]"
                          />
                        )}
                      </div>

                      <div>
                        <label className="flex items-center gap-2 text-slate-300 font-semibold cursor-pointer mb-1">
                          <input
                            type="checkbox"
                            checked={editingPlatform.idVerification.serverRequired ?? false}
                            onChange={e => updateVerificationConfig({ serverRequired: e.target.checked })}
                            className="rounded bg-slate-900 border-slate-700 text-cyan-500"
                          />
                          <span>Serveur / Zone ID nécessaire</span>
                        </label>
                        {editingPlatform.idVerification.serverRequired && (
                          <input
                            type="text"
                            value={(editingPlatform.idVerification.serverOptions || []).join(', ')}
                            onChange={e => updateVerificationConfig({
                              serverOptions: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                            })}
                            placeholder="Serveur 1, Zone 1001"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1 text-white font-mono text-[11px]"
                          />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 border-t border-slate-800">
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">
                          Fournisseur / API *
                        </label>
                        <select
                          value={editingPlatform.idVerification.provider || 'none'}
                          onChange={e => updateVerificationConfig({ provider: e.target.value as any })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white"
                        >
                          <option value="none">Aucun / Manuel</option>
                          <option value="direct_api">API Directe</option>
                          <option value="Lapakgaming">Lapakgaming</option>
                          <option value="UniPin">UniPin</option>
                          <option value="CustomApi">API Personnalisée / Webhook</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">
                          Code Jeu Fournisseur
                        </label>
                        <input
                          type="text"
                          value={editingPlatform.idVerification.providerGameKey || ''}
                          onChange={e => updateVerificationConfig({ providerGameKey: e.target.value })}
                          placeholder="freefire, bloodstrike, etc."
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">
                          URL de l'API / Endpoint Réel
                        </label>
                        <input
                          type="text"
                          value={editingPlatform.idVerification.customEndpointUrl || editingPlatform.idVerification.providerConfig?.apiUrl || ''}
                          onChange={e => updateVerificationConfig({ 
                            customEndpointUrl: e.target.value,
                            providerConfig: {
                              ...(editingPlatform.idVerification?.providerConfig || {}),
                              apiUrl: e.target.value,
                            }
                          })}
                          placeholder="https://api.fournisseur.com/check"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white font-mono text-[11px]"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-semibold mb-1">
                          Clé d'API / Secret Fournisseur
                        </label>
                        <input
                          type="password"
                          value={editingPlatform.idVerification.apiKey || editingPlatform.idVerification.providerConfig?.apiKey || ''}
                          onChange={e => updateVerificationConfig({ 
                            apiKey: e.target.value,
                            providerConfig: {
                              ...(editingPlatform.idVerification?.providerConfig || {}),
                              apiKey: e.target.value,
                            }
                          })}
                          placeholder="sk_live_..."
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white font-mono text-[11px]"
                        />
                      </div>
                    </div>

                    {/* Live Test Suite in Admin */}
                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-cyan-500/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-cyan-300 text-[10px] uppercase flex items-center gap-1">
                          <Search className="w-3 h-3" />
                          Console de Test API en direct
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={testPlayerId}
                          onChange={e => setTestPlayerId(e.target.value)}
                          placeholder="UID à tester"
                          className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-white font-mono text-[11px]"
                        />
                        <button
                          type="button"
                          disabled={testLoading}
                          onClick={handleRunAdminTest}
                          className="px-3 py-1 rounded-lg bg-cyan-500 text-black font-bold text-[10px] uppercase flex items-center gap-1 disabled:opacity-50"
                        >
                          {testLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Tester'}
                        </button>
                      </div>

                      {testError && (
                        <div className="text-red-400 text-[10px] flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 flex-shrink-0" />
                          <span>{testError}</span>
                        </div>
                      )}
                      {testResult && (
                        <div className="text-emerald-400 text-[10px] flex items-center justify-between bg-emerald-950/20 p-1.5 rounded border border-emerald-500/30">
                          <span>✓ Joueur: <strong>{testResult.playerName}</strong> ({testResult.playerIdentifier})</span>
                          <span className="text-slate-400 font-mono">[{testResult.provider}]</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="activeCheck"
                  checked={editingPlatform.active ?? true}
                  onChange={e => setEditingPlatform({ ...editingPlatform, active: e.target.checked })}
                  className="rounded bg-slate-900 border-slate-700 text-cyan-500"
                />
                <label htmlFor="activeCheck" className="text-slate-300 font-semibold">
                  Activer et afficher sur la boutique
                </label>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-800 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingPlatform(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-cyan-500 text-black font-bold uppercase"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Media Picker Modal */}
      {isMediaPickerOpen && editingPlatform && (
        <MediaPickerModal
          isOpen={isMediaPickerOpen}
          onClose={() => setIsMediaPickerOpen(false)}
          onSelectMedia={(selectedMedia: Media) => {
            if (mediaPickerTarget === 'image') {
              setEditingPlatform({ ...editingPlatform, image: selectedMedia.url });
            } else {
              setEditingPlatform({ ...editingPlatform, bannerImage: selectedMedia.url });
            }
          }}
        />
      )}
    </div>
  );
};
