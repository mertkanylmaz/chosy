/**
 * E-19 editoryal takvim testleri.
 *
 * Koşum:  npm run test:editorial
 *         (cd supabase/functions && deno test --allow-read _shared/editorialCalendar.test.ts)
 *
 * ── Bu dosya NEYİ kanıtlar ──────────────────────────────────────────────────
 * `generate-gauntlet/index.ts` `Deno.serve` içerdiği için import EDİLEMEZ
 * (import anında ikinci bir sunucu kurar — `gauntletCore.ts` başlığındaki aynı
 * gerekçe). Bu yüzden dallanmanın KARAR fonksiyonu (`editorialDayNumber`) ve
 * editoryal üreticinin okuma + izlenen-yerine-koyma parçaları
 * (`fetchEditorialQuartet`, `fetchWatchedAmong`, `replaceWatchedInPlace`)
 * paylaşılan modülde yaşıyor ve burada doğrudan test ediliyor. Handler'da
 * kalan: dallanma `if`'i ve yedeğin `pickReplacements` ile seçilmesi.
 *
 * Sahte `SupabaseClient`: gerçek PostgREST çağrısı yok. `from()` hangi tabloya
 * gidildiğini KAYDEDER; "algoritmik havuza hiç girilmedi" iddiası bu kayıt
 * üzerinden kanıtlanır (`fetchPool` `film_profiles`'tan başlar).
 */

import { assertEquals, assertRejects, assertThrows } from 'jsr:@std/assert@1'
import {
  EDITORIAL_CALENDAR_LENGTH,
  editorialDayNumber,
  editorialSlotTypes,
  applyWatchedReplacements,
  fetchEditorialQuartet,
  fetchWatchedAmong,
  replaceWatchedInPlace,
} from './editorialCalendar.ts'
import type { Candidate } from './gauntletCore.ts'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

// ─── Sahte istemci ───────────────────────────────────────────────────────────

interface FakeTable {
  rows: Record<string, unknown>[]
  error?: { message: string }
}

/**
 * Çağrılan tabloları kaydeden minimal PostgREST taklidi. Zincirdeki her metot
 * `this` döner; `await` edildiğinde `{ data, error }` verir.
 */
function fakeClient(tables: Record<string, FakeTable>) {
  const touched: string[] = []

  const client = {
    from(table: string) {
      touched.push(table)
      const spec = tables[table]
      if (!spec) throw new Error(`test kurulumunda tablo yok: ${table}`)
      const builder = {
        select: () => builder,
        eq: () => builder,
        lte: () => builder,
        in: () => builder,
        not: () => builder,
        order: () => builder,
        then: (
          resolve: (v: { data: unknown; error: unknown }) => unknown,
        ) => resolve({ data: spec.error ? null : spec.rows, error: spec.error ?? null }),
      }
      return builder
    },
  }
  return { client: client as unknown as SupabaseClient, touched }
}

/** `rowToCandidate` kapısını geçen tam bir `films` satırı. */
function filmRow(id: string, title: string) {
  return {
    id,
    title,
    year: 2023,
    runtime: 181,
    poster_url: `https://image.tmdb.org/t/p/original/${id}.jpg`,
    director: 'Test',
    genres: ['Drama'],
    original_language: 'en',
    imdb_votes: 1000,
    vote_average: 8,
    release_date: '2023-01-01',
    dominant_color: null,
  }
}

// ─── editorialDayNumber — DALLANMA KARARI ────────────────────────────────────

Deno.test('editorialDayNumber: yayın günü = 1. gün', () => {
  assertEquals(editorialDayNumber('2026-09-18', '2026-09-18'), 1)
})

Deno.test('editorialDayNumber: bugün (19 Eyl 2026) = 2. gün', () => {
  // Keşifte SQL ile ölçülen değer: (current_date - launch_date) + 1 = 2.
  assertEquals(editorialDayNumber('2026-09-19', '2026-09-18'), 2)
})

Deno.test('editorialDayNumber: takvimin son günü = 100', () => {
  // 2026-09-18 + 99 gün = 2026-12-26
  assertEquals(editorialDayNumber('2026-12-26', '2026-09-18'), EDITORIAL_CALENDAR_LENGTH)
})

Deno.test('editorialDayNumber: 101. gün → null (algoritmik dal)', () => {
  assertEquals(editorialDayNumber('2026-12-27', '2026-09-18'), null)
})

