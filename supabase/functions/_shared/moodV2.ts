/**
 * parse-mood schema_version:2 (MOOD-VEC-2c). Saf fonksiyonlar — ağ, DB yok.
 *
 * v2 istemcisi gövdede `schema_version: 2` gönderirse prompt'a EK_BLOK eklenir ve çıktıya
 * şu alanlar katılır: genres_include, genres_exclude, max_runtime, reference_titles,
 * suggested_titles. Alan yoksa / sürüm 2 değilse v1 yolu byte-byte aynı kalır.
 */

/** TMDb en-US tür adları (films.genres bu adlarla saklanır; bkz. genre-normalize.sql). */
export const TMDB_GENRES = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama',
  'Family', 'Fantasy', 'History', 'Horror', 'Music', 'Mystery', 'Romance',
  'Science Fiction', 'TV Movie', 'Thriller', 'War', 'Western',
] as const

export interface TitleRef {
  title: string
  year: number | null
}

export interface MoodV2Fields {
  genres_include: string[]
  genres_exclude: string[]
  max_runtime: number | null
  reference_titles: TitleRef[]
  suggested_titles: TitleRef[]
}

const GENRE_SET = new Set<string>(TMDB_GENRES)
const MAX_GENRES = 4
const MAX_REFERENCES = 5
const MAX_SUGGESTED = 10
const MAX_TITLE_CHARS = 120

/** Gövdede `schema_version` tam sayı 2 ise true; başka her şey v1. */
export function isSchemaV2(body: unknown): boolean {
  return (body as { schema_version?: unknown } | null)?.schema_version === 2
}

export const V2_PROMPT_ADDENDUM = `

SCHEMA VERSION 2 — also include these extra top-level fields in the same JSON object:
  "genres_include": [genre names],
  "genres_exclude": [genre names],
  "max_runtime": integer minutes or null,
  "reference_titles": [{"title": "...", "year": 1999}],
  "suggested_titles": [{"title": "...", "year": 1999}]

v2 field rules:
- genres_include / genres_exclude: ONLY these exact names: ${TMDB_GENRES.join(', ')}. Max ${MAX_GENRES} each. Include a genre only when the mood clearly implies it ("need a laugh" → ["Comedy"]); otherwise []. Exclude only what the user clearly rejects ("no horror" → ["Horror"]). Never put the same genre in both.
- max_runtime: integer minutes ONLY if the user states a time limit ("I have 90 minutes", "short film"). Otherwise null. Do not infer it from the mood.
- reference_titles: films the user explicitly names as a reference ("like Inception"). Use the original release year. [] if none.
- suggested_titles: 8-${MAX_SUGGESTED} real, well-known films that fit this mood, the kind an average US moviegoer would recognize. Do NOT include the films in reference_titles. Use exact English release titles and the release year.`

function cleanTitles(value: unknown, max: number): TitleRef[] {
  if (!Array.isArray(value)) return []
  const out: TitleRef[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (out.length >= max) break
    const raw = (item as { title?: unknown } | null)?.title
    if (typeof raw !== 'string') continue
    const title = raw.trim().slice(0, MAX_TITLE_CHARS)
    if (title.length === 0) continue
    const y = (item as { year?: unknown }).year
    const year = typeof y === 'number' && Number.isInteger(y) && y >= 1888 && y <= 2100 ? y : null
    const key = `${title.toLowerCase()}|${year ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ title, year })
  }
  return out
}

function cleanGenres(value: unknown, forbidden: string[] = []): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const g of value) {
    if (typeof g === 'string' && GENRE_SET.has(g) && !out.includes(g) && !forbidden.includes(g)) out.push(g)
    if (out.length >= MAX_GENRES) break
  }
  return out
}

/**
 * Modelin ham çıktısından v2 alanlarını doğrulanmış biçimde çıkarır. Enum dışı tür atılır;
 * include ∩ exclude çakışmasında exclude kazanır; referans filmler öneri listesinden çıkarılır.
 */
export function normalizeV2Fields(parsed: Record<string, unknown>): MoodV2Fields {
  const exclude = cleanGenres(parsed.genres_exclude)
  const include = cleanGenres(parsed.genres_include, exclude)

  const rt = parsed.max_runtime
  const max_runtime =
    typeof rt === 'number' && Number.isFinite(rt) && rt >= 30 && rt <= 400 ? Math.round(rt) : null

  const reference_titles = cleanTitles(parsed.reference_titles, MAX_REFERENCES)
  const refKeys = new Set(reference_titles.map((r) => r.title.toLowerCase()))
  const suggested_titles = cleanTitles(parsed.suggested_titles, MAX_SUGGESTED + MAX_REFERENCES)
    .filter((s) => !refKeys.has(s.title.toLowerCase()))
    .slice(0, MAX_SUGGESTED)

  return { genres_include: include, genres_exclude: exclude, max_runtime, reference_titles, suggested_titles }
}
