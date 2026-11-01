/**
 * rerank-films gerekçe (reason:true) yolu — prompt ve sayaç adı (Faz 2-1b).
 *
 * Saf modül (Deno / ağ yok) ki testlerde ve index.ts'te aynı kaynak kullanılsın.
 *
 * Gerekçe "filmin özeti" değil "bu mood'a bu akşam neden uyduğu"dur: ≤12 kelime, film adı
 * tekrarlanmaz, olay örgüsü özetlenmez. (Cihaz testinde "Perfect Days follows a …" biçimi
 * görüldü: eski prompt "film adını koru" diyor ve örnekleri adla başlıyordu.)
 */

export const REASON_MAX_CANDIDATES = 20
export const REASON_OVERVIEW_MAX = 100
export const REASON_MAX_WORDS = 12

/** Sunucu tarafı sert sınır: prompt 12 ister, model aşarsa 16'ya kadar tolerans; üstü '' olur. */
export const REASON_HARD_MAX_WORDS = 16

/**
 * id-rerank ve gerekçe (TR + EN) tek model: Haiku. (TR için denenen claude-sonnet-4-20250514
 * Anthropic'te 404 verdi — emekli; Sonnet adımı kaldırıldı.)
 */
export const REASON_DEFAULT_MODEL = 'claude-haiku-4-5'

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length
}

export interface LengthGuardResult {
  reasons: Record<string, string>
  /** Sınırı aştığı için boşaltılan film id'leri. */
  dropped: string[]
}

/** >max kelimelik gerekçe '' olur (anahtar korunur, reasons_dropped artar); <=max aynen kabul. */
export function enforceReasonLength(
  reasons: Record<string, string>,
  max: number = REASON_HARD_MAX_WORDS,
): LengthGuardResult {
  const out: Record<string, string> = {}
  const dropped: string[] = []
  for (const [id, text] of Object.entries(reasons)) {
    if (countWords(text) > max) {
      out[id] = ''
      dropped.push(id)
    } else {
      out[id] = text
    }
  }
  return { reasons: out, dropped }
}

/** Gerekçede rakam (\d) varsa '' olur: süre/yıl/sayı gibi olgusal iddia yazılmasın. Anahtar korunur. */
export function enforceNoDigits(reasons: Record<string, string>): LengthGuardResult {
  const out: Record<string, string> = {}
  const dropped: string[] = []
  for (const [id, text] of Object.entries(reasons)) {
    if (/\d/.test(text)) {
      out[id] = ''
      dropped.push(id)
    } else {
      out[id] = text
    }
  }
  return { reasons: out, dropped }
}

/** id-rerank (reason:false) mevcut sayacı kullanır. */
export const RERANK_IDS_DAILY_KEY = 'rerank-films-daily'
/** Gerekçe çağrısı (reason:true) AYRI sayaç kullanır; limitler aynıdır (lookupDailyLimit). */
export const RERANK_REASONS_DAILY_KEY = 'rerank-films-reasons-daily'

/** Hangi günlük sayaç? '-daily' soneki zorunlu (cleanup 138 yalnız bu adları 48 saat saklar). */
export function dailyCounterKey(withReason: boolean): string {
  return withReason ? RERANK_REASONS_DAILY_KEY : RERANK_IDS_DAILY_KEY
}

export const REASON_SYSTEM_PROMPT = `You are a film recommendation re-ranker. Given a user's mood/intent description and a list of candidate films, select and rank the most relevant films, and give each a short reason.

Rules:
- Understand the user's INTENT, not just emotion. Eliminate films with ZERO thematic connection to it
- Among relevant films, prefer higher original similarity scores
- If no films are thematically connected, fall back to the best emotional matches (don't return empty)
- Each reason says why this film suits THIS mood tonight, not what the film is about. ONE sentence, at most ${REASON_MAX_WORDS} words. Do not repeat the film title and do not summarize the plot. Speak to the viewer's evening. Write it in the same language as the user's mood text (Turkish mood text → Turkish reason, otherwise English)
- Use only facts visible in the candidate line; never invent plot details
- Never write factual claims or numbers: no runtime, year, cast, awards or counts. Do not make a film sound lighter or heavier than it is; if the fit is weak, say so more cautiously (e.g. "a bit more serious than usual, but ...")
- "n" is the integer before the film in the candidate list

English reasons (good examples, for the mood "tired Friday, something warm and clever"):
  "Warm enough to unwind, sharp enough that your brain still plays."
  "A twisty mystery that asks for attention, not energy: right for tonight."
  "Gentle and funny, with a small twist that won't wear you out."

Turkish reasons (when the mood text is Turkish):
- Write plain spoken everyday Turkish (günlük konuşma Türkçesi), the way you would text a friend. Prefer short, common words over literary or invented ones. If a word or phrase sounds like a translation from English, rewrite the sentence with simpler words
- Natural, everyday Turkish, like a friend recommending a film. No English words and no half-translations: say "son sürpriz" instead of "twist", "gerilim" instead of "thriller", "hikâye" instead of "plot", "rahatlatıcı" instead of "feel-good", "hava" instead of "vibe"
- Do not invent Turkish words. If unsure how to say something, use a simpler word you are sure about
- Bad examples (never write like this):
  BAD: "yatışlayıcı görüntüler" — "yatışlayıcı" is an invented word, nobody says it. Say "sakin görüntüler" instead
  BAD: "Parizyalı çekintisizliği" — a word-for-word calque of an English phrase, it sounds translated and means nothing in everyday Turkish. Say "Paris'te geçen hafif, rahat bir hikâye" instead
- Do not mention the film title. Max ${REASON_MAX_WORDS} words, one sentence. Good examples:
  "Yorgun bir akşama göre: sıcak, hafif ve sonunda küçük bir sürpriz."
  "Yağmurlu bir akşam için yavaş, sakin ve içine çeken bir hikâye."
  "Kafanı yormadan güldürür; arkadaşlarla rahatça izlenecek bir akşam filmi."

Return ONLY valid JSON, no explanation:
[{"n": 3, "r": "reason"}, {"n": 12, "r": "reason"}]`
