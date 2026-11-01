import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
// ⚠️ `expo-localization`'ın TEK import noktası burasıdır (CLAUDE.md kritik
// import kuralı). Başka hiçbir dosya doğrudan import etmez; cihaz yerelini
// isteyen her yer bu context'ten okur.
import { getLocales } from 'expo-localization';

import { i18n, Locale } from '@/constants/i18n';
import { posthogAnalytics } from '@/services/posthog';
import { readStorefrontCountry } from '@/services/storefrontRegion';
import {
  normalizeCountryCode,
  resolveWatchRegion,
  WATCH_REGION_STORAGE_KEY,
  type WatchRegionSource,
} from '@/utils/watchRegion';

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
  /**
   * Faz 2-4: `region` hangi basamaktan geldi — user | storefront | device | none
   * (`utils/watchRegion.resolveWatchRegion`). Öncelik: kullanıcı seçimi > App Store
   * storefront > cihaz bölgesi > null. 'US' son çaresi YOK.
   */
  regionSource: WatchRegionSource;
  /** Kullanıcı seçimini kaydeder (AsyncStorage) ve `watch_region_changed` olayını atar. */
  setWatchRegion: (code: string) => Promise<void>;
}

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const LANGUAGE_KEY = 'moodflix_language';

/**
 * Cihazın ham ülke kodunu okur (iOS: Ayarlar › Dil ve Bölge › Bölge; dil seçiminden
 * BAĞIMSIZ). Senkron — `getLocales()` ağ/depo gerektirmez. Doğrulama ve öncelik
 * `utils/watchRegion.resolveWatchRegion`'da; bu yalnız ham değeri verir.
 */
function readDeviceRegionRaw(): string | null {
  return getLocales()[0]?.regionCode ?? null;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: async () => {},
  t: (key) => key,
  region: null,
  regionSource: 'none',
  setWatchRegion: async () => {},
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
  const [deviceRaw] = useState<string | null>(readDeviceRegionRaw);
  const [chosenRaw, setChosenRaw] = useState<string | null>(null);
  const [storefrontRaw, setStorefrontRaw] = useState<string | null>(null);
  const [chosenLoaded, setChosenLoaded] = useState(false);
  const [storefrontLoaded, setStorefrontLoaded] = useState(false);

  const resolved = useMemo(
    () => resolveWatchRegion({ chosen: chosenRaw, storefront: storefrontRaw, device: deviceRaw }),
    [chosenRaw, storefrontRaw, deviceRaw],
  );
  const { region, source: regionSource } = resolved;

  // Kullanıcının kayıtlı seçimi.
  useEffect(() => {
    AsyncStorage.getItem(WATCH_REGION_STORAGE_KEY)
      .then((saved) => setChosenRaw(normalizeCountryCode(saved)))
      .catch((err: unknown) => {
        Sentry.captureException(err, { tags: { component: 'LanguageContext', flow: 'watch_region_read' } });
      })
      .finally(() => setChosenLoaded(true));
  }, []);

  // App Store storefront ülkesi (RC hazır olunca; başarısızsa cihaz bölgesine düşülür).
  useEffect(() => {
    let cancelled = false;
    void readStorefrontCountry().then((code) => {
      if (cancelled) return;
      setStorefrontRaw(code);
      setStorefrontLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Bölge çözülemedi → Sentry (bir kez). Çözüm tamamlanmadan uyarı verilmez.
  const warnedNone = useRef(false);
  const resolvedLogged = useRef(false);
  useEffect(() => {
    if (!chosenLoaded || !storefrontLoaded) return;
    if (!resolvedLogged.current) {
      resolvedLogged.current = true;
      posthogAnalytics.track('watch_region_resolved', {
        region,
        source: regionSource,
        device_region: normalizeCountryCode(deviceRaw),
        storefront_region: normalizeCountryCode(storefrontRaw),
      });
    }
    if (region === null && !warnedNone.current) {
      warnedNone.current = true;
      Sentry.captureMessage('device region unavailable', {
        level: 'warning',
        tags: { component: 'LanguageContext', flow: 'device_region' },
        extra: { raw_device: deviceRaw, raw_storefront: storefrontRaw },
      });
    }
  }, [chosenLoaded, storefrontLoaded, region, regionSource, deviceRaw, storefrontRaw]);

  const setWatchRegion = useCallback(
    async (code: string) => {
      const next = normalizeCountryCode(code);
      if (next === null || next.length !== 2) {
        throw new Error(`setWatchRegion: gecersiz ulke kodu (${code})`);
      }
      if (next === region && regionSource === 'user') return;
      posthogAnalytics.track('watch_region_changed', {
        from: region,
        to: next,
        source_before: regionSource,
      });
      setChosenRaw(next);
      try {
        await AsyncStorage.setItem(WATCH_REGION_STORAGE_KEY, next);
      } catch (err) {
        // Seçim bu oturumda geçerli kalır; kalıcılaşamadığı görünür kayıt bırakır.
        Sentry.captureException(err, { tags: { component: 'LanguageContext', flow: 'watch_region_write' } });
      }
    },
    [region, regionSource],
  );

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
    <LanguageContext.Provider value={{ language, setLanguage, t, region, regionSource, setWatchRegion }}>
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
