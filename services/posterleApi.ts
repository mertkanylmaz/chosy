/**
 * Posterle API Service — Edge function calls for daily poster puzzle.
 *
 * Backend-first: calls get-posterle / submit-posterle edge functions.
 * Fallback: returns null so caller can use client-side gameService.
 *
 * Cache: AsyncStorage for today's state (avoids redundant edge calls).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './supabase';
import { SUPABASE_URL } from '@/constants/config';
import { logger } from '@/utils/logger';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PosterleHint {
  attempt_number: number;
  hint_type: string;
  hint_value: string;
}

export interface PosterlePuzzleState {
  puzzle: {
    date: string;
    difficulty: string;
    poster_url: string | null;
    pixelation_level: number;
  };
  attempt: {
    attempts_used: number;
    attempts_remaining: number;
    result: 'in_progress' | 'won' | 'lost';
    won_on_attempt: number | null;
    guesses: unknown[];
  };
  hints: PosterleHint[];
  streak: {
    current_streak: number;
    longest_streak: number;
    freeze_tokens: number;
    total_wins: number;
  };
  /** Film details — only present if game is complete */
  film?: {
    id: string;
    tmdb_id: number;
    title: string;
    original_title: string | null;
    year: number | null;
    runtime: number | null;
    director: string | null;
    genres: string[] | null;
    cast: string[] | null;
    vote_average: number | null;
    overview: string | null;
    poster_url: string | null;
  };
}

export interface PosterleGuessResult {
  correct: boolean;
  result: 'in_progress' | 'won' | 'lost';
  attempts_used: number;
  attempts_remaining: number;
  pixelation_level: number;
  hint: { type: string; value: string } | null;
  /** Film details — only present on win/loss */
  film?: PosterlePuzzleState['film'];
  streak?: Record<string, unknown>;
}

// ─── Cache ──────────────────────────────────────────────────────────────────

const CACHE_KEY = 'chosy_posterle_state_';

function stateCacheKey(date: string): string {
  return `${CACHE_KEY}${date}`;
}

async function cacheState(date: string, state: PosterlePuzzleState): Promise<void> {
  try {
    await AsyncStorage.setItem(stateCacheKey(date), JSON.stringify(state));
  } catch {
    // Cache error — non-critical
  }
}

async function getCachedState(date: string): Promise<PosterlePuzzleState | null> {
  try {
    const raw = await AsyncStorage.getItem(stateCacheKey(date));
    if (raw) return JSON.parse(raw) as PosterlePuzzleState;
  } catch {
    // Cache miss
  }
  return null;
}

// ─── Auth helper ────────────────────────────────────────────────────────────

async function getAuthToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

// ─── Edge function caller ───────────────────────────────────────────────────

async function callEdgeFunction<T>(
  functionName: string,
  method: 'GET' | 'POST' = 'GET',
  body?: Record<string, unknown>,
): Promise<T | null> {
  const token = await getAuthToken();
  if (!token) {
    logger.warn(`[posterleApi] No auth token for ${functionName}`);
    return null;
  }

  const url = `${SUPABASE_URL}/functions/v1/${functionName}`;

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'apikey': token,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      logger.warn(`[posterleApi] ${functionName} HTTP ${res.status}: ${errorBody}`);
      return null;
    }

    return (await res.json()) as T;
  } catch (err) {
    logger.error(`[posterleApi] ${functionName} network error:`, err);
    return null;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Fetch today's posterle puzzle state.
 * Returns null if backend unavailable (caller should fallback to client-side).
 */
export async function fetchPosterlePuzzle(): Promise<PosterlePuzzleState | null> {
  const today = new Date().toISOString().split('T')[0];

  // Check cache first — if game is complete, no need to call backend
  const cached = await getCachedState(today);
  if (cached && cached.attempt.result !== 'in_progress') {
    logger.log('[posterleApi] Cached complete state');
    return cached;
  }

  // Call edge function
  const state = await callEdgeFunction<PosterlePuzzleState>('get-posterle', 'GET');
  if (!state) return null;

  // Cache the state
  await cacheState(today, state);
  return state;
}

/**
 * Submit a guess for today's posterle puzzle.
 * @param guessFilmId — UUID of the guessed film (from films table)
 * @param guessText — film title text (fallback matching)
 */
export async function submitPosterleGuess(
  guessFilmId?: string,
  guessText?: string,
): Promise<PosterleGuessResult | null> {
  const result = await callEdgeFunction<PosterleGuessResult>(
    'submit-posterle',
    'POST',
    {
      guess_film_id: guessFilmId ?? null,
      guess_text: guessText ?? null,
    },
  );

  if (!result) return null;

  // Update cached state with new attempt info
  const today = new Date().toISOString().split('T')[0];
  const cached = await getCachedState(today);
  if (cached) {
    cached.attempt.attempts_used = result.attempts_used;
    cached.attempt.attempts_remaining = result.attempts_remaining;
    cached.attempt.result = result.result;
    cached.puzzle.pixelation_level = result.pixelation_level;

    // Add hint to cached hints
    if (result.hint) {
      cached.hints.push({
        attempt_number: result.attempts_used,
        hint_type: result.hint.type,
        hint_value: result.hint.value,
      });
    }

    // Add film if game completed
    if (result.film) {
      cached.film = result.film;
    }

    if (result.streak) {
      cached.streak = {
        ...cached.streak,
        ...(result.streak as Record<string, number>),
      };
    }

    await cacheState(today, cached);
  }

  return result;
}

/**
 * Check if posterle backend is available.
 * Quick health check — if this fails, frontend should use client-side fallback.
 */
export async function isPosterleBackendAvailable(): Promise<boolean> {
  try {
    const token = await getAuthToken();
    if (!token) return false;

    const url = `${SUPABASE_URL}/functions/v1/get-posterle`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'apikey': token,
      },
      signal: AbortSignal.timeout(5000),
    });

    // 503 (no puzzle) is still "available" — just no puzzle curated yet
    return res.ok || res.status === 503;
  } catch {
    return false;
  }
}
