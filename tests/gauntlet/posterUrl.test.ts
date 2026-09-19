/**
 * Unit tests — Champion poster boyut yükseltmesi (C.9b-UI C7).
 *
 * Saf fonksiyon; ağ/DB/cihaz gerektirmez.
 * Run: deno test tests/gauntlet/posterUrl.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  CHAMPION_POSTER_WIDTH,
  upgradePosterUrl,
} from '../../utils/posterUrl.ts'

const BASE = 'https://image.tmdb.org/t/p'
const FILE = '/sBnFQwOcmL3dAIYfiQ9nLvLSW7B.jpg'

// ─── Yükseltilen boyutlar ────────────────────────────────────────────────────

Deno.test('w500 (sunucunun verdiği boyut) → w780', () => {
  const r = upgradePosterUrl(`${BASE}/w500${FILE}`)
  assertEquals(r.upgraded, true)
  assertEquals(r.url, `${BASE}/w780${FILE}`)
  assertEquals(r.reason, undefined)
})

Deno.test('w92 (sağlayıcı logosu boyutu) → w780', () => {
  const r = upgradePosterUrl(`${BASE}/w92${FILE}`)
  assertEquals(r.upgraded, true)
  assertEquals(r.url, `${BASE}/w780${FILE}`)
})

Deno.test('http (https değil) da yükseltilir — şema korunur', () => {
  const r = upgradePosterUrl(`http://image.tmdb.org/t/p/w500${FILE}`)
  assertEquals(r.upgraded, true)
  assertEquals(r.url, `http://image.tmdb.org/t/p/w780${FILE}`)
})

// ─── Küçültme YAPILMAZ ───────────────────────────────────────────────────────

Deno.test('original → dokunulmaz (küçültme yasak)', () => {
  const url = `${BASE}/original${FILE}`
  const r = upgradePosterUrl(url)
  assertEquals(r.upgraded, false)
  assertEquals(r.url, url)
  assertEquals(r.reason, 'already_large_enough')
})

Deno.test('w1280 → dokunulmaz (hedeften geniş)', () => {
  const url = `${BASE}/w1280${FILE}`
  const r = upgradePosterUrl(url)
  assertEquals(r.upgraded, false)
  assertEquals(r.url, url)
  assertEquals(r.reason, 'already_large_enough')
})

Deno.test('tam hedef boyut (w780) → dokunulmaz', () => {
  const url = `${BASE}/w780${FILE}`
  const r = upgradePosterUrl(url)
  assertEquals(r.upgraded, false)
  assertEquals(r.reason, 'already_large_enough')
})

// ─── TMDb olmayan / tanınmayan girdiler ──────────────────────────────────────

Deno.test('TMDb olmayan host → dokunulmaz', () => {
  const url = `https://cdn.example.com/t/p/w500${FILE}`
  const r = upgradePosterUrl(url)
  assertEquals(r.upgraded, false)
  assertEquals(r.url, url)
  assertEquals(r.reason, 'not_tmdb')
})

Deno.test('ham poster_path (şemasız) → dokunulmaz', () => {
  const r = upgradePosterUrl(FILE)
  assertEquals(r.upgraded, false)
  assertEquals(r.url, FILE)
  assertEquals(r.reason, 'not_tmdb')
})

Deno.test('TMDb host ama tanınmayan boyut segmenti → dokunulmaz', () => {
  const url = `${BASE}/medium${FILE}`
  const r = upgradePosterUrl(url)
  assertEquals(r.upgraded, false)
  assertEquals(r.reason, 'not_tmdb')
})

Deno.test('TMDb host ama dosya yolu yok → dokunulmaz', () => {
  const url = `${BASE}/w500`
  const r = upgradePosterUrl(url)
  assertEquals(r.upgraded, false)
  assertEquals(r.reason, 'not_tmdb')
})

// ─── Boş / yokluk ────────────────────────────────────────────────────────────

Deno.test('boş string → dokunulmaz', () => {
  const r = upgradePosterUrl('')
  assertEquals(r.upgraded, false)
  assertEquals(r.url, '')
  assertEquals(r.reason, 'empty')
})

Deno.test('yalnız boşluk → dokunulmaz', () => {
  const r = upgradePosterUrl('   ')
  assertEquals(r.upgraded, false)
  assertEquals(r.reason, 'empty')
})

Deno.test('null / undefined → boş string, çökme yok', () => {
  assertEquals(upgradePosterUrl(null).reason, 'empty')
  assertEquals(upgradePosterUrl(null).url, '')
  assertEquals(upgradePosterUrl(undefined).reason, 'empty')
})

// ─── Sözleşme sabiti ─────────────────────────────────────────────────────────

Deno.test('hedef genişlik spec eşiğini (720px) karşılıyor', () => {
  assertEquals(CHAMPION_POSTER_WIDTH >= 720, true)
})

Deno.test('hedef genişlik parametreyle ezilebilir', () => {
  const r = upgradePosterUrl(`${BASE}/w500${FILE}`, 1280)
  assertEquals(r.upgraded, true)
  assertEquals(r.url, `${BASE}/w1280${FILE}`)
})
