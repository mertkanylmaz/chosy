/**
 * Unit tests — bekleyiş ekranı Spotlight teaser'ı gösterim koşulları
 * (components/gauntlet/SpotlightTeaser/teaserRules.ts, P-5 / K-62).
 * Run: npm run test:teaser
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  isTeaserSlotActive,
  isTeaserVisible,
  shouldTrackTeaserView,
  type TeaserSlotInput,
  type TeaserSpotlightData,
} from '../../components/gauntlet/SpotlightTeaser/teaserRules.ts'

const SLOT: TeaserSlotInput = {
  shellState: 'before_18',
  pendingFeedbackShown: false,
  spotlightEnabled: true,
}

const READY: TeaserSpotlightData = {
  status: 'ready',
  state: 'not_started',
  backdropUrl: 'https://image.tmdb.org/t/p/original/x.jpg',
}

Deno.test('before_18 + bayrak açık + bulmaca hazır ve başlamamış → görünür', () => {
  assertEquals(isTeaserSlotActive(SLOT), true)
  assertEquals(isTeaserVisible(SLOT, READY), true)
})

Deno.test('before_18 dışındaki her durumda gizli (gauntlet sırası, champion, yükleme)', () => {
  for (const shellState of ['bootstrapping', 'ready', 'in_progress', 'completed_today']) {
    const slot = { ...SLOT, shellState }
    assertEquals(isTeaserSlotActive(slot), false, shellState)
    assertEquals(isTeaserVisible(slot, READY), false, shellState)
  }
})

Deno.test('pending feedback kartı ekrandayken gizli ve ağa çıkılmaz', () => {
  const slot = { ...SLOT, pendingFeedbackShown: true }
  assertEquals(isTeaserSlotActive(slot), false)
  assertEquals(isTeaserVisible(slot, READY), false)
})

Deno.test('Spotlight bayrağı kapalı ya da okunamadı (null) → gizli, fail-closed', () => {
  for (const spotlightEnabled of [false, null]) {
    const slot = { ...SLOT, spotlightEnabled }
    assertEquals(isTeaserSlotActive(slot), false, String(spotlightEnabled))
    assertEquals(isTeaserVisible(slot, READY), false, String(spotlightEnabled))
  }
})

Deno.test('bulmaca yok (unavailable), hata ve yükleme → gizli', () => {
  const cases: TeaserSpotlightData[] = [
    { status: 'unavailable' },
    { status: 'error' },
    { status: 'loading' },
  ]
  for (const data of cases) {
    assertEquals(isTeaserVisible(SLOT, data), false, data.status)
  }
})

Deno.test('bugünün Spotlight\'ı başlamış ya da bitmiş → gizli (E-21 önceki döngü)', () => {
  for (const state of ['in_progress', 'solved', 'failed'] as const) {
    assertEquals(isTeaserVisible(SLOT, { ...READY, state }), false, state)
  }
})

Deno.test('kare yok (backdropUrl boş) → gizli', () => {
  assertEquals(isTeaserVisible(SLOT, { ...READY, backdropUrl: '' }), false)
})

Deno.test('spotlight_teaser_viewed: yerel günde bir kez', () => {
  assertEquals(shouldTrackTeaserView(null, '2026-10-05'), true)
  assertEquals(shouldTrackTeaserView('2026-10-04', '2026-10-05'), true)
  assertEquals(shouldTrackTeaserView('2026-10-05', '2026-10-05'), false)
})
