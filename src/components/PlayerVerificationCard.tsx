import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  RotateCcw, 
  Gamepad2, 
  Globe, 
  Server as ServerIcon,
  HelpCircle
} from 'lucide-react';
import { PlatformOrGame, PlayerVerificationResult } from '../types.js';
import { api } from '../lib/api.js';
import { useI18n } from '../context/I18nContext.js';

interface PlayerVerificationCardProps {
  platform: PlatformOrGame;
  productId?: string;
  initialIdentifier?: string;
  initialToken?: string;
  initialVerifiedInfo?: any;
  initialConfirmed?: boolean;
  onVerificationConfirmed: (data: {
    playerIdentifier: string;
    verificationToken: string;
    verifiedInfo: {
      playerName: string;
      playerIdentifier: string;
      region?: string;
      server?: string;
      provider: string;
      providerRef?: string;
      verifiedAt: string;
    };
  }) => void;
  onResetVerification?: () => void;
}

export const PlayerVerificationCard: React.FC<PlayerVerificationCardProps> = ({
  platform,
  productId,
  initialIdentifier = '',
  initialToken,
  initialVerifiedInfo,
  initialConfirmed = false,
  onVerificationConfirmed,
  onResetVerification,
}) => {
  const { t } = useI18n();
  const config = platform.idVerification;

  // Form states
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [region, setRegion] = useState<string>(() => {
    if (initialVerifiedInfo?.region) return initialVerifiedInfo.region;
    if (config?.regionOptions && config.regionOptions.length > 0) return config.regionOptions[0];
    return 'LATAM';
  });
  const [server, setServer] = useState<string>(() => {
    if (initialVerifiedInfo?.server) return initialVerifiedInfo.server;
    if (config?.serverOptions && config.serverOptions.length > 0) return config.serverOptions[0];
    return '';
  });

  // Verification request status
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<PlayerVerificationResult | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Confirmed status
  const [isConfirmed, setIsConfirmed] = useState(initialConfirmed && !!initialToken);

  // Sync with initial props if they change
  useEffect(() => {
    if (initialIdentifier && initialToken && initialVerifiedInfo) {
      setIdentifier(initialIdentifier);
      setIsConfirmed(true);
      setVerificationResult({
        verified: true,
        verificationToken: initialToken,
        gameId: platform.id,
        gameName: platform.name,
        playerIdentifier: initialIdentifier,
        playerName: initialVerifiedInfo.playerName,
        region: initialVerifiedInfo.region,
        server: initialVerifiedInfo.server,
        provider: initialVerifiedInfo.provider,
        providerRef: initialVerifiedInfo.providerRef,
        verifiedAt: initialVerifiedInfo.verifiedAt || new Date().toISOString(),
        expiresAt: '',
      });
    }
  }, [initialIdentifier, initialToken, initialVerifiedInfo, platform.id, platform.name]);

  if (!config || !config.verificationEnabled) {
    return null;
  }

  const fieldLabel = config.idFieldName || t.playerVerification.inputLabel;
  const placeholder = config.idPlaceholder || 'Ex: 123456789';

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanId = identifier.trim();
    if (!cleanId) {
      setVerificationError(`${fieldLabel}: ${t.common.error}`);
      return;
    }

    if (config.regionRequired && !region) {
      setVerificationError(t.playerVerification.selectRegion);
      return;
    }

    setIsVerifying(true);
    setVerificationError(null);
    setVerificationResult(null);
    setIsConfirmed(false);

    try {
      const res = await api.verifyPlayerId({
        platformId: platform.id,
        productId,
        playerIdentifier: cleanId,
        region: config.regionRequired ? region : undefined,
        server: config.serverRequired ? server : undefined,
      });

      if (res.success && res.result && res.result.verified) {
        setVerificationResult(res.result);
        setVerificationError(null);
      } else {
        setVerificationError(res.result?.errorMessage || t.playerVerification.notFound);
      }
    } catch (err: any) {
      setVerificationError(err.message || t.playerVerification.notFound);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleConfirmPlayer = () => {
    if (!verificationResult || !verificationResult.verified || !verificationResult.playerName) return;

    setIsConfirmed(true);
    onVerificationConfirmed({
      playerIdentifier: verificationResult.playerIdentifier,
      verificationToken: verificationResult.verificationToken,
      verifiedInfo: {
        playerName: verificationResult.playerName,
        playerIdentifier: verificationResult.playerIdentifier,
        region: verificationResult.region,
        server: verificationResult.server,
        provider: verificationResult.provider,
        providerRef: verificationResult.providerRef,
        verifiedAt: verificationResult.verifiedAt,
      },
    });
  };

  const handleReset = () => {
    setIsConfirmed(false);
    setVerificationResult(null);
    setVerificationError(null);
    if (onResetVerification) onResetVerification();
  };

  return (
    <div className="rounded-2xl bg-gradient-to-b from-slate-900/95 to-[#0b101d] border border-cyan-500/30 p-4 shadow-xl shadow-cyan-950/20 text-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Gamepad2 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-black text-white font-['Chakra_Petch'] uppercase tracking-wider text-xs">
              {platform.name}
            </h4>
            <p className="text-[10px] text-slate-400">
              {t.playerVerification.subtitle}
            </p>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
          {t.common.status}
        </span>
      </div>

      {/* STATE 1: ALREADY CONFIRMED */}
      {isConfirmed && verificationResult ? (
        <div className="space-y-3 animate-in zoom-in-95 duration-200">
          <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-emerald-400 font-black tracking-wider uppercase font-['Chakra_Petch'] text-xs">
                <CheckCircle2 className="w-4 h-4" />
                {t.playerVerification.playerConfirmed}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                VERIFIED
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 text-slate-300">
              <div>
                <span className="text-[10px] text-slate-400 block">{t.playerVerification.playerName} :</span>
                <span className="font-bold text-white text-sm font-['Chakra_Petch']">
                  {verificationResult.playerName}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">{fieldLabel} :</span>
                <span className="font-mono text-cyan-400 font-bold">
                  {verificationResult.playerIdentifier}
                </span>
              </div>
              {verificationResult.region && (
                <div>
                  <span className="text-[10px] text-slate-400 block">{t.playerVerification.region} :</span>
                  <span className="text-slate-200 font-semibold">{verificationResult.region}</span>
                </div>
              )}
              {verificationResult.server && (
                <div>
                  <span className="text-[10px] text-slate-400 block">{t.playerVerification.server} :</span>
                  <span className="text-slate-200 font-semibold">{verificationResult.server}</span>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-[11px] font-semibold border border-slate-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
            <span>{t.playerVerification.changeId}</span>
          </button>
        </div>
      ) : (
        /* STATE 2: INPUT / UNVERIFIED / PENDING CONFIRMATION */
        <div className="space-y-3">
          {/* Form Inputs */}
          <div>
            <label className="block text-[11px] font-black text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>{fieldLabel}</span>
              {config.idFormatHelp && (
                <span className="text-[10px] text-slate-400 font-normal normal-case flex items-center gap-1">
                  <HelpCircle className="w-3 h-3 text-cyan-400" />
                  {config.idFormatHelp}
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type="text"
                value={identifier}
                onChange={e => {
                  setIdentifier(e.target.value);
                  setVerificationResult(null);
                  setVerificationError(null);
                }}
                placeholder={placeholder}
                disabled={isVerifying}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all uppercase"
              />
            </div>
          </div>

          {/* Region Selector if required */}
          {config.regionRequired && config.regionOptions && config.regionOptions.length > 0 && (
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                {t.playerVerification.region}
              </label>
              <select
                value={region}
                onChange={e => {
                  setRegion(e.target.value);
                  setVerificationResult(null);
                }}
                disabled={isVerifying}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
              >
                {config.regionOptions.map(r => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Server Selector if required */}
          {config.serverRequired && config.serverOptions && config.serverOptions.length > 0 && (
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                <ServerIcon className="w-3.5 h-3.5 text-cyan-400" />
                {t.playerVerification.server}
              </label>
              <select
                value={server}
                onChange={e => {
                  setServer(e.target.value);
                  setVerificationResult(null);
                }}
                disabled={isVerifying}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
              >
                {config.serverOptions.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Verification Button */}
          {!verificationResult && (
            <button
              type="button"
              onClick={() => handleVerify()}
              disabled={isVerifying || !identifier.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>{t.playerVerification.verifying}</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 text-black" />
                  <span>{t.playerVerification.verifyBtn}</span>
                </>
              )}
            </button>
          )}

          {/* Error Display */}
          {verificationError && (
            <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold block uppercase tracking-wider font-['Chakra_Petch']">
                  {t.playerVerification.notFound}
                </span>
                <span className="text-[11px] text-red-300/90">{verificationError}</span>
              </div>
            </div>
          )}

          {/* VERIFICATION SUCCESS - ASKING FOR EXPLICIT CONFIRMATION */}
          {verificationResult && verificationResult.verified && (
            <div className="p-3.5 rounded-xl bg-cyan-950/40 border-2 border-cyan-500/60 space-y-3 animate-in zoom-in-95">
              <div className="flex items-center justify-between pb-2 border-b border-cyan-500/20">
                <span className="flex items-center gap-1.5 text-cyan-300 font-black tracking-wider uppercase font-['Chakra_Petch'] text-xs">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                  {t.playerVerification.playerFound}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {verificationResult.provider.toUpperCase()}
                </span>
              </div>

              <div className="space-y-1.5 text-slate-200">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-[11px]">{t.playerVerification.playerName} :</span>
                  <span className="font-black text-white text-sm font-['Chakra_Petch'] bg-black/40 px-2 py-0.5 rounded border border-cyan-500/30">
                    {verificationResult.playerName}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-[11px]">{fieldLabel} :</span>
                  <span className="font-mono text-cyan-400 font-bold">{verificationResult.playerIdentifier}</span>
                </div>
                {verificationResult.region && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-[11px]">{t.playerVerification.region} :</span>
                    <span className="text-white font-semibold">{verificationResult.region}</span>
                  </div>
                )}
                {verificationResult.server && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-[11px]">{t.playerVerification.server} :</span>
                    <span className="text-white font-semibold">{verificationResult.server}</span>
                  </div>
                )}
              </div>

              {/* Explicit Confirmation CTA */}
              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleConfirmPlayer}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 hover:opacity-90 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 fill-black" />
                  <span>{t.playerVerification.confirmBtn}</span>
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="text-center text-[11px] text-slate-400 hover:text-white underline cursor-pointer py-1"
                >
                  {t.playerVerification.notMyAccount}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
