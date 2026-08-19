/**
 * Edge Function: submit-choice — bir turdaki seçimi kaydeder (B.4)
 *
 * Katman 3'ün yazma tarafı. `generate-gauntlet` günün dörtlüsünü üretir; bu
 * fonksiyon her turda ne olduğunu ham olay olarak saklar ve turnuvayı
 * ilerletir.
 *
 * ── İstemciye ASLA gitmeyen ──────────────────────────────────────────────────
 * Skor, percentile, aday havuzu büyüklüğü, hangi eksende zıtlık kurulduğu,
 * "hangi film neden kaybetti". Bunların hepsi yalnızca logda. İstemci ne
 * olduğunu değil, SIRADA NE OLDUĞUNU öğrenir.
 *
 * ── Tur harcama kuralı (B.3'te netleşti) ─────────────────────────────────────
 *   choice   → tur biter, sonraki tura geçilir
 *   timeout  → tur biter (kazanan YOK, düşük ağırlık)
 *   neither  → TUR HARCANMAZ, iki film de reddedilir, yeni çift gelir
 *   seen     → TUR HARCANMAZ, kazanan izlenmiş sayılır, o film değişir
 *
 * `neither`/`seen` bir "yenileme"dir ve hak tüketir: Free 2/gün, Pro sınırsız.
 *
 * ── Yazılan tablolar ─────────────────────────────────────────────────────────
 *   choice_events     — her seçim (append-only, cinema_dna'nın kaynağı)
 *   duel_impressions  — "bu çift gösterildi" durumu (B.3 bilinçli olarak
 *                       buraya bıraktı: üretim yazmaz, seçim yazar)
 *   daily_gauntlets   — champion_film_id · yenilemede film_ids
 *   watchlist         — 'seen' dalında watched_at + watched_source;
 *                       'save_for_later' dalında SADECE satır (watched_at NULL)
 *
 * ── İki giriş yolu (C.9b-2) ──────────────────────────────────────────────────
 * Gövdede `action` alanı YOKSA  → seçim yolu (kilitli `ChoiceSubmission`)
 * Gövdede `action` alanı VARSA  → `save_for_later` ("Sonraya bırak")
 * Ayrım gövdenin ilk okunuşunda yapılır; iki yol birbirinin doğrulamasına
 * hiç uğramaz.
 *
 * Deploy: supabase functions deploy submit-choice
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
import {
  buildScoredPool,
  type Candidate,
  fetchCandidatesByIds,
  markWatched,
  pairKey,
  pickReplacements,
  toGauntletFilm,
} from '../_shared/gauntletCore.ts'
import {
  type ChoiceSubmission,
  type GauntletContext,
  type GauntletFilm,
  isValidChoiceSubmission,
} from '../../../types/gauntlet.ts'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

// ─── Sabitler ────────────────────────────────────────────────────────────────

/**
 * Gürültü koruması (PRODUCT_OS §3.5). Bu eşiğin altındaki yanıt "düşünülmüş
 * seçim" sayılmaz; kayıt SİLİNMEZ, yalnızca `low_confidence` ile işaretlenir.
 * B.5 ağırlıklandırırken bu alanı okur.
 */
const LOW_CONFIDENCE_LATENCY_MS = 1500

/** Aynı oturumda arka arkaya bu kadar düşük güvenli seçim → low_intent. */
const LOW_INTENT_STREAK = 3

/**
 * `latencyMs` üst sınırı (10 dk). Aşan değer CLAMP EDİLMEZ, 422 ile reddedilir
 * — sessizce veri değiştirmek yasak (`types/gauntlet.ts` B.4 notu).
 */
const MAX_LATENCY_MS = 600000

/** Tek film önerisine geçiş eşiği (PRODUCT_OS §3.5). */
const REJECTION_RATE_THRESHOLD = 0.5

/**
 * Ücretli katmanlar. Migration 021/025'in `users.subscription_tier` değer
 * kümesiyle birebir. Liste ıraksarsa Pro kullanıcı sessizce Free muamelesi
 * görür — 2_BUSINESS_MODEL §10 kural 5'in tam olarak yasakladığı şey.
 */
const PAID_TIERS = ['weekly_legacy', 'monthly', 'annual', 'lifetime']

/** app_config sözleşmesi: -1 = sınırsız (migration 021 ile aynı sentinel). */
const UNLIMITED = -1

// ─── Tipler ──────────────────────────────────────────────────────────────────

type NextStep = 'round2' | 'round3' | 'champion' | 'refresh' | 'exhausted'

/**
 * `POST /gauntlet/choice` YANITI.
 *
 * ⚠️ `types/gauntlet.ts` KİLİTLİDİR ve bu tip oraya YAZILMAZ. Kilitli sözleşme
 * `ChoiceSubmission`'ı (istek şekli) kapsar; yanıt şekli B.4'e aittir.
 *
 * `{ next, champion? }` çekirdeği prompt'tan aynen korunur. Üç alan eklenmek
 * ZORUNDAYDI, hiçbiri algoritma sızıntısı değil:
 *   - `replacement` — `neither`/`seen` sonrası yeni çift. Olmadan istemci yeni
 *     filmleri hiçbir yoldan öğrenemez: generate-gauntlet gün başına
 *     idempotenttir, yeniden çağrılırsa AYNI dörtlüyü döner.
 *   - `refreshesRemaining` / `refreshAllowed` — hak bitince istemci "yenile"yi
 *     kapatabilsin. Limit kararı sunucuda; bu alanlar yalnız sonucu bildirir.
 *   - `suggestSingleFilm` — reddetme oranı yüksek kullanıcıya tek film modu.
 *   - `gauntletId` / `algorithmVersion` — analytics için metadata.
 */
