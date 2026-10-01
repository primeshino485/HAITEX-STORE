import React, { useState } from 'react';
import { ShieldCheck, Lock, Mail, ArrowLeft, AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useI18n } from '../../context/I18nContext.js';
import { User } from '../../types.js';

interface AdminLoginViewProps {
  onSuccess: (adminUser: User) => void;
  onBackToStore: () => void;
}

export const AdminLoginView: React.FC<AdminLoginViewProps> = ({ onSuccess, onBackToStore }) => {
  const { t } = useI18n();
  const [email, setEmail] = useState(() => {
    try {
      return sessionStorage.getItem('mystore_admin_pref_email') || '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError(t.auth.fillAllFields);
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      // Direct, explicit call to POST /api/admin/auth/login with JSON { email, password } and credentials: include
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email: trimmedEmail,
          password: password,
        }),
      });

      const res = await response.json().catch(() => ({}));
      if (!response.ok || !res.success) {
        throw new Error(res.error || `Erreur (${response.status}) : Identifiants administrateur incorrects`);
      }

      if (res.token) {
        localStorage.setItem('mystore_admin_token', res.token);
        sessionStorage.setItem('mystore_admin_token', res.token);
      }
      try {
        sessionStorage.removeItem('mystore_admin_pref_email');
      } catch {}

      setSuccessMsg(res.message || 'Authentification administrateur réussie.');
      setTimeout(() => {
        onSuccess(res.user);
      }, 400);
    } catch (err: any) {
      setError(err.message || 'Identifiants administrateur incorrects ou accès refusé.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-10 px-4">
      <div className="w-full max-w-md bg-[#0a0f1d] border border-amber-500/30 rounded-3xl shadow-2xl p-6 sm:p-8 relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-64 h-32 bg-amber-500/10 blur-3xl pointer-events-none" />

        {/* Back to store button */}
        <button
          onClick={() => {
            try {
              window.history.pushState(null, '', '/');
            } catch {
              window.location.hash = '';
            }
            onBackToStore();
          }}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors mb-6 cursor-pointer disabled:opacity-50"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.admin.backToStore}</span>
        </button>

        {/* Brand & Title */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/10">
            <ShieldCheck className="w-7 h-7 animate-pulse" />
          </div>
          <h1 className="text-lg sm:text-xl font-black text-white font-['Chakra_Petch'] uppercase tracking-wider">
            {t.admin.loginTitle}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {t.admin.loginSubtitle}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs flex items-start gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              {t.admin.emailLabel}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                disabled={loading}
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="admin@egzanp.com"
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              {t.admin.passwordLabel}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                disabled={loading}
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={t.admin.passwordPlaceholder}
                className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all active:scale-95 disabled:opacity-50 mt-2 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-black" />
                <span>{t.admin.loggingIn}</span>
              </>
            ) : (
              <span>{t.admin.loginSubmit}</span>
            )}
          </button>
        </form>

        {/* Security notice */}
        <div className="mt-6 pt-4 border-t border-slate-800 text-center">
          <p className="text-[10px] text-slate-500 leading-relaxed">
            🛡️ <span className="font-semibold text-slate-400">Protection Renforcée :</span> Authentification serveur directe contre le secret <code className="text-amber-400/80 bg-amber-400/10 px-1 py-0.5 rounded">ADMIN_PASSWORD</code> avec cookie de session chiffré HTTP-only.
          </p>
        </div>
      </div>
    </div>
  );
};
