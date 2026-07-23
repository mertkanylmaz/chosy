/**
 * Daily Match Servisi — Günlük kişiselleştirilmiş film önerisi.
 *
 * Strateji:
 *   1. AsyncStorage'da bugüne ait öneri ara (gün başına 1 hesaplama)
 *   2. Cache miss → TasteProfile → 384-dim vektör → match_films RPC
 *   3. Watchlist film ID'leri exclude_ids olarak geçilir (görülmüşler çıkarılır)
 *   4. İlk sonuç döndürülür ve bugün için önbelleğe alınır
 *
 * Kural: match_films RPC overload'u OLUŞTURMA — sadece mevcut imzayla çalış.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './supabase';
import { tasteProfileToVector } from './vectorEncoder';
import { logger } from '../utils/logger';

import type { Film } from '../types/film';
import type { TasteProfile } from '../types/index';

// ─── Sabitler ─────────────────────────────────────────────────────────────────

/** AsyncStorage önbellek anahtar ön eki */
const CACHE_PREFIX = 'daily_match_v1_';

// ─── Yardımcı tipler ──────────────────────────────────────────────────────────

/** AsyncStorage'da saklanan öneri yapısı */
interface CachedDailyMatch {
  film: Film;
  cachedAt: string;
}

/**
 * match_films RPC'nin döndürdüğü satır yapısı.
 * recommendations.ts ile aynı — ortak tip dosyasına taşınabilir (gelecek refactor).
 */
interface MatchFilmRow {
  id: string;
  tmdb_id: number;
  title: string;
  year: number;
  poster_url: string | null;
  backdrop_url: string | null;
  genres: string[] | null;
  dimensions_json: Record<string, unknown> | null;
  overview: string | null;
  runtime: number | null;
  vote_average: number | null;
  director: string | null;
  similarity: number;
}

// ─── Yardımcı fonksiyonlar ────────────────────────────────────────────────────

/**
 * Bugünün tarih anahtarını döndürür: `YYYY-MM-DD`.
 * Saat dilimi farkı önemsiz — gün bitiminde cache kendiliğinden geçersiz olur.
 */
function todayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Kullanıcıya özel bugünkü önbellek anahtarı.
 *
 * @param userId - users tablosundaki dahili UUID
 */
function cacheKey(userId: string): string {
  return `${CACHE_PREFIX}${userId}_${todayString()}`;
}

/**
 * MatchFilmRow'u uygulama içi Film tipine dönüştürür.
 */
/** TMDb görseli için tam URL oluşturur */
function toTmdbUrl(path: string | null, size = 'w500'): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

function rowToFilm(row: MatchFilmRow): Film {
  return {
    id: row.id,
    title: row.title,
    year: row.year,
    posterUrl: toTmdbUrl(row.poster_url),
    backdropUrl: row.backdrop_url ? toTmdbUrl(row.backdrop_url, 'w1280') : undefined,
    overview: row.overview ?? undefined,
    runtime: row.runtime ?? undefined,
    voteAverage: row.vote_average ?? undefined,
    director: row.director ?? undefined,
    matchScore: Math.round(row.similarity * 100),
    moodTags: row.genres?.slice(0, 3) ?? [],
    whyThisFilm: '',
    dimensions: row.dimensions_json ?? undefined,
  };
}

// ─── Yardımcı: Ham Vektör Parse ───────────────────────────────────────────────

/** users.preferences_vector satır yapısı */
interface UserPreferencesRow {
  preferences_vector: unknown;
}

/**
 * Supabase'den gelen ham vektör değerini number[] tipine çevirir.
 * Değer zaten dizi ise doğrudan döner; string ise JSON.parse ile açar.
 *
 * @param raw - Supabase'den gelen preferences_vector
 * @returns number[] veya null (parse edilemezse / boşsa)
 */
function parseRawVector(raw: unknown): number[] | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw as number[];
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as number[];
    } catch {
      return null;
    }
  }
  return null;
}

