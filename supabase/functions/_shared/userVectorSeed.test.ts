/**
 * userVectorSeed saf mantik testleri (R-A-0b)
 *
 * Calistirma:  npm run test:seed
 *              (supabase/functions icinden: deno test --allow-read _shared/userVectorSeed.test.ts)
 *
 * DB'ye DOKUNMAZ. Sozlesme: kayitli `preferences_vector` kullanilamiyorsa
 * `population_mean` tohumu doner — `{status:'skipped'}` YOK — ve dusme sebebi
 * `fallbackReason` ile RAPORLANIR (sessiz kabul yok).
 */

import {
  type BaseFallbackReason,
  resolveBaseVector,
} from './userVectorSeed.ts'
import { archetypeCentroids, populationMeanCentroid } from './tasteVector.ts'
import { VECTOR_DIM } from '../../../services/vectorEncoder.ts'

// ─── Assertion yardimcilari ──────────────────────────────────────────────────
// tasteVector.test.ts ile ayni gerekce: dis bagimlilik YOK, ag erisimi yok.

function assert(cond: boolean, msg = 'assertion basarisiz'): void {
  if (!cond) throw new Error(msg)
}

function assertEquals<T>(actual: T, expected: T, msg = ''): void {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${msg}\n  beklenen: ${e}\n  gelen:    ${a}`)
}

/** Gecerli bir kayitli vektor — bilesenler sabit, determinizm icin. */
function validStored(): number[] {
  return new Array(VECTOR_DIM).fill(0).map((_, i) => ((i % 7) + 1) / 10)
}

// ─── Ana sozlesme: NULL -> population_mean, skipped DEGIL ────────────────────

Deno.test('NULL preferences_vector -> population_mean (skipped DEGIL)', () => {
  const r = resolveBaseVector(null)
  assertEquals(r.source, 'population_mean')
  assertEquals(r.fallbackReason, 'stored_missing' as BaseFallbackReason)
  assertEquals(r.vector.length, VECTOR_DIM)
  assert(r.vector.every(Number.isFinite), 'tum bilesenler sonlu olmali')
})

Deno.test('undefined preferences_vector -> population_mean', () => {
  const r = resolveBaseVector(undefined)
  assertEquals(r.source, 'population_mean')
  assertEquals(r.fallbackReason, 'stored_missing' as BaseFallbackReason)
})

Deno.test('population_mean tohumu sifir vektor DEGIL', () => {
  const r = resolveBaseVector(null)
  let sq = 0
  for (const x of r.vector) sq += x * x
  assert(Math.sqrt(sq) > 1e-6, 'tohumun normu olculebilir olmali')
})

// ─── Tek kaynak: merkez hesabi kopyalanmadi ──────────────────────────────────

Deno.test('tohum, tasteVector.populationMeanCentroid ile BIREBIR ayni', () => {
  // Iki ayri centroid mantigi olmadiginin kaniti: ayni cagri, ayni sonuc.
  const expected = populationMeanCentroid(archetypeCentroids())
  assertEquals(resolveBaseVector(null).vector, expected)
})

Deno.test('determinizm — ardisik iki cagri ayni vektoru verir', () => {
  assertEquals(resolveBaseVector(null).vector, resolveBaseVector(null).vector)
})

// ─── Gecerli kayitli vektor korunur ──────────────────────────────────────────

Deno.test('gecerli dizi -> calibration, fallbackReason null', () => {
  const stored = validStored()
  const r = resolveBaseVector(stored)
  assertEquals(r.source, 'calibration')
  assertEquals(r.fallbackReason, null)
  assertEquals(r.vector, stored)
})

Deno.test('gecerli pgvector metni -> calibration', () => {
  const stored = validStored()
  const r = resolveBaseVector(JSON.stringify(stored))
  assertEquals(r.source, 'calibration')
  assertEquals(r.vector, stored)
})

// ─── Bozuk kayit -> population_mean, ama SEBEBI raporlanir ───────────────────
// tasteVector.test.ts'teki "gecersiz archetype_id -> population_mean
// (sessiz kabul YOK)" senaryosunun bu moduldeki esdegeri.

Deno.test('bozuk JSON -> population_mean (sessiz kabul YOK)', () => {
  const r = resolveBaseVector('[0.1, 0.2')
  assertEquals(r.source, 'population_mean')
  assertEquals(r.fallbackReason, 'stored_malformed' as BaseFallbackReason)
})

Deno.test('yanlis boyut -> population_mean + stored_wrong_dim', () => {
  const r = resolveBaseVector([0.1, 0.2, 0.3])
  assertEquals(r.source, 'population_mean')
  assertEquals(r.fallbackReason, 'stored_wrong_dim' as BaseFallbackReason)
})

Deno.test('NaN iceren vektor -> population_mean + stored_non_finite', () => {
  const bad = validStored()
  bad[42] = NaN
  const r = resolveBaseVector(bad)
  assertEquals(r.source, 'population_mean')
  assertEquals(r.fallbackReason, 'stored_non_finite' as BaseFallbackReason)
})

Deno.test('Infinity iceren vektor -> stored_non_finite', () => {
  const bad = validStored()
  bad[0] = Infinity
  assertEquals(resolveBaseVector(bad).fallbackReason, 'stored_non_finite' as BaseFallbackReason)
})

Deno.test('JSON objesi (dizi degil) -> stored_malformed', () => {
  const r = resolveBaseVector('{"a":1}')
  assertEquals(r.source, 'population_mean')
  assertEquals(r.fallbackReason, 'stored_malformed' as BaseFallbackReason)
})
