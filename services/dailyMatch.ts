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
function rowToFilm(row: MatchFilmRow): Film {
  return {
    id: row.id,
    title: row.title,
    year: row.year,
    posterUrl: row.poster_url ?? '',
    backdropUrl: row.backdrop_url ?? undefined,
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
    const rpcParams: Record<string, unknown> = {
      query_vector: vectorString,
      match_count: 5,
    };

    if (seenFilmIds.length > 0) {
      rpcParams.exclude_ids = seenFilmIds;
    }

    const { data, error } = await supabase.rpc('match_films', rpcParams);

    if (error) {
      logger.error('[dailyMatch] RPC hatasi:', error.message);
      return null;
    }

    const rows = data as MatchFilmRow[] | null;
    if (!rows || rows.length === 0) {
      logger.log('[dailyMatch] RPC sonucu bos — profil yeterince gelismemis olabilir');
      return null;
    }

    const film = rowToFilm(rows[0]);

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
