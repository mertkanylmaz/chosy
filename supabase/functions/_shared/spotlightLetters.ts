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

// ─── Harf adimi kararlari (saf, test edilebilir) ─────────────────────────────

/**
 * Basligin TUM 'slot' pozisyonlari acildi mi.
 *
 * 'sep' (bosluk, rakam, noktalama) bastan gorunur, 'unreachable' harfli baslik
 * zaten uretilmez; olcut `classifyChar` ile maskenin slot tanimiyla ayni.
 */
export function allSlotsRevealed(title: string, revealedPositions: readonly number[]): boolean {
  const open = new Set(revealedPositions)
  let slots = 0
  let i = 0
  for (const ch of title) {
    if (classifyChar(ch) === 'slot') {
      slots++
      if (!open.has(i)) return false
    }
    i++
  }
  return slots > 0
}

/** Harf istegi on kontrolu — hata ise sunucunun donecegi kod, degilse null */
export interface LetterPrecheckError {
  code: 'ALREADY_COMPLETED' | 'MAX_ATTEMPTS' | 'LETTER_ALREADY_TRIED'
  message: string
  status: number
}

export function letterPrecheck(input: {
  completed: boolean
  attempts: number
  maxAttempts: number
  triedLetters: readonly string[]
  letter: string
}): LetterPrecheckError | null {
  if (input.completed) {
    return { code: 'ALREADY_COMPLETED', message: 'Puzzle already completed', status: 409 }
  }
  if (input.attempts >= input.maxAttempts) {
    return { code: 'MAX_ATTEMPTS', message: 'No more attempts remaining', status: 409 }
  }
  if (input.triedLetters.includes(input.letter)) {
    return { code: 'LETTER_ALREADY_TRIED', message: 'Letter already guessed', status: 400 }
  }
  return null
}

export interface LetterOutcome {
  attemptsAfter: number
  outOfAttempts: boolean
  /** Tum slotlar acildi ve istemci `supports_auto_win` gonderdi */
  autoWin: boolean
  completed: boolean
  won: boolean
}

/**
 * Bir harf adiminin sonucu.
 *
 * Otomatik kazanim YALNIZ `supportsAutoWin` ise: eski istemci `won`'u okumaz ve
 * `completed:true` gorunce kaybetti ekrani gosterir. Bayrak yoksa sonuc
 * bugunkuyle birebir ayni (yanlis harf hak goturur, hak bitince kapanir).
 * Otomatik kazanim ekstra hak harcamaz.
 */
export function decideLetterOutcome(input: {
  hit: boolean
  attemptsBefore: number
  maxAttempts: number
  allRevealed: boolean
  supportsAutoWin: boolean
}): LetterOutcome {
  const autoWin = input.supportsAutoWin && input.allRevealed
  const attemptsAfter = autoWin || input.hit ? input.attemptsBefore : input.attemptsBefore + 1
  const outOfAttempts = !autoWin && attemptsAfter >= input.maxAttempts
  return {
    attemptsAfter,
    outOfAttempts,
    autoWin,
    completed: autoWin || outOfAttempts,
    won: autoWin,
  }
}

/**
 * Otomatik kazanimin XP basamagi: film tahmini kazanimiyla ayni merdiven.
 * O yolda indeks `newAttempts - 1` (newAttempts = harcanan hak + 1); burada
 * ekstra hak yok, indeks harcanan hakka (`attemptsAfter`) esit.
 */
export function autoWinLadderIndex(attemptsAfter: number, ladderLength: number): number {
  return Math.min(attemptsAfter, ladderLength - 1)
}
