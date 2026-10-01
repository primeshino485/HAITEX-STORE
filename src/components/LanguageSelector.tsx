import React, { useState, useRef, useEffect } from 'react';
import { useI18n, LANGUAGE_OPTIONS } from '../context/I18nContext.js';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { Language } from '../types.js';

interface LanguageSelectorProps {
  compact?: boolean;
  variant?: 'header' | 'inline' | 'minimal';
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ 
  compact = false,
  variant = 'header'
}) => {
  const { language, setLanguage } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentOption = LANGUAGE_OPTIONS.find(opt => opt.code === language) || LANGUAGE_OPTIONS[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 border border-slate-800 rounded-xl">
        {LANGUAGE_OPTIONS.map(opt => {
          const isSelected = opt.code === language;
          return (
            <button
              key={opt.code}
              type="button"
              onClick={() => setLanguage(opt.code)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                isSelected
                  ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span className="text-sm">{opt.flag}</span>
              <span>{opt.nativeName}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-center gap-1 ${
          compact ? 'px-1.5 sm:px-2 h-8 sm:h-9 text-xs' : 'px-2 py-1.5 text-xs sm:text-sm'
        } rounded-xl border transition-all cursor-pointer select-none ${
          isOpen
            ? 'bg-slate-800 border-cyan-500 text-cyan-400'
            : 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 hover:border-slate-700 text-slate-300'
        }`}
        aria-label="Chanje Lang / Changer de langue / Switch Language"
        title="Chanje Lang (Kreyòl / Français / English)"
      >
        <span className="text-sm sm:text-base leading-none">{currentOption.flag}</span>
        {!compact && (
          <span className="font-semibold text-slate-200 hidden xs:inline ml-0.5">
            {currentOption.nativeName}
          </span>
        )}
        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-cyan-400' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-44 max-w-[calc(100vw-24px)] rounded-2xl bg-[#0f172a] border border-slate-700/80 shadow-2xl shadow-black/80 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1.5 border-b border-slate-800/80 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Globe className="w-3 h-3 text-cyan-400" />
            <span>Chwazi Lang</span>
          </div>

          <div className="p-1 space-y-0.5">
            {LANGUAGE_OPTIONS.map(opt => {
              const isSelected = opt.code === language;
              return (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => {
                    setLanguage(opt.code);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-cyan-500/15 text-cyan-300 font-bold border border-cyan-500/30'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{opt.flag}</span>
                    <span>{opt.nativeName}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
