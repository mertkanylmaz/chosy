/**
 * Edge Function: generate-global-slot — günün ortak dörtlüsü (`scope = 'global'`)
 *
 * ── Bu fonksiyon neden var ───────────────────────────────────────────────────
 * Şema global slotu B.1'den (migration 069) beri destekliyor:
 *   daily_gauntlets_scope_integrity → scope='global' iken user_id/device_id NULL
 *   daily_gauntlets_global_date_uniq → günde tek global satır
 *   daily_gauntlets_global_read      → herkese açık RLS okuması
 * Eksik olan tek parça ÜRETEÇTİ. `generate-gauntlet/index.ts:114` bu boşluğu
 * zaten belgeliyordu: "generate-global-slot cron'u B.3 kapsamının dışında
 * bırakıldı". Ertelenmiş bir karardı, kayıp bir fikir değil.
 *
 * ── Yeni algoritma YOK ───────────────────────────────────────────────────────
 * Seçim mantığının tamamı `_shared/gauntletCore.ts`'ten gelir: buildScoredPool
 * (ADIM 1+2) · selectQuartet (ADIM 3) · arrangeUnseen (ADIM 5). İkinci bir
 * çekirdek yazılmadı; çekirdek yalnızca üç noktadan parametrelendi.
 *
 * ── Kişisel gauntlet'tan farkı tam olarak üç şey ─────────────────────────────
 * 1. Kullanıcı YOK  → `appUserId = null`, dışlama `fetchGlobalExclusions` ile
 *    verilir: son 21 günün global satırlarında gösterilen filmler. BAŞKA KURAL
 *    YOK (CTO kararı, 7 Ağu 2026). `duel_impressions` / `watchlist` global
 *    bağlamda tanımsız — kullanıcı bazlılar, global satırın kullanıcısı yok.
 * 2. Havuz DAR      → yalnız `core` + `trending`. `extended` HARİÇ
 *    (1_PRODUCT_OS §6.9): global slot "ortak konuşma zemini" ve paylaşım
 *    kartının dayanağı, extended'ın tanınırlık tabanı bunu taşımıyor. Kişisel
 *    slotlar extended'ı KULLANMAYA DEVAM EDER — daralan yalnız global.
 * 3. Bağlam YOK     → global satır kişisel bir bağlama ait değil. Havuz süre
 *    tavanı `duration: 'any'` (sınırsız), `context` kolonuna NULL yazılır.
 *    Uydurma bir companion/energy yazmak veriyi kirletirdi.
 *
 * ── Çağrılma biçimi ──────────────────────────────────────────────────────────
 * Deploy: supabase functions deploy generate-global-slot --no-verify-jwt
 * Cron:   migration 075, her gün 00:05 UTC (049 deseni — sabit URL, header yok)
 *
 * ⚠️ `--no-verify-jwt` bu deseni zorunlu kılıyor ve endpoint'i kimliksiz
 * çağrılabilir yapıyor (aynı durum `sync-trending`'de de var). Yazma yüzeyi
 * `daily_gauntlets_global_date_uniq` ile sınırlı: günde tek satır, ikinci çağrı
 * mevcut satırı döndürür — dışarıdan tetikleme fazladan satır ÜRETEMEZ. Kalan
 * risk yalnızca boşa havuz hesabıdır. Paylaşılan bir cron sırrı eklemek yeni
 * bir bağımlılık/desen olurdu; CTO onayı olmadan alınmadı.
 */

import {
  corsHeaders,
  errorResponse,
  getServiceClient,
  handleCors,
  jsonResponse,
  logError,
  logInfo,
} from '../_shared/gameUtils.ts'
import { requireServiceRole, unauthorizedResponse } from '../_shared/auth.ts'
import { sentryCapture } from '../_shared/sentry.ts'
import {
  arrangeUnseen,
  buildScoredPool,
  type Candidate,
  fetchGlobalExclusions,
  MAX_QUARTET_ATTEMPTS,
  selectQuartet,
  utcDateString,
} from '../_shared/gauntletCore.ts'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

// ─── Sabitler ────────────────────────────────────────────────────────────────

const ALGORITHM_VERSION = 'v0-global-random-diverse'

/**
 * Global slot havuzu. `extended` bilinçli olarak DIŞARIDA — gerekçe dosya
 * başlığında. `archive` de yok: gevşetme basamağı `relaxedTiers: null` ile
 * tamamen kapalı, havuz dolduramıyorsa satır ÜRETİLMEZ.
 */
const GLOBAL_TIERS = ['core', 'trending']

/** Global satırın dört slotu da tanım gereği `global`. */
const GLOBAL_SLOT_TYPES = ['global', 'global', 'global', 'global']

// ─── Üretim ──────────────────────────────────────────────────────────────────

interface GeneratedQuartet {
  films: Candidate[]
  relaxed: boolean
  relaxations: string[]
  poolSize: number
}

