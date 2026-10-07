/**
 * Harcanmış hak noktası kenarı (smoke) ink zeminde metin-dışı bileşen eşiğini
 * (≥3:1, Design OS §2.7) geçmeli. `chancesStyles.dotSpent` smoke'u
 * (`color.text.secondary === palette.smoke`) kullanır.
 *
 * WCAG formülü burada yerel: `utils/oklch.ts` `@/` alias'ı ile tip import eder,
 * Deno bunu çözmez (spotlightLayout.test.ts gibi bağımsız kalır).
 *
 * Run: npm run test:spotlight-layout
 */
import { assert } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { palette } from '../../constants/design/primitives.ts'

const NON_TEXT_MIN = 3

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

Deno.test('harcanmış hak kenarı (smoke) ink üstünde ≥3:1', () => {
  assert(ratio(palette.smoke, palette.ink) >= NON_TEXT_MIN)
})

Deno.test('graphite yetmez — smoke seçiminin gerekçesi', () => {
  assert(ratio(palette.graphite, palette.ink) < NON_TEXT_MIN)
})
