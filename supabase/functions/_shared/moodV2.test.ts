import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import { isSchemaV2, normalizeV2Fields, V2_PROMPT_ADDENDUM } from './moodV2.ts'

Deno.test('isSchemaV2: yalniz tam sayi 2', () => {
  assertEquals(isSchemaV2({ schema_version: 2 }), true)
  assertEquals(isSchemaV2({ schema_version: '2' }), false)
  assertEquals(isSchemaV2({ schema_version: 1 }), false)
  assertEquals(isSchemaV2({}), false)
  assertEquals(isSchemaV2(null), false)
})

Deno.test('genres: enum disi atilir, cakismada exclude kazanir, max 4', () => {
  const r = normalizeV2Fields({
    genres_include: ['Comedy', 'Komedi', 'Horror', 'Drama', 'Action', 'Crime', 'Comedy'],
    genres_exclude: ['Horror', 'Sci-Fi'],
  })
  assertEquals(r.genres_exclude, ['Horror'])
  assertEquals(r.genres_include, ['Comedy', 'Drama', 'Action', 'Crime'])
})

Deno.test('max_runtime: yalniz makul sayi, aksi null', () => {
  assertEquals(normalizeV2Fields({ max_runtime: 95.4 }).max_runtime, 95)
  assertEquals(normalizeV2Fields({ max_runtime: '90' }).max_runtime, null)
  assertEquals(normalizeV2Fields({ max_runtime: 5 }).max_runtime, null)
  assertEquals(normalizeV2Fields({ max_runtime: null }).max_runtime, null)
  assertEquals(normalizeV2Fields({}).max_runtime, null)
})

Deno.test('titles: bozuk girdi atilir, tekrar silinir, referans onerilerden dusulur, max 6', () => {
  const sug = Array.from({ length: 14 }, (_, i) => ({ title: `Film ${i}`, year: 2000 + i }))
  const r = normalizeV2Fields({
    reference_titles: [{ title: ' Inception ', year: 2010 }, { title: '', year: 1 }, 7, { title: 'Inception', year: 2010 }],
    suggested_titles: [{ title: 'inception', year: 2010 }, { title: 'X', year: 'bad' }, ...sug],
  })
  assertEquals(r.reference_titles, [{ title: 'Inception', year: 2010 }])
  assertEquals(r.suggested_titles.length, 6)
  assertEquals(r.suggested_titles[0], { title: 'X', year: null })
  assertEquals(r.suggested_titles.some((s) => s.title.toLowerCase() === 'inception'), false)
})

Deno.test('eksik alanlar: bos varsayilanlar', () => {
  assertEquals(normalizeV2Fields({}), {
    genres_include: [], genres_exclude: [], max_runtime: null, reference_titles: [], suggested_titles: [],
  })
})

Deno.test('prompt eki: enum listesini icerir', () => {
  assertEquals(V2_PROMPT_ADDENDUM.includes('Science Fiction'), true)
  assertEquals(V2_PROMPT_ADDENDUM.includes('${'), false)
})
