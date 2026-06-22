/**
 * Film öneri servisi — pgvector cosine similarity ile Supabase'den sorgular.
 *
 * Öncelik sırası:
 *   1. SQL WHERE ile aday havuzu daraltılır (yıl, puan, ülke, yönetmen, exclude)
 *   2. Daraltılmış havuzda vektör similarity sıralanır (match_films RPC)
 *   3. RPC başarısız olursa JavaScript taraflı fallback devreye girer
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { TasteProfile, FilmFilters } from '../types';
import { Film } from '../types/film';
import { minRatingThreshold, regionsToCulturalContext, yearRangeToEra } from '../utils/filmFilters';

import { getAppUserId } from './auth-utils';
import { getSearchKeywords, consumePendingMoodText, peekPendingMoodText } from './moodSearchState';
import { posthogAnalytics } from './posthog';
import { remoteConfig } from './remoteConfig';
import { supabase } from './supabase';
import { tasteSignals } from './tasteSignalService';
import { getFreshUserVector, calculateBlendWeights } from './userVectorRefresh';
import { tasteProfileToVector } from './vectorEncoder';

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../constants/config';

// ─── Yardımcı: Auth Session Doğrulama ─────────────────────────────────────────

/**
 * mood_searches UPDATE öncesi auth session'ı doğrular ve gerekirse yeniler.
 *
 * Neden gerekli: match_films RPC hem anon hem authenticated role'e GRANT edilmiş.
 * JWT expired/stale ise RPC başarılı olur ama mood_searches UPDATE sessiz fail olur
 * çünkü RLS policy `user_id = auth_user_id()` authenticated context gerektirir.
 * PostgREST, RLS tarafından engellenen UPDATE için hata döndürmez (0 rows affected).
 *
 * Bu fonksiyon session'ı kontrol eder, yoksa refresh dener.
 * Fail durumunda sessiz devam eder — UPDATE RLS'den düşer ama film akışı kesilmez.
 */
async function ensureAuthSession(): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    // getSession() cached session döner — expires_at kontrolü ile proaktif refresh
    const nowSec = Math.floor(Date.now() / 1000);
    const isExpiredOrSoon = !session ||
      (session.expires_at != null && session.expires_at < nowSec + 30);
    if (isExpiredOrSoon) {
      const { error } = await supabase.auth.refreshSession();
      if (__DEV__ && error) {
        // eslint-disable-next-line no-console
        console.warn('[recommendations] Session refresh failed:', error.message);
      }
    }
  } catch {
    // Auth check hatası film akışını engellemez
  }
}

// ─── Yardımcı: Network Hata Tespiti ──────────────────────────────────────────

/**
 * Supabase PostgrestError'un network kaynakli olup olmadigini kontrol eder.
 * Offline, DNS hatasi veya timeout durumlarinda true doner.
 * true ise retry'lar atlanir ve UI'a 'network' hata tipi iletilir (BUG-004).
 */
function isNetworkLikeError(error: { message?: string; code?: string }): boolean {
  const msg = (error.message ?? '').toLowerCase();
  return (
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('timeout') ||
    msg.includes('abort') ||
    msg.includes('dns') ||
    msg.includes('econnrefused') ||
    msg.includes('failed to') ||
    error.code === 'PGRST301' // Supabase connection refused
  );
}

// ─── match_films_v2 rollout ──────────────────────────────────────────────────

/**
 * Lazy getters — her çağrıda remoteConfig.memoryCache'ten okur.
 * Module-level constant evaluation race'i önler (Sprint 2 TASK 2.4 Bug A fix).
 * remoteConfig.hydrate() bu module import'undan SONRA resolve olsa bile
 * flag'in güncel değeri her recommendation call'unda görülür.
 *
 * KURAL: Bu file içinde remoteConfig.get(...) DOĞRUDAN kullanma — bu getter'ları çağır.
 */
const useMatchFilmsV2 = (): boolean => remoteConfig.get('use_match_films_v2');
const useHybridRecommendation = (): boolean => remoteConfig.get('use_hybrid_recommendation');
const useLlmReranker = (): boolean => remoteConfig.get('use_llm_reranker');

/** v2 default configuration */
const V2_CONFIG = {
  per_director_cap: 3,
  tier_boost: false,  // Phase 1: cap only, tier_boost ayrı rollout
} as const;

/** AsyncStorage anahtarı — Profile ekranındaki AI slider değerleri */
const AI_PREFS_KEY = 'chosy_ai_preferences';

/** AI tercih slider yapısı */
interface AIPreferences {
  energy?: number;
  pace?: number;
  depth?: number;
}

/**
 * AsyncStorage'dan AI tercihlerini okur ve profile'a override olarak uygular.
 * vektöre çevrilmeden ÖNCE çağrılmalıdır.
 */
async function applyAIPreferences(profile: TasteProfile): Promise<TasteProfile> {
  try {
    const raw = await AsyncStorage.getItem(AI_PREFS_KEY);
    if (!raw) return profile;

    const aiPrefs: AIPreferences = JSON.parse(raw);
    const updated: TasteProfile = { ...profile };

    if (aiPrefs.energy !== undefined && aiPrefs.energy !== 0.5) {
      updated.energy_level = aiPrefs.energy;
    }
    if (aiPrefs.pace !== undefined && aiPrefs.pace !== 0.5) {
      if (aiPrefs.pace < 0.3) updated.pace_preference = 'slow';
      else if (aiPrefs.pace > 0.7) updated.pace_preference = 'fast';
      else updated.pace_preference = 'medium';
    }
    if (aiPrefs.depth !== undefined && aiPrefs.depth !== 0.5) {
      updated.thematic_depth = aiPrefs.depth;
    }

    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(
        '[recommendations] AI prefs applied:',
        `energy=${updated.energy_level}`,
        `pace=${updated.pace_preference}`,
        `depth=${updated.thematic_depth}`,
      );
    }

    return updated;
  } catch {
    return profile;
  }
}

/** Surprise picks için users tablosundan alınan vektör satırı */
interface UserVectorRow {
  preferences_vector: number[] | null;
  total_interactions: number | null;
}

