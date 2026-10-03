/**
 * Unit tests — ResultCard kahraman görseli kararı (P-2 `hidePoster`).
 *
 * Regresyon: `hidePoster` verilmeyen / false geçen oyunlar (Spotlight dışı
 * 6 oyun) için çıktı P-2 öncesi JSX koşuluyla birebir aynı kalmalı.
 *
 * Run: npm run test:result-card
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { resultHeroMode, type ResultHeroMode } from '../../components/games/ResultCard/heroMode.ts'

/**
 * P-2 öncesi `ResultCard/index.tsx` koşulu, olduğu gibi:
 *   showPlaceholder ? <yer tutucu> : (poster.url !== null && <Image>)
 */
function legacyHero(invalidUri: boolean, posterFailed: boolean, hasUrl: boolean): ResultHeroMode {
  const showPlaceholder = invalidUri || posterFailed
  if (showPlaceholder) return 'placeholder'
  return hasUrl ? 'poster' : 'none'
}

const BOOLS = [false, true] as const

Deno.test('hidePoster verilmezse 8 kombinasyonun hepsi P-2 oncesiyle ayni', () => {
  for (const invalidUri of BOOLS) {
    for (const posterFailed of BOOLS) {
      for (const hasUrl of BOOLS) {
        assertEquals(
          resultHeroMode({ invalidUri, posterFailed, hasUrl }),
          legacyHero(invalidUri, posterFailed, hasUrl),
          `invalidUri=${invalidUri} posterFailed=${posterFailed} hasUrl=${hasUrl}`,
        )
      }
    }
  }
})

Deno.test('hidePoster=false acikca gecilince de ayni', () => {
  for (const invalidUri of BOOLS) {
    for (const posterFailed of BOOLS) {
      for (const hasUrl of BOOLS) {
        assertEquals(
          resultHeroMode({ hidePoster: false, invalidUri, posterFailed, hasUrl }),
          legacyHero(invalidUri, posterFailed, hasUrl),
        )
      }
    }
  }
})

Deno.test('hidePoster=true: poster de yer tutucu da cizilmez', () => {
  for (const invalidUri of BOOLS) {
    for (const posterFailed of BOOLS) {
      for (const hasUrl of BOOLS) {
        assertEquals(resultHeroMode({ hidePoster: true, invalidUri, posterFailed, hasUrl }), 'none')
      }
    }
  }
})
