/**
 * Mood Gauntlet servis birim testleri (Faz 2-1): yedek yolları, dışlama birleşimi,
 * gerekçe "" davranışı, "Başka bir dörtlü" (yeni parse yok), recommended_film_ids sırası.
 * Run: npm run test:mood-gauntlet
 */
import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  buildV4Attempts,
  canShiftIntensity,
  fetchReasons,
  intensifyMoodGauntlet,
  MAX_EXCLUDE_IDS,
  mergeExclusions,
  nextFour,
  nextIntensityStep,
  noteBackupsShown,
  pickFour,
  reasonFor,
  startMoodGauntlet,
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
  /** Her rerank çağrısının withReasons bayrağı (sırayla). */
  rerankFlags: boolean[]
  /** Her rerank çağrısına giden aday id'leri. */
  rerankCandidates: string[][]
  prefetched: string[][]
  timings: Array<[string, number]>
  recorded: string[][]
  fallbacks: FallbackStage[]
  errors: FallbackStage[]
}

function makeDeps(opts: {
  parsed?: ParsedMoodV2
  matchResults?: MatchRow[][] // her matchV4 çağrısı sırayla
  rerank?: (c: MatchRow[], withReasons: boolean) => RerankOutcome | Promise<RerankOutcome>
  library?: string[]
  recordThrows?: boolean
}): { deps: MoodGauntletDeps; calls: Calls } {
  const calls: Calls = {
    parse: 0, match: [], rerank: 0, rerankFlags: [], rerankCandidates: [], prefetched: [], timings: [],
    recorded: [], fallbacks: [], errors: [],
  }
  let id = 0
  let tick = 0
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
    rerank: async ({ candidates, withReasons }) => {
      calls.rerank++
      calls.rerankFlags.push(withReasons)
      calls.rerankCandidates.push(candidates.map((c) => c.id))
      return opts.rerank ? await opts.rerank(candidates, withReasons) : { ok: false, failure: 'http_error' }
    },
    now: () => (tick += 100),
    prefetch: (rs) => {
      calls.prefetched.push(rs.map((r) => r.id))
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
  assertEquals(r.set.reasons, {}) // dortlu gerekcesiz gelir; gerekce ayri cagri (fetchReasons)
  assertEquals(calls.rerankFlags, [false]) // ilk cagri YALNIZ id (reason:false)
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
  assertEquals(r.set.reasons, {})
})