// ─── Supabase satır tipleri ───────────────────────────────────────────────────

/** match_films / match_films_v2 RPC'nin döndürdüğü satır yapısı */
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
  country: string[] | null;
  similarity: number;
  /** v2 only — 'core' | 'extended' | 'archive' */
  curation_tier?: string | null;
  /** v3 only — tmdb_keywords based match reason */
  match_reason?: string | null;
}

/** films tablosundan select edilen satır yapısı (JS fallback için) */
interface FilmTableRow {
  id: string;
  title: string;
  year: number | null;
  poster_url: string | null;
  backdrop_url: string | null;
  genres: string[] | null;
  overview: string | null;
  runtime: number | null;
  vote_average: number | null;
  director: string | null;
  country: string[] | null;
}

// ─── Pick Type ────────────────────────────────────────────────────────────────

/**
 * Similarity ve oy ortalamasına göre veri tabanlı pick_type belirler.
 * - similarity >= 0.8 → 'ai_pick' (güçlü eşleşme)
 * - voteAverage < 7.0 && similarity >= 0.5 → 'hidden_gem' (niche ama uyumlu)
 * - voteAverage >= 7.5 → asla hidden_gem (populer filmler gem olamaz)
 * - Diğerleri → null
 *
 * Sinema mantigi: Hidden gem = dusuk profilli ama kaliteli film.
 * Top Gun, Avengers gibi 7.5+ oy alan blockbuster'lar gem etiketini almaz.
 */
function determinePickType(
  similarity: number,
  voteAverage: number | null,
): Film['pick_type'] {
  if (similarity >= 0.8) return 'ai_pick';
  const va = voteAverage ?? 10;
  // Sadece dusuk profilli (va < 7.0) ve yeterli eslesmeli filmler gem olabilir
  // Yuksek puanli filmler (>= 7.5) kesinlikle gem degildir
  if (va < 7.0 && va >= 4.0 && similarity >= 0.5) return 'hidden_gem';
  return null;
}

/**
 * Batch'teki genre dağılımını analiz eder; dominant genre'ların dışında
 * kalan filmler 'unexpected' olarak etiketlenir.
 * pick_type zaten set edilmiş filmler atlanır.
 *
 * @param rows  - Orijinal MatchFilmRow dizisi (genre bilgisi için)
 * @param films - rowToFilm ile dönüştürülmüş Film dizisi
 */
function injectUnexpectedTypes(rows: MatchFilmRow[], films: Film[]): Film[] {
  const genreCounts: Record<string, number> = {};
  rows.forEach((r) => {
    (r.genres ?? []).forEach((g) => {
      genreCounts[g] = (genreCounts[g] ?? 0) + 1;
    });
  });

  const topGenres = new Set(
    Object.entries(genreCounts)
      .filter(([, c]) => c > rows.length * 0.25)
      .map(([g]) => g),
  );

  return films.map((film, i) => {
    if (film.pick_type != null) return film;
    const filmGenres = rows[i]?.genres ?? [];
    if (filmGenres.length > 0 && !filmGenres.some((g) => topGenres.has(g))) {
      return { ...film, pick_type: 'unexpected' };
    }
    return film;
  });
}

// ─── Yardımcı fonksiyonlar ────────────────────────────────────────────────────

/**
 * Film profile'ının dimensions_json'undan insan-okunabilir "neden bu film?"
 * metni türetir. Görsel stil, tematik derinlik, tempo ve dominant duygu
 * 2-3 anahtar kelimeyle birleştirilir.
 */
function whyFromDimensions(dims: Record<string, unknown> | null, fallback: string): string {
  if (!dims) return fallback;

  const visual = dims.visual_style as string | undefined;
  const depth = typeof dims.thematic_depth === 'number' ? dims.thematic_depth : undefined;
  const pace = dims.pace as string | undefined;
  const endingTone = dims.ending_tone as string | undefined;
  const emotions = dims.emotional_state as Record<string, number> | undefined;

  const visualMap: Record<string, string> = {
    cinematic: 'cinematic visuals',
    minimalist: 'minimalist aesthetic',
    experimental: 'experimental style',
    lush: 'lush imagery',
    raw: 'raw, gritty atmosphere',
  };
  const endingMap: Record<string, string> = {
    hopeful: 'uplifting ending',
    bittersweet: 'bittersweet resolution',
    open: 'open-ended conclusion',
    tragic: 'tragic depth',
    triumphant: 'triumphant finale',
  };
  const emotionMap: Record<string, string> = {
    joy: 'joyful spirit',
    sadness: 'melancholic tone',
    fear: 'suspenseful tension',
    anger: 'intense passion',
    surprise: 'unexpected twists',
    trust: 'heartfelt warmth',
    anticipation: 'compelling momentum',
  };

  const parts: string[] = [];

  if (visual && visualMap[visual]) parts.push(visualMap[visual]);
  if (depth !== undefined && depth > 0.65) parts.push('deep narrative');
  if (pace === 'slow') parts.push('slow-burn pacing');
  else if (pace === 'fast') parts.push('fast-paced energy');
  if (emotions) {
    const dominant = Object.entries(emotions).sort(([, a], [, b]) => b - a)[0];
    if (dominant && emotionMap[dominant[0]] && dominant[1] > 0.4) {
      parts.push(emotionMap[dominant[0]]);
    }
  }
  if (endingTone && endingMap[endingTone]) parts.push(endingMap[endingTone]);

  if (parts.length === 0) return fallback;
  return `Matches your mood with its ${parts.slice(0, 3).join(', ')}.`;
}

/**
 * Poster/backdrop path'ini tam URL'e dönüştürür.
 * TMDb path ("/abc.jpg") veya tam URL olabilir.
 */
function toTmdbUrl(path: string | null, size = 'w780'): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

/**
 * MatchFilmRow'u UI Film tipine dönüştürür.
 */
