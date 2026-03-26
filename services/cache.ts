/**
 * Çok katmanlı önbellek servisi.
 *
 * Katmanlar (hızdan yavaşa):
 *   1. MemoryCache  — uygulama içi Map, oturum ömrü
 *   2. StorageCache — AsyncStorage, kalıcı
 *
 * Görsel önbellekleme expo-image tarafından otomatik yapılır;
 * burada yalnızca konfigürasyon sabitleri tutulur.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { FilmFilters, TasteProfile } from '../types';
import { Film } from '../types/film';

// ─── TTL Sabitleri (ms) ───────────────────────────────────────────────────────

/** Film detayları için bellek önbellek süresi: 30 dakika */
export const TTL_FILM_DETAIL = 30 * 60 * 1000;
/** Poster URL'leri için bellek önbellek süresi: 24 saat */
export const TTL_POSTER_URL = 24 * 60 * 60 * 1000;
/** Mood parse sonuçları için bellek önbellek süresi: 10 dakika */
export const TTL_MOOD_PARSE = 10 * 60 * 1000;
/** Feed sonuçları için bellek önbellek süresi: 30 dakika */
export const TTL_FEED = 30 * 60 * 1000;
/** TMDb film detayı için bellek önbellek süresi: 24 saat */
export const TTL_TMDB_DETAIL = 24 * 60 * 60 * 1000;

// ─── AsyncStorage Anahtarları ─────────────────────────────────────────────────

/** AsyncStorage anahtar sabitleri */
export const STORAGE_KEYS = {
  WATCHLIST: 'moodflix_watchlist_cache',
  LAST_FILTERS: 'moodflix_last_filters',
  LANGUAGE: 'moodflix_language',
  RECENT_MOODS: 'moodflix_recent_moods',
} as const;

// ─── Bellek Önbelleği ─────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

/**
 * Uygulama içi bellek önbelleği.
 * Maksimum 500 öğe; dolunca en eski öğe (FIFO) çıkarılır.
 */
class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private readonly MAX_SIZE = 500;

  /**
   * Anahtara karşılık gelen veriyi döner; süresi dolmuşsa null.
   *
   * @param key - Önbellek anahtarı
   * @returns Depolanan veri veya null
   */
  get<T>(key: string): T | null {
    const item = this.store.get(key) as CacheEntry<T> | undefined;
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.store.delete(key);
      return null;
    }
    return item.data;
  }

  /**
   * Veriyi belirtilen TTL süresiyle önbelleğe yazar.
   * Kapasite doluysa en eski öğe silinir (FIFO LRU benzeri).
   *
   * @param key   - Önbellek anahtarı
   * @param data  - Depolanacak veri
   * @param ttlMs - Geçerlilik süresi (milisaniye)
   */
  set<T>(key: string, data: T, ttlMs: number): void {
    if (this.store.size >= this.MAX_SIZE) {
      const firstKey = this.store.keys().next().value;
      if (firstKey !== undefined) {
        this.store.delete(firstKey);
      }
    }
    this.store.set(key, { data, expiry: Date.now() + ttlMs });
  }

  /**
   * Belirtilen anahtarı önbellekten siler.
   *
   * @param key - Silinecek anahtar
   */
  delete(key: string): void {
    this.store.delete(key);
  }

  /**
   * Belirli bir önek ile başlayan tüm anahtarları siler.
   *
   * @param prefix - Silinecek anahtarların öneki
   */
  deleteByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  /** Tüm önbelleği temizler. */
  clear(): void {
    this.store.clear();
  }

  /** Güncel öğe sayısını döner. */
  size(): number {
    return this.store.size;
  }
}

// ─── AsyncStorage Önbelleği ───────────────────────────────────────────────────

/**
 * Kalıcı AsyncStorage önbelleği.
 * Uygulama yeniden başlatılsa da veriler saklanır.
 */
class StorageCache {
  /**
   * AsyncStorage'dan veriyi okur; süresi dolmuşsa null döner ve kaydı siler.
   *
   * @param key - AsyncStorage anahtarı
   * @returns Depolanan veri veya null
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return null;

      const entry = JSON.parse(raw) as CacheEntry<T>;
      if (entry.expiry !== 0 && Date.now() > entry.expiry) {
        await AsyncStorage.removeItem(key);
        return null;
      }
      return entry.data;
    } catch {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn(`[StorageCache] get hatası: ${key}`);
      }
      return null;
    }
  }

  /**
   * Veriyi AsyncStorage'a yazar.
   *
   * @param key     - AsyncStorage anahtarı
   * @param data    - Depolanacak veri
   * @param ttlMs   - Geçerlilik süresi (ms); 0 = süresiz
   */
  async set<T>(key: string, data: T, ttlMs = 0): Promise<void> {
    try {
      const entry: CacheEntry<T> = {
        data,
        expiry: ttlMs > 0 ? Date.now() + ttlMs : 0,
      };
      await AsyncStorage.setItem(key, JSON.stringify(entry));
    } catch {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn(`[StorageCache] set hatası: ${key}`);
      }
    }
  }

  /**
   * Belirtilen anahtarı AsyncStorage'dan siler.
   *
   * @param key - Silinecek anahtar
   */
  async delete(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn(`[StorageCache] delete hatası: ${key}`);
      }
    }
  }
}

