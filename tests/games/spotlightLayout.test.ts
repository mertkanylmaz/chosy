/**
 * Unit tests — Spotlight baslik maskesi yerlesimi + FilmSearchInput dropdown
 * yuksekligi (B-1 / Fix 8).
 *
 * Bu testler SAF HESABI dogrular; RN flex yerlesimini calistirmaz. Cihaz
 * dogrulamasi (K-57) ayrica gerekir — test matrisi Fix 8 raporunda.
 *
 * Cihaz olculeri kod okumasindan:
 *   - Maske satir genisligi = ekran − 2×16 (GameShell) − 2×8 (maskRow padding)
 *     iPhone SE 375pt → 327 · Pro Max 430pt → 382
 *   - GameShell icerik ustu (SE) = safe-area 20 + header 68 + progress 21 = 109
 *   - Aksiyon bari = harf klavyesi 3×42 + 2×4 + gap 8 + etiket 14 + gap 8 + input 52 = 216
 *
 * Run: npm run test:spotlight-layout
 */

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  MASK_MIN_SCALE,
  MASK_TARGET_ROWS,
  countMaskRows,
  fitMaskScale,
  groupMaskWords,
  type MaskTokenShape,
} from '../../components/games/Spotlight/maskLayout.ts'
import {
  DROPDOWN_GAP,
  DROPDOWN_MAX_H,
  dropdownMaxHeight,
} from '../../components/games/FilmSearchInput/dropdownHeight.ts'

const SE_ROW_W = 375 - 32 - 16
const PRO_MAX_ROW_W = 430 - 32 - 16

/** Sunucu maskesinin istemci tarafi taklidi: harf → slot, digerleri → sep */
function maskOf(title: string): MaskTokenShape[] {
  return [...title].map((ch) =>
    /[A-Za-z]/.test(ch) ? { t: 'slot' as const } : { t: 'sep' as const, c: ch },
  )
}

// ─── Kelime gruplama ─────────────────────────────────────────────────────────

Deno.test('kelimeler bosluktan bolunur, indeksler korunur', () => {
  const words = groupMaskWords(maskOf('Up in Air'))
  assertEquals(words.length, 3)
  assertEquals(words.map((w) => w.map((c) => c.index)), [[0, 1], [3, 4], [6, 7, 8]])
})

Deno.test('tire ve iki nokta kelimenin icinde kalir', () => {
  const words = groupMaskWords(maskOf('Spider-Man: Homecoming'))
  assertEquals(words.length, 2)
  // "Spider-Man:" = 11 hucre, ayraclar dahil
  assertEquals(words[0].length, 11)
  assertEquals(words[0][6].token, { t: 'sep', c: '-' })
})

Deno.test('ardisik bosluk ve c-siz ayrac bos kelime uretmez', () => {
  const mask: MaskTokenShape[] = [
    { t: 'slot' }, { t: 'sep', c: ' ' }, { t: 'sep' }, { t: 'slot' },
  ]
  assertEquals(groupMaskWords(mask).length, 2)
})

// ─── Olcek ───────────────────────────────────────────────────────────────────

/** fitMaskScale sozlesmesi: secilen olcek hedefe sigiyor ya da tabandadir */
function assertScaleContract(title: string, rowWidth: number): number {
  const words = groupMaskWords(maskOf(title))
  const scale = fitMaskScale(words, rowWidth)
  assert(scale >= MASK_MIN_SCALE && scale <= 1, `${title}: olcek aralik disi ${scale}`)
  if (scale > MASK_MIN_SCALE) {
    assert(
      countMaskRows(words, scale, rowWidth) <= MASK_TARGET_ROWS,
      `${title}: ${scale} olcekte ${MASK_TARGET_ROWS} satira sigmali`,
    )
  }
  return scale
}

Deno.test('kisa baslik tam olcekte, tek satir', () => {
  const words = groupMaskWords(maskOf('Heat'))
  assertEquals(fitMaskScale(words, SE_ROW_W), 1)
  assertEquals(countMaskRows(words, 1, SE_ROW_W), 1)
})

Deno.test('orta baslik tam olcekte 2 satir — kuculme yok', () => {
  assertEquals(assertScaleContract('The Silence of the Lambs', SE_ROW_W), 1)
})

Deno.test('SE: "Once Upon a Time in Hollywood" 0.8 tabaninda 2 satira iner', () => {
  const words = groupMaskWords(maskOf('Once Upon a Time in Hollywood'))
  assertEquals(countMaskRows(words, 1, SE_ROW_W), 3) // eski davranis: 3 satir
  assertEquals(fitMaskScale(words, SE_ROW_W), MASK_MIN_SCALE)
  assertEquals(countMaskRows(words, MASK_MIN_SCALE, SE_ROW_W), 2)
})

