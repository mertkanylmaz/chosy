/**
 * Mood Search analitik çekirdeği + yeni olaylar (MONEY-1C Faz 2b-h).
 * Run: npm run test:mood-offer
 */
import { assert, assertEquals, assertMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import {
  deckStartedProps,
  moodEventCore,
  paywallMoodCore,
  shouldEmitDeckUnlocked,
} from '../../utils/moodAnalytics.ts'

const read = (p: string) =>
  Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url)).replaceAll('\r\n', '\n')

Deno.test('çekirdek: dört alan, bilinmeyen consent null kalır (tahmin edilmez)', () => {
  assertEquals(moodEventCore({ searchId: 's1', entryPoint: 'lock_card', isPro: false, consent: null }), {
    search_id: 's1',
    entry_point: 'lock_card',
    is_pro: false,
    consent: null,
  })
  assertEquals(moodEventCore({ searchId: undefined, entryPoint: undefined, isPro: true, consent: true }).search_id, null)
})

Deno.test('mood_deck_started: sıralı ilk 8 id + gerçek deste boyutu', () => {
  const films = Array.from({ length: 10 }, (_, i) => ({ id: `f${i}` }))
  assertEquals(deckStartedProps(films), { film_ids: 'f0,f1,f2,f3,f4,f5,f6,f7', deck_size: 10 })
  assertEquals(deckStartedProps(films.slice(0, 3)), { film_ids: 'f0,f1,f2', deck_size: 3 })
})

Deno.test('paywall olayları: çekirdek yalnız mood_offer varyantında', () => {
  const ctx = { isPro: false, consent: true }
  assertEquals(paywallMoodCore({ type: 'quota_exhausted' }, ctx), {})
  assertEquals(paywallMoodCore({ type: 'mood_offer', entry: 'lock_card', searchId: 's1' }, ctx), {
    search_id: 's1',
    entry_point: 'lock_card',
    is_pro: false,
    consent: true,
  })
})

Deno.test('mood_deck_unlocked: yalnız locked → open + yetkili + search_id başına bir kez', () => {
  const base = { prevKind: 'locked', kind: 'open', entitled: true, key: 's1', emitted: new Set<string>() } as const
  assertEquals(shouldEmitDeckUnlocked(base), true)
  assertEquals(shouldEmitDeckUnlocked({ ...base, emitted: new Set(['s1']) }), false) // ikinci kez yok
  assertEquals(shouldEmitDeckUnlocked({ ...base, prevKind: 'pending' }), false) // hiç kilitlenmedi
  assertEquals(shouldEmitDeckUnlocked({ ...base, prevKind: null }), false) // ilk render
  assertEquals(shouldEmitDeckUnlocked({ ...base, entitled: false }), false) // bayrak/onboarding ile açıldı
  assertEquals(shouldEmitDeckUnlocked({ ...base, kind: 'locked' }), false)
})

Deno.test('kaynak: olaylar bağlı; kullanıcı metni hiçbirine girmez', () => {
  const d = read('app/discover.tsx')
  for (const e of ['mood_lock_viewed', 'mood_lock_tapped', 'mood_deck_unlocked']) {
    assert(d.includes(`track('${e}'`), e)
  }
  assertMatch(d, /\.\.\.deckStartedProps\(managerFilms\)/)
  assertMatch(d, /analyticsCore=\{analyticsCoreRef\.current\(\)\}/)
  assert(!/moodText|mood_text/.test(d))
  assertMatch(read('components/paywalls/ContextualPaywall.tsx'), /\.\.\.paywallMoodCore\(variant\.trigger/)
  assertMatch(read('components/paywalls/PaywallBase/index.tsx'), /\.\.\.paywallMoodCore\(variant\.trigger/)
  assertMatch(read('components/MoodDeckSummary/index.tsx'), /\.\.\.analyticsCore,/)
})
