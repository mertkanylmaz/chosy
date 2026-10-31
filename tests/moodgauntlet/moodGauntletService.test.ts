/**
 * Mood Gauntlet servis birim testleri (Faz 2-1): yedek yolları, dışlama birleşimi,
 * gerekçe "" davranışı, "Başka bir dörtlü" (yeni parse yok), recommended_film_ids sırası.
 * Run: npm run test:mood-gauntlet
 */
import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  buildV4Attempts,
  MAX_EXCLUDE_IDS,
  mergeExclusions,
  nextFour,
  noteBackupsShown,
  pickFour,
  reasonFor,
  startMoodGauntlet,
  withModifier,
  type FallbackStage,
  type MatchRow,
  type MatchV4Args,
  type MoodGauntletDeps,
  type ParsedMoodV2,
  type RerankOutcome,
} from '../../services/moodGauntlet.ts'

const row = (n: number): MatchRow => ({
  id: `f${n}`, title: `Film ${n}`, year: 2000 + (n % 20), poster_url: null, backdrop_url: null,
  overview: null, genres: ['Drama'], runtime: 100, vote_average: 7, director: null, similarity: 1 - n / 100,
})
const rows = (n: number, from = 1): MatchRow[] => Array.from({ length: n }, (_, i) => row(from + i))

const parsed = (over: Partial<ParsedMoodV2> = {}): ParsedMoodV2 => ({
  profile: { p: 1 }, searchId: 's-1', searchKeywords: ['k'], profileName: 'Cozy Night',
  genresInclude: [], genresExclude: [], maxRuntime: null, referenceTitles: [], suggestedTitles: [],
  excludeRecentIds: [], cacheHit: false, ...over,
})

interface Calls {
  parse: number
  match: MatchV4Args[]
  rerank: number
  recorded: string[][]
  fallbacks: FallbackStage[]
  errors: FallbackStage[]
}

function makeDeps(opts: {
  parsed?: ParsedMoodV2
  matchResults?: MatchRow[][] // her matchV4 çağrısı sırayla
  rerank?: (c: MatchRow[]) => RerankOutcome | Promise<RerankOutcome>
  library?: string[]
  recordThrows?: boolean
}): { deps: MoodGauntletDeps; calls: Calls } {
  const calls: Calls = { parse: 0, match: [], rerank: 0, recorded: [], fallbacks: [], errors: [] }
  let id = 0
  let m = 0
  const deps: MoodGauntletDeps = {
    parse: () => {
      calls.parse++
      return Promise.resolve(opts.parsed ?? parsed())
    },
    matchV4: (args) => {
      calls.match.push(args)
      const r = opts.matchResults?.[Math.min(m, (opts.matchResults?.length ?? 1) - 1)] ?? rows(30)
      m++
      return Promise.resolve(r)
    },
    rerank: async ({ candidates }) => {
      calls.rerank++
      return opts.rerank ? await opts.rerank(candidates) : { ok: false, failure: 'http_error' }
    },
    loadExclusions: () => Promise.resolve(opts.library ?? []),
    recordRecommended: (_s, ids) => {
      if (opts.recordThrows) return Promise.reject(new Error('db'))
      calls.recorded.push(ids)
      return Promise.resolve()
    },
    newId: () => `id-${++id}`,
    onFallback: (s) => {
      calls.fallbacks.push(s)
    },
    onError: (s) => {
      calls.errors.push(s)
    },
  }
  return { deps, calls }
}

const topFour = (c: MatchRow[]): RerankOutcome => ({ ok: true, ids: c.slice(0, 4).map((x) => x.id), reasons: {} })

