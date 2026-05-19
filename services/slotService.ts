/**
 * Slot Machine Service — 3 variant slot backend iletisimi.
 *
 * Pure Random: tum tier'lara acik, watchlist'ten random
 * Mood Filtered: premium, mood bazli weighted random
 * Triple: premium, 3 filtreli slot
 */
import { supabase } from './supabase';
import { logger } from '../utils/logger';
import { Film } from '../types/film';

// ─── Tipler ─────────────────────────────────────────────────────────────────

export type SlotVariant = 'pure_random' | 'mood_filtered' | 'triple';
export type DurationFilter = 'short' | 'medium' | 'long' | 'any';
export type EraFilter = '2020s' | '2010s' | '2000s' | 'classic' | 'any';

export interface SlotResult {
  film: Film;
  variant: SlotVariant;
  matchScore?: number;
  mood?: string;
  candidateCount: number;
  filters?: {
    duration?: DurationFilter;
    mood?: string;
    era?: EraFilter;
  };
}

export interface SlotError {
  error: string;
  code?: string;
  min?: number;
  current?: number;
}

export interface TokenBalance {
  balance: number;
}

// ─── Edge Function cagrilari ─────────────────────────────────────────────────

/**
 * supabase.functions.invoke non-2xx donerse error icinde
 * structured JSON gizli kalir. Bu helper onu cikarir.
 */
function extractStructuredError(error: { message?: string; context?: unknown }): SlotError {
  // FunctionsHttpError.message genelde response body text icerir
  const msg = error.message ?? '';
  try {
    const parsed = JSON.parse(msg);
    if (parsed && typeof parsed.error === 'string') {
      return parsed as SlotError;
    }
  } catch {
    // JSON degilse devam
  }

  // Fallback — bilinen hata kodlarini mesajdan cikarmayi dene
  if (msg.includes('NEED_MORE_FILMS')) return { error: 'NEED_MORE_FILMS' };
  if (msg.includes('QUOTA_EXCEEDED')) return { error: 'QUOTA_EXCEEDED' };
  if (msg.includes('NO_MATCHES')) return { error: 'NO_MATCHES' };
  if (msg.includes('PREMIUM_REQUIRED')) return { error: 'PREMIUM_REQUIRED' };

  return { error: msg || 'UNKNOWN_ERROR' };
}

/**
 * Pure Random slot — tum tier'lara acik.
 */
export async function spinPureRandom(): Promise<SlotResult> {
  const { data, error } = await supabase.functions.invoke('slot-pure-random', {
    body: {},
  });

  if (error) {
    logger.error('[slot] spinPureRandom error:', error.message);
    const structured = extractStructuredError(error);
    throw structured;
  }

  if (data.error) {
    throw data;
  }

  return mapSlotResponse(data);
}

/**
 * Mood Filtered slot — premium only.
 */
export async function spinMoodFiltered(mood: string): Promise<SlotResult> {
  const { data, error } = await supabase.functions.invoke('slot-mood-filtered', {
    body: { mood },
  });

  if (error) {
    logger.error('[slot] spinMoodFiltered error:', error.message);
    const structured = extractStructuredError(error);
    throw structured;
  }

  if (data.error) {
    throw data;
  }

  return mapSlotResponse(data);
}

/**
 * Triple slot — premium only.
 */
export async function spinTriple(
  durationFilter?: DurationFilter,
  moodFilter?: string,
  eraFilter?: EraFilter,
): Promise<SlotResult> {
  const { data, error } = await supabase.functions.invoke('slot-triple', {
    body: {
      duration_filter: durationFilter ?? 'any',
      mood_filter: moodFilter,
      era_filter: eraFilter ?? 'any',
    },
  });

  if (error) {
    logger.error('[slot] spinTriple error:', error.message);
    const structured = extractStructuredError(error);
    throw structured;
  }

  if (data.error) {
    throw data;
  }

  return mapSlotResponse(data);
}

/**
 * Slot spin sonucunu kabul et.
 */
export async function acceptSlotSpin(filmId: string, variant: SlotVariant): Promise<void> {
  try {
    await supabase
      .from('slot_spins')
      .update({ accepted: true })
      .eq('film_id', filmId)
      .eq('variant', variant)
      .order('spun_at', { ascending: false })
      .limit(1);
  } catch (err) {
    logger.error('[slot] acceptSlotSpin error:', err);
  }
}

// ─── Token Economy ──────────────────────────────────────────────────────────

/**
 * Kullanicinin slot token bakiyesini getirir.
 */
export async function getSlotTokenBalance(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('users')
    .select('slot_tokens')
    .eq('id', userId)
    .single();

  if (error || !data) return 0;
  return data.slot_tokens ?? 0;
}

/**
 * Token harcayarak ekstra spin kazanir.
 */
export async function spendSlotToken(userId: string): Promise<{ success: boolean; balance: number }> {
  const { data, error } = await supabase.rpc('spend_slot_token', {
    p_user_id: userId,
  });

  if (error) {
    logger.error('[slot] spendSlotToken error:', error.message);
    return { success: false, balance: 0 };
  }

  return {
    success: data?.success ?? false,
    balance: data?.balance ?? 0,
  };
}

/**
 * Token kazan (streak, game perfect vs).
 */
export async function earnSlotToken(
  userId: string,
  amount: number,
  reason: string,
): Promise<{ success: boolean; balance: number }> {
  const { data, error } = await supabase.rpc('earn_slot_token', {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
  });

  if (error) {
    logger.error('[slot] earnSlotToken error:', error.message);
    return { success: false, balance: 0 };
  }

  return {
    success: data?.success ?? false,
    balance: data?.balance ?? 0,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Edge Function response'unu SlotResult'a map'ler */
function mapSlotResponse(data: Record<string, unknown>): SlotResult {
  const film = data.film as Record<string, unknown>;

  return {
    film: {
      id: film.id as string,
      title: film.title as string,
      posterUrl: film.posterUrl as string,
      year: film.year as number,
      runtime: film.runtime as number | undefined,
      voteAverage: film.voteAverage as number | undefined,
      moodTags: (film.moodTags as string[]) ?? [],
    } as Film,
    variant: data.variant as SlotVariant,
    matchScore: data.matchScore as number | undefined,
    mood: data.mood as string | undefined,
    candidateCount: data.candidateCount as number,
    filters: data.filters as SlotResult['filters'],
  };
}
