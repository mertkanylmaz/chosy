/**
 * Edge Function: generate-gauntlet — günün 4 filmi (B.3, v0)
 *
 * Katman 3. TÜM algoritma bu dosyada, tam izole. İstemci "neden bu 4 film"
 * bilgisini ASLA almaz — response `types/gauntlet.ts`'teki kilitli
 * `DailyGauntlet` şeklidir, skor/percentile/aday havuzu dışarı sızmaz.
 *
 * v0'da kişiselleştirme YOK: bağlam filtresi + tanınırlık puanı + çeşitlilik
 * kuralları + ağırlıklı rastgele seçim. Kişiselleştirme veri biriktikçe
 * eklenecek bir ÇARPAN (PRODUCT_OS §6.10).
 *
 * Boru hattı (PRODUCT_OS §6.3):
 *   [1] SERT FİLTRE  → bağlama göre aday havuzu
 *   [2] PUANLAMA     → tanınırlık, yüzdelik (mutlak eşik DEĞİL)
 *   [3] ÇEŞİTLİLİK   → 4 film — asıl iş
 *   [4] SLOT         → global / personal / discovery etiketleri
 *   [5] SIRA KARIŞTIRMA
 *
 * ── Bu dosyanın YAZMADIĞI şey ────────────────────────────────────────────────
 * `duel_impressions` B.4'ün (submit-choice) işidir: "her seçim →
 * choice_events + duel_impressions". Burada yalnızca OKUNUR (ADIM 1 çift
 * filtresi). Üretim anında yazmak, gösterilmemiş çiftleri gösterilmiş
 * saymak olurdu.
 */

import {
  AuthError,
  errorResponse,
  getAppConfig,
  getServiceClient,
  getUserClient,
  handleCors,
  jsonResponse,
  logError,
  logInfo,
  requireAuthUser,
  resolveAppUser,
} from '../_shared/gameUtils.ts'
import { sentryCapture } from '../_shared/sentry.ts'
import type {
  DailyGauntlet,
  GauntletContext,
  GauntletFilm,
} from '../../../types/gauntlet.ts'

// ─── Sabitler ────────────────────────────────────────────────────────────────

const ALGORITHM_VERSION = 'v0-random-diverse'

/**
 * Bağlam süre tavanı (dakika). 999 bir tavan DEĞİL, "sınırsız" sentinel'idir —
 * çarpan olarak kullanılması yasak (migration 071 gerekçesi).
 */
const CONTEXT_MAX_RUNTIME: Record<GauntletContext['duration'], number> = {
  short: 110,
  medium: 150,
  any: 999,
}

const ACTIVE_TIERS = ['core', 'extended', 'trending']
/** Son çare gevşetmesi. archive migration 050 ile normalde tamamen dışlanır. */
const RELAXED_TIERS = [...ACTIVE_TIERS, 'archive']

const SHOWN_COOLDOWN_DAYS = 21
const REJECTED_COOLDOWN_DAYS = 45

/** PostgREST tek istekte en fazla 1000 satır döner — havuz 1866, sayfalanır. */
const PAGE_SIZE = 1000

/**
 * Skoru 0 olan filmin seçilme olasılığı sıfır olursa tanınırlık yumuşak bir
 * puan olmaktan çıkıp ikinci bir SERT FİLTREYE dönüşür. Taban ağırlık bunu
 * engeller: düşük skorlu film nadir seçilir, imkânsız değil.
 */
const MIN_SELECTION_WEIGHT = 0.01

/**
 * Ne imdb_votes ne vote_average olan film için nötr puan.
 *
 * ⚠️ ÖLÇÜME GÖRE ULAŞILAMAZ (7 Ağu 2026): havuzda imdb_votes = 0 olan 0 satır,
 * NULL olan 50 satır var ve o 50'sinin hepsinde vote_average dolu. Yani bugün
 * bu katman hiç çalışmıyor. ÖLÜ KOD DEĞİL: havuz değişirse (yeni filmler,
 * imdb_votes doldurulursa, TMDb senkronu vote_average'ı boş bırakırsa) yol
 * tekrar canlanır. Silinmesi sessiz bir NaN/undefined yoluna kapı açar.
 */
const NEUTRAL_RECOGNITION_SCORE = 0.4

/** Aynı dörtlüyü farklı eşleştirmelerle deneme sayısı (spec: max 5). */
const MAX_QUARTET_ATTEMPTS = 5
/** Aynı kural setinde farklı ağırlıklı karıştırma denemesi. */
const SHUFFLES_PER_RULESET = 3

