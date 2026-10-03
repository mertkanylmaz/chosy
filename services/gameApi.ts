/**
 * Game API Service — Edge Function tabanlı oyun çağrılarının TEK KAYNAĞI.
 *
 * CineMetrics ve gelecekteki sunucu-doğrulamalı oyunlar bu modülü kullanır.
 * Her çağrı ensureAuthSession() ile sarılıdır.
 * Hata → Sentry + throw (sessiz fallback YASAK).
 */

import * as Sentry from '@sentry/react-native';

import { supabase } from './supabase';
import { ensureAuthSession } from './authSession';
import { remoteConfig } from './remoteConfig';
import { logger } from '@/utils/logger';
import { isNoPuzzleResponse, PuzzleUnavailableError } from '@/utils/puzzleAvailability';

import type {
  DailyChallenge,
  DailyChestState,
  DailyThemeState,
  DetectiveGuessResult,
  GuessResult,
  HintRevealResult,
  ImposterGuessResult,
  SpotlightGuessResult,
  SpotlightLetterResult,
} from '@/types/game';

// ─── API Functions ───────────────────────────────────────────────────────────

/**
 * Hub'da gosterilecek oyun listesi (app_config: games_enabled).
 *
 * Sprint 10b: `remoteConfig` tek kaynağından (5 dk TTL) okunur, ayrı istek yok.
 * Okuma basarisiz olursa hata `remoteConfig`'te Sentry'ye duser; eski onbellek
 * varsa o kullanilir, yoksa null doner ve cagiran taraf varsayilan listeyi
 * gosterir (sessiz fallback degil, loglanan bilincli davranis).
 */
export async function getEnabledGames(): Promise<string[] | null> {
  await remoteConfig.hydrate();
  const games = (remoteConfig.getRaw('games_enabled') as { games?: string[] } | null | undefined)?.games;
  return Array.isArray(games) ? games : null;
}

/**
 * Watchlist Roulette acik mi (app_config: games_enabled → `roulette`).
 *
 * C.6 (PRODUCT_OS §7.4): Roulette/Slot gauntlet'i kanibalize ediyor —
 * "bugun ne izlesem" sorusuna ikinci bir cevap veriyor. Kod SILINMEZ
 * (app/roulette.tsx, components/Roulette/* duruyor), erisim yolu kapatilir.
 *
 * Ayri bir app_config anahtari acilmadi: ayni satirin yanindaki alan okunur,
 * `games` dizisine DOKUNULMAZ. Gerekce — generate-puzzles yalnizca `.games`
 * uzerinde donuyor; Roulette'in bulmaca ureteci yok, o diziye yazilsaydi her
 * calismada hatali uretim denemesi olurdu.
 *
 * Alan YOKSA sonuc `false`. Bu sessiz fallback degil, yazili varsayilan:
 * C.6 sonrasi dogru durum kapali olmak. Okuma HATASI ayri bir yol —
 * Sentry'ye duser ve yine kapali doner (fail-closed).
 *
 * Sprint 10b: `remoteConfig` tek kaynağından (5 dk TTL) okunur. Okuma hatasi
 * `remoteConfig`'te Sentry'ye duser; onbellek yoksa kapali doner (fail-closed).
 */
export async function isRouletteEnabled(): Promise<boolean> {
  await remoteConfig.hydrate();
  const value = remoteConfig.getRaw('games_enabled') as { roulette?: boolean } | null | undefined;
  return value?.roulette === true;
}

/** Cinema DNA rank yapilandirmasi (app_config: dna_config) */
export interface DnaRankConfig {
  /** Rank basina gereken DNA ortalamasi — index 0 = rank 1 */
  rankThresholds: number[];
  /** Rank basina gereken tamamlanmis gunluk sayisi */
  rankMinDailies: number[];
}

