/**
 * Gauntlet önbelleği — günün cevabının yerel kopyası (K-42 Parça 2).
 *
 * ── Neden var ──────────────────────────────────────────────────────────────
 * K-42 keşfi: offline'da `generate-gauntlet` yanıtı hiç gelmiyor, ekran
 * doğrudan hata durumuna düşüyor ve kullanıcı günün ritüelini AÇAMIYOR.
 * Bu modül son başarılı yanıtı saklar ki bağlantı yokken ekran boş kalmasın.
 *
 * ── Sözleşmeye dokunulmaz ──────────────────────────────────────────────────
 * `types/gauntlet.ts` KİLİTLİ. `DailyGauntlet`'e "cache'ten geldi" alanı
 * EKLENMEZ; bunun yerine burada tanımlı `CachedGauntlet` sarmalayıcısı
 * kaynağı taşır. Sunucudan gelen nesne olduğu gibi saklanır.
 *
 * ── Kimlik sorunu (ölçülmüş) ───────────────────────────────────────────────
 * `readAppUserId()` `supabase.auth.getUser()` + `users` sorgusu yapar, yani
 * AĞ İSTER. Offline'da null döner — tam da cache'e ihtiyaç duyduğumuz anda
 * anahtarı kuramayız. Bu yüzden yazma anında (online iken) kullanıcı kimliği
 * ayrı bir İŞARETÇİ anahtarında saklanır; offline okuma onu kullanır.
 *
 * ── Tarih ──────────────────────────────────────────────────────────────────
 * Yazarken `DailyGauntlet.date` (SUNUCUNUN cycle tarihi) anahtara girer.
 * "Bu kopya mevcut cycle'ın mı" kararı cihaz tarihine DEĞİL, kopyanın
 * taşıdığı `next_cycle_at`'e bakar (`gauntletCacheRules.cacheSourceFor`):
 * geçiş anı geçmişse ya da alan yoksa kopya "bugünün değil" sayılır. Bilinçli
 * olarak İYİMSER DEĞİL.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '@/utils/logger';

import { cacheSourceFor, type GauntletSource } from './gauntletCacheRules';
import type { CycleGauntlet } from './gauntletService';

export type { GauntletSource };

// ─── Anahtarlar ──────────────────────────────────────────────────────────────

const CACHE_PREFIX = 'chosy_gauntlet_cache_';

/**
 * Son yazılan kaydın işaretçisi: `{ userId, date }`.
 * Offline'da kimlik okunamadığı için hangi anahtarın okunacağını bu söyler.
 */
const POINTER_KEY = 'chosy_gauntlet_cache_last';

function cacheKey(userId: string, date: string): string {
  return `${CACHE_PREFIX}${userId}_${date}`;
}

// ─── Tipler ──────────────────────────────────────────────────────────────────

/** Diskteki kayıt şekli. `gauntlet` sunucudan geldiği gibi saklanır. */
interface CacheEntry {
  gauntlet: CycleGauntlet;
  /** Sunucunun bildirdiği gün (`DailyGauntlet.date`). */
  date: string;
  /** Yazılma anı (ISO 8601) — hangi kaydın daha yeni olduğunu belirler. */
  cachedAt: string;
}

interface PointerEntry {
  userId: string;
  date: string;
}

/** Okuma sonucu. Çağıran `source`'a bakarak UI kararını verir. */
export interface CachedGauntlet {
  gauntlet: CycleGauntlet;
  source: 'cache_today' | 'cache_stale';
  /** Kaydın ait olduğu gün — `cache_stale` durumunda kullanıcıya gösterilir. */
  date: string;
}

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

async function readPointer(): Promise<PointerEntry | null> {
  const raw = await AsyncStorage.getItem(POINTER_KEY);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as PointerEntry;
  if (!parsed.userId || !parsed.date) return null;
  return parsed;
}

// ─── Yazma ───────────────────────────────────────────────────────────────────

/**
 * Başarılı bir `generate-gauntlet` yanıtını diske yazar.
 *
 * Hata YUTULMAZ ama çağıranı DÜŞÜRMEZ: cache yazımı başarısız olsa da
 * kullanıcı ağdan gelen gauntlet'i görmelidir. Başarısızlık loglanır.
 */