// ─── Görsel Önbellek Konfigürasyonu ──────────────────────────────────────────

/**
 * expo-image bileşeni için önbellek politikası sabitleri.
 * Kullanım: `<Image source={url} {...imageCacheConfig.poster} />`
 */
export const imageCacheConfig = {
  /** Film posteri: disk önbellek, yüksek öncelik, 200ms geçiş */
  poster: {
    cachePolicy: 'disk' as const,
    priority: 'high' as const,
    transition: 200,
  },
  /** Arka plan görseli: disk önbellek, düşük öncelik, 300ms geçiş */
  backdrop: {
    cachePolicy: 'disk' as const,
    priority: 'low' as const,
    transition: 300,
  },
} as const;

// ─── Yardımcı Tip Yardımcıları ────────────────────────────────────────────────

/** Feed önbellek anahtarı üretir */
export function feedCacheKey(sessionId: string, page: number): string {
  return `feed:${sessionId}:page${page}`;
}

/** Film detay önbellek anahtarı üretir */
export function filmCacheKey(filmId: string): string {
  return `film:${filmId}`;
}

/** TMDb detay önbellek anahtarı üretir */
export function tmdbCacheKey(tmdbId: number): string {
  return `tmdb:${tmdbId}`;
}

/** Mood parse önbellek anahtarı üretir (ham metinden hash) */
export function moodCacheKey(rawInput: string): string {
  // Basit string hash — collision olasılığı düşük
  let hash = 0;
  for (let i = 0; i < rawInput.length; i++) {
    const char = rawInput.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `mood:${hash}`;
}

// ─── Kalıcı Cache Yardımcı Fonksiyonları ─────────────────────────────────────

/**
 * Son kullanılan filtreleri AsyncStorage'a kaydeder.
 *
 * @param filters - Kaydedilecek filtre nesnesi
 */
export async function saveLastFilters(filters: FilmFilters): Promise<void> {
  await storage.set(STORAGE_KEYS.LAST_FILTERS, filters);
}

/**
 * AsyncStorage'dan son kullanılan filtreleri okur.
 *
 * @returns Kaydedilmiş filtreler veya null
 */
export async function loadLastFilters(): Promise<FilmFilters | null> {
  return storage.get<FilmFilters>(STORAGE_KEYS.LAST_FILTERS);
}

/**
 * Son 3 mood profilini AsyncStorage'a kaydeder.
 *
 * @param profile - Eklenecek yeni mood profili
 */
export async function saveRecentMood(profile: TasteProfile): Promise<void> {
  const existing = (await storage.get<TasteProfile[]>(STORAGE_KEYS.RECENT_MOODS)) ?? [];
  const updated = [profile, ...existing].slice(0, 3);
  await storage.set(STORAGE_KEYS.RECENT_MOODS, updated);
}

/**
 * AsyncStorage'dan son 3 mood profilini okur.
 *
 * @returns Mood profilleri dizisi veya boş dizi
 */
export async function loadRecentMoods(): Promise<TasteProfile[]> {
  return (await storage.get<TasteProfile[]>(STORAGE_KEYS.RECENT_MOODS)) ?? [];
}

/**
 * Watchlist'i AsyncStorage'a kaydeder.
 *
 * @param films - Kaydedilecek film listesi
 */
export async function saveWatchlistCache(films: Film[]): Promise<void> {
  await storage.set(STORAGE_KEYS.WATCHLIST, films);
}

/**
 * AsyncStorage'dan watchlist cache'ini okur.
 *
 * @returns Film listesi veya null
 */
export async function loadWatchlistCache(): Promise<Film[] | null> {
  return storage.get<Film[]>(STORAGE_KEYS.WATCHLIST);
}

// ─── Singleton Export'lar ─────────────────────────────────────────────────────

/** Uygulama genelinde tek bellek önbellek örneği */
export const cache = new MemoryCache();

/** Uygulama genelinde tek kalıcı depo örneği */
export const storage = new StorageCache();
