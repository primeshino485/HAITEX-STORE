import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Language, Product } from '../types.js';
import { ht } from '../locales/ht.js';
import { fr } from '../locales/fr.js';
import { en } from '../locales/en.js';
import { api } from '../lib/api.js';

export type TranslationType = typeof ht;

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationType;
  getProductName: (product?: Product | null) => string;
  getProductDescription: (product?: Product | null) => string;
}

const translations: Record<Language, TranslationType> = {
  ht,
  fr,
  en,
};

export const LANGUAGE_OPTIONS: { code: Language; name: string; nativeName: string; flag: string }[] = [
  { code: 'ht', name: 'Kreyòl Ayisyen', nativeName: 'Kreyòl', flag: '🇭🇹' },
  { code: 'fr', name: 'Français', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
];

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Requirement 1 & 7:
  // "Au premier chargement de la boutique : Kreyòl Ayisyen doit être sélectionné automatiquement.
  // Ne pas utiliser le français comme langue par défaut.
  // Le choix de langue doit être mémorisé pour les prochaines visites."
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('mystore_language') as Language | null;
      if (saved && (saved === 'ht' || saved === 'fr' || saved === 'en')) {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'ht'; // DEFAULT IS STRICTLY KREYÒL AYISYEN
  });

  const setLanguage = useCallback((lang: Language) => {
    if (lang !== 'ht' && lang !== 'fr' && lang !== 'en') return;
    setLanguageState(lang);
    try {
      localStorage.setItem('mystore_language', lang);
      document.documentElement.lang = lang;
    } catch (err) {
      console.warn('Could not save language to localStorage', err);
    }

    // Try to update user account preference if logged in
    const token = localStorage.getItem('mystore_token');
    if (token) {
      api.updateLanguage?.(lang).catch(() => {});
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = translations[language] || ht;

  const getProductName = useCallback((product?: Product | null): string => {
    if (!product) return '';
    if (language === 'ht' && product.name_ht) return product.name_ht;
    if (language === 'fr' && product.name_fr) return product.name_fr;
    if (language === 'en' && product.name_en) return product.name_en;
    return product.name || '';
  }, [language]);

  const getProductDescription = useCallback((product?: Product | null): string => {
    if (!product) return '';
    if (language === 'ht' && product.description_ht) return product.description_ht;
    if (language === 'fr' && product.description_fr) return product.description_fr;
    if (language === 'en' && product.description_en) return product.description_en;
    return product.description || '';
  }, [language]);

  return (
    <I18nContext.Provider
      value={{
        language,
        setLanguage,
        t,
        getProductName,
        getProductDescription,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = (): I18nContextType => {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return ctx;
};
