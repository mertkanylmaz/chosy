/**
 * Film olguları (Faz 2-3): çipler (tempo · yoğunluk · süre) ve "Why this fits you" deseni.
 * Saf fonksiyonlar — LLM yok, ağ yok.
 * Run: npm run test:mood-gauntlet
 */
import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  buildChips,
  detectPickPattern,
  ENERGY_DELTA,
  energyBand,
  formatRuntime,
  parseDims,
  roundPicks,
  roundVote,
  runtimeVote,
  type FilmDims,
} from '../../utils/moodFilmFacts.ts'
import { choose, initFlow } from '../../utils/moodGauntletFlow.ts'

const d = (pace: FilmDims['pace'], energy: number | null): FilmDims => ({ pace, energy })

Deno.test('parseDims: iki sema (pace_preference | pace), gecersiz deger null — uydurma yok', () => {
  assertEquals(parseDims({ pace_preference: 'slow', energy_level: 0.3 }), { pace: 'slow', energy: 0.3 })
  assertEquals(parseDims({ pace: 'fast', energy_level: 0.9 }), { pace: 'fast', energy: 0.9 })
  assertEquals(parseDims({ pace_preference: 'medium', pace: 'fast' }).pace, 'medium')
  assertEquals(parseDims({ pace: 'warp', energy_level: 2 }), { pace: null, energy: null })
  assertEquals(parseDims({ energy_level: '0.5' }), { pace: null, energy: null })
  assertEquals(parseDims(null), { pace: null, energy: null })
})

Deno.test('yogunluk bantlari ve sure bicimi', () => {
  assertEquals(energyBand(0.2), 'gentle')
  assertEquals(energyBand(0.44), 'gentle')
  assertEquals(energyBand(0.45), 'moderate')
  assertEquals(energyBand(0.69), 'moderate')
  assertEquals(energyBand(0.7), 'intense')
  assertEquals(formatRuntime(101), '1h 41m')
  assertEquals(formatRuntime(120), '2h')
  assertEquals(formatRuntime(45), '45m')
  assertEquals(formatRuntime(100.4), '1h 40m')
  assertEquals(formatRuntime(0), null)
  assertEquals(formatRuntime(null), null)
  assertEquals(formatRuntime(undefined), null)
})

Deno.test('cipler: eksik alan cizilmez (dims yoksa yalniz sure)', () => {
  assertEquals(buildChips(d('slow', 0.3), 101), { pace: 'slow', energy: 'gentle', runtime: '1h 41m' })
  assertEquals(buildChips(undefined, 90), { pace: null, energy: null, runtime: '1h 30m' })
  assertEquals(buildChips(d(null, null), null), { pace: null, energy: null, runtime: null })
})

Deno.test('tur oyu: kazanan belirgin sakin → +1, hareketli → -1, esik alti / celiski → 0', () => {
  assertEquals(roundVote(d('slow', 0.3), d('fast', 0.8)), 1)
  assertEquals(roundVote(d('fast', 0.9), d('slow', 0.4)), -1)
  // yalniz enerji farki (tempo ayni)
  assertEquals(roundVote(d('medium', 0.4), d('medium', 0.4 + ENERGY_DELTA)), 1)
  assertEquals(roundVote(d('medium', 0.4), d('medium', 0.4 + ENERGY_DELTA - 0.01)), 0)
  // yalniz tempo farki (enerji bilinmiyor)
  assertEquals(roundVote(d('slow', null), d('medium', null)), 1)
  // celiski: daha yavas ama daha yuksek enerji
  assertEquals(roundVote(d('slow', 0.9), d('fast', 0.3)), 0)
  // eksik veri
  assertEquals(roundVote(undefined, d('slow', 0.3)), 0)
  assertEquals(roundVote(d(null, null), d(null, null)), 0)
})

// Dortlu [a, b, c, d]: tur1 a↔b, tur2 c↔d, final w1↔w2
const dims = {
  a: d('slow', 0.3), b: d('fast', 0.8),
  c: d('slow', 0.35), d: d('fast', 0.85),
}

Deno.test('roundPicks: kazanan / kaybeden ciftleri turlara dogru eslenir', () => {
  let f = initFlow(['a', 'b', 'c', 'd'])
  f = choose(f, 'b') // tur1
  f = choose(f, 'c') // tur2
  f = choose(f, 'c') // final: b↔c
  assertEquals(roundPicks(f), [
    { winner: 'b', loser: 'a' },
    { winner: 'c', loser: 'd' },
    { winner: 'c', loser: 'b' },
  ])
  assertEquals(roundPicks(initFlow(['a', 'b', 'c', 'd'])), [])
})

Deno.test('desen: uc turda da sakin → calmer_all; ikisinde (3. belirsiz) → calmer_two', () => {
  let f = initFlow(['a', 'b', 'c', 'd'])
  f = choose(f, 'a')
  f = choose(f, 'c')
  f = choose(f, 'a') // final a↔c: ikisi de sakin; fark yok → 0
  assertEquals(detectPickPattern(roundPicks(f), dims), 'calmer_two')

  const wide = { ...dims, c: d('slow', 0.2), a: d('medium', 0.5) }
  // final: c (0.2 slow) kazanir a (0.5 medium) karsisinda → sakin; 3 tur da sakin
  let g = initFlow(['a', 'b', 'c', 'd'])
  g = choose(g, 'a')
  g = choose(g, 'c')
  g = choose(g, 'c')
  assertEquals(detectPickPattern(roundPicks(g), wide), 'calmer_all')
})

