/**
 * tasteVector — ZEVK ekseni saf matematigi (B.5)
 *
 * Bu modulde I/O YOKTUR. Supabase, Deno.env, tarih uretimi, rastgelelik yok.
 * Ayni girdi → ayni cikti. `--full` iki kez ardisik calistiginda ayni sonucu
 * uretmesinin garantisi buradadir.
 *
 * Ayrim (PRODUCT_OS §5.1): bu dosya ZEVK eksenini hesaplar. BILGI ekseni
 * (knowledge/deduction/auteur_sense/instinct) `_shared/dnaCalc.ts` ve
 * `recompute-cinema-dna` tarafindadir; iki eksen birbirine karismaz.
 */

import { getArchetypeProfile } from '../../../services/archetypeEngine.ts'
import { tasteProfileToVector, VECTOR_DIM } from '../../../services/vectorEncoder.ts'

// ─── Sabitler ────────────────────────────────────────────────────────────────

/** 12 sinefil arketipi — constants/archetypes.ts ile ayni kimlik uzayi. */
export const ARCHETYPE_IDS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

/**
 * L2 normu bu esigin altindaki gozlem "yon bilgisi tasimyor" sayilir.
 * Sessiz fallback DEGIL: cagiran taraf bu durumu raporlar ve Sentry'ye yazar.
 */
export const DEGENERATE_NORM_EPSILON = 1e-9

// ─── Tipler ──────────────────────────────────────────────────────────────────

export interface TasteVectorConfig {
  /** Anahtar = choice_events.round ('1' | '2' | '3'). */
  round_weights: Record<string, number>
  low_confidence_multiplier: number
  low_intent_multiplier: number
  low_intent_streak: number
  /** Anahtar = watch_feedback.response. */
  feedback_weights: Record<string, number>
  full_confidence_signals: number
}

/**
 * app_config'ten gelen konfigurasyonu DOGRULAR.
 *
 * `getAppConfig` yalnizca `as T` cast'i yapar, runtime denetimi yoktur. Eksik
 * ya da bozuk anahtar hata vermez, SESSIZCE YANLIS SONUC uretir — CLAUDE.md
 * kural 1'in tarif ettigi sinif. Somut ornekler:
 *   low_intent_streak eksik → `i + 1 < undefined` false, ic dongu NaN ile hic
 *     donmez, `all` true kalir → HER olay low_intent isaretlenir
 *   full_confidence_signals = 0 → signalCount/0 = Infinity → w = 1, shrinkage
 *     tamamen devre disi kalir ve CHECK kisiti bunu gecirir
 *
 * Bu yuzden eksik/gecersiz her alan ACIKCA throw eder.
 */
export function validateTasteVectorConfig(cfg: unknown): TasteVectorConfig {
  const problems: string[] = []
  const c = cfg as Partial<TasteVectorConfig> | null

  if (!c || typeof c !== 'object') {
    throw new Error('taste_vector_config bir nesne degil')
  }

  const posFinite = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0
  const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v)

  if (!c.round_weights || typeof c.round_weights !== 'object') {
    problems.push('round_weights eksik')
  } else {
    // choice_events.round CHECK BETWEEN 1 AND 3 → uc anahtarin ucu de sart.
    for (const r of ['1', '2', '3']) {
      if (!finite(c.round_weights[r])) problems.push(`round_weights['${r}'] sayi degil`)
    }
  }

  if (!finite(c.low_confidence_multiplier)) problems.push('low_confidence_multiplier sayi degil')
  if (!finite(c.low_intent_multiplier)) problems.push('low_intent_multiplier sayi degil')

  if (!Number.isInteger(c.low_intent_streak) || (c.low_intent_streak as number) < 1) {
    problems.push('low_intent_streak >= 1 tamsayi olmali')
  }

  if (!posFinite(c.full_confidence_signals)) {
    // 0 ozellikle yasak: w = n/0 = Infinity → shrinkage sessizce kapanir.
    problems.push('full_confidence_signals > 0 sonlu sayi olmali')
  }

  if (!c.feedback_weights || typeof c.feedback_weights !== 'object') {
    problems.push('feedback_weights eksik')
  } else {
    // watch_feedback.response CHECK ile ayni dort deger.
    for (const k of ['loved', 'ok', 'abandoned', 'not_watched']) {
      if (!finite(c.feedback_weights[k])) problems.push(`feedback_weights['${k}'] sayi degil`)
    }
  }

  if (problems.length > 0) {
    throw new Error(`taste_vector_config gecersiz: ${problems.join(' · ')}`)
  }
  return c as TasteVectorConfig
}

