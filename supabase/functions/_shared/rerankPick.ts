/**
 * Dörtlü seçimi (id-rerank, reason:false) ortak parçaları — rerank-films ve mood-four AYNI
 * prompt'u ve aynı aday satırı biçimini kullanır (Faz 2-3). Saf: ağ / Deno API'si yok.
 *
 * rerank-films davranışı DEĞİŞMEDİ: buradaki metinler oradaki satır içi sürümün birebir taşınmış
 * halidir (tests/rerankPick.test.ts aynı çıktıyı sabitler).
 */

export const PICK_SYSTEM_PROMPT = `You are a film recommendation re-ranker. Given a user's mood/intent description and a list of candidate films, select and rank the most relevant films.

Rules:
- Understand the user's INTENT, not just emotion. "thailand trip" means films about travel, Thailand, Southeast Asia, adventure, vacation — NOT just "happy adventure films"
- "exam results came back great" means films about academic achievement, youth, coming-of-age, school success — NOT just "happy films"
- Eliminate films with ZERO thematic connection to the user's intent
- Respect explicit constraints: if the mood says "not intense", "not scary", "nothing heavy" or similar, never select a film that violates it (judge by genres, runtime and overview). If an "Excluded genres" line is given, never select a film that has any of those genres
- Among thematically relevant films, prefer higher original similarity scores (they capture emotional tone better)
- If no films are thematically connected, fall back to the best emotional matches (don't return empty)
- Return ONLY a JSON array of the candidate NUMBERS (the integer before each film) in ranked order, nothing else
- Never return titles, reasons or explanations
- Accept both English and Turkish input equally

Return format (ONLY valid JSON, no explanation):
[3, 12, 1, ...]`

export interface PickCandidate {
  id: string
  title: string
  overview: string | null
  genres: string[] | null
  year: number | null
  runtime?: number | null
}

/** Numaralı aday listesi: `1. "Başlık" (yıl) | 101 min | türler | özet`. */
export function buildFilmList(pool: readonly PickCandidate[], overviewMax: number): string {
  return pool
    .map((c, i) => {
      const overview = (c.overview ?? '').slice(0, overviewMax)
      const genres = (c.genres ?? []).join(', ')
      const runtime = typeof c.runtime === 'number' && c.runtime > 0 ? ` | ${Math.round(c.runtime)} min` : ''
      return `${i + 1}. "${c.title}" (${c.year ?? '?'})${runtime} | ${genres} | ${overview}`
    })
    .join('\n')
}

/** parse'taki genres_exclude → prompt'a giren temiz liste (en çok 10, 40 karakter). */
export function cleanExcludedGenres(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((g): g is string => typeof g === 'string' && g.trim().length > 0)
    .slice(0, 10)
    .map((g) => g.trim().slice(0, 40))
}

export function buildPickUserMessage(input: {
  moodText: string
  pool: readonly PickCandidate[]
  count: number
  overviewMax: number
  excludedGenres: readonly string[]
}): string {
  const excludedLine = input.excludedGenres.length > 0
    ? `\nExcluded genres (never select a film with any of these): ${input.excludedGenres.join(', ')}\n`
    : ''
  return `User mood: "${input.moodText}"
${excludedLine}
Select the ${input.count} most relevant films from these candidates. Return their numbers in ranked order.

Candidate films:
${buildFilmList(input.pool, input.overviewMax)}`
}

/** Model metni → JSON dizisi (markdown kod bloğu toleranslı). Dizi değilse hata. */
export function parseModelArray(rawText: string): unknown[] {
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  const out = JSON.parse(jsonMatch ? jsonMatch[1] : rawText.trim())
  if (!Array.isArray(out)) throw new Error('LLM returned non-array')
  return out
}

/** 1..N numaralarını aday id'lerine çevirir; aralık dışı / tekrar / sayı olmayan atılır. */
export function numbersToIds(parsed: readonly unknown[], pool: readonly { id: string }[], count: number): string[] {
  const seen = new Set<number>()
  const ids: string[] = []
  for (const item of parsed) {
    const idx = typeof item === 'number' ? item : typeof item === 'string' ? Number(item) : NaN
    if (!Number.isInteger(idx) || idx < 1 || idx > pool.length || seen.has(idx)) continue
    seen.add(idx)
    ids.push(pool[idx - 1].id)
    if (ids.length >= count) break
  }
  return ids
}
