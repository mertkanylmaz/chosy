/**
 * Entry Service — kullanıcı türünü ve oturum sayısını yönetir.
 * Dynamic Entry System için altyapı sağlar.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

/** Oturum sayısı AsyncStorage anahtarı */
const SESSIONS_KEY = 'chosy_sessions_count';

/** Onboarding tamamlandı anahtarı (v2) */
const ONBOARDING_KEY_V2 = 'chosy_onboarded';
/** Geriye dönük uyumluluk — mevcut onboarding anahtarı */
const ONBOARDING_KEY_V1 = 'moodflix_onboarding_done';

/** Son entry gösterim tarihi anahtarı (YYYY-MM-DD) */
const LAST_ENTRY_DATE_KEY = 'chosy_last_entry_date';

/** Kullanıcı türü — session sayısına göre belirlenir */
export type UserType = 'new' | 'returning' | 'power';

/**
 * AsyncStorage'daki session sayısına göre kullanıcı türünü döner.
 * - 0 veya null → 'new'
 * - 1-9 → 'returning'
 * - 10+ → 'power'
 */
export async function getUserType(): Promise<UserType> {
  try {
    const val = await AsyncStorage.getItem(SESSIONS_KEY);
    const count = val !== null ? parseInt(val, 10) : 0;
    if (count === 0) return 'new';
    if (count < 10) return 'returning';
    return 'power';
  } catch {
    return 'new';
  }
}

/**
 * Her uygulama açılışında session sayısını bir artırır.
 */
export async function incrementSessionCount(): Promise<void> {
  try {
    const val = await AsyncStorage.getItem(SESSIONS_KEY);
    const count = val !== null ? parseInt(val, 10) : 0;
    await AsyncStorage.setItem(SESSIONS_KEY, String(count + 1));
  } catch {
    // Hata sessizce geç
  }
}

/**
 * Entry ekranının bugün zaten gösterilip gösterilmediğini kontrol eder.
 * Günde 1 kez entry yeterli — aynı gün tekrar açılırsa direkt tabs'a gider.
 */
export async function hasEntryShownToday(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(LAST_ENTRY_DATE_KEY);
    if (!val) return false;
    const today = new Date().toISOString().slice(0, 10);
    return val === today;
  } catch {
    return false;
  }
}

/**
 * Entry ekranının bugün gösterildiğini kaydeder.
 */
export async function markEntryShownToday(): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    await AsyncStorage.setItem(LAST_ENTRY_DATE_KEY, today);
  } catch {
    // Hata sessizce geç
  }
}

/** hasEntryShownToday alias — app/index.tsx ile uyumlu */
export const wasEntryShownToday = hasEntryShownToday;

/** markEntryShownToday alias — app/index.tsx ile uyumlu */
export const markEntryShown = markEntryShownToday;

/**
 * Kullanıcının onboarding'i tamamlayıp tamamlamadığını kontrol eder.
 * Eski ve yeni AsyncStorage anahtarlarını aynı anda kontrol eder.
 */
export async function hasCompletedOnboarding(): Promise<boolean> {
  try {
    const [v1, v2] = await Promise.all([
      AsyncStorage.getItem(ONBOARDING_KEY_V1),
      AsyncStorage.getItem(ONBOARDING_KEY_V2),
    ]);
    return !!(v1 || v2);
  } catch {
    return false;
  }
}