export interface ChoiceEventRow {
  id: string
  user_id: string | null
  session_id: string
  round: number
  film_a: string
  film_b: string
  winner: string | null
  outcome: string
  low_confidence: boolean
  created_at: string
}

export interface WatchFeedbackRow {
  id: string
  user_id: string | null
  film_id: string
  response: string | null
  created_at: string
}

/** Atlanan sinyallerin gerekcesi — hicbiri sessizce yutulmaz. */
export interface SkipCounts {
  /** outcome !== 'choice' (neither/seen/timeout zevk sinyali uretmez). */
  non_choice_outcome: number
  /** film_profiles.profile_vector yok ya da bozuk. */
  missing_film_vector: number
  /** watch_feedback.response taninmiyor ya da NULL. */
  unknown_feedback_response: number
  /** feedback agirligi 0 (not_watched) — bilgi tasimaz. */
  zero_weight_feedback: number
}

export interface TasteVectorResult {
  taste_vector: number[]
  user_confidence: number
  signal_count: number
  /** Gozlemin en yakin oldugu arketip; gozlem yoksa null. */
  nearest_archetype_id: number | null
  /** Prior'un nereden geldigi — istemciye degil, loga/rapora gider. */
  prior_source:
    | `nearest_archetype:${number}`
    | `user_archetype:${number}`
    | 'population_mean'
  /** Gozlem vektoru sifira cok yakin ciktiysa true (prior devraldi). */
  observation_degenerate: boolean
  skipped: SkipCounts
}

// ─── Vektor yardimcilari ─────────────────────────────────────────────────────

export function zeroVector(): number[] {
  return new Array<number>(VECTOR_DIM).fill(0)
}

export function l2Norm(v: number[]): number {
  let sum = 0
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i]
  return Math.sqrt(sum)
}

/**
 * Birim uzunluga indirger. Norm esigin altindaysa null doner — cagiran taraf
 * bunu ACIKCA ele almak zorundadir (sessiz sifir vektor DONMEZ).
 */
export function normalize(v: number[]): number[] | null {
  const n = l2Norm(v)
  // `!Number.isFinite(n)` ZORUNLU: NaN her karsilastirmada false doner, yani
  // yalnizca `n < EPSILON` yazilsaydi NaN'li vektor "saglikli" sayilip bastan
  // sona NaN dolu bir dizi olarak geri donerdi — truthy oldugu icin
  // observation_degenerate false kalir, Sentry susar ve hata ancak
  // formatPgVector "NaN" yazip pgvector INSERT'i patlattiginda yuzeye cikardi.
  if (!Number.isFinite(n) || n < DEGENERATE_NORM_EPSILON) return null
  return v.map((x) => x / n)
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  const denom = l2Norm(a) * l2Norm(b)
  // NaN korumasi normalize() ile ayni gerekce.
  if (!Number.isFinite(denom) || denom < DEGENERATE_NORM_EPSILON) return 0
  const sim = dot / denom
  return Number.isFinite(sim) ? sim : 0
}

// ─── Arketip merkezleri ──────────────────────────────────────────────────────

/**
 * 12 arketip kume merkezi.
 *
 * TURETILIR, uydurulmaz: `archetypeEngine.getArchetypeProfile` her arketip icin
 * kanonik TasteProfile'i verir, `vectorEncoder.tasteProfileToVector` onu 384
 * boyuta kodlar. `constants/archetypes.ts` yalnizca gorsel/i18n verisi tutar,
 * merkez ICERMEZ — bu yuzden zincir buradan kurulur.
 *
 * Deno'dan `services/` import etme deseni `recommend/index.ts` ile ayni.
 */