Deno.test('mutlu yol: rerank sirasi + gerekce + 3 yedek (v4 listesinin sonraki adaylari)', async () => {
  const { deps, calls } = makeDeps({
    rerank: () => ({ ok: true, ids: ['f5', 'f2', 'f9', 'f1'], reasons: { f5: 'bir', f2: 'iki', f9: 'uc', f1: 'dort' } }),
  })
  const r = await startMoodGauntlet(deps, { text: 'cozy', quickMoodId: 'cozy' })
  assertEquals(r.status, 'ok')
  if (r.status !== 'ok') return
  assertEquals(r.set.four.map((f) => f.id), ['f5', 'f2', 'f9', 'f1'])
  assertEquals(r.set.reasons.f5, 'bir')
  assertEquals(r.set.backups.map((f) => f.id), ['f3', 'f4', 'f6']) // v4 sirasi, dortlu disi ilk 3
  assertEquals(r.set.reranked, true)
  assertEquals(calls.parse, 1)
  assertEquals(calls.match.length, 1)
  assertEquals(calls.fallbacks, [])
  // recommended_film_ids = four + backups sirayla
  assertEquals(calls.recorded[0], ['f5', 'f2', 'f9', 'f1', 'f3', 'f4', 'f6'])
})

Deno.test('rerank basarisiz: v4 sirasiyla ilk 4, gerekcesiz, fallback isaretlenir', async () => {
  const { deps, calls } = makeDeps({ rerank: () => ({ ok: false, failure: 'timeout' }) })
  const r = await startMoodGauntlet(deps, { text: 'x' })
  assert(r.status === 'ok')
  if (r.status !== 'ok') return
  assertEquals(r.set.four.map((f) => f.id), ['f1', 'f2', 'f3', 'f4'])
  assertEquals(r.set.reasons, {})
  assertEquals(r.set.reranked, false)
  assertEquals(calls.fallbacks, ['rerank'])
})

Deno.test('rerank throw eder: hat surer, hata onError ile raporlanir (sessiz degil)', async () => {
  const { deps, calls } = makeDeps({
    rerank: () => {
      throw new Error('net')
    },
  })
  const r = await startMoodGauntlet(deps, { text: 'x' })
  assert(r.status === 'ok')
  assertEquals(calls.errors, ['rerank'])
  assertEquals(calls.fallbacks, ['rerank'])
})

Deno.test('rerank kismi id dondurur: eksikler v4 sirasiyla tamamlanir, gecersiz id atilir', async () => {
  const { deps } = makeDeps({ rerank: () => ({ ok: true, ids: ['f7', 'yok', 'f7', 'f3'], reasons: { f7: 'a' } }) })
  const r = await startMoodGauntlet(deps, { text: 'x' })
  assert(r.status === 'ok')
  if (r.status !== 'ok') return
  assertEquals(r.set.four.map((f) => f.id), ['f7', 'f3', 'f1', 'f2'])
  assertEquals(r.set.reasons, { f7: 'a' })
})

Deno.test('gerekce "" veya bosluk: reasonFor null, set.reasons icine girmez', async () => {
  assertEquals(reasonFor({ a: '' }, 'a'), null)
  assertEquals(reasonFor({ a: '   ' }, 'a'), null)
  assertEquals(reasonFor({ a: ' iyi ' }, 'a'), 'iyi')
  assertEquals(reasonFor(undefined, 'a'), null)
  assertEquals(reasonFor({}, 'a'), null)
  const { deps } = makeDeps({
    rerank: () => ({ ok: true, ids: ['f1', 'f2', 'f3', 'f4'], reasons: { f1: '', f2: '  ', f3: 'var' } }),
  })
  const r = await startMoodGauntlet(deps, { text: 'x' })
  if (r.status !== 'ok') throw new Error('ok bekleniyordu')
  assertEquals(r.set.reasons, { f3: 'var' })
})

