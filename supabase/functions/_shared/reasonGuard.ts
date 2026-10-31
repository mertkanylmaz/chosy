/**
 * Rerank gerekçesi için ucuz sunucu denetimi (MOOD-VEC-2d). Saf fonksiyonlar.
 *
 * TR gerekçede bilinen İngilizce sızıntı ("twist", "plot", "thriller"…) veya gözlenmiş bozuk
 * Türkçe biçim varsa o gerekçe BOŞ döner; UI gerekçesiz gösterir. Yanlış/bozuk metin göstermek
 * yerine göstermemek. Liste elle bakımlıdır; yeni sızıntı gözlenince eklenir.
 */

/** İngilizce sızıntı terimleri. Boşluklu/tireli terimler ayraç farkını tolere eder. */
export const EN_LEAK_TERMS: readonly string[] = [
  'twist', 'plot', 'thriller', 'feel-good', 'vibe', 'mood', 'storyline', 'cliffhanger',
  'jump scare', 'binge', 'blockbuster', 'sci-fi', 'rom-com', 'slow burn', 'cringe',
  'underrated', 'comfort', 'happy ending',
]

/** Eval'de gözlenen sözlükte olmayan biçimler (CTO V3 puanlaması). */
export const BAD_TR_FORMS: readonly string[] = ['şaşırtmazlık', 'kıcık']

const TR_LETTERS = 'a-zçğıöşü'
const TR_CHAR_RE = /[çğıöşüÇĞİÖŞÜ]/
const TR_HINT_WORDS = new Set([
  'bir', 've', 'için', 'ile', 'istiyorum', 'izlemek', 'gibi', 'çok', 'ama', 'bugün', 'bana', 'beni',
])

const lower = (s: string): string => s.toLocaleLowerCase('tr')

/** Metin Türkçe mi: Türkçe'ye özgü harf ya da yaygın Türkçe sözcük var. */
export function looksTurkish(text: string): boolean {
  if (TR_CHAR_RE.test(text)) return true
  return lower(text).split(/[^a-zçğıöşü]+/).some((w) => TR_HINT_WORDS.has(w))
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** "feel-good" → feel[- ]?good ; "jump scare" → jump[- ]?scare. */
function termPattern(term: string): string {
  return term.split(/[- ]/).map(escapeRe).join('[- ]?')
}

// Sözcük başı sınırı + en çok 8 harflik Türkçe ek ("twistelleri", "thriller'ı", "vibe'ı").
const LEAK_RES: RegExp[] = EN_LEAK_TERMS.map(
  (t) => new RegExp(`(?<![${TR_LETTERS}])${termPattern(t)}(?:['’]?[${TR_LETTERS}]{0,8})(?![${TR_LETTERS}])`, 'u'),
)

/** Gerekçede sızıntı/bozuk biçim varsa ilk eşleşen terimi, yoksa null döner. */
export function findLeak(reason: string): string | null {
  const text = lower(reason)
  for (const bad of BAD_TR_FORMS) if (text.includes(bad)) return bad
  for (let i = 0; i < LEAK_RES.length; i++) if (LEAK_RES[i].test(text)) return EN_LEAK_TERMS[i]
  return null
}

/**
 * Denetimden önce filmin başlıkları (title, original_title) gerekçeden çıkarılır:
 * "Twister" / "Mood Indigo" gibi adlar sızıntı sayılmasın. Büyük/küçük harf duyarsız.
 */
export function stripTitles(reason: string, titles: readonly string[]): string {
  // Locale'siz küçültme: "TWISTER" ↔ "Twister" tr kuralında (I→ı) eşleşmezdi.
  let text = reason.toLowerCase()
  for (const title of titles) {
    const t = title.toLowerCase().trim()
    if (t.length >= 2) text = text.split(t).join(' ')
  }
  return text
}

export interface GuardResult {
  /** film id → gerekçe; denetimden geçmeyen TR gerekçe '' olur (anahtar korunur). */
  reasons: Record<string, string>
  /** Boşaltılan film id'leri. */
  dropped: string[]
}

/**
 * Türkçe mood metni (veya Türkçe görünen gerekçe) için sızıntı denetimi. İngilizce gerekçelere
 * dokunmaz.
 */
export function guardReasons(
  reasons: Record<string, string>,
  moodText: string,
  /** film id → [title, original_title]; yoksa başlık çıkarılmaz. */
  titlesById: Record<string, readonly string[]> = {},
): GuardResult {
  const moodTr = looksTurkish(moodText)
  const out: Record<string, string> = {}
  const dropped: string[] = []
  for (const [id, reason] of Object.entries(reasons)) {
    if ((moodTr || looksTurkish(reason)) && findLeak(stripTitles(reason, titlesById[id] ?? [])) !== null) {
      out[id] = ''
      dropped.push(id)
    } else {
      out[id] = reason
    }
  }
  return { reasons: out, dropped }
}