/**
 * Yenileme hakkı: Free 2/gün · Pro sınırsız (PRODUCT_OS §"Yenileme hakkı").
 * Entitlement kontrolü ve harcanan hakkın düşülmesi B.4'ün işi — burada
 * yalnızca gün başı Free tabanı raporlanır.
 */
const REFRESHES_PER_DAY_FREE = 2

/**
 * Tam güven için gereken ham sinyal sayısı: 6 gün × 3 tur (PRODUCT_OS §6.6,
 * "6 günde temel profil oturur"). userConfidence bu orandan türetilir.
 */
const SIGNALS_FOR_FULL_CONFIDENCE = 18

// ─── Tipler ──────────────────────────────────────────────────────────────────

interface GenerateRequest {
  context?: unknown
}

/** ADIM 1 sonrası aday. profile_vector yalnız NOT NULL kontrolü için kullanılır. */
interface Candidate {
  id: string
  title: string
  year: number
  runtime: number
  posterUrl: string
  director: string | null
  primaryGenre: string | null
  language: string | null
  imdbVotes: number | null
  voteAverage: number | null
  /** ADIM 2'de doldurulur. */
  score: number
}

interface FilmRow {
  id: string
  title: string
  year: number | null
  runtime: number | null
  poster_url: string | null
  director: string | null
  genres: string[] | null
  original_language: string | null
  imdb_votes: number | null
  vote_average: number | null
}

interface PoolRow {
  films: FilmRow | null
}

interface DiversityRules {
  language: boolean
  genre: boolean
  decade: boolean
}

/** ADIM 3'te ölçülen süre yayılımı eşikleri (quantile, oran DEĞİL). */
interface SpreadThresholds {
  low: number
  high: number
}

interface Exclusions {
  watched: Set<string>
  recentlyShown: Set<string>
  recentlyRejected: Set<string>
  shownPairs: Set<string>
}

// ─── Girdi doğrulama ─────────────────────────────────────────────────────────

const COMPANIONS = ['alone', 'partner', 'friends', 'family']
const DURATIONS = ['short', 'medium', 'any']
const ENERGIES = ['drained', 'normal', 'open']

/**
 * `GauntletContext` şekil doğrulaması. `types/gauntlet.ts` dış paket
 * kullanmama kuralını izler — literal kontrolü, Zod yok.
 */
function isValidContext(v: unknown): v is GauntletContext {
  if (typeof v !== 'object' || v === null) return false
  const c = v as Record<string, unknown>
  return (
    typeof c.companion === 'string' && COMPANIONS.includes(c.companion) &&
    typeof c.duration === 'string' && DURATIONS.includes(c.duration) &&
    typeof c.energy === 'string' && ENERGIES.includes(c.energy)
  )
}

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

function utcDateString(offsetDays = 0): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

function utcTimestamp(offsetDays: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offsetDays)
  return d.toISOString()
}

/** duel_impressions.pair_key ile birebir: least(a,b) || '|' || greatest(a,b). */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

function decadeOf(year: number): number {
  return Math.floor(year / 10) * 10
}

/** Sıralı diziden lineer interpolasyonlu quantile. */
function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) throw new Error('quantile: boş dizi')
  if (sorted.length === 1) return sorted[0]
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

// ─── ADIM 1 — SERT FİLTRE ────────────────────────────────────────────────────

/**
 * Aday havuzunu getirir.
 *
 * ⚠️ `profile_vector` **film_profiles** tablosundadır, `films`'te DEĞİL.
 * Sorgu film_profiles'tan başlar ve `films!inner(...)` ile INNER JOIN kurar:
 *     film_profiles INNER JOIN films ON films.id = film_profiles.film_id
 *     WHERE film_profiles.profile_vector IS NOT NULL
 * Spec'in kendisi bu hatayı yapmış, filtreyi `films` üzerindeymiş gibi
 * yazmıştı. İki sonucu var, ikisi de ölçüldü (7 Ağu 2026):
 *   - `films.profile_vector` → Postgres 42703 "column does not exist", her
 *     çağrı 400 ile ölür.
 *   - Sorguyu `films`'ten başlatıp NOT NULL kontrolünü düşürmek → profilsiz
 *     filmler havuza sızar, düello-uygunluk sessizce kaybolur.
 *
 * Cooldown/izlenen elemesi bellekte yapılır: havuz ~1866 satır, buna karşılık
 * NOT IN listesi yüzlerce UUID'lik bir URL üretir ve PostgREST'te patlar.
 */