/**
 * Rank esiklerini app_config'ten okur.
 *
 * Sprint 10b: `remoteConfig` tek kaynağından (5 dk TTL) okunur. Okuma hatasi
 * `remoteConfig`'te Sentry'ye duser; onbellek yoksa null doner ve cagiran taraf
 * ilerleme cubugunu gizler (uydurma esik gostermez).
 */
export async function getDnaConfig(): Promise<DnaRankConfig | null> {
  await remoteConfig.hydrate();
  const value = remoteConfig.getRaw('dna_config') as {
    rank_thresholds?: number[];
    rank_min_dailies?: number[];
  } | null | undefined;

  if (!Array.isArray(value?.rank_thresholds) || !Array.isArray(value?.rank_min_dailies)) {
    const shapeError = new Error('dna_config missing rank_thresholds/rank_min_dailies');
    Sentry.captureException(shapeError, { tags: { config: 'dna_config' } });
    logger.error('[gameApi] getDnaConfig shape invalid', { skipBridge: true });
    return null;
  }

  return {
    rankThresholds: value.rank_thresholds,
    rankMinDailies: value.rank_min_dailies,
  };
}

/**
 * Gunluk sandigin durumu (ve istege bagli olarak odul talebi).
 *
 * Tamamlama sayimi, tekillik ve odul yazimi SUNUCUDA — istemci yalnizca
 * gosterir. claim=true yalnizca kullanici sandiga dokundugunda gonderilir.
 *
 * @param puzzleDate - YYYY-MM-DD
 * @param claim - true ise odul talep edilir (tek sefer uygulanir)
 */
export async function getDailyChest(
  puzzleDate: string,
  claim = false,
): Promise<DailyChestState> {
  await ensureAuthSession();

  const { data, error } = await supabase.functions.invoke('get-daily-chest', {
    body: { puzzle_date: puzzleDate, claim },
  });

  if (error) {
    Sentry.captureException(error, { tags: { puzzle_date: puzzleDate, claim: String(claim) } });
    logger.error('[gameApi] getDailyChest failed:', error, { skipBridge: true });
    throw error;
  }

  return data as DailyChestState;
}

/**
 * Bu oturumda NO_PUZZLE uyarısı zaten gönderilmiş (oyun, gün) çiftleri.
 * Telemetri tekilleştirmesidir, config değil (`services/tmdb.ts`
 * `reportedTmdbEndpoints` deseni): kart, ask koordinatörü ve oyun ekranı aynı
 * gün aynı yokluğu ayrı ayrı okur; her biri ayrı olay üretseydi tek durum
 * Sentry'de fırtınaya dönerdi. Sunucu tarafı ayrıca kuyruk derinliği uyarısı
 * verir (P-1c D, sabit fingerprint).
 */
const reportedUnavailable = new Set<string>();

function reportPuzzleUnavailableOnce(gameId: string, puzzleDate: string): void {
  const key = `${gameId}:${puzzleDate}`;
  if (reportedUnavailable.has(key)) {
    Sentry.addBreadcrumb({
      category: 'games.puzzle_unavailable',
      message: `${gameId} bulmacası yok (tekrar)`,
      level: 'info',
      data: { game_id: gameId, puzzle_date: puzzleDate },
    });
    return;
  }
  reportedUnavailable.add(key);
  Sentry.captureMessage(`Günlük bulmaca yok: ${gameId}`, {
    level: 'warning',
    tags: { game_id: gameId, error_code: 'NO_PUZZLE' },
    extra: { puzzle_date: puzzleDate },
    fingerprint: ['client-no-puzzle', gameId],
  });
}

/**
 * `FunctionsHttpError.context` ham Response'tur (gövde okunmamış). Gövde
 * okunamazsa NO_PUZZLE SAYILMAZ — gerçek hata yoluna düşer (yanlış negatif,
 * sessiz yanlış pozitiften iyidir). `clone()` gövdeyi tüketmez.
 */