function rowToFilm(row: MatchFilmRow): Film {
  const overviewFallback = row.overview ? row.overview.slice(0, 90) + '…' : '';
  // v3 match_reason (tmdb_keywords) takes priority over dimensions-based reason
  const reason = row.match_reason
    ? `Matches your mood: ${row.match_reason}`
    : whyFromDimensions(row.dimensions_json, overviewFallback);
  return {
    id: row.id,
    title: row.title,
    year: row.year ?? 0,
    posterUrl: toTmdbUrl(row.poster_url),
    matchScore: Math.min(100, Math.round(Math.max(0, row.similarity) * 100)),
    moodTags: [],
    whyThisFilm: reason,
    backdropUrl: toTmdbUrl(row.backdrop_url, 'w1280'),
    overview: row.overview ?? '',
    runtime: row.runtime ?? undefined,
    voteAverage: row.vote_average ?? undefined,
    director: row.director ?? undefined,
    dimensions: row.dimensions_json ?? undefined,
    pick_type: determinePickType(row.similarity, row.vote_average),
  };
}

// ─── JS Fallback ──────────────────────────────────────────────────────────────

/**
 * Bir FilmTableRow'u TasteProfile'a göre skorlar.
 * Genre eşleşmesi, duygusal uyum, dönem tercihi, avoid_signals ve
 * oy ortalaması dikkate alınır. Rastgele gürültü eklenerek her
 * çağrıda sıralama değişir.
 */
function scoreFilm(film: FilmTableRow, profile: TasteProfile): number {
  let score = 0;
  const genres = film.genres ?? [];
  const em = profile.emotional_state;

  // --- Enerji seviyesi & tür eşleşmesi (EN + TR her ikisini de kabul eder) ---
  const highEnergyGenres = ['Action', 'Thriller', 'Science Fiction', 'Adventure', 'Fantasy', 'Western', 'War',
                             'Aksiyon', 'Gerilim', 'Bilim Kurgu', 'Macera', 'Fantezi', 'Savaş'];
  const lowEnergyGenres  = ['Drama', 'Romance', 'Documentary', 'Mystery', 'History',
                             'Romantik', 'Belgesel', 'Gizem', 'Tarih'];
  if (profile.energy_level >= 0.6 && genres.some((g) => highEnergyGenres.includes(g))) score += 15;
  if (profile.energy_level < 0.4  && genres.some((g) => lowEnergyGenres.includes(g)))  score += 15;

  // --- Duygusal uyum (EN + TR) ---
  if (em.joy > 0.7     && genres.some((g) => ['Comedy', 'Animation', 'Family', 'Komedi', 'Animasyon', 'Aile'].includes(g)))             score += 18;
  else if (em.joy > 0.5 && genres.some((g) => ['Comedy', 'Animation', 'Family', 'Komedi', 'Animasyon', 'Aile'].includes(g)))            score += 10;
  if (em.sadness > 0.5 && genres.some((g) => ['Drama', 'Romance', 'Romantik'].includes(g)))                                             score += 10;
  if (em.fear > 0.5    && genres.some((g) => ['Horror', 'Thriller', 'Korku', 'Gerilim'].includes(g)))                                   score += 10;
  if (em.surprise > 0.5 && genres.some((g) => ['Thriller', 'Mystery', 'Science Fiction', 'Gerilim', 'Gizem', 'Bilim Kurgu'].includes(g))) score +=  8;
  if (em.trust > 0.5   && genres.some((g) => ['Family', 'Animation', 'Documentary', 'Aile', 'Animasyon', 'Belgesel'].includes(g)))      score +=  6;
  if (em.anticipation > 0.5 && genres.some((g) => ['Action', 'Adventure', 'Science Fiction', 'Aksiyon', 'Macera', 'Bilim Kurgu'].includes(g))) score +=  8;

  // --- Anti-matching: düşük duygu × uyumsuz tür → ceza ---
  // Yüksek joy + düşük fear/anticipation iken Action/Thriller cezası (komedi profili aksiyon almasın)
  if (em.joy > 0.7 && em.fear < 0.2 && em.anticipation < 0.3 &&
      genres.some((g) => ['Action', 'Thriller', 'War', 'Aksiyon', 'Gerilim', 'Savaş'].includes(g))) score -= 20;
  // Düşük joy iken Comedy cezası (korku/aksiyon profili komedi almasın)
  if (em.joy < 0.3 && genres.some((g) => ['Comedy', 'Komedi'].includes(g))) score -= 12;
  // Yüksek fear iken Comedy bonus kaldır (gerilim profili komedi almasın)
  if (em.fear > 0.7 && genres.some((g) => ['Comedy', 'Family', 'Komedi', 'Aile'].includes(g))) score -= 10;

  // --- Dönem tercihi ---
  if (film.year && profile.era_preference) {
    const { from, to } = profile.era_preference;
    if (film.year >= from && film.year <= to) {
      score += 20;
    } else {
      const dist = Math.min(Math.abs(film.year - from), Math.abs(film.year - to));
      score -= Math.min(dist / 5, 15);
    }
  }

  // --- Kaçınma sinyalleri (overview'da anahtar kelime) ---
  if (film.overview && profile.avoid_signals?.length) {
    const overviewLower = film.overview.toLocaleLowerCase('en-US');
    for (const signal of profile.avoid_signals) {
      if (overviewLower.includes(signal.toLocaleLowerCase('en-US'))) {
        score -= 30;
        break;
      }
    }
  }

  // --- Oy ortalaması kalite bonusu (0-10 → 0-12 puan) ---
  if (film.vote_average) score += (film.vote_average / 10) * 12;

  // --- Rastgele gürültü: her çağrıda farklı sıralama ---
  score += (Math.random() - 0.5) * 20;

  return score;
}

/**
 * FilmTableRow + skor çiftini Film tipine dönüştürür.
 */
function scoredRowToFilm(film: FilmTableRow, score: number): Film {
  // score aralığı yaklaşık: -30..75. Görünür matchScore'a normalize et.
  const matchScore = Math.min(99, Math.max(60, Math.round(60 + score * 0.5)));
  return {
    id: film.id,
    title: film.title,
    year: film.year ?? 0,
    posterUrl: toTmdbUrl(film.poster_url),
    matchScore,
    moodTags: film.genres?.slice(0, 3) ?? [],
    whyThisFilm: '',  // overview türkçe olabilir — film/[id].tsx'te TMDB'den EN çekilir
    backdropUrl: toTmdbUrl(film.backdrop_url, 'w1280'),
    overview: film.overview ?? '',
    runtime: film.runtime ?? undefined,
    voteAverage: film.vote_average ?? undefined,
  };
}