async function fetchPool(
  service: ReturnType<typeof getServiceClient>,
  maxRuntime: number,
  tiers: string[],
): Promise<Candidate[]> {
  const rows: PoolRow[] = []

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await service
      .from('film_profiles')
      .select(
        'films!inner(id,title,year,runtime,poster_url,director,genres,' +
          'original_language,imdb_votes,vote_average)',
      )
      .not('profile_vector', 'is', null)
      .not('films.poster_url', 'is', null)
      .not('films.runtime', 'is', null)
      .not('films.year', 'is', null)
      .in('films.curation_tier', tiers)
      .lte('films.runtime', maxRuntime)
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      throw new Error(`aday havuzu sorgusu başarısız: ${error.message}`)
    }

    const page = (data ?? []) as unknown as PoolRow[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }

  const candidates: Candidate[] = []
  for (const row of rows) {
    const f = row.films
    if (!f || !f.poster_url || f.runtime === null || f.year === null) continue
    candidates.push({
      id: f.id,
      title: f.title,
      year: f.year,
      runtime: f.runtime,
      posterUrl: f.poster_url,
      director: f.director,
      primaryGenre: f.genres && f.genres.length > 0 ? f.genres[0] : null,
      language: f.original_language,
      // imdb_votes = 0 → NULL sayılır, ASLA gerçek değer kabul edilmez.
      imdbVotes: f.imdb_votes !== null && f.imdb_votes > 0 ? f.imdb_votes : null,
      voteAverage:
        f.vote_average !== null && f.vote_average > 0 ? f.vote_average : null,
      score: 0,
    })
  }
  return candidates
}

/** İzlenen · son 21 gün gösterilen · son 45 gün reddedilen · gösterilmiş çiftler. */
async function fetchExclusions(
  service: ReturnType<typeof getServiceClient>,
  appUserId: string,
): Promise<Exclusions> {
  const [watchRes, shownRes, choiceRes, pairRes] = await Promise.all([
    service
      .from('watchlist')
      .select('film_id')
      .eq('user_id', appUserId)
      .not('watched_at', 'is', null),
    service
      .from('daily_gauntlets')
      .select('film_ids')
      .eq('user_id', appUserId)
      .gte('date', utcDateString(-SHOWN_COOLDOWN_DAYS)),
    service
      .from('choice_events')
      .select('film_a,film_b,winner,outcome')
      .eq('user_id', appUserId)
      .in('outcome', ['neither', 'seen'])
      .gte('created_at', utcTimestamp(-REJECTED_COOLDOWN_DAYS)),
    service.from('duel_impressions').select('pair_key').eq('user_id', appUserId),
  ])

  for (const res of [watchRes, shownRes, choiceRes, pairRes]) {
    if (res.error) {
      throw new Error(`dışlama sorgusu başarısız: ${res.error.message}`)
    }
  }

  const watched = new Set<string>()
  for (const r of (watchRes.data ?? []) as { film_id: string }[]) {
    watched.add(r.film_id)
  }

  const recentlyShown = new Set<string>()
  for (const r of (shownRes.data ?? []) as { film_ids: string[] }[]) {
    for (const id of r.film_ids ?? []) recentlyShown.add(id)
  }

  // 'neither' → iki film de reddedildi. 'seen' → kazanan film zaten izlenmiş.
  const recentlyRejected = new Set<string>()
  for (
    const r of (choiceRes.data ?? []) as {
      film_a: string
      film_b: string
      winner: string | null
      outcome: string
    }[]
  ) {
    if (r.outcome === 'neither') {
      recentlyRejected.add(r.film_a)
      recentlyRejected.add(r.film_b)
    } else if (r.winner) {
      recentlyRejected.add(r.winner)
    }
  }

  const shownPairs = new Set<string>()
  for (const r of (pairRes.data ?? []) as { pair_key: string | null }[]) {
    if (r.pair_key) shownPairs.add(r.pair_key)
  }

  return { watched, recentlyShown, recentlyRejected, shownPairs }
}

// ─── ADIM 2 — TANINIRLIK (YÜZDELİK) ──────────────────────────────────────────

/**
 * `percent_rank` eşdeğeri: kesin olarak daha küçük değerlerin oranı × 100.
 * Eşit değerler aynı yüzdeliği alır (Postgres percent_rank semantiği).
 */
function percentRanks(values: number[]): Map<number, number> {
  const sorted = [...values].sort((a, b) => a - b)
  const ranks = new Map<number, number>()
  const n = sorted.length
  for (let i = 0; i < n; i++) {
    const v = sorted[i]
    if (ranks.has(v)) continue
    // İlk görülme indeksi = kendisinden kesin küçük olanların sayısı.
    ranks.set(v, n > 1 ? (i / (n - 1)) * 100 : 50)
  }
  return ranks
}