Deno.test('editorialDayNumber: yayın öncesi → null (algoritmik dal)', () => {
  assertEquals(editorialDayNumber('2026-09-17', '2026-09-18'), null)
  assertEquals(editorialDayNumber('2025-01-01', '2026-09-18'), null)
})

Deno.test('editorialDayNumber: ay ve yıl sınırını doğru geçer', () => {
  // 2026-09-18 → 2026-10-01 = 13 gün sonra = 14. gün
  assertEquals(editorialDayNumber('2026-10-01', '2026-09-18'), 14)
  // 2026-12-26 son gün; yıl sınırı 100'ün dışına düşer
  assertEquals(editorialDayNumber('2027-01-01', '2026-09-18'), null)
})

Deno.test('editorialDayNumber: bozuk tarih sessizce düzeltilmez', () => {
  assertThrows(() => editorialDayNumber('2026-9-18', '2026-09-18'))
  assertThrows(() => editorialDayNumber('2026-09-19', '18.09.2026'))
  // Biçimi doğru, takvimde olmayan tarih: Date.UTC sessizce 3 Mart'a taşardı.
  assertThrows(() => editorialDayNumber('2026-02-31', '2026-09-18'))
})

// ─── fetchEditorialQuartet — SIRA + HAVUZA GİRİLMEMESİ ───────────────────────

const QUARTET_DAY_2 = [
  { position: 1, film_id: 'f-oppenheimer' },
  { position: 2, film_id: 'f-killers' },
  { position: 3, film_id: 'f-godfather' },
  { position: 4, film_id: 'f-seven-samurai' },
]

const FILMS_DAY_2 = [
  filmRow('f-oppenheimer', 'Oppenheimer'),
  filmRow('f-killers', 'Killers of the Flower Moon'),
  filmRow('f-godfather', 'The Godfather'),
  filmRow('f-seven-samurai', 'Seven Samurai'),
]

Deno.test('fetchEditorialQuartet: position sırasını AYNEN korur', async () => {
  const { client } = fakeClient({
    editorial_calendar_films: { rows: QUARTET_DAY_2 },
    films: { rows: FILMS_DAY_2 },
  })
  const films = await fetchEditorialQuartet(client, 2)
  assertEquals(films.map((f) => f.id), [
    'f-oppenheimer',
    'f-killers',
    'f-godfather',
    'f-seven-samurai',
  ])
})

Deno.test('fetchEditorialQuartet: algoritmik havuza HİÇ girilmez', async () => {
  const { client, touched } = fakeClient({
    editorial_calendar_films: { rows: QUARTET_DAY_2 },
    films: { rows: FILMS_DAY_2 },
  })
  await fetchEditorialQuartet(client, 2)

  // `fetchPool` film_profiles'tan başlar (INNER JOIN films) ve bağlam runtime
  // tavanını `.lte('films.runtime', maxRuntime)` ile orada uygular.
  // `film_profiles` hiç okunmadıysa CONTEXT_MAX_RUNTIME hiç devreye girmemiştir.
  assertEquals(touched.includes('film_profiles'), false)
  // Dışlama sorguları da yok (DUR-4: editoryal günde bilinçli olarak uygulanmaz).
  assertEquals(touched.includes('watchlist'), false)
  assertEquals(touched.includes('daily_gauntlets'), false)
  assertEquals(touched.includes('choice_events'), false)
  assertEquals(touched.includes('duel_impressions'), false)
  // app_config da okunmaz: recognition_band_* eşikleri bu dalda anlamsız.
  assertEquals(touched.includes('app_config'), false)
  // Okunan TEK iki tablo:
  assertEquals(touched, ['editorial_calendar_films', 'films'])
})

Deno.test('fetchEditorialQuartet: 200 dk filmler süre tavanına takılmaz', async () => {
  // Gün 2 (`epic`) gerçek runtime'ları: 181/206/175/207 dk. `short` (110) ve
  // `medium` (150) tavanları bu dalda hiç değerlendirilmediği için dördü de
  // olduğu gibi döner.
  const longFilms = FILMS_DAY_2.map((f) => ({ ...f, runtime: 206 }))
  const { client } = fakeClient({
    editorial_calendar_films: { rows: QUARTET_DAY_2 },
    films: { rows: longFilms },
  })
  const films = await fetchEditorialQuartet(client, 2)
  assertEquals(films.length, 4)
  assertEquals(films.every((f) => f.runtime === 206), true)
})

Deno.test('fetchEditorialQuartet: eksik slot sessizce geçilmez', async () => {
  const { client } = fakeClient({
    editorial_calendar_films: { rows: QUARTET_DAY_2.slice(0, 3) },
    films: { rows: FILMS_DAY_2 },
  })
  await assertRejects(() => fetchEditorialQuartet(client, 2), Error, '3 ana slot')
})

