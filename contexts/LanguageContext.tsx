import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
// ⚠️ `expo-localization`'ın TEK import noktası burasıdır (CLAUDE.md kritik
// import kuralı). Başka hiçbir dosya doğrudan import etmez; cihaz yerelini
// isteyen her yer bu context'ten okur.
import { getLocales } from 'expo-localization';

import { i18n, Locale } from '@/constants/i18n';

// ─── Tipler ───────────────────────────────────────────────────────────────────

interface LanguageContextValue {
  language: Locale;
  setLanguage: (locale: Locale) => Promise<void>;
  t: (key: string, options?: Record<string, unknown>) => string;
  /**
   * Cihazın ülke kodu (ISO 3166-1 alpha-2, BÜYÜK harf) — "nerede izlenir"
   * katalogu bununla sorgulanır (C.9b-UI C2c).
   *
   * `language` ile KARIŞTIRILMAZ: dil arayüzün dilidir, bölge içeriğin
   * satıldığı ülkedir. Türkiye'de İngilizce kullanan biri TR katalogunu
   * görmeli — ikisi bağımsız.
   *
   * Cihaz geçerli bir bölge vermezse `null` — V-2 Tur D. Önceki sürüm
   * burada 'US'e düşüyordu; Türkiye'deki kullanıcıya ABD katalogu
   * (Fubo, Philo…) göstermek sessiz fallback'tir. Tüketici `null`'u
   * "bölge belirlenemedi" olarak AÇIKÇA çizer, başka bölgeyi sormaz.
   */
  region: string | null;
}

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const LANGUAGE_KEY = 'moodflix_language';

/**
 * Cihazın ülke kodunu okur (iOS: Ayarlar › Dil ve Bölge › Bölge; dil
 * seçiminden BAĞIMSIZ). Senkron — `getLocales()` ağ/depo gerektirmez.
 *
 * Geçerli ISO 3166-1 alpha-2 değilse (null, "419" gibi UN M.49 kodları)
 * `null` döner ve Sentry'ye yazılır — varsayılan bölgeye DÜŞÜLMEZ.
 */
function readDeviceRegion(): string | null {
  const raw = getLocales()[0]?.regionCode ?? null;
  const code = raw ? raw.toUpperCase() : null;
  if (code && /^[A-Z]{2}$/.test(code)) return code;
  Sentry.captureMessage('device region unavailable', {
    level: 'warning',
    tags: { component: 'LanguageContext', flow: 'device_region' },
    extra: { raw_region_code: raw },
  });
  return null;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: async () => {},
  t: (key) => key,
  region: null,
});

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * Dil tercihini AsyncStorage'da tutar; cihazın bölge kodunu yayınlar.
 *
 * ⚠️ Bu başlık daha önce "Kayıtlı tercih yoksa cihaz diline göre 'en' veya
 * 'tr' seçer" diyordu ama KOD BUNU YAPMIYOR — kayıtlı tercih yoksa koşulsuz
 * 'en' seçiliyor. Başlık gerçeğe uyduruldu; davranışı değiştirmek bir ÜRÜN
 * kararıdır ve C.9b-UI C2c'nin kapsamı değildir (raporlandı).
 */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Locale>('en');
  // Cihaz bölgesi oturum boyunca değişmez — bir kez okunur.
  const [region] = useState<string | null>(readDeviceRegion);

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
    <LanguageContext.Provider value={{ language, setLanguage, t, region }}>
      {children}
    </LanguageContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Dil context'ine erişim hook'u.
 * language, setLanguage, t() ve cihaz `region` bilgisine erişim sağlar.
 */
export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