/**
 * Tanınırlık puanı. Mutlak oy eşiği KULLANILMAZ — `imdb_votes` dağılımı iki
 * tepeli ve kolon geçmişte kirliydi (OMDb ile TMDb iki farklı metrik aynı
 * kolonda, PRODUCT_OS §6.5).
 *
 * puan = 1 − |yüzdelik − orta| / yarıGenişlik, min 0
 *   orta         = (low + high) / 2                → 55/80 için 67.5
 *   yarıGenişlik = 100 − orta                      → 55/80 için 32.5
 *
 * `(high − low) / 2` (= 12.5) okuması BİLİNÇLİ OLARAK reddedildi: bandın
 * dışındaki her filmi 0'a çeker, yani yumuşak puanı ikinci bir sert filtreye
 * dönüştürür. Spec'in her iki yerde yazdığı 32.5 sabiti yukarıdaki formülle
 * birebir çıkar.
 */
function applyRecognitionScores(
  pool: Candidate[],
  bandLow: number,
  bandHigh: number,
): void {
  const mid = (bandLow + bandHigh) / 2
  const halfWidth = 100 - mid

  const voteRanks = percentRanks(
    pool.filter((c) => c.imdbVotes !== null).map((c) => c.imdbVotes as number),
  )
  const ratingRanks = percentRanks(
    pool.filter((c) => c.imdbVotes === null && c.voteAverage !== null)
      .map((c) => c.voteAverage as number),
  )

  for (const c of pool) {
    let percentile: number | null = null
    if (c.imdbVotes !== null) {
      percentile = voteRanks.get(c.imdbVotes) ?? null
    } else if (c.voteAverage !== null) {
      // imdb_votes NULL → vote_average fallback.
      percentile = ratingRanks.get(c.voteAverage) ?? null
    }

    c.score = percentile === null
      ? NEUTRAL_RECOGNITION_SCORE // ölçüme göre ulaşılamaz, bkz. sabit yorumu
      : Math.max(0, 1 - Math.abs(percentile - mid) / halfWidth)
  }
}

// ─── ADIM 3 — ÇEŞİTLİLİK ─────────────────────────────────────────────────────

/**
 * Sert kurallar (PRODUCT_OS §6.6):
 *   aynı yönetmen ≤1 · aynı on yıl ≤2 · aynı birincil tür ≤2 · aynı dil ≤3
 * `director` NULL → "bilinmeyen yönetmen" bucket'ı, dörtlüde en fazla 1.
 * Yönetmen kuralı GEVŞETİLMEZ — dört farklı yönetmen çeşitliliğin çekirdeği.
 */
function respectsRules(
  selected: Candidate[],
  c: Candidate,
  rules: DiversityRules,
): boolean {
  const directorKey = c.director ?? '__unknown_director__'
  if (selected.some((s) => (s.director ?? '__unknown_director__') === directorKey)) {
    return false
  }
  if (rules.decade) {
    const d = decadeOf(c.year)
    if (selected.filter((s) => decadeOf(s.year) === d).length >= 2) return false
  }
  if (rules.genre) {
    const g = c.primaryGenre ?? '__unknown_genre__'
    if (
      selected.filter((s) => (s.primaryGenre ?? '__unknown_genre__') === g)
        .length >= 2
    ) return false
  }
  if (rules.language) {
    const l = c.language ?? '__unknown_language__'
    if (
      selected.filter((s) => (s.language ?? '__unknown_language__') === l)
        .length >= 3
    ) return false
  }
  return true
}

/**
 * Skora göre ağırlıklı, tekrarsız karıştırma (Efraimidis–Spirakis):
 * anahtar = random^(1/ağırlık), azalan sırada.
 */
function weightedShuffle(pool: Candidate[]): Candidate[] {
  return pool
    .map((c) => ({
      c,
      key: Math.pow(Math.random(), 1 / Math.max(c.score, MIN_SELECTION_WEIGHT)),
    }))
    .sort((a, b) => b.key - a.key)
    .map((x) => x.c)
}

/**
 * Tek deneme: süre yayılımı önce garantilenir (aksi halde 4. filme kadar
 * beklenip çıkmaz sokağa girilir), kalan slotlar kurallara uyan ilk adaylarla
 * doldurulur.
 */
function tryBuildQuartet(
  order: Candidate[],
  rules: DiversityRules,
  spread: SpreadThresholds | null,
): Candidate[] | null {
  const picked: Candidate[] = []

  if (spread) {
    const short = order.find((c) => c.runtime <= spread.low)
    if (!short) return null
    picked.push(short)
    const long = order.find(
      (c) =>
        c.runtime >= spread.high && c.id !== short.id &&
        respectsRules(picked, c, rules),
    )
    if (!long) return null
    picked.push(long)
  }

  for (const c of order) {
    if (picked.length === 4) break
    if (picked.some((p) => p.id === c.id)) continue
    if (!respectsRules(picked, c, rules)) continue
    picked.push(c)
  }

  return picked.length === 4 ? picked : null
}

