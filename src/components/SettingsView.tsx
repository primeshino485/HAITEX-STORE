import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext.js';
import { useI18n, LANGUAGE_OPTIONS } from '../context/I18nContext.js';
import { useTheme } from '../context/ThemeContext.js';
import { api } from '../lib/api.js';
import { ThemePreference, Language, UserPreferences, CommunicationPreferences } from '../types.js';
import {
  Sun,
  Moon,
  Laptop,
  Globe,
  User as UserIcon,
  Shield,
  KeyRound,
  LogOut,
  Bell,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Mail,
  Coins,
  Save,
  Loader2,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';

interface SettingsViewProps {
  onLogoutRequested?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onLogoutRequested }) => {
  const { user, setUser, logout } = useStore();
  const { t, language, setLanguage } = useI18n();
  const { theme, setTheme, resolvedTheme } = useTheme();

  // Active Category Section inside Settings
  const [activeCategory, setActiveCategory] = useState<'appearance' | 'language' | 'account' | 'security' | 'preferences'>('appearance');

  // Preferences state
  const [userPrefs, setUserPrefs] = useState<UserPreferences | null>(null);
  const [commPrefs, setCommPrefs] = useState<CommunicationPreferences>({
    emailNotifications: true,
    orderUpdatesWhatsApp: true,
    promotions: false,
  });
  const [currencyDisplay, setCurrencyDisplay] = useState<'HTG' | 'USD'>('HTG');
  const [loadingPrefs, setLoadingPrefs] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsSuccessMsg, setPrefsSuccessMsg] = useState<string | null>(null);

  // Profile Form state
  const [name, setName] = useState(user?.name || '');
  const [whatsappNumber, setWhatsappNumber] = useState(user?.whatsappNumber || user?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password Change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Custom Logout Confirmation Modal state
  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Load user preferences on mount if logged in
  useEffect(() => {
    if (!user) return;
    setName(user.name || '');
    setWhatsappNumber(user.whatsappNumber || user.phone || '');

    const loadPrefs = async () => {
      setLoadingPrefs(true);
      try {
        const data = await api.getPreferences();
        if (data) {
          setUserPrefs(data);
          if (data.communicationPreferences) {
            setCommPrefs(data.communicationPreferences);
          }
          if (data.currencyDisplay) {
            setCurrencyDisplay(data.currencyDisplay);
          }
        }
      } catch (err) {
        console.warn('Could not load user preferences:', err);
      } finally {
        setLoadingPrefs(false);
      }
    };

    loadPrefs();
  }, [user]);

  // Handle Profile Update
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    setProfileMsg(null);

    try {
      const res = await api.updateProfile({
        name: name.trim(),
        whatsappNumber: whatsappNumber.trim(),
      });
      if (res && res.user) {
        setUser(res.user);
        setProfileMsg({
          type: 'success',
          text: language === 'ht' ? 'Enfòmasyon pwofil ou mete ajou avèk siksè.' : 'Profil mis à jour avec succès.',
        });
      }
    } catch (err: any) {
      setProfileMsg({
        type: 'error',
        text: err.message || (language === 'ht' ? 'Erè pandan mizajou pwofil la.' : 'Erreur lors de la mise à jour du profil.'),
      });
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Password Change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (!currentPassword) {
      setPasswordMsg({
        type: 'error',
        text: language === 'ht' ? 'Tanpri mete modpas aktyèl ou a.' : 'Veuillez saisir votre mot de passe actuel.',
      });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMsg({
        type: 'error',
        text: language === 'ht' ? 'Nouvo modpas la dwe gen omwen 6 karaktè.' : 'Le nouveau mot de passe doit comporter au moins 6 caractères.',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMsg({
        type: 'error',
        text: language === 'ht' ? 'Nouvo modpas yo pa koresponn.' : 'Les deux nouveaux mots de passe ne correspondent pas.',
      });
      return;
    }

    setChangingPassword(true);
    try {
      const res = await api.changePassword({ currentPassword, newPassword });
      setPasswordMsg({
        type: 'success',
        text: res.message || (language === 'ht' ? 'Modpas ou modifye avèk siksè.' : 'Mot de passe modifié avec succès.'),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordMsg({
        type: 'error',
        text: err.message || (language === 'ht' ? 'Erè pandan modifikasyon modpas la.' : 'Erreur lors du changement de mot de passe.'),
      });
    } finally {
      setChangingPassword(false);
    }
  };

  // Handle Communication & Currency preferences save
  const handleSavePreferences = async () => {
    if (!user) return;
    setSavingPrefs(true);
    setPrefsSuccessMsg(null);

    try {
      await api.updatePreferences({
        theme,
        language,
        communicationPreferences: commPrefs,
        currencyDisplay,
      });
      setPrefsSuccessMsg(
        language === 'ht'
          ? 'Preferans ou yo anrejistre avèk siksè.'
          : 'Vos préférences ont été enregistrées avec succès.'
      );
      setTimeout(() => setPrefsSuccessMsg(null), 3500);
    } catch (err: any) {
      console.error('Failed to save preferences:', err);
    } finally {
      setSavingPrefs(false);
    }
  };

  // Secure Logout without window.confirm
  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await api.logout().catch(() => {});
      logout();
      setShowLogoutConfirmModal(false);
    } catch (err) {
      console.error('Logout error:', err);
      logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const navItems = [
    {
      id: 'appearance',
      label: language === 'ht' ? 'Aparans' : language === 'en' ? 'Appearance' : 'Apparence',
      desc: language === 'ht' ? 'Koulè & Tèm' : language === 'en' ? 'Color & Theme' : 'Mode clair / sombre',
      icon: Sun,
    },
    {
      id: 'language',
      label: language === 'ht' ? 'Lang' : language === 'en' ? 'Language' : 'Langue',
      desc: language === 'ht' ? 'Kreyòl, Fr, En' : language === 'en' ? 'App language' : 'Langue d\'affichage',
      icon: Globe,
    },
    {
      id: 'account',
      label: language === 'ht' ? 'Kont' : language === 'en' ? 'Account' : 'Compte',
      desc: language === 'ht' ? 'Pwofil & Detay' : language === 'en' ? 'Profile details' : 'Email & Coordonnées',
      icon: UserIcon,
    },
    {
      id: 'security',
      label: language === 'ht' ? 'Sekirite' : language === 'en' ? 'Security' : 'Sécurité',
      desc: language === 'ht' ? 'Modpas & Sesyon' : language === 'en' ? 'Password & Session' : 'Mot de passe & Session',
      icon: Shield,
    },
    {
      id: 'preferences',
      label: language === 'ht' ? 'Preferans' : language === 'en' ? 'Preferences' : 'Préférences',
      desc: language === 'ht' ? 'Mesaj & Notifikasyon' : language === 'en' ? 'Notifications & Display' : 'Notifications & Devise',
      icon: Bell,
    },
  ] as const;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Category Navigation Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1 rounded-2xl bg-slate-900/80 border border-slate-800">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeCategory === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveCategory(item.id)}
              className={`flex items-center gap-2 p-2.5 rounded-xl transition-all cursor-pointer text-left ${
                isActive
                  ? 'bg-cyan-500 text-black shadow-md font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-black' : 'text-cyan-400'}`} />
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">{item.label}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* SECTION 1: APPARENCE */}
      {activeCategory === 'appearance' && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#0e1422] border border-slate-800 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-bold text-white font-['Chakra_Petch'] flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-400" />
                <span>{language === 'ht' ? 'Tèm ak Aparans Vizyèl' : language === 'en' ? 'Appearance & Theme' : 'Thème et Apparence'}</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {language === 'ht'
                  ? 'Chwazi kijan ou vle boutik la parèt sou aparèy ou an. Chanjman an fèt imedyatman.'
                  : 'Personnalisez le mode d\'affichage de la boutique. L\'effet est appliqué instantanément.'}
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              {resolvedTheme === 'dark' ? 'Sombre' : 'Clair'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {/* Dark Mode Option */}
            <button
              onClick={() => setTheme('dark')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                theme === 'dark'
                  ? 'bg-slate-900 border-cyan-500 ring-2 ring-cyan-500/20'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400">
                  <Moon className="w-4 h-4" />
                </div>
                {theme === 'dark' && (
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 shadow-sm shadow-cyan-500/50" />
                )}
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">
                  {language === 'ht' ? 'Tèm Nwa / Fènwa' : language === 'en' ? 'Dark Mode' : 'Mode Sombre'}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {language === 'ht' ? 'Repoze zye ou nan nuit ak ekran nwa' : 'Optimisé pour la nuit et les écrans OLED'}
                </p>
              </div>
            </button>

            {/* Light Mode Option */}
            <button
              onClick={() => setTheme('light')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                theme === 'light'
                  ? 'bg-slate-900 border-cyan-500 ring-2 ring-cyan-500/20'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Sun className="w-4 h-4" />
                </div>
                {theme === 'light' && (
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 shadow-sm shadow-cyan-500/50" />
                )}
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">
                  {language === 'ht' ? 'Tèm Klè' : language === 'en' ? 'Light Mode' : 'Mode Clair'}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {language === 'ht' ? 'Fond blan klere ak tèks nwa nèt' : 'Fond lumineux et contrasté pour la journée'}
                </p>
              </div>
            </button>

            {/* System / Auto Option */}
            <button
              onClick={() => setTheme('system')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                theme === 'system'
                  ? 'bg-slate-900 border-cyan-500 ring-2 ring-cyan-500/20'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Laptop className="w-4 h-4" />
                </div>
                {theme === 'system' && (
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 shadow-sm shadow-cyan-500/50" />
                )}
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">
                  {language === 'ht' ? 'Otomatik / Sistèm' : language === 'en' ? 'System Default' : 'Automatique / Système'}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {language === 'ht'
                    ? 'Swiv konfigirasyon telefòn oswa òdinatè w'
                    : 'S\'adapte aux préférences de votre appareil'}
                </p>
              </div>
            </button>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center gap-2.5 text-xs text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              {language === 'ht'
                ? 'Chanjman tèm nan anrejistre otomatikman pou pwochen vizit ou yo.'
                : 'Le thème choisi est mémorisé sur votre compte et appliqué sans recharger la page.'}
            </span>
          </div>
        </div>
      )}

      {/* SECTION 2: LANGUE */}
      {activeCategory === 'language' && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#0e1422] border border-slate-800 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-white font-['Chakra_Petch'] flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400" />
              <span>{language === 'ht' ? 'Chwazi Lang Boutik la' : language === 'en' ? 'Select Store Language' : 'Langue de la boutique'}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {language === 'ht'
                ? 'Kreyòl Ayisyen se lang natif natal nou. Ou ka chanje pou Fransè oswa Angle nenpòt kilè.'
                : 'L\'interface complète s\'adapte instantanément à la langue sélectionnée.'}
            </p>
          </div>

          <div className="space-y-2 pt-1">
            {LANGUAGE_OPTIONS.map((opt) => {
              const isCurrent = language === opt.code;
              return (
                <button
                  key={opt.code}
                  onClick={() => setLanguage(opt.code)}
                  className={`w-full p-3.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-slate-900 border-cyan-500 ring-2 ring-cyan-500/20 shadow-sm'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl" role="img" aria-label={opt.name}>
                      {opt.flag}
                    </span>
                    <div className="text-left">
                      <p className="text-xs font-bold text-white flex items-center gap-2">
                        <span>{opt.name}</span>
                        {opt.code === 'ht' && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            Natif Natal
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-400">{opt.nativeName}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isCurrent ? (
                      <span className="flex items-center gap-1.5 text-xs font-bold text-cyan-400">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{language === 'ht' ? 'Aktif' : 'Actif'}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500 hover:text-slate-300">
                        {language === 'ht' ? 'Chwazi' : 'Sélectionner'}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 3: COMPTE */}
      {activeCategory === 'account' && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#0e1422] border border-slate-800 space-y-5">
          <div>
            <h2 className="text-sm font-bold text-white font-['Chakra_Petch'] flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-cyan-400" />
              <span>{language === 'ht' ? 'Enfòmasyon Pwofil Kont Ou' : language === 'en' ? 'Profile Details' : 'Informations du Compte'}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {language === 'ht'
                ? 'Gade epi modifye enfòmasyon pèsonèl ou. Imèl la rete idantifyan prensipal ou an sekirite.'
                : 'Consultez votre identifiant et mettez à jour votre nom ou numéro de contact.'}
            </p>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            {profileMsg && (
              <div
                className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs ${
                  profileMsg.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/10 border-red-500/30 text-red-300'
                }`}
              >
                {profileMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                )}
                <span>{profileMsg.text}</span>
              </div>
            )}

            {/* Email (Read Only) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{language === 'ht' ? 'Adrès Imèl (Lekti sèlman)' : 'Adresse Email (Lecture seule)'}</span>
                </span>
                <span className="text-[10px] text-cyan-400 font-bold uppercase">
                  {user?.status === 'active' ? (language === 'ht' ? 'Aktif' : 'Actif') : user?.status}
                </span>
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-400 text-xs cursor-not-allowed opacity-80"
              />
              <p className="text-[10px] text-slate-500">
                {language === 'ht'
                  ? 'Pou rezon sekirite, adrès imèl la lye ak tout kòmand ak lajan nan bous ou.'
                  : 'L\'adresse email sert d\'identifiant sécurisé pour votre solde et historique.'}
              </p>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <UserIcon className="w-3.5 h-3.5 text-cyan-400" />
                <span>{language === 'ht' ? 'Non Konplè' : 'Nom Complet'}</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Ex: Jean Baptiste"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:border-cyan-500 focus:outline-none transition-colors"
              />
            </div>

            {/* WhatsApp / Phone Number */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                <span>{language === 'ht' ? 'Nimewo WhatsApp / Kontak' : 'Numéro WhatsApp / Téléphone'}</span>
              </label>
              <input
                type="tel"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="Ex: +509 3458 4287"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:border-cyan-500 focus:outline-none transition-colors"
              />
              <p className="text-[10px] text-slate-500">
                {language === 'ht'
                  ? 'Itilize pou livrezon pwodwi MANIÈL sou WhatsApp si sa nesesè.'
                  : 'Sert à l\'assistance et aux livraisons manuelles rapides.'}
              </p>
            </div>

            {/* Account Metadata Badges */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-500">{language === 'ht' ? 'Metòd koneksyon :' : 'Méthode d\'authentification :'}</span>
                <p className="font-bold text-slate-300 mt-0.5">{user?.authMethod || 'EMAIL'}</p>
              </div>
              <div>
                <span className="text-slate-500">{language === 'ht' ? 'Kreye le :' : 'Compte créé le :'}</span>
                <p className="font-bold text-slate-300 mt-0.5">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 disabled:opacity-50"
            >
              {savingProfile ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{language === 'ht' ? 'Mizajou an kour...' : 'Enregistrement...'}</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{language === 'ht' ? 'Anrejistre Pwofil la' : 'Enregistrer les modifications'}</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* SECTION 4: SÉCURITÉ */}
      {activeCategory === 'security' && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#0e1422] border border-slate-800 space-y-5">
          <div>
            <h2 className="text-sm font-bold text-white font-['Chakra_Petch'] flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>{language === 'ht' ? 'Sekirite & Modpas' : language === 'en' ? 'Security & Password' : 'Sécurité et Accès'}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {language === 'ht'
                ? 'Mete yon nouvo modpas solid pou pwoteje kont ou ak lajan nan bous ou.'
                : 'Modifiez votre mot de passe et gérez la déconnexion de votre session.'}
            </p>
          </div>

          {/* Password Change Form */}
          <form onSubmit={handlePasswordChange} className="space-y-4">
            {passwordMsg && (
              <div
                className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs ${
                  passwordMsg.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/10 border-red-500/30 text-red-300'
                }`}
              >
                {passwordMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                )}
                <span>{passwordMsg.text}</span>
              </div>
            )}

            {/* Current Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>{language === 'ht' ? 'Modpas Aktyèl' : 'Mot de passe actuel'}</span>
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:border-cyan-500 focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                <span>{language === 'ht' ? 'Nouvo Modpas (omwen 6 karaktè)' : 'Nouveau mot de passe (min. 6 caractères)'}</span>
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  required
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:border-cyan-500 focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                <span>{language === 'ht' ? 'Konfime Nouvo Modpas la' : 'Confirmer le nouveau mot de passe'}</span>
              </label>
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:border-cyan-500 focus:outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={changingPassword}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              {changingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{language === 'ht' ? 'Chanjman an kour...' : 'Mise à jour...'}</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>{language === 'ht' ? 'Modifye Modpas Mwen' : 'Mettre à jour le mot de passe'}</span>
                </>
              )}
            </button>
          </form>

          {/* Session & Logout Section */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              {language === 'ht' ? 'Sesyon Aktif sou Aparèy Sa a' : 'Session et Déconnexion'}
            </h3>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">
                    {language === 'ht' ? 'Sesyon Kliyantèl Aktif' : 'Session Client Active'}
                  </p>
                  <p className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>{language === 'ht' ? 'Konekte kounye a' : 'En ligne'}</span>
                  </p>
                </div>
              </div>

              {/* Custom Logout Trigger Button */}
              <button
                type="button"
                onClick={() => setShowLogoutConfirmModal(true)}
                className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{language === 'ht' ? 'Dekonekte' : 'Se Déconnecter'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: PRÉFÉRENCES */}
      {activeCategory === 'preferences' && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#0e1422] border border-slate-800 space-y-5">
          <div>
            <h2 className="text-sm font-bold text-white font-['Chakra_Petch'] flex items-center gap-2">
              <Bell className="w-4 h-4 text-cyan-400" />
              <span>{language === 'ht' ? 'Notifikasyon ak Preferans' : language === 'en' ? 'Communication & Display' : 'Préférences & Notifications'}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {language === 'ht'
                ? 'Chwazi kijan ou vle resevwa alèt kòmand, kòd disponib, ak enfòmasyon sou rabè.'
                : 'Gérez vos canaux de notification et vos préférences d\'affichage monétaire.'}
            </p>
          </div>

          {prefsSuccessMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{prefsSuccessMsg}</span>
            </div>
          )}

          {/* Currency Display Preference */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>{language === 'ht' ? 'Deviz prensipal pou afichaj pri' : 'Devise indicative pour l\'affichage'}</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCurrencyDisplay('HTG')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  currencyDisplay === 'HTG'
                    ? 'bg-slate-900 border-cyan-500 ring-2 ring-cyan-500/20'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Gourdes (HTG)</span>
                  {currencyDisplay === 'HTG' && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {language === 'ht' ? 'Deviz ofisyèl boutik la (NatCash & MonCash)' : 'Monnaie officielle de transaction'}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setCurrencyDisplay('USD')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  currencyDisplay === 'USD'
                    ? 'bg-slate-900 border-cyan-500 ring-2 ring-cyan-500/20'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Dollars (USD)</span>
                  {currencyDisplay === 'USD' && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {language === 'ht' ? 'Afichaj ekivalan pou referans' : 'Conversion indicative pour référence'}
                </p>
              </button>
            </div>
          </div>

          {/* Communication Toggles */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              {language === 'ht' ? 'Kanal Kominikasyon' : 'Canaux de Communication'}
            </h3>

            {/* Email Notifications */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">
                    {language === 'ht' ? 'Notifikasyon pa Imèl' : 'Notifications par Email'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {language === 'ht' ? 'Resevwa resi ak konfimasyon kòmand sou imèl ou' : 'Factures, confirmations et reçus numériques'}
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={commPrefs.emailNotifications}
                onChange={(e) => setCommPrefs({ ...commPrefs, emailNotifications: e.target.checked })}
                className="w-4 h-4 rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
              />
            </div>

            {/* WhatsApp Updates */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">
                    {language === 'ht' ? 'Mizajou Kòmand sou WhatsApp' : 'Suivi de commande sur WhatsApp'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {language === 'ht' ? 'Resevwa alèt livrezon kòd ak asistans dirèk' : 'Alertes de livraison de codes et support direct'}
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={commPrefs.orderUpdatesWhatsApp}
                onChange={(e) => setCommPrefs({ ...commPrefs, orderUpdatesWhatsApp: e.target.checked })}
                className="w-4 h-4 rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
              />
            </div>

            {/* Promotions */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">
                    {language === 'ht' ? 'Of ak Rabè Espesyal' : 'Offres promotionnelles & coupons'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {language === 'ht' ? 'Enfòme sou nouvo arivaj jwèt ak kòd promo' : 'Alertes lors des remises et nouveaux codes cadeaux'}
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={commPrefs.promotions}
                onChange={(e) => setCommPrefs({ ...commPrefs, promotions: e.target.checked })}
                className="w-4 h-4 rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleSavePreferences}
            disabled={savingPrefs}
            className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 disabled:opacity-50"
          >
            {savingPrefs ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{language === 'ht' ? 'Anrejistreman...' : 'Enregistrement...'}</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{language === 'ht' ? 'Anrejistre Preferans Mwen' : 'Enregistrer mes préférences'}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* CUSTOM LOGOUT CONFIRMATION MODAL (Strictly NO window.confirm()) */}
      {showLogoutConfirmModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#0e1422] border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <LogOut className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-white font-['Chakra_Petch']">
                {language === 'ht' ? 'Konfime Dekoneksyon Kont Ou' : 'Confirmer la déconnexion'}
              </h3>
              <p className="text-xs text-slate-400">
                {language === 'ht'
                  ? 'Èske ou sèten ou vle dekonekte de kont ou sou aparèy sa a ?'
                  : 'Êtes-vous certain de vouloir vous déconnecter de votre session client ?'}
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirmModal(false)}
                disabled={isLoggingOut}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs transition-colors cursor-pointer border border-slate-800"
              >
                {language === 'ht' ? 'Anile' : 'Annuler'}
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                disabled={isLoggingOut}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold text-xs transition-colors cursor-pointer shadow-lg shadow-red-500/20 flex items-center justify-center gap-1.5"
              >
                {isLoggingOut ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{language === 'ht' ? 'Wi, Dekonekte' : 'Confirmer'}</span>
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
