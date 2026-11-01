/**
 * Faz 2-5 (P1-5c): mood-four Server-Timing → mood_pipeline_timing server_* alanları.
 * Run: npm run test:mood-gauntlet
 */
import { assert, assertEquals, assertMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { assertNoFreeText, pipelineTimingEvent } from '../../utils/moodGauntletAnalytics.ts'
import { parseMoodFourServerTiming } from '../../utils/serverTimingHeader.ts'

const read = (p: string) =>
  Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url)).replaceAll('\r\n', '\n')

Deno.test('Server-Timing ayrıştırma: dört alan, yuvarlanır, bilinmeyen/bozuk atlanır', () => {
  assertEquals(
    parseMoodFourServerTiming('auth;dur=12.4, v4_rpc;dur=800.5, pick_llm;dur=2100.0, total;dur=3000.2, other;dur=9'),
    { auth: 12, v4_rpc: 801, pick_llm: 2100, total: 3000 },
  )
  assertEquals(parseMoodFourServerTiming('garbage, total;dur=abc'), undefined)
  assertEquals(parseMoodFourServerTiming(''), undefined)
  assertEquals(parseMoodFourServerTiming(null), undefined)
})

Deno.test('mood_pipeline_timing: server alanları yalnız verilince eklenir, metin taşımaz', () => {
  assertEquals(pipelineTimingEvent('four', 3469.4).props, { stage: 'four', ms: 3469 })
  const ev = pipelineTimingEvent('four', 3469, { auth: 12, v4_rpc: 801, pick_llm: 2100, total: 3000 })
  assertEquals(ev.props, {
    stage: 'four', ms: 3469, server_auth_ms: 12, server_v4_ms: 801, server_pick_ms: 2100, server_ms: 3000,
  })
  assertNoFreeText(ev)
})

Deno.test('mood-four: Server-Timing başlığı auth / v4_rpc / pick_llm / total ve erişim izni', () => {
  const src = read('supabase/functions/mood-four/index.ts')
  for (const k of ['auth', 'v4_rpc', 'pick_llm', 'total']) assertMatch(src, new RegExp(`['"]${k}['"]`))
  assertMatch(src, /Server-Timing/)
  assertMatch(src, /Access-Control-Expose-Headers/)
  const deps = read('services/moodGauntletDeps.ts')
  assertMatch(deps, /res\.headers\.get\('server-timing'\)/)
  assert(/onTiming\?\.\('four', clock\(deps\) - tFour, out\.serverMs\)/.test(read('services/moodGauntlet.ts')))
})

// ─── P1-6: film detayı ön-izleme ─────────────────────────────────────────────
import { filmDetailHref, parseFilmPreview } from '../../utils/filmDetailHref.ts'

Deno.test('film detayı ön-izleme: href ↔ parametre gidiş-dönüş, bozuk girdi null', () => {
  const id = '0b1c2d3e-0000-4000-8000-000000000001'
  assertEquals(filmDetailHref(id), `/film/${id}`)
  assertEquals(filmDetailHref(id, { title: '  ', year: 2000, posterUrl: null }), `/film/${id}`)
  const href = filmDetailHref(id, { title: 'Amélie & Co?', year: 2001, posterUrl: 'https://image.tmdb.org/t/p/w780/a.jpg' })
  const q = new URL(`https://x${href}`).searchParams
  assertEquals(
    parseFilmPreview({ pt: q.get('pt') ?? undefined, py: q.get('py') ?? undefined, pp: q.get('pp') ?? undefined }),
    { title: 'Amélie & Co?', year: 2001, posterUrl: 'https://image.tmdb.org/t/p/w780/a.jpg' },
  )
  assertEquals(parseFilmPreview({}), null)
  assertEquals(parseFilmPreview({ pt: 'X', py: 'abc', pp: 'javascript:alert(1)' }), { title: 'X', year: null, posterUrl: null })
})