async function isNoPuzzleError(error: unknown): Promise<boolean> {
  const response = (error as { context?: Response }).context;
  if (!response || typeof response.clone !== 'function' || response.status !== 404) {
    return false;
  }
  try {
    const body: unknown = await response.clone().json();
    return isNoPuzzleResponse(response.status, body);
  } catch (parseErr) {
    Sentry.addBreadcrumb({
      category: 'games.puzzle_unavailable',
      message: 'get-daily-challenge 404 gövdesi okunamadı — genel hata yolu',
      level: 'warning',
      data: { error: parseErr instanceof Error ? parseErr.message : String(parseErr) },
    });
    return false;
  }
}

/**
 * Günlük bulmacayı getirir.
 *
 * Bulmaca yoksa (`404 NO_PUZZLE`) `PuzzleUnavailableError` fırlatır — Sentry'ye
 * (oyun, gün) başına tek `warning`. Diğer hatalar Sentry + throw.
 *
 * @param gameId - Oyun tipi (ör. 'cinemetrics')
 * @param puzzleDate - YYYY-MM-DD formatında tarih
 */
export async function getDailyChallenge(
  gameId: string,
  puzzleDate: string,
): Promise<DailyChallenge> {
  await ensureAuthSession();

  const { data, error } = await supabase.functions.invoke('get-daily-challenge', {
    body: { game_id: gameId, puzzle_date: puzzleDate },
  });

  if (error) {
    // P-1c E: NO_PUZZLE ağ hatası değil, veri durumu — ayrı tip, tek warning.
    if (await isNoPuzzleError(error)) {
      reportPuzzleUnavailableOnce(gameId, puzzleDate);
      throw new PuzzleUnavailableError(gameId, puzzleDate);
    }
    Sentry.captureException(error, {
      tags: { game_id: gameId, puzzle_date: puzzleDate },
    });
    logger.error('[gameApi] getDailyChallenge failed:', error, { skipBridge: true });
    throw error;
  }

  return data as DailyChallenge;
}

/**
 * Günün gizli bağlantısını (tema) getirir.
 *
 * Tema etiketi yalnızca temalı bulmacaların hepsi tamamlandığında döner;
 * kilitliyken sunucu sadece sayaç gönderir (Hard Rule 1).
 *
 * @param puzzleDate - YYYY-MM-DD formatında tarih
 */
export async function getDailyTheme(puzzleDate: string): Promise<DailyThemeState> {
  await ensureAuthSession();

  const { data, error } = await supabase.functions.invoke('get-daily-theme', {
    body: { puzzle_date: puzzleDate },
  });

  if (error) {
    Sentry.captureException(error, {
      tags: { puzzle_date: puzzleDate },
    });
    logger.error('[gameApi] getDailyTheme failed:', error, { skipBridge: true });
    throw error;
  }

  return data as DailyThemeState;
}

/**
 * Tahmin gönderir ve feedback alır.
 *
 * @param puzzleId - Bulmaca UUID'si
 * @param guessFilmId - Tahmin edilen filmin UUID'si
 */
export async function submitGuess(
  puzzleId: string,
  guessFilmId: string,
): Promise<GuessResult> {
  await ensureAuthSession();

  const { data, error } = await supabase.functions.invoke('submit-guess', {
    body: { puzzle_id: puzzleId, guess_film_id: guessFilmId },
  });

  if (error) {
    Sentry.captureException(error, {
      tags: { puzzle_id: puzzleId, guess_film_id: guessFilmId },
    });
    logger.error('[gameApi] submitGuess failed:', error, { skipBridge: true });
    throw error;
  }

  return data as GuessResult;
}

/**
 * Imposter V2 round tahmini gönderir.
 *
 * @param puzzleId - Bulmaca UUID'si
 * @param round - Round numarası (1, 2, veya 3)
 * @param guessActorIds - Sahte olduğu düşünülen aktörlerin ID'leri
 * @param confidence - Güven seviyesi (50 | 75 | 100) — XP çarpanını belirler
 */