Deno.test('desen: yogun taraf → intense_*; karisik / yetersiz veri → null (satir yok)', () => {
  let f = initFlow(['a', 'b', 'c', 'd'])
  f = choose(f, 'b')
  f = choose(f, 'd')
  f = choose(f, 'b') // b(fast .8) vs d(fast .85): fark esik alti → 0
  assertEquals(detectPickPattern(roundPicks(f), dims), 'intense_two')

  // karisik: tur1 sakin, tur2 hareketli → null
  let m = initFlow(['a', 'b', 'c', 'd'])
  m = choose(m, 'a')
  m = choose(m, 'd')
  m = choose(m, 'a')
  assertEquals(detectPickPattern(roundPicks(m), dims), null)

  // veri yok → null
  assertEquals(detectPickPattern(roundPicks(f), {}), null)
  // tek tur → null (esik: en az 2 tur)
  assertEquals(detectPickPattern([{ winner: 'a', loser: 'b' }], dims), null)
  assert(detectPickPattern([], dims) === null)
})

Deno.test('sure oyu: kazanan belirgin kisa → +1, uzun → -1, esik alti / veri yok → 0', () => {
  assertEquals(runtimeVote(90, 105), 1)
  assertEquals(runtimeVote(90, 104), 0)
  assertEquals(runtimeVote(120, 100), -1)
  assertEquals(runtimeVote(null, 100), 0)
  assertEquals(runtimeVote(0, 100), 0)
  assertEquals(runtimeVote(90, undefined), 0)
})

Deno.test('desen: daha kisa — 3/3 → shorter_all, 2/3 karsit yok → shorter_two, karsit tur varsa null', () => {
  const flat = {} // mood boyutu nötr
  let f = initFlow(['a', 'b', 'c', 'd'])
  f = choose(f, 'a')
  f = choose(f, 'c')
  f = choose(f, 'a')
  const picks = roundPicks(f) // a>b, c>d, a>c
  assertEquals(detectPickPattern(picks, flat, { a: 80, b: 120, c: 100, d: 130 }), 'shorter_all')
  // son tur belirsiz (a 80 vs c 90): 2 tur kisa, karsit yok
  assertEquals(detectPickPattern(picks, flat, { a: 80, b: 120, c: 90, d: 130 }), 'shorter_two')
  // son tur uzunu secti (a 120 vs c 90) → karsit tur → null
  assertEquals(detectPickPattern(picks, flat, { a: 120, b: 150, c: 90, d: 130 }), null)
  // sure bilgisi yok → null
  assertEquals(detectPickPattern(picks, flat), null)
})

Deno.test('desen: birden cok aday — all, two\'dan guclu; esitlikte sakin > yogun > kisa', () => {
  let f = initFlow(['a', 'b', 'c', 'd'])
  f = choose(f, 'a')
  f = choose(f, 'c')
  f = choose(f, 'c')
  const picks = roundPicks(f) // a>b, c>d, c>a
  const calmDims = {
    a: d('medium', 0.5), b: d('fast', 0.9), c: d('slow', 0.2), d: d('fast', 0.8),
  }
  // sakin: 3/3 (all). kisa: yalniz 2 tur (two) → sakin kazanir
  assertEquals(detectPickPattern(picks, calmDims, { a: 100, b: 130, c: 95, d: 130 }), 'calmer_all')
  // sakin 2 tur (two), kisa 3/3 (all) → daha guclu olan kisa
  const calmTwo = { ...calmDims, c: d('medium', 0.5) } // final c vs a esit → sakin 2/3
  assertEquals(detectPickPattern(picks, calmTwo, { a: 100, b: 130, c: 60, d: 130 }), 'shorter_all')
  // ikisi de two → sakin
  assertEquals(detectPickPattern(picks, calmTwo, { a: 100, b: 130, c: 95, d: 130 }), 'calmer_two')
})

Deno.test('Faz 2-8: goreli icgoru mutlak cipla celisirse gizlenir (Fallout: slow + intense)', async () => {
  const { insightContradictsChips, visibleInsight } = await import('../../utils/moodFilmFacts.ts')
  // Mission: Impossible - Fallout: pace 'slow', energy 0.76 → 'intense'
  const fallout = { pace: 'slow' as const, energy: 0.76 }
  assertEquals(insightContradictsChips('calmer_all', fallout), true) // "quieter" ↔ Intense
  assertEquals(insightContradictsChips('calmer_two', fallout), true)
  assertEquals(insightContradictsChips('intense_all', fallout), true) // "more intense" ↔ Slow pace
  assertEquals(visibleInsight('calmer_all', fallout), null)
  // tutarli film: sakin + yavas → calmer kalir; yogun + hizli → intense kalir
  assertEquals(visibleInsight('calmer_two', { pace: 'slow', energy: 0.3 }), 'calmer_two')
  assertEquals(visibleInsight('intense_all', { pace: 'fast', energy: 0.85 }), 'intense_all')
  // calmer ↔ fast tempo (enerji bilinmese de)
  assertEquals(insightContradictsChips('calmer_all', { pace: 'fast', energy: null }), true)
  // sure ekseni etkilenmez; veri yoksa / bilinmiyorsa kanitlanamaz → icgoru kalir
  assertEquals(visibleInsight('shorter_all', fallout), 'shorter_all')
  assertEquals(visibleInsight('calmer_all', undefined), 'calmer_all')
  assertEquals(visibleInsight('calmer_all', { pace: null, energy: null }), 'calmer_all')
  assertEquals(visibleInsight(null, fallout), null)
})
