/**
 * submit-mood-choice saf mantığı (Mood Gauntlet, Faz 2-1). Deno/Supabase yok.
 *
 * Mood seçimleri `choice_events`'e günlük gauntlet'in kimliğiyle DEĞİL, istemcinin
 * her dörtlü için ürettiği `set_id` ile yazılır (gauntlet_id = session_id = set_id);
 * (gauntlet_id, round) partial UNIQUE index'i böylece set başına tur idempotent olur.
 * Kaynak `context.source='mood'` ile işaretlenir (recompute-taste-vector bunları
 * zevk vektöründen hariç tutar). Günlük gauntlet koduna dokunulmaz.
 */

export const MOOD_CHOICE_ALGORITHM_VERSION = 'mood-gauntlet-v1'
/** mood_searches satırı bu süreden eskiyse seçim kabul edilmez. */
export const MOOD_SEARCH_MAX_AGE_MS = 24 * 60 * 60 * 1000
export const MOOD_CHOICE_MAX_SET_INDEX = 50

export type MoodChoiceOutcome = 'choice' | 'neither'

export interface MoodChoiceRequest {
  mood_search_id: string
  set_id: string
  /** Oturumda kaçıncı dörtlü (0 tabanlı) — analitik; yoksa 0. */
  set_index: number
  round: 1 | 2 | 3
  film_a: string
  film_b: string
  winner: string | null
  outcome: MoodChoiceOutcome
}

export type MoodChoiceParse =
  | { ok: true; value: MoodChoiceRequest }
  | { ok: false; message: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v)
}

export function parseMoodChoiceRequest(body: unknown): MoodChoiceParse {
  if (typeof body !== 'object' || body === null) return { ok: false, message: 'gövde nesne olmalı' }
  const b = body as Record<string, unknown>

  for (const k of ['mood_search_id', 'set_id', 'film_a', 'film_b'] as const) {
    if (!isUuid(b[k])) return { ok: false, message: `${k} geçerli uuid olmalı` }
  }
  if (b.round !== 1 && b.round !== 2 && b.round !== 3) {
    return { ok: false, message: 'round 1, 2 veya 3 olmalı' }
  }
  if (b.outcome !== 'choice' && b.outcome !== 'neither') {
    return { ok: false, message: "outcome 'choice' veya 'neither' olmalı" }
  }
  if (b.film_a === b.film_b) return { ok: false, message: 'film_a ve film_b farklı olmalı' }

  let setIndex = 0
  if (b.set_index !== undefined) {
    const si = b.set_index
    if (typeof si !== 'number' || !Number.isInteger(si) || si < 0 || si > MOOD_CHOICE_MAX_SET_INDEX) {
      return { ok: false, message: `set_index 0..${MOOD_CHOICE_MAX_SET_INDEX} tam sayı olmalı` }
    }
    setIndex = si
  }

  let winner: string | null = null
  if (b.outcome === 'neither') {
    if (b.winner !== null && b.winner !== undefined) {
      return { ok: false, message: "outcome='neither' iken winner null olmalı" }
    }
  } else {
    if (b.winner !== b.film_a && b.winner !== b.film_b) {
      return { ok: false, message: "outcome='choice' iken winner film_a veya film_b olmalı" }
    }
    winner = b.winner as string
  }

  return {
    ok: true,
    value: {
      mood_search_id: b.mood_search_id as string,
      set_id: b.set_id as string,
      set_index: setIndex,
      round: b.round,
      film_a: b.film_a as string,
      film_b: b.film_b as string,
      winner,
      outcome: b.outcome,
    },
  }
}

/** mood_searches.searched_at son 24 saatte mi? Geçersiz/eksik tarih → false (fail-closed). */
export function isSearchRecent(searchedAt: string | null | undefined, nowMs: number): boolean {
  if (!searchedAt) return false
  const t = Date.parse(searchedAt)
  if (Number.isNaN(t)) return false
  const age = nowMs - t
  return age >= 0 && age <= MOOD_SEARCH_MAX_AGE_MS
}

/** `record_choice_event` RPC argümanları (p_set_champion daima false). */
export function buildRecordChoiceArgs(userId: string, req: MoodChoiceRequest) {
  return {
    p_user_id: userId,
    p_gauntlet_id: req.set_id,
    p_round: req.round,
    p_film_a: req.film_a,
    p_film_b: req.film_b,
    p_winner: req.winner,
    p_outcome: req.outcome,
    p_position_of_winner:
      req.outcome === 'choice' ? (req.winner === req.film_a ? 'left' : 'right') : null,
    p_latency_ms: null,
    p_low_confidence: false,
    p_context: {
      source: 'mood',
      mood_search_id: req.mood_search_id,
      set_index: req.set_index,
    },
    p_algorithm_version: MOOD_CHOICE_ALGORITHM_VERSION,
    p_set_champion: false,
  }
}
