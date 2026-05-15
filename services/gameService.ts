/**
 * Mini Games Service — Puzzle fetch, score submit, streak tracking.
 *
 * Günlük puzzle'lar Supabase'den çekilir veya runtime'da generate edilir.
 * Sonuçlar AsyncStorage'da cache'lenir (aynı gün tekrar fetch önleme).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './supabase';
import { getAppUserId } from './watchlist';
import { fetchMovieCredits, fetchMovieDetails, searchMovies } from './tmdb';
import type { TmdbCredits } from './tmdb';
import { getQuoteForFilm, getQuotableFilmIds } from '@/constants/movieQuotes';
import { logger } from '@/utils/logger';
import type {
  DailyPuzzle,
  GameResult,
  GameStreakInfo,
  GameClue,
  ImposterOption,
  FilmSearchResult,
} from './gameTypes';

// ─── Cache Keys ──────────────────────────────────────────────────────────────

/** Cache version — artir: eski puzzle cache'leri gecersiz olur */
const CACHE_PREFIX = 'chosy_game_v5_';

/** Eski prefix migrasyon flag'i — bir kez calisir */
const MIGRATION_KEY = 'chosy_game_migration_v5';

/**
 * Eski versiyon cache'lerini temizler (v1-v4).
 * Mevcut prefix (v5) korunur. Bir kez calisir, sonra skip eder.
 */
export async function clearOldGameCaches(): Promise<void> {
  try {
    const migrated = await AsyncStorage.getItem(MIGRATION_KEY);
    if (migrated === 'done') return;

    const allKeys = await AsyncStorage.getAllKeys();
    const oldKeys = allKeys.filter(
      (k) => k.startsWith('chosy_game_') && !k.startsWith(CACHE_PREFIX),
    );
    if (oldKeys.length > 0) {
      await AsyncStorage.multiRemove(oldKeys);
      logger.log(`[gameService] ${oldKeys.length} eski game cache temizlendi`);
    }
    await AsyncStorage.setItem(MIGRATION_KEY, 'done');
  } catch {
    // Cache temizleme hatasi onemsiz
  }
}

/**
 * Tum game cache'lerini siler — debug/reset icin.
 * Normal akista KULLANMA, sadece clearOldGameCaches kullan.
 */
export async function clearAllGameCaches(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const gameKeys = allKeys.filter((k) => k.startsWith('chosy_game_'));
    if (gameKeys.length > 0) {
      await AsyncStorage.multiRemove(gameKeys);
      logger.log(`[gameService] ${gameKeys.length} game cache TAMAMEN temizlendi`);
    }
    // Migration flag'ini de sil ki tekrar calissin
    await AsyncStorage.removeItem(MIGRATION_KEY);
  } catch {
    // Cache temizleme hatasi onemsiz
  }
}

/** Cache key: puzzle verisi */
function puzzleCacheKey(gameType: string, date: string): string {
  return `${CACHE_PREFIX}puzzle_${gameType}_${date}`;
}

/** Cache key: oyun sonucu */
function resultCacheKey(gameType: string, date: string): string {
  return `${CACHE_PREFIX}result_${gameType}_${date}`;
}

/** Cache key: streak */
function streakCacheKey(gameType: string): string {
  return `${CACHE_PREFIX}streak_${gameType}`;
}

// ─── Tarih Yardımcısı ────────────────────────────────────────────────────────

