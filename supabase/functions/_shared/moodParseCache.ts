/**
 * parse-mood v2 önbelleği (MOOD-VEC-2d, migration 144). Saf fonksiyonlar — ağ, DB yok.
 *
 * Önbelleğe YALNIZ parse çıktısı girer: ham metin ve kullanıcı kimliği tabloya yazılmaz,
 * anahtar tek yönlü sha256'dır.
 */

/** TTL: okurken denetlenir (mood_parse_cache_get). */
export const PARSE_CACHE_TTL_SECONDS = 14 * 24 * 60 * 60

/** lower(trim(collapse_spaces(text))) — boşluk/yeni satır tek boşluğa iner. */
export function normalizeMoodText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Prompt sürümü = prompt metninin hash'inin ilk 12 hanesi. Prompt (veya v2 eki) değişince
 * eski satırlar kendiliğinden eşleşmez; elle sürüm artırmayı unutma riski yok.
 */
export async function promptVersionOf(prompt: string): Promise<string> {
  return (await sha256Hex(prompt)).slice(0, 12)
}

/**
 * Önbelleğe girebilen hızlı mood kartı kimlikleri = istemci MOOD_CARDS id'leri
 * (components/Home/MoodCardGrid/index.tsx). Beyaz liste: rastgele bir string önbellek
 * satırı üretemez. Eval moods.json qm_* kimlikleri bunlarla eşlenir (scripts/mood-eval/run.ts).
 */
export const QUICK_MOOD_IDS: readonly string[] = [
  'rainy', 'mindbending', 'datenight', 'adrenaline', 'laugh', 'nostalgia', 'cozy', 'emotional',
]

/**
 * İstek gövdesindeki quick_mood_id. Yoksa, string değilse veya listede değilse null:
 * önbellek hiç kullanılmaz (ne okuma ne yazma).
 */
export function parseQuickMoodId(body: unknown): string | null {
  const v = (body as { quick_mood_id?: unknown } | null)?.quick_mood_id
  return typeof v === 'string' && QUICK_MOOD_IDS.includes(v) ? v : null
}

/**
 * key = sha256(quick_mood_id + "\n" + normalize(metin) + "\n" + schema_version + "\n" + prompt_version).
 * Ayraç "\n": normalize sonrası metinde yeni satır kalmadığı için birleşim belirsiz olamaz.
 */
export async function parseCacheKey(
  quickMoodId: string,
  rawInput: string,
  schemaVersion: number,
  promptVersion: string,
): Promise<string> {
  return await sha256Hex(
    [quickMoodId, normalizeMoodText(rawInput), String(schemaVersion), promptVersion].join('\n'),
  )
}

/**
 * RPC'den dönen değerin kullanılabilir bir parse çıktısı olup olmadığına bakar.
 * Bozuk satır `null` döner (çağıran Sentry'ye yazar ve Haiku'ya düşer) — bozuk veri asla sunulmaz.
 */
export function readCachedProfile(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  const v = value as Record<string, unknown>
  const es = v.emotional_state
  if (es === null || typeof es !== 'object' || Array.isArray(es)) return null
  if (!Array.isArray(v.search_keywords)) return null
  return v
}