interface ChoiceResult {
  next: NextStep
  champion?: GauntletFilm
  /** `neither`/`seen`: AYNI tur, yeni çift. `round` bilinçli olarak tekrar edilir. */
  replacement?: {
    round: 1 | 2 | 3
    filmA: GauntletFilm
    filmB: GauntletFilm
  }
  /** -1 = sınırsız (Pro). */
  refreshesRemaining: number
  /** false → yenileme talebi kaydedildi ama UYGULANMADI (hak bitti). */
  refreshAllowed: boolean
  /** `next: 'exhausted'` neden verildi. */
  exhaustedReason?: 'no_candidates' | 'timeout_no_winner'
  /** Son N gauntlet'te reddetme oranı eşiği aştı. */
  suggestSingleFilm?: boolean
  /** Aynı oturumda 3 art arda düşük güvenli seçim. */
  lowIntentSession?: boolean
  /** Analytics için: bu seçim hangi gauntlet'e ait. */
  gauntletId: string
  /** Analytics için: bu seçim hangi algoritma versiyonunda alındı. */
  algorithmVersion: string
}

interface GauntletRow {
  id: string
  user_id: string | null
  film_ids: string[]
  champion_film_id: string | null
  context: GauntletContext | null
  algorithm_version: string
}

/**
 * "Sonraya bırak" isteği (C.9b-2, CTO onayı 19.08.2026).
 *
 * ── Neden burada, yeni bir Edge Function'da değil ────────────────────────────
 * Sahiplik çözümlemesi (auth.uid() → public.users.id) ve gauntlet doğrulaması
 * bu dosyada ZATEN var. Ayrı fonksiyon açmak o iki bloğu kopyalamak olurdu ve
 * ıraksadıkları anda biri diğerinin kapatmadığı bir yazma yolu açardı — 099/100
 * ile kapatılan sızıntının aynı sınıfı.
 *
 * ── Neden `action` ile ayrım ────────────────────────────────────────────────
 * `ChoiceSubmission` KİLİTLİ sözleşmedir ve `action` alanı YOKTUR. Mevcut
 * istemci gövdeleri bu alanı hiç göndermez; dispatch bu yokluğa bakar, yani
 * eski yol bit düzeyinde değişmez. Yeni dal `isValidChoiceSubmission`'a hiç
 * uğramaz — kilitli doğrulayıcı gevşetilmez.
 */
interface SaveForLaterRequest {
  action: 'save_for_later'
  gauntletId: string
  filmId: string
}

/**
 * `already_saved` bir HATA DEĞİLDİR: kullanıcı aynı şampiyonu ikinci kez
 * kaydetmiştir. 409 dönmek istemciyi hata yoluna sokardı; durum açıkça
 * bildirilir ve istemci aynı onay metnini gösterir.
 */
interface SaveForLaterResult {
  status: 'saved' | 'already_saved'
  filmId: string
}

function isSaveForLaterRequest(v: unknown): v is SaveForLaterRequest {
  if (typeof v !== 'object' || v === null) return false
  const s = v as Record<string, unknown>
  return (
    s.action === 'save_for_later' &&
    typeof s.gauntletId === 'string' &&
    s.gauntletId.length > 0 &&
    typeof s.filmId === 'string' &&
    s.filmId.length > 0
  )
}

/**
 * Entitlement okunamadı. AYRI bir sınıf çünkü davranışı ayrı: kullanıcı
 * Free'ye DÜŞÜRÜLMEZ, istek hata ile biter (2_BUSINESS_MODEL §10 kural 5).
 * Para ile ilgili bir yolda sessiz fallback en tehlikeli haliyle burada olurdu.
 */
class EntitlementError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EntitlementError'
  }
}

// ─── Girdi doğrulama ─────────────────────────────────────────────────────────

/**
 * `isValidChoiceSubmission` yalnız ŞEKİL doğrular (kilitli dosyanın kendi
 * notu). İş kuralları burada, 069'daki CHECK kısıtlarıyla BİREBİR:
 *   - latencyMs tam sayı ve ≤ 600000
 *   - film_a <> film_b                      (choice_events_distinct_films)
 *   - outcome ↔ winner tutarlılığı          (…_outcome_winner_coherence)
 *
 * Amaç ham Postgres hatasının istemciye sızmaması: kısıt ihlali burada 422
 * olur, DB'ye hiç gitmez.
 */
function validateBusinessRules(s: ChoiceSubmission): string | null {
  if (!Number.isInteger(s.latencyMs)) return 'latencyMs tam sayı olmalı'
  if (s.latencyMs > MAX_LATENCY_MS) {
    return `latencyMs üst sınırı ${MAX_LATENCY_MS} ms`
  }
  if (s.filmA === s.filmB) return 'filmA ve filmB aynı olamaz'

  if (s.outcome === 'choice' || s.outcome === 'seen') {
    if (s.winner !== s.filmA && s.winner !== s.filmB) {
      return `outcome='${s.outcome}' için winner filmA ya da filmB olmalı`
    }
    if (s.positionOfWinner === null) {
      return `outcome='${s.outcome}' için positionOfWinner zorunlu`
    }
  } else if (s.winner !== null) {
    return `outcome='${s.outcome}' için winner null olmalı`
  }
  return null
}

