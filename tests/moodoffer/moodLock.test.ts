/**
 * Deste kilidi (MONEY-1C Faz 2b-d): clamp, hidden eşiği, yükleniyor/yetkili, yığın, sayaç.
 * Run: npm run test:mood-offer
 */
import { assert, assertEquals, assertMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import {
  buildDeckItems,
  clampFreeVisibleCount,
  deriveLockState,
  hidesBeyondFree,
  progressCounter,
} from '../../utils/moodLock.ts'

const base = { offerEnabled: true, isOnboarding: false, accessLoading: false, entitled: false, total: 8, freeVisible: 3 }
const read = (p: string) =>
  Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url)).replaceAll('\r\n', '\n')

Deno.test('clamp: sayı dışı → 3; kesir aşağı; 1..8 sınırı', () => {
  for (const bad of [undefined, null, 'x', NaN, Infinity, {}, [], true]) assertEquals(clampFreeVisibleCount(bad), 3)
  assertEquals(clampFreeVisibleCount(0), 1)
  assertEquals(clampFreeVisibleCount(-5), 1)
  assertEquals(clampFreeVisibleCount(2.9), 2)
  assertEquals(clampFreeVisibleCount(99), 8)
  assertEquals(clampFreeVisibleCount(1), 1)
})

Deno.test('gerçek deste boyutu: hidden ≥ 2 → kilit; değilse tamamen açık', () => {
  assertEquals(deriveLockState({ ...base, total: 8 }).kind, 'locked') // hidden 5
  assertEquals(deriveLockState({ ...base, total: 5 }).kind, 'locked') // hidden 2
  assertEquals(deriveLockState({ ...base, total: 4 }).kind, 'open') // hidden 1
  assertEquals(deriveLockState({ ...base, total: 3 }).kind, 'open') // hidden 0
  assertEquals(deriveLockState({ ...base, total: 0 }).kind, 'open')
  const s = deriveLockState({ ...base, total: 8 })
  if (s.kind === 'locked') assertEquals([s.visible, s.total, s.hidden], [3, 8, 5])
})

Deno.test('bayrak kapalı veya onboarding → asla kilit', () => {
  assertEquals(deriveLockState({ ...base, offerEnabled: false }).kind, 'open')
  assertEquals(deriveLockState({ ...base, isOnboarding: true }).kind, 'open')
})

Deno.test('yetki okunurken kilit değil iskelet; yetkili kullanıcı kilit görmez; premium geçişi kilidi açar', () => {
  assertEquals(deriveLockState({ ...base, accessLoading: true }).kind, 'pending')
  assertEquals(deriveLockState({ ...base, accessLoading: true, total: 4 }).kind, 'open') // gizlenecek şey yok
  assertEquals(deriveLockState({ ...base, entitled: true }).kind, 'open')
  // türetilmiş değer: aynı deste, entitled false → true ⇒ locked → open
  assertEquals(deriveLockState({ ...base }).kind, 'locked')
  assertEquals(deriveLockState({ ...base, entitled: true }).kind, 'open')
})

Deno.test('yığın: kilitte yalnız ilk N film + kilit; gizli film listede YOK', () => {
  const deck = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
  const items = buildDeckItems(deck, deriveLockState({ ...base }))
  assertEquals(items.length, 4)
  assertEquals(items.slice(0, 3).map((i) => (i.kind === 'film' ? i.film : '?')), ['a', 'b', 'c'])
  assertEquals(items[3].kind, 'lock')
  assert(!items.some((i) => i.kind === 'film' && ['d', 'e', 'f', 'g', 'h'].includes(i.film)))
  assertEquals(buildDeckItems(deck, deriveLockState({ ...base, accessLoading: true }))[3].kind, 'skeleton')
  assertEquals(buildDeckItems(deck, { kind: 'open' }).length, 8)
})

Deno.test('sayaç: kilitte donar, açıkta ilerler', () => {
  const locked = deriveLockState({ ...base })
  assertEquals(progressCounter({ currentIndex: 0, total: 8, lock: locked }), { current: 1, total: 8 })
  assertEquals(progressCounter({ currentIndex: 2, total: 8, lock: locked }), { current: 3, total: 8 })
  assertEquals(progressCounter({ currentIndex: 3, total: 8, lock: locked }), { current: 3, total: 8 }) // kilit kartı
  assertEquals(progressCounter({ currentIndex: 5, total: 8, lock: { kind: 'open' } }), { current: 6, total: 8 })
})

Deno.test('prefetch sınırı: yetki okunurken de gizli poster indirilmez', () => {
  assertEquals(hidesBeyondFree({ offerEnabled: true, isOnboarding: false, entitled: false }), true)
  assertEquals(hidesBeyondFree({ offerEnabled: true, isOnboarding: false, entitled: true }), false)
  assertEquals(hidesBeyondFree({ offerEnabled: false, isOnboarding: false, entitled: false }), false)
  assertEquals(hidesBeyondFree({ offerEnabled: true, isOnboarding: true, entitled: false }), false)
})

Deno.test('kaynak: kilit kartı poster almaz; mood metni kopyaya girmez; CTA lock_card', () => {
  const card = read('components/MoodLockCard/index.tsx')
  assert(!/posterUrl|normalizePosterUrl|expo-image|Image\b/.test(card.replace(/Image\s*\/\/[^\n]*/g, '')))
  assert(!/moodText|mood_text|currentProfile/.test(card))
  assertMatch(read('app/discover.tsx'), /type: 'mood_offer', entry: 'lock_card'/)
})

Deno.test('locales: moodLock anahtarları en/tr parite, metinler istenen kopya', () => {
  const en = JSON.parse(read('locales/en.json')).moodLock
  const tr = JSON.parse(read('locales/tr.json')).moodLock
  assertEquals(Object.keys(en).sort(), Object.keys(tr).sort())
  assertEquals(en.title, "There's more to this mood.")
  assertEquals(en.counter, '%{visible} of %{total}')
  assertEquals(en.cta, 'See all %{total} with Chosy Pro')
  assertEquals(en.keep, 'Your first %{visible} are yours to keep.')
})