async function generateGlobalQuartet(
  service: SupabaseClient,
): Promise<GeneratedQuartet> {
  // Dışlama DIŞARIDAN verilir: appUserId null iken çekirdek bunu zorunlu kılar.
  const exclusions = await fetchGlobalExclusions(service)

  const scored = await buildScoredPool(
    service,
    null,
    { duration: 'any' },
    'global_slot',
    { tiers: GLOBAL_TIERS, relaxedTiers: null, exclusions },
  )
  const relaxations = [...scored.relaxations]

  let chosen: Candidate[] | null = null
  for (let attempt = 0; attempt < MAX_QUARTET_ATTEMPTS; attempt++) {
    const result = selectQuartet(scored.pool, scored.spread)
    if (!result) continue
    for (const label of result.relaxations) {
      if (!relaxations.includes(label)) relaxations.push(label)
    }

    // `shownPairs` global bağlamda boş → çift kontrolü etkisiz, sıra karıştırma
    // yine de uygulanır. arrangeUnseen skora göre sıralamayı ENGELLER
    // (maruz kalma bias'ı, PRODUCT_OS §6.8) — atlanamaz.
    const arranged = arrangeUnseen(result.films, scored.exclusions.shownPairs)
    if (arranged.allPairingsSeen) {
      // Bugün ULAŞILAMAZ: `fetchGlobalExclusions` `shownPairs`'i tanım gereği
      // boş döndürür. Yine de sessizce yutulmuyor — o küme ileride dolarsa
      // (ör. global çift geçmişi tutulmaya başlanırsa) çift kontrolünün
      // etkisiz kaldığı BURADAN görülür, yoksa sessizce kaybolurdu.
      logInfo('global_slot_all_pairings_seen', {
        attempt: attempt + 1,
        film_ids: arranged.films.map((f) => f.id),
      })
    }
    chosen = arranged.films
    break
  }

  if (!chosen) {
    throw new Error(
      `çeşitlilik kuralları ${MAX_QUARTET_ATTEMPTS} denemede karşılanamadı — ` +
        `havuz ${scored.pool.length}`,
    )
  }

  return {
    films: chosen,
    relaxed: relaxations.length > 0,
    relaxations,
    poolSize: scored.pool.length,
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', 'POST bekleniyor', 405)
  }

  /**
   * Service-role kapısı (C.0b). Çağıran `global-slot-daily` cron'udur —
   * bir kullanıcı değil, sistemin kendisi. Bu yüzden `requireUser` DEĞİL.
   *
   * `verify_jwt = false` olduğu için gateway hiçbir doğrulama yapmıyor;
   * doğrulama tamamen burada. Gerekçenin tamamı: `_shared/auth.ts`.
   */
  const svc = await requireServiceRole(req)
  if (!svc.ok) return unauthorizedResponse(svc, corsHeaders)

  const service = getServiceClient()
  const date = utcDateString()

  try {
    // ── Idempotency: günde tek global satır ─────────────────────────────────
    // daily_gauntlets_global_date_uniq bunu şemada da garantiliyor; buradaki
    // okuma ikinci çağrının boşuna havuz hesaplamasını engeller.
    const existing = await service
      .from('daily_gauntlets')
      .select('id,film_ids')
      .eq('scope', 'global')
      .eq('date', date)
      .maybeSingle()

    if (existing.error) {
      throw new Error(`mevcut global satır sorgusu başarısız: ${existing.error.message}`)
    }

    if (existing.data) {
      const row = existing.data as { id: string; film_ids: string[] }
      logInfo('global_slot_already_exists', { gauntlet_id: row.id, date })
      return jsonResponse({
        created: false,
        gauntletId: row.id,
        date,
        filmIds: row.film_ids,
      })
    }

    const generated = await generateGlobalQuartet(service)

    const insert = await service
      .from('daily_gauntlets')
      .insert({
        user_id: null,
        device_id: null,
        scope: 'global',
        date,
        film_ids: generated.films.map((f) => f.id),
        slot_types: GLOBAL_SLOT_TYPES,
        // Global satır kişisel bir bağlama ait değil — uydurma bağlam YAZILMAZ.
        context: null,
        relaxed: generated.relaxed,
        algorithm_version: ALGORITHM_VERSION,
      })
      .select('id')
      .single()

    if (insert.error) {
      // 23505: aynı anda ikinci tetikleme satırı açtı (cron + elle çağrı).
      // Yarış, global_date_uniq kısıtının AMAÇLADIĞI sonuçtur — yutulmuyor,
      // loglanıp mevcut satır döndürülüyor.
      if (insert.error.code === '23505') {
        logInfo('global_slot_insert_race', { date })
        const retry = await service
          .from('daily_gauntlets')
          .select('id,film_ids')
          .eq('scope', 'global')
          .eq('date', date)
          .single()
        if (retry.error || !retry.data) {
          throw new Error(
            `idempotency yarışı çözülemedi: ${retry.error?.message ?? 'satır yok'}`,
          )
        }
        const row = retry.data as { id: string; film_ids: string[] }
        return jsonResponse({
          created: false,
          gauntletId: row.id,
          date,
          filmIds: row.film_ids,
        })
      }
      throw new Error(`global satır kaydı başarısız: ${insert.error.message}`)
    }

    logInfo('global_slot_generated', {
      gauntlet_id: insert.data.id,
      date,
      pool_size: generated.poolSize,
      relaxed: generated.relaxed,
      relaxations: generated.relaxations,
      film_ids: generated.films.map((f) => f.id),
    })

    return jsonResponse({
      created: true,
      gauntletId: insert.data.id,
      date,
      filmIds: generated.films.map((f) => f.id),
    })
  } catch (err) {
    // Sessiz fallback YASAK: yarım ya da uydurma dörtlü yazmak yerine satır
    // ÜRETİLMEZ ve hata Sentry'ye fatal olarak düşer. generate-gauntlet'ın
    // ADIM 0 dalı bu durumda "hazırlanıyor" davranışını sürdürür.
    logError('global_slot_generation_failed', err, { date })
    await sentryCapture({
      message: 'generate-global-slot: günün global slotu üretilemedi',
      level: 'fatal',
      tags: { function: 'generate-global-slot', algorithm_version: ALGORITHM_VERSION },
      extra: {
        date,
        error: err instanceof Error ? err.message : String(err),
      },
    })
    return errorResponse(
      'GLOBAL_SLOT_GENERATION_FAILED',
      'Günün global slotu hazırlanamadı',
      503,
    )
  }
})