export async function cacheGauntlet(
  userId: string,
  gauntlet: CycleGauntlet,
): Promise<void> {
  try {
    const entry: CacheEntry = {
      gauntlet,
      date: gauntlet.date,
      cachedAt: new Date().toISOString(),
    };
    const pointer: PointerEntry = { userId, date: gauntlet.date };

    await AsyncStorage.setItem(cacheKey(userId, gauntlet.date), JSON.stringify(entry));
    await AsyncStorage.setItem(POINTER_KEY, JSON.stringify(pointer));
  } catch (err) {
    logger.error(
      '[gauntletCache] Cache yazımı başarısız:', err,
      {
        code: 'GAUNTLET_CACHE_WRITE_FAILED',
        sampleRate: 0.2,
      },
    );
  }
}

// ─── Okuma ───────────────────────────────────────────────────────────────────

/**
 * Son yazılan kaydı okur (işaretçi). Kaynak `next_cycle_at`'e göre etiketlenir:
 *   1. Geçiş anı gelecekte → `cache_today`
 *   2. Geçmiş ya da alan yok → `cache_stale`
 *   3. Kayıt yoksa → `null` (çağıran mevcut hata ekranına düşer)
 *
 * @param userId Biliniyorsa geçilir; `null` ise işaretçideki kimlik kullanılır
 *               (offline yol — kimlik sorgusu ağ ister).
 */
export async function readCachedGauntlet(
  userId: string | null,
): Promise<CachedGauntlet | null> {
  try {
    const pointer = await readPointer();
    const effectiveUserId = userId ?? pointer?.userId ?? null;

    if (!effectiveUserId || !pointer) {
      // Ne kimlik var ne işaretçi — hiç başarılı yanıt alınmamış demektir.
      return null;
    }

    // Kimlik biliniyor ve işaretçi BAŞKA kullanıcıyı gösteriyorsa, o kaydı
    // gösterme. Cihaz el değiştirmiş veya kimlik sıfırlanmış olabilir
    // (bkz. utils/identityReset.ts) — başkasının gauntlet'i sızmamalı.
    if (userId && pointer.userId !== userId) {
      logger.warn('[gauntletCache] İşaretçi başka kullanıcıya ait, cache atlandı');
      return null;
    }

    const raw = await AsyncStorage.getItem(cacheKey(pointer.userId, pointer.date));
    if (!raw) return null;

    const entry = JSON.parse(raw) as CacheEntry;
    return {
      gauntlet: entry.gauntlet,
      source: cacheSourceFor(entry.gauntlet.next_cycle_at, new Date()),
      date: entry.date,
    };
  } catch (err) {
    logger.error(
      '[gauntletCache] Cache okuması başarısız:', err,
      {
        code: 'GAUNTLET_CACHE_READ_FAILED',
        sampleRate: 0.2,
      },
    );
    return null;
  }
}

/**
 * Aktif gauntlet'in cycle tarihi (`DailyGauntlet.date`, sunucu hesaplar) —
 * son başarılı yanıtın işaretçisinden, AĞSIZ. Spotlight bulmaca anahtarının
 * (rota parametresi yoksa) ve ask kararının TEK kaynağı: yerel takvim gününden
 * türetilmez. Kayıt yoksa ya da okunamazsa `null`; çağıran görünür hata verir.
 */
export async function readCachedCycleDate(): Promise<string | null> {
  try {
    const pointer = await readPointer();
    return pointer?.date ?? null;
  } catch (err) {
    logger.error(
      '[gauntletCache] Cycle tarihi okunamadı:', err,
      {
        code: 'GAUNTLET_CACHE_READ_FAILED',
        sampleRate: 0.2,
      },
    );
    return null;
  }
}

/**
 * Kullanıcının tüm gauntlet cache kayıtlarını ve işaretçisini siler.
 * Kimlik sıfırlaması gibi "bu cihaz artık başka biri" durumları içindir.
 */
export async function clearGauntletCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter((k) => k.startsWith(CACHE_PREFIX));
    if (mine.length > 0) {
      await AsyncStorage.multiRemove(mine);
    }
  } catch (err) {
    logger.error(
      '[gauntletCache] Cache temizliği başarısız:', err,
      {
        code: 'GAUNTLET_CACHE_CLEAR_FAILED',
        sampleRate: 0.2,
      },
    );
  }
}
