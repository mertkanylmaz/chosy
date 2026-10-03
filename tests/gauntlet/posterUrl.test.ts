/**
 * Unit tests — Champion poster boyut yükseltmesi (C.9b-UI C7).
 *
 * Saf fonksiyon; ağ/DB/cihaz gerektirmez.
 * Run: deno test tests/gauntlet/posterUrl.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  CHAMPION_POSTER_WIDTH,
  resultPosterUrl,
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

// ─── resultPosterUrl — oyun sonuç kartı (P-1a) ───────────────────────────────

Deno.test('sonuç: original → w780 (küçültülür)', () => {
  const r = resultPosterUrl(`${BASE}/original${FILE}`)
  assertEquals(r.resized, true)
  assertEquals(r.url, `${BASE}/w780${FILE}`)
  assertEquals(r.reason, undefined)
})

Deno.test('sonuç: w500 → w780 (Champion yükseltmesiyle aynı)', () => {
  const r = resultPosterUrl(`${BASE}/w500${FILE}`)
  assertEquals(r.resized, true)
  assertEquals(r.url, `${BASE}/w780${FILE}`)
  assertEquals(r.url, upgradePosterUrl(`${BASE}/w500${FILE}`).url)
})

Deno.test('sonuç: w1280 → w780 (hedeften geniş küçültülür)', () => {
  const r = resultPosterUrl(`${BASE}/w1280${FILE}`)
  assertEquals(r.resized, true)
  assertEquals(r.url, `${BASE}/w780${FILE}`)
})

Deno.test('sonuç: zaten w780 → değişmez', () => {
  const url = `${BASE}/w780${FILE}`
  const r = resultPosterUrl(url)
  assertEquals(r.resized, false)
  assertEquals(r.url, url)
  assertEquals(r.reason, 'already_target')
})

Deno.test('sonuç: ham poster_path → url null, invalid_uri (yer tutucu + Sentry çağıranda)', () => {
  const r = resultPosterUrl(FILE)
  assertEquals(r.url, null)
  assertEquals(r.resized, false)
  assertEquals(r.reason, 'invalid_uri')
})

Deno.test('sonuç: şemasız TMDb yolu da invalid_uri', () => {
  const r = resultPosterUrl(`image.tmdb.org/t/p/original${FILE}`)
  assertEquals(r.url, null)
  assertEquals(r.reason, 'invalid_uri')
})

Deno.test('sonuç: TMDb olmayan tam URL → dönüşüm yok, olduğu gibi', () => {
  const url = `https://cdn.example.com/t/p/original${FILE}`
  const r = resultPosterUrl(url)
  assertEquals(r.resized, false)
  assertEquals(r.url, url)
  assertEquals(r.reason, 'not_tmdb')
})

Deno.test('sonuç: TMDb host ama tanınmayan boyut → dönüşüm yok', () => {
  const url = `${BASE}/medium${FILE}`
  const r = resultPosterUrl(url)
  assertEquals(r.resized, false)
  assertEquals(r.url, url)
  assertEquals(r.reason, 'not_tmdb')
})

Deno.test('sonuç: boş / null / undefined → url null, empty', () => {
  assertEquals(resultPosterUrl('').reason, 'empty')
  assertEquals(resultPosterUrl('   ').url, null)
  assertEquals(resultPosterUrl(null).reason, 'empty')
  assertEquals(resultPosterUrl(undefined).reason, 'empty')
})

Deno.test('sonuç: upgradePosterUrl davranışı değişmedi — original hâlâ dokunulmaz', () => {
  const url = `${BASE}/original${FILE}`
  assertEquals(upgradePosterUrl(url).url, url)
  assertEquals(upgradePosterUrl(url).reason, 'already_large_enough')
})