Deno.test('fetchEditorialQuartet: çözümlenemeyen film sessizce atlanmaz', async () => {
  // poster_url NULL → rowToCandidate null döner → film Map'e girmez.
  const broken = [{ ...FILMS_DAY_2[2], poster_url: null }]
  const { client } = fakeClient({
    editorial_calendar_films: { rows: QUARTET_DAY_2 },
    films: { rows: [FILMS_DAY_2[0], FILMS_DAY_2[1], ...broken, FILMS_DAY_2[3]] },
  })
  await assertRejects(
    () => fetchEditorialQuartet(client, 2),
    Error,
    'film çözümlenemedi',
  )
})

Deno.test('fetchEditorialQuartet: sorgu hatası yutulmaz', async () => {
  const { client } = fakeClient({
    editorial_calendar_films: { rows: [], error: { message: 'boom' } },
    films: { rows: [] },
  })
  await assertRejects(() => fetchEditorialQuartet(client, 2), Error, 'boom')
})

Deno.test('editorialSlotTypes: her çağrıda yeni dizi (paylaşılan durum yok)', () => {
  const a = editorialSlotTypes()
  const b = editorialSlotTypes()
  assertEquals(a, b)
  assertEquals(a === b, false)
})

// ─── İzlenen editoryal film (Karar 2a) ───────────────────────────────────────

function cand(id: string): Candidate {
  return { id } as unknown as Candidate
}

Deno.test('fetchWatchedAmong: yalnız watchlist okunur, dönen id\'ler küme olur', async () => {
  const { client, touched } = fakeClient({
    watchlist: { rows: [{ film_id: 'b' }] },
  })
  const watched = await fetchWatchedAmong(client, 'u1', ['a', 'b', 'c', 'd'])
  assertEquals([...watched], ['b'])
  assertEquals(touched, ['watchlist'])
})

Deno.test('fetchWatchedAmong: sorgu hatası yutulmaz', async () => {
  const { client } = fakeClient({
    watchlist: { rows: [], error: { message: 'boom' } },
  })
  await assertRejects(() => fetchWatchedAmong(client, 'u1', ['a']), Error, 'boom')
})

Deno.test('replaceWatchedInPlace: izlenen yoksa dörtlü aynen döner', () => {
  const ed = ['a', 'b', 'c', 'd'].map(cand)
  assertEquals(
    replaceWatchedInPlace(ed, new Set(), []).map((f) => f.id),
    ['a', 'b', 'c', 'd'],
  )
})

Deno.test('replaceWatchedInPlace: yedek AYNI pozisyona girer, sıra korunur', () => {
  const ed = ['a', 'b', 'c', 'd'].map(cand)
  const out = replaceWatchedInPlace(ed, new Set(['b', 'd']), [cand('x'), cand('y')])
  assertEquals(out.map((f) => f.id), ['a', 'x', 'c', 'y'])
})

Deno.test('applyWatchedReplacements: yedek varsa yerine koyar, rapor yok', async () => {
  const ed = ['a', 'b', 'c', 'd'].map(cand)
  const reported: string[] = []
  const out = await applyWatchedReplacements(ed, new Set(['c']), [cand('x')], (id) => {
    reported.push(id)
    return Promise.resolve()
  })
  assertEquals(out.replaced, true)
  assertEquals(out.films.map((f) => f.id), ['a', 'b', 'x', 'd'])
  assertEquals(reported, [])
})

Deno.test('applyWatchedReplacements: yedek yok → film kalır + hata raporlanır', async () => {
  const ed = ['a', 'b', 'c', 'd'].map(cand)
  const reported: string[] = []
  const out = await applyWatchedReplacements(ed, new Set(['b', 'd']), null, (id) => {
    reported.push(id)
    return Promise.resolve()
  })
  assertEquals(out.replaced, false)
  assertEquals(out.films.map((f) => f.id), ['a', 'b', 'c', 'd'])
  assertEquals(reported, ['b', 'd'])
})

Deno.test('replaceWatchedInPlace: yedek sayısı tutmazsa sessizce geçilmez', () => {
  const ed = ['a', 'b', 'c', 'd'].map(cand)
  assertThrows(() => replaceWatchedInPlace(ed, new Set(['a', 'b']), [cand('x')]))
  assertThrows(() => replaceWatchedInPlace(ed, new Set(['a']), [cand('x'), cand('y')]))
})