Deno.test('v4 <4: once genres_include duser, sonra min_similarity zinciri; genres_exclude ASLA duser', async () => {
  const p = parsed({ genresInclude: ['Comedy'], genresExclude: ['Horror'], maxRuntime: 90 })
  const { deps, calls } = makeDeps({ parsed: p, matchResults: [rows(2), rows(3), rows(5)] })
  const r = await startMoodGauntlet(deps, { text: 'x' })
  assert(r.status === 'ok')
  assertEquals(calls.match.length, 3)
  assertEquals(calls.match[0].genresInclude, ['Comedy'])
  assertEquals(calls.match[1].genresInclude, [])
  assertEquals(calls.match[1].minSimilarity, calls.match[0].minSimilarity) // ayni esik, yalniz tur dustu
  assert(calls.match[2].minSimilarity < calls.match[1].minSimilarity)
  for (const c of calls.match) {
    assertEquals(c.genresExclude, ['Horror'])
    assertEquals(c.maxRuntime, 90) // sessizce dusmedi
  }
  assert(calls.fallbacks.includes('genres_relaxed'))
  assert(calls.fallbacks.includes('similarity_relaxed'))
  if (r.status === 'ok') assertEquals(r.session.notices, [])
})

Deno.test('hic yetmezse max_runtime en son duser ve GORUNUR not tasinir', async () => {
  const p = parsed({ maxRuntime: 80, genresExclude: ['Horror'] })
  const attempts = buildV4Attempts(false, true)
  const results: MatchRow[][] = attempts.map((_, i) => (i === attempts.length - 1 ? rows(6) : rows(1)))
  const { deps, calls } = makeDeps({ parsed: p, matchResults: results })
  const r = await startMoodGauntlet(deps, { text: 'x' })
  assert(r.status === 'ok')
  if (r.status !== 'ok') return
  assertEquals(calls.match[calls.match.length - 1].maxRuntime, null)
  assertEquals(calls.match[calls.match.length - 1].genresExclude, ['Horror'])
  assertEquals(r.session.notices, ['max_runtime_dropped'])
  assert(calls.fallbacks.includes('max_runtime_dropped'))
})

Deno.test('max_runtime dusurmeden yeterli sonuc varsa not YOK', async () => {
  const { deps } = makeDeps({ parsed: parsed({ maxRuntime: 90 }), matchResults: [rows(1), rows(8)] })
  const r = await startMoodGauntlet(deps, { text: 'x' })
  if (r.status !== 'ok') throw new Error('ok bekleniyordu')
  assertEquals(r.session.notices, [])
})

Deno.test('tum denemeler <4: insufficient (sahte dolgu yok)', async () => {
  const { deps } = makeDeps({ matchResults: [rows(2)] })
  const r = await startMoodGauntlet(deps, { text: 'x' })
  assertEquals(r.status, 'insufficient')
})

Deno.test('dislama birlesimi: gosterilen + recent + kutuphane, tekrarsiz, 500 siniri, oncelik', () => {
  assertEquals(mergeExclusions({ shown: ['a', 'b'], recent: ['b', 'c'], library: ['c', 'd'] }), ['a', 'b', 'c', 'd'])
  const lib = Array.from({ length: 600 }, (_, i) => `l${i}`)
  const m = mergeExclusions({ shown: ['s1'], recent: ['r1'], library: lib })
  assertEquals(m.length, MAX_EXCLUDE_IDS)
  assertEquals(m.slice(0, 2), ['s1', 'r1'])
})

Deno.test('v4 cagrisina exclude_ids = kutuphane + recent + carryShown birlesimi gider', async () => {
  const { deps, calls } = makeDeps({ parsed: parsed({ excludeRecentIds: ['r1'] }), library: ['w1', 'w2'] })
  await startMoodGauntlet(deps, { text: 'x', carryShown: ['c1'] })
  assertEquals(calls.match[0].excludeIds, ['c1', 'r1', 'w1', 'w2'])
})