export async function submitImposterGuess(
  puzzleId: string,
  round: number,
  guessActorIds: number[],
  confidence: number,
): Promise<ImposterGuessResult> {
  await ensureAuthSession();

  const { data, error } = await supabase.functions.invoke('submit-guess', {
    body: {
      puzzle_id: puzzleId,
      imposter_round: round,
      guess_actor_ids: guessActorIds,
      confidence,
    },
  });

  if (error) {
    Sentry.captureException(error, {
      tags: { puzzle_id: puzzleId, round: String(round) },
    });
    logger.error('[gameApi] submitImposterGuess failed:', error, { skipBridge: true });
    throw error;
  }

  return data as ImposterGuessResult;
}

/**
 * Quoted/FadeIn/Logline tahmin gönderir (film seçimi).
 * submit-guess ile aynı endpoint, game_type sunucu tarafında puzzle'dan belirlenir.
 *
 * @param puzzleId - Bulmaca UUID'si
 * @param guessFilmId - Tahmin edilen filmin UUID'si
 */
export async function submitGameGuess(
  puzzleId: string,
  guessFilmId: string,
): Promise<GuessResult> {
  await ensureAuthSession();

  const { data, error } = await supabase.functions.invoke('submit-guess', {
    body: { puzzle_id: puzzleId, guess_film_id: guessFilmId },
  });

  if (error) {
    Sentry.captureException(error, {
      tags: { puzzle_id: puzzleId, guess_film_id: guessFilmId },
    });
    logger.error('[gameApi] submitGameGuess failed:', error, { skipBridge: true });
    throw error;
  }

  return data as GuessResult;
}

/**
 * FadeIn — oyuncunun seçtiği ipucunu açar.
 *
 * Tahmin hakkı harcamaz. Kredi kontrolü (yanlış tahmin sayısı > açılan ipucu
 * sayısı) sunucuda yapılır. İpucu İÇERİĞİ yalnızca bu yanıtta gelir —
 * migration 064'ten sonra puzzle_data yalnızca order + type taşır.
 *
 * @param puzzleId - Bulmaca UUID'si
 * @param hintOrder - Açılacak ipucunun order değeri
 */
export async function revealHint(
  puzzleId: string,
  hintOrder: number,
): Promise<HintRevealResult> {
  await ensureAuthSession();

  const { data, error } = await supabase.functions.invoke('submit-guess', {
    body: { puzzle_id: puzzleId, hint_order: hintOrder },
  });

  if (error) {
    Sentry.captureException(error, {
      tags: { puzzle_id: puzzleId, hint_order: String(hintOrder) },
    });
    logger.error('[gameApi] revealHint failed:', error, { skipBridge: true });
    throw error;
  }

  return data as HintRevealResult;
}

/**
 * Detective tahmin gönderir.
 *
 * Tek fazlı eleme oyunu — aşama parametresi kaldırıldı.
 *
 * @param puzzleId - Bulmaca UUID'si
 * @param guessFilmId - Seçilen filmin UUID'si
 */
export async function submitDetectiveGuess(
  puzzleId: string,
  guessFilmId: string,
): Promise<DetectiveGuessResult> {
  await ensureAuthSession();

  const { data, error } = await supabase.functions.invoke('submit-guess', {
    body: {
      puzzle_id: puzzleId,
      guess_film_id: guessFilmId,
    },
  });

  if (error) {
    Sentry.captureException(error, {
      tags: { puzzle_id: puzzleId, guess_film_id: guessFilmId },
    });
    logger.error('[gameApi] submitDetectiveGuess failed:', error, { skipBridge: true });
    throw error;
  }

  return data as DetectiveGuessResult;
}

/**
 * Spotlight tahmin gönderir (tur bazlı).
 *
 * @param puzzleId - Bulmaca UUID'si
 * @param guessFilmId - Seçilen filmin UUID'si
 * @param currentTurn - Aktif tur numarası (1-6)
 */
/**
 * Spotlight V3 — film tahmini ("filmi biliyorum").
 *
 * Harf acma icin `submitSpotlightLetter` kullanilir; ikisi ayri eylemdir.
 */