Deno.test('uzun baslik tabanda kalir, 3+ satir kayan bolgeye duser', () => {
  for (const title of [
    'Eternal Sunshine of the Spotless Mind',
    'Dr. Strangelove or: How I Learned to Stop Worrying and Love the Bomb',
  ]) {
    const words = groupMaskWords(maskOf(title))
    assertEquals(fitMaskScale(words, SE_ROW_W), MASK_MIN_SCALE, title)
    assert(countMaskRows(words, MASK_MIN_SCALE, SE_ROW_W) > MASK_TARGET_ROWS, title)
  }
})

Deno.test('Pro Max genisliginde ayni baslik daha az kuculur', () => {
  const se = assertScaleContract('Once Upon a Time in Hollywood', SE_ROW_W)
  const big = assertScaleContract('Once Upon a Time in Hollywood', PRO_MAX_ROW_W)
  assert(big >= se)
})

Deno.test('satirdan genis tek kelime hucre hucre kirilir (sonsuz dongu/0 satir yok)', () => {
  const words = groupMaskWords(maskOf('A ' + 'X'.repeat(30)))
  const rows = countMaskRows(words, MASK_MIN_SCALE, SE_ROW_W)
  assert(rows >= 3, `beklenen >=3, gelen ${rows}`)
})

Deno.test('bos maske 0 satir, olcek 1', () => {
  assertEquals(countMaskRows([], 1, SE_ROW_W), 0)
  assertEquals(fitMaskScale([], SE_ROW_W), 1)
})

// ─── Dropdown yuksekligi ─────────────────────────────────────────────────────

const SE_H = 667
const SE_CONTENT_TOP = 20 + 68 + 21
const ACTION_BAR_H = 216
const SCREEN_PAD_BOTTOM = 8
const SEARCH_INPUT_H = 52

/**
 * Klavye acikken input'un ust Y'si — KeyboardAvoidingView (padding) icerigi
 * klavyenin ustunde bitirir; input aksiyon barinin en altinda.
 */
function inputTopWithKeyboard(windowH: number, keyboardH: number): number {
  return windowH - keyboardH - SCREEN_PAD_BOTTOM - SEARCH_INPUT_H
}

Deno.test('SE + klavye 216: dropdown header altina sigar', () => {
  const inputTopY = inputTopWithKeyboard(SE_H, 216)
  const h = dropdownMaxHeight({ inputTopY, boundaryTopY: SE_CONTENT_TOP })
  assert(h <= DROPDOWN_MAX_H)
  assert(inputTopY - DROPDOWN_GAP - h >= SE_CONTENT_TOP, 'dropdown header ustune tasti')
  assert(h >= 70 * 3, `en az 3 sonuc satiri gorunmeli, gelen ${h}`)
})

Deno.test('SE + klavye + QuickType 260: eski sabit 280 header\'i orterdi, yeni hesap ortmez', () => {
  const inputTopY = inputTopWithKeyboard(SE_H, 260)
  // Eski davranis: 280 sabit → ust kenar header'in icinde
  assert(inputTopY - DROPDOWN_GAP - 280 < SE_CONTENT_TOP)
  const h = dropdownMaxHeight({ inputTopY, boundaryTopY: SE_CONTENT_TOP })
  assertEquals(inputTopY - DROPDOWN_GAP - h, SE_CONTENT_TOP)
  assert(h >= 70 * 3, `en az 3 sonuc satiri gorunmeli, gelen ${h}`)
})

Deno.test('bol alanda eski sabit korunur (FadeIn / CineMetrics davranisi degismez)', () => {
  assertEquals(dropdownMaxHeight({ inputTopY: 700, boundaryTopY: 109 }), DROPDOWN_MAX_H)
})

Deno.test('alan yoksa negatif degil 0', () => {
  assertEquals(dropdownMaxHeight({ inputTopY: 100, boundaryTopY: 109 }), 0)
})

// ─── Aksiyon bari modeli ─────────────────────────────────────────────────────

Deno.test('SE + klavye + QuickType: ust bolge >= 0 — aksiyon bari itilmez', () => {
  // Icerik alani = pencere − ust chrome − klavye; ust bolge kalanidir
  const content = SE_H - SE_CONTENT_TOP - 260
  const gap = 16
  const topRegion = content - SCREEN_PAD_BOTTOM - ACTION_BAR_H - gap
  assert(topRegion >= 0, `ust bolge ${topRegion}`)
})