export function archetypeCentroids(): Map<number, number[]> {
  const out = new Map<number, number[]>()
  for (const id of ARCHETYPE_IDS) {
    const profile = getArchetypeProfile(id)
    if (!profile) {
      // Kod ici tutarsizlik — sessizce atlanamaz.
      throw new Error(`archetypeCentroids: ${id} icin kanonik profil yok`)
    }
    const vec = tasteProfileToVector(profile)
    if (vec.length !== VECTOR_DIM) {
      throw new Error(
        `archetypeCentroids: arketip ${id} ${vec.length} boyut uretti, ${VECTOR_DIM} bekleniyordu`,
      )
    }
    out.set(id, vec)
  }
  return out
}

/** 12 merkezin ortalamasi — hicbir sinyal ve arketip yokken kullanilan prior. */
export function populationMeanCentroid(centroids: Map<number, number[]>): number[] {
  const mean = zeroVector()
  for (const id of ARCHETYPE_IDS) {
    const c = centroids.get(id)!
    for (let i = 0; i < VECTOR_DIM; i++) mean[i] += c[i]
  }
  for (let i = 0; i < VECTOR_DIM; i++) mean[i] /= ARCHETYPE_IDS.length
  return mean
}

/** En yakin arketip. Esitlikte KUCUK id kazanir (determinizm). */
export function nearestArchetype(
  observed: number[],
  centroids: Map<number, number[]>,
): number {
  let bestId = ARCHETYPE_IDS[0]
  let bestSim = -Infinity
  for (const id of ARCHETYPE_IDS) {
    const sim = cosine(observed, centroids.get(id)!)
    if (sim > bestSim) {
      bestSim = sim
      bestId = id
    }
  }
  return bestId
}

// ─── low_intent turetimi ─────────────────────────────────────────────────────

/**
 * low_intent oturum bayragini choice_events ICINDEN turetir — YENI KOLON YOK.
 *
 * submit-choice (`isLowIntentSession`) yazma aninda su soruyu soruyordu:
 * "bu oturumun EN SON N olayinin hepsi low_confidence mi?". Ayni kural
 * gecmise donuk uygulanir: oturum icinde kronolojik siralanan olaylarda,
 * i. olay ancak kendisi dahil onceki N olayin hepsi low_confidence ise
 * low_intent sayilir. Yazma anindaki sorgu da tam olarak bu pencereyi
 * goruyordu (`order created_at DESC limit N`, yeni eklenen satir dahil).
 *
 * @returns low_intent sayilan olaylarin id kumesi
 */
export function deriveLowIntentEventIds(
  events: ChoiceEventRow[],
  streak: number,
): Set<string> {
  const lowIntent = new Set<string>()
  if (streak <= 0) return lowIntent

  const bySession = new Map<string, ChoiceEventRow[]>()
  for (const ev of events) {
    const list = bySession.get(ev.session_id)
    if (list) list.push(ev)
    else bySession.set(ev.session_id, [ev])
  }

  for (const list of bySession.values()) {
    const sorted = [...list].sort(compareByCreatedAtThenId)
    for (let i = 0; i < sorted.length; i++) {
      if (i + 1 < streak) continue
      let all = true
      for (let k = i - streak + 1; k <= i; k++) {
        if (!sorted[k].low_confidence) {
          all = false
          break
        }
      }
      if (all) lowIntent.add(sorted[i].id)
    }
  }
  return lowIntent
}

/**
 * Kararli siralama. Kayan nokta toplamasi sira bagimlidir; `--full` iki kez
 * ayni sonucu versin diye siralama her yerde AYNI olmak zorunda.
 */
