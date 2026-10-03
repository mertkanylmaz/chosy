import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';

import { logger } from '@/utils/logger';
import { createConfigStore, parseSnapshot, type ConfigSnapshot } from '@/utils/configStore';

/**
 * `app_config` için TEK kaynak (Sprint 10b).
 *
 * Tek `select key, value` ile beslenir; bellek + AsyncStorage önbelleği, 5 dk
 * TTL. Bayrak okuyucuları (`appConfigFlags.ts`, `gameApi.ts`) ve eşzamanlı
 * `hydrate()` çağrıları aynı isteği paylaşır (tek-uçuş). Bayrak değişikliği
 * EN GEÇ 5 dk'da yansır: bunlar özellik bayraklarıdır, güvenlik bayrağı DEĞİL
 * (yetki sunucuda). Saf mantık: `utils/configStore.ts`.
 *
 * Okuma hatasında ESKİ önbellek kullanılır (stale-while-error); hiç önbellek
 * yoksa okuyucuların kendi varsayılanı geçerlidir. Hata Sentry'ye yazılır,
 * kullanıcıya metin gösterilmez.
 */
const CACHE_KEY = 'remote_config_cache';
const CACHE_TTL_MS = 5 * 60 * 1000;
// ⚠️ `paywall_streak_milestone` + `paywall_roulette_limit` buradan cikarildi
// (olu varyant temizligi, 26 Eyl 2026). `app_config` satirlari DB'de DURUR ama
// artik okunmaz — `profile_upgrade` emsali (bkz. triggerOrchestrator yorumu).
const SAFE_DEFAULTS = {
  use_match_films_v2: true,
  use_hybrid_recommendation: false,
  use_llm_reranker: false,
  paywall_streaming_link: false,
  paywall_profile_upgrade: false,
  paywall_lifetime_soldout: false,
  // D-08 korunuyor: Lifetime kartı paywall'da GÖSTERİLMEZ. Flag yalnız
  // geri dönüş yolunu açık tutar (R-E'de değerlendirilecek).
  paywall_lifetime_enabled: false,
} as const;

type ConfigKey = keyof typeof SAFE_DEFAULTS;

const store = createConfigStore({ ttlMs: CACHE_TTL_MS });

/** Kalıcı önbellek süreç başına BİR kez geri yüklenir (eşzamanlı çağrılar paylaşır). */
let restorePromise: Promise<void> | null = null;

async function restorePersisted(): Promise<void> {
  try {
    const snapshot = parseSnapshot(await AsyncStorage.getItem(CACHE_KEY));
    // Bu arada ağdan taze bir görüntü gelmişse ona dokunma.
    if (snapshot && !store.getSnapshot()) store.setSnapshot(snapshot);
  } catch (err) {
    // Bozuk/okunamayan kalıcı önbellek kullanıcıyı etkilemez (ağdan yüklenir)
    // ama sessiz de geçilmez.
    Sentry.captureException(err, {
      level: 'warning',
      tags: { flow: 'remote_config', step: 'restore_cache' },
    });
  }
}

async function persistSnapshot(snapshot: ConfigSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
  } catch (err) {
    Sentry.captureException(err, {
      level: 'warning',
      tags: { flow: 'remote_config', step: 'persist_cache' },
    });
  }
}

/** Tek ağ isteği — tüm satırlar. Hata Sentry'ye BİR kez yazılır (istek başına). */
async function loadAll(): Promise<Record<string, unknown>> {
  try {
    const { data, error } = await supabase.from('app_config').select('key, value');
    if (error) throw error;
    const values: Record<string, unknown> = {};
    for (const row of data ?? []) values[row.key] = row.value;
    void persistSnapshot({ values, fetchedAt: Date.now() });
    return values;
  } catch (e) {
    logger.error('[remoteConfig] KRITIK: hydrate başarısız', e, {
      code: 'REMOTE_CONFIG_HYDRATE_FAILED',
      extra: { hasCache: store.getSnapshot() !== null },
    });
    throw e;
  }
}

export const remoteConfig = {
  /**
   * Önbellek TTL içindeyse ağa GİTMEZ; değilse tek-uçuş ile yeniler.
   * Hata fırlatmaz (yukarıda raporlanır): çağıran önbellekten/varsayılandan okur.
   */
  async hydrate(): Promise<void> {
    if (!store.getSnapshot()) {
      restorePromise ??= restorePersisted();
      await restorePromise;
    }
    await store.refresh(loadAll);
  },

  get<K extends ConfigKey>(key: K): typeof SAFE_DEFAULTS[K] {
    const cachedVal = store.getSnapshot()?.values?.[key];
    if (cachedVal !== undefined) return cachedVal as typeof SAFE_DEFAULTS[K];
    return SAFE_DEFAULTS[key];
  },

  /**
   * Ham değer — `SAFE_DEFAULTS`'ta olmayan anahtarlar için. Satır yoksa ya da
   * henüz hiç yüklenmediyse `undefined`; varsayılan kararı okuyucunundur.
   */
  getRaw(key: string): unknown {
    return store.getSnapshot()?.values?.[key];
  },
};
