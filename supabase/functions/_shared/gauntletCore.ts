/**
 * Gauntlet aday üretim çekirdeği — ADIM 1 / 2 / 3 / 5 (B.3).
 *
 * ── Bu dosya neden var ───────────────────────────────────────────────────────
 * B.3'te tüm boru hattı `generate-gauntlet/index.ts` içindeydi. B.4
 * (submit-choice) `neither` ve `seen` dallarında AYNI mantığı çağırmak zorunda:
 * tur harcanmadan yeni aday seçilecek. `index.ts` doğrudan import edilemez —
 * içindeki `Deno.serve` çağrısı import anında ikinci bir sunucu kurar. Mantığı
 * kopyalamak ise iki ıraksayan algoritma üretirdi.
 *
 * Bu yüzden çekirdek `_shared/` altına taşındı. Yeni bir desen DEĞİL: feedback,
 * confidence, dnaCalc, spotlightLetters aynı şekilde paylaşılıyor.
 *
 * ── Katman izolasyonu bozulmadı ──────────────────────────────────────────────
 * Algoritma hâlâ tek yerde. `types/gauntlet.ts` sözleşmesi bu dosyadan
 * ETKİLENMEZ: buradaki `Candidate` sunucu içi bir tiptir, istemciye asla
 * gitmez — skor, percentile, havuz büyüklüğü response'a sızmaz.
 */

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { getAppConfig, logInfo } from './gameUtils.ts'
import { sentryCapture } from './sentry.ts'
import type {
  GauntletContext,
  GauntletFilm,
  OklchColor,
} from '../../../types/gauntlet.ts'

// ─── Sabitler ────────────────────────────────────────────────────────────────

/**
 * Bağlam süre tavanı (dakika). 999 bir tavan DEĞİL, "sınırsız" sentinel'idir —
 * çarpan olarak kullanılması yasak (migration 071 gerekçesi).
 */
export const CONTEXT_MAX_RUNTIME: Record<GauntletContext['duration'], number> = {
  short: 110,
  medium: 150,
  any: 999,
}

export const ACTIVE_TIERS = ['core', 'extended', 'trending']
/** Son çare gevşetmesi. archive migration 050 ile normalde tamamen dışlanır. */
export const RELAXED_TIERS = [...ACTIVE_TIERS, 'archive']

export const SHOWN_COOLDOWN_DAYS = 21
export const REJECTED_COOLDOWN_DAYS = 45

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
export const MAX_QUARTET_ATTEMPTS = 5
/** Aynı kural setinde farklı ağırlıklı karıştırma denemesi. */
const SHUFFLES_PER_RULESET = 3

// ─── Tipler ──────────────────────────────────────────────────────────────────

/** ADIM 1 sonrası aday. profile_vector yalnız NOT NULL kontrolü için kullanılır. */
export interface Candidate {
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
  /**
   * Poster hâkim rengi (C.2b). Puanlamaya GİRMEZ — yalnız response'a taşınır.
   * NULL = henüz hesaplanmadı ya da poster kalitesi yetersizdi (migration 084).
   */
  dominantColor: OklchColor | null
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
  release_date: string | null
  /** jsonb. Şekli migration 084 + 085 CHECK'i garantiler; burada yeniden
   * doğrulanmaz, clamp EDİLMEZ — sınırlar DB tarafında. */
  dominant_color: OklchColor | null
}

interface PoolRow {
  films: FilmRow | null
}

export interface DiversityRules {
  language: boolean
  genre: boolean
  decade: boolean
}

/** ADIM 3'te ölçülen süre yayılımı eşikleri (quantile, oran DEĞİL). */
export interface SpreadThresholds {
  low: number
  high: number
}

export interface Exclusions {
  watched: Set<string>
  recentlyShown: Set<string>
  recentlyRejected: Set<string>
  shownPairs: Set<string>
}

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

export function utcDateString(offsetDays = 0): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

export function utcTimestamp(offsetDays: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offsetDays)
  return d.toISOString()
}