/**
 * FilmTableRow dizisine FilmFilters uygular (JS tarafı post-fetch filtreleme).
 * RPC başarısız olduğunda fallback yolunda kullanılır.
 */
function applyFilters(rows: FilmTableRow[], filters?: FilmFilters): FilmTableRow[] {
  if (!filters) return rows;
  let result = rows;

  if (filters.yearRange) {
    const era = yearRangeToEra(filters.yearRange);
    result = result.filter((f) => {
      const y = f.year ?? 0;
      return y >= era.from && y <= era.to;
    });
  }

  const ratingMin = minRatingThreshold(filters.minRating);
  if (ratingMin !== null) {
    result = result.filter((f) => (f.vote_average ?? 0) >= ratingMin);
  }

  if (filters.regions?.length) {
    const isoCodes = regionsToCulturalContext(filters.regions);
    result = result.filter((f) =>
      (f.country ?? []).some((c) => isoCodes.includes(c)),
    );
  }

  if (filters.directors?.length) {
    result = result.filter((f) =>
      filters.directors.some((d) =>
        f.director?.toLocaleLowerCase('en-US').includes(d.toLocaleLowerCase('en-US')),
      ),
    );
  }

  return result;
}

/**
 * Supabase films tablosundan tüm filmleri çekip JavaScript tarafında
 * profile göre sıralayarak en iyi `limit` filmi döndürür.
 * Tablo boşsa null döner. RPC hata verdiğinde çağrılır.
 *
 * Network hatasi varsa throw eder — cagiran taraf 'network' ErrorType alir.
 */
async function getFallbackFromSupabase(
  profile: TasteProfile,
  limit: number,
  excludeIds: string[] = [],
  filters?: FilmFilters,
): Promise<Film[] | null> {
  const { data, error } = await supabase
    .from('films')
    .select('id, title, year, poster_url, backdrop_url, genres, overview, runtime, vote_average, director, country');

  if (error) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[recommendations] films tablosu sorgusu hatasi:', error.message);
    }
    // Network/Supabase hatasi → throw et, UI "No connection" gostersin
    // (Bos veri ile network hatasini ayirt etmek icin — BUG-004)
    throw new TypeError(`Network request failed: ${error.message}`);
  }

  if (!data || data.length === 0) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[recommendations] films tablosu bos');
    }
    return null;
  }

  const rows = applyFilters(
    (data as FilmTableRow[]).filter((f) => !excludeIds.includes(f.id)),
    filters,
  );

  const scored = rows
    .map((f) => ({ film: f, score: scoreFilm(f, profile) }))
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(({ film, score }) => scoredRowToFilm(film, score));
}

/**
 * Supabase'den gelen vektörü güvenli şekilde number[] dizisine çevirir.
 * String, number[] veya null/undefined olabilir.
 */
function parseVector(raw: unknown): number[] | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch { return null; }
  }
  return null;
}

// ─── RPC Helpers ─────────────────────────────────────────────────────────────

/**
 * match_films_v2 RPC'yi çağırır. Hata verirse null döner (caller fallback yapar).
 */
async function callMatchFilmsV2(
  vectorString: string,
  limit: number,
  minSimilarity: number,
  minRating: number | null,
  era: { from: number; to: number } | null,
  excludeIds: string[],
): Promise<{ data: MatchFilmRow[] | null; error: { message: string; code?: string } | null }> {
  const excl = excludeIds.length > 0 ? { exclude_ids: excludeIds } : {};
  return supabase.rpc('match_films_v2', {
    query_vector: vectorString,
    match_count: limit,
    min_similarity: minSimilarity,
    ...(minRating != null ? { min_rating: minRating } : {}),
    ...(era ? { year_from: era.from, year_to: era.to } : {}),
    ...excl,
    per_director_cap: V2_CONFIG.per_director_cap,
    tier_boost: V2_CONFIG.tier_boost,
  });
}

/**
 * match_films_v3 RPC'yi çağırır. Hybrid mood + user vector recommendation.
 * user_vector NULL gönderilebilir (mood-only fallback davranışı).
 */
async function callMatchFilmsV3(
  vectorString: string,
  userVectorString: string | null,
  moodWeight: number,
  userWeight: number,
  limit: number,
  minSimilarity: number,
  minRating: number | null,
  era: { from: number; to: number } | null,
  excludeIds: string[],
  searchKeywords?: string[],
): Promise<{ data: MatchFilmRow[] | null; error: { message: string; code?: string } | null }> {
  const excl = excludeIds.length > 0 ? { exclude_ids: excludeIds } : {};
  const kwParam = searchKeywords && searchKeywords.length > 0
    ? { search_keywords: searchKeywords }
    : {};
  return supabase.rpc('match_films_v3', {
    query_vector: vectorString,
    user_vector: userVectorString,  // NULL olabilir
    mood_weight: moodWeight,
    user_weight: userWeight,
    match_count: limit,
    min_similarity: minSimilarity,
    ...(minRating != null ? { min_rating: minRating } : {}),
    ...(era ? { year_from: era.from, year_to: era.to } : {}),
    ...excl,
    ...kwParam,
    per_director_cap: 1,  // v3: max 1 per director for diversity
    tier_boost: V2_CONFIG.tier_boost,
  });
}

/**
 * match_films v1 RPC'yi çağırır.
 */
async function callMatchFilmsV1(
  vectorString: string,
  limit: number,
  minSimilarity: number,
  minRating: number | null,
  era: { from: number; to: number } | null,
  excludeIds: string[],
): Promise<{ data: MatchFilmRow[] | null; error: { message: string; code?: string } | null }> {
  const excl = excludeIds.length > 0 ? { exclude_ids: excludeIds } : {};
  return supabase.rpc('match_films', {
    query_vector: vectorString,
    match_count: limit,
    min_similarity: minSimilarity,
    ...(minRating != null ? { min_rating: minRating } : {}),
    ...(era ? { year_from: era.from, year_to: era.to } : {}),
    ...excl,
  });
}

