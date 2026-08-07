/**
 * tasteVector saf mantik testleri (B.5)
 *
 * Calistirma:  npm run test:taste
 *              (supabase/functions icinden: deno test --allow-read _shared/tasteVector.test.ts)
 *
 * DB'ye DOKUNMAZ. Modulun tamami saf oldugu icin tum sozlesme burada
 * dogrulanabilir: shrinkage formulu, determinizm, 0 sinyalde prior devri,
 * bos watch_feedback, carpanlar, config dogrulamasi.
 */

import {
  archetypeCentroids,
  type ChoiceEventRow,
  computeTasteVector,
  deriveLowIntentEventIds,
  formatPgVector,
  l2Norm,
  normalize,
  parsePgVector,
  type TasteVectorConfig,
  validateTasteVectorConfig,
  type WatchFeedbackRow,
} from './tasteVector.ts'
import { VECTOR_DIM } from '../../../services/vectorEncoder.ts'

// ─── Assertion yardimcilari ──────────────────────────────────────────────────
// Kasitli olarak dis bagimlilik YOK (jsr:@std/assert dahil): bu modul Edge
// Function calisma zamaninin parcasi ve test kosumu ag erisimi gerektirmemeli.

function assert(cond: boolean, msg = 'assertion basarisiz'): void {
  if (!cond) throw new Error(msg)
}

