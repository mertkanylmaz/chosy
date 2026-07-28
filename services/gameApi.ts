/**
 * Game API Service — Edge Function tabanlı oyun çağrılarının TEK KAYNAĞI.
 *
 * CineMetrics ve gelecekteki sunucu-doğrulamalı oyunlar bu modülü kullanır.
 * Her çağrı ensureAuthSession() ile sarılıdır.
 * Hata → Sentry + throw (sessiz fallback YASAK).
 */

import * as Sentry from '@sentry/react-native';

import { supabase } from './supabase';
import { logger } from '@/utils/logger';

import type {
  DailyChallenge,
  DailyThemeState,
  DetectiveGuessResult,
  DetectiveStage,
  GuessResult,
  HintRevealResult,
  ImposterGuessResult,
  SpotlightGuessResult,
} from '@/types/game';

// ─── Auth Helper ─────────────────────────────────────────────────────────────

/**
 * Auth session'ı doğrular ve gerekirse refresh eder.
 * Edge Function çağrısı öncesi JWT'nin geçerli olduğunu garanti eder.
 */
async function ensureAuthSession(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const nowSec = Math.floor(Date.now() / 1000);
  const isExpiredOrSoon = !session ||
    (session.expires_at != null && session.expires_at < nowSec + 30);

  if (isExpiredOrSoon) {
    const { error } = await supabase.auth.refreshSession();
    if (error) {
      logger.warn('[gameApi] Session refresh failed:', error.message);
    }
  }
}

// ─── API Functions ───────────────────────────────────────────────────────────

/**
 * Günlük bulmacayı getirir.
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
    Sentry.captureException(error, {
      tags: { game_id: gameId, puzzle_date: puzzleDate },
    });
    logger.error('[gameApi] getDailyChallenge failed:', error);
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
    logger.error('[gameApi] getDailyTheme failed:', error);
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
    logger.error('[gameApi] submitGuess failed:', error);
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
    logger.error('[gameApi] submitImposterGuess failed:', error);
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
    logger.error('[gameApi] submitGameGuess failed:', error);
    throw error;
  }

  return data as GuessResult;
}

/**
 * FadeIn — oyuncunun seçtiği ipucunu açar.
 *
 * Tahmin hakkı harcamaz. Kredi kontrolü (yanlış tahmin sayısı > açılan ipucu
 * sayısı) sunucuda yapılır; response ipucu içeriği DÖNMEZ — içerik zaten
 * puzzle_data ile istemcide.
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
    logger.error('[gameApi] revealHint failed:', error);
    throw error;
  }

  return data as HintRevealResult;
}

/**
 * Detective tahmin gönderir (aşama bazlı).
 *
 * @param puzzleId - Bulmaca UUID'si
 * @param guessFilmId - Seçilen filmin UUID'si
 * @param currentStage - Aktif aşama (1=investigation, 2=deduction)
 */
export async function submitDetectiveGuess(
  puzzleId: string,
  guessFilmId: string,
  currentStage: DetectiveStage,
): Promise<DetectiveGuessResult> {
  await ensureAuthSession();

  const { data, error } = await supabase.functions.invoke('submit-guess', {
    body: {
      puzzle_id: puzzleId,
      guess_film_id: guessFilmId,
      detective_stage: currentStage,
    },
  });

  if (error) {
    Sentry.captureException(error, {
      tags: { puzzle_id: puzzleId, guess_film_id: guessFilmId, stage: String(currentStage) },
    });
    logger.error('[gameApi] submitDetectiveGuess failed:', error);
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
export async function submitSpotlightGuess(
  puzzleId: string,
  guessFilmId: string,
  currentTurn: number,
): Promise<SpotlightGuessResult> {
  await ensureAuthSession();

  const { data, error } = await supabase.functions.invoke('submit-guess', {
    body: {
      puzzle_id: puzzleId,
      guess_film_id: guessFilmId,
      current_turn: currentTurn,
    },
  });

  if (error) {
    Sentry.captureException(error, {
      tags: { puzzle_id: puzzleId, guess_film_id: guessFilmId, turn: String(currentTurn) },
    });
    logger.error('[gameApi] submitSpotlightGuess failed:', error);
    throw error;
  }

  return data as SpotlightGuessResult;
}