interface QuartetResult {
  films: Candidate[]
  relaxations: string[]
}

/**
 * Gevşetme merdiveni. Sıra spec'te sabit: dil → tür → on yıl. Süre yayılımı
 * en son bırakılır; havuzun kendi dağılımından ölçüldüğü için onu düşürmek
 * "kural karşılanamıyor" demektir, "kural gereksiz" değil.
 */
function selectQuartet(
  pool: Candidate[],
  spread: SpreadThresholds | null,
): QuartetResult | null {
  const ladder: { rules: DiversityRules; spread: SpreadThresholds | null; label: string }[] = [
    { rules: { language: true, genre: true, decade: true }, spread, label: 'strict' },
    { rules: { language: false, genre: true, decade: true }, spread, label: 'language' },
    { rules: { language: false, genre: false, decade: true }, spread, label: 'genre' },
    { rules: { language: false, genre: false, decade: false }, spread, label: 'decade' },
  ]
  if (spread) {
    ladder.push({
      rules: { language: false, genre: false, decade: false },
      spread: null,
      label: 'runtime_spread',
    })
  }

  const relaxations: string[] = []
  for (const step of ladder) {
    for (let i = 0; i < SHUFFLES_PER_RULESET; i++) {
      const quartet = tryBuildQuartet(weightedShuffle(pool), step.rules, step.spread)
      if (quartet) return { films: quartet, relaxations }
    }
    if (step.label !== 'strict') relaxations.push(step.label)
  }
  return null
}

// ─── ADIM 5 — SIRA KARIŞTIRMA + ÇİFT KONTROLÜ ────────────────────────────────

/** Bir dörtlünün üç olası yarı-final eşleştirmesi (indeks çiftleri). */
const PAIRINGS: [number, number, number, number][] = [
  [0, 1, 2, 3],
  [0, 2, 1, 3],
  [0, 3, 1, 2],
]

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Dörtlüyü ekran sırasına dizer.
 *
 * Sıra RASTGELE — skora göre sıralama YASAK (maruz kalma bias'ı algoritmanın
 * kendi tahminini kendine kanıtlamasına yol açar, PRODUCT_OS §6.8).
 *
 * Çift kontrolü yalnız iki YARI-FİNAL çiftine bakar (indeks 0-1 ve 2-3).
 * Final çifti turnuva sırasında belirlenir, üretim anında bilinemez; onun
 * gösterim kaydı B.4'te yazılır.
 */
function arrangeUnseen(
  quartet: Candidate[],
  shownPairs: Set<string>,
): { films: Candidate[]; allPairingsSeen: boolean } {
  for (const p of shuffleInPlace([...PAIRINGS])) {
    const ordered = [quartet[p[0]], quartet[p[1]], quartet[p[2]], quartet[p[3]]]
    const seen = shownPairs.has(pairKey(ordered[0].id, ordered[1].id)) ||
      shownPairs.has(pairKey(ordered[2].id, ordered[3].id))
    if (!seen) {
      // Eşleştirme korunur, çiftlerin ekrandaki yeri ve iç sırası karışır.
      const first = shuffleInPlace([ordered[0], ordered[1]])
      const second = shuffleInPlace([ordered[2], ordered[3]])
      const blocks = shuffleInPlace([first, second])
      return { films: [...blocks[0], ...blocks[1]], allPairingsSeen: false }
    }
  }
  return { films: shuffleInPlace([...quartet]), allPairingsSeen: true }
}

// ─── ADIM 4 — SLOT ───────────────────────────────────────────────────────────

/**
 * v0'da `personal` ve `discovery` aynı mantıktır, yalnızca etikettir —
 * kişiselleştirme yok. Sinyalsiz kullanıcıda dördü de `global` etiketlenir.
 *
 * ⚠️ Global slotun gerçek kaynağı (`scope = 'global'` günlük satır) henüz
 * üretilmiyor: generate-global-slot cron'u B.3 kapsamının dışında bırakıldı.
 * Bugün dört film de aynı boru hattından gelir; etiketler C fazında gerçek
 * kaynaklara bağlanacak.
 */
function slotTypesFor(signalCount: number): DailyGauntlet['slotTypes'] {
  if (signalCount === 0) return ['global', 'global', 'global', 'global']
  return ['global', 'personal', 'personal', 'discovery']
}

