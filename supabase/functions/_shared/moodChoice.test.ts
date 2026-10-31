/**
 * submit-mood-choice saf mantık testleri.
 * Çalıştırma: npm run test:mood-choice
 */
import {
  buildRecordChoiceArgs,
  isSearchRecent,
  MOOD_SEARCH_MAX_AGE_MS,
  parseMoodChoiceRequest,
} from './moodChoice.ts'

function assert(cond: boolean, msg = 'assertion basarisiz'): void {
  if (!cond) throw new Error(msg)
}
function assertEquals<T>(a: T, e: T, msg = ''): void {
  if (JSON.stringify(a) !== JSON.stringify(e)) {
    throw new Error(`${msg}\n  beklenen: ${JSON.stringify(e)}\n  gelen:    ${JSON.stringify(a)}`)
  }
}

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const valid = {
  mood_search_id: U(1),
  set_id: U(2),
  round: 1,
  film_a: U(3),
  film_b: U(4),
  winner: U(3),
  outcome: 'choice',
}

Deno.test('gecerli secim kabul edilir; set_index yoksa 0', () => {
  const r = parseMoodChoiceRequest(valid)
  assert(r.ok)
  if (r.ok) {
    assertEquals(r.value.set_index, 0)
    assertEquals(r.value.winner, U(3))
  }
})

Deno.test("'neither' winner null ile kabul; winner doluysa red", () => {
  assert(parseMoodChoiceRequest({ ...valid, outcome: 'neither', winner: null }).ok)
  assert(parseMoodChoiceRequest({ ...valid, outcome: 'neither', winner: undefined }).ok)
  assert(!parseMoodChoiceRequest({ ...valid, outcome: 'neither', winner: U(3) }).ok)
})

Deno.test("'choice' winner film_a/film_b disindaysa veya null ise red", () => {
  assert(!parseMoodChoiceRequest({ ...valid, winner: U(9) }).ok)
  assert(!parseMoodChoiceRequest({ ...valid, winner: null }).ok)
  assert(parseMoodChoiceRequest({ ...valid, winner: U(4) }).ok)
})

Deno.test('round, outcome, uuid, ayni film, set_index dogrulamasi', () => {
  for (const bad of [
    { ...valid, round: 0 },
    { ...valid, round: 4 },
    { ...valid, round: '1' },
    { ...valid, outcome: 'timeout' },
    { ...valid, outcome: 'seen' },
    { ...valid, set_id: 'x' },
    { ...valid, mood_search_id: undefined },
    { ...valid, film_b: U(3) },
    { ...valid, set_index: -1 },
    { ...valid, set_index: 1.5 },
    { ...valid, set_index: 51 },
    null,
    'metin',
  ]) {
    assert(!parseMoodChoiceRequest(bad).ok, JSON.stringify(bad))
  }
  assert(parseMoodChoiceRequest({ ...valid, set_index: 50 }).ok)
})

Deno.test('24 saat penceresi: sinir dahil, gelecek/gecersiz/eksik tarih fail-closed', () => {
  const now = Date.UTC(2026, 9, 31, 12, 0, 0)
  assert(isSearchRecent(new Date(now - 1000).toISOString(), now))
  assert(isSearchRecent(new Date(now - MOOD_SEARCH_MAX_AGE_MS).toISOString(), now))
  assert(!isSearchRecent(new Date(now - MOOD_SEARCH_MAX_AGE_MS - 1).toISOString(), now))
  assert(!isSearchRecent(new Date(now + 60_000).toISOString(), now))
  assert(!isSearchRecent('bozuk', now))
  assert(!isSearchRecent(null, now))
  assert(!isSearchRecent(undefined, now))
})

Deno.test("RPC argumanlari: gauntlet_id=set_id, source='mood', sampiyon yazilmaz, taraf dogru", () => {
  const r = parseMoodChoiceRequest({ ...valid, set_index: 2, winner: U(4) })
  assert(r.ok)
  if (!r.ok) return
  const a = buildRecordChoiceArgs('user-1', r.value)
  assertEquals(a.p_gauntlet_id, U(2))
  assertEquals(a.p_set_champion, false)
  assertEquals(a.p_position_of_winner, 'right')
  assertEquals(a.p_context, { source: 'mood', mood_search_id: U(1), set_index: 2 })
  assertEquals(a.p_algorithm_version, 'mood-gauntlet-v1')
  const left = parseMoodChoiceRequest(valid)
  if (left.ok) assertEquals(buildRecordChoiceArgs('u', left.value).p_position_of_winner, 'left')
  const n = parseMoodChoiceRequest({ ...valid, outcome: 'neither', winner: null })
  if (n.ok) {
    const na = buildRecordChoiceArgs('u', n.value)
    assertEquals(na.p_position_of_winner, null)
    assertEquals(na.p_winner, null)
  }
})

// ─── Kaynak sözleşmesi: günlük yola dokunulmaz, kimlik/limit/sentry zinciri var ───
const read = (p: string) => Deno.readTextFileSync(new URL(p, import.meta.url)).replaceAll('\r\n', '\n')

Deno.test('submit-mood-choice: requireUser + rate limit + sahiplik + 24s + Sentry; submit-choice import edilmez', () => {
  const src = read('../submit-mood-choice/index.ts')
  assert(/requireUser\(req\)/.test(src))
  assert(/checkRateLimit\(auth\.authUserId, FN\)/.test(src))
  assert(/search\.data\.user_id !== appUserId/.test(src))
  assert(/isSearchRecent\(/.test(src))
  assert(/record_choice_event/.test(src))
  assert(/sentryCapture\(/.test(src))
  assert(/idempotent: true/.test(src))
  assert(!/submit-choice|generate-gauntlet|daily_gauntlets/.test(src.replace(/\/\*[\s\S]*?\*\//, '')))
  assert(/'submit-mood-choice': \{ maxRequests: 30, windowMs: 60_000 \}/.test(read('./rateLimit.ts')))
})

Deno.test('recompute-taste-vector: context secilir ve mood hariclenir (iki sorgu)', () => {
  const src = read('../recompute-taste-vector/index.ts')
  assertEquals(src.split('low_confidence, created_at, context').length - 1, 2)
})