/** duel_impressions.pair_key ile birebir: least(a,b) || '|' || greatest(a,b). */
export function pairKey(a: string, b: string): string {
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

function rowToCandidate(f: FilmRow): Candidate | null {
  if (!f.poster_url || f.runtime === null || f.year === null) return null
  return {
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
    dominantColor: f.dominant_color ?? null,
    score: 0,
  }
}

const FILM_COLUMNS =
  'id,title,year,runtime,poster_url,director,genres,original_language,' +
  'imdb_votes,vote_average,release_date,dominant_color'

// ─── DÜELLO-UYGUNLUK (C.0e) ──────────────────────────────────────────────────
// Bu üç yardımcı YALNIZCA havuz kurarken (`fetchPool`) uygulanır.
// `fetchCandidatesByIds` bunları ÇAĞIRMAZ — gerekçe orada yazılı.

/**
 * 2A — tanınırlık sinyallerinin ikisi de yok.
 *
 * `rowToCandidate` normalizasyonundan SONRA çalışır: orada `imdb_votes = 0` ve
 * `vote_average = 0` zaten `null`a çevrilmiştir. Bu yüzden burada `0`
 * kontrolü tekrarlanmaz — sentinel kuralı tek yerde, normalizasyonda.
 */
function recognitionMissing(c: Candidate): boolean {
  return c.imdbVotes === null && c.voteAverage === null
}

/**
 * 1A — film vizyona girmiş mi.
 *
 * `cutoff` istek başında BİR KEZ hesaplanır ve hem PostgREST `.lte()`
 * koşuluna hem buraya aynı değer olarak geçer. İki ayrı `now()` çağrısı,
 * gün dönümünde sunucu filtresi ile bellek kontrolünün ayrışmasına yol açar —
 * dar bir pencere ama sonradan teşhisi zor.
 */
function releasedBy(f: FilmRow, cutoff: string): boolean {
  return f.release_date !== null && f.release_date <= cutoff
}

/** ADIM 1 düello-uygunluk kapısı: 1A + 2A. */
function isDuelEligible(f: FilmRow, c: Candidate, cutoff: string): boolean {
  return releasedBy(f, cutoff) && !recognitionMissing(c)
}

/**
 * Düello-uygunluk eşiği: bugünün UTC tarihi (`YYYY-MM-DD`).
 * `release_date` bir DATE kolonu, karşılaştırma da tarih düzeyinde yapılır.
 */
export function duelEligibilityCutoff(): string {
  return utcDateString()
}

export function toGauntletFilm(c: Candidate): GauntletFilm {
  const film: GauntletFilm = {
    id: c.id,
    title: c.title,
    year: c.year,
    runtime: c.runtime,
    posterUrl: c.posterUrl,
  }
  // C.2b: `dominantColor` sözleşmede OPSİYONEL (`OklchColor`, `| null` DEĞİL).
  // Renk yoksa alan hiç eklenmez — `null` göndermek tipi yalanlar ve
  // istemcide gereksiz narrowing doğurur. Alanın yokluğu istemcide sessiz
  // fallback değil: LightBleed bunu açık 'ink' dalı olarak ele alır.
  if (c.dominantColor) film.dominantColor = c.dominantColor
  return film
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
  service: SupabaseClient,
  maxRuntime: number,
  tiers: string[],
  cutoff: string,
): Promise<Candidate[]> {
  const rows: PoolRow[] = []

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await service
      .from('film_profiles')
      .select(`films!inner(${FILM_COLUMNS})`)
      .not('profile_vector', 'is', null)
      .not('films.poster_url', 'is', null)
      .not('films.runtime', 'is', null)
      .not('films.year', 'is', null)
      .not('films.release_date', 'is', null)
      .lte('films.release_date', cutoff)
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

  // Sunucu tarafı `release_date` koşulu ile buradaki `isDuelEligible` aynı
  // `cutoff`u kullanır. Çift kontrol kasıtlı: `poster_url`/`runtime`/`year`
  // de hem sorguda hem `rowToCandidate`'te doğrulanıyor, aynı desen.
  // `recognition_missing` yalnızca burada elenir — sunucuda ifade edilebilirdi
  // (`imdb_votes.gt.0,vote_average.gt.0`) ama o, sentinel kuralını ikinci bir
  // yerde yeniden tanımlamak olurdu.
  const candidates: Candidate[] = []
  for (const row of rows) {
    if (!row.films) continue
    const c = rowToCandidate(row.films)
    if (c && isDuelEligible(row.films, c, cutoff)) candidates.push(c)
  }
  return candidates
}

/**
 * Belirli film id'lerini Candidate olarak getirir — havuz filtrelerinden
 * BAĞIMSIZ.
 *
 * B.4'te elde tutulan film (`seen` dalında kaybeden) çeşitlilik kurallarının
 * karşılaştırma tarafında durur, ama havuzda BULUNMAZ: bugünün gauntlet'ında
 * gösterildiği için `recentlyShown` onu zaten elemiştir. Havuzdan okumaya
 * çalışmak sessizce `undefined` üretir ve yönetmen/tür kuralı çalışmaz.
 *
 * ⚠️ **Düello-uygunluk kapısı (`isDuelEligible`) burada UYGULANMAZ.**
 * `chosy-conventions` → "Seçim filtresi ile çözümleme yolu ayrıdır": bir film
 * havuza girmeye uygun olmayabilir, ama bir kez gösterildiyse sonradan
 * filtreye takılsa bile çözülebilir kalmalıdır. `daily_gauntlets` kalıcıdır;
 * geçmiş bir gauntlet'in şampiyonu bugünkü filtre kurallarıyla yeniden
 * değerlendirilmez. Filtre burada uygulanırsa `championFilm()` ve `seen`/
 * `neither` dalındaki elde-kalan çözümlemesi throw eder — filtre kuralları
 * her sertleştiğinde geçmiş gauntlet'ler kırılır ve Pro arşiv özelliği
 * taban aldığı veriyle birlikte çöker.
 */
export async function fetchCandidatesByIds(
  service: SupabaseClient,
  ids: string[],
): Promise<Map<string, Candidate>> {
  if (ids.length === 0) return new Map()

  const { data, error } = await service
    .from('films')
    .select(FILM_COLUMNS)
    .in('id', ids)

  if (error) throw new Error(`film getirme başarısız: ${error.message}`)

  // `FILM_COLUMNS` bir sabit değil değişken olduğu için PostgREST kolonları
  // statik çözemiyor ve `GenericStringError[]` çıkarıyor. `unknown` üzerinden
  // dönüştürme fetchPool'daki `as unknown as PoolRow[]` ile aynı desen.
  const byId = new Map<string, Candidate>()
  for (const row of (data ?? []) as unknown as FilmRow[]) {
    const c = rowToCandidate(row)
    if (c) byId.set(c.id, c)
  }
  return byId
}

/** İzlenen · son 21 gün gösterilen · son 45 gün reddedilen · gösterilmiş çiftler. */
export async function fetchExclusions(
  service: SupabaseClient,
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

/**
 * Global slotun dışlama kümesi: son 21 günün `scope = 'global'` satırlarında
 * gösterilmiş filmler. BAŞKA KURAL YOK (CTO kararı, 7 Ağu 2026).
 *
 * Diğer üç küme BİLİNÇLİ OLARAK boş kalır — üçü de KULLANICI bazlıdır ve
 * global satırın kullanıcısı yoktur:
 *   - `watched`          → "kimin izlediği" sorusunun global karşılığı yok
 *   - `recentlyRejected` → aynı şekilde kişisel; toplu (agregat) reddetme
 *                          dışlaması Faz F'nin işi, bugün ERKEN
 *   - `shownPairs`       → `duel_impressions` kullanıcı/cihaz bazlı
 * Boş küme burada sessiz bir fallback DEĞİL, tanımın kendisidir.
 *
 * `SHOWN_COOLDOWN_DAYS` yeniden kullanılır: pencere kullanıcı bazlı filtreyle
 * AYNI. Global için ayrı bir sabit uydurmak iki gerçek üretirdi.
 */
export async function fetchGlobalExclusions(
  service: SupabaseClient,
): Promise<Exclusions> {
  const { data, error } = await service
    .from('daily_gauntlets')
    .select('film_ids')
    .eq('scope', 'global')
    .gte('date', utcDateString(-SHOWN_COOLDOWN_DAYS))

  if (error) {
    throw new Error(`global dışlama sorgusu başarısız: ${error.message}`)
  }

  const recentlyShown = new Set<string>()
  for (const r of (data ?? []) as { film_ids: string[] }[]) {
    for (const id of r.film_ids ?? []) recentlyShown.add(id)
  }

  return {
    watched: new Set(),
    recentlyShown,
    recentlyRejected: new Set(),
    shownPairs: new Set(),
  }
}

/**
 * Bir filmi izlenmiş işaretler — `watchlist.watched_at` yalnızca NULL ise
 * yazılır.
 *
 * Zaten `watched_at` dolu olan satıra DOKUNULMAZ: kullanıcının gerçek izleme
 * tarihi bugünün tarihiyle ezilirse geri getirilemez. Bu bir fallback değil,
 * idempotency kuralıdır — ve loglanır.
 *
 * submit-choice (`seen` dalı) ve submit-watch-feedback (C.4, `loved`/`ok`/
 * `abandoned`) ikisi de bu fonksiyonu çağırır — davranış tek yerde, iki
 * çağıran arasında ıraksama riski yok.
 */
export async function markWatched(
  service: SupabaseClient,
  appUserId: string,
  filmId: string,
): Promise<void> {
  const existing = await service
    .from('watchlist')
    .select('id,watched_at')
    .eq('user_id', appUserId)
    .eq('film_id', filmId)
    .maybeSingle()

  if (existing.error) {
    throw new Error(`watchlist okuması başarısız: ${existing.error.message}`)
  }

  const now = new Date().toISOString()

  if (!existing.data) {
    const insert = await service.from('watchlist').insert({
      user_id: appUserId,
      film_id: filmId,
      watched_at: now,
      watched_source: 'gauntlet_feedback',
    })
    if (insert.error) {
      throw new Error(`watchlist yazımı başarısız: ${insert.error.message}`)
    }
    return
  }

  const row = existing.data as { id: string; watched_at: string | null }
  if (row.watched_at) {
    logInfo('watchlist_already_watched', {
      user_id: appUserId,
      film_id: filmId,
      watched_at: row.watched_at,
    })
    return
  }

  const update = await service
    .from('watchlist')
    .update({ watched_at: now, watched_source: 'gauntlet_feedback' })
    .eq('id', row.id)

  if (update.error) {
    throw new Error(`watchlist güncellemesi başarısız: ${update.error.message}`)
  }
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
export function respectsRules(
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

/** Gevşetme merdiveni. Sıra spec'te sabit: dil → tür → on yıl. */
const RULE_LADDER: { rules: DiversityRules; label: string }[] = [
  { rules: { language: true, genre: true, decade: true }, label: 'strict' },
  { rules: { language: false, genre: true, decade: true }, label: 'language' },
  { rules: { language: false, genre: false, decade: true }, label: 'genre' },
  { rules: { language: false, genre: false, decade: false }, label: 'decade' },
]

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

export interface QuartetResult {
  films: Candidate[]
  relaxations: string[]
}

/**
 * Süre yayılımı en son bırakılır; havuzun kendi dağılımından ölçüldüğü için
 * onu düşürmek "kural karşılanamıyor" demektir, "kural gereksiz" değil.
 */
export function selectQuartet(
  pool: Candidate[],
  spread: SpreadThresholds | null,
): QuartetResult | null {
  const ladder: { rules: DiversityRules; spread: SpreadThresholds | null; label: string }[] =
    RULE_LADDER.map((s) => ({ rules: s.rules, spread, label: s.label }))

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

/**
 * B.4 — TUR HARCAMADAN yerine koyma (`neither` / `seen`).
 *
 * Dörtlü seçimiyle aynı kural merdivenini kullanır, sadece hedef 4 değil
 * `count` filmdir ve kurallar `retained` (elde kalan film) ile birlikte
 * değerlendirilir. Süre yayılımı UYGULANMAZ: o kural dörtlünün bütününe ait
 * bir dağılım kısıtıdır, tek bir çifte anlamlı şekilde indirgenemez.
 *
 * Çift kontrolü (ADIM 5) burada da yapılır — yeni çift daha önce gösterilmiş
 * bir kombinasyona denk gelmemeli. Denk gelirse son çare olarak kabul edilir
 * ve `duplicate_pair` ile raporlanır; boş dönmek yasak.
 */
export function pickReplacements(
  pool: Candidate[],
  exclusions: Exclusions,
  opts: { blockedIds: Set<string>; retained: Candidate[]; count: number },
): QuartetResult | null {
  const available = pool.filter((c) => !opts.blockedIds.has(c.id))
  if (available.length < opts.count) return null

  const relaxations: string[] = []
  let seenPairFallback: Candidate[] | null = null

  for (const step of RULE_LADDER) {
    for (let i = 0; i < SHUFFLES_PER_RULESET; i++) {
      const picked: Candidate[] = []
      for (const c of weightedShuffle(available)) {
        if (picked.length === opts.count) break
        if (!respectsRules([...opts.retained, ...picked], c, step.rules)) continue
        picked.push(c)
      }
      if (picked.length !== opts.count) continue

      const pair = [...opts.retained, ...picked]
      // Çift kontrolü yalnız gerçekten bir ÇİFT oluştuğunda anlamlı.
      if (pair.length !== 2) return { films: picked, relaxations }

      if (!exclusions.shownPairs.has(pairKey(pair[0].id, pair[1].id))) {
        return { films: picked, relaxations }
      }
      if (!seenPairFallback) seenPairFallback = picked
    }
    if (step.label !== 'strict') relaxations.push(step.label)
  }

  if (seenPairFallback) {
    relaxations.push('duplicate_pair')
    return { films: seenPairFallback, relaxations }
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
export function arrangeUnseen(
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

// ─── ADIM 1 + 2 birleşik: puanlanmış havuz ───────────────────────────────────

export interface ScoredPool {
  pool: Candidate[]
  exclusions: Exclusions
  spread: SpreadThresholds | null
  relaxations: string[]
}

/**
 * `buildScoredPool` çağrı yerine göre değişen üç noktası. Üçü de OPSİYONEL ve
 * varsayılanları B.3/B.4 davranışını birebir korur — `generate-gauntlet` ve
 * `submit-choice` çağrıları bu parametreleme sonrası DEĞİŞMEDİ.
 */
export interface ScoredPoolOptions {
  /** ADIM 1 tier listesi. Varsayılan `ACTIVE_TIERS` (core+extended+trending). */
  tiers?: string[]
  /**
   * Gevşetme merdiveninin tier basamağı. Varsayılan `RELAXED_TIERS`.
   * `null` → tier gevşetmesi YOK; havuz yetersizse fonksiyon throw eder.
   * Global slot bunu kullanır: aynı listeyi ikinci kez çekip yanıltıcı bir
   * "archive ile genişletildi" uyarısı üretmek yerine basamak atlanır.
   */
  relaxedTiers?: string[] | null
  /**
   * Dışlama kümesi. Varsayılan `fetchExclusions(service, appUserId)`.
   * Global slot `fetchGlobalExclusions(service)` sonucunu geçirir.
   */
  exclusions?: Exclusions
}

/**
 * ADIM 1 (sert filtre + gevşetme merdiveni) → ADIM 2 (tanınırlık) →
 * süre yayılımı eşikleri.
 *
 * `generate-gauntlet`, `submit-choice` ve `generate-global-slot` bu fonksiyonun
 * AYNI çıktısını kullanır; üç tarafın havuz tanımı ıraksayamaz. İkinci bir
 * kopya çekirdek YAZILMAZ — değişen tek şey `opts` ile verilen üç nokta.
 *
 * `appUserId` **null olabilir**: global slotun kullanıcısı yoktur. Null iken
 * `opts.exclusions` ZORUNLUDUR — aksi halde fonksiyon "dışlama yok" moduna
 * sessizce düşerdi, bu yüzden throw eder.
 *
 * `context` yalnızca `duration` alanını okur (süre tavanı). Tam
 * `GauntletContext` istemek, global çağrıyı anlamsız `companion`/`energy`
 * değerleri uydurmaya zorlardı. İki mevcut çağrı yeri tam nesne geçiyor,
 * yapısal olarak uyumlu.
 *
 * `logPrefix` yalnız log olayı adını ayırır — davranış farkı yaratmaz.
 */
export async function buildScoredPool(
  service: SupabaseClient,
  appUserId: string | null,
  context: Pick<GauntletContext, 'duration'>,
  logPrefix: string,
  opts: ScoredPoolOptions = {},
): Promise<ScoredPool> {
  // app_config LAZY okunur — modül seviyesinde cache YOK. Anahtar eksikse
  // getAppConfig throw eder; kod içi sabitle sessizce devam edilmez.
  const [bandLow, bandHigh, spreadLowQ, spreadHighQ] = await Promise.all([
    getAppConfig<number>(service, 'recognition_band_low'),
    getAppConfig<number>(service, 'recognition_band_high'),
    getAppConfig<number>(service, 'runtime_spread_low_quantile'),
    getAppConfig<number>(service, 'runtime_spread_high_quantile'),
  ])

  const maxRuntime = CONTEXT_MAX_RUNTIME[context.duration]
  const tiers = opts.tiers ?? ACTIVE_TIERS
  // `undefined` = parametre verilmedi → varsayılan. `null` = basamak kapalı.
  const relaxedTiers = opts.relaxedTiers === undefined
    ? RELAXED_TIERS
    : opts.relaxedTiers

  let exclusions: Exclusions
  if (opts.exclusions) {
    exclusions = opts.exclusions
  } else if (appUserId === null) {
    throw new Error(
      'buildScoredPool: appUserId null iken opts.exclusions zorunlu — ' +
        'dışlamasız havuz sessiz fallback olur',
    )
  } else {
    exclusions = await fetchExclusions(service, appUserId)
  }

  // ── ADIM 1 — gevşetme merdiveni: cooldown → tier ────────────────────────────
  const relaxations: string[] = []
  let pool: Candidate[] = []

  // C.0e — düello-uygunluk eşiği istek başında BİR KEZ. Aşağıdaki iki
  // `fetchPool` çağrısı da aynı değeri kullanır; ayrı `now()` hesaplanmaz.
  const cutoff = duelEligibilityCutoff()

  const rawPool = await fetchPool(service, maxRuntime, tiers, cutoff)
  logInfo(`${logPrefix}_pool_eligible`, {
    user_id: appUserId,
    pool_size: rawPool.length,
    cutoff,
    tiers,
    max_runtime: maxRuntime,
  })
  pool = rawPool.filter(
    (c) =>
      !exclusions.watched.has(c.id) &&
      !exclusions.recentlyShown.has(c.id) &&
      !exclusions.recentlyRejected.has(c.id),
  )

  if (pool.length < 4) {
    relaxations.push('cooldown')
    logInfo(`${logPrefix}_relax_cooldown`, {
      user_id: appUserId,
      pool_after_cooldown: pool.length,
      pool_before_cooldown: rawPool.length,
    })
    // İzlenen film asla geri gelmez — gevşeyen yalnız cooldown'lar.
    pool = rawPool.filter((c) => !exclusions.watched.has(c.id))
  }

  if (pool.length < 4 && relaxedTiers) {
    relaxations.push('tier')
    logInfo(`${logPrefix}_relax_tier`, { user_id: appUserId, pool_size: pool.length })
    await sentryCapture({
      // Metin BİLİNÇLİ olarak değiştirilmedi: Sentry issue gruplaması mesaja
      // bağlı. Ulaşılabilir tek gevşetme hâlâ archive'dır — global slot bu
      // basamağı `relaxedTiers: null` ile tamamen kapatır.
      message: `${logPrefix}: aday havuzu archive tier ile genişletildi`,
      level: 'warning',
      tags: { function: logPrefix },
      extra: {
        user_id: appUserId,
        pool_size: pool.length,
        context,
        relaxed_tiers: relaxedTiers,
      },
    })
    const relaxedPool = await fetchPool(service, maxRuntime, relaxedTiers, cutoff)
    pool = relaxedPool.filter((c) => !exclusions.watched.has(c.id))
  }

  if (pool.length < 4) {
    // Sessiz fallback YASAK: boş/eksik liste dönmek yerine hata yükseltilir.
    throw new Error(
      `aday havuzu 4 filmden küçük (${pool.length}) — bağlam: ` +
        JSON.stringify(context),
    )
  }

  // ── ADIM 2 — tanınırlık puanı ───────────────────────────────────────────────
  applyRecognitionScores(pool, bandLow, bandHigh)

  // ── ADIM 3 — süre yayılımı eşikleri (ORAN DEĞİL QUANTILE) ───────────────────
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
    logInfo(`${logPrefix}_relax_runtime_spread`, {
      user_id: appUserId,
      reason: low >= high ? 'degenerate_distribution' : 'empty_side',
      pool_size: pool.length,
      quantile_low: low,
      quantile_high: high,
      short_count: shortCount,
      long_count: longCount,
    })
  }

  return { pool, exclusions, spread, relaxations }
}
