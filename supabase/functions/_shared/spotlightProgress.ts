/**
 * Spotlight V3 — get-daily-challenge progress alanlari (saf fonksiyon, P-3d).
 *
 * Yeniden acilista istemci denenmis harfleri, acilmis pozisyonlari ve kalan
 * hakki sunucudan almali. Eskiden `get-daily-challenge` bunlari dondurmuyordu:
 * yarida birakilan oyun bos maske, isaretsiz tuslar ve 6 hakla aciliyor,
 * denenmis harfe basmak LETTER_ALREADY_TRIED (400) uretiyordu; biten oyun
 * "0 harfle buldun" diyordu.
 *
 * HARD RULE 1: baslik ve acilmamis karakterler ASLA donmez. Yalniz oyuncunun
 * KENDI actigi pozisyonlar (`spotlight_revealed`, submit-guess harf dalinin
 * yazdigi) ve denedigi harfler (isabet + iska) doner — submit-guess harf
 * yanitinin zaten dondurdugu ayni veri. Cikti BEYAZ LISTE ile kurulur:
 * `progress_json`'daki baska hicbir alan (ileride eklenebilecek olanlar dahil)
 * bu fonksiyondan gecemez.
 *
 * Bozuk girdi sessizce yutulmaz: dusurulen oge sayisi `dropped` ile doner,
 * cagiran Sentry'ye yazar.
 */

export interface SpotlightRevealedChar {
  pos: number
  ch: string
}

export interface SpotlightProgressFields {
  spotlight_letters: string[]
  spotlight_revealed: SpotlightRevealedChar[]
}

export interface SpotlightProgressResult {
  fields: SpotlightProgressFields
  /** Beyaz listeye uymayan, dusurulen oge sayisi (harf + pozisyon) */
  dropped: number
}

/** Klavye A-Z; submit-guess `normalizeLetter` ciktisi tek buyuk harf */
const LETTER_RE = /^[A-Z]$/

function isRevealedChar(v: unknown): v is SpotlightRevealedChar {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  return (
    Number.isInteger(r.pos) &&
    (r.pos as number) >= 0 &&
    typeof r.ch === 'string' &&
    [...(r.ch as string)].length === 1
  )
}

/**
 * `progress_json`'dan Spotlight alanlarini beyaz listeyle cikarir.
 * Alan yoksa bos dizi (oyuncu henuz harf denememis).
 */
export function spotlightProgressFields(progressJson: unknown): SpotlightProgressResult {
  const pj = (typeof progressJson === 'object' && progressJson !== null
    ? progressJson
    : {}) as Record<string, unknown>

  let dropped = 0

  const rawLetters = Array.isArray(pj.spotlight_letters) ? pj.spotlight_letters : []
  const spotlight_letters: string[] = []
  for (const l of rawLetters) {
    if (typeof l === 'string' && LETTER_RE.test(l)) spotlight_letters.push(l)
    else dropped++
  }

  const rawRevealed = Array.isArray(pj.spotlight_revealed) ? pj.spotlight_revealed : []
  const spotlight_revealed: SpotlightRevealedChar[] = []
  for (const r of rawRevealed) {
    // Yalniz {pos, ch} kopyalanir — nesnedeki baska anahtar disari cikmaz
    if (isRevealedChar(r)) spotlight_revealed.push({ pos: r.pos, ch: r.ch })
    else dropped++
  }

  return { fields: { spotlight_letters, spotlight_revealed }, dropped }
}
