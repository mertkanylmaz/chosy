/**
 * Loading L1 — hız ve adalet düzeltmeleri:
 *  (1) recommended_film_ids yazımı beklenmez, hata raporlanır, aynı searchId için sıra korunur
 *  (2) "Try again" aynı client_search_id; 409 IN_PROGRESS'te bir kez sunucu beklemesi; replay'de
 *      eksik exclude_recent_ids önceki denemeden
 *  (3) mood_first_poster_visible dörtlü başına bir kez
 * Run: npm run test:mood-gauntlet
 */
import { assert, assertEquals, assertMatch, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  newSearchAttempt,
  nextFour,
  recordWritesSettled,
  startMoodGauntlet,
  type FallbackStage,
  type MatchRow,
  type MatchV4Args,
  type MoodGauntletDeps,
  type ParsedMoodV2,
} from '../../services/moodGauntlet.ts'
import { QUICK_MOOD_IDS } from '../../supabase/functions/_shared/moodParseCache.ts'
import { createFirstPosterTracker, type PosterUnmatchedReason } from '../../utils/moodFirstPoster.ts'
import {
  assertNoFreeText,
  FIRST_POSTER_TRIGGERS,
  firstPosterVisibleEvent,
  MOOD_GAUNTLET_EVENT_NAMES,
  MOOD_POSTER_PATHS,
  sendMoodEvent,
} from '../../utils/moodGauntletAnalytics.ts'
import { classifyMoodSearchError, GAUNTLET_RETRY_MAX_WAIT_MS, inProgressRetryDelayMs } from '../../utils/moodSearchRetry.ts'

const read = (p: string): string =>
  Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url)).replaceAll('\r\n', '\n')

const row = (n: number): MatchRow => ({
  id: `f${n}`, title: `Film ${n}`, year: 2000, poster_url: null, backdrop_url: null,
  overview: null, genres: ['Drama'], runtime: 100, vote_average: 7, director: null, similarity: 1 - n / 100,
})
const rows = (n: number): MatchRow[] => Array.from({ length: n }, (_, i) => row(i + 1))

const parsed = (over: Partial<ParsedMoodV2> = {}): ParsedMoodV2 => ({
  profile: { p: 1 }, searchId: 's-1', searchKeywords: [], profileName: null,
  genresInclude: [], genresExclude: [], maxRuntime: null, referenceTitles: [], suggestedTitles: [],
  excludeRecentIds: [], cacheHit: false, ...over,
})

