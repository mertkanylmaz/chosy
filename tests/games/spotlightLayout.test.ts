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

import {
  assert,
  assertAlmostEquals,
  assertEquals,
} from 'https://deno.land/std@0.208.0/assert/mod.ts'

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
  SEARCH_CLOSE_ROW_H,
  dropdownMaxHeight,
} from '../../components/games/FilmSearchInput/dropdownHeight.ts'
import { chanceStates } from '../../components/games/Spotlight/chances.ts'
import {
  STILL_ASPECT,
  coverVisibleFraction,
  stillHeightFor,
} from '../../components/games/Spotlight/stillLayout.ts'

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

/*
 * Alt kenar modeli (iOS, P-2d):
 *   RN `KeyboardAvoidingView behavior="padding"` kapsayicinin
 *   `paddingBottom`'unu KENDI degeriyle EZER
 *   (react-native/Libraries/Components/Keyboard/KeyboardAvoidingView.js:279,
 *   `compose(style, {paddingBottom: bottomHeight})`). Bu yuzden GameShell alt
 *   payi (bottomPad = max(insets.bottom, 8)) KAV'a degil icerik View'ina
 *   verir ve `keyboardVerticalOffset = −bottomPad` gecer:
 *     klavye kapali → KAV 0 + icerik bottomPad
 *     klavye acik   → KAV (klavye − bottomPad) + icerik bottomPad = klavye
 *   (tam ekran cerceve; KAV payi = cerceve alti − (klavye Y'si + bottomPad)).
 *
 * Tab bar payi YOK: oyun ekranlari `(tabs)` disinda (app/games/), GameShell
 * sabit 83'u bu yuzden kaldirdi (components/games/GameShell/index.tsx:355).
 */
const SE_H = 667
const SE_CONTENT_TOP = 20 + 68 + 21
const ACTION_BAR_H = 216
const SCREEN_PAD_BOTTOM = 8
const SCREEN_GAP = 16
const SEARCH_INPUT_H = 52

/** GameShell'in toplam alt payi — yukaridaki alt kenar modeli */
function shellBottom(bottomInset: number, keyboardH: number): number {
  const bottomPad = Math.max(bottomInset, 8)
  const kavPad = keyboardH > 0 ? Math.max(keyboardH - bottomPad, 0) : 0
  return kavPad + bottomPad
}

/**
 * Klavye acikken input'un ust Y'si — KeyboardAvoidingView (padding) icerigi
 * klavyenin ustunde bitirir; input aksiyon barinin en altinda.
 */
