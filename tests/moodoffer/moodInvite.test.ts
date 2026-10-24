/**
 * Davet kartı görünürlüğü (MONEY-1C F2-4).
 * Run: npm run test:mood-offer
 */
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import {
  CHAMPION_INVITE_MIN_HERO,
  championInviteFits,
  moodInviteAccess,
  spotlightInviteFits,
} from '../../utils/moodInvite'

Deno.test('şampiyon: büyük ekranda sığar, küçük ekranda gizlenir', () => {
  // ~iPhone 14: 844pt, tab inset ~100, kart+sayaç+arşiv ~ 200
  assertEquals(championInviteFits({ screenH: 844, belowWithoutInvite: 200, tabInset: 100 }), true)
  // ~iPhone SE: 667pt
  assertEquals(championInviteFits({ screenH: 667, belowWithoutInvite: 200, tabInset: 100 }), false)
})

Deno.test('şampiyon: hero alt sınırı tam eşikte sığar, 1pt eksikte sığmaz', () => {
  const base = { belowWithoutInvite: 200, tabInset: 100 }
  // heroLeft = screenH - 260 - 200 - 80 - 100 = screenH - 640
  const exact = 640 + CHAMPION_INVITE_MIN_HERO
  assertEquals(championInviteFits({ ...base, screenH: exact }), true)
  assertEquals(championInviteFits({ ...base, screenH: exact - 1 }), false)
})

Deno.test('şampiyon: ölçülen alt içerik büyüdükçe (Dynamic Type) kart gizlenir', () => {
  assertEquals(championInviteFits({ screenH: 844, belowWithoutInvite: 200, tabInset: 100 }), true)
  assertEquals(championInviteFits({ screenH: 844, belowWithoutInvite: 340, tabInset: 100 }), false)
})

Deno.test('spotlight: küçük ekran ve büyük yazı ölçeğinde gizli', () => {
  assertEquals(spotlightInviteFits({ screenH: 844, fontScale: 1 }), true)
  assertEquals(spotlightInviteFits({ screenH: 667, fontScale: 1 }), false)
  assertEquals(spotlightInviteFits({ screenH: 844, fontScale: 1.5 }), false)
})

Deno.test('kitle: premium/trial asla; yükleniyor/hata gizli; free ve legacy görür', () => {
  const ok = { loading: false, error: false }
  assertEquals(moodInviteAccess({ ...ok, reason: 'premium' }), null)
  assertEquals(moodInviteAccess({ ...ok, reason: 'none' }), 'free')
  assertEquals(moodInviteAccess({ ...ok, reason: 'legacy' }), 'legacy')
  assertEquals(moodInviteAccess({ ...ok, reason: 'legacy' }, false), null)
  assertEquals(moodInviteAccess({ loading: true, error: false, reason: 'none' }), null)
  assertEquals(moodInviteAccess({ loading: false, error: true, reason: 'none' }), null)
})