Deno.test('Baska bir dortlu: YENI PARSE YOK, v4 yeniden cagrilmaz, kalan adaylardan yeni rerank, tekrar yok', async () => {
  const { deps, calls } = makeDeps({ matchResults: [rows(12)], rerank: topFour })
  const first = await startMoodGauntlet(deps, { text: 'x' })
  if (first.status !== 'ok') throw new Error('ok')
  const second = await nextFour(deps, first.session)
  if (second.status !== 'ok') throw new Error('ok')
  assertEquals(calls.parse, 1)
  assertEquals(calls.match.length, 1)
  assertEquals(calls.rerank, 2)
  const a = first.set.four.map((f) => f.id)
  const b = second.set.four.map((f) => f.id)
  assertEquals(a.filter((x) => b.includes(x)), [])
  assertEquals(second.set.setIndex, 1)
  assert(second.set.setId !== first.set.setId)
  // recommended_film_ids birikir
  assertEquals(calls.recorded[1].slice(0, calls.recorded[0].length), calls.recorded[0])
})

Deno.test('adaylar biterse exhausted (yeni arama onerisi)', async () => {
  const { deps } = makeDeps({ matchResults: [rows(7)], rerank: topFour })
  const first = await startMoodGauntlet(deps, { text: 'x' })
  if (first.status !== 'ok') throw new Error('ok')
  const second = await nextFour(deps, first.session) // kalan 3 < 4
  assertEquals(second.status, 'exhausted')
})

Deno.test('sonuc ekraninda gorulen yedekler sonraki dortluden dislanir', async () => {
  const { deps } = makeDeps({ matchResults: [rows(9)], rerank: topFour })
  const first = await startMoodGauntlet(deps, { text: 'x' })
  if (first.status !== 'ok') throw new Error('ok')
  const sess = noteBackupsShown(first.session, first.set.backups)
  const second = await nextFour(deps, sess)
  // 9 aday - 4 dortlu - 3 yedek = 2 kalir → exhausted
  assertEquals(second.status, 'exhausted')
})

Deno.test('recordRecommended hata verirse hat durmaz, onError + fallback isaretlenir', async () => {
  const { deps, calls } = makeDeps({ recordThrows: true, rerank: topFour })
  const r = await startMoodGauntlet(deps, { text: 'x' })
  assertEquals(r.status, 'ok')
  assertEquals(calls.errors, ['record_ids'])
})

Deno.test('searchId yoksa recordRecommended cagrilmaz', async () => {
  const { deps, calls } = makeDeps({ parsed: parsed({ searchId: null }), rerank: topFour })
  await startMoodGauntlet(deps, { text: 'x' })
  assertEquals(calls.recorded.length, 0)
})

Deno.test('pickFour: rerank null → havuz sirasi', () => {
  const p = pickFour(rows(6), null)
  assertEquals(p.four.map((f) => f.id), ['f1', 'f2', 'f3', 'f4'])
  assertEquals(p.backups.map((f) => f.id), ['f5', 'f6'])
  assertEquals(p.reranked, false)
})

Deno.test('withModifier: tek modifier eklenir, bos modifier metni degistirmez', () => {
  assertEquals(withModifier('  yagmurlu bir aksam ', 'daha hafif'), 'yagmurlu bir aksam. daha hafif')
  assertEquals(withModifier('x', '  '), 'x')
})

Deno.test('v4 deneme plani: kisit yoksa 4 basamak; genres/runtime varsa ek basamaklar', () => {
  assertEquals(buildV4Attempts(false, false).length, 4)
  assertEquals(buildV4Attempts(true, false).length, 5)
  assertEquals(buildV4Attempts(true, true).length, 6)
  assert(buildV4Attempts(true, true).slice(0, -1).every((a) => a.keepRuntime))
  assertEquals(buildV4Attempts(true, true).at(-1)?.keepRuntime, false)
})

Deno.test('onStage: parse sonrasi profileName ile parsed, rerank oncesi picking (yalniz bu sirayla)', async () => {
  const { deps } = makeDeps({ rerank: topFour })
  const seen: string[] = []
  await startMoodGauntlet(deps, {
    text: 'x',
    onStage: (e) => {
      seen.push(e.stage === 'parsed' ? `parsed:${e.profileName}` : e.stage)
    },
  })
  assertEquals(seen, ['parsed:Cozy Night', 'picking'])
})