// ─── Entitlement (SUNUCU tarafı — istemciden gelen tier'a asla güvenilmez) ───

/**
 * Hangi app_config anahtarının okunacağı (`_pro` vs `_free`) tier sonucuna
 * BAĞLI — bu yüzden tier ile config sorgusu klasik Promise.all ile paralel
 * ATILAMAZ (henüz hangi anahtar gerektiği bilinmiyor). Bunun yerine iki
 * olası anahtar da TEK sorguda (.in) tier sorgusuyla birlikte paralel
 * çekilir; tier gelince doğru satır seçilir. İkisi de LAZY okunur, sonuç
 * hiçbir yerde cache'lenmez (CLAUDE.md kural 6).
 */
async function resolveRefreshLimit(
  service: SupabaseClient,
  appUserId: string,
): Promise<{ limit: number; tier: string }> {
  const [userRes, configRes] = await Promise.all([
    service.from('users').select('subscription_tier').eq('id', appUserId).single(),
    service
      .from('app_config')
      .select('key,value')
      .in('key', ['gauntlet_refresh_limit_free', 'gauntlet_refresh_limit_pro']),
  ])

  if (userRes.error || !userRes.data) {
    // Free'ye DÜŞÜRÜLMEZ. Bilinmeyen entitlement = hata, varsayım değil.
    throw new EntitlementError(
      `subscription_tier okunamadı: ${userRes.error?.message ?? 'satır yok'}`,
    )
  }
  if (configRes.error) {
    throw new Error(`app_config yenileme limiti okunamadı: ${configRes.error.message}`)
  }

  const tier = (userRes.data.subscription_tier as string | null) ?? 'free'
  const isPaid = PAID_TIERS.includes(tier)
  const key = isPaid ? 'gauntlet_refresh_limit_pro' : 'gauntlet_refresh_limit_free'

  const rows = (configRes.data ?? []) as { key: string; value: number }[]
  const row = rows.find((r) => r.key === key)
  if (!row) {
    throw new Error(`app_config key "${key}" not found`)
  }

  return { limit: row.value, tier }
}

// ─── Sayaçlar ────────────────────────────────────────────────────────────────

/**
 * Bu gauntlet'ta harcanan yenileme sayısı.
 *
 * Gün başına sayılabilirdi; gauntlet başına sayılıyor çünkü
 * `daily_gauntlets_user_date_uniq` gereği kullanıcı başına GÜNDE TEK gauntlet
 * var — iki sayım özdeş, bu tek sorgu ile çıkıyor.
 */
async function countRefreshesUsed(
  service: SupabaseClient,
  gauntletId: string,
): Promise<number> {
  const { count, error } = await service
    .from('choice_events')
    .select('id', { count: 'exact', head: true })
    .eq('gauntlet_id', gauntletId)
    .in('outcome', ['neither', 'seen'])

  if (error) throw new Error(`yenileme sayımı başarısız: ${error.message}`)
  return count ?? 0
}

/**
 * Oturum low_intent bayrağı.
 *
 * ── Nerede tutuluyor: HİÇBİR YERDE — her istekte TÜRETİLİYOR. ───────────────
 * `choice_events.low_confidence` (069) ve `session_id` zaten var; "son 3 olay
 * da düşük güvenli mi" sorusu bu iki kolondan tek sorguyla çıkıyor. Ayrı bir
 * kolon ya da sayaç eklemek aynı gerçeği ikinci bir yerde saklamak olurdu —
 * 069'un `duel_impressions`'tan `choice`/`latency_ms` kolonlarını çıkarma
 * gerekçesinin aynısı ("iki tabloda aynı gerçek = ıraksama").
 * `context_patterns` ise bağlam TAHMİNİ dağılımıdır, oturum kalitesi değil;
 * oraya yazmak tablonun anlamını bozardı.
 */
async function isLowIntentSession(
  service: SupabaseClient,
  sessionId: string,
): Promise<boolean> {
  const { data, error } = await service
    .from('choice_events')
    .select('low_confidence')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(LOW_INTENT_STREAK)

  if (error) throw new Error(`oturum niyet sorgusu başarısız: ${error.message}`)

  const rows = (data ?? []) as { low_confidence: boolean }[]
  return rows.length === LOW_INTENT_STREAK && rows.every((r) => r.low_confidence)
}

/**
 * Reddetme oranı — KULLANICI GEÇMİŞİ üzerinden, tek gauntlet üzerinden DEĞİL.
 *
 * PRODUCT_OS §3.5 bu sinyali "bu kullanıcı için gauntlet yanlış → tek film
 * modu" olarak tanımlar; yani kullanıcının davranış geçmişine ait bir yargıdır.
 * İlk sürümde son 5 gauntlet'in olayları sayılıyordu ve yeni kullanıcıda
 * n=3'te 2 red → 0.67 çıkıyordu: istatistiksel olarak gürültüden ayrılamayan
 * bir sayı, nadir olması gereken bir düşüş yolunu fiilen VARSAYILAN davranışa
 * çeviriyordu.
 *
 * Bu yüzden minimum örneklem şartı var: en az `minSample` outcome birikmeden
 * oran HESAPLANMAZ ve `null` döner (0 değil — "düşük oran" ile "henüz veri
 * yok" farklı şeyler, 0 dönmek ikincisini birincisi gibi gösterirdi).
 *
 * `timeout` HARİÇ: kullanıcı bir tercih bildirmemiştir, ne kabul ne red.
 * Paydaya girmesi oranı yapay olarak seyreltirdi.
 */
