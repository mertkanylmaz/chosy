/**
 * Spotlight V3 — harf eslestirme (saf fonksiyonlar).
 *
 * Bu mantik submit-guess icinde satir arasindaydi ve test edilemiyordu;
 * `ı/i/I` asimetrisi de orada gizlenmisti. Tek kaynak burasi — istemcide
 * kopyasi YOKTUR (Hard Rule 2: dogrulama yalnizca sunucuda).
 *
 * LOCALE NOTU: `films.title` TMDB'den `language=en-US` zorlanarak yaziliyor
 * (scripts/lib/tmdb-client.ts:99). Eskiden burada `toLocaleUpperCase('tr-TR')`
 * kullaniliyordu ve Deno'nun tam ICU'su ile 'i' → 'İ' uretiyordu; klavyeden
 * gelen 'I' ile eslesmedigi icin "Titanic" gibi basliklarda I tusu bos
 * donuyor ve oyuncudan bir hak goturuyordu. Bu bir karakter eslestirme isi,
 * locale isi degil — locale'siz `toUpperCase()` kullanilir.
 */

/** Denenen harfi kanonik forma getirir (locale'siz buyuk harf). */
export function normalizeLetter(raw: string): string {
  return raw.trim().toUpperCase()
}

// ─── Karakter siniflandirmasi ────────────────────────────────────────────────

/**
 * Bir baslik karakterinin oyundaki rolu.
 *
 *   'slot'        — tahmin edilecek yuva; klavyede (A-Z) karsiligi VAR
 *   'sep'         — bastan gorunur (rakam, noktalama, bosluk)
 *   'unreachable' — harf ama klavyeyle acilamaz ('ü', 'é', 'İ', Kiril...)
 */
export type CharClass = 'slot' | 'sep' | 'unreachable'

/**
 * Karakteri siniflandirir. Klavye duzeni A-Z oldugu icin olcut sabit:
 * "normalizeLetter() sonucu tek bir A-Z harfi mi?"
 *
 * Dikkat: olcut "ASCII mi" DEGIL. Noktasiz 'ı' → 'I' oldugu icin oynanabilir
 * ve 'slot' sayilir; 'ü' → 'Ü' oldugu icin sayilmaz. 'ß' gibi iki karaktere
 * acilanlar da (→ 'SS') tek tusla eslesemez, 'unreachable'dir.
 *
 * Harf olmayan her sey 'sep': rakamlar, noktalama, bosluk ve Latin disi
 * rakam/simge (⁴, ೧ ...). Bunlarin klavyede tusu yok; yuva olarak birakmak
 * asla acilamayacak olu hucre demek.
 */
export function classifyChar(ch: string): CharClass {
  if (!/\p{L}/u.test(ch)) return 'sep'
  return /^[A-Z]$/.test(normalizeLetter(ch)) ? 'slot' : 'unreachable'
}

/** Maske tokeni — istemci yalnizca bu yapiyi gorur, harfleri gormez */
export interface TitleMaskToken {
  /** 'slot' = tahmin edilecek karakter · 'sep' = gorunur ayrac */
  t: 'slot' | 'sep'
  /** Yalnizca 'sep' icin: gorunen karakter (bosluk, tire, rakam...) */
  c?: string
}

/** `buildTitleMask()` sonucu */
export interface TitleMaskResult {
  tokens: TitleMaskToken[]
  /**
   * YALNIZCA 'slot' sayisi — rakam ve noktalama dahil DEGIL.
   *
   * Bu deger puzzle_data.letter_count olarak iniyor ve istemcide blur'un
   * paydasi. Rakamlar sayilinca "Toy Story 3"te tum harfler acilsa bile
   * oran 8/9 kaliyor, gorsel hicbir zaman tam netlesmiyordu.
   */
  slotCount: number
  /** Klavyeyle acilamayacak harf var mi — varsa bulmaca uretilmemeli */
  hasUnreachable: boolean
  /** Reddi loglamak icin: bulunan acilamaz karakterler */
  unreachableChars: string[]
}

/**
 * Basligi maskeye cevirir.
 *
 * 'slot' ve 'sep' ayrimi `classifyChar()`ten gelir; pozisyon indeksleri
 * `[...title]` code point sirasidir — `findLetterPositions()` ile birebir
 * ayni, aksi halde acilan harf yanlis kutuya duserdi.
 */
export function buildTitleMask(title: string): TitleMaskResult {
  const tokens: TitleMaskToken[] = []
  const unreachableChars: string[] = []
  let slotCount = 0

  for (const ch of title) {
    const cls = classifyChar(ch)
    if (cls === 'slot') {
      tokens.push({ t: 'slot' })
      slotCount++
    } else if (cls === 'sep') {
      tokens.push({ t: 'sep', c: ch })
    } else {
      // Maskeye yine de bir sey koymuyoruz: bu baslik reddedilecek.
      unreachableChars.push(ch)
    }
  }

  return {
    tokens,
    slotCount,
    hasUnreachable: unreachableChars.length > 0,
    unreachableChars,
  }
}

/**
 * Bir harfin baslikta gectigi TUM pozisyonlar.
 *
 * Indeksleme `[...title]` (code point) uzerinden — generate-puzzles'daki
 * `buildTitleMask()` ile ayni, boylece pozisyonlar maske indeksleriyle birebir.
 *
 * @param title  Cozum filminin basligi (sunucuda kalir, istemciye inmez)
 * @param letter Oyuncunun denedigi harf — `normalizeLetter()` gecmis olmali
 */
export function findLetterPositions(title: string, letter: string): number[] {
  const positions: number[] = []
  const chars = [...title]
  chars.forEach((ch, i) => {
    if (ch.toUpperCase() === letter) positions.push(i)
  })
  return positions
}
