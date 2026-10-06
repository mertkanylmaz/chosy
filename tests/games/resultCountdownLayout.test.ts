/**
 * Unit tests — Spotlight sonuc ekraninda geri sayimin ilk ekranda gorunmesi
 * (P-6a `countdownPlacement`).
 *
 * SAF HESAP: RN flex yerlesimini calistirmaz; olculer kod okumasindan, cihaz
 * dogrulamasi TestFlight N16'da. Dynamic Type hesaba katilmaz.
 *
 * Dikey butce (yukaridan asagi, pt):
 *   - floating header chrome = safe-area ust + header 68
 *     (GameShell/styles.ts header: paddingTop 16 + slot 44 + paddingBottom 8)
 *   - kare = (ekran − 32) × 9/16 (Spotlight/styles.ts STILL_W, stillLayout.ts)
 *   - completedContainer gap 16
 *   - kart ust = kenarlik 1 + paddingVertical 24 (ResultCard/styles.ts container)
 *   - film adi 34/satir + gap 8 + yil satiri 18 (filmHero; Spotlight'ta poster yok)
 *   - kart gap 16 · durum = 16 + 4 + 18
 *   - (yalniz 'bottom') XP cipi ~26 · WhyThisMovie ~175 · aksiyonlar ~46, aralarinda gap 16
 *   - geri sayim = etiket 14 + 2 + saat 20
 * Gorunur alt sinir = pencere − max(alt inset, 8) (GameShell/index.tsx paddingBottom).
 *
 * Run: npm run test:result-card
 */

import { assert, assertAlmostEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { stillHeightFor } from '../../components/games/Spotlight/stillLayout.ts'

interface Device {
  name: string
  w: number
  h: number
  insetTop: number
  insetBottom: number
}

const SE: Device = { name: 'SE', w: 375, h: 667, insetTop: 20, insetBottom: 0 }
const PRO_15: Device = { name: '15 Pro', w: 393, h: 852, insetTop: 59, insetBottom: 34 }
const PRO_MAX: Device = { name: 'Pro Max', w: 430, h: 932, insetTop: 59, insetBottom: 34 }

const HEADER_H = 68
const GAP = 16
const CARD_TOP = 1 + 24
const TITLE_LINE_H = 34
const STATUS_H = 16 + 4 + 18
const XP_H = 26
const WHY_H = 175
const ACTIONS_H = 46
const COUNTDOWN_H = 14 + 2 + 20

const heroH = (titleLines: number) => TITLE_LINE_H * titleLines + 8 + 18

/** Geri sayim blogunun alt kenari (pencere Y'si), kaydirma 0 iken */
function countdownBottom(d: Device, titleLines: number, placement: 'top' | 'bottom'): number {
  const toStatusEnd =
    d.insetTop + HEADER_H + stillHeightFor(d.w - 32) + GAP + CARD_TOP + heroH(titleLines) + GAP + STATUS_H
  const between =
    placement === 'top' ? 0 : GAP + XP_H + GAP + WHY_H + GAP + ACTIONS_H
  return toStatusEnd + between + GAP + COUNTDOWN_H
}

const visibleBottom = (d: Device) => d.h - Math.max(d.insetBottom, 8)

Deno.test("'top': 1-3 satir film adinda geri sayim her cihazda ilk ekranda", () => {
  for (const d of [SE, PRO_15, PRO_MAX]) {
    for (const lines of [1, 2, 3]) {
      const y = countdownBottom(d, lines, 'top')
      assert(y <= visibleBottom(d), `${d.name} ${lines} satir: ${y.toFixed(1)} > ${visibleBottom(d)}`)
    }
  }
})

Deno.test("'top': 15 Pro + 2 satir baslikta geri sayim ~571'de biter, ~247pt pay kalir", () => {
  const y = countdownBottom(PRO_15, 2, 'top')
  assertAlmostEquals(y, 571.06, 0.01)
  assertAlmostEquals(visibleBottom(PRO_15) - y, 246.94, 0.01)
})

Deno.test("regresyon belgesi — 'bottom' (P-6 oncesi): 15 Pro'da saat kesiliyordu", () => {
  // Tek satir: 796-832, gorunur alan 818'de biter (P-6 kesif §5)
  const oneLine = countdownBottom(PRO_15, 1, 'bottom')
  assertAlmostEquals(oneLine, 832.06, 0.01)
  assert(oneLine > visibleBottom(PRO_15))
  // Iki satir: blok tamamen ekran disinda
  assert(countdownBottom(PRO_15, 2, 'bottom') - COUNTDOWN_H > visibleBottom(PRO_15))
})