/** Bugünün tarihini YYYY-MM-DD formatında döndürür */
export function getTodayDate(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

// ─── Puzzle Fetch ────────────────────────────────────────────────────────────

/**
 * Günün puzzle'ını getirir. Önce cache kontrol eder,
 * sonra Supabase, bulamazsa runtime generate eder.
 */
export async function fetchDailyPuzzle(
  gameType: string,
  date?: string,
): Promise<DailyPuzzle | null> {
  const targetDate = date ?? getTodayDate();
  logger.log(`[gameService] fetchDailyPuzzle: ${gameType} date=${targetDate}`);

  // 1. Cache kontrol
  try {
    const cacheKey = puzzleCacheKey(gameType, targetDate);
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as DailyPuzzle;
      logger.log(`[gameService] CACHE HIT: ${gameType} filmId=${parsed.filmId} date=${parsed.date} key=${cacheKey}`);
      return parsed;
    }
    logger.log(`[gameService] CACHE MISS: ${cacheKey}`);
  } catch {
    // Cache miss — devam
  }

  // 2. Supabase'den çek
  try {
    const { data, error } = await supabase
      .from('daily_puzzles')
      .select('*')
      .eq('date', targetDate)
      .eq('game_type', gameType)
      .single();

    if (data && !error) {
      logger.log(`[gameService] SUPABASE HIT: ${gameType} filmId=${data.film_id} date=${data.date}`);
      const puzzle: DailyPuzzle = {
        id: data.id,
        date: data.date,
        gameType: data.game_type,
        filmId: data.film_id,
        clues: data.clues as GameClue[],
        maxAttempts: data.max_attempts,
      };
      await cachePuzzle(puzzle);
      return puzzle;
    }
    logger.log(`[gameService] SUPABASE MISS: ${gameType} date=${targetDate} error=${error?.message ?? 'no data'}`);
  } catch (err) {
    logger.error('[gameService] Supabase puzzle fetch hatası:', err);
  }

  // 3. Runtime generate
  try {
    logger.log(`[gameService] Runtime generate: ${gameType} / ${targetDate} / prefix=${CACHE_PREFIX}`);
    const puzzle = await generatePuzzle(gameType, targetDate);
    if (puzzle) {
      logger.log(`[gameService] Puzzle OK: ${gameType} clues=${puzzle.clues.length} film=${puzzle.filmId} type0=${puzzle.clues[0]?.type}`);
      await savePuzzleToSupabase(puzzle);
      await cachePuzzle(puzzle);
      return puzzle;
    }
    logger.warn(`[gameService] Puzzle null: ${gameType}`);
  } catch (err) {
    logger.error('[gameService] Puzzle generation hatası:', err);
  }

  return null;
}

// ─── Puzzle Generation ───────────────────────────────────────────────────────

/**
 * Oyun tipine göre puzzle generate eder.
 * Film seçimi: Supabase films tablosundan random.
 * TMDb credits bir kez çekilip tüm generatorlara aktarılır.
 */
async function generatePuzzle(
  gameType: string,
  date: string,
): Promise<DailyPuzzle | null> {
  // Deterministic seed: tarih + oyun tipi → aynı gün aynı puzzle
  const seed = hashDateGame(date, gameType);

  // Roast özel akış: replik olan filmlerden seç
  if (gameType === 'roast') {
    return generateRoastPuzzle(seed, date);
  }

  // Random film seç (imposter + pinpoint)
  const film = await getRandomFilm(seed);
  if (!film) return null;

  // TMDb'den zengin bilgi çek (credits, detaylar) — tüm oyunlar için
  const [credits, details] = await Promise.all([
    fetchMovieCredits(film.tmdb_id),
    fetchMovieDetails(film.tmdb_id),
  ]);

  // Zengin film bilgisi — TMDb detaylarını DB verisine birleştir
  const richFilm: RichFilmData = {
    ...film,
    cast: credits?.cast ?? [],
    crew: credits?.crew ?? [],
    tagline: ((details as unknown as Record<string, unknown>)?.tagline as string) ?? '',
    voteAverage: details?.vote_average ?? null,
  };

  let clues: GameClue[] = [];
  let maxAttempts = 6;

  switch (gameType) {
    case 'imposter':
      clues = await generateImposterClues(richFilm, seed);
      maxAttempts = 1;
      break;
    case 'pinpoint':
      clues = generatePinpointClues(richFilm, seed);
      maxAttempts = 5;
      break;
    default:
      return null;
  }

  if (clues.length === 0) return null;

  return {
    id: `local_${date}_${gameType}`,
    date,
    gameType,
    filmId: film.tmdb_id,
    clues,
    maxAttempts,
  };
}