/**
 * v2 veya v1 RPC'yi feature flag'e göre çağırır.
 * v2 hata verirse otomatik v1'e döner (graceful fallback).
 */
async function callMatchFilms(
  vectorString: string,
  limit: number,
  minSimilarity: number,
  minRating: number | null,
  era: { from: number; to: number } | null,
  excludeIds: string[],
  userVectorString?: string | null,
  moodWeight?: number,
  userWeight?: number,
  searchKeywords?: string[],
): Promise<{ data: MatchFilmRow[] | null; error: { message: string; code?: string } | null }> {
  // v3 hybrid recommendation (Sprint 2 TASK 2.4)
  if (useHybridRecommendation()) {
    const v3Res = await callMatchFilmsV3(
      vectorString,
      userVectorString ?? null,
      moodWeight ?? 1.0,
      userWeight ?? 0.0,
      limit,
      minSimilarity,
      minRating,
      era,
      excludeIds,
      searchKeywords,
    );
    if (v3Res.error) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log('[recommendations] v3 failed, falling back to v2:', v3Res.error.message);
      }
      if (isNetworkLikeError(v3Res.error)) {
        throw new TypeError(`Network request failed: ${v3Res.error.message}`);
      }
      // v3 fail → v2'ye düş (graceful fallback chain)
    } else {
      return v3Res;
    }
  }

  if (useMatchFilmsV2()) {
    const v2Res = await callMatchFilmsV2(vectorString, limit, minSimilarity, minRating, era, excludeIds);
    if (v2Res.error) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log('[recommendations] v2 failed, falling back to v1:', v2Res.error.message);
      }
      // Network hatasi → throw (BUG-004 — retry'ları atla)
      if (isNetworkLikeError(v2Res.error)) {
        throw new TypeError(`Network request failed: ${v2Res.error.message}`);
      }
      return callMatchFilmsV1(vectorString, limit, minSimilarity, minRating, era, excludeIds);
    }
    return v2Res;
  }
  return callMatchFilmsV1(vectorString, limit, minSimilarity, minRating, era, excludeIds);
}

// ─── LLM Re-ranker ──────────────────────────────────────────────────────────

/** Rerank edge function response shape */
interface RerankResponse {
  reranked_ids: string[];
  original_count: number;
  reranked_count: number;
  fallback?: boolean;
}

/**
 * LLM re-ranker edge function'i cagirarak vektor sonuclarini
 * tematik uygunluga gore yeniden siralar.
 *
 * "thailand trip" gibi tematik mood girdilerinde vektor uzayinin
 * yakalayamadigi kavramsal anlami LLM ile doldurur.
 *
 * Hata durumunda null doner — caller orijinal siralamaya doner.
 *
 * @param moodText   - Kullanicinin orijinal mood metni
 * @param candidates - match_films_v3'ten gelen film satirlari
 * @param count      - Kac film isteniyor (rerank sonrasi)
 */
async function callRerankFilms(
  moodText: string,
  candidates: MatchFilmRow[],
  count: number,
): Promise<RerankResponse | null> {
  // Token freshness — tasteParser.ts ile ayni pattern
  let { data: { session } } = await supabase.auth.getSession();
  const nowSec = Math.floor(Date.now() / 1000);
  const isExpiredOrSoon = !session ||
    (session.expires_at != null && session.expires_at < nowSec + 30);

  if (isExpiredOrSoon) {
    const refreshResult = await supabase.auth.refreshSession();
    session = refreshResult.data.session;
    if (!session) {
      const retry = await supabase.auth.getSession();
      session = retry.data.session;
    }
  }
  const token = session?.access_token ?? SUPABASE_ANON_KEY;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8_000); // 8s timeout

  try {
    const body = {
      mood_text: moodText,
      candidates: candidates.map((c) => ({
        id: c.id,
        title: c.title,
        overview: (c.overview ?? '').slice(0, 150),
        genres: c.genres,
        year: c.year,
        similarity: c.similarity,
      })),
      count,
    };

    const res = await fetch(`${SUPABASE_URL}/functions/v1/rerank-films`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.error('[recommendations] rerank-films HTTP error:', res.status);
      }
      return null;
    }

    const data: RerankResponse = await res.json();
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('[recommendations] rerank-films call failed:', err instanceof Error ? err.message : err);
    }
    return null;
  }
}

/**
 * match_films_v3 sonuclarini LLM rerank ID sirasina gore yeniden siralar.
 * Rerank listesinde olmayan filmler sona eklenir (kaybolmaz).
 */
function reorderByRerankedIds(rows: MatchFilmRow[], rerankedIds: string[]): MatchFilmRow[] {
  const idToRow = new Map(rows.map((r) => [r.id, r]));
  const result: MatchFilmRow[] = [];
  const usedIds = new Set<string>();

  // Rerank sirasina gore ekle
  for (const id of rerankedIds) {
    const row = idToRow.get(id);
    if (row) {
      result.push(row);
      usedIds.add(id);
    }
  }

  // Rerank'ta olmayanlari orijinal sirada sona ekle
  for (const row of rows) {
    if (!usedIds.has(row.id)) {
      result.push(row);
    }
  }

  return result;
}

// ─── Progressive Filter Relaxation ───────────────────────────────────────────

/**
 * match_films RPC'yi 4 aşamalı filtre gevşetme ile çalıştırır.
 *
 * Deneme 1: tam filtreler (yıl + puan)
 * Deneme 2: puan -1 (yıl korunur)
 * Deneme 3: puan -1 + yıl filtresi kaldırıldı
 * Deneme 4: sadece vektör similarity (min 0.2)
 *
 * ≥5 film gelince o denemedeki sonuç döndürülür.
 * Tüm denemeler boş kalırsa son denemenin sonucu (boş dizi veya null) döner.
 *
 * Uses v2 (per-director cap + NULL exclusion) when useMatchFilmsV2() is true,
 * with automatic fallback to v1 on error.
 */