// ─── İç Yardımcı: RPC Çağrısı ────────────────────────────────────────────────

/**
 * match_films RPC'sini çağırır ve ilk sonucu Film olarak döner.
 * Cache okuma/yazma sorumluluğu çağırana aittir.
 *
 * @param vectorString - pgvector formatında string: "[0.1, 0.2, ...]"
 * @param seenFilmIds  - Hariç tutulacak film ID'leri
 * @returns İlk eşleşen Film veya null
 */
async function fetchBestMatch(
  vectorString: string,
  seenFilmIds: string[],
): Promise<Film | null> {
  const rpcParams: Record<string, unknown> = {
    query_vector: vectorString,
    match_count: 5,
  };

  if (seenFilmIds.length > 0) {
    rpcParams.exclude_ids = seenFilmIds;
  }

  const { data, error } = await supabase.rpc('match_films', rpcParams);

  if (error) {
    logger.error('[dailyMatch] RPC hatası:', error.message);
    return null;
  }

  const rows = data as MatchFilmRow[] | null;
  if (!rows || rows.length === 0) return null;

  return rowToFilm(rows[0]);
}

// ─── Cache Invalidation ─────────────────────────────────────────────────────────

/**
 * Daily Pick cache'ini temizler — retake quiz / kalibrasyon sonrasi cagirilir.
 *
 * Hem mood-based hem preferences-based cache anahtarlarini siler.
 * Ayni gun icinde bile yeni archetype'a uygun film onerisi uretilmesini saglar.
 *
 * @param userId - users tablosundaki dahili UUID
 */
export async function clearDailyPickCache(userId: string): Promise<void> {
  const today = todayString();
  const keys = [
    `${CACHE_PREFIX}${userId}_${today}`,
    `${CACHE_PREFIX}${userId}_${today}_pref`,
  ];
  try {
    await AsyncStorage.multiRemove(keys);
    logger.log('[dailyMatch] cache temizlendi (retake/calibration):', keys.join(', '));
  } catch (err) {
    logger.error('[dailyMatch] cache temizleme hatasi:', err);
  }
}

// ─── Ana Fonksiyon ─────────────────────────────────────────────────────────────

/**
 * Kullanıcının günlük kişiselleştirilmiş film önerisini döndürür.
 *
 * Aynı kullanıcı + aynı gün = her zaman aynı öneri (cache). Gece yarısından
 * sonraki ilk çağrıda yeni bir film hesaplanır.
 *
 * @param userId       - users tablosundaki dahili UUID
 * @param tasteProfile - Kullanıcının son tat profili; null ise null döner
 * @param seenFilmIds  - Daha önce izlenen/kaydedilen film ID'leri (hariç tutulur)
 * @returns Film nesnesi veya null (profil yoksa / RPC başarısızsa)
 *
 * @example
 * const pick = await getDailyMatch(userId, lastProfile, watchlistIds);
 * // => Film { title: 'Blade Runner 2049', matchScore: 87, ... }
 */