function assertEquals<T>(actual: T, expected: T, msg = ''): void {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${msg}\n  beklenen: ${e}\n  gelen:    ${a}`)
}

function assertAlmostEquals(actual: number, expected: number, tol: number, msg = ''): void {
  if (!(Math.abs(actual - expected) <= tol)) {
    throw new Error(`${msg}\n  beklenen: ${expected} (±${tol})\n  gelen:    ${actual}`)
  }
}

function assertThrows(fn: () => unknown, contains: string, msg = ''): void {
  try {
    fn()
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err)
    if (!text.includes(contains)) {
      throw new Error(`${msg}: hata mesaji "${contains}" icermiyor -> ${text}`)
    }
    return
  }
  throw new Error(`${msg}: hata bekleniyordu, atilmadi`)
}

/** Migration 074'teki seed ile BIREBIR ayni. Iraklarsa test kirmizi yanar. */
const CONFIG: TasteVectorConfig = {
  round_weights: { '1': 1.0, '2': 0.9, '3': 0.8 },
  low_confidence_multiplier: 0.3,
  low_intent_multiplier: 0.1,
  low_intent_streak: 3,
  feedback_weights: { loved: 3.0, ok: 0.5, abandoned: -3.0, not_watched: 0 },
  full_confidence_signals: 50,
}

const centroids = archetypeCentroids()

/** Deterministik sahte film vektoru — DB yok, rastgelelik yok. */
function fakeFilmVector(seed: number): number[] {
  const v = new Array<number>(VECTOR_DIM)
  let s = (seed * 2654435761) % 2147483647
  for (let i = 0; i < VECTOR_DIM; i++) {
    s = (s * 1103515245 + 12345) % 2147483647
    v[i] = (s % 1000) / 1000
  }
  return v
}

function makeEvents(n: number, opts: { lowConfidence?: boolean; sessionSize?: number } = {}) {
  const events: ChoiceEventRow[] = []
  const filmVectors = new Map<string, number[]>()
  const sessionSize = opts.sessionSize ?? 3
  for (let i = 0; i < n; i++) {
    const a = `film-a-${String(i).padStart(4, '0')}`
    const b = `film-b-${String(i).padStart(4, '0')}`
    filmVectors.set(a, fakeFilmVector(i * 2 + 1))
    filmVectors.set(b, fakeFilmVector(i * 2 + 2))
    events.push({
      id: `ev-${String(i).padStart(4, '0')}`,
      user_id: 'u1',
      session_id: `sess-${Math.floor(i / sessionSize)}`,
      round: (i % 3) + 1,
      film_a: a,
      film_b: b,
      winner: a,
      outcome: 'choice',
      low_confidence: opts.lowConfidence ?? false,
      created_at: new Date(Date.UTC(2026, 7, 1, 0, i)).toISOString(),
    })
  }
  return { events, filmVectors }
}

const base = (over: Partial<Parameters<typeof computeTasteVector>[0]> = {}) =>
  computeTasteVector({
    events: [],
    feedback: [],
    filmVectors: new Map(),
    userArchetypeId: null,
    config: CONFIG,
    centroids,
    ...over,
  })

// ─── Arketip merkezleri ──────────────────────────────────────────────────────

Deno.test('arketip merkezleri archetypeEngine + vectorEncoder zincirinden turer', () => {
  assertEquals(centroids.size, 12)
  for (const [id, v] of centroids) {
    assertEquals(v.length, VECTOR_DIM, `arketip ${id} yanlis boyut`)
    assert(l2Norm(v) > 1e-9, `arketip ${id} sifir vektor`)
  }
})

// ─── Shrinkage ───────────────────────────────────────────────────────────────

Deno.test('20 choice_event -> user_confidence tam 0.4 (20/50)', () => {
  const { events, filmVectors } = makeEvents(20)
  const r = base({ events, filmVectors })
  assertEquals(r.signal_count, 20)
  assertAlmostEquals(r.user_confidence, 0.4, 1e-12)
  assertEquals(r.taste_vector.length, VECTOR_DIM)
  assertAlmostEquals(l2Norm(r.taste_vector), 1, 1e-9)
  assertEquals(r.observation_degenerate, false)
})

Deno.test('w = min(1, n / full_confidence_signals)', () => {
  for (const n of [1, 10, 25, 50, 80]) {
    const { events, filmVectors } = makeEvents(n)
    const r = base({ events, filmVectors })
    assertAlmostEquals(r.user_confidence, Math.min(1, n / 50), 1e-12, `n=${n}`)
  }
})

// ─── 0 sinyal: prior devri ───────────────────────────────────────────────────

Deno.test('0 sinyal -> bos/null vektor DEGIL, population_mean prior', () => {
  const r = base()
  assertEquals(r.signal_count, 0)
  assertEquals(r.user_confidence, 0)
  assertEquals(r.taste_vector.length, VECTOR_DIM)
  assert(l2Norm(r.taste_vector) > 0.99, 'vektor sifira yakin olmamali')
  assert(r.taste_vector.every(Number.isFinite), 'tum bilesenler sonlu olmali')
  assertEquals(r.prior_source, 'population_mean')
})

Deno.test('0 sinyal + archetype_id dolu -> o arketipin merkezi', () => {
  const r = base({ userArchetypeId: 7 })
  assertEquals(r.prior_source, 'user_archetype:7')
  assert(l2Norm(r.taste_vector) > 0.99)
})

Deno.test('gecersiz archetype_id -> population_mean (sessiz kabul YOK)', () => {
  assertEquals(base({ userArchetypeId: 99 }).prior_source, 'population_mean')
})

// ─── watch_feedback ──────────────────────────────────────────────────────────

Deno.test('watch_feedback 0 satirken cokmez', () => {
  const { events, filmVectors } = makeEvents(20)
  const r = base({ events, filmVectors, feedback: [] })
  assertEquals(r.signal_count, 20)
  assertEquals(r.skipped.unknown_feedback_response, 0)
  assertEquals(r.skipped.zero_weight_feedback, 0)
})

Deno.test('loved/abandoned sayilir, not_watched sayilmaz ama raporlanir', () => {
  const { events, filmVectors } = makeEvents(20)
  const film = 'film-fb-1'
  filmVectors.set(film, fakeFilmVector(999))
  const feedback: WatchFeedbackRow[] = (['loved', 'not_watched', 'abandoned'] as const).map(
    (response, i) => ({
      id: `fb-${i}`,
      user_id: 'u1',
      film_id: film,
      response,
      created_at: `2026-08-02T00:0${i}:00.000Z`,
    }),
  )
  const r = base({ events, filmVectors, feedback })
  assertEquals(r.signal_count, 22)
  assertEquals(r.skipped.zero_weight_feedback, 1)
})

Deno.test('taninmayan feedback response sessizce yutulmaz', () => {
  const r = base({
    feedback: [{ id: 'x', user_id: 'u1', film_id: 'f', response: 'uydurma', created_at: 'z' }],
  })
  assertEquals(r.signal_count, 0)
  assertEquals(r.skipped.unknown_feedback_response, 1)
})

// ─── Determinizm ─────────────────────────────────────────────────────────────

Deno.test('girdi sirasi degisse de ayni vektor (determinizm)', () => {
  const { events, filmVectors } = makeEvents(20)
  const a = base({ events, filmVectors })
  const b = base({ events: [...events].reverse(), filmVectors })
  assertEquals(formatPgVector(b.taste_vector), formatPgVector(a.taste_vector))
  assertEquals(b.nearest_archetype_id, a.nearest_archetype_id)
})

// ─── outcome filtreleme ──────────────────────────────────────────────────────

Deno.test("yalnizca outcome='choice' zevk sinyali uretir", () => {
  const { events, filmVectors } = makeEvents(4)
  events[1].outcome = 'neither'
  events[1].winner = null
  events[2].outcome = 'timeout'
  events[2].winner = null
  events[3].outcome = 'seen'
  const r = base({ events, filmVectors })
  assertEquals(r.signal_count, 1)
  assertEquals(r.skipped.non_choice_outcome, 3)
})

Deno.test('profile_vector eksik film atlanir ve sayilir', () => {
  const { events, filmVectors } = makeEvents(3)
  filmVectors.delete('film-b-0001')
  const r = base({ events, filmVectors })
  assertEquals(r.signal_count, 2)
  assertEquals(r.skipped.missing_film_vector, 1)
})

// ─── low_intent turetimi ─────────────────────────────────────────────────────

Deno.test('low_intent: streak dolmadan isaretlenmez, sonra hepsi isaretlenir', () => {
  const { events } = makeEvents(20, { lowConfidence: true, sessionSize: 20 })
  // Ilk 2 olayda 3'luk pencere dolmuyor → 20 - 2 = 18
  assertEquals(deriveLowIntentEventIds(events, 3).size, 18)
})

Deno.test('low_confidence=false -> hicbir olay low_intent degil', () => {
  const { events } = makeEvents(5, { sessionSize: 5 })
  assertEquals(deriveLowIntentEventIds(events, 3).size, 0)
})

Deno.test('low_intent oturum bazlidir, oturumlar arasi tasmaz', () => {
  // 3'luk oturumlarda pencere hicbir oturumda 3 ardisik olaya ulasmaz saymaz
  const { events } = makeEvents(9, { lowConfidence: true, sessionSize: 3 })
  // Her oturumda yalnizca 3. olay isaretlenir → 3 oturum × 1 = 3
  assertEquals(deriveLowIntentEventIds(events, 3).size, 3)
})

Deno.test('carpanlar sinyal SAYISINI degistirmez, yalnizca agirligi', () => {
  const off = makeEvents(1)
  const on = makeEvents(1, { lowConfidence: true })
  assertEquals(base({ events: off.events, filmVectors: off.filmVectors }).signal_count, 1)
  assertEquals(base({ events: on.events, filmVectors: on.filmVectors }).signal_count, 1)
})

// ─── Sayisal saglamlik ───────────────────────────────────────────────────────

Deno.test('normalize NaN iceren vektoru reddeder (null doner)', () => {
  const bad = new Array<number>(VECTOR_DIM).fill(1)
  bad[5] = NaN
  assertEquals(normalize(bad), null)
})

Deno.test('normalize sifir vektoru reddeder', () => {
  assertEquals(normalize(new Array<number>(VECTOR_DIM).fill(0)), null)
})

Deno.test('tamamen dengelenen gozlem -> prior devralir, dejenere raporlanir', () => {
  // Ayni filmi hem kazandiran hem kaybettiren iki olay birbirini goturur.
  const v1 = fakeFilmVector(1)
  const v2 = fakeFilmVector(2)
  const filmVectors = new Map([['A', v1], ['B', v2]])
  const mk = (id: string, winner: string, minute: number): ChoiceEventRow => ({
    id, user_id: 'u1', session_id: 's', round: 1,
    film_a: 'A', film_b: 'B', winner, outcome: 'choice', low_confidence: false,
    created_at: new Date(Date.UTC(2026, 7, 1, 0, minute)).toISOString(),
  })
  const r = base({ events: [mk('e1', 'A', 0), mk('e2', 'B', 1)], filmVectors })
  assertEquals(r.signal_count, 2)
  assertEquals(r.observation_degenerate, true)
  assertEquals(r.user_confidence, 0, 'gozlem kullanilamazsa w 0 olmali')
  assert(l2Norm(r.taste_vector) > 0.99, 'prior devralmali, bos donmemeli')
})

// ─── pgvector serilestirme ───────────────────────────────────────────────────

Deno.test('pgvector gidis-donus ve bozuk girdi reddi', () => {
  assertEquals(parsePgVector(formatPgVector(fakeFilmVector(42)))?.length, VECTOR_DIM)
  assertEquals(parsePgVector('[1,2,3]'), null, 'yanlis boyut')
  assertEquals(parsePgVector('{bozuk'), null, 'bozuk JSON')
  assertEquals(parsePgVector(JSON.stringify(new Array(VECTOR_DIM).fill('x'))), null, 'sayi degil')
  assertEquals(parsePgVector(null), null)
})

// ─── Config dogrulamasi ──────────────────────────────────────────────────────

Deno.test('gecerli config kabul edilir', () => {
  assertEquals(validateTasteVectorConfig(CONFIG).full_confidence_signals, 50)
})

Deno.test('eksik/bozuk config SESSIZCE gecmez, throw eder', () => {
  const cases: [string, unknown][] = [
    ['nesne degil', 'merhaba'],
    ['round_weights eksik', { ...CONFIG, round_weights: undefined }],
    ['round_weights kismi', { ...CONFIG, round_weights: { '1': 1, '2': 0.9 } }],
    ['low_intent_streak eksik', { ...CONFIG, low_intent_streak: undefined }],
    ['low_intent_streak 0', { ...CONFIG, low_intent_streak: 0 }],
    ['full_confidence_signals 0', { ...CONFIG, full_confidence_signals: 0 }],
    ['feedback_weights eksik anahtar', { ...CONFIG, feedback_weights: { loved: 3 } }],
    ['carpan sayi degil', { ...CONFIG, low_confidence_multiplier: 'yuksek' }],
  ]
  for (const [label, cfg] of cases) {
    assertThrows(() => validateTasteVectorConfig(cfg), 'taste_vector_config', label)
  }
})