async function getFilmsWithRelaxation(
  vectorString: string,
  limit: number,
  ratingMin: number | null,
  era: { from: number; to: number } | null,
  excludeIds: string[],
  userVectorString?: string | null,
  moodWeight?: number,
  userWeight?: number,
  searchKeywords?: string[],
): Promise<MatchFilmRow[] | null> {
  const baseRating = ratingMin ?? 6.0;

  // Deneme 1: tam filtreler
  let res = await callMatchFilms(vectorString, limit, 0.3, baseRating, era, excludeIds, userVectorString, moodWeight, userWeight, searchKeywords);

  // Ilk RPC'de network hatasi → diger denemeleri atlayip hemen throw et (BUG-004)
  if (res.error && isNetworkLikeError(res.error)) {
    throw new TypeError(`Network request failed: ${res.error.message}`);
  }

  if (!res.error && res.data && (res.data as MatchFilmRow[]).length >= 5) {
    return res.data as MatchFilmRow[];
  }

  // Deneme 2: min_rating'i 1 düşür
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[recommendations] Retry #1: filtreler gevşetildi (rating -1)');
  }
  res = await callMatchFilms(vectorString, limit, 0.25, Math.max(0, baseRating - 1), era, excludeIds, userVectorString, moodWeight, userWeight, searchKeywords);
  if (!res.error && res.data && (res.data as MatchFilmRow[]).length >= 5) {
    return res.data as MatchFilmRow[];
  }

  // Deneme 3: year filtrelerini kaldır
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[recommendations] Retry #2: filtreler gevşetildi (year kaldırıldı)');
  }
  res = await callMatchFilms(vectorString, limit, 0.2, Math.max(0, baseRating - 1), null, excludeIds, userVectorString, moodWeight, userWeight, searchKeywords);
  if (!res.error && res.data && (res.data as MatchFilmRow[]).length >= 5) {
    return res.data as MatchFilmRow[];
  }

  // Deneme 4: sadece vektör similarity (min 0.2)
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[recommendations] Retry #3: sadece vektör similarity');
  }
  res = await callMatchFilms(vectorString, limit, 0.2, null, null, excludeIds, userVectorString, moodWeight, userWeight, searchKeywords);
  if (res.error) return null;
  return (res.data as MatchFilmRow[]) ?? [];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Kaynağı ayırt etmek için getRecommendations'ın döndürdüğü yapı */
export interface RecommendationResult {
  films: Film[];
  source: 'supabase' | 'fallback';
}

/**
 * Verilen TasteProfile'a en yakın filmleri Supabase pgvector ile sorgular.
 *
 * Öncelik:
 *   1. SQL WHERE koşullarıyla aday havuzu daraltılır (match_films RPC parametreleri)
 *   2. Daraltılmış havuzda vektör similarity sıralaması çalışır
 *   3. RPC başarısız olursa JS fallback devreye girer
 *
 * Sprint 1 v4.0: searchId parametresi ile mood_searches tablosu
 * recommended_film_ids ve rpc_version ile guncellenir (fire-and-forget).
 *
 * @param profile     - Kullanıcının ayrıştırılmış TasteProfile'ı
 * @param limit       - Kaç film isteniyor
 * @param excludeIds  - Daha önce gösterilen film id'leri
 * @param filters     - İsteğe bağlı ek filtreler (yıl, puan, bölge, yönetmen)
 * @param searchId    - parse-mood edge function'dan donen mood_searches row ID
 * @param isFirstBatch - Ilk batch mi? LLM reranker sadece ilk batch'te calisir
 */