export function compareByCreatedAtThenId(
  a: { created_at: string; id: string },
  b: { created_at: string; id: string },
): number {
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

// ─── Ana hesap ───────────────────────────────────────────────────────────────

export interface ComputeInput {
  events: ChoiceEventRow[]
  feedback: WatchFeedbackRow[]
  /** film_id → 384 boyutlu profile_vector. Eksik film atlanir ve sayilir. */
  filmVectors: Map<string, number[]>
  /** users.archetype_id — yoksa null. Yalnizca 0 sinyalde prior olarak kullanilir. */
  userArchetypeId: number | null
  config: TasteVectorConfig
  centroids: Map<number, number[]>
}

/**
 * Zevk vektorunu hesaplar.
 *
 * ── Sinyal birikimi ────────────────────────────────────────────────────────
 *   choice_events (yalnizca outcome='choice'):
 *     acc += agirlik × (kazanan_vektoru − kaybeden_vektoru)
 *     agirlik = round_weights[round]
 *               × (low_confidence ? low_confidence_multiplier : 1)
 *               × (low_intent    ? low_intent_multiplier     : 1)
 *   watch_feedback:
 *     acc += feedback_weights[response] × film_vektoru
 *
 * 'neither' / 'seen' / 'timeout' zevk sinyali URETMEZ: 'neither' iki filmi de
 * reddeder (tercih beyani degil), 'seen' "bunu zaten izledim" bilgisidir,
 * 'timeout' kazanan icermez. Ucu de `skipped.non_choice_outcome` altinda
 * sayilir — sessizce yutulmaz.
 *
 * ── Shrinkage ──────────────────────────────────────────────────────────────
 *   w = min(1, sinyal_sayisi / full_confidence_signals)
 *   taste_vector = normalize( w × normalize(gozlem) + (1−w) × normalize(prior) )
 *   user_confidence = w
 *
 * Gozlem ve prior harmanlanmadan once ayri ayri birim uzunluga indirilir:
 * gozlem bir FARK vektorudur (isaret degistirebilir), prior ise [0,1]
 * araliginda mutlak bir merkez. Olcekleri esitlenmeden harmanlanirsa agirlik
 * w'nin degil vektor buyuklugunun kontrolune gecerdi.
 *
 * 0 sinyalde w=0 olur ve sonuc SAF PRIOR'dur — bos/null vektor DONMEZ.
 */
export function computeTasteVector(input: ComputeInput): TasteVectorResult {
  const { events, feedback, filmVectors, userArchetypeId, config, centroids } = input

  const skipped: SkipCounts = {
    non_choice_outcome: 0,
    missing_film_vector: 0,
    unknown_feedback_response: 0,
    zero_weight_feedback: 0,
  }

  const lowIntentIds = deriveLowIntentEventIds(events, config.low_intent_streak)

  const acc = zeroVector()
  let signalCount = 0

  // ── choice_events ──────────────────────────────────────────────────────
  const sortedEvents = [...events].sort(compareByCreatedAtThenId)
  for (const ev of sortedEvents) {
    if (ev.outcome !== 'choice' || !ev.winner) {
      skipped.non_choice_outcome++
      continue
    }
    const loserId = ev.winner === ev.film_a ? ev.film_b : ev.film_a
    const winVec = filmVectors.get(ev.winner)
    const loseVec = filmVectors.get(loserId)
    if (!winVec || !loseVec) {
      skipped.missing_film_vector++
      continue
    }

    const base = config.round_weights[String(ev.round)]
    if (typeof base !== 'number') {
      // Konfigurasyon eksikligi kodlama hatasidir — varsayilan UYDURULMAZ.
      throw new Error(
        `taste_vector_config.round_weights['${ev.round}'] tanimli degil (olay ${ev.id})`,
      )
    }

    // ── Carpanlar BILESIKTIR, alternatif DEGIL ────────────────────────────
    // deriveLowIntentEventIds bir olayi ancak KENDISI DAHIL son N olayin
    // hepsi low_confidence ise isaretler → low_intent olan her olay tanim
    // geregi low_confidence'tir. Dolayisiyla efektif taban carpan hicbir zaman
    // yalniz 0.1 degil, her zaman 0.3 × 0.1 = 0.03'tur. Bu kasitli: "guveni
    // dusuk" ile "oturumun tamami dikkatsiz" birbirini pekistiren iki ayri
    // gozlemdir, ikincisi birincisini kapsadigi icin ceza da katlanir.
    let weight = base
    if (ev.low_confidence) weight *= config.low_confidence_multiplier
    if (lowIntentIds.has(ev.id)) weight *= config.low_intent_multiplier

    for (let i = 0; i < VECTOR_DIM; i++) {
      acc[i] += weight * (winVec[i] - loseVec[i])
    }
    signalCount++
  }

  // ── watch_feedback ─────────────────────────────────────────────────────
  // Bugun 0 satir (C.4'e kadar boyle kalacak). Bos dizide dongu hic donmez,
  // signalCount degismez, sonuc yalnizca choice_events'ten kurulur.
  const sortedFeedback = [...feedback].sort(compareByCreatedAtThenId)
  for (const fb of sortedFeedback) {
    if (!fb.response) {
      skipped.unknown_feedback_response++
      continue
    }
    const fw = config.feedback_weights[fb.response]
    if (typeof fw !== 'number') {
      skipped.unknown_feedback_response++
      continue
    }
    if (fw === 0) {
      // not_watched — notr, bilgi tasimaz, sinyal SAYILMAZ.
      skipped.zero_weight_feedback++
      continue
    }
    const vec = filmVectors.get(fb.film_id)
    if (!vec) {
      skipped.missing_film_vector++
      continue
    }
    for (let i = 0; i < VECTOR_DIM; i++) acc[i] += fw * vec[i]
    signalCount++
  }

  // ── Gozlem ─────────────────────────────────────────────────────────────
  const observedUnit = signalCount > 0 ? normalize(acc) : null
  const observationDegenerate = signalCount > 0 && observedUnit === null

  // ── Prior secimi ───────────────────────────────────────────────────────
  let priorRaw: number[]
  let priorSource: TasteVectorResult['prior_source']
  let nearestId: number | null = null

  if (observedUnit) {
    nearestId = nearestArchetype(observedUnit, centroids)
    priorRaw = centroids.get(nearestId)!
    priorSource = `nearest_archetype:${nearestId}`
  } else if (userArchetypeId !== null && centroids.has(userArchetypeId)) {
    priorRaw = centroids.get(userArchetypeId)!
    priorSource = `user_archetype:${userArchetypeId}`
  } else {
    priorRaw = populationMeanCentroid(centroids)
    priorSource = 'population_mean'
  }

  const priorUnit = normalize(priorRaw)
  if (!priorUnit) {
    // 12 merkezin hicbiri sifir vektor degil; buraya dusmek kod hatasidir.
    throw new Error(`computeTasteVector: prior vektoru sifir (${priorSource})`)
  }

  // ── Shrinkage ──────────────────────────────────────────────────────────
  // Gozlem kullanilamiyorsa w zorla 0'a cekilir: aksi halde "sinyal var ama
  // yon yok" durumunda w>0 ile sifir vektor harmanlanip prior sulandirilirdi.
  const w = observedUnit
    ? Math.min(1, signalCount / config.full_confidence_signals)
    : 0

  const blended = zeroVector()
  for (let i = 0; i < VECTOR_DIM; i++) {
    const obs = observedUnit ? observedUnit[i] : 0
    blended[i] = w * obs + (1 - w) * priorUnit[i]
  }

  const finalVec = normalize(blended)
  if (!finalVec) {
    throw new Error('computeTasteVector: harmanlanmis vektor sifir cikti')
  }

  return {
    taste_vector: finalVec,
    user_confidence: w,
    signal_count: signalCount,
    nearest_archetype_id: nearestId,
    prior_source: priorSource,
    observation_degenerate: observationDegenerate,
    skipped,
  }
}

// ─── pgvector serilestirme ───────────────────────────────────────────────────

/**
 * PostgREST'ten gelen `vector(384)` degerini sayi dizisine cevirir.
 * PostgREST bu tipi JSON string olarak ('[0.1,0.2,...]') dondurur.
 *
 * Bozuk/eksik veri SESSIZCE atlanmaz — null doner ve cagiran taraf sayar.
 */
export function parsePgVector(raw: unknown): number[] | null {
  let arr: unknown
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw)
    } catch {
      return null
    }
  } else {
    arr = raw
  }
  if (!Array.isArray(arr) || arr.length !== VECTOR_DIM) return null
  const out = new Array<number>(VECTOR_DIM)
  for (let i = 0; i < VECTOR_DIM; i++) {
    const n = arr[i]
    if (typeof n !== 'number' || !Number.isFinite(n)) return null
    out[i] = n
  }
  return out
}

/**
 * Sayi dizisini pgvector literaline cevirir.
 * 6 haneye yuvarlanir: ayni girdi her calistirmada AYNI metni uretsin diye
 * (kayan nokta gosterim farklari determinizm testini kirabilir).
 */
export function formatPgVector(v: number[]): string {
  return `[${v.map((x) => x.toFixed(6)).join(',')}]`
}