async function rejectionRate(
  service: SupabaseClient,
  appUserId: string,
  minSample: number,
): Promise<number | null> {
  const { data, error } = await service
    .from('choice_events')
    .select('outcome')
    .eq('user_id', appUserId)
    .in('outcome', ['choice', 'neither', 'seen'])
    .order('created_at', { ascending: false })
    .limit(minSample)

  if (error) {
    throw new Error(`reddetme oranı sorgusu başarısız: ${error.message}`)
  }

  const rows = (data ?? []) as { outcome: string }[]
  if (rows.length < minSample) return null

  const rejected = rows.filter(
    (r) => r.outcome === 'neither' || r.outcome === 'seen',
  ).length
  return rejected / rows.length
}

// ─── Yazma yardımcıları ──────────────────────────────────────────────────────

/**
 * `duel_impressions` — "bu çift bu kullanıcıya gösterildi".
 *
 * `pair_key` GENERATED column'dur, elle HESAPLANMAZ; yalnızca çakışma
 * durumunda mevcut satırı bulmak için aynı formül (least|greatest) kullanılır.
 *
 * 23505 bir hata değil, beklenen ikinci gösterimdir: yutulmuyor, `shown_count`
 * artırılıyor. Upsert kullanılamaz — PostgREST çakışmada mevcut değeri
 * ARTIRAMAZ, üzerine yazar ve sayaç 1'de donar.
 */
async function recordImpression(
  service: SupabaseClient,
  appUserId: string,
  filmA: string,
  filmB: string,
): Promise<void> {
  const insert = await service.from('duel_impressions').insert({
    user_id: appUserId,
    film_a_id: filmA,
    film_b_id: filmB,
  })

  if (!insert.error) return
  if (insert.error.code !== '23505') {
    throw new Error(`duel_impressions yazımı başarısız: ${insert.error.message}`)
  }

  const key = pairKey(filmA, filmB)
  const existing = await service
    .from('duel_impressions')
    .select('id,shown_count')
    .eq('user_id', appUserId)
    .eq('pair_key', key)
    .single()

  if (existing.error || !existing.data) {
    throw new Error(
      `duel_impressions çakışma satırı bulunamadı (${key}): ` +
        `${existing.error?.message ?? 'satır yok'}`,
    )
  }

  const row = existing.data as { id: string; shown_count: number }
  const update = await service
    .from('duel_impressions')
    .update({
      shown_count: row.shown_count + 1,
      shown_at: new Date().toISOString(),
    })
    .eq('id', row.id)

  if (update.error) {
    throw new Error(`shown_count artırılamadı: ${update.error.message}`)
  }
}

// `markWatched` (C.4'te `_shared/gauntletCore.ts`'e taşındı — submit-watch-feedback
// ile paylaşılıyor, davranış birebir korunur): watchlist.watched_at yalnızca
// NULL ise yazılır, seen dalı burada çağırır.

// ─── Tur ilerletme ───────────────────────────────────────────────────────────

/** `choice`/`timeout` sonrası sıradaki adım. Tur 3 kazananı şampiyondur. */
function advanceFrom(round: 1 | 2 | 3, hasWinner: boolean): NextStep {
  if (round === 1) return 'round2'
  if (round === 2) return 'round3'
  // Tur 3 bitti ama kazanan yok (timeout) → şampiyon UYDURULMAZ.
  return hasWinner ? 'champion' : 'exhausted'
}

async function championFilm(
  service: SupabaseClient,
  filmId: string,
): Promise<GauntletFilm> {
  const byId = await fetchCandidatesByIds(service, [filmId])
  const c = byId.get(filmId)
  if (!c) throw new Error(`şampiyon film bulunamadı: ${filmId}`)
  return toGauntletFilm(c)
}

/** Konum bias'ı: yeni çiftin ekrandaki sırası rastgele. */
function orderPair(a: Candidate, b: Candidate): [Candidate, Candidate] {
  return Math.random() < 0.5 ? [a, b] : [b, a]
}

// ─── "Sonraya bırak" ─────────────────────────────────────────────────────────

/**
 * Şampiyonu watchlist'e kaydeder. `markWatched` ile AYNI sahiplik desenini
 * kullanır ama AYNI ŞEY DEĞİLDİR:
 *
 *   markWatched      → watched_at = now, watched_source = 'gauntlet_feedback'
 *   saveForLater     → watched_at NULL, watched_source NULL
 *
 * "Kaydettim" ile "izledim" iki ayrı gerçektir. `watched_source` yalnızca
 * İZLENMİŞ satırların kaynağını anlatır (072'nin COMMENT'i); kaydetme yolunda
 * doldurulması o kolonun anlamını bozardı ve C.4'ün "dün izledin mi?" sorusunu
 * kaydedilmiş ama izlenmemiş filmler için sessizce susturabilirdi. Bu yüzden
 * CHECK kümesine YENİ LİTERAL EKLENMEZ — şema ve migration DEĞİŞMEZ.
 *
 * Yazım INSERT-only: mevcut satır varsa 23505 alınır ve DOKUNULMAZ. Önce oku-
 * sonra yaz deseni kullanılmaz çünkü yarışta iki isteğin ikisi de "satır yok"
 * görüp ikinci INSERT'te aynı 23505'e düşerdi — kısıt zaten son sözü söylüyor.
 * Ayrıca bu, `watched_at` dolu bir satırın (kullanıcı 'seen' demişti) kaydetme
 * eylemiyle SIFIRLANMASINI yapısal olarak imkânsız kılar.
 *
 * Şampiyon otomatik yazılmaz (PRODUCT_OS §3.7) — bu yol yalnızca kullanıcının
 * açık eylemiyle çalışır.
 */
