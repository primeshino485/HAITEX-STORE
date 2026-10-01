import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api.js';
import { useStore } from '../../../context/StoreContext.js';
import { SiteSettings, ActivityLog } from '../../../types.js';
import { 
  Settings, 
  Shield, 
  Clock, 
  Check, 
  RefreshCw, 
  Eye, 
  Palette, 
  Image as ImageIcon,
  RotateCcw, 
  Save, 
  AlertTriangle,
  Sparkles,
  ExternalLink,
  Loader2,
  Bot,
  MessageSquare
} from 'lucide-react';

const PRESET_ACCENT_COLORS = [
  { name: 'Cyan Tech', hex: '#06b6d4' },
  { name: 'Émeraude', hex: '#10b981' },
  { name: 'Ambre Gold', hex: '#f59e0b' },
  { name: 'Violet Cyber', hex: '#a855f7' },
  { name: 'Rose Neon', hex: '#f43f5e' },
  { name: 'Bleu Royal', hex: '#3b82f6' },
];

export const AdminSettingsAndLogs: React.FC = () => {
  const { setSiteSettings } = useStore();
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [originalSettings, setOriginalSettings] = useState<SiteSettings | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'settings' | 'chatbot' | 'logs'>('settings');

  // Custom Modal for Resetting Catalog
  const [showResetModal, setShowResetModal] = useState(false);
  const [resettingCatalog, setResettingCatalog] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sets, logItems] = await Promise.all([
        api.getSettings(),
        api.admin.getLogs(),
      ]);
      setSettings(sets);
      setOriginalSettings(sets);
      setLogs(logItems);
    } catch (err) {
      console.error('Failed to fetch settings/logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await api.admin.updateSettings(settings);
      setSettings(updated);
      setOriginalSettings(updated);
      setSiteSettings(updated);
      setSavedSuccess('Identité et paramètres de la boutique enregistrés avec succès !');
      setTimeout(() => setSavedSuccess(null), 3500);
      const logItems = await api.admin.getLogs();
      setLogs(logItems);
    } catch (err: any) {
      console.error('Error saving settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelChanges = () => {
    if (originalSettings) {
      setSettings({ ...originalSettings });
      setSavedSuccess('Modifications annulées. Paramètres initiaux restaurés.');
      setTimeout(() => setSavedSuccess(null), 3000);
    }
  };

  const handleConfirmResetCatalog = async () => {
    setResettingCatalog(true);
    try {
      await api.admin.resetDemoData();
      setShowResetModal(false);
      await fetchData();
      setSavedSuccess('Catalogue de démonstration réinitialisé avec succès !');
      setTimeout(() => setSavedSuccess(null), 3500);
    } catch (err: any) {
      console.error('Reset error:', err);
    } finally {
      setResettingCatalog(false);
    }
  };

  const isModified = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  if (loading || !settings) {
    return (
      <div className="py-16 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
        <span>Chargement des paramètres...</span>
      </div>
    );
  }

  const currentAccent = settings.accentColor || '#06b6d4';

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div>
        <h2 className="text-sm sm:text-base font-black text-white font-['Chakra_Petch'] uppercase tracking-wider">
          Paramètres du Site & Identité Visuelle
        </h2>
        <p className="text-xs text-slate-400">
          Personnalisez la marque, les couleurs, bannières et consultez l'audit en temps réel
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 shrink-0" />
          <span>{savedSuccess}</span>
        </div>
      )}

      {/* Switcher */}
      <div className="flex bg-slate-900/90 p-1 rounded-xl border border-slate-800 gap-1">
        <button
          onClick={() => setActiveSubTab('settings')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeSubTab === 'settings' ? 'bg-cyan-500 text-black shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Identité & Paramètres</span>
        </button>
        <button
          onClick={() => setActiveSubTab('chatbot')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeSubTab === 'chatbot' ? 'bg-cyan-500 text-black shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          <span>Assistant IA Chatbot</span>
        </button>
        <button
          onClick={() => setActiveSubTab('logs')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeSubTab === 'logs' ? 'bg-cyan-500 text-black shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Journal d'Activité ({logs.length})</span>
        </button>
      </div>

      {activeSubTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
          {/* LIVE PREVIEW CARD */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-[#0e1422] to-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <Eye className="w-4 h-4 text-cyan-400" />
                <span>Prévisualisation en Direct de l'Identité Visuelle</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 uppercase tracking-widest font-bold">
                Live Preview
              </span>
            </div>

            {/* Header Mock Preview */}
            <div className="p-3 rounded-xl bg-[#0c121e] border border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div 
                  className="w-8 h-8 rounded-xl p-[1.5px] flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${currentAccent}, #10b981)` }}
                >
                  <div className="w-full h-full bg-[#0b0f19] rounded-[10px] flex items-center justify-center">
                    <span className="font-mono font-bold text-[10px]" style={{ color: currentAccent }}>
                      {settings.logoText ? settings.logoText.slice(0, 2).toUpperCase() : 'GT'}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-xs text-white uppercase font-['Chakra_Petch']">
                      {settings.siteName || 'MY STORE'}
                    </span>
                    <span 
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                      style={{ 
                        backgroundColor: `${currentAccent}20`, 
                        color: currentAccent,
                        borderColor: `${currentAccent}40`,
                        borderWidth: 1 
                      }}
                    >
                      {settings.brandBadge || settings.logoText || 'MY BRAND'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate max-w-xs">
                    {settings.siteSlogan || settings.slogan || 'Boutik jwèt & kat kado an Ayiti'}
                  </p>
                </div>
              </div>

              <div 
                className="px-3 py-1.5 rounded-lg font-bold text-[11px] text-black shadow-sm"
                style={{ backgroundColor: currentAccent }}
              >
                Bouton Accent
              </div>
            </div>

            {/* Banner Mock Preview */}
            <div 
              className="p-3.5 rounded-xl border relative overflow-hidden"
              style={{ 
                borderColor: `${currentAccent}30`,
                background: `linear-gradient(90deg, rgba(14,20,34,0.95), rgba(15,23,42,0.8))`
              }}
            >
              <p className="text-xs font-bold text-white font-['Chakra_Petch']">
                {settings.bannerTitle || 'Byenveni sou Boutik la'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {settings.bannerSubtitle || 'Tout kat kado ak rechaj disponib 24/7'}
              </p>
            </div>
          </div>

          {/* SECTION 1: MARQUE & IDENTITÉ */}
          <div className="p-4 rounded-2xl bg-[#0e1422] border border-slate-800 space-y-3.5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Marque & Identité</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nom du Site *</label>
                <input
                  type="text"
                  required
                  value={settings.siteName}
                  onChange={e => setSettings({ ...settings, siteName: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                  placeholder="Ex: MY STORE - Grexus Tech"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Badge / Texte Court de Marque *</label>
                <input
                  type="text"
                  required
                  value={settings.brandBadge || settings.logoText || ''}
                  onChange={e => setSettings({ ...settings, brandBadge: e.target.value, logoText: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                  placeholder="Ex: HAITEX DIGITAL"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Slogan de la Boutique</label>
                <input
                  type="text"
                  value={settings.siteSlogan || settings.slogan || ''}
                  onChange={e => setSettings({ ...settings, siteSlogan: e.target.value, slogan: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                  placeholder="Ex: Premier hub digital pour recharges et abonnements"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Message d'Accueil (Page d'accueil)</label>
                <input
                  type="text"
                  value={settings.homepageWelcomeText || ''}
                  onChange={e => setSettings({ ...settings, homepageWelcomeText: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                  placeholder="Ex: Bienvenue sur votre boutique officielle de produits numériques"
                />
              </div>
            </div>

            {/* Accent Color Palette Selection */}
            <div className="space-y-2 pt-1">
              <label className="block text-slate-300 font-semibold flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-cyan-400" />
                <span>Couleur d'Accentuation Principale</span>
              </label>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {PRESET_ACCENT_COLORS.map(c => {
                  const isSelected = (settings.accentColor || '#06b6d4').toLowerCase() === c.hex.toLowerCase();
                  return (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setSettings({ ...settings, accentColor: c.hex })}
                      className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-slate-900 border-white ring-2 ring-cyan-400/40'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <span className="w-4 h-4 rounded-full shrink-0 shadow" style={{ backgroundColor: c.hex }} />
                      <span className="text-[11px] text-slate-200 truncate">{c.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Hex input */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-slate-400 text-[11px]">Hex personnalisé :</span>
                <input
                  type="text"
                  value={settings.accentColor || '#06b6d4'}
                  onChange={e => setSettings({ ...settings, accentColor: e.target.value })}
                  placeholder="#06b6d4"
                  className="w-28 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white font-mono text-xs focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Optional Logo & Favicon URLs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1">
                  <ImageIcon className="w-3 h-3 text-slate-400" />
                  <span>URL du Logo (optionnel)</span>
                </label>
                <input
                  type="url"
                  value={settings.logoUrl || ''}
                  onChange={e => setSettings({ ...settings, logoUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1">
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                  <span>URL Favicon (optionnel)</span>
                </label>
                <input
                  type="url"
                  value={settings.faviconUrl || ''}
                  onChange={e => setSettings({ ...settings, faviconUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: PAIEMENT & SECTION ACCUEIL */}
          <div className="p-4 rounded-2xl bg-[#0e1422] border border-slate-800 space-y-3.5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Paiement & Contenu d'Accueil
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Numéro NatCash Officiel</label>
                <input
                  type="text"
                  required
                  value={settings.natcashNumber}
                  onChange={e => setSettings({ ...settings, natcashNumber: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-cyan-400 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Titre Section Vedette</label>
                <input
                  type="text"
                  required
                  value={settings.featuredSectionTitle}
                  onChange={e => setSettings({ ...settings, featuredSectionTitle: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Titre de la Bannière</label>
              <input
                type="text"
                value={settings.bannerTitle}
                onChange={e => setSettings({ ...settings, bannerTitle: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Sous-titre de la Bannière</label>
              <input
                type="text"
                value={settings.bannerSubtitle}
                onChange={e => setSettings({ ...settings, bannerSubtitle: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Message d'Annonce Général</label>
              <input
                type="text"
                value={settings.announcementMessage || ''}
                onChange={e => setSettings({ ...settings, announcementMessage: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                placeholder="Ex: Livrezon WhatsApp disponib 7/7!"
              />
            </div>
          </div>

          {/* ACTION BUTTONS: ENREGISTRER / ANNULER / RÉINITIALISER */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Réinitialiser Démo</span>
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleCancelChanges}
                disabled={!isModified || saving}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold uppercase tracking-wider transition-colors cursor-pointer border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Annuler
              </button>

              <button
                type="submit"
                disabled={saving}
                className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase tracking-wider shadow-lg shadow-cyan-500/25 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sauvegarde...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Enregistrer</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {activeSubTab === 'chatbot' && (
        <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
          {/* Card 1: État & Identité */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-white">
                <Bot className="w-4 h-4 text-cyan-400" />
                <span>État & Identité de l'Assistant IA</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.chatbotConfig?.enabled ?? true}
                  onChange={(e) => {
                    const currentBot = settings.chatbotConfig || {
                      enabled: true,
                      botName: 'Assistant HAITEX',
                      welcomeMessage_ht: '',
                      welcomeMessage_fr: '',
                      welcomeMessage_en: '',
                      fallbackMessage: '',
                      customKnowledge: '',
                      supportPhone: settings.supportPhone || '+509 4385-4650',
                    };
                    setSettings({
                      ...settings,
                      chatbotConfig: { ...currentBot, enabled: e.target.checked },
                    });
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                <span className="ml-2 text-xs font-medium text-slate-300">
                  {(settings.chatbotConfig?.enabled ?? true) ? 'Activé' : 'Désactivé'}
                </span>
              </label>
            </div>

            <p className="text-slate-400 text-[11px]">
              L'assistant s'affiche sous forme d'un bouton flottant sur les pages publiques et permet aux clients d'obtenir des réponses instantanées basées sur le catalogue et leurs commandes réelles.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  Nom de l'Assistant (Affiché aux clients)
                </label>
                <input
                  type="text"
                  value={settings.chatbotConfig?.botName || 'Assistant HAITEX'}
                  onChange={(e) => {
                    const currentBot = settings.chatbotConfig || {
                      enabled: true,
                      botName: 'Assistant HAITEX',
                      supportPhone: settings.supportPhone || '+509 4385-4650',
                    };
                    setSettings({
                      ...settings,
                      chatbotConfig: { ...currentBot, botName: e.target.value },
                    });
                  }}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-white outline-none"
                  placeholder="Assistant HAITEX"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  Numéro WhatsApp de Support (Escalade humaine)
                </label>
                <input
                  type="text"
                  value={settings.chatbotConfig?.supportPhone || settings.supportPhone || '+509 4385-4650'}
                  onChange={(e) => {
                    const currentBot = settings.chatbotConfig || {
                      enabled: true,
                      botName: 'Assistant HAITEX',
                    };
                    setSettings({
                      ...settings,
                      chatbotConfig: { ...currentBot, supportPhone: e.target.value },
                    });
                  }}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-white outline-none"
                  placeholder="+509 4385-4650"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Messages de Bienvenue Multilingues */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 font-bold text-white">
              <MessageSquare className="w-4 h-4 text-cyan-400" />
              <span>Messages d'Accueil Automatiques (3 Langues)</span>
            </div>
            <p className="text-slate-400 text-[11px]">
              Ces messages s'affichent automatiquement à l'ouverture de la boîte de discussion selon la langue du client.
            </p>

            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  Message d'accueil en Kreyòl Ayisyen
                </label>
                <textarea
                  rows={2}
                  value={settings.chatbotConfig?.welcomeMessage_ht || 'Bonjou ! Mwen se asistan dijital ou. Mwen ka ede w jwenn yon pwodwi, konprann kijan pou achte, verifye yon kòmand oswa jwenn èd.'}
                  onChange={(e) => {
                    const currentBot = settings.chatbotConfig || { enabled: true, botName: 'Assistant HAITEX' };
                    setSettings({
                      ...settings,
                      chatbotConfig: { ...currentBot, welcomeMessage_ht: e.target.value },
                    });
                  }}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-white outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  Message d'accueil en Français
                </label>
                <textarea
                  rows={2}
                  value={settings.chatbotConfig?.welcomeMessage_fr || 'Bonjour ! Je suis votre assistant boutique. Je peux vous aider à trouver un produit, comprendre comment acheter, vérifier une commande ou contacter le support.'}
                  onChange={(e) => {
                    const currentBot = settings.chatbotConfig || { enabled: true, botName: 'Assistant HAITEX' };
                    setSettings({
                      ...settings,
                      chatbotConfig: { ...currentBot, welcomeMessage_fr: e.target.value },
                    });
                  }}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-white outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  Message d'accueil en Anglais (English)
                </label>
                <textarea
                  rows={2}
                  value={settings.chatbotConfig?.welcomeMessage_en || 'Hello! I am your store assistant. I can help you find products, understand how to purchase, track orders, or contact support.'}
                  onChange={(e) => {
                    const currentBot = settings.chatbotConfig || { enabled: true, botName: 'Assistant HAITEX' };
                    setSettings({
                      ...settings,
                      chatbotConfig: { ...currentBot, welcomeMessage_en: e.target.value },
                    });
                  }}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-white outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {/* Card 3: Repli & Connaissances Spécifiques */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 font-bold text-white">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Message de Repli & Connaissances Spécifiques</span>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">
                Message de repli (si l'IA ou le service réseau est temporairement indisponible)
              </label>
              <input
                type="text"
                value={settings.chatbotConfig?.fallbackMessage || 'Sèvis asistans lan tanporèman pa disponib kounye a. Ou ka kontakte sipò a dirèkteman sou WhatsApp.'}
                onChange={(e) => {
                  const currentBot = settings.chatbotConfig || { enabled: true, botName: 'Assistant HAITEX' };
                  setSettings({
                    ...settings,
                    chatbotConfig: { ...currentBot, fallbackMessage: e.target.value },
                  });
                }}
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">
                Connaissances Additionnelles & Consignes Spécifiques pour l'IA
              </label>
              <textarea
                rows={3}
                value={settings.chatbotConfig?.customKnowledge || 'Boutik MY STORE espesyalize nan livrezon pwodwi dijital: Gaming Top-Up (Free Fire, Blood Strike), Streaming (Netflix, Spotify), Panels ak Outil dijital. Tout peman fèt an Goud (HTG) atravè bous/portefeuille ou recharge pa NatCash oswa MonCash.'}
                onChange={(e) => {
                  const currentBot = settings.chatbotConfig || { enabled: true, botName: 'Assistant HAITEX' };
                  setSettings({
                    ...settings,
                    chatbotConfig: { ...currentBot, customKnowledge: e.target.value },
                  });
                }}
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-white outline-none resize-none"
                placeholder="Règles commerciales, délais particuliers, précisions sur les remboursements..."
              />
            </div>
          </div>

          {/* Action Bar */}
          <div className="sticky bottom-4 z-20 p-3 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-xl backdrop-blur-md flex items-center justify-between gap-2">
            <div className="text-[11px] text-slate-400">
              {isModified ? (
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Modifications non enregistrées
                </span>
              ) : (
                <span className="text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  Configuration de l'assistant à jour
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelChanges}
                disabled={!isModified || saving}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-all disabled:opacity-40 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase tracking-wider shadow-lg shadow-cyan-500/25 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sauvegarde...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Enregistrer</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {activeSubTab === 'logs' && (
        <div className="space-y-2">
          {logs.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-xs text-slate-500">
              Aucune activité enregistrée.
            </div>
          ) : (
            logs.map(l => (
              <div
                key={l.id}
                className="p-3 rounded-xl bg-[#0e1422] border border-slate-800 text-xs space-y-0.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-400 uppercase tracking-wide font-mono">
                    {l.action}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(l.createdAt).toLocaleDateString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-slate-300">{l.details}</p>
                <p className="text-[10px] text-slate-500">Effectué par : {l.performedBy}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* CUSTOM MODAL FOR CATALOG RESET (No window.confirm or window.alert) */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#0e1422] border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-white font-['Chakra_Petch']">
                Réinitialiser le catalogue par défaut ?
              </h3>
              <p className="text-xs text-slate-400">
                Cette action rétablira les catégories, plateformes et produits de démonstration d'origine.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={resettingCatalog}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs transition-colors cursor-pointer border border-slate-800"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmResetCatalog}
                disabled={resettingCatalog}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-colors cursor-pointer shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5"
              >
                {resettingCatalog ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Confirmer</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