// ─── Rich Film Data ─────────────────────────────────────────────────────────

/** FilmRow + TMDb credits/details birleşimi */
interface RichFilmData extends FilmRow {
  cast: Array<{ id: number; name: string; character: string; order: number }>;
  crew: Array<{ id: number; name: string; job: string; department: string }>;
  tagline: string;
  voteAverage: number | null;
}

// ─── Imposter Clue Generation ────────────────────────────────────────────────

/**
 * Imposter oyunu için 4 oyuncu seçer (3 gerçek + 1 sahte).
 * Her seçenek oyuncu adı + karakter adı içerir — kullanıcı filmi öğrenir.
 */
async function generateImposterClues(
  film: RichFilmData,
  seed: number,
): Promise<GameClue[]> {
  if (film.cast.length < 3) return [];

  // İlk 8 cast member'dan 3 tanesini seç
  const topCast = film.cast.slice(0, 8);
  const selected = shuffleWithSeed(topCast, seed).slice(0, 3);

  // Sahte oyuncu: başka bir filmden
  const fakeActor = await findFakeActor(film.tmdb_id, seed);
  if (!fakeActor) return [];

  // 4 seçeneği karıştır — karakter bilgisi ile
  const options: ImposterOption[] = [
    ...selected.map((c) => ({
      id: c.id,
      name: c.name,
      character: c.character || undefined,
      isImposter: false,
    })),
    { id: fakeActor.id, name: fakeActor.name, character: 'Unknown Role', isImposter: true },
  ];

  const shuffled = shuffleWithSeed(options, seed + 1);

  return [
    {
      order: 1,
      type: 'options',
      content: JSON.stringify(shuffled),
    },
  ];
}

/**
 * Sahte oyuncu bulmak için farklı bir filmden cast çeker.
 * Karakter ismi de dahil edilir (merak uyandırıcı).
 */
async function findFakeActor(
  excludeFilmId: number,
  seed: number,
): Promise<{ id: number; name: string } | null> {
  try {
    const { data } = await supabase
      .from('films')
      .select('tmdb_id')
      .neq('tmdb_id', excludeFilmId)
      .limit(20);

    if (!data || data.length === 0) return null;

    const randomFilm = data[seed % data.length];
    const credits = await fetchMovieCredits(randomFilm.tmdb_id);
    if (!credits || credits.cast.length === 0) return null;

    const candidate = credits.cast[seed % Math.min(5, credits.cast.length)];
    return { id: candidate.id, name: candidate.name };
  } catch {
    return null;
  }
}

// ─── Pinpoint Clue Generation ────────────────────────────────────────────────

/**
 * 5 İpucu oyunu: Zordan kolaya, her ipucu filme ilgiyi artırır.
 *
 * Sıra:
 * 1. Yönetmen (en zor — sadece sinefiller bilir)
 * 2. Başrol oyuncu adı (karakter adı YOK — henüz zor)
 * 3. Yayın yılı + IMDb puanı + Genre
 * 4. Ana karakterin adı (karakter ismi — "Jack Dawson")
 * 5. Filmin tek cümlede konusu — spoilersız (en kolay)
 */