interface Deferred {
  promise: Promise<void>
  resolve: () => void
  reject: (e: unknown) => void
}
function deferred(): Deferred {
  let resolve!: () => void
  let reject!: (e: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

class FakeParseError extends Error {
  constructor(public readonly code: string, public readonly originalError?: unknown) {
    super(code)
  }
}
const inProgress = (retryAfter: unknown = 5): FakeParseError =>
  new FakeParseError('IN_PROGRESS', { code: 'IN_PROGRESS', retry_after: retryAfter })

interface Log {
  parseIds: string[]
  match: MatchV4Args[]
  writes: { phase: 'start' | 'end'; ids: string[] }[]
  errors: FallbackStage[]
  fallbacks: FallbackStage[]
  traces: string[]
  sleeps: number[]
}

function makeDeps(opts: {
  parse?: (clientSearchId: string, n: number) => Promise<ParsedMoodV2>
  /** n. yazım (0 tabanlı) için gecikme/sonuç denetimi; yoksa hemen çözülür. */
  write?: (n: number) => Promise<void>
  matchThrowsOnce?: boolean
}): { deps: MoodGauntletDeps; log: Log } {
  const log: Log = { parseIds: [], match: [], writes: [], errors: [], fallbacks: [], traces: [], sleeps: [] }
  let id = 0
  let parseN = 0
  let writeN = 0
  let matchThrown = false
  const deps: MoodGauntletDeps = {
    parse: ({ clientSearchId }) => {
      log.parseIds.push(clientSearchId)
      return opts.parse ? opts.parse(clientSearchId, parseN++) : Promise.resolve(parsed())
    },
    matchV4: (args) => {
      log.match.push(args)
      if (opts.matchThrowsOnce && !matchThrown) {
        matchThrown = true
        return Promise.reject(new Error('match_films_v4: down'))
      }
      return Promise.resolve(rows(30))
    },
    rerank: () => Promise.resolve({ ok: false, failure: 'off' }),
    loadExclusions: () => Promise.resolve([]),
    recordRecommended: async (_s, ids) => {
      const n = writeN++
      log.writes.push({ phase: 'start', ids: [...ids] })
      if (opts.write) await opts.write(n)
      log.writes.push({ phase: 'end', ids: [...ids] })
    },
    newId: () => `id-${++id}`,
    onFallback: (s) => {
      log.fallbacks.push(s)
    },
    onError: (s) => {
      log.errors.push(s)
    },
    trace: (m) => {
      log.traces.push(m)
    },
    sleep: (ms) => {
      log.sleeps.push(ms)
      return Promise.resolve()
    },
  }
  return { deps, log }
}

// ─── (1) Arka plan yazımı ────────────────────────────────────────────────────

Deno.test('L1-1: dörtlü yazımı BEKLEMEDEN döner; yazım hatası onError(record_ids) + fallback ile raporlanır', async () => {
  const gate = deferred()
  const { deps, log } = makeDeps({ write: () => gate.promise })
  const r = await startMoodGauntlet(deps, { text: 'cozy' })
  assertEquals(r.status, 'ok')
  // Yazım başladı ama bitmedi: set yine de döndü
  assertEquals(log.writes.map((w) => w.phase), ['start'])
  assertEquals(log.errors, [])
  gate.reject(new Error('mood_searches update: 401'))
  await recordWritesSettled(deps)
  assertEquals(log.errors, ['record_ids'])
  assert(log.fallbacks.includes('record_ids'))
})

Deno.test('L1-1: senkron fırlatan recordRecommended da yakalanır (yakalanmamış red yok)', async () => {
  const { deps, log } = makeDeps({})
  deps.recordRecommended = () => {
    throw new Error('sync boom')
  }
  const r = await startMoodGauntlet(deps, { text: 'cozy' })
  assertEquals(r.status, 'ok')
  await recordWritesSettled(deps)
  assertEquals(log.errors, ['record_ids'])
})

Deno.test('L1-1 sıra: set 1 yazımı geç biter, set 2 erken gelir → set 2 set 1 bitince yazılır, son liste set 2 birikimi', async () => {
  const slow = deferred()
  const { deps, log } = makeDeps({ write: (n) => (n === 0 ? slow.promise : Promise.resolve()) })
  const first = await startMoodGauntlet(deps, { text: 'cozy' })
  assert(first.status === 'ok')
  const second = await nextFour(deps, first.session)
  assert(second.status === 'ok')
  // Set 2 geldi ama set 1 bitmeden set 2 yazımı BAŞLAMAZ
  assertEquals(log.writes.map((w) => w.phase), ['start'])
  slow.resolve()
  await recordWritesSettled(deps)
  assertEquals(log.writes.map((w) => w.phase), ['start', 'end', 'start', 'end'])
  const last = log.writes[log.writes.length - 1].ids
  assertEquals(last, second.session.recorded)
  // Birikim: set 1 listesi set 2 listesinin öneki
  const firstIds = log.writes[0].ids
  assertEquals(last.slice(0, firstIds.length), firstIds)
  assert(last.length > firstIds.length)
  assertEquals(log.errors, [])
})

Deno.test('L1-1: zincirde bir halka hata verirse sonraki yazım yine yapılır (sıra bozulmaz)', async () => {
  const { deps, log } = makeDeps({ write: (n) => (n === 0 ? Promise.reject(new Error('db')) : Promise.resolve()) })
  const first = await startMoodGauntlet(deps, { text: 'cozy' })
  assert(first.status === 'ok')
  const second = await nextFour(deps, first.session)
  assert(second.status === 'ok')
  await recordWritesSettled(deps)
  assertEquals(log.errors, ['record_ids'])
  assertEquals(log.writes[log.writes.length - 1], { phase: 'end', ids: second.session.recorded })
})

// ─── (2) Try again: aynı kimlik ──────────────────────────────────────────────

Deno.test('L1-2: aynı attempt nesnesi → parse aynı client_search_id; attempt yoksa her başlangıç yeni kimlik', async () => {
  const { deps, log } = makeDeps({})
  const attempt = newSearchAttempt(() => 'search-A')
  await startMoodGauntlet(deps, { text: 'cozy', attempt })
  await startMoodGauntlet(deps, { text: 'cozy', attempt, isRetry: true })
  await startMoodGauntlet(deps, { text: 'cozy' })
  await startMoodGauntlet(deps, { text: 'cozy' })
  assertEquals(log.parseIds.slice(0, 2), ['search-A', 'search-A'])
  assert(log.parseIds[2] !== log.parseIds[3], 'yeni giriş yeni kimlik')
  assert(!log.parseIds.slice(2).includes('search-A'))
})

Deno.test('L1-2 kaynak: retry lastAttempt ile; startFromEntry / reset yeni kimlik; another_four / intensify parse çağırmaz', () => {
  const hook = read('components/MoodGauntlet/useMoodGauntlet.ts')
  const retry = hook.slice(hook.indexOf('const retry = useCallback'), hook.indexOf('const fourPosterLoaded'))
  assertMatch(retry, /attempt: lastAttempt\.current \?\? newSearchAttempt\(\(\) => deps\.newId\(\)\),\s*isRetry: true,/)
  // Varsayılan: yeni kimlik, isRetry false
  assertMatch(hook, /search: \{ attempt: MoodSearchAttempt; isRetry: boolean \} = \{\s*attempt: newSearchAttempt\(\(\) => deps\.newId\(\)\),\s*isRetry: false,/)
  assertMatch(hook, /const startFromEntry = useCallback\(\(input: StartInput\) => start\(input, \[\]\), \[start\]\);/)
  assertMatch(hook, /lastAttempt\.current = null; \/\/ New search/)
  assertEquals((hook.match(/isRetry: true/g) ?? []).length, 1)
  for (const [fn, end] of [['const loadAnother', 'const record = useCallback'], ['const intensify', 'const retry = useCallback']]) {
    const from = hook.indexOf(fn)
    const to = hook.indexOf(end, from)
    assert(from > 0 && to > from, `${fn} bulunamadi`)
    const body = hook.slice(from, to)
    assert(!/startMoodGauntlet|attempt:/.test(body), `${fn}: parse/kimlik yok`)
  }
})

Deno.test('L1-2 409: Try again → 409 IN_PROGRESS → retry_after kadar bekle → tekrar → başarı (aynı kimlik)', async () => {
  const { deps, log } = makeDeps({
    parse: (_id, n) => (n === 0 ? Promise.reject(inProgress(5)) : Promise.resolve(parsed())),
  })
  const attempt = newSearchAttempt(() => 'search-B')
  const r = await startMoodGauntlet(deps, { text: 'cozy', attempt, isRetry: true })
  assertEquals(r.status, 'ok')
  assertEquals(log.parseIds, ['search-B', 'search-B'])
  assertEquals(log.sleeps, [5000])
  assert(log.traces.includes('mood_parse_in_progress_wait'))
})

Deno.test('L1-2 409: 409 → 409 → hata fırlar (UI: busy), yalnız BİR otomatik deneme', async () => {
  const { deps, log } = makeDeps({ parse: () => Promise.reject(inProgress(5)) })
  const err = await assertRejects(() =>
    startMoodGauntlet(deps, { text: 'cozy', attempt: newSearchAttempt(() => 'search-C'), isRetry: true })
  )
  assertEquals((err as FakeParseError).code, 'IN_PROGRESS')
  assertEquals(classifyMoodSearchError('IN_PROGRESS'), 'retry_same_id') // useMoodGauntlet: → 'busy'
  assertEquals(log.parseIds.length, 2)
  assertEquals(log.sleeps.length, 1)
})

Deno.test('L1-2 409: retry_after üst sınırı 5 sn; ilk aramada (isRetry yok) bekleme yok, hata hemen', async () => {
  assertEquals(inProgressRetryDelayMs(inProgress(30)), GAUNTLET_RETRY_MAX_WAIT_MS)
  assertEquals(inProgressRetryDelayMs(inProgress(2)), 2000)
  assertEquals(inProgressRetryDelayMs(inProgress('x')), GAUNTLET_RETRY_MAX_WAIT_MS)
  assertEquals(inProgressRetryDelayMs(new FakeParseError('QUOTA_EXCEEDED')), null)
  assertEquals(inProgressRetryDelayMs(new Error('net')), null)
  const { deps, log } = makeDeps({ parse: () => Promise.reject(inProgress(5)) })
  await assertRejects(() => startMoodGauntlet(deps, { text: 'cozy' }))
  assertEquals(log.parseIds.length, 1)
  assertEquals(log.sleeps, [])
})

Deno.test('L1-2 replay: exclude_recent_ids eksik → ilk denemenin listesi kullanılır', async () => {
  const { deps, log } = makeDeps({
    matchThrowsOnce: true, // ilk deneme parse'tan SONRA düşer (Try again senaryosu)
    parse: (_id, n) =>
      Promise.resolve(n === 0 ? parsed({ excludeRecentIds: ['r1', 'r2'] }) : parsed({ excludeRecentIdsMissing: true })),
  })
  // mood-four yok → eski yol (matchV4) — ilk denemede matchV4 fırlatır
  const attempt = newSearchAttempt(() => 'search-D')
  await assertRejects(() => startMoodGauntlet(deps, { text: 'cozy', attempt }))
  assertEquals(attempt.recentIds, ['r1', 'r2'])
  const r = await startMoodGauntlet(deps, { text: 'cozy', attempt, isRetry: true })
  assertEquals(r.status, 'ok')
  const retryMatch = log.match[log.match.length - 1]
  assert(retryMatch.excludeIds.includes('r1') && retryMatch.excludeIds.includes('r2'))
  assert(!log.traces.includes('mood_parse_recent_ids_missing'))
})

Deno.test('L1-2 replay: exclude_recent_ids eksik ve önceki değer yok → [] ile devam + breadcrumb (sessiz değil)', async () => {
  const { deps, log } = makeDeps({ parse: () => Promise.resolve(parsed({ excludeRecentIdsMissing: true })) })
  const r = await startMoodGauntlet(deps, { text: 'cozy', attempt: newSearchAttempt(() => 'search-E'), isRetry: true })
  assertEquals(r.status, 'ok')
  assertEquals(log.match[0].excludeIds, [])
  assert(log.traces.includes('mood_parse_recent_ids_missing'))
})

Deno.test('L1-2 deps: yanıtta exclude_recent_ids alanı yoksa excludeRecentIdsMissing işaretlenir; trace = Sentry breadcrumb', () => {
  const deps = read('services/moodGauntletDeps.ts')
  assertMatch(deps, /\.\.\.\(raw\.exclude_recent_ids === undefined \? \{ excludeRecentIdsMissing: true \} : \{\}\),/)
  assertMatch(deps, /trace: \(message: string, data\?: Record<string, string \| number \| boolean>\) => \{\s*Sentry\.addBreadcrumb\(/)
})

// ─── (3) mood_first_poster_visible ───────────────────────────────────────────

Deno.test('L1-3: olay dörtlü başına BİR kez; başka dörtlünün onLoad’u ve yeniden kurulum eskiyi geçersiz kılar', () => {
  const unmatched: PosterUnmatchedReason[] = []
  const tr = createFirstPosterTracker((r) => unmatched.push(r))
  tr.arm({ startedAt: 1000, trigger: 'start', entry: 'quick', quickMoodId: 'cozy', consentShown: true })
  assertEquals(tr.posterLoaded('set-1', 1100), null) // henüz bağlanmadı
  tr.bind('set-1', 'unified')
  assertEquals(tr.posterLoaded('set-0', 1200), null) // başka dörtlü
  const ev = tr.posterLoaded('set-1', 2500)
  assertEquals(ev, {
    name: 'mood_first_poster_visible',
    props: { ms: 1500, entry: 'quick', quick_mood_id: 'cozy', path: 'unified', trigger: 'start', consent_shown: true },
  })
  // Aynı dörtlünün diğer 3 posteri: olay yok
  assertEquals(tr.posterLoaded('set-1', 2600), null)
  assertEquals(tr.posterLoaded('set-1', 2700), null)

  // Another four: yeni ölçüm; eski dörtlünün geç onLoad'u olay üretmez
  tr.arm({ startedAt: 5000, trigger: 'another_four', entry: 'quick', quickMoodId: 'cozy', consentShown: false })
  tr.bind('set-2', 'legacy')
  assertEquals(tr.posterLoaded('set-1', 5100), null)
  const ev2 = tr.posterLoaded('set-2', 5900)
  assertEquals(ev2?.props.trigger, 'another_four')
  assertEquals(ev2?.props.ms, 900)
  assertEquals(ev2?.props.path, 'legacy')

  // Bağlanmadan yeniden kurulum (iptal) + clear: olay yok
  tr.arm({ startedAt: 9000, trigger: 'intensify', entry: 'free_text', quickMoodId: null, consentShown: false })
  tr.clear()
  tr.bind('set-3', 'legacy')
  assertEquals(tr.posterLoaded('set-3', 9500), null)

  // Düşen her ölçüm sessiz değil: nedeniyle bildirilir (hook → Sentry breadcrumb)
  assertEquals(unmatched, ['unbound', 'other_set', 'already_fired', 'already_fired', 'already_fired', 'unbound'])
})

Deno.test('L1-3 fix (REACT-NATIVE-1P): trigger × path × entry × tüm quick mood id → assertNoFreeText geçer', () => {
  const quickIds = [...QUICK_MOOD_IDS]
  assert(quickIds.length >= 8)
  let n = 0
  for (const trigger of FIRST_POSTER_TRIGGERS) {
    for (const path of MOOD_POSTER_PATHS) {
      for (const entry of ['quick', 'free_text'] as const) {
        for (const quickMoodId of [...quickIds, null]) {
          const ev = firstPosterVisibleEvent({ ms: 1234, entry, quickMoodId, path, trigger, consentShown: n % 2 === 0 })
          assertNoFreeText(ev)
          n++
        }
      }
    }
  }
  assertEquals(n, 3 * 2 * 2 * (quickIds.length + 1))
  // Diziler tip ile aynı değerleri taşır (tek kaynak)
  assertEquals([...FIRST_POSTER_TRIGGERS], ['start', 'another_four', 'intensify'])
  assertEquals([...MOOD_POSTER_PATHS], ['unified', 'legacy'])
  // ALLOWED_STRINGS bu değerleri dizilerden alır; elle yazılmış kopya yok
  const src = read('utils/moodGauntletAnalytics.ts')
  const allowed = src.slice(src.indexOf('const ALLOWED_STRINGS'), src.indexOf(']);', src.indexOf('const ALLOWED_STRINGS')))
  assertMatch(allowed, /\.\.\.FIRST_POSTER_TRIGGERS,\s*\.\.\.MOOD_POSTER_PATHS,/)
  for (const v of ["'start'", "'another_four'", "'intensify'", "'unified'"]) assert(!allowed.includes(v), `${v} elle yazılmamalı`)
})

Deno.test('L1-3 fix: gerçek gönderim yolu — sendMoodEvent olayı PostHog mock’una iletir; sızıntı gönderilmez', () => {
  const sent: { name: string; props: Record<string, unknown> }[] = []
  const leaks: unknown[] = []
  const sink = { track: (name: string, props: Record<string, string | number | boolean | null>) => sent.push({ name, props }), reportLeak: (e: unknown) => leaks.push(e) }

  // Cihazdaki iki aramanın aynısı: Date Night, unified yol, start
  const tr = createFirstPosterTracker(() => undefined)
  tr.arm({ startedAt: 0, trigger: 'start', entry: 'quick', quickMoodId: 'datenight', consentShown: false })
  tr.bind('set-a', 'unified')
  const ev = tr.posterLoaded('set-a', 2900)
  assert(ev !== null)
  sendMoodEvent(ev, sink)
  assertEquals(leaks, [])
  assertEquals(sent, [{
    name: 'mood_first_poster_visible',
    props: { ms: 2900, entry: 'quick', quick_mood_id: 'datenight', path: 'unified', trigger: 'start', consent_shown: false },
  }])

  // Guard hâlâ çalışır: serbest metin gönderilmez, raporlanır
  sendMoodEvent({ name: 'mood_first_poster_visible', props: { trigger: 'rainy day with my ex' } }, sink)
  assertEquals(sent.length, 1)
  assertEquals(leaks.length, 1)

  // Hook gönderimi bu saf yoldan yapar; breadcrumb mesajı kayıtlı
  const hook = read('components/MoodGauntlet/useMoodGauntlet.ts')
  assertMatch(hook, /export function trackMoodEvent\(ev: MoodEvent\): void \{\s*sendMoodEvent\(ev, moodEventSink\);\s*\}/)
  assertMatch(hook, /track: \(name, props\) => posthogAnalytics\.track\(name, props\),/)
  assertMatch(hook, /code: 'MOOD_EVENT_FREE_TEXT'/)
  assertMatch(hook, /message: 'mood_first_poster_unmatched',\s*data: \{ reason \},/)
})

Deno.test('L1-3: olay yapısı — serbest metinde quick_mood_id null, ms negatif olmaz, ad kayıtlı', () => {
  const ev = firstPosterVisibleEvent({ ms: -5, entry: 'free_text', quickMoodId: 'cozy', path: 'legacy', trigger: 'intensify', consentShown: false })
  assertEquals(ev.props, { ms: 0, entry: 'free_text', quick_mood_id: null, path: 'legacy', trigger: 'intensify', consent_shown: false })
  assert((MOOD_GAUNTLET_EVENT_NAMES as readonly string[]).includes('mood_first_poster_visible'))
})

Deno.test('L1-3 kaynak: hook arm/bind/clear; ölçüm onStart’tan; consent_shown EntryStage’den', () => {
  const hook = read('components/MoodGauntlet/useMoodGauntlet.ts')
  assertMatch(hook, /startedAt\.current = Date\.now\(\);\s*posterTracker\.current\.arm\(\{\s*startedAt: startedAt\.current,\s*trigger: 'start',/)
  assertMatch(hook, /trigger: 'another_four',/)
  assertMatch(hook, /trigger: 'intensify',/)
  assertMatch(hook, /posterTracker\.current\.bind\(res\.set\.setId, res\.path === 'combined' \? 'unified' : 'legacy'\);/)
  assertEquals((hook.match(/posterTracker\.current\.bind\(res\.set\.setId, 'legacy'\)/g) ?? []).length, 2)
  assertMatch(hook, /const ev = posterTracker\.current\.posterLoaded\(setId, Date\.now\(\)\);\s*if \(ev\) trackMoodEvent\(ev\);/)
  const entry = read('components/MoodGauntlet/EntryStage.tsx')
  assertMatch(entry, /consentShown: outcome === 'recorded'/)
  assertMatch(entry, /start: \(input\) => onStart\(\{ \.\.\.input, consentShown: pendingRef\.current !== null \}\),/)
})

Deno.test('L1-3 PosterTile: onLoad isteğe bağlı, yükleme durumu aynen; günlük gauntlet onLoad vermez', () => {
  const tile = read('components/gauntlet/PosterTile/index.tsx')
  assertMatch(tile, /onLoad\?: \(\) => void;/)
  assertMatch(tile, /onLoad=\{\(\) => \{\s*setPosterLoaded\(true\);\s*onLoad\?\.\(\);\s*\}\}/)
  const shell = read('components/gauntlet/GauntletShell/index.tsx')
  const tiles = shell.match(/<PosterTile[\s\S]*?\/>/g) ?? []
  assert(tiles.length >= 2)
  for (const t of tiles) assert(!/onLoad=/.test(t), 'günlük gauntlet PosterTile onLoad almaz')
  const intro = read('components/MoodGauntlet/FourIntro.tsx')
  assertMatch(intro, /<PosterTile film=\{film\} interactive=\{false\} metaMode="yearOnly" onLoad=\{onPosterLoaded\} \/>/)
})
