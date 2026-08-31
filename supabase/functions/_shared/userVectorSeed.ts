/**
 * userVectorSeed — `users.preferences_vector` icin taban (prior) cozumu.
 *
 * Bu modulde I/O YOKTUR: Supabase, Deno.env, tarih, rastgelelik yok.
 * Ayni girdi → ayni cikti (tasteVector.ts ile ayni disiplin).
 *
 * ── Neden ayri dosya ─────────────────────────────────────────────────────────
 * `recompute-user-vector/index.ts` `serve()` icerdigi icin import EDILEMEZ —
 * import aninda ikinci bir sunucu kurardi (gauntletCore.ts'in ayrilma
 * gerekcesiyle ayni). Taban cozumunu test edebilmek icin saf kisim buraya
 * alindi.
 *
 * ── Neden tasteVector.ts'e konmadi ───────────────────────────────────────────
 * PRODUCT_OS §5.1 eksen ayrimi: `tasteVector.ts` cinema_dna'nin ZEVK eksenini
 * hesaplar. `preferences_vector` ise mood-search/feed hattinin eski kolonudur.
 * Iki hat ayri kalir — ama arketip merkezleri TEK kaynaktan gelir:
 * `archetypeCentroids()` / `populationMeanCentroid()` buradan CAGIRILIR,
 * kopyalanmaz. Ikinci bir merkez hesabi yoktur.
 */

import { archetypeCentroids, populationMeanCentroid } from './tasteVector.ts'
import { VECTOR_DIM } from '../../../services/vectorEncoder.ts'

// ─── Tipler ──────────────────────────────────────────────────────────────────

/**
 * Kullanicinin sonunda sahip oldugu vektoru NE belirledi.
 *
 * - `calibration`     — kayitli `preferences_vector` tek basina gecerli
 * - `population_mean` — kayitli vektor yok/bozuk, 12 arketip merkezinin
 *                       ortalamasi tohum olarak kullanildi
 * - `signals`         — `user_taste_signals` katkisi harmanlandi
 */
export type PriorSource = 'calibration' | 'population_mean' | 'signals'

/** Taban vektorun kaynagi — harmanlama oncesi. `signals` burada olusamaz. */
export type BaseVectorSource = Exclude<PriorSource, 'signals'>

/**
 * `population_mean`'e dusme sebebi. `null` = kayitli vektor kullanildi.
 *
 * `stored_missing` beklenen bir durumdur (quiz'siz yeni kullanici, R-12/K-11).
 * Digerleri VERI ANOMALISIDIR: cagiran taraf bunlari Sentry'ye yansitir —
 * population_mean'e dusmek sessiz kabul degildir.
 */
export type BaseFallbackReason =
  | 'stored_missing'
  | 'stored_malformed'
  | 'stored_wrong_dim'
  | 'stored_non_finite'

export interface BaseVectorResult {
  vector: number[]
  source: BaseVectorSource
  fallbackReason: BaseFallbackReason | null
}

// ─── Cozum ───────────────────────────────────────────────────────────────────

/** pgvector metni ya da dizi → sayi dizisi. Cozulemezse null. */
function parseStored(raw: number[] | string | null | undefined): number[] | null {
  if (raw === null || raw === undefined) return null
  if (Array.isArray(raw)) return raw
  if (typeof raw !== 'string') return null
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * Harmanlamanin tabanini cozer.
 *
 * Kayitli vektor GECERLI ise o kullanilir. Degilse 12 arketip merkezinin
 * ortalamasi doner — bu, `tasteVector.computeTasteVector`'un 0 sinyal +
 * arketipsiz durumda yaptiginin AYNISIDIR ve ayni `populationMeanCentroid`
 * cagrisiyla uretilir.
 *
 * @throws 12 merkezin ortalamasi dejenere cikarsa — bu bir kod hatasidir,
 *         sessizce gecilmez (tasteVector.ts'teki "prior vektoru sifir"
 *         throw'u ile ayni tavir).
 */
export function resolveBaseVector(
  raw: number[] | string | null | undefined,
): BaseVectorResult {
  const parsed = parseStored(raw)

  let reason: BaseFallbackReason | null = null
  if (parsed === null) {
    reason = raw === null || raw === undefined ? 'stored_missing' : 'stored_malformed'
  } else if (parsed.length !== VECTOR_DIM) {
    reason = 'stored_wrong_dim'
  } else if (!parsed.every((x) => typeof x === 'number' && Number.isFinite(x))) {
    reason = 'stored_non_finite'
  }

  if (reason === null) {
    return { vector: parsed as number[], source: 'calibration', fallbackReason: null }
  }

  const mean = populationMeanCentroid(archetypeCentroids())
  let sq = 0
  for (const x of mean) sq += x * x
  const norm = Math.sqrt(sq)
  if (!Number.isFinite(norm) || norm < 1e-9) {
    throw new Error(`resolveBaseVector: population_mean dejenere (norm=${norm})`)
  }

  return { vector: mean, source: 'population_mean', fallbackReason: reason }
}