function generatePinpointClues(film: RichFilmData, _seed: number): GameClue[] {
  logger.log(`[pinpoint] Generating clues for: ${film.title} (${film.year}) director=${film.director} cast=${film.cast.length}`);
  const clues: GameClue[] = [];
  const genres = film.genres ?? [];
  const year = film.year ?? 0;
  const director = film.director ?? '';
  const overview = film.overview ?? '';
  const cast = film.cast;
  const rating = film.voteAverage;

  // ─── İpucu 1 (en zor): Yönetmen ───
  if (director) {
    clues.push({ order: 1, type: 'text', content: `Directed by ${director}` });
  } else {
    const directorCrew = film.crew.find((c) => c.job === 'Director');
    clues.push({
      order: 1,
      type: 'text',
      content: directorCrew ? `Directed by ${directorCrew.name}` : `A ${genres[0] || 'critically acclaimed'} film`,
    });
  }

  // ─── İpucu 2: Başrol oyuncu adı (karakter adı yok) ───
  if (cast.length > 0) {
    clues.push({ order: 2, type: 'text', content: `Starring ${cast[0].name}` });
  } else {
    clues.push({ order: 2, type: 'text', content: `A ${genres[0] || 'dramatic'} masterpiece` });
  }

  // ─── İpucu 3: Yıl + IMDb puanı + Genre ───
  const genreText = genres.slice(0, 2).join(', ');
  const ratingText = rating ? `⭐ ${rating.toFixed(1)}` : '';
  const parts = [year > 0 ? `${year}` : '', ratingText, genreText].filter(Boolean);
  clues.push({
    order: 3,
    type: 'text',
    content: parts.join(' · ') || 'A modern classic',
  });

  // ─── İpucu 4: Ana karakterin adı ───
  const leadCharacter = cast[0]?.character;
  if (leadCharacter) {
    clues.push({ order: 4, type: 'text', content: `Main character: "${leadCharacter}"` });
  } else if (cast.length > 1) {
    clues.push({ order: 4, type: 'text', content: `Also starring ${cast[1].name}` });
  } else {
    clues.push({ order: 4, type: 'text', content: `Released in ${year}` });
  }

  // ─── İpucu 5 (en kolay): Filmin tek cümlede konusu — spoilersız ───
  const firstSentence = overview.split(/[.!?]/).filter((s) => s.trim().length > 10)[0]?.trim();
  if (firstSentence) {
    clues.push({ order: 5, type: 'text', content: firstSentence });
  } else {
    const castNames = cast.slice(0, 3).map((c) => c.name).join(', ');
    clues.push({ order: 5, type: 'text', content: castNames ? `Starring ${castNames}` : `${year} · ${genreText}` });
  }

  return clues;
}

// ─── Roast (Replik) — Puzzle Generation ──────────────────────────────────────

/**
 * Replik oyunu: Gercek film repliginden filmi tahmin et.
 *
 * Replik kurasyon veritabanindan (movieQuotes.ts) secilir.
 * Film secimi: replik olan filmlerden deterministic random.
 *
 * Clue yapisi:
 *   order 1, type 'quote'  → Replik metni
 *   order 2, type 'hint'   → Repligi soyleyen karakter adi
 *   order 3, type 'hint'   → Basrol oyuncu
 *   order 4, type 'hint'   → Yonetmen + yil
 */
async function generateRoastPuzzle(
  seed: number,
  date: string,
): Promise<DailyPuzzle | null> {
  // Replik olan film ID'lerini al
  const quotableIds = getQuotableFilmIds();
  logger.log(`[roast] Quotable films: ${quotableIds.length}, seed: ${seed}`);
  if (quotableIds.length === 0) return null;

  // Deterministic film sec (replik olan filmlerden)
  const filmTmdbId = quotableIds[seed % quotableIds.length];

  // Replik sec
  const quote = getQuoteForFilm(filmTmdbId, seed);
  logger.log(`[roast] Film: ${filmTmdbId}, Quote: ${quote?.quote?.substring(0, 40) ?? 'NULL'}`);
  if (!quote) return null;

  // TMDb'den zengin bilgi cek
  const [credits, details] = await Promise.all([
    fetchMovieCredits(filmTmdbId),
    fetchMovieDetails(filmTmdbId),
  ]);

  const cast = credits?.cast ?? [];
  const director = credits?.crew?.find((c) => c.job === 'Director')?.name ?? '';
  const year = details?.release_date?.split('-')[0] ?? '';

  // Film DB'de var mi kontrol (getFilmAnswer icin gerekli)
  const { data: filmRow } = await supabase
    .from('films')
    .select('tmdb_id')
    .eq('tmdb_id', filmTmdbId)
    .single();

  if (!filmRow) return null;

  // Clue'lar: replik + 3 ipucu (zordan kolaya)
  const clues: GameClue[] = [
    // Ana replik
    { order: 1, type: 'quote', content: quote.quote },
    // Ipucu 1: Repligi soyleyen karakter
    { order: 2, type: 'hint', content: `Said by: "${quote.character}"` },
    // Ipucu 2: Basrol oyuncu
    {
      order: 3,
      type: 'hint',
      content: cast.length > 0 ? `Starring: ${cast[0].name}` : `Year: ${year}`,
    },
    // Ipucu 3: Yonetmen + yil (en kolay)
    {
      order: 4,
      type: 'hint',
      content: director ? `${year} · Directed by ${director}` : `Released in ${year}`,
    },
  ];

  return {
    id: `local_${date}_roast`,
    date,
    gameType: 'roast',
    filmId: filmTmdbId,
    clues,
    maxAttempts: 4,
  };
}

