import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext.js';
import { useI18n, LANGUAGE_OPTIONS } from '../context/I18nContext.js';
import { api } from '../lib/api.js';
import { Language } from '../types.js';
import {
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  X
} from 'lucide-react';

interface LoginPageProps {
  isModal?: boolean;
  onClose?: () => void;
  initialMode?: 'login' | 'register' | 'forgot' | 'reset';
  initialResetToken?: string;
  initialResetEmail?: string;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  isModal = false,
  onClose,
  initialMode = 'login',
  initialResetToken = '',
  initialResetEmail = '',
}) => {
  const { siteSettings, setUserAndToken, setActiveTab, setIsAuthModalOpen } = useStore();
  const { t, language, setLanguage } = useI18n();

  // Sub-modes: 'login' | 'register' | 'verify' | 'forgot' | 'reset'
  const [mode, setMode] = useState<'login' | 'register' | 'verify' | 'forgot' | 'reset'>(initialMode);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Email verification state
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  // Password reset state
  const [resetToken, setResetToken] = useState(initialResetToken);
  const [resetEmail, setResetEmail] = useState(initialResetEmail);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Status & Feedback states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | null>(null);

  // Check URL hash/query on mount for reset-password link
  useEffect(() => {
    const parseUrl = () => {
      const hash = window.location.hash;
      const search = window.location.search;
      const fullQuery = hash.includes('?') ? hash.split('?')[1] : search.replace(/^\?/, '');
      if (fullQuery) {
        const params = new URLSearchParams(fullQuery);
        const token = params.get('token');
        const emailParam = params.get('email');
        if (token) {
          setResetToken(token);
          if (emailParam) setResetEmail(decodeURIComponent(emailParam));
          setMode('reset');
        }
      }
    };
    parseUrl();
  }, []);

  // Cooldown countdown effect
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Clean error / success when mode changes
  const switchMode = (newMode: typeof mode) => {
    setError(null);
    setSuccessMessage(null);
    setMode(newMode);
  };

  // Quick Admin Detection on Email Blur for smooth portal redirection
  const handleEmailBlur = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) return;
    try {
      const res = await api.checkFlow(trimmed);
      if (res.flow === 'admin' && res.redirectTo) {
        try {
          sessionStorage.setItem('mystore_admin_pref_email', trimmed);
        } catch {}
        if (onClose) onClose();
        setIsAuthModalOpen(false);
        try {
          window.history.pushState(null, '', res.redirectTo);
        } catch {
          window.location.hash = 'admin/connexion';
        }
        setActiveTab('admin');
      }
    } catch {
      // ignore silently, submit handler will process
    }
  };

  // 1. Submit Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const res = await api.login({ email, password });

      // Admin account detected: redirect smoothly to /admin/connexion with ZERO 403 error
      if (res.redirectTo) {
        if (email) {
          try {
            sessionStorage.setItem('mystore_admin_pref_email', email.trim());
          } catch {}
        }
        if (onClose) onClose();
        setIsAuthModalOpen(false);
        try {
          window.history.pushState(null, '', res.redirectTo);
        } catch {
          window.location.hash = 'admin/connexion';
        }
        setActiveTab('admin');
        return;
      }

      if (res.user && res.token) {
        await setUserAndToken(res.user, res.token);
        if (onClose) onClose();
      }
    } catch (err: any) {
      setError(err.message || t.auth.fillAllFields);
    } finally {
      setLoading(false);
    }
  };

  // 2. Submit Register (Initiates mandatory email verification)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!termsAccepted) {
      setError(t.auth.termsAcceptance);
      return;
    }

    if (password.length < 8) {
      setError(
        language === 'ht'
          ? 'Modpas la dwe gen omwen 8 karaktè.'
          : language === 'fr'
          ? 'Le mot de passe doit comporter au moins 8 caractères.'
          : 'Password must be at least 8 characters.'
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        language === 'ht'
          ? 'De modpas yo pa koresponn.'
          : language === 'fr'
          ? 'Les deux mots de passe ne correspondent pas.'
          : 'Passwords do not match.'
      );
      return;
    }

    setLoading(true);
    try {
      const res = await api.register({
        name,
        email,
        password,
        confirmPassword,
        termsAccepted,
      });

      setPendingEmail(res.email || email.trim().toLowerCase());
      setResendCooldown(res.cooldownSeconds || 60);
      setSuccessMessage(res.message || t.auth.verificationSubtitle);
      setMode('verify');
    } catch (err: any) {
      setError(err.message || 'Erè pandan enskripsyon an.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Submit Email Verification Code
  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!verificationCode || verificationCode.trim().length !== 6) {
      setError(
        language === 'ht'
          ? 'Tanpri mete kòd 6 chif la kòrèkteman.'
          : language === 'fr'
          ? 'Veuillez saisir le code à 6 chiffres.'
          : 'Please enter the 6-digit code.'
      );
      return;
    }

    setLoading(true);
    try {
      const res = await api.verifyEmail({
        email: pendingEmail,
        code: verificationCode.trim(),
      });

      setSuccessMessage(res.message || 'Kont ou verifye avèk siksè !');
      await setUserAndToken(res.user, res.token);
      setTimeout(() => {
        if (onClose) onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Kòd verifikasyon an pa kòrèk.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Resend Verification Code
  const handleResendCode = async () => {
    if (resendCooldown > 0 || loading) return;
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const res = await api.resendCode(pendingEmail);
      setResendCooldown(res.cooldownSeconds || 60);
      setSuccessMessage(res.message || 'Nou voye yon nouvo kòd sou imèl ou.');
    } catch (err: any) {
      setError(err.message || 'Erè pandan voye kòd la.');
    } finally {
      setLoading(false);
    }
  };

  // 5. Submit Forgot Password
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const res = await api.forgotPassword(email);
      setSuccessMessage(res.message || 'Si imel sa a asosye ak yon kont, n ap voye enstriksyon pou rekipere aksè ou.');
    } catch (err: any) {
      setError(err.message || 'Erè pandan demann rekipere a.');
    } finally {
      setLoading(false);
    }
  };

  // 6. Submit Reset Password
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (newPassword.length < 8) {
      setError(
        language === 'ht'
          ? 'Nouvo modpas la dwe gen omwen 8 karaktè.'
          : language === 'fr'
          ? 'Le nouveau mot de passe doit comporter au moins 8 caractères.'
          : 'New password must be at least 8 characters.'
      );
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError(
        language === 'ht'
          ? 'De modpas yo pa koresponn.'
          : language === 'fr'
          ? 'Les deux mots de passe ne correspondent pas.'
          : 'Passwords do not match.'
      );
      return;
    }

    setLoading(true);
    try {
      const res = await api.resetPassword({
        token: resetToken,
        email: resetEmail,
        newPassword,
        confirmPassword: confirmNewPassword,
      });

      setSuccessMessage(res.message || 'Modpas ou chanje avèk siksè !');
      setTimeout(() => {
        setMode('login');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Lyen reyinitializasyon sa a pa valab.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-[#0b101c] border border-slate-800/90 rounded-3xl shadow-2xl p-6 sm:p-7 relative overflow-hidden text-slate-100">
      {/* Subtle top ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-24 bg-gradient-to-b from-cyan-500/15 to-transparent blur-2xl pointer-events-none" />

      {/* Close button if in modal */}
      {isModal && onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all cursor-pointer z-10"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* ================= TOP BRANDING ================= */}
      <div className="text-center mb-6 relative">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-black mb-3 shadow-lg shadow-cyan-500/25 border border-cyan-300/30">
          {siteSettings?.logoUrl ? (
            <img
              src={siteSettings.logoUrl}
              alt={siteSettings.siteName || 'Store Logo'}
              className="w-10 h-10 object-contain rounded-xl"
              referrerPolicy="no-referrer"
            />
          ) : (
            <Sparkles className="w-7 h-7 text-black stroke-[2.5]" />
          )}
        </div>
        <h1 className="text-xl font-black text-white tracking-tight font-['Chakra_Petch'] uppercase">
          {siteSettings?.siteName || 'MY STORE DIGITAL'}
        </h1>
        <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
          {mode === 'login' && t.auth.loginSubtitle}
          {mode === 'register' && t.auth.registerSubtitle}
          {mode === 'verify' && t.auth.verificationSubtitle}
          {mode === 'forgot' && t.auth.forgotPasswordSubtitle}
          {mode === 'reset' && t.auth.resetPasswordSubtitle}
        </p>
      </div>

      {/* ================= TOP TABS: [ Se connecter ] [ Nouveau client ] ================= */}
      {(mode === 'login' || mode === 'register') && (
        <div className="flex rounded-2xl bg-slate-900/90 p-1 border border-slate-800/80 mb-5 shadow-inner">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 py-2.5 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer text-center ${
              mode === 'login'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-black shadow-md shadow-cyan-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {language === 'ht' ? 'Konekte' : language === 'fr' ? 'Se connecter' : 'Sign in'}
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`flex-1 py-2.5 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer text-center ${
              mode === 'register'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-black shadow-md shadow-cyan-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {language === 'ht' ? 'Nouvo Kliyan' : language === 'fr' ? 'Nouveau client' : 'New customer'}
          </button>
        </div>
      )}

      {/* ================= ALERT / NOTIFICATIONS ================= */}
      {error && (
        <div className="mb-4 p-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="leading-relaxed font-medium">{error}</div>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="leading-relaxed font-medium">{successMessage}</div>
        </div>
      )}

      {/* ================= VIEW: LOGIN ================= */}
      {mode === 'login' && (
        <div className="space-y-4">
          {/* Standard Email/Password Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                {t.auth.emailLabel}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onBlur={handleEmailBlur}
                  placeholder="kliyan@egzanp.com"
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold text-slate-300">
                  {t.auth.passwordLabel}
                </label>
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline transition-colors cursor-pointer"
                >
                  {language === 'ht' ? 'Ou bliye modpas ou ?' : language === 'fr' ? 'Mot de passe oublié ?' : 'Forgot password?'}
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer p-1"
                  aria-label={showPassword ? t.auth.hidePassword : t.auth.showPassword}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/25 transition-all active:scale-[0.98] disabled:opacity-50 mt-2 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>
                {loading
                  ? t.auth.loadingBtn
                  : language === 'ht'
                  ? 'KONEKTE'
                  : language === 'fr'
                  ? 'SE CONNECTER'
                  : 'SIGN IN'}
              </span>
            </button>
          </form>

          {/* Switch to Register */}
          <div className="pt-3 text-center border-t border-slate-800/80">
            <p className="text-xs text-slate-400">
              {language === 'ht'
                ? 'Ou poko gen kont ?'
                : language === 'fr'
                ? 'Pas encore de compte ?'
                : "Don't have an account?"}{' '}
              <button
                type="button"
                onClick={() => switchMode('register')}
                className="font-bold text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer transition-colors ml-1"
              >
                {language === 'ht'
                  ? 'Kreye yon kont'
                  : language === 'fr'
                  ? 'Créer un compte'
                  : 'Create an account'}
              </button>
            </p>
          </div>
        </div>
      )}

      {/* ================= VIEW: REGISTER ================= */}
      {mode === 'register' && (
        <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
          {/* Full Name */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
              {t.auth.fullName} *
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t.auth.namePlaceholder}
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
              {t.auth.emailLabel} *
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="kliyan@egzanp.com"
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
              {t.auth.passwordLabel} * (min. 8)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer p-1"
                aria-label={showPassword ? t.auth.hidePassword : t.auth.showPassword}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
              {t.auth.confirmPasswordLabel} *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer p-1"
                aria-label={showConfirmPassword ? t.auth.hidePassword : t.auth.showPassword}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Mandatory Checkboxes: Terms of Service & Privacy Policy */}
          <div className="pt-1">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={termsAccepted}
                onChange={e => setTermsAccepted(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 bg-slate-900 w-4 h-4 cursor-pointer"
              />
              <span className="text-[11px] text-slate-300 leading-snug">
                {language === 'ht' ? (
                  <>
                    Mwen aksepte{' '}
                    <button
                      type="button"
                      onClick={() => setLegalModal('terms')}
                      className="text-cyan-400 hover:underline font-semibold"
                    >
                      Kondisyon Itilizasyon
                    </button>{' '}
                    yo ak{' '}
                    <button
                      type="button"
                      onClick={() => setLegalModal('privacy')}
                      className="text-cyan-400 hover:underline font-semibold"
                    >
                      Règleman sou Vi Prive
                    </button>{' '}
                    a *
                  </>
                ) : language === 'fr' ? (
                  <>
                    J'accepte les{' '}
                    <button
                      type="button"
                      onClick={() => setLegalModal('terms')}
                      className="text-cyan-400 hover:underline font-semibold"
                    >
                      Conditions d'Utilisation
                    </button>{' '}
                    et la{' '}
                    <button
                      type="button"
                      onClick={() => setLegalModal('privacy')}
                      className="text-cyan-400 hover:underline font-semibold"
                    >
                      Politique de Confidentialité
                    </button>{' '}
                    *
                  </>
                ) : (
                  <>
                    I accept the{' '}
                    <button
                      type="button"
                      onClick={() => setLegalModal('terms')}
                      className="text-cyan-400 hover:underline font-semibold"
                    >
                      Terms of Service
                    </button>{' '}
                    and{' '}
                    <button
                      type="button"
                      onClick={() => setLegalModal('privacy')}
                      className="text-cyan-400 hover:underline font-semibold"
                    >
                      Privacy Policy
                    </button>{' '}
                    *
                  </>
                )}
              </span>
            </label>
          </div>

          {/* Submit Register */}
          <button
            type="submit"
            disabled={loading || !termsAccepted}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/25 transition-all active:scale-[0.98] disabled:opacity-50 mt-2 cursor-pointer flex items-center justify-center gap-2"
          >
            {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>
              {loading
                ? t.auth.loadingBtn
                : language === 'ht'
                ? 'KREYE KONT MWEN'
                : language === 'fr'
                ? 'CRÉER MON COMPTE'
                : 'CREATE MY ACCOUNT'}
            </span>
          </button>

          {/* Switch to Login */}
          <div className="pt-3 text-center border-t border-slate-800/80">
            <p className="text-xs text-slate-400">
              {t.auth.alreadyHaveAccount}{' '}
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="font-bold text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer transition-colors ml-1"
              >
                {t.auth.switchToLogin}
              </button>
            </p>
          </div>
        </form>
      )}

      {/* ================= VIEW: EMAIL VERIFICATION CODE ================= */}
      {mode === 'verify' && (
        <form onSubmit={handleVerifySubmit} className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 text-center">
            <ShieldCheck className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
            <p className="text-xs text-cyan-200 font-medium">
              {language === 'ht'
                ? 'Nou voye yon kòd 6 chif sou adrès imel ou :'
                : language === 'fr'
                ? 'Nous avons envoyé un code à 6 chiffres sur votre e-mail :'
                : 'We have sent a 6-digit code to your email:'}
            </p>
            <p className="text-xs font-bold text-white mt-1 break-all">
              {pendingEmail}
            </p>
          </div>

          <div>
            <label className="block text-center text-[11px] font-semibold text-slate-300 mb-2">
              {language === 'ht' ? 'Kòd 6 chif' : language === 'fr' ? 'Code à 6 chiffres' : '6-digit code'}
            </label>
            <input
              type="text"
              required
              maxLength={6}
              autoFocus
              value={verificationCode}
              onChange={e => setVerificationCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="w-full text-center tracking-[0.4em] font-mono text-2xl font-black bg-slate-900 border border-cyan-500/50 rounded-2xl py-3.5 text-cyan-300 placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition-colors shadow-inner"
            />
          </div>

          <button
            type="submit"
            disabled={loading || verificationCode.length !== 6}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/25 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>
              {loading
                ? t.auth.loadingBtn
                : language === 'ht'
                ? 'VERIFYE IMÈL'
                : language === 'fr'
                ? 'VÉRIFIER L\'E-MAIL'
                : 'VERIFY EMAIL'}
            </span>
          </button>

          {/* Resend Code with Cooldown */}
          <div className="pt-2 text-center space-y-2">
            <button
              type="button"
              disabled={resendCooldown > 0 || loading}
              onClick={handleResendCode}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold disabled:text-slate-500 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              {resendCooldown > 0
                ? language === 'ht'
                  ? `Ou ka voye yon nouvo kòd nan ${resendCooldown} segonn`
                  : language === 'fr'
                  ? `Vous pouvez renvoyer un code dans ${resendCooldown} secondes`
                  : `You can resend a code in ${resendCooldown}s`
                : language === 'ht'
                ? 'Voye kòd la ankò'
                : language === 'fr'
                ? 'Renvoyer le code'
                : 'Resend code'}
            </button>
            <div>
              <button
                type="button"
                onClick={() => switchMode('register')}
                className="text-[11px] text-slate-500 hover:text-slate-400 cursor-pointer inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>
                  {language === 'ht'
                    ? 'Chanje adrès imèl'
                    : language === 'fr'
                    ? 'Changer d\'adresse e-mail'
                    : 'Change email address'}
                </span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ================= VIEW: FORGOT PASSWORD ================= */}
      {mode === 'forgot' && (
        <form onSubmit={handleForgotSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
              {t.auth.emailLabel}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="kliyan@egzanp.com"
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/25 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>{loading ? t.auth.loadingBtn : t.auth.sendResetLinkBtn}</span>
          </button>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t.auth.backToLogin}</span>
            </button>
          </div>
        </form>
      )}

      {/* ================= VIEW: RESET PASSWORD ================= */}
      {mode === 'reset' && (
        <form onSubmit={handleResetSubmit} className="space-y-3.5">
          {resetEmail && (
            <p className="text-xs text-cyan-300 font-medium text-center pb-1">
              {resetEmail}
            </p>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
              {t.auth.newPasswordLabel}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showNewPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer p-1"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
              {t.auth.confirmNewPasswordLabel}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showNewPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={confirmNewPassword}
                onChange={e => setConfirmNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/25 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            <span>{loading ? t.auth.loadingBtn : t.auth.changePasswordBtn}</span>
          </button>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t.auth.backToLogin}</span>
            </button>
          </div>
        </form>
      )}

      {/* ================= BOTTOM: PRIVACY MESSAGE & LEGAL ================= */}
      <div className="mt-6 pt-4 border-t border-slate-800/80 space-y-3">
        {/* Trust & Privacy Notice */}
        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-center space-y-2">
          <p className="text-[11px] text-slate-300 leading-relaxed">
            🔒{' '}
            <span className="font-semibold text-white">
              {language === 'ht'
                ? 'Nou pran vi prive ou oserye.'
                : language === 'fr'
                ? 'Nous prenons votre vie privée au sérieux.'
                : 'We take your privacy seriously.'}
            </span>{' '}
            {language === 'ht'
              ? 'Done pèsonèl ou yo trete yon fason ki an sekirite epi yo itilize sèlman pou jere kont ou, kòmand ou yo ak sèvis nou ofri yo.'
              : language === 'fr'
              ? 'Vos données personnelles sont traitées de manière sécurisée et sont uniquement utilisées pour gérer votre compte, vos commandes et nos services.'
              : 'Your personal data is treated securely and only used to manage your account, your orders, and the services we provide.'}
          </p>
          <div className="flex items-center justify-center gap-2.5 text-[11px] font-semibold text-cyan-400">
            <button
              type="button"
              onClick={() => setLegalModal('terms')}
              className="hover:text-cyan-300 hover:underline cursor-pointer transition-colors"
            >
              {language === 'ht'
                ? 'Kondisyon Itilizasyon'
                : language === 'fr'
                ? 'Conditions d\'Utilisation'
                : 'Terms of Service'}
            </button>
            <span className="text-slate-600">•</span>
            <button
              type="button"
              onClick={() => setLegalModal('privacy')}
              className="hover:text-cyan-300 hover:underline cursor-pointer transition-colors"
            >
              {language === 'ht'
                ? 'Règleman sou Vi Prive'
                : language === 'fr'
                ? 'Politique de Confidentialité'
                : 'Privacy Policy'}
            </button>
          </div>
        </div>

        {/* Language Selector */}
        <div className="flex items-center justify-center gap-2 pt-1">
          {LANGUAGE_OPTIONS.map(opt => (
            <button
              key={opt.code}
              type="button"
              onClick={() => setLanguage(opt.code)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                language === opt.code
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'bg-slate-900/70 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <span>{opt.flag}</span>
              <span>{opt.nativeName}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Terms & Privacy Modal */}
      {legalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>{legalModal === 'terms' ? '📋 Kondisyon Itilizasyon' : '🔒 Règleman sou Vi Prive'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-slate-300 leading-relaxed space-y-3 font-mono">
              {legalModal === 'terms' ? (
                <>
                  <p>
                    Byenveni sou <strong>My Store Digital</strong>. Lè ou kreye yon kont oswa itilize platfòm nou an, ou dakò pou respekte tout lwa an vigè ak règleman itilizasyon sèvis nou yo.
                  </p>
                  <p>
                    Tout acha ak rechaj sou bous elektwonik ou yo dwe fèt ak enfòmasyon ki egzak. Nenpòt fwod oswa tantativ aksè san otorizasyon ap mennen nan fèmti imedyat kont la.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Nou pran pwoteksyon done ou yo oserye. Nou pa janm vann, lwe, oswa pataje enfòmasyon pèsonèl ou (non, adrès imel, modpas chifre) ak okenn twazyèm pati san konsantman ou.
                  </p>
                  <p>
                    Done ou yo sèvi sèlman pou trete kòmand ou yo, sekirize bous ou, epi pèmèt ou resevwa kòd verifikasyon ak livrezon pwodwi dijital ou yo.
                  </p>
                </>
              )}
            </div>
            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Fèmen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
