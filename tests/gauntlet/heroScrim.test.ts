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
  SCRIM_STOPS,
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
  assertEquals(scrimAlphaAt(0.4), 0.8)
  assertEquals(scrimAlphaAt(1), 1)
  assertEquals(scrimAlphaAt(0.2), 0.4)
  assertEquals(scrimAlphaAt(-1), 0)
  assertEquals(scrimAlphaAt(2), 1)
})

// V-4 Tur A (V4-D2): geçiş sayfa zemininde (`ink`, alfa 1) BİTER — aksi
// halde poster alt kenarında sert çizgi kalır (TestFlight 906).
Deno.test('alt geçiş tam opak ink ile biter', () => {
  const last = SCRIM_STOPS[SCRIM_STOPS.length - 1]
  assertEquals(last.at, 1)
  assertEquals(last.alpha, 1)
})

// Ölçülen cihaz yükseklikleri: SE1 568, SE2/3 667, 13–15 844, Pro Max 932.
for (const h of [MIN_WINDOW_HEIGHT, 667, 844, 932]) {
  Deno.test(`kontrast ≥ 4.5 — pencere ${h}pt, saf beyaz poster`, () => {
    const alpha = alphaAtOverlapStart(h)
    const title = worstCaseContrast(h, palette.bone, 1)
    // V-4 Tur A: etiket her zaman bloğun EN ÜST satırında — `bone@80%`
    // (color.text.primarySoft).
    const kicker = worstCaseContrast(h, palette.bone, 0.8)
    console.log(
      `  ${h}pt: ink alfa ${alpha.toFixed(3)} · başlık ${title.toFixed(2)}:1 · etiket ${kicker.toFixed(2)}:1`,
    )
    assert(title >= WCAG_AA, `başlık ${title.toFixed(2)}:1 < 4.5`)
    assert(kicker >= WCAG_AA, `etiket ${kicker.toFixed(2)}:1 < 4.5`)
  })
}

Deno.test('topScrimAlphaAt: duraklarda ve dışında doğru', () => {
  // V-4 Tur A: posterin üst %25'i, `ink`@55% → şeffaf. Etiket artık hero'da
  // değil; üst geçiş metin taşımadığı için kontrast testi yok.
  assertEquals(topScrimAlphaAt(0), 0.55)
  assertEquals(topScrimAlphaAt(1), 0)
  assertEquals(topScrimAlphaAt(-1), 0.55)
  assertEquals(topScrimAlphaAt(2), 0)
})