// ─── Score Submit ────────────────────────────────────────────────────────────

/**
 * Oyun sonucunu Supabase'e ve cache'e kaydeder.
 */
export async function submitGameScore(result: GameResult): Promise<void> {
  // Cache'e kaydet (UI hemen gösterebilsin)
  try {
    await AsyncStorage.setItem(
      resultCacheKey(result.gameType, result.date),
      JSON.stringify(result),
    );
  } catch {
    // Cache hatası önemsiz
  }

  // Supabase'e kaydet
  try {
    const userId = await getAppUserId();
    if (!userId) return;

    // Puzzle ID'si local ise Supabase'de yok — skip
    if (result.puzzleId.startsWith('local_')) {
      await updateLocalStreak(result.gameType, result.solved);
      return;
    }

    await supabase.from('game_scores').upsert({
      user_id: userId,
      puzzle_id: result.puzzleId,
      solved: result.solved,
      attempts: result.attempts,
    });

    await updateLocalStreak(result.gameType, result.solved);
  } catch (err) {
    logger.error('[gameService] Score submit hatası:', err);
  }
}

// ─── Streak ──────────────────────────────────────────────────────────────────

/**
 * Local streak güncelle (AsyncStorage tabanlı — hızlı ve offline-friendly).
 */
async function updateLocalStreak(gameType: string, solved: boolean): Promise<void> {
  try {
    const key = streakCacheKey(gameType);
    const raw = await AsyncStorage.getItem(key);
    const streak: GameStreakInfo = raw
      ? (JSON.parse(raw) as GameStreakInfo)
      : { gameType, currentStreak: 0, longestStreak: 0, totalPlayed: 0, totalSolved: 0 };

    streak.totalPlayed += 1;
    if (solved) {
      streak.totalSolved += 1;
      streak.currentStreak += 1;
      if (streak.currentStreak > streak.longestStreak) {
        streak.longestStreak = streak.currentStreak;
      }
    } else {
      streak.currentStreak = 0;
    }

    await AsyncStorage.setItem(key, JSON.stringify(streak));
  } catch {
    // Streak hatası önemsiz
  }
}

/**
 * Oyun streak bilgisini getirir.
 */
export async function getGameStreak(gameType: string): Promise<GameStreakInfo> {
  try {
    const raw = await AsyncStorage.getItem(streakCacheKey(gameType));
    if (raw) return JSON.parse(raw) as GameStreakInfo;
  } catch {
    // Cache miss
  }
  return {
    gameType,
    currentStreak: 0,
    longestStreak: 0,
    totalPlayed: 0,
    totalSolved: 0,
  };
}

// ─── Cached Result ───────────────────────────────────────────────────────────

/**
 * Bugünün oyun sonucunu cache'den getirir (oynanmış mı kontrolü).
 */