export async function getDailyMatch(
  userId: string,
  tasteProfile: TasteProfile | null,
  seenFilmIds: string[],
): Promise<Film | null> {
  if (!tasteProfile) return null;

  const key = cacheKey(userId);

  // ── 1. Cache kontrolü ──────────────────────────────────────────────────────
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const parsed: CachedDailyMatch = JSON.parse(raw) as CachedDailyMatch;
      logger.log('[dailyMatch] cache hit:', parsed.film.title);
      return parsed.film;
    }
  } catch (err) {
    logger.error('[dailyMatch] cache okuma hatasi:', err);
    // Cache hatası match hesaplamayı engellemesin
  }

  // ── 2. Vektör hesapla ──────────────────────────────────────────────────────
  const vector = tasteProfileToVector(tasteProfile);
  const vectorString = `[${vector.join(',')}]`;

  // ── 3. match_films RPC — görülmüş filmler hariç ───────────────────────────
  try {
    const film = await fetchBestMatch(vectorString, seenFilmIds);

    if (!film) {
      logger.log('[dailyMatch] RPC sonucu bos — profil yeterince gelismemis olabilir');
      return null;
    }

    // ── 4. Bugün için önbelleğe al ─────────────────────────────────────────
    try {
      const toCache: CachedDailyMatch = {
        film,
        cachedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(key, JSON.stringify(toCache));
    } catch (err) {
      logger.error('[dailyMatch] cache yazma hatasi:', err);
      // Yazma hatası kritik değil — film yine de döner
    }

    logger.log('[dailyMatch] yeni oneri hesaplandi:', film.title, `(${film.matchScore}%)`);
    return film;
  } catch (err) {
    logger.error('[dailyMatch] beklenmedik hata:', err);
    return null;
  }
}

// ─── Sinefil Profili Tabanlı Öneri ────────────────────────────────────────────

/**
 * Kullanıcının DB'deki `preferences_vector`'ünü kullanarak günlük film önerisi üretir.
 *
 * Bu path "sinefil kimliği" sinyaline dayanır: swipe davranışları + onboarding
 * kalibrasyonunun birikimli ortalaması. Anlık ruh halinden bağımsızdır.
 *
 * Öncelik sırası (index.tsx'te):
 *   1. getDailyMatchByPreferences — sinefil birikimi (bu fonksiyon)
 *   2. getDailyMatch(lastProfile) — son mood session
 *   3. getDailyMatch(archetypeProfile) — cold-start fallback
 *
 * @param userId      - users tablosundaki dahili UUID
 * @param seenFilmIds - Watchlist'teki film ID'leri (hariç tutulur)
 * @returns Film veya null (preferences_vector yoksa / RPC başarısızsa)
 */
export async function getDailyMatchByPreferences(
  userId: string,
  seenFilmIds: string[],
): Promise<Film | null> {
  const key = `${CACHE_PREFIX}${userId}_${todayString()}_pref`;

  // ── 1. Cache kontrolü ──────────────────────────────────────────────────────
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const parsed: CachedDailyMatch = JSON.parse(raw) as CachedDailyMatch;
      logger.log('[dailyMatch] sinefil cache hit:', parsed.film.title);
      return parsed.film;
    }
  } catch (err) {
    logger.error('[dailyMatch] sinefil cache okuma hatası:', err);
  }

  // ── 2. preferences_vector DB'den çek ──────────────────────────────────────
  try {
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('preferences_vector')
      .eq('id', userId)
      .single();

    if (userError) {
      logger.error('[dailyMatch] preferences_vector okuma hatası:', userError.message);
      return null;
    }

    const vector = parseRawVector((userData as UserPreferencesRow | null)?.preferences_vector);
    if (!vector) {
      logger.log('[dailyMatch] preferences_vector yok — sinefil daily pick atlandı');
      return null;
    }

    const vectorString = `[${vector.join(',')}]`;

    // ── 3. match_films RPC ──────────────────────────────────────────────────
    const film = await fetchBestMatch(vectorString, seenFilmIds);
    if (!film) {
      logger.log('[dailyMatch] sinefil RPC sonucu boş');
      return null;
    }

    // ── 4. Bugün için önbelleğe al ─────────────────────────────────────────
    try {
      const toCache: CachedDailyMatch = { film, cachedAt: new Date().toISOString() };
      await AsyncStorage.setItem(key, JSON.stringify(toCache));
    } catch (err) {
      logger.error('[dailyMatch] sinefil cache yazma hatası:', err);
    }

    logger.log('[dailyMatch] sinefil profili önerisi:', film.title, `(${film.matchScore}%)`);
    return film;
  } catch (err) {
    logger.error('[dailyMatch] getDailyMatchByPreferences beklenmedik hata:', err);
    return null;
  }
}
