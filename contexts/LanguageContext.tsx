import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { i18n, Locale } from '@/constants/i18n';

// ─── Tipler ───────────────────────────────────────────────────────────────────

interface LanguageContextValue {
  language: Locale;
  setLanguage: (locale: Locale) => Promise<void>;
  t: (key: string, options?: Record<string, unknown>) => string;
}

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const LANGUAGE_KEY = 'moodflix_language';

// ─── Context ──────────────────────────────────────────────────────────────────

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: async () => {},
  t: (key) => key,
});

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * Dil tercihini AsyncStorage'da tutar.
 * Kayıtlı tercih yoksa cihaz diline göre 'en' veya 'tr' seçer.
 */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Locale>('en');

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_KEY)
      .then((saved) => {
        if (saved === 'en' || saved === 'tr') {
          i18n.locale = saved;
          setLanguageState(saved);
        } else {
          i18n.locale = 'en';
          setLanguageState('en');
        }
      })
      .catch(() => {
        i18n.locale = 'en';
      });
  }, []);

  /** Dili değiştirir ve AsyncStorage'a kaydeder */
  const setLanguage = useCallback(async (locale: Locale) => {
    i18n.locale = locale;
    setLanguageState(locale);
    await AsyncStorage.setItem(LANGUAGE_KEY, locale);
  }, []);

  /**
   * Çeviri fonksiyonu — dil değiştiğinde yeniden oluşturulur,
   * böylece tüm tüketiciler yeni dile göre yeniden render edilir.
   */
  const t = useCallback(
    (key: string, options?: Record<string, unknown>) => i18n.t(key, options),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language],
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Dil context'ine erişim hook'u.
 * language, setLanguage ve t() fonksiyonuna erişim sağlar.
 */
export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
