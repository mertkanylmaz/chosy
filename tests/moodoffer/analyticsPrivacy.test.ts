/**
 * Analitik gizlilik sözleşmesi (MONEY-1C): kullanıcının yazdığı metin ve ondan türeyen
 * serbest metin (LLM anahtar kelimeleri, profil adı) PostHog'a gitmez; yalnız uzunluk/sayı.
 * Kaynak-okuma regresyonu. Run: npm run test:mood-offer
 */
import { assert, assertMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts'

const read = (p: string) =>
  Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url)).replaceAll('\r\n', '\n')

Deno.test('discover_recent_search_tapped yalnız uzunluk taşır (mood_text yok)', () => {
  const m = read('components/Home/MoodSearchScreen/index.tsx')
  assertMatch(m, /track\('discover_recent_search_tapped', \{ mood_text_length: item\.mood_text\.length \}\)/)
  assert(!/track\('discover_recent_search_tapped', \{ mood_text:/.test(m))
})

Deno.test('keyword_boost_active anahtar kelime METNİ taşımaz; auth uid debug olaylarında yok', () => {
  const r = read('services/recommendations.ts')
  const kw = r.slice(r.indexOf("track('keyword_boost_active'"), r.indexOf("track('keyword_boost_active'") + 400)
  assert(!/search_keywords:/.test(kw))
  const dbg = r.slice(r.indexOf("track('mood_search_update_debug'"))
  assert(!/authUid:/.test(dbg.slice(0, 700)))
  assert(!/authUid:\s*fbSession/.test(r))
})

Deno.test('mood_card_tapped yalnız kartın sabit kimliğini taşır (metin yok); preSessionInfo authUid içermez', () => {
  const m = read('components/Home/MoodSearchScreen/index.tsx')
  assertMatch(m, /track\('mood_card_tapped', \{ mood_card_id: cardId \}\)/)
  assert(!/track\('mood_card_tapped', \{ mood_text:/.test(m))
  const r = read('services/recommendations.ts')
  assert(!/authUid:/.test(r))
})

Deno.test('analytics.ts yardımcıları kullanıcı metni / profil adı taşımaz', () => {
  const a = read('services/analytics.ts')
  assert(!/mood_text_preview|profile_name|profileName/.test(a))
})
