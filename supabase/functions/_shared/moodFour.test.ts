/**
 * mood-four: istek doğrulaması + RPC argümanları + aday ortak parçaları (rerankPick).
 * Run: npm run test:mood-four
 */
import { assert, assertEquals, assertMatch, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { buildRpcArgs, MAX_ATTEMPTS, parseMoodFourRequest, uniqueRows } from './moodFour.ts'
import {
  buildFilmList,
  buildPickUserMessage,
  cleanExcludedGenres,
  numbersToIds,
  parseModelArray,
  PICK_SYSTEM_PROMPT,
} from './rerankPick.ts'

const read = (p: string) => Deno.readTextFileSync(new URL(p, import.meta.url)).replaceAll('\r\n', '\n')

const VEC = `[${Array.from({ length: 16 }, (_, i) => (i / 10).toFixed(2)).join(',')}]`
const attempt = { min_similarity: 0.5, min_rating: 6.5, genres_include: ['Drama'], max_runtime: 120 }
const valid = {
  mood_text: 'rainy night',
  query_vector: VEC,
  exclude_ids: ['a', 'b'],
  search_keywords: ['rain'],
  genres_exclude: ['Horror'],
  reference_titles: [{ title: 'Paterson', year: 2016 }],
  suggested_titles: [],
  attempts: [attempt],
  match_count: 40,
  rerank_candidates: 20,
}

Deno.test('gecerli istek kabul edilir; alanlar sinirlanir', () => {
  const r = parseMoodFourRequest({ ...valid, mood_text: 'x'.repeat(900) })
  assert(r.ok)
  if (r.ok) {
    assertEquals(r.value.mood_text.length, 500)
    assertEquals(r.value.attempts, [attempt])
    assertEquals(r.value.match_count, 40)
  }
})

Deno.test('gecersiz govde reddedilir (sessiz duzeltme yok)', () => {
  const bad = (patch: Record<string, unknown>) => parseMoodFourRequest({ ...valid, ...patch })
  assertEquals(parseMoodFourRequest(null).ok, false)
  assertEquals(bad({ mood_text: '   ' }).ok, false)
  assertEquals(bad({ query_vector: 'drop table' }).ok, false)
  assertEquals(bad({ query_vector: '[1,2]' }).ok, false)
  assertEquals(bad({ attempts: [] }).ok, false)
  assertEquals(bad({ attempts: Array.from({ length: MAX_ATTEMPTS + 1 }, () => attempt) }).ok, false)
  assertEquals(bad({ attempts: [{ min_similarity: 'x' }] }).ok, false)
  assertEquals(bad({ attempts: [{ min_similarity: 0.5, max_runtime: 'x' }] }).ok, false)
})

Deno.test('RPC argumanlari istemcideki matchV4 ile ayni sabitleri tasir', () => {
  const r = parseMoodFourRequest(valid)
  assert(r.ok)
  if (!r.ok) return
  const args = buildRpcArgs(r.value, r.value.attempts[0])
  assertEquals(args.user_vector, null)
  assertEquals(args.mood_weight, 1.0)
  assertEquals(args.user_weight, 0.0)
  assertEquals(args.per_director_cap, 1)
  assertEquals(args.tier_boost, true)
  assertEquals(args.exclude_archive, true)
  assertEquals(args.min_rating, 6.5)
  assertEquals(args.genres_include, ['Drama'])
  assertEquals(args.genres_exclude, ['Horror'])
  assertEquals(args.max_runtime, 120)
  assertEquals(args.exclude_ids, ['a', 'b'])
  // bos kume / null alanlar gonderilmez (istemci ile ayni)
  const bare = buildRpcArgs(
    { ...r.value, exclude_ids: [], search_keywords: [] },
    { min_similarity: 0.4, min_rating: null, genres_include: [], max_runtime: null },
  )
  assert(!('exclude_ids' in bare) && !('search_keywords' in bare) && !('min_rating' in bare))
})

Deno.test('uniqueRows ilk gorulen kalir', () => {
  assertEquals(uniqueRows([{ id: 'a', n: 1 }, { id: 'b', n: 2 }, { id: 'a', n: 3 }]), [{ id: 'a', n: 1 }, { id: 'b', n: 2 }])
})

Deno.test('rerankPick: aday satiri, kisit satiri ve numara->id cevirisi', () => {
  const pool = [
    { id: 'u1', title: 'Paterson', overview: 'A bus driver writes poems.', genres: ['Drama'], year: 2016, runtime: 118.4 },
    { id: 'u2', title: 'Heat', overview: null, genres: null, year: null },
  ]
  assertEquals(
    buildFilmList(pool, 10),
    '1. "Paterson" (2016) | 118 min | Drama | A bus driv\n2. "Heat" (?) |  | ',
  )
  const msg = buildPickUserMessage({ moodText: 'calm', pool, count: 4, overviewMax: 150, excludedGenres: ['Horror'] })
  assertStringIncludes(msg, 'Excluded genres (never select a film with any of these): Horror')
  assertStringIncludes(msg, 'Select the 4 most relevant films')
  assert(!buildPickUserMessage({ moodText: 'calm', pool, count: 4, overviewMax: 150, excludedGenres: [] }).includes('Excluded genres'))
  assertEquals(numbersToIds([2, '1', 2, 9, 0, 'x', 1.5], pool, 4), ['u2', 'u1'])
  assertEquals(parseModelArray('```json\n[2, 1]\n```'), [2, 1])
  assertEquals(cleanExcludedGenres(['  Horror ', '', 5, 'x'.repeat(60)]).map((g) => g.length), [6, 40])
})

Deno.test('rerank-films ve mood-four ayni prompt kaynagini kullanir; reason yolu degismez', () => {
  const rerank = read('../rerank-films/index.ts')
  assertMatch(rerank, /import \{ PICK_SYSTEM_PROMPT \} from '\.\.\/_shared\/rerankPick\.ts'/)
  assertMatch(rerank, /const SYSTEM_PROMPT = PICK_SYSTEM_PROMPT/)
  assert(!rerank.includes('You are a film recommendation re-ranker. Given a user'), 'rerank-films kendi prompt kopyasini tasimamali')
  assertStringIncludes(PICK_SYSTEM_PROMPT, 'If an "Excluded genres" line is given')
  const four = read('../mood-four/index.ts')
  assertMatch(four, /PICK_SYSTEM_PROMPT/)
  assertMatch(four, /RERANK_PICK_MODEL/)
  assertMatch(four, /dailyCounterKey\(false\)/) // id-rerank sayaci ile ayni
  assertMatch(four, /requireUser\(req\)/)
  assertMatch(four, /checkRateLimit\(auth\.authUserId, FN\)/)
})

Deno.test('mood-four rate limit tablosunda tanimli', () => {
  assertMatch(read('./rateLimit.ts'), /'mood-four':\s*\{ maxRequests: 10/)
})