export async function getRecommendations(
  profile: TasteProfile,
  limit = 30,
  excludeIds: string[] = [],
  filters?: FilmFilters,
  searchId?: string | null,
  isFirstBatch = false,
): Promise<RecommendationResult> {
  // ── DEBUG: koşulsuz entry telemetri — searchId gerçekten geliyor mu? ────
  posthogAnalytics.track('mood_search_debug_entry', {
    receivedSearchId: searchId ?? null,
    type: typeof searchId,
    isNull: searchId === null,
    isUndefined: searchId === undefined,
    isFalsy: !searchId,
  });

  // ── Adım 1: TasteProfile logu ────────────────────────────────────────────
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[recommendations] TasteProfile:', JSON.stringify(profile, null, 2));
  }

  // ── Adım 1.5: User vector + dynamic blend (Sprint 2 TASK 2.4) ────────
  let userVectorString: string | null = null;
  let moodWeight = 1.0;
  let userWeight = 0.0;

  if (useHybridRecommendation()) {
    try {
      const userId = await getAppUserId();
      if (userId) {
        const { vector: userVector, signalCount } = await getFreshUserVector(userId);
        const weights = calculateBlendWeights(signalCount);
        moodWeight = weights.moodWeight;
        userWeight = weights.userWeight;
        if (userVector && userWeight > 0) {
          userVectorString = `[${userVector.join(',')}]`;
        } else if (!userVector && userWeight > 0) {
          // Defensive: signal count threshold'a ulasti (userWeight > 0)
          // ama Edge Function henuz recompute etmedi (userVector null).
          // RPC'ye yaniltici user_weight gonderme + version log
          // "v3_cold_start" olarak dogru etiketlensin.
          // Sprint 3: JS <-> Edge Function threshold senkron (her ikisi 6).
          // Defensive guard her durumda race condition siperi.
          moodWeight = 1.0;
          userWeight = 0.0;
        }
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.log('[recommendations] Hybrid mode:', JSON.stringify({
            signalCount,
            moodWeight,
            userWeight,
            hasUserVector: !!userVectorString,
          }));
        }
      }
    } catch (err) {
      // User vector fetch fail → mood-only fallback (sessiz değil, log)
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[recommendations] User vector fetch failed, mood-only:', err);
      }
    }
  }

  // ── Adım 2: AI prefs override + Vektör oluştur ───────────────────────────
  const effectiveProfile = await applyAIPreferences(profile);
  const vector = tasteProfileToVector(effectiveProfile);

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(
      `[recommendations] query_vector boyutu: ${vector.length}`,
      '| ilk 5 değer:', vector.slice(0, 5),
      '| NaN var mı:', vector.some(Number.isNaN),
      '| tüm sıfır mı:', vector.every((v) => v === 0),
    );
  }

  // ── Adım 3: SQL filtre parametrelerini hazırla ────────────────────────────
  const era       = filters?.yearRange ? yearRangeToEra(filters.yearRange) : null;
  const ratingMin = filters ? minRatingThreshold(filters.minRating) : null;

  // pgvector string formatı: '[0.1,0.2,...]'
  const vectorString = `[${vector.join(',')}]`;

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[recommendations] match_films params:', JSON.stringify({
      version: useHybridRecommendation()
        ? (userWeight > 0 ? 'v3_hybrid' : 'v3_cold_start')
        : (useMatchFilmsV2() ? 'v2' : 'v1'),
      ...(useHybridRecommendation() ? {
        mood_weight: moodWeight,
        user_weight: userWeight,
        has_user_vector: !!userVectorString,
      } : {}),
      match_count: limit,
      min_rating: ratingMin ?? 6.0,
      era,
      exclude_ids_count: excludeIds.length,
      query_vector: `[${vector.length} boyut]`,
      ...(useMatchFilmsV2() ? { per_director_cap: V2_CONFIG.per_director_cap, tier_boost: V2_CONFIG.tier_boost } : {}),
    }, null, 2));
  }

  // ── Adım 3.5: Tematik keyword'leri module-level store'dan oku ────────────
  const searchKeywords = getSearchKeywords();
  if (searchKeywords.length > 0) {
    posthogAnalytics.track('keyword_boost_active', {
      search_keywords: searchKeywords.join(', '),
      keyword_count: searchKeywords.length,
    });
  }

  // ── Adım 4: Aşamalı filtre gevşetme ile RPC ───────────────────────────────
  const rawResult = await getFilmsWithRelaxation(
    vectorString, limit, ratingMin, era, excludeIds,
    userVectorString, moodWeight, userWeight, searchKeywords,
  );
  let data: MatchFilmRow[] = rawResult ?? [];
  const rpcFailed = rawResult === null;

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(
      '[recommendations] relaxation result:',
      rpcFailed ? 'RPC hatası' : `${data.length} film`,
      data[0] ? `| ilk: ${data[0].title} (similarity: ${data[0].similarity})` : '',
    );
  }

  // ── Adım 4.5: LLM Re-ranker (sadece ilk batch + flag aktif) ──────────────

  // Diagnostic: tum kosullari logla — hangi kosul false dondugunu tespit et
  const rerankFlag = useLlmReranker();
  const peekedMoodText = peekPendingMoodText();
  if (isFirstBatch) {
    posthogAnalytics.track('reranker_condition_check', {
      rpcFailed,
      dataLength: data.length,
      isFirstBatch,
      useLlmReranker: rerankFlag,
      hasSearchKeywords: searchKeywords.length > 0,
      searchKeywordsCount: searchKeywords.length,
      hasMoodText: peekedMoodText !== null,
      moodTextLength: peekedMoodText?.length ?? 0,
      allConditionsMet: !rpcFailed && data.length > 0 && rerankFlag && searchKeywords.length > 0 && peekedMoodText !== null,
    });
  }

  if (
    !rpcFailed &&
    data.length > 0 &&
    isFirstBatch &&
    rerankFlag &&
    searchKeywords.length > 0
  ) {
    const moodText = consumePendingMoodText();
    if (moodText) {
      const rerankStart = Date.now();
      const rerankResult = await callRerankFilms(moodText, data, limit);

      if (rerankResult && !rerankResult.fallback && rerankResult.reranked_ids.length > 0) {
        data = reorderByRerankedIds(data, rerankResult.reranked_ids);

        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.log(
            '[recommendations] LLM rerank applied:',
            `${rerankResult.reranked_count}/${rerankResult.original_count} films reranked`,
            `| ${Date.now() - rerankStart}ms`,
            `| ilk: ${data[0]?.title}`,
          );
        }

        posthogAnalytics.track('llm_rerank_applied', {
          original_count: rerankResult.original_count,
          reranked_count: rerankResult.reranked_count,
          latency_ms: Date.now() - rerankStart,
          mood_text_length: moodText.length,
          keyword_count: searchKeywords.length,
        });
      } else {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.log('[recommendations] LLM rerank skipped (fallback or empty)');
        }
        posthogAnalytics.track('llm_rerank_fallback', {
          had_result: !!rerankResult,
          was_fallback: rerankResult?.fallback ?? false,
          latency_ms: Date.now() - rerankStart,
        });
      }
    } else {
      // moodText null — setPendingMoodText cagirilmamis veya consume edilmis
      posthogAnalytics.track('llm_rerank_mood_text_null', {
        searchKeywordsCount: searchKeywords.length,
        isFirstBatch,
      });
    }
  }

  // ── Adım 5: Hata / boş sonuç → JS fallback ───────────────────────────────
  if (rpcFailed || data.length === 0) {
    const reason = rpcFailed ? 'RPC_FAILED' : 'EMPTY_RESULT';
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(`[recommendations] ${reason} — JS fallback deneniyor`);
    }

    // Sentry breadcrumb — production'da RPC fail path'i izle (Sprint 3 #3)
    try {
      const Sentry = await import('@sentry/react-native');
      Sentry.addBreadcrumb({
        category: 'recommendations',
        message: `RPC fallback: ${reason}`,
        level: 'warning',
        data: {
          version: useHybridRecommendation()
            ? (userWeight > 0 ? 'v3_hybrid' : 'v3_cold_start')
            : (useMatchFilmsV2() ? 'v2' : 'v1'),
          moodWeight,
          userWeight,
          hasUserVector: !!userVectorString,
          dataLength: data.length,
        },
      });
    } catch {
      // Sentry unavailable — devam et
    }

    const fallbackFilms = await getFallbackFromSupabase(effectiveProfile, limit, excludeIds, filters);

    // Sprint 2 fix: fallback path'te de observability garantisi.
    // rpc_version: hangi flag aktifti, error_code: neden fallback'e düştük.
    if (searchId) {
      const rpcVersion = useHybridRecommendation()
        ? (userWeight > 0 ? 'match_films_v3' : 'match_films_v3_cold_start')
        : useMatchFilmsV2() ? 'match_films_v2' : 'match_films';
      const errorCode = rpcFailed ? 'RPC_FAILED' : 'EMPTY_RESULT';
      await ensureAuthSession();
      const { data: fbUpdateData, error: fbUpdateError } = await supabase
        .from('mood_searches')
        .update({
          rpc_version: rpcVersion,
          recommended_film_ids: fallbackFilms?.map((f) => f.id) ?? [],
          error_code: errorCode,
        })
        .eq('id', searchId)
        .select('id');

      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log('[recommendations] mood_searches fallback update:',
          fbUpdateError ? `ERROR: ${fbUpdateError.message}` : `rows=${fbUpdateData?.length ?? 0}`,
          '| searchId:', searchId);
      }
    }

    if (fallbackFilms) return { films: fallbackFilms, source: 'fallback' };

    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[recommendations] films tablosu da boş — öneri listesi boş döndürülüyor');
    }
    return { films: [], source: 'fallback' };
  }

  // ── Adım 6: Başarılı — SQL zaten filtredi, dönüştür + unexpected inject ──
  const rawFilms = data.map(rowToFilm);
  const films = injectUnexpectedTypes(data, rawFilms);

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(
      `[recommendations] Supabase'den ${films.length} film geldi:`,
      films.slice(0, 3).map((f) => `${f.title} (%${f.matchScore}) pick=${f.pick_type ?? '-'}`),
    );
  }

  if (searchId) {
    const rpcVersion = useHybridRecommendation()
        ? (userWeight > 0 ? 'match_films_v3' : 'match_films_v3_cold_start')
        : useMatchFilmsV2() ? 'match_films_v2' : 'match_films';
    // FIX: match_films RPC anon role'de de çalışır ama UPDATE authenticated gerektirir.
    // JWT stale/expired ise RPC başarılı olur, UPDATE sessiz fail olur (0 rows).
    // Session refresh yaparak auth.uid()'nin RLS policy'de doğru çözümlenmesini garanti et.
    await ensureAuthSession();

    // ── DEBUG: session durumunu UPDATE ÖNCESİ logla ───────────────────────
    const { data: { session: preSession } } = await supabase.auth.getSession();
    const preSessionInfo = {
      hasSession: !!preSession,
      expiresAt: preSession?.expires_at ?? null,
      nowSec: Math.floor(Date.now() / 1000),
      isExpired: preSession?.expires_at != null
        ? preSession.expires_at < Math.floor(Date.now() / 1000)
        : null,
      authUid: preSession?.user?.id ?? null,
    };

    const { data: updateData, error: updateError } = await supabase
      .from('mood_searches')
      .update({
        recommended_film_ids: films.map((f) => f.id),
        rpc_version: rpcVersion,
      })
      .eq('id', searchId)
      .select('id');

    const rowsAffected = updateData?.length ?? 0;

    // ── DEBUG: PostHog event — production silent failure telemetri ────────
    posthogAnalytics.track('mood_search_update_debug', {
      hasSearchId: true,
      searchId,
      hasSession: preSessionInfo.hasSession,
      isExpired: preSessionInfo.isExpired,
      authUid: preSessionInfo.authUid,
      expiresAt: preSessionInfo.expiresAt,
      nowSec: preSessionInfo.nowSec,
      updateError: updateError?.message ?? null,
      updateErrorCode: updateError?.code ?? null,
      rowsAffected,
      rpcVersion,
      filmCount: films.length,
    });

    if (__DEV__) {
      const rowCount = updateData?.length ?? 0;
      // eslint-disable-next-line no-console
      console.log('[recommendations] mood_searches update:',
        updateError ? `ERROR: ${updateError.message}` : `rows=${rowCount}`,
        '| searchId:', searchId,
        '| rpcVersion:', rpcVersion,
        '| session:', JSON.stringify(preSessionInfo));
      if (rowCount === 0 && !updateError) {
        // eslint-disable-next-line no-console
        console.warn('[recommendations] UPDATE 0 rows — RLS auth_user_id() mismatch or row not found');
      }
    }

    // Sprint 2 TASK 2.1.G4: mood_search_completed signal
    tasteSignals.recordMoodSearchCompleted(searchId).catch(() => {});
  }

  return { films, source: 'supabase' };
}