export async function submitSpotlightGuess(
  puzzleId: string,
  guessFilmId: string,
): Promise<SpotlightGuessResult> {
  await ensureAuthSession();

  const { data, error } = await supabase.functions.invoke('submit-guess', {
    body: {
      puzzle_id: puzzleId,
      guess_film_id: guessFilmId,
    },
  });

  if (error) {
    Sentry.captureException(error, {
      tags: { puzzle_id: puzzleId, guess_film_id: guessFilmId },
    });
    logger.error('[gameApi] submitSpotlightGuess failed:', error, { skipBridge: true });
    throw error;
  }

  return data as SpotlightGuessResult;
}

/**
 * Spotlight V3 — harf tahmini.
 *
 * Dogru harf bedavadir ve basliktaki tum pozisyonlarini acar; yanlis harf
 * bir hak goturur. Dogrulama sunucuda — istemci basligi hic gormez.
 */
export async function submitSpotlightLetter(
  puzzleId: string,
  letter: string,
): Promise<SpotlightLetterResult> {
  await ensureAuthSession();

  const { data, error } = await supabase.functions.invoke('submit-guess', {
    body: {
      puzzle_id: puzzleId,
      spotlight_letter: letter,
    },
  });

  if (error) {
    Sentry.captureException(error, {
      tags: { puzzle_id: puzzleId, letter },
    });
    logger.error('[gameApi] submitSpotlightLetter failed:', error, { skipBridge: true });
    throw error;
  }

  return data as SpotlightLetterResult;
}

/** dev-reset-games yanitı */
export interface DevResetResult {
  /** Silinen skor satiri sayisi */
  reset: number;
  puzzle_date: string;
  /** O gun sifirlanan oyun tipleri */
  games: string[];
  /** Cagiran hesabin users.id'si — allowlist teshisi icin */
  user_id: string;
}

/**
 * TEST — gunluk oyun ilerlemesini sifirlar (yalnizca allowlist'teki hesaplar).
 *
 * `game_scores` uzerinde DELETE politikasi bilincli olarak yok; silme yetkisi
 * sunucudaki dev-reset-games fonksiyonunda ve allowlist ile korunuyor.
 * Cagiran taraf bunu YALNIZCA __DEV__ altinda kullanmali.
 *
 * @param puzzleDate - YYYY-MM-DD; verilmezse sunucu bugunu kullanir
 * @param gameId - Yalnizca tek oyunu sifirlamak icin
 */
export async function resetGameProgress(
  puzzleDate?: string,
  gameId?: string,
): Promise<DevResetResult> {
  await ensureAuthSession();

  const { data, error } = await supabase.functions.invoke('dev-reset-games', {
    body: { puzzle_date: puzzleDate, game_id: gameId },
  });

  if (error) {
    /*
     * FunctionsHttpError yalnizca "non-2xx status code" diyor; asil sebep
     * yanit govdesinde. Govde okunmadigi icin allowlist 403'u ile gercek bir
     * sunucu hatasi ayirt edilemiyordu (Hard Rule 5: hata gorunur olmali).
     * `context` invoke'un dondugu ham Response'tur.
     */
    const response = (error as { context?: Response }).context;
    let detail = '';
    if (response && typeof response.text === 'function') {
      const body = await response.text().catch(() => '');
      try {
        const parsed = JSON.parse(body) as { error?: string; message?: string };
        detail = parsed.message ?? parsed.error ?? body;
      } catch {
        detail = body;
      }
      if (detail) detail = `[${response.status}] ${detail}`;
    }

    Sentry.captureException(error, {
      tags: { fn: 'dev-reset-games' },
      extra: { detail },
    });
    logger.error('[gameApi] resetGameProgress failed:', detail || error, { skipBridge: true });
    throw new Error(detail || 'dev-reset-games failed');
  }

  return data as DevResetResult;
}
