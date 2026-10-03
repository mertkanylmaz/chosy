/**
 * Unit tests — Spotlight havuz görsel URL guard'ı (P-1c A).
 * Run: cd supabase/functions && deno test _shared/imageUrl.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { isAbsoluteHttpUrl } from './imageUrl.ts'

const FILE = '/hQQCdZrsHtZyR6NbKH2YyCqd2fR.jpg'

Deno.test('tam TMDb URL (original) → geçerli', () => {
  assertEquals(isAbsoluteHttpUrl(`https://image.tmdb.org/t/p/original${FILE}`), true)
})

Deno.test('tam TMDb URL (w500) → geçerli', () => {
  assertEquals(isAbsoluteHttpUrl(`https://image.tmdb.org/t/p/w500${FILE}`), true)
})

Deno.test('http şeması da geçerli', () => {
  assertEquals(isAbsoluteHttpUrl(`http://image.tmdb.org/t/p/w500${FILE}`), true)
})

Deno.test('ham poster_path → geçersiz', () => {
  assertEquals(isAbsoluteHttpUrl(FILE), false)
})

Deno.test('şemasız host → geçersiz', () => {
  assertEquals(isAbsoluteHttpUrl(`image.tmdb.org/t/p/original${FILE}`), false)
})

Deno.test('yalnız host, yol yok → geçersiz', () => {
  assertEquals(isAbsoluteHttpUrl('https://image.tmdb.org'), false)
  assertEquals(isAbsoluteHttpUrl('https://image.tmdb.org/'), false)
})

Deno.test('içinde boşluk → geçersiz', () => {
  assertEquals(isAbsoluteHttpUrl(`https://image.tmdb.org/t/p/original/a b.jpg`), false)
})

Deno.test('null / undefined / boş → geçersiz', () => {
  assertEquals(isAbsoluteHttpUrl(null), false)
  assertEquals(isAbsoluteHttpUrl(undefined), false)
  assertEquals(isAbsoluteHttpUrl(''), false)
  assertEquals(isAbsoluteHttpUrl('   '), false)
})

Deno.test('başka şema → geçersiz', () => {
  assertEquals(isAbsoluteHttpUrl(`ftp://image.tmdb.org/t/p/original${FILE}`), false)
  assertEquals(isAbsoluteHttpUrl(`file:///t/p/original${FILE}`), false)
})
