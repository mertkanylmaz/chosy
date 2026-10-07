/**
 * Unit tests — tmdbSizedUrl (Spotlight görsel boyutu).
 *
 * Run: npm run test:spotlight-layout
 */
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { SPOTLIGHT_IMAGE_SIZE, tmdbSizedUrl } from '../../utils/tmdbSizedUrl.ts'

const BASE = 'https://image.tmdb.org/t/p'

Deno.test('original → hedef boyut', () => {
  assertEquals(tmdbSizedUrl(`${BASE}/original/abc.jpg`, 'w1280'), `${BASE}/w1280/abc.jpg`)
})

Deno.test('başka wNNN → hedef boyut', () => {
  assertEquals(tmdbSizedUrl(`${BASE}/w500/abc.jpg`, 'w780'), `${BASE}/w780/abc.jpg`)
})

Deno.test('zaten hedef boyutta → aynı', () => {
  const u = `${BASE}/w1280/abc.jpg`
  assertEquals(tmdbSizedUrl(u, 'w1280'), u)
})

Deno.test('TMDb olmayan URL → değişmez', () => {
  const u = 'https://cdn.example.com/t/p/original/abc.jpg'
  assertEquals(tmdbSizedUrl(u, 'w1280'), u)
})

Deno.test('desen dışı TMDb yolu → değişmez', () => {
  const a = 'https://image.tmdb.org/foo/bar.jpg'
  const b = 'https://image.tmdb.org/t/p/original'
  const c = 'http://image.tmdb.org/t/p/original/abc.jpg'
  const d = '/abc.jpg'
  assertEquals(tmdbSizedUrl(a, 'w1280'), a)
  assertEquals(tmdbSizedUrl(b, 'w1280'), b)
  assertEquals(tmdbSizedUrl(c, 'w1280'), c)
  assertEquals(tmdbSizedUrl(d, 'w1280'), d)
})

Deno.test('boş / undefined / null → boş string, fırlatmaz', () => {
  assertEquals(tmdbSizedUrl('', 'w1280'), '')
  assertEquals(tmdbSizedUrl(undefined, 'w1280'), '')
  assertEquals(tmdbSizedUrl(null, 'w1280'), '')
})

Deno.test('sorgu dizesi ve parça korunur', () => {
  assertEquals(
    tmdbSizedUrl(`${BASE}/original/abc.jpg?v=2&x=1`, 'w780'),
    `${BASE}/w780/abc.jpg?v=2&x=1`,
  )
  assertEquals(tmdbSizedUrl(`${BASE}/original/abc.jpg#f`, 'w780'), `${BASE}/w780/abc.jpg#f`)
})

Deno.test('yüzey sabitleri TMDb backdrop boyutlarından', () => {
  const valid = ['w300', 'w780', 'w1280', 'original']
  for (const v of Object.values(SPOTLIGHT_IMAGE_SIZE)) assertEquals(valid.includes(v), true)
})
