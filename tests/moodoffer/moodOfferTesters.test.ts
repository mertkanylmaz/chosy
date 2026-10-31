/**
 * mood_offer_enabled + tester listesi (MONEY-1C F2 düzeltme 9).
 * Run: npm run test:mood-offer
 */
import { assertEquals, assertMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import { evaluateMoodOfferEnabled, hasTesterEntries } from '../../utils/moodOfferTesters'

const ME = '1f0b7c1e-0000-4000-8000-000000000001'
const OTHER = '2a0b7c1e-0000-4000-8000-000000000002'

Deno.test('liste yok / boş / geçersiz → kapalı', () => {
  assertEquals(evaluateMoodOfferEnabled({ flag: undefined, testers: undefined, userId: ME }), false)
  assertEquals(evaluateMoodOfferEnabled({ flag: false, testers: [], userId: ME }), false)
  assertEquals(evaluateMoodOfferEnabled({ flag: false, testers: null, userId: ME }), false)
  assertEquals(evaluateMoodOfferEnabled({ flag: false, testers: ME, userId: ME }), false) // dizi değil
  assertEquals(evaluateMoodOfferEnabled({ flag: false, testers: { [ME]: true }, userId: ME }), false)
  assertEquals(evaluateMoodOfferEnabled({ flag: false, testers: [1, null, {}], userId: ME }), false)
})

Deno.test('kimlik listede değil / kimlik yok → kapalı', () => {
  assertEquals(evaluateMoodOfferEnabled({ flag: false, testers: [OTHER], userId: ME }), false)
  assertEquals(evaluateMoodOfferEnabled({ flag: false, testers: [ME], userId: null }), false)
  assertEquals(evaluateMoodOfferEnabled({ flag: false, testers: [ME], userId: '' }), false)
})

Deno.test('kimlik listede → açık', () => {
  assertEquals(evaluateMoodOfferEnabled({ flag: false, testers: [OTHER, ME], userId: ME }), true)
  assertEquals(evaluateMoodOfferEnabled({ flag: undefined, testers: [ME], userId: ME }), true)
})

Deno.test('bayrak === true → herkes için açık (liste ve kimlikten bağımsız)', () => {
  assertEquals(evaluateMoodOfferEnabled({ flag: true, testers: [], userId: null }), true)
  assertEquals(evaluateMoodOfferEnabled({ flag: true, testers: undefined, userId: ME }), true)
})

Deno.test('yalnız === true açar: "true" / 1 / truthy açmaz', () => {
  for (const flag of ['true', 1, {}, [], 'yes']) {
    assertEquals(evaluateMoodOfferEnabled({ flag, testers: [], userId: ME }), false)
  }
})

Deno.test('hasTesterEntries: yalnız en az bir boş olmayan string içeren dizi', () => {
  assertEquals(hasTesterEntries([ME]), true)
  assertEquals(hasTesterEntries([]), false)
  assertEquals(hasTesterEntries(['']), false)
  assertEquals(hasTesterEntries([1, null]), false)
  assertEquals(hasTesterEntries(undefined), false)
  assertEquals(hasTesterEntries('x'), false)
})

Deno.test('okuma yolu: oturum yalnız bayrak kapalı + liste doluyken okunur; yeni app_config isteği yok', () => {
  const read = (p: string) => Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url)).replaceAll('\r\n', '\n')
  const flags = read('services/appConfigFlags.ts')
  assertMatch(flags, /if \(flag !== true && hasTesterEntries\(testers\)\) \{\s*try \{\s*testerAuthId = await readLocalAuthUid\(\);/)
  // tek select(key,value) deseni: appConfigFlags ayrı .from('app_config') açmaz
  assertEquals(/supabase\s*\.from\(/.test(flags), false)
  assertEquals(/getAppUserId\(|readAppUserId\(/.test(flags), false) // public.users.id DEĞİL
})