// ─── Response kurulumu ───────────────────────────────────────────────────────

function toGauntletFilm(c: Candidate): GauntletFilm {
  // dominantColor opsiyonel ve şu an kaynağı yok: films tablosunda baskın
  // renk kolonu bulunmuyor. Uydurulmuş renk göndermek yerine alan atlanır.
  return {
    id: c.id,
    title: c.title,
    year: c.year,
    runtime: c.runtime,
    posterUrl: c.posterUrl,
  }
}

async function fetchFilmsByIds(
  service: ReturnType<typeof getServiceClient>,
  ids: string[],
): Promise<GauntletFilm[]> {
  const { data, error } = await service
    .from('films')
    .select('id,title,year,runtime,poster_url')
    .in('id', ids)

  if (error) throw new Error(`film getirme başarısız: ${error.message}`)

  const rows = (data ?? []) as {
    id: string
    title: string
    year: number
    runtime: number
    poster_url: string
  }[]
  const byId = new Map(rows.map((r) => [r.id, r]))

  // Sıra daily_gauntlets.film_ids'ten gelir — idempotent çağrıda AYNI sıra.
  const films: GauntletFilm[] = []
  for (const id of ids) {
    const r = byId.get(id)
    if (!r) throw new Error(`gauntlet filmi bulunamadı: ${id}`)
    films.push({
      id: r.id,
      title: r.title,
      year: r.year,
      runtime: r.runtime,
      posterUrl: r.poster_url,
    })
  }
  return films
}

async function countSignals(
  service: ReturnType<typeof getServiceClient>,
  appUserId: string,
): Promise<number> {
  const { count, error } = await service
    .from('choice_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', appUserId)

  if (error) throw new Error(`sinyal sayımı başarısız: ${error.message}`)
  return count ?? 0
}

// ─── Üretim ──────────────────────────────────────────────────────────────────

interface GeneratedQuartet {
  films: Candidate[]
  relaxed: boolean
  relaxations: string[]
  poolSize: number
}

