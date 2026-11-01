/**
 * mood-four istek doğrulaması (Faz 2-3) — saf, ağ yok.
 *
 * İstemci parse sonucunu, dışlama listesini, sorgu vektörünü (vectorEncoder tek kaynağı İSTEMCİDE;
 * burada vektör üretilmez) ve gevşetme basamaklarını gönderir. Sunucu basamakları sırayla dener
 * (v4 RPC) ve yeterli aday gelince id-rerank (reason:false, count:4) çalıştırır.
 */

export const MAX_ATTEMPTS = 8
export const MAX_EXCLUDE_IDS = 500
export const MAX_MATCH_COUNT = 60
export const VECTOR_DIM_MIN = 8

export interface FourAttempt {
  min_similarity: number
  min_rating: number | null
  genres_include: string[]
  max_runtime: number | null
}

export interface TitleRefIn {
  title: string
  year: number | null
}

export interface MoodFourRequest {
  mood_text: string
  query_vector: string
  exclude_ids: string[]
  search_keywords: string[]
  genres_exclude: string[]
  reference_titles: TitleRefIn[]
  suggested_titles: TitleRefIn[]
  attempts: FourAttempt[]
  match_count: number
  /** Dörtlü seçiminde kaç aday LLM'e gider (istemcideki RERANK_CANDIDATES). */
  rerank_candidates: number
}

export type ParseResult = { ok: true; value: MoodFourRequest } | { ok: false; reason: string }

const isStr = (v: unknown): v is string => typeof v === 'string'
const strArr = (v: unknown, max: number): string[] =>
  Array.isArray(v) ? v.filter(isStr).slice(0, max) : []

function titleRefs(v: unknown): TitleRefIn[] {
  if (!Array.isArray(v)) return []
  const out: TitleRefIn[] = []
  for (const x of v.slice(0, 20)) {
    const t = (x as { title?: unknown } | null)?.title
    const y = (x as { year?: unknown } | null)?.year
    if (isStr(t) && t.trim().length > 0) out.push({ title: t.slice(0, 200), year: typeof y === 'number' ? y : null })
  }
  return out
}

function parseAttempt(x: unknown): FourAttempt | null {
  if (x === null || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  if (typeof o.min_similarity !== 'number' || !Number.isFinite(o.min_similarity)) return null
  const minRating = o.min_rating === null || o.min_rating === undefined ? null : o.min_rating
  if (minRating !== null && (typeof minRating !== 'number' || !Number.isFinite(minRating))) return null
  const maxRuntime = o.max_runtime === null || o.max_runtime === undefined ? null : o.max_runtime
  if (maxRuntime !== null && (typeof maxRuntime !== 'number' || !Number.isFinite(maxRuntime))) return null
  return {
    min_similarity: o.min_similarity,
    min_rating: minRating,
    genres_include: strArr(o.genres_include, 10),
    max_runtime: maxRuntime,
  }
}

export function parseMoodFourRequest(raw: unknown): ParseResult {
  if (raw === null || typeof raw !== 'object') return { ok: false, reason: 'body' }
  const o = raw as Record<string, unknown>
  if (!isStr(o.mood_text) || o.mood_text.trim().length === 0) return { ok: false, reason: 'mood_text' }
  if (!isStr(o.query_vector) || !/^\[[-0-9eE.,\s+]+\]$/.test(o.query_vector)) return { ok: false, reason: 'query_vector' }
  if (o.query_vector.split(',').length < VECTOR_DIM_MIN) return { ok: false, reason: 'query_vector_dim' }
  if (!Array.isArray(o.attempts) || o.attempts.length === 0 || o.attempts.length > MAX_ATTEMPTS) {
    return { ok: false, reason: 'attempts' }
  }
  const attempts: FourAttempt[] = []
  for (const a of o.attempts) {
    const p = parseAttempt(a)
    if (!p) return { ok: false, reason: 'attempt_shape' }
    attempts.push(p)
  }
  const matchCount = typeof o.match_count === 'number' ? Math.min(Math.max(Math.round(o.match_count), 4), MAX_MATCH_COUNT) : 40
  const rc = typeof o.rerank_candidates === 'number' ? Math.min(Math.max(Math.round(o.rerank_candidates), 4), 30) : 20
  return {
    ok: true,
    value: {
      mood_text: o.mood_text.slice(0, 500),
      query_vector: o.query_vector,
      exclude_ids: strArr(o.exclude_ids, MAX_EXCLUDE_IDS),
      search_keywords: strArr(o.search_keywords, 20),
      genres_exclude: strArr(o.genres_exclude, 10),
      reference_titles: titleRefs(o.reference_titles),
      suggested_titles: titleRefs(o.suggested_titles),
      attempts,
      match_count: matchCount,
      rerank_candidates: rc,
    },
  }
}

/** match_films_v4 argümanları (istemcideki matchV4 ile aynı sabitler). */
export function buildRpcArgs(req: MoodFourRequest, a: FourAttempt): Record<string, unknown> {
  return {
    query_vector: req.query_vector,
    user_vector: null,
    mood_weight: 1.0,
    user_weight: 0.0,
    match_count: req.match_count,
    min_similarity: a.min_similarity,
    ...(a.min_rating != null ? { min_rating: a.min_rating } : {}),
    ...(req.search_keywords.length > 0 ? { search_keywords: req.search_keywords } : {}),
    ...(req.exclude_ids.length > 0 ? { exclude_ids: req.exclude_ids } : {}),
    per_director_cap: 1,
    tier_boost: true,
    exclude_archive: true,
    genres_include: a.genres_include,
    genres_exclude: req.genres_exclude,
    max_runtime: a.max_runtime,
    reference_titles: req.reference_titles,
    suggested_titles: req.suggested_titles,
  }
}

/** Aynı id'li tekrarları atar (ilk görülen kalır) — istemcideki uniqueById. */
export function uniqueRows<T extends { id: string }>(rows: readonly T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const r of rows) {
    if (seen.has(r.id)) continue
    seen.add(r.id)
    out.push(r)
  }
  return out
}