Deno.test('gerekce "" veya bosluk: reasonFor null; fetchReasons bos/bosluk gerekceleri almaz', async () => {
  assertEquals(reasonFor({ a: '' }, 'a'), null)
  assertEquals(reasonFor({ a: '   ' }, 'a'), null)
  assertEquals(reasonFor({ a: ' iyi ' }, 'a'), 'iyi')
  assertEquals(reasonFor(undefined, 'a'), null)
  assertEquals(reasonFor({}, 'a'), null)
  const { deps } = makeDeps({
    rerank: (c, withReasons) =>
      withReasons
        ? { ok: true, ids: ['f1', 'f2', 'f3', 'f4'], reasons: { f1: '', f2: '  ', f3: 'var' } }
        : topFour(c),
  })
  const r = await startMoodGauntlet(deps, { text: 'x' })
  if (r.status !== 'ok') throw new Error('ok bekleniyordu')
  assertEquals(await fetchReasons(deps, r.session, r.set), { f3: 'var' })
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

// ─── Faz 2-1b: hiz (rerank bolme, prefetch, olcum) ───────────────────────────

Deno.test('hiz: dortlu reason:false ile gelir; gerekce AYRI cagri, YALNIZ bu 4 film, reason:true', async () => {
  const { deps, calls } = makeDeps({
    rerank: (c, withReasons) =>
      withReasons
        ? { ok: true, ids: c.map((x) => x.id), reasons: Object.fromEntries(c.map((x) => [x.id, `neden ${x.id}`])) }
        : { ok: true, ids: ['f6', 'f2', 'f9', 'f1'], reasons: {} },
  })
  const r = await startMoodGauntlet(deps, { text: 'x' })
  if (r.status !== 'ok') throw new Error('ok')
  assertEquals(calls.rerank, 1) // dortlu gosterilirken gerekce cagrisi HENUZ yok
  assertEquals(r.set.reasons, {})
  const reasons = await fetchReasons(deps, r.session, r.set)
  assertEquals(calls.rerankFlags, [false, true])
  assertEquals(calls.rerankCandidates[1], ['f6', 'f2', 'f9', 'f1']) // yalniz dortlu
  assertEquals(Object.keys(reasons).sort(), ['f1', 'f2', 'f6', 'f9'])
  assertEquals(reasons.f6, 'neden f6')
})

Deno.test('hiz: ilk (id) rerank en cok 20 aday alir', async () => {
  const { deps, calls } = makeDeps({ matchResults: [rows(40)], rerank: topFour })
  await startMoodGauntlet(deps, { text: 'x' })
  assertEquals(calls.rerankCandidates[0].length, 20)
})

Deno.test('gerekce basarisiz: bos doner (satir yok), fallback isaretlenir; throw → onError', async () => {
  const fail = makeDeps({
    rerank: (c, withReasons) => (withReasons ? { ok: false, failure: 'timeout' } : topFour(c)),
  })
  const r1 = await startMoodGauntlet(fail.deps, { text: 'x' })
  if (r1.status !== 'ok') throw new Error('ok')
  assertEquals(await fetchReasons(fail.deps, r1.session, r1.set), {})
  assertEquals(fail.calls.fallbacks, ['reasons'])

  const boom = makeDeps({
    rerank: (c, withReasons) => {
      if (withReasons) throw new Error('net')
      return topFour(c)
    },
  })
  const r2 = await startMoodGauntlet(boom.deps, { text: 'x' })
  if (r2.status !== 'ok') throw new Error('ok')
  assertEquals(await fetchReasons(boom.deps, r2.session, r2.set), {})
  assertEquals(boom.calls.errors, ['reasons'])
  assertEquals(boom.calls.fallbacks, ['reasons'])
})

Deno.test('id-rerank zaten dustuyse gerekce cagrisi ATILMAZ (limitte ikinci istek yakilmaz)', async () => {
  const { deps, calls } = makeDeps({ rerank: () => ({ ok: false, failure: 'http_429' }) })
  const r = await startMoodGauntlet(deps, { text: 'x' })
  if (r.status !== 'ok') throw new Error('ok')
  assertEquals(await fetchReasons(deps, r.session, r.set), {})
  assertEquals(calls.rerank, 1)
})

Deno.test('prefetch: v4 doner donmez ilk 8 aday, dortlu belli olunca dortlu + yedekler', async () => {
  const { deps, calls } = makeDeps({ rerank: topFour })
  const r = await startMoodGauntlet(deps, { text: 'x' })
  if (r.status !== 'ok') throw new Error('ok')
  assertEquals(calls.prefetched[0], ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8'])
  assertEquals(calls.prefetched[1], [...r.set.four, ...r.set.backups].map((f) => f.id))
})

Deno.test('olcum: parse / v4 / pick sureleri sirayla bildirilir (metin yok)', async () => {
  const { deps } = makeDeps({ rerank: topFour })
  const seen: Array<[string, number]> = []
  await startMoodGauntlet(deps, { text: 'gizli metin', onTiming: (s, ms) => seen.push([s, ms]) })
  assertEquals(seen.map(([s]) => s), ['parse', 'v4', 'pick'])
  assert(seen.every(([, ms]) => ms > 0))
})

// ─── Faz 2-1b: yogunluk (parse tekrarlanmaz) ─────────────────────────────────

const profile = (over: Record<string, unknown> = {}) => ({
  energy_level: 0.5, thematic_depth: 0.5, pace_preference: 'medium', visual_style: 'cinematic', ...over,
})

Deno.test('yogunluk: PARSE YOK, kota dusmez; v4 + rerank yeniden; kisitlar korunur; ayni mood_search_id', async () => {
  const p = parsed({ profile: profile(), genresExclude: ['Thriller'], maxRuntime: 120, searchId: 'S1' })
  const { deps, calls } = makeDeps({ parsed: p, matchResults: [rows(30), rows(30, 100)], rerank: topFour })
  const first = await startMoodGauntlet(deps, { text: 'rainy', quickMoodId: 'rainy' })
  if (first.status !== 'ok') throw new Error('ok')
  const hot = await intensifyMoodGauntlet(deps, first.session, 'stronger')
  if (hot.status !== 'ok') throw new Error('ok')
  assertEquals(calls.parse, 1) // YENI PARSE YOK
  assertEquals(calls.match.length, 2)
  const m = calls.match[1]
  assertEquals(m.genresExclude, ['Thriller']) // kullanicinin kisiti korunur
  assertEquals(m.maxRuntime, 120)
  const prof = m.profile as { energy_level: number; thematic_depth: number; pace_preference: string }
  assertEquals(prof.energy_level, 0.7)
  assertEquals(prof.thematic_depth, 0.7)
  assertEquals(prof.pace_preference, 'fast')
  assertEquals(hot.session.parsed.searchId, 'S1') // ayni arama
  assertEquals(hot.session.intensityStep, 1)
  assertEquals(hot.set.setIndex, 1)
  assertEquals(hot.session.parsed.profile, p.profile) // ozgun profil bozulmaz
  // onceki dortlu yeni aramadan dislanir
  const exclude = m.excludeIds
  for (const f of first.set.four) assert(exclude.includes(f.id))
})

Deno.test('yogunluk: lighter ters yone gider, adimlar OZGUNE gore birikir (modifier birikmesi yok), sinirli', async () => {
  const p = parsed({ profile: profile(), searchId: 'S2' })
  const { deps, calls } = makeDeps({ parsed: p, matchResults: [rows(40)], rerank: topFour })
  const first = await startMoodGauntlet(deps, { text: 'x' })
  if (first.status !== 'ok') throw new Error('ok')
  const l1 = await intensifyMoodGauntlet(deps, first.session, 'lighter')
  if (l1.status !== 'ok') throw new Error('ok')
  const l2 = await intensifyMoodGauntlet(deps, l1.session, 'lighter')
  if (l2.status !== 'ok') throw new Error('ok')
  const e = (n: number) => (calls.match[n].profile as { energy_level: number }).energy_level
  assertEquals([e(1), e(2)], [0.3, 0.1])
  assertEquals((calls.match[1].profile as { pace_preference: string }).pace_preference, 'slow')
  assertEquals(l2.session.intensityStep, -2)
  assertEquals(nextIntensityStep(3, 'stronger'), 3) // sinir
  assert(!canShiftIntensity(3, 'stronger') && canShiftIntensity(3, 'lighter'))
  assert(!canShiftIntensity(-3, 'lighter') && canShiftIntensity(-3, 'stronger'))
  assertEquals(calls.parse, 1)
})

Deno.test('yogunluk: kaydirilmis aday <4 → insufficient (sahte dolgu yok); profil bozuksa hata firlatir', async () => {
  const thin = makeDeps({ parsed: parsed({ profile: profile() }), matchResults: [rows(30), rows(2)], rerank: topFour })
  const first = await startMoodGauntlet(thin.deps, { text: 'x' })
  if (first.status !== 'ok') throw new Error('ok')
  assertEquals((await intensifyMoodGauntlet(thin.deps, first.session, 'stronger')).status, 'insufficient')

  const bad = makeDeps({ parsed: parsed({ profile: { p: 1 } }), rerank: topFour })
  const f2 = await startMoodGauntlet(bad.deps, { text: 'x' })
  if (f2.status !== 'ok') throw new Error('ok')
  let threw = false
  try {
    await intensifyMoodGauntlet(bad.deps, f2.session, 'lighter')
  } catch {
    threw = true
  }
  assert(threw, 'bozuk profil sessizce gecilmemeli')
})

Deno.test('yogunluk: v4 gevsetme zinciri kaydirilmis profille de calisir; genres_exclude ASLA duser', async () => {
  const p = parsed({ profile: profile(), genresInclude: ['Drama'], genresExclude: ['Horror'], maxRuntime: 90 })
  const { deps, calls } = makeDeps({ parsed: p, matchResults: [rows(30), rows(2), rows(6, 100)], rerank: topFour })
  const first = await startMoodGauntlet(deps, { text: 'x' })
  if (first.status !== 'ok') throw new Error('ok')
  const hot = await intensifyMoodGauntlet(deps, first.session, 'stronger')
  assertEquals(hot.status, 'ok')
  for (const c of calls.match.slice(1)) assertEquals(c.genresExclude, ['Horror'])
})