async function generateQuartet(
  service: ReturnType<typeof getServiceClient>,
  appUserId: string,
  context: GauntletContext,
): Promise<GeneratedQuartet> {
  // app_config LAZY okunur — modül seviyesinde cache YOK. Anahtar eksikse
  // getAppConfig throw eder; kod içi sabitle sessizce devam edilmez.
  const [bandLow, bandHigh, spreadLowQ, spreadHighQ] = await Promise.all([
    getAppConfig<number>(service, 'recognition_band_low'),
    getAppConfig<number>(service, 'recognition_band_high'),
    getAppConfig<number>(service, 'runtime_spread_low_quantile'),
    getAppConfig<number>(service, 'runtime_spread_high_quantile'),
  ])

  const maxRuntime = CONTEXT_MAX_RUNTIME[context.duration]
  const exclusions = await fetchExclusions(service, appUserId)

  // ── ADIM 1 — gevşetme merdiveni: cooldown → tier ──────────────────────────
  const relaxations: string[] = []
  let pool: Candidate[] = []

  const rawPool = await fetchPool(service, maxRuntime, ACTIVE_TIERS)
  pool = rawPool.filter(
    (c) =>
      !exclusions.watched.has(c.id) &&
      !exclusions.recentlyShown.has(c.id) &&
      !exclusions.recentlyRejected.has(c.id),
  )

  if (pool.length < 4) {
    relaxations.push('cooldown')
    logInfo('gauntlet_relax_cooldown', {
      user_id: appUserId,
      pool_after_cooldown: pool.length,
      pool_before_cooldown: rawPool.length,
    })
    // İzlenen film asla geri gelmez — gevşeyen yalnız cooldown'lar.
    pool = rawPool.filter((c) => !exclusions.watched.has(c.id))
  }

  if (pool.length < 4) {
    relaxations.push('tier')
    logInfo('gauntlet_relax_tier', { user_id: appUserId, pool_size: pool.length })
    await sentryCapture({
      message: 'generate-gauntlet: aday havuzu archive tier ile genişletildi',
      level: 'warning',
      tags: { function: 'generate-gauntlet' },
      extra: { user_id: appUserId, pool_size: pool.length, context },
    })
    const archivePool = await fetchPool(service, maxRuntime, RELAXED_TIERS)
    pool = archivePool.filter((c) => !exclusions.watched.has(c.id))
  }

  if (pool.length < 4) {
    // Sessiz fallback YASAK: boş/eksik liste dönmek yerine hata yükseltilir.
    throw new Error(
      `aday havuzu 4 filmden küçük (${pool.length}) — bağlam: ` +
        JSON.stringify(context),
    )
  }

  // ── ADIM 2 — tanınırlık puanı ─────────────────────────────────────────────
  applyRecognitionScores(pool, bandLow, bandHigh)

  // ── ADIM 3 — süre yayılımı eşikleri (ORAN DEĞİL QUANTILE) ─────────────────
  // Eşik, ADIM 1 sonrası havuzun KENDİ dağılımından her çağrıda hesaplanır.
  // contextMaxRuntime'ı çarpan yapmak short'ta 0 film, any'de 799 dk'lık film
  // arayışı üretiyordu (migration 071 gerekçesi).
  const runtimes = pool.map((c) => c.runtime).sort((a, b) => a - b)
  const low = quantile(runtimes, spreadLowQ)
  const high = quantile(runtimes, spreadHighQ)

  let spread: SpreadThresholds | null = { low, high }
  const shortCount = pool.filter((c) => c.runtime <= low).length
  const longCount = pool.filter((c) => c.runtime >= high).length

  if (low >= high || shortCount === 0 || longCount === 0) {
    // Havuz kuralı besleyemiyor. Sessizce atlanmaz: loglanır ve relaxed:true
    // ile response'a yansır.
    spread = null
    relaxations.push('runtime_spread_unavailable')
    logInfo('gauntlet_relax_runtime_spread', {
      user_id: appUserId,
      reason: low >= high ? 'degenerate_distribution' : 'empty_side',
      pool_size: pool.length,
      quantile_low: low,
      quantile_high: high,
      short_count: shortCount,
      long_count: longCount,
    })
  }

  // ── ADIM 3 + ADIM 5 — çeşitlilik seçimi ve çift kontrolü ──────────────────
  let chosen: Candidate[] | null = null
  for (let attempt = 0; attempt < MAX_QUARTET_ATTEMPTS; attempt++) {
    const result = selectQuartet(pool, spread)
    if (!result) continue
    for (const label of result.relaxations) {
      if (!relaxations.includes(label)) relaxations.push(label)
    }

    const arranged = arrangeUnseen(result.films, exclusions.shownPairs)
    if (!arranged.allPairingsSeen) {
      chosen = arranged.films
      break
    }
    if (attempt === MAX_QUARTET_ATTEMPTS - 1) {
      // 5 denemede de her eşleştirme görülmüş: dörtlü kabul edilir, tekrar
      // gösterim loglanır. Boş dönmek yasak.
      relaxations.push('duplicate_pair')
      logInfo('gauntlet_relax_duplicate_pair', {
        user_id: appUserId,
        attempts: MAX_QUARTET_ATTEMPTS,
        film_ids: arranged.films.map((f) => f.id),
      })
      chosen = arranged.films
    }
  }

  if (!chosen) {
    throw new Error(
      `çeşitlilik kuralları ${MAX_QUARTET_ATTEMPTS} denemede karşılanamadı — ` +
        `havuz ${pool.length}, bağlam ${JSON.stringify(context)}`,
    )
  }

  return {
    films: chosen,
    relaxed: relaxations.length > 0,
    relaxations,
    poolSize: pool.length,
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', 'POST bekleniyor', 405)
  }

  let appUserId: string
  const service = getServiceClient()

  try {
    const userClient = getUserClient(req)
    const { authUid } = await requireAuthUser(userClient)
    const appUser = await resolveAppUser(service, authUid)
    appUserId = appUser.id
  } catch (err) {
    if (err instanceof AuthError) {
      logError('gauntlet_auth_failed', err)
      return errorResponse('UNAUTHORIZED', 'Oturum doğrulanamadı', 401)
    }
    logError('gauntlet_auth_error', err)
    await sentryCapture({
      message: 'generate-gauntlet: kimlik çözümleme hatası',
      level: 'error',
      tags: { function: 'generate-gauntlet' },
      extra: { error: err instanceof Error ? err.message : String(err) },
    })
    return errorResponse('AUTH_ERROR', 'Kimlik doğrulama başarısız', 500)
  }

  let body: GenerateRequest
  try {
    body = (await req.json()) as GenerateRequest
  } catch (err) {
    logError('gauntlet_bad_json', err, { user_id: appUserId })
    return errorResponse('INVALID_INPUT', 'Geçersiz JSON gövdesi', 400)
  }

  if (!isValidContext(body.context)) {
    return errorResponse(
      'INVALID_INPUT',
      'context zorunlu: { companion, duration, energy }',
      400,
    )
  }
  const context: GauntletContext = body.context

  try {
    const date = utcDateString()

    // ── Idempotency: aynı kullanıcı + gün ikinci çağrıda YENİ üretim yapmaz ──
    const existing = await service
      .from('daily_gauntlets')
      .select('id,film_ids,slot_types,context,relaxed,algorithm_version')
      .eq('user_id', appUserId)
      .eq('scope', 'personal')
      .eq('date', date)
      .maybeSingle()

    if (existing.error) {
      throw new Error(`mevcut gauntlet sorgusu başarısız: ${existing.error.message}`)
    }

    const signalCount = await countSignals(service, appUserId)
    const userConfidence = Math.min(1, signalCount / SIGNALS_FOR_FULL_CONFIDENCE)

    if (existing.data) {
      const row = existing.data as {
        id: string
        film_ids: string[]
        slot_types: string[]
        context: GauntletContext | null
        algorithm_version: string
      }
      const response: DailyGauntlet = {
        gauntletId: row.id,
        date,
        context: row.context ?? context,
        contextPredicted: false,
        films: await fetchFilmsByIds(service, row.film_ids),
        slotTypes: row.slot_types as DailyGauntlet['slotTypes'],
        userConfidence,
        refreshesRemaining: REFRESHES_PER_DAY_FREE,
        algorithmVersion: row.algorithm_version,
      }
      logInfo('gauntlet_served_cached', { user_id: appUserId, gauntlet_id: row.id })
      return jsonResponse(response)
    }

    const generated = await generateQuartet(service, appUserId, context)
    const slotTypes = slotTypesFor(signalCount)

    const insert = await service
      .from('daily_gauntlets')
      .insert({
        user_id: appUserId,
        scope: 'personal',
        date,
        film_ids: generated.films.map((f) => f.id),
        slot_types: slotTypes,
        context,
        relaxed: generated.relaxed,
        algorithm_version: ALGORITHM_VERSION,
      })
      .select('id')
      .single()

    if (insert.error) {
      // 23505: aynı anda ikinci istek satırı açtı. Yarış idempotency kısıtının
      // amaçladığı sonuçtur — yutulmuyor, loglanıp mevcut satır okunuyor.
      if (insert.error.code === '23505') {
        logInfo('gauntlet_insert_race', { user_id: appUserId, date })
        const retry = await service
          .from('daily_gauntlets')
          .select('id,film_ids,slot_types,context,algorithm_version')
          .eq('user_id', appUserId)
          .eq('scope', 'personal')
          .eq('date', date)
          .single()
        if (retry.error || !retry.data) {
          throw new Error(
            `idempotency yarışı çözülemedi: ${retry.error?.message ?? 'satır yok'}`,
          )
        }
        const row = retry.data as {
          id: string
          film_ids: string[]
          slot_types: string[]
          context: GauntletContext | null
          algorithm_version: string
        }
        const response: DailyGauntlet = {
          gauntletId: row.id,
          date,
          context: row.context ?? context,
          contextPredicted: false,
          films: await fetchFilmsByIds(service, row.film_ids),
          slotTypes: row.slot_types as DailyGauntlet['slotTypes'],
          userConfidence,
          refreshesRemaining: REFRESHES_PER_DAY_FREE,
          algorithmVersion: row.algorithm_version,
        }
        return jsonResponse(response)
      }
      throw new Error(`gauntlet kaydı başarısız: ${insert.error.message}`)
    }

    // Algoritma iç bilgisi YALNIZ logda — response'a asla girmez.
    logInfo('gauntlet_generated', {
      user_id: appUserId,
      gauntlet_id: insert.data.id,
      pool_size: generated.poolSize,
      relaxed: generated.relaxed,
      relaxations: generated.relaxations,
      context,
      film_ids: generated.films.map((f) => f.id),
    })

    const response: DailyGauntlet = {
      gauntletId: insert.data.id,
      date,
      context,
      // v0'da bağlam istemciden gelir; tahmin motoru C fazında bunu true yapar.
      contextPredicted: false,
      films: generated.films.map(toGauntletFilm),
      slotTypes,
      userConfidence,
      refreshesRemaining: REFRESHES_PER_DAY_FREE,
      algorithmVersion: ALGORITHM_VERSION,
    }
    return jsonResponse(response)
  } catch (err) {
    logError('gauntlet_generation_failed', err, { user_id: appUserId, context })
    await sentryCapture({
      message: 'generate-gauntlet: günün gauntlet üretimi başarısız',
      level: 'fatal',
      tags: { function: 'generate-gauntlet', algorithm_version: ALGORITHM_VERSION },
      extra: {
        user_id: appUserId,
        context,
        error: err instanceof Error ? err.message : String(err),
      },
    })
    return errorResponse(
      'GAUNTLET_GENERATION_FAILED',
      'Günün filmleri hazırlanamadı',
      503,
    )
  }
})
