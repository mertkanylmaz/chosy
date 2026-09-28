/**
 * Unit tests — şampiyon hero geçişinin kontrast ölçümü (V-3 Tur G2, C1).
 *
 * En kötü durum: bloğun başladığı satırın arkasında SAF BEYAZ poster pikseli,
 * en kısa desteklenen pencere (iPhone SE 1. nesil sınıfı, 568pt).
 * Karışım sRGB kodlu uzayda (`utils/oklch.ts` compositeOver — compositor taklidi).
 * Run: npm run test:champion
 *   (`--unstable-sloppy-imports`: utils/oklch.ts'in `@/types/gauntlet` tip
 *   import'u uzantısız — Metro yolu; Deno'da bu bayrakla çözülür.)
 */

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  MIN_WINDOW_HEIGHT,
  alphaAtKickerBottom,
  alphaAtOverlapStart,
  scrimAlphaAt,
  topScrimAlphaAt,
} from '../../components/gauntlet/ChampionReveal/heroScrim.ts'
import { palette } from '../../constants/design/primitives.ts'
import { compositeOver, contrastRatio } from '../../utils/oklch.ts'

const WHITE = '#FFFFFF'
const WCAG_AA = 4.5

/** Metnin (opaklığıyla) geçiş+beyaz poster üstündeki kontrastı. */
function worstCaseContrast(windowHeight: number, text: string, textAlpha: number): number {
  const bg = compositeOver(WHITE, palette.ink, alphaAtOverlapStart(windowHeight))
  const fg = compositeOver(bg, text, textAlpha)
  return contrastRatio(fg, bg)
}

Deno.test('scrimAlphaAt: duraklarda ve ara değerde doğru', () => {
  assertEquals(scrimAlphaAt(0), 0)
  assertEquals(scrimAlphaAt(0.5), 0.7)
  assertEquals(scrimAlphaAt(1), 1)
  assertEquals(scrimAlphaAt(0.75), 0.85)
  assertEquals(scrimAlphaAt(-1), 0)
  assertEquals(scrimAlphaAt(2), 1)
})

// Ölçülen cihaz yükseklikleri: SE1 568, SE2/3 667, Pro Max 932.
for (const h of [MIN_WINDOW_HEIGHT, 667, 932]) {
  Deno.test(`kontrast ≥ 4.5 — pencere ${h}pt, saf beyaz poster`, () => {
    const alpha = alphaAtOverlapStart(h)
    const title = worstCaseContrast(h, palette.bone, 1)
    // Reduce Transparency / bayat göstergede etiket yine bloğun EN ÜST
    // satırında durabilir — `bone@80%` (color.text.primarySoft).
    const kicker = worstCaseContrast(h, palette.bone, 0.8)
    console.log(
      `  ${h}pt: ink alfa ${alpha.toFixed(3)} · başlık ${title.toFixed(2)}:1 · etiket ${kicker.toFixed(2)}:1`,
    )
    assert(title >= WCAG_AA, `başlık ${title.toFixed(2)}:1 < 4.5`)
    assert(kicker >= WCAG_AA, `etiket ${kicker.toFixed(2)}:1 < 4.5`)
  })
}

Deno.test('topScrimAlphaAt: duraklarda ve dışında doğru', () => {
  assertEquals(topScrimAlphaAt(0), 0.85)
  assertEquals(topScrimAlphaAt(0.6), 0.8)
  assertEquals(topScrimAlphaAt(1), 0)
  assertEquals(topScrimAlphaAt(-1), 0.85)
  assertEquals(topScrimAlphaAt(2), 0)
})

// V-3 referans uyumu: etiket hero'nun tepesinde. En kötü durum etiket
// satırının ALT kenarı (geçiş aşağı açılıyor) + saf beyaz poster.
// Güvenli alan üstü: SE 20 · çentik 47 · Dynamic Island 59 · 16 Pro 62.
for (const inset of [20, 47, 59, 62]) {
  Deno.test(`üst etiket kontrastı ≥ 4.5 — güvenli alan ${inset}pt, saf beyaz poster`, () => {
    const alpha = alphaAtKickerBottom(inset)
    const bg = compositeOver(WHITE, palette.ink, alpha)
    const fg = compositeOver(bg, palette.bone, 0.8)
    const ratio = contrastRatio(fg, bg)
    console.log(`  inset ${inset}pt: ink alfa ${alpha.toFixed(3)} · etiket ${ratio.toFixed(2)}:1`)
    assert(ratio >= WCAG_AA, `üst etiket ${ratio.toFixed(2)}:1 < 4.5`)
  })
}
