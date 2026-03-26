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

import { supabase } from './supabase';
import { tasteProfileToVector } from './vectorEncoder';

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

/** match_films RPC'nin döndürdüğü satır yapısı */
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
 * - voteAverage < 7.0 && similarity >= 0.5 → 'hidden_gem' (bilinmez ama uyumlu)
 * - Diğerleri → null
 */
function determinePickType(
  similarity: number,
  voteAverage: number | null,
): Film['pick_type'] {
  if (similarity >= 0.8) return 'ai_pick';
  if ((voteAverage ?? 10) < 7.0 && similarity >= 0.5) return 'hidden_gem';
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
  return {
    id: row.id,
    title: row.title,
    year: row.year ?? 0,
    posterUrl: toTmdbUrl(row.poster_url),
    matchScore: Math.min(100, Math.round(Math.max(0, row.similarity) * 100)),
    moodTags: [],
    whyThisFilm: whyFromDimensions(row.dimensions_json, overviewFallback),
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

  // --- Enerji seviyesi & tür eşleşmesi ---
  const highEnergyGenres = ['Aksiyon', 'Gerilim', 'Bilim Kurgu', 'Macera', 'Fantezi', 'Western', 'Savaş'];
  const lowEnergyGenres  = ['Drama', 'Romantik', 'Belgesel', 'Gizem', 'Tarih'];
  if (profile.energy_level >= 0.6 && genres.some((g) => highEnergyGenres.includes(g))) score += 15;
  if (profile.energy_level < 0.4  && genres.some((g) => lowEnergyGenres.includes(g)))  score += 15;

  // --- Duygusal uyum ---
  if (em.joy > 0.5     && genres.some((g) => ['Komedi', 'Animasyon', 'Aile'].includes(g)))             score += 10;
  if (em.sadness > 0.5 && genres.some((g) => ['Drama', 'Romantik'].includes(g)))                       score += 10;
  if (em.fear > 0.5    && genres.some((g) => ['Korku', 'Gerilim'].includes(g)))                        score += 10;
  if (em.surprise > 0.5 && genres.some((g) => ['Gerilim', 'Gizem', 'Bilim Kurgu'].includes(g)))       score +=  8;
  if (em.trust > 0.5   && genres.some((g) => ['Aile', 'Animasyon', 'Belgesel'].includes(g)))           score +=  6;
  if (em.anticipation > 0.5 && genres.some((g) => ['Aksiyon', 'Macera', 'Bilim Kurgu'].includes(g)))  score +=  8;

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
    const overviewLower = film.overview.toLowerCase();
    for (const signal of profile.avoid_signals) {
      if (overviewLower.includes(signal.toLowerCase())) {
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
    whyThisFilm: film.overview ? film.overview.slice(0, 90) + '…' : '',
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
        f.director?.toLowerCase().includes(d.toLowerCase()),
      ),
    );
  }

  return result;
}

/**
 * Supabase films tablosundan tüm filmleri çekip JavaScript tarafında
 * profile göre sıralayarak en iyi `limit` filmi döndürür.
 * Tablo boşsa null döner. RPC hata verdiğinde çağrılır.
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

  if (error || !data || data.length === 0) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[recommendations] films tablosu sorgusu başarısız veya boş:', error?.message);
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
 */
async function getFilmsWithRelaxation(
  vectorString: string,
  limit: number,
  ratingMin: number | null,
  era: { from: number; to: number } | null,
  excludeIds: string[],
): Promise<MatchFilmRow[] | null> {
  const excl = excludeIds.length > 0 ? { exclude_ids: excludeIds } : {};
  const baseRating = ratingMin ?? 6.0;

  // Deneme 1: tam filtreler
  let res = await supabase.rpc('match_films', {
    query_vector: vectorString,
    match_count: limit,
    min_similarity: 0.3,
    min_rating: baseRating,
    ...(era ? { year_from: era.from, year_to: era.to } : {}),
    ...excl,
  });
  if (!res.error && res.data && (res.data as MatchFilmRow[]).length >= 5) {
    return res.data as MatchFilmRow[];
  }

  // Deneme 2: min_rating'i 1 düşür
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[recommendations] Retry #1: filtreler gevşetildi (rating -1)');
  }
  res = await supabase.rpc('match_films', {
    query_vector: vectorString,
    match_count: limit,
    min_similarity: 0.25,
    min_rating: Math.max(0, baseRating - 1),
    ...(era ? { year_from: era.from, year_to: era.to } : {}),
    ...excl,
  });
  if (!res.error && res.data && (res.data as MatchFilmRow[]).length >= 5) {
    return res.data as MatchFilmRow[];
  }

  // Deneme 3: year filtrelerini kaldır
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[recommendations] Retry #2: filtreler gevşetildi (year kaldırıldı)');
  }
  res = await supabase.rpc('match_films', {
    query_vector: vectorString,
    match_count: limit,
    min_similarity: 0.2,
    min_rating: Math.max(0, baseRating - 1),
    ...excl,
  });
  if (!res.error && res.data && (res.data as MatchFilmRow[]).length >= 5) {
    return res.data as MatchFilmRow[];
  }

  // Deneme 4: sadece vektör similarity (min 0.2)
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[recommendations] Retry #3: sadece vektör similarity');
  }
  res = await supabase.rpc('match_films', {
    query_vector: vectorString,
    match_count: limit,
    min_similarity: 0.2,
    ...excl,
  });
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
 * @param profile     - Kullanıcının ayrıştırılmış TasteProfile'ı
 * @param limit       - Kaç film isteniyor
 * @param excludeIds  - Daha önce gösterilen film id'leri
 * @param filters     - İsteğe bağlı ek filtreler (yıl, puan, bölge, yönetmen)
 */
export async function getRecommendations(
  profile: TasteProfile,
  limit = 30,
  excludeIds: string[] = [],
  filters?: FilmFilters,
): Promise<RecommendationResult> {
  // ── Adım 1: TasteProfile logu ────────────────────────────────────────────
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[recommendations] TasteProfile:', JSON.stringify(profile, null, 2));
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
      match_count: limit,
      min_rating: ratingMin ?? 6.0,
      era,
      exclude_ids_count: excludeIds.length,
      query_vector: `[${vector.length} boyut]`,
    }, null, 2));
  }

  // ── Adım 4: Aşamalı filtre gevşetme ile RPC ───────────────────────────────
  const rawResult = await getFilmsWithRelaxation(vectorString, limit, ratingMin, era, excludeIds);
  const data: MatchFilmRow[] = rawResult ?? [];
  const rpcFailed = rawResult === null;

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(
      '[recommendations] relaxation result:',
      rpcFailed ? 'RPC hatası' : `${data.length} film`,
      data[0] ? `| ilk: ${data[0].title} (similarity: ${data[0].similarity})` : '',
    );
  }

  // ── Adım 5: Hata / boş sonuç → JS fallback ───────────────────────────────
  if (rpcFailed || data.length === 0) {
    if (__DEV__) {
      const reason = rpcFailed ? 'RPC hatası' : 'Supabase boş sonuç';
      // eslint-disable-next-line no-console
      console.log(`[recommendations] ${reason} — JS fallback deneniyor`);
    }

    const fallbackFilms = await getFallbackFromSupabase(effectiveProfile, limit, excludeIds, filters);
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
