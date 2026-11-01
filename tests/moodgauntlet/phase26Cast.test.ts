/**
 * Faz 2-6 (3): film detayı oyuncu / ekip fotoğrafları. Fixture: TMDB credits (tr-TR, 1 Kas 2026)
 * — CMBYN 398818, Amour 86837, Blue Velvet 793, Knives Out 546554.
 * Run: npm run test:mood-gauntlet
 */
import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { buildCrewDisplay, buildDisplayCast, dbCastAvatar, mapDbCast, profilePathUrl } from '../../utils/castDisplay.ts'

const fx = (n: string) => JSON.parse(Deno.readTextFileSync(new URL(`../fixtures/credits_${n}.json`, import.meta.url)))
const labels = { director: 'Director', producer: 'Producer', music: 'Music' }

for (const name of ['cmbyn', 'amour', 'blue_velvet', 'knives_out']) {
  Deno.test(`oyuncu fotoğrafları görünür: ${name} (TMDB credits)`, () => {
    const credits = fx(name)
    const cast = buildDisplayCast(credits, null)
    assertEquals(cast.length, 10)
    const withPhoto = cast.filter((c) => c.avatarUrl)
    assertEquals(withPhoto.length, credits.cast.filter((c: { profile_path: string | null }) => c.profile_path).length)
    assert(withPhoto.length >= 8, 'çoğu oyuncunun fotoğrafı olmalı')
    for (const c of withPhoto) assert(/^https:\/\/image\.tmdb\.org\/t\/p\/w185\/[^/]+\.jpg$/.test(c.avatarUrl as string), c.avatarUrl)
    const crew = buildCrewDisplay(credits, labels)
    assertEquals(crew[0].label, 'Director')
    assert(crew.some((c) => c.avatarUrl), 'yönetmen/ekip fotoğrafı')
  })
}

Deno.test('DB cast_json: profile_url (gerçek biçim) ve profile_path ikisi de okunur; kök neden regresyonu', () => {
  const rows = [
    { name: 'Armie Hammer', character: 'Oliver', profile_url: 'https://image.tmdb.org/t/p/w185/4Z5nLW2biRjqstDMKqSaeQYAesK.jpg' },
    { name: 'Eski Biçim', profile_path: '/abc.jpg' },
    { name: 'Fotoğrafsız', profile_path: null },
  ]
  const m = mapDbCast(rows)
  assertEquals(m[0], { name: 'Armie Hammer', character: 'Oliver', avatarUrl: rows[0].profile_url })
  assertEquals(m[1].avatarUrl, 'https://image.tmdb.org/t/p/w185/abc.jpg')
  assertEquals(m[2].avatarUrl, undefined) // gerçekten null → silüet yok, yalnız isim + rol
  assertEquals(dbCastAvatar({ profile_url: 'http://x/y.jpg' }), undefined) // yalnız https
  assertEquals(profilePathUrl(''), undefined)
  assertEquals(profilePathUrl('abc.jpg'), undefined)
})

Deno.test('TMDB credits boşsa DB oyuncuları; TMDB fotoğrafı yoksa aynı isimde DB fotoğrafı', () => {
  const db = [{ name: 'A', profile_url: 'https://image.tmdb.org/t/p/w185/a.jpg' }]
  assertEquals(buildDisplayCast(null, db)[0].avatarUrl, 'https://image.tmdb.org/t/p/w185/a.jpg')
  assertEquals(buildDisplayCast({ cast: [] }, db)[0].name, 'A')
  assertEquals(
    buildDisplayCast({ cast: [{ name: 'A', character: 'x', profile_path: null }] }, db)[0].avatarUrl,
    'https://image.tmdb.org/t/p/w185/a.jpg',
  )
})

Deno.test('ekran: silüet ikonu yok, kök neden okuması yok', () => {
  const src = Deno.readTextFileSync(new URL('../../app/film/[id].tsx', import.meta.url))
  assert(!/person-outline/.test(src), 'fotoğrafsız kart yalnız isim + rol')
  assert(/mapDbCast\(row\.cast_json\)/.test(src))
  assert(!/a\.profile_path/.test(src))
})
