import { assertEquals, assertNotEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import {
  normalizeMoodText,
  parseCacheKey,
  promptVersionOf,
  readCachedProfile,
  sha256Hex,
} from './moodParseCache.ts'

Deno.test('normalize: trim, çoklu boşluk/yeni satır tek boşluk, küçük harf', () => {
  assertEquals(normalizeMoodText('  Need   A\n\tLaugh  '), 'need a laugh')
  assertEquals(normalizeMoodText('YAĞMURLU  gün'), 'yağmurlu gün')
})

Deno.test('sha256Hex: bilinen vektör', async () => {
  assertEquals(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
})

Deno.test('key: 64 hane hex, biçim farkı aynı anahtarı verir', async () => {
  const a = await parseCacheKey('Need a laugh', 2, 'abc123')
  const b = await parseCacheKey('  need   a LAUGH\n', 2, 'abc123')
  assertEquals(a, b)
  assertEquals(/^[0-9a-f]{64}$/.test(a), true)
})

Deno.test('key: metin, schema_version ve prompt_version her biri anahtarı değiştirir', async () => {
  const base = await parseCacheKey('need a laugh', 2, 'p1')
  assertNotEquals(base, await parseCacheKey('need a cry', 2, 'p1'))
  assertNotEquals(base, await parseCacheKey('need a laugh', 3, 'p1'))
  assertNotEquals(base, await parseCacheKey('need a laugh', 2, 'p2'))
})

Deno.test('key: alan sınırları kayamaz (metin sonu rakamı ≠ schema_version)', async () => {
  assertNotEquals(await parseCacheKey('mood 2', 1, 'p'), await parseCacheKey('mood', 21, 'p'))
})

Deno.test('promptVersion: 12 hane, prompt değişince değişir', async () => {
  const a = await promptVersionOf('prompt A')
  assertEquals(a.length, 12)
  assertEquals(a, await promptVersionOf('prompt A'))
  assertNotEquals(a, await promptVersionOf('prompt B'))
})

Deno.test('readCachedProfile: geçerli çıktı geçer, bozuk satır null', () => {
  const ok = { emotional_state: { joy: 0.5 }, search_keywords: [], suggested_titles: [] }
  assertEquals(readCachedProfile(ok), ok)
  assertEquals(readCachedProfile(null), null)
  assertEquals(readCachedProfile('x'), null)
  assertEquals(readCachedProfile([ok]), null)
  assertEquals(readCachedProfile({ search_keywords: [] }), null)
  assertEquals(readCachedProfile({ emotional_state: [], search_keywords: [] }), null)
  assertEquals(readCachedProfile({ emotional_state: {}, search_keywords: 'a' }), null)
})