/**
 * Kullanıcının birikmiş preferences_vector'ünü kullanarak kişisel zevk bazlı
 * film önerileri getirir. Mood'dan bağımsız "seni tanıyorum" önerileri.
 *
 * Soğuk başlangıç koruması: preferences_vector NULL ise null döner.
 * 30+ film görüntülenince feed'de mood önerilerinin yerini alır.
 *
 * @param userId     - users tablosundaki dahili UUID
 * @param limit      - Kaç film isteniyor
 * @param excludeIds - Daha önce gösterilen film id'leri
 * @returns RecommendationResult veya null (soğuk başlangıç)
 */
export async function getSurprisePicks(
  userId: string,
  limit = 10,
  excludeIds: string[] = [],
): Promise<RecommendationResult | null> {
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('preferences_vector, total_interactions')
    .eq('id', userId)
    .single();

  if (userError || !user) return null;

  const typedUser = user as unknown as UserVectorRow;

  const userVector = parseVector(typedUser.preferences_vector);
  if (!userVector || userVector.length === 0) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[recommendations] getSurprisePicks: geçerli vektör yok, boş dönüyor');
    }
    return null;
  }

  const vectorString = `[${userVector.join(',')}]`;

  const params: Record<string, unknown> = {
    query_vector: vectorString,
    match_count: limit,
    ...(excludeIds.length > 0 ? { exclude_ids: excludeIds } : {}),
  };

  const { data, error: rpcError } = await supabase.rpc('match_films', params);

  if (rpcError || !data || (data as MatchFilmRow[]).length === 0) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[recommendations] getSurprisePicks RPC hatası veya boş sonuç:', rpcError?.message);
    }
    return null;
  }

  return {
    films: (data as MatchFilmRow[]).map(rowToFilm),
    source: 'supabase',
  };
}