export async function getCachedResult(
  gameType: string,
  date?: string,
): Promise<GameResult | null> {
  try {
    const targetDate = date ?? getTodayDate();
    const key = resultCacheKey(gameType, targetDate);
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as GameResult;
      logger.log(`[gameService] RESULT CACHE HIT: ${gameType} date=${targetDate} filmId=${parsed.filmId} solved=${parsed.solved}`);
      return parsed;
    }
    logger.log(`[gameService] RESULT CACHE MISS: ${gameType} date=${targetDate}`);
  } catch {
    // Cache miss
  }
  return null;
}

// ─── Film Search (Autocomplete) ──────────────────────────────────────────────

/**
 * Film arama — oyunlardaki tahmin input'u için.
 */
export async function searchFilms(query: string): Promise<FilmSearchResult[]> {
  if (!query || query.trim().length < 2) return [];

  try {
    const results = await searchMovies(query.trim());
    return results.map((r) => ({
      id: r.id,
      title: r.title,
      year: r.release_date?.split('-')[0] ?? '',
      posterPath: r.poster_path,
    }));
  } catch {
    return [];
  }
}

// ─── Film Answer ─────────────────────────────────────────────────────────────

/**
 * Puzzle'ın doğru film bilgisini getirir.
 */
export async function getFilmAnswer(filmId: number): Promise<{
  title: string;
  year: number;
  posterPath: string | null;
} | null> {
  try {
    const { data } = await supabase
      .from('films')
      .select('title, year, poster_url')
      .eq('tmdb_id', filmId)
      .single();

    if (data) {
      return {
        title: data.title,
        year: data.year,
        posterPath: data.poster_url,
      };
    }
  } catch {
    // Fallback — TMDb
  }
  return null;
}

// ─── Puzzle Persistence ──────────────────────────────────────────────────────

async function cachePuzzle(puzzle: DailyPuzzle): Promise<void> {
  try {
    await AsyncStorage.setItem(
      puzzleCacheKey(puzzle.gameType, puzzle.date),
      JSON.stringify(puzzle),
    );
  } catch {
    // Cache hatası önemsiz
  }
}

async function savePuzzleToSupabase(puzzle: DailyPuzzle): Promise<void> {
  try {
    await supabase.from('daily_puzzles').upsert(
      {
        date: puzzle.date,
        game_type: puzzle.gameType,
        film_id: puzzle.filmId,
        clues: puzzle.clues,
        max_attempts: puzzle.maxAttempts,
      },
      { onConflict: 'date,game_type' },
    );
  } catch {
    // Supabase hatası — local puzzle ile devam
  }
}

// ─── Film DB ─────────────────────────────────────────────────────────────────

/** Films tablosundan minimum row tipi */
interface FilmRow {
  tmdb_id: number;
  title: string;
  year: number;
  genres: string[];
  director: string | null;
  overview: string;
  runtime: number | null;
  poster_url: string | null;
}

/**
 * Deterministic random film seçimi.
 */
async function getRandomFilm(seed: number): Promise<FilmRow | null> {
  try {
    const { count } = await supabase
      .from('films')
      .select('*', { count: 'exact', head: true });

    if (!count || count === 0) return null;

    const offset = seed % count;
    const { data } = await supabase
      .from('films')
      .select('tmdb_id, title, year, genres, director, overview, runtime, poster_url')
      .order('tmdb_id', { ascending: true })
      .range(offset, offset)
      .single();

    logger.log(`[gameService] getRandomFilm: count=${count} seed=${seed} offset=${offset} film=${(data as FilmRow | null)?.title ?? 'null'} tmdb=${(data as FilmRow | null)?.tmdb_id ?? 'null'}`);
    return data as FilmRow | null;
  } catch {
    return null;
  }
}

// ─── Utility ─────────────────────────────────────────────────────────────────

/** Tarih + oyun tipinden deterministic seed */
function hashDateGame(date: string, gameType: string): number {
  return hashString(`${date}_${gameType}`);
}

/** Basit string hash */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // 32-bit integer
  }
  return Math.abs(hash);
}

/** Deterministic shuffle (Fisher-Yates with seed) */
function shuffleWithSeed<T>(array: T[], seed: number): T[] {
  const arr = [...array];
  let s = seed;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
