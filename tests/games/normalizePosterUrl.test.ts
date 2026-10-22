/**
 * Unit tests — normalizePosterUrl (deste / prefetch / Saved / film detayı).
 *
 * Run: npm run test:poster-url
 */
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  DECK_POSTER_SIZE,
  SAVED_THUMB_POSTER_SIZE,
  normalizePosterUrl,
} from '../../utils/posterUrl.ts'

const BASE = 'https://image.tmdb.org/t/p'

Deno.test('boyutlar sabit', () => {
  assertEquals(DECK_POSTER_SIZE, 'w780')
  assertEquals(SAVED_THUMB_POSTER_SIZE, 'w185')
})

Deno.test('null / undefined / boş → null', () => {
  assertEquals(normalizePosterUrl(null), null)
  assertEquals(normalizePosterUrl(undefined), null)
  assertEquals(normalizePosterUrl(''), null)
  assertEquals(normalizePosterUrl('   '), null)
})

Deno.test('yalnız yol → tam URL (varsayılan w780)', () => {
  assertEquals(normalizePosterUrl('/x.jpg'), `${BASE}/w780/x.jpg`)
  assertEquals(normalizePosterUrl('/x.jpg', 'w185'), `${BASE}/w185/x.jpg`)
})

Deno.test("original → hedef boyut (prod'daki ana biçim)", () => {
  assertEquals(normalizePosterUrl(`${BASE}/original/x.jpg`), `${BASE}/w780/x.jpg`)
})

Deno.test('başka boyut → hedef boyut (büyütme ve küçültme)', () => {
  assertEquals(normalizePosterUrl(`${BASE}/w500/x.jpg`), `${BASE}/w780/x.jpg`)
  assertEquals(normalizePosterUrl(`${BASE}/w1280/x.jpg`), `${BASE}/w780/x.jpg`)
  assertEquals(normalizePosterUrl(`${BASE}/w780/x.jpg`, 'w185'), `${BASE}/w185/x.jpg`)
})

Deno.test('zaten hedef boyut → aynı', () => {
  const u = `${BASE}/w780/x.jpg`
  assertEquals(normalizePosterUrl(u), u)
})

Deno.test('idempotent', () => {
  const once = normalizePosterUrl(`${BASE}/original/x.jpg`)
  assertEquals(normalizePosterUrl(once), once)
})

Deno.test('başka host tam URL → değişmez', () => {
  const u = 'https://cdn.example.com/t/p/original/x.jpg'
  assertEquals(normalizePosterUrl(u), u)
})

Deno.test('tanınmayan biçim → null', () => {
  assertEquals(normalizePosterUrl('x.jpg'), null)
  assertEquals(normalizePosterUrl('//cdn.example.com/x.jpg'), null)
  assertEquals(normalizePosterUrl('/'), null)
})

Deno.test('deste ve prefetch aynı girdiden aynı URL üretir', () => {
  for (const raw of [`${BASE}/original/a.jpg`, '/b.jpg', `${BASE}/w500/c.jpg`]) {
    assertEquals(normalizePosterUrl(raw, DECK_POSTER_SIZE), normalizePosterUrl(raw))
  }
})