function inputTopWithKeyboard(windowH: number, keyboardH: number): number {
  return windowH - shellBottom(0, keyboardH) - SCREEN_PAD_BOTTOM - SEARCH_INPUT_H
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

/** Sonuc satiri = paddingVertical 8×2 + poster 54 + hairline 0.5 (SE @2x) */
const RESULT_ROW_H = 70.5
/** Dropdown kenarligi ust + alt */
const DROPDOWN_BORDER = 2

Deno.test('P-3 Kapat satiri: SE + QuickType 260 ile ~2.67 sonuc satiri gorunur (eskiden ~3.29)', () => {
  const h = dropdownMaxHeight({ inputTopY: inputTopWithKeyboard(SE_H, 260), boundaryTopY: SE_CONTENT_TOP })
  const withClose = (h - DROPDOWN_BORDER - SEARCH_CLOSE_ROW_H) / RESULT_ROW_H
  const without = (h - DROPDOWN_BORDER) / RESULT_ROW_H
  assertAlmostEquals(withClose, 2.67, 0.01)
  assertAlmostEquals(without, 3.29, 0.01)
  assert(withClose >= 2, 'en az 2 tam sonuc satiri gorunmeli')
})

// ─── Aksiyon bari modeli ─────────────────────────────────────────────────────

Deno.test('klavye acikken toplam alt pay = klavye yuksekligi (inset cift sayilmaz)', () => {
  for (const inset of [0, 34]) {
    for (const kb of [216, 260, 336]) {
      assertEquals(shellBottom(inset, kb), kb, `inset=${inset} klavye=${kb}`)
    }
  }
})

Deno.test('klavye kapaliyken alt pay = max(inset, 8): SE 8, Face ID 34', () => {
  assertEquals(shellBottom(0, 0), 8)
  assertEquals(shellBottom(34, 0), 34)
})

Deno.test('SE + klavye + QuickType: ust bolge 58pt — aksiyon bari itilmez', () => {
  assertEquals(topRegionH(SE_H, SE_CONTENT_TOP, 0, 260), 58)
})

// ─── Kare kutusu 16:9 (P-2) ──────────────────────────────────────────────────

/** Kare kutusu genisligi = ekran − 2×16 (GameShell) */
const stillW = (screenW: number) => screenW - 32
/** Beau Travail backdrop'u — 4 Eki 2026'da indirilip olculdu */
const BEAU_TRAVAIL = { width: 1920, height: 1080 }

Deno.test('kutu orani 16:9 sabit', () => {
  assertEquals(STILL_ASPECT, 16 / 9)
  for (const screenW of [375, 393, 430]) {
    const w = stillW(screenW)
    assertAlmostEquals(w / stillHeightFor(w), 16 / 9, 1e-9)
  }
})

Deno.test('16:9 kaynak 16:9 kutuda kirpilmaz — her cihazda gorunur %100', () => {
  for (const screenW of [375, 393, 430]) {
    const w = stillW(screenW)
    const v = coverVisibleFraction({ width: w, height: stillHeightFor(w) }, BEAU_TRAVAIL)
    assertAlmostEquals(v.x, 1, 1e-9)
    assertAlmostEquals(v.y, 1, 1e-9)
  }
})

Deno.test('eski 361×380 kutu kaynagin yalniz ~%53\'unu gosteriyordu (P-2 kesif)', () => {
  const v = coverVisibleFraction({ width: 361, height: 380 }, BEAU_TRAVAIL)
  assertAlmostEquals(v.x, 0.5343, 1e-3)
  assertEquals(v.y, 1)
})

/** stillWrap.marginTop — karenin ust bolgedeki ust payi */
const STILL_MARGIN_TOP = 8

/**
 * Oynanis ust bolgesi (kayan alan). Olculer kod okumasindan:
 *   GameShell alt payi (shellBottom, alt kenar modeli) · screen paddingBottom 8 ·
 *   screen gap 16 · aksiyon bari 216 (dosya basi).
 */
function topRegionH(
  windowH: number,
  contentTop: number,
  bottomInset: number,
  keyboardH: number,
): number {
  return windowH - contentTop - shellBottom(bottomInset, keyboardH) - SCREEN_PAD_BOTTOM -
    SCREEN_GAP - ACTION_BAR_H
}
/**
 * Ust icerik = stillWrap.marginTop 8 + kare + topContent.gap 16 +
 * maske etiketi 14 + maskBlock.gap 16 + satirlar (32×n + 4×(n−1)).
 */
function topContentH(screenW: number, maskRows: number): number {
  const rows = 32 * maskRows + 4 * (maskRows - 1)
  return STILL_MARGIN_TOP + stillHeightFor(stillW(screenW)) + 16 + 14 + 16 + rows
}
/**
 * Karenin gorunen yuksekligi — ust bolge kaydirilmamisken (offset 0).
 * Odakta scrollTo yok; KAV alani alttan daraltir, kare alttan kirpilir.
 */
function stillVisibleH(screenW: number, topRegion: number): number {
  return Math.max(0, Math.min(stillHeightFor(stillW(screenW)), topRegion - STILL_MARGIN_TOP))
}

Deno.test('SE: aksiyon bari (harf klavyesi + arama kutusu) sigar, ust bolge 310pt', () => {
  assertEquals(topRegionH(SE_H, SE_CONTENT_TOP, 0, 0), 310)
})

Deno.test('SE: kare + tek satir maske ust bolgeye sigar, artan alan maske ile klavye arasinda', () => {
  const spare = topRegionH(SE_H, SE_CONTENT_TOP, 0, 0) - topContentH(375, 1)
  assertAlmostEquals(spare, 31.06, 0.01)
})

Deno.test('SE: iki satir maske (tam olcek) ust bolgeyi ~4.94pt asar — bolge kayar, aksiyon bari itilmez', () => {
  // Eski dinamik hesap SE'de bu durumda kareyi 188pt'ye indiriyordu; 16:9 kare
  // 192.94pt. Fark kayan ust bolgeye duser (Kural 7 istisnasi, KAPSAM_KILIDI v1.36).
  const overflow = topContentH(375, 2) - topRegionH(SE_H, SE_CONTENT_TOP, 0, 0)
  assertAlmostEquals(overflow, 4.94, 0.01)
})

Deno.test('Pro Max: kare + iki satir maske rahat sigar, ~164pt artar', () => {
  // 932pt, safe-area ust 59 + header 68 + progress 21, alt inset 34
  const spare = topRegionH(932, 59 + 68 + 21, 34, 0) - topContentH(430, 2)
  assertAlmostEquals(spare, 164.13, 0.01)
})

// ─── Sistem klavyesi acikken gorunen kare (P-2d) ─────────────────────────────

Deno.test('SE + klavye 260 (QuickType): karenin 192.94pt\'sinin yalniz 50pt\'si gorunur', () => {
  const visible = stillVisibleH(375, topRegionH(SE_H, SE_CONTENT_TOP, 0, 260))
  assertEquals(visible, 50)
  assertAlmostEquals(visible / stillHeightFor(stillW(375)), 0.259, 1e-3)
})

Deno.test('SE + klavye 216: karenin yalniz 94pt\'si gorunur', () => {
  assertEquals(stillVisibleH(375, topRegionH(SE_H, SE_CONTENT_TOP, 0, 216)), 94)
})

/**
 * Regresyon kilidi (P-2d): alt payin icerik View'ina tasinmasi klavye ACIK
 * rakamlari degistirmemeli. Degerler 6e44b87'deki (KAV payi ezerken) modelin
 * ciktisidir; ofset −bottomPad toplami klavyeye esitler, inset fark etmez.
 */
Deno.test('regresyon: klavye acik 58/50/94 alt pay tasinmasindan etkilenmez', () => {
  for (const inset of [0, 34]) {
    assertEquals(topRegionH(SE_H, SE_CONTENT_TOP, inset, 260), 58, `inset=${inset}`)
    assertEquals(stillVisibleH(375, topRegionH(SE_H, SE_CONTENT_TOP, inset, 260)), 50)
    assertEquals(stillVisibleH(375, topRegionH(SE_H, SE_CONTENT_TOP, inset, 216)), 94)
  }
})

// ─── Hak noktalari ───────────────────────────────────────────────────────────

Deno.test('hak noktalari: sayi = max, dolu = kalan, yalniz azalir', () => {
  assertEquals(chanceStates(6, 6), [true, true, true, true, true, true])
  assertEquals(chanceStates(6, 4), [true, true, true, true, false, false])
  assertEquals(chanceStates(6, 0).filter(Boolean).length, 0)
  assertEquals(chanceStates(6, 0).length, 6)
})

Deno.test('hak noktalari: tasan / negatif deger kenetlenir, sayi degismez', () => {
  assertEquals(chanceStates(5, 9).length, 5)
  assertEquals(chanceStates(5, 9).filter(Boolean).length, 5)
  assertEquals(chanceStates(5, -2).filter(Boolean).length, 0)
})