async function handleSaveForLater(
  service: SupabaseClient,
  appUserId: string,
  body: SaveForLaterRequest,
): Promise<Response> {
  const gauntletRes = await service
    .from('daily_gauntlets')
    .select('id,user_id,champion_film_id')
    .eq('id', body.gauntletId)
    .maybeSingle()

  if (gauntletRes.error) {
    throw new Error(`gauntlet sorgusu başarısız: ${gauntletRes.error.message}`)
  }
  if (!gauntletRes.data) {
    return errorResponse('GAUNTLET_NOT_FOUND', 'Gauntlet bulunamadı', 404)
  }

  const gauntlet = gauntletRes.data as {
    id: string
    user_id: string | null
    champion_film_id: string | null
  }

  // Başkasının turnuvası → 404 (403 varlığı doğrulardı). `choice` dalındaki
  // sahiplik kontrolüyle birebir aynı davranış.
  if (gauntlet.user_id !== appUserId) {
    logInfo('save_for_later_owner_mismatch', {
      user_id: appUserId,
      gauntlet_id: gauntlet.id,
    })
    return errorResponse('GAUNTLET_NOT_FOUND', 'Gauntlet bulunamadı', 404)
  }

  // CTO kararı 19.08.2026: yüzey ŞAMPİYONLA SINIRLI. `film_ids` içinde olmak
  // YETMEZ — elenen filmler için bir CTA yok, olmayan ihtiyaca yüzey açılmaz.
  if (!gauntlet.champion_film_id || body.filmId !== gauntlet.champion_film_id) {
    return errorResponse(
      'UNPROCESSABLE_SUBMISSION',
      'filmId bu gauntlet\'in şampiyonu değil',
      422,
    )
  }

  const insert = await service.from('watchlist').insert({
    user_id: appUserId,
    film_id: body.filmId,
  })

  if (insert.error) {
    if (insert.error.code === '23505') {
      // UNIQUE (user_id, film_id) — film zaten listede. Mevcut satıra
      // DOKUNULMAZ; watched_at dolu olabilir ve silinmemeli.
      logInfo('save_for_later_already', {
        user_id: appUserId,
        gauntlet_id: gauntlet.id,
        film_id: body.filmId,
      })
      const result: SaveForLaterResult = {
        status: 'already_saved',
        filmId: body.filmId,
      }
      return jsonResponse(result)
    }
    throw new Error(`watchlist yazımı başarısız: ${insert.error.message}`)
  }

  logInfo('save_for_later_saved', {
    user_id: appUserId,
    gauntlet_id: gauntlet.id,
    film_id: body.filmId,
  })
  const result: SaveForLaterResult = { status: 'saved', filmId: body.filmId }
  return jsonResponse(result)
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
      logError('choice_auth_failed', err)
      return errorResponse('UNAUTHORIZED', 'Oturum doğrulanamadı', 401)
    }
    logError('choice_auth_error', err)
    await sentryCapture({
      message: 'submit-choice: kimlik çözümleme hatası',
      level: 'error',
      tags: { function: 'submit-choice' },
      extra: { error: err instanceof Error ? err.message : String(err) },
    })
    return errorResponse('AUTH_ERROR', 'Kimlik doğrulama başarısız', 500)
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch (err) {
    logError('choice_bad_json', err, { user_id: appUserId })
    return errorResponse('INVALID_INPUT', 'Geçersiz JSON gövdesi', 400)
  }

  // ── DISPATCH ───────────────────────────────────────────────────────────────
  // `action` alanının VARLIĞI ayrımı yapar. Kilitli `ChoiceSubmission`'da böyle
  // bir alan yok, yani mevcut istemci gövdeleri buraya asla düşmez ve seçim
  // yolu değişmemiş olur. Tanınmayan bir `action` sessizce seçim yoluna
  // DÜŞÜRÜLMEZ — şekil doğrulaması orada patlar ve kullanıcı anlamsız bir
  // "ChoiceSubmission geçersiz" hatası alırdı; burada açık 400 döner.
  if ((raw as { action?: unknown }).action !== undefined) {
    if (!isSaveForLaterRequest(raw)) {
      return errorResponse('INVALID_INPUT', 'Bilinmeyen action gövdesi', 400)
    }
    try {
      return await handleSaveForLater(service, appUserId, raw)
    } catch (err) {
      logError('save_for_later_failed', err, {
        user_id: appUserId,
        gauntlet_id: raw.gauntletId,
        film_id: raw.filmId,
      })
      await sentryCapture({
        message: 'submit-choice: sonraya bırakılamadı',
        level: 'error',
        tags: { function: 'submit-choice', action: 'save_for_later' },
        extra: {
          user_id: appUserId,
          gauntlet_id: raw.gauntletId,
          film_id: raw.filmId,
          error: err instanceof Error ? err.message : String(err),
        },
      })
      return errorResponse('SAVE_FOR_LATER_FAILED', 'Film kaydedilemedi', 503)
    }
  }

  // Kilitli sözleşmenin kendi doğrulayıcısı — Zod YOK (types/gauntlet.ts notu).
  if (!isValidChoiceSubmission(raw)) {
    return errorResponse(
      'INVALID_INPUT',
      'ChoiceSubmission şekli geçersiz',
      400,
    )
  }
  const submission: ChoiceSubmission = raw

  const ruleError = validateBusinessRules(submission)
  if (ruleError) {
    logInfo('choice_rule_violation', {
      user_id: appUserId,
      gauntlet_id: submission.gauntletId,
      reason: ruleError,
    })
    return errorResponse('UNPROCESSABLE_SUBMISSION', ruleError, 422)
  }

  try {
    // ── Gauntlet doğrulama + idempotency kontrolü ─────────────────────────────
    // İkisi de submission.gauntletId üzerinden bağımsız okur (gauntlet
    // doğrulanmadan ÖNCE settled sorgusu paralel başlar) — settled.data
    // yalnızca gauntlet sahiplik/varlık kontrolü GEÇTİKTEN sonra kullanılır,
    // bu yüzden başka kullanıcının turnuvasına ait olay sızmaz.
    const [gauntletRes, settled] = await Promise.all([
      service
        .from('daily_gauntlets')
        .select('id,user_id,film_ids,champion_film_id,context,algorithm_version')
        .eq('id', submission.gauntletId)
        .maybeSingle(),
      service
        .from('choice_events')
        .select('id,outcome,winner')
        .eq('gauntlet_id', submission.gauntletId)
        .eq('round', submission.round)
        .in('outcome', ['choice', 'timeout'])
        .maybeSingle(),
    ])

    if (gauntletRes.error) {
      throw new Error(`gauntlet sorgusu başarısız: ${gauntletRes.error.message}`)
    }
    if (!gauntletRes.data) {
      return errorResponse('GAUNTLET_NOT_FOUND', 'Gauntlet bulunamadı', 404)
    }

    const gauntlet = gauntletRes.data as GauntletRow
    if (gauntlet.user_id !== appUserId) {
      // Başka kullanıcının turnuvasına yazma girişimi. 404 döner — 403 varlığı
      // doğrulardı.
      logInfo('choice_gauntlet_owner_mismatch', {
        user_id: appUserId,
        gauntlet_id: gauntlet.id,
      })
      return errorResponse('GAUNTLET_NOT_FOUND', 'Gauntlet bulunamadı', 404)
    }

    const filmSet = new Set(gauntlet.film_ids)
    if (!filmSet.has(submission.filmA) || !filmSet.has(submission.filmB)) {
      return errorResponse(
        'UNPROCESSABLE_SUBMISSION',
        'filmA/filmB bu gauntlet\'e ait değil',
        422,
      )
    }

    const isAdvancing = submission.outcome === 'choice' ||
      submission.outcome === 'timeout'

    // ── IDEMPOTENCY ───────────────────────────────────────────────────────────
    // (gauntlet_id, round) için TUR İLERLETEN bir olay zaten varsa hiçbir şey
    // yazılmaz; mevcut durum döner. Bu, migration 072'deki partial UNIQUE
    // index'in uygulama tarafındaki karşılığıdır — kısıt yarışta son sözü
    // söyler (23505 aşağıda ele alınıyor), bu kontrol yaygın durumu ucuza
    // çözer.
    //
    // Sadece ikinci `choice` değil, tur kapandıktan sonra gelen GEÇ bir
    // `neither`/`seen` de buraya düşer: tur bitmiştir, geriye dönük yenileme
    // yapılamaz.
    if (settled.error) {
      throw new Error(`idempotency sorgusu başarısız: ${settled.error.message}`)
    }

    // resolveRefreshLimit ve countRefreshesUsed birbirinden bağımsız —
    // biri kullanıcı tier'ı, diğeri gauntlet'in kendi olay sayımı okur.
    const [{ limit: refreshLimit, tier }, usedBefore] = await Promise.all([
      resolveRefreshLimit(service, appUserId),
      countRefreshesUsed(service, gauntlet.id),
    ])
    const remainingOf = (used: number) =>
      refreshLimit === UNLIMITED ? UNLIMITED : Math.max(0, refreshLimit - used)

    if (settled.data) {
      const prev = settled.data as { outcome: string; winner: string | null }
      const next = advanceFrom(submission.round, prev.winner !== null)
      const result: ChoiceResult = {
        next,
        refreshesRemaining: remainingOf(usedBefore),
        refreshAllowed: refreshLimit === UNLIMITED || usedBefore < refreshLimit,
        gauntletId: gauntlet.id,
        algorithmVersion: gauntlet.algorithm_version,
      }
      if (next === 'champion' && gauntlet.champion_film_id) {
        result.champion = await championFilm(service, gauntlet.champion_film_id)
      }
      if (next === 'exhausted') result.exhaustedReason = 'timeout_no_winner'

      logInfo('choice_idempotent_replay', {
        user_id: appUserId,
        gauntlet_id: gauntlet.id,
        round: submission.round,
        settled_outcome: prev.outcome,
        submitted_outcome: submission.outcome,
      })
      return jsonResponse(result)
    }

    // ── HAM OLAY YAZIMI ───────────────────────────────────────────────────────
    // Yenileme hakkı bitmiş olsa bile olay YAZILIR: "iki de olmaz" gerçek bir
    // sinyaldir ve cinema_dna'nın kaynağıdır (069 prensibi). Hakkın bitmesi
    // olayın uygulanmasını engeller, kaydını değil.
    //
    // session_id = gauntlet_id. Bir gauntlet tek oturumdur; `ChoiceSubmission`
    // kilitli sözleşmesinde session alanı YOKTUR ve istemciden oturum kimliği
    // kabul etmek sahtelenebilir bir alan açardı.
    const lowConfidence = submission.outcome === 'timeout' ||
      submission.latencyMs < LOW_CONFIDENCE_LATENCY_MS

    const insert = await service
      .from('choice_events')
      .insert({
        user_id: appUserId,
        gauntlet_id: gauntlet.id,
        session_id: gauntlet.id,
        round: submission.round,
        film_a: submission.filmA,
        film_b: submission.filmB,
        winner: submission.winner,
        outcome: submission.outcome,
        position_of_winner: submission.positionOfWinner,
        latency_ms: submission.latencyMs,
        low_confidence: lowConfidence,
        context: gauntlet.context ?? {},
        algorithm_version: gauntlet.algorithm_version,
      })
      .select('id')
      .single()

    if (insert.error) {
      // 23505 → aynı tur için başka bir istek az önce ilerletici olay yazdı.
      // Yarışın kazananı DB'dir; yutulmuyor, loglanıp mevcut durum dönüyor.
      if (insert.error.code === '23505') {
        logInfo('choice_insert_race', {
          user_id: appUserId,
          gauntlet_id: gauntlet.id,
          round: submission.round,
        })
        const next = advanceFrom(submission.round, submission.winner !== null)
        const result: ChoiceResult = {
          next,
          refreshesRemaining: remainingOf(usedBefore),
          refreshAllowed: refreshLimit === UNLIMITED || usedBefore < refreshLimit,
          gauntletId: gauntlet.id,
          algorithmVersion: gauntlet.algorithm_version,
        }
        if (next === 'exhausted') result.exhaustedReason = 'timeout_no_winner'
        return jsonResponse(result)
      }
      throw new Error(`choice_events yazımı başarısız: ${insert.error.message}`)
    }

    // Her seçim → gösterim kaydı. Sıra önemli: olay yazıldıktan sonra.
    await recordImpression(
      service,
      appUserId,
      submission.filmA,
      submission.filmB,
    )

    // isLowIntentSession ve minSample birbirinden bağımsız — paralel.
    // rejectionRate ise minSample PARAMETRESİNİ alıyor (query .limit(minSample)),
    // bu yüzden üçü birden paralel olamaz: minSample gelmeden başlatılamaz.
    const [lowIntentSession, minSample] = await Promise.all([
      isLowIntentSession(service, gauntlet.id),
      // Eşik app_config'ten LAZY okunur — veriyle ayarlanabilir kalsın.
      getAppConfig<number>(service, 'gauntlet_rejection_min_sample'),
    ])
    const rate = await rejectionRate(service, appUserId, minSample)
    const suggestSingleFilm = rate !== null && rate > REJECTION_RATE_THRESHOLD

    const baseResult = (next: NextStep, used: number): ChoiceResult => {
      const r: ChoiceResult = {
        next,
        refreshesRemaining: remainingOf(used),
        refreshAllowed: refreshLimit === UNLIMITED || used < refreshLimit,
        gauntletId: gauntlet.id,
        algorithmVersion: gauntlet.algorithm_version,
      }
      if (suggestSingleFilm) r.suggestSingleFilm = true
      if (lowIntentSession) r.lowIntentSession = true
      return r
    }

    // ── DAL 1: TUR İLERLEYEN SONUÇLAR (choice · timeout) ──────────────────────
    if (isAdvancing) {
      const next = advanceFrom(submission.round, submission.winner !== null)
      const result = baseResult(next, usedBefore)

      if (next === 'champion' && submission.winner) {
        const update = await service
          .from('daily_gauntlets')
          .update({ champion_film_id: submission.winner })
          .eq('id', gauntlet.id)
        if (update.error) {
          throw new Error(`şampiyon yazımı başarısız: ${update.error.message}`)
        }
        // Tam obje döner — istemci ekstra fetch YAPMAZ.
        result.champion = await championFilm(service, submission.winner)
      }

      if (next === 'exhausted') {
        result.exhaustedReason = 'timeout_no_winner'
        logInfo('choice_final_timeout', {
          user_id: appUserId,
          gauntlet_id: gauntlet.id,
        })
      }

      logInfo('choice_recorded', {
        user_id: appUserId,
        gauntlet_id: gauntlet.id,
        round: submission.round,
        outcome: submission.outcome,
        low_confidence: lowConfidence,
        low_intent_session: lowIntentSession,
        rejection_rate: rate,
        next,
      })
      return jsonResponse(result)
    }

    // ── DAL 2: TUR HARCAMAYAN SONUÇLAR (neither · seen) ───────────────────────
    // Tur numarası DEĞİŞMEZ. Yenileme hakkı bu olayla birlikte tüketilir.
    const usedAfter = usedBefore + 1

    if (submission.outcome === 'seen' && submission.winner) {
      await markWatched(service, appUserId, submission.winner)
    }

    if (refreshLimit !== UNLIMITED && usedAfter > refreshLimit) {
      // Hak bitti: olay kaydedildi, YENİ ÇİFT VERİLMEZ. next hâlâ 'refresh'
      // (tur ilerlemedi), ayrımı refreshAllowed taşır.
      const result = baseResult('refresh', usedAfter)
      result.refreshAllowed = false
      result.refreshesRemaining = 0
      logInfo('choice_refresh_denied', {
        user_id: appUserId,
        gauntlet_id: gauntlet.id,
        round: submission.round,
        tier,
        limit: refreshLimit,
        used: usedAfter,
      })
      return jsonResponse(result)
    }

    // Elde kalan film: 'seen' kazananı işaretler → KAYBEDEN kalır.
    // 'neither' iki filmi de reddeder → hiçbiri kalmaz.
    const retainedId = submission.outcome === 'seen'
      ? (submission.winner === submission.filmA
        ? submission.filmB
        : submission.filmA)
      : null
    const replacedIds = submission.outcome === 'seen'
      ? [submission.winner as string]
      : [submission.filmA, submission.filmB]

    const retainedMap = await fetchCandidatesByIds(
      service,
      retainedId ? [retainedId] : [],
    )
    const retained: Candidate[] = []
    if (retainedId) {
      const c = retainedMap.get(retainedId)
      if (!c) throw new Error(`elde kalan film çözümlenemedi: ${retainedId}`)
      retained.push(c)
    }

    // ADIM 1-2-3-5 yeniden çağrılır — mantık KOPYALANMAZ, gauntletCore'dan
    // gelir (generate-gauntlet ile aynı havuz tanımı).
    const context = gauntlet.context
    if (!context) {
      throw new Error(`gauntlet bağlamı boş: ${gauntlet.id}`)
    }

    const scored = await buildScoredPool(service, appUserId, context, 'choice')
    const picked = pickReplacements(scored.pool, scored.exclusions, {
      // Dörtlünün TAMAMI bloklanır: yerine gelen film turnuvada zaten
      // bulunan bir filmle aynı olamaz.
      blockedIds: new Set(gauntlet.film_ids),
      retained,
      count: replacedIds.length,
    })

    if (!picked) {
      // Aday kalmadı. Sessizce eski çifti geri vermek YASAK — durum açıkça
      // bildirilir ve Sentry'ye düşer.
      const result = baseResult('exhausted', usedAfter)
      result.exhaustedReason = 'no_candidates'
      logError(
        'choice_replacement_exhausted',
        new Error('yerine koyulacak aday bulunamadı'),
        { user_id: appUserId, gauntlet_id: gauntlet.id, pool_size: scored.pool.length },
      )
      await sentryCapture({
        message: 'submit-choice: yenileme için aday bulunamadı',
        level: 'warning',
        tags: { function: 'submit-choice' },
        extra: {
          user_id: appUserId,
          gauntlet_id: gauntlet.id,
          round: submission.round,
          outcome: submission.outcome,
          pool_size: scored.pool.length,
        },
      })
      return jsonResponse(result)
    }

    // daily_gauntlets.film_ids güncellenir: sonraki turlar ve 21 günlük
    // "gösterildi" filtresi turnuvanın GERÇEK halini görmeli.
    const nextFilmIds = [...gauntlet.film_ids]
    picked.films.forEach((film, i) => {
      const idx = nextFilmIds.indexOf(replacedIds[i])
      if (idx === -1) {
        throw new Error(`değiştirilecek film film_ids içinde yok: ${replacedIds[i]}`)
      }
      nextFilmIds[idx] = film.id
    })

    const updateFilms = await service
      .from('daily_gauntlets')
      .update({ film_ids: nextFilmIds })
      .eq('id', gauntlet.id)

    if (updateFilms.error) {
      throw new Error(`film_ids güncellemesi başarısız: ${updateFilms.error.message}`)
    }

    const [left, right] = orderPair(
      retained[0] ?? picked.films[0],
      retained[0] ? picked.films[0] : picked.films[1],
    )

    const result = baseResult('refresh', usedAfter)
    result.replacement = {
      round: submission.round,
      filmA: toGauntletFilm(left),
      filmB: toGauntletFilm(right),
    }

    // Gevşetme/havuz detayı YALNIZ logda — response'a asla girmez.
    logInfo('choice_refreshed', {
      user_id: appUserId,
      gauntlet_id: gauntlet.id,
      round: submission.round,
      outcome: submission.outcome,
      tier,
      used: usedAfter,
      limit: refreshLimit,
      replaced: replacedIds,
      picked: picked.films.map((f) => f.id),
      relaxations: picked.relaxations,
      pool_size: scored.pool.length,
      low_intent_session: lowIntentSession,
      rejection_rate: rate,
    })
    return jsonResponse(result)
  } catch (err) {
    if (err instanceof EntitlementError) {
      // Kullanıcı Free'ye DÜŞÜRÜLMEZ, mevcut durum korunur: hiçbir şey
      // uygulanmaz, istemci yeniden dener.
      logError('choice_entitlement_failed', err, { user_id: appUserId })
      await sentryCapture({
        message: 'submit-choice: entitlement okunamadı — kullanıcı düşürülmedi',
        level: 'fatal',
        tags: { function: 'submit-choice' },
        extra: {
          user_id: appUserId,
          gauntlet_id: submission.gauntletId,
          error: err.message,
        },
      })
      return errorResponse(
        'ENTITLEMENT_UNAVAILABLE',
        'Abonelik durumu doğrulanamadı, lütfen tekrar deneyin',
        503,
      )
    }

    logError('choice_failed', err, {
      user_id: appUserId,
      gauntlet_id: submission.gauntletId,
      round: submission.round,
      outcome: submission.outcome,
    })
    await sentryCapture({
      message: 'submit-choice: seçim kaydedilemedi',
      level: 'fatal',
      tags: { function: 'submit-choice' },
      extra: {
        user_id: appUserId,
        gauntlet_id: submission.gauntletId,
        round: submission.round,
        outcome: submission.outcome,
        error: err instanceof Error ? err.message : String(err),
      },
    })
    return errorResponse('CHOICE_FAILED', 'Seçim kaydedilemedi', 503)
  }
})
