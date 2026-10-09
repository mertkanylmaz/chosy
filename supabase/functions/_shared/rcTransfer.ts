/**
 * revenuecat-webhook — TRANSFER olayı (Sprint 7).
 *
 * ── Sorun ────────────────────────────────────────────────────────────────────
 * Anonim kullanıcının (A) alımı `Purchases.logIn(B)` ile B'ye taşındığında
 * RevenueCat yalnız TRANSFER gönderir. Bu dal eskiden yalnız log yazıyordu:
 * B'nin `subscriptions` satırı oluşmuyor, `users.subscription_tier` yazılmıyor
 * ve 1b birleştirmesi (122 `merge_anonymous_user`) A'nın `public.users`
 * satırını sildiğinde A'nın abonelik satırı da CASCADE ile gidiyordu. Sunucu,
 * bir sonraki RENEWAL'a kadar B'yi Free görüyordu.
 *
 * ── Payload neden yetmiyor ───────────────────────────────────────────────────
 * RC dokümanı (event-types-and-fields, 3 Eki 2026): TRANSFER yalnız Common +
 * Transfer alan gruplarını taşır — `transferred_from[]`, `transferred_to[]`,
 * opsiyonel `store`/`environment`. `app_user_id`, `product_id`,
 * `expiration_at_ms` YOK. Abonelik durumu RC REST'ten çekilir
 * (`GET /v1/subscribers/{id}`).
 *
 * ── Karar ağacı (her `transferred_to` id'si için, sırayla) ───────────────────
 *   (a) `$RCAnonymousID` / UUID değil / `auth.users`'ta yok
 *       → 200 + Sentry warning, REST ÇAĞRILMAZ. Retry bunu düzeltmez.
 *   (b) `auth.users`'ta VAR, `public.users` satırı YOK (giriş yarışı:
 *       istemcinin `ensureAppUser()` upsert'i henüz yazmadı)
 *       → 500, RC retry eder (en fazla 5 kez, fırtına yok).
 *   (c) `public.users` çözüldü → RC REST → `applyEntitlement`.
 *       Aktif `chosy_plus` entitlement'ı yoksa hiçbir şey yazılmaz (info).
 *
 * ── İdempotency ──────────────────────────────────────────────────────────────
 * Olay içeriği değil, RC'nin O ANKİ durumu yazılır. Aynı TRANSFER iki kez
 * gelirse aynı değerler tekrar yazılır; sıra karışırsa (TRANSFER retry'ı
 * EXPIRATION'dan sonra) da güncel durum yazıldığı için sonuç doğrudur.
 * `rc_event_id` tablosu bu yüzden gerekmiyor.
 *
 * Saf modül: import yalnız saf kardeş modülden. Dış dünya (DB, auth, RC,
 * Sentry) `TransferDeps` ile enjekte edilir — Deno testi sahte bağımlılıkla
 * okur, index.ts gerçek adaptörü verir.
 */

import { isUuid } from './rcAuthUser.ts'
import type { RcEnvironment } from './rcEnvironment.ts'
import { mapProductToTier, TIER_TO_PLAN } from './rcProductMap.ts'

/**
 * RC entitlement kimliği. İstemci sabitiyle (`constants/subscriptionPlans.ts`
 * → `RC_ENTITLEMENT_ID`) ve `subscriptions.entitlement_id` kolon
 * varsayılanıyla (105) aynı değer. INITIAL_PURCHASE dalı kolonu yazmaz,
 * varsayılana güvenir; upsert'te açıkça yazılması aynı değeri üretir ve
 * 089 öncesinden kalmış bir 'premium' satırını da düzeltir.
 */
export const RC_ENTITLEMENT_ID = 'chosy_plus'

// ─── Tipler ─────────────────────────────────────────────────────────────────────

/** `sentryCapture` parametresiyle yapısal olarak uyumlu. */
export type ReportParams = {
  message: string
  level: 'fatal' | 'error' | 'warning' | 'info'
  tags: Record<string, string>
  extra: Record<string, unknown>
}

export type DbError = {
  message: string
  code?: string | null
  details?: string | null
}

export type UserTierFields = {
  subscription_tier: string
  subscription_active_until: string | null
  subscription_will_renew: boolean
  updated_at: string
}

export type SubscriptionUpsertRow = {
  user_id: string
  plan: string
  status: 'active'
  expires_at: string | null
  entitlement_id: string
  /** Olayın `environment` değeri (migration 130). Varsayılan YAZILMAZ. */
  environment: RcEnvironment
}

/** `applyEntitlement`'ın yazdığı iki tablo. index.ts supabase ile doldurur. */
export interface EntitlementWriter {
  /** `users` UPDATE, `count: 'exact'`. */
  updateUserTier(
    appUserId: string,
    fields: UserTierFields,
  ): Promise<{ error: DbError | null; count: number | null }>
  /** `subscriptions` upsert, `onConflict: 'user_id'` (UNIQUE, partial değil). */
  upsertSubscription(row: SubscriptionUpsertRow): Promise<{ error: DbError | null }>
}

export type ApplyEntitlementResult =
  | { kind: 'applied'; tier: string; plan: string }
  | { kind: 'unmapped_product'; tier: string }
  | { kind: 'users_row_vanished' }
  | { kind: 'db_error'; step: 'users' | 'subscriptions'; error: DbError }

/** `GET /v1/subscribers/{id}` yanıtından kullanılan alt küme. */
export type RcSubscriberInfo = {
  entitlements: Record<
    string,
    { expires_date?: string | null; product_identifier?: string; purchase_date?: string | null }
  >
  subscriptions: Record<
    string,
    {
      unsubscribe_detected_at?: string | null
      store?: string | null
      period_type?: string | null
      purchase_date?: string | null
      expires_date?: string | null
      /** RC REST: aboneliğin sandbox'ta alındığı. TRANSFER'da environment'ın otoriter kaynağı. */
      is_sandbox?: boolean
    }
  >
}

export type ActiveEntitlement = {
  productId: string
  /** null = lifetime */
  expiresAt: string | null
  willRenew: boolean
}

export type RcRestErrorCode =
  | 'RC_SECRET_KEY_MISSING'
  | 'RC_REST_NETWORK'
  | 'RC_REST_HTTP'
  | 'RC_REST_MALFORMED'

/**
 * RC REST hatası. Mesaj ve alanlar ANAHTARI ASLA içermez — yalnız kod,
 * HTTP durumu ve hedef id. Yanıt gövdesi de bilerek alınmaz.
 */
export class RcRestError extends Error {
  constructor(
    readonly code: RcRestErrorCode,
    message: string,
    readonly httpStatus: number | null = null,
  ) {
    super(message)
    this.name = 'RcRestError'
  }
}

export interface TransferDeps {
  /** `auth.admin.getUserById`. Bulunamadı → false; diğer hatalar FIRLATIR. */
  authUserExists(authId: string): Promise<boolean>
  /** `users.auth_id` → `users.id`. Satır yok → null; sorgu hatası FIRLATIR. */
  resolveAppUserId(authId: string): Promise<string | null>
  /** RC REST. Her hata `RcRestError` olarak FIRLATIR. */
  fetchSubscriber(rcAppUserId: string): Promise<RcSubscriberInfo>
  writer: EntitlementWriter
  report(params: ReportParams): Promise<void>
  nowMs(): number
}

export type TransferIdOutcome =
  | { id: string; kind: 'unresolvable'; reason: 'rc_anonymous' | 'not_uuid' | 'auth_user_missing' }
  | { id: string; kind: 'app_user_race' }
  | { id: string; kind: 'no_active_entitlement' }
  | { id: string; kind: 'environment_missing' }
  | { id: string; kind: 'unmapped_product'; productId: string }
  | { id: string; kind: 'applied'; tier: string; plan: string }
  | { id: string; kind: 'failed'; errorCode: string }

export type TransferResult = {
  status: 200 | 500
  /** 500'de yanıt gövdesine yazılan ilk hata kodu. */
  errorCode: string | null
  outcomes: TransferIdOutcome[]
}

// ─── applyEntitlement ───────────────────────────────────────────────────────────

/**
 * Bir entitlement'ı Uzay A kullanıcısına yazar:
 *   1. `users.subscription_tier / active_until / will_renew` — yetkinin
 *      asıl taşıyıcısı.
 *   2. `subscriptions` upsert (`onConflict: 'user_id'`) — satır yoksa YARATIR.
 *
 * INITIAL_PURCHASE dalından farkı (bilinçli, Sprint 7 kararı 1):
 *   - Eşleme ÖNCE kontrol edilir; tanınmayan ürün için HİÇBİR ŞEY yazılmaz
 *     (INITIAL_PURCHASE `users`'a 'free' yazıp sonra durur).
 *   - `subscriptions` UPDATE değil upsert'tür; 0 satır uyarısı yoktur.
 * INITIAL_PURCHASE bu fonksiyonu KULLANMAZ (TEKNIK_BORC: orada 0 satırlık
 * UPDATE hâlâ yalnız uyarı).
 *
 * Her iki yazma da aynı değerleri yazar → tekrar çalışması güvenlidir.
 */
export async function applyEntitlement(
  writer: EntitlementWriter,
  appUserId: string,
  productId: string,
  expiresAt: string | null,
  willRenew: boolean,
  environment: RcEnvironment,
): Promise<ApplyEntitlementResult> {
  const tier = mapProductToTier(productId)
  const plan = TIER_TO_PLAN[tier]
  if (!plan) return { kind: 'unmapped_product', tier }

  const { error: usersError, count } = await writer.updateUserTier(appUserId, {
    subscription_tier: tier,
    subscription_active_until: expiresAt,
    subscription_will_renew: willRenew,
    updated_at: new Date().toISOString(),
  })
  if (usersError) return { kind: 'db_error', step: 'users', error: usersError }
  // Satırı az önce çözdük; 0 satır = arada silindi (ör. 1b birleştirmesi).
  if (count === 0) return { kind: 'users_row_vanished' }

  const { error: subsError } = await writer.upsertSubscription({
    user_id: appUserId,
    plan,
    status: 'active',
    expires_at: expiresAt,
    entitlement_id: RC_ENTITLEMENT_ID,
    environment,
  })
  if (subsError) return { kind: 'db_error', step: 'subscriptions', error: subsError }

  return { kind: 'applied', tier, plan }
}

// ─── RC yanıtı → aktif entitlement ──────────────────────────────────────────────

/**
 * Yalnız `chosy_plus` entitlement'ı okunur (istemci de yalnız onu okur).
 * Aktif = `expires_date` null (lifetime) VEYA şimdiden sonra.
 *
 * `willRenew`:
 *   - lifetime → true. NON_RENEWING_PURCHASE dalının yazdığı değerle aynı
 *     (`subscription_will_renew: true`, `active_until: null`).
 *   - abonelik → `subscriptions[product].unsubscribe_detected_at` boşsa true.
 *     Ürünün abonelik kaydı yoksa true (INITIAL_PURCHASE dalı da koşulsuz
 *     true yazar; CANCELLATION gelince düzelir).
 */
export function pickActiveEntitlement(
  info: RcSubscriberInfo,
  nowMs: number,
): ActiveEntitlement | null {
  const ent = info.entitlements[RC_ENTITLEMENT_ID]
  if (!ent || typeof ent.product_identifier !== 'string') return null

  const expiresDate = ent.expires_date ?? null
  if (expiresDate !== null) {
    const expMs = Date.parse(expiresDate)
    if (Number.isNaN(expMs) || expMs <= nowMs) return null
  }

  const productId = ent.product_identifier
  const sub = info.subscriptions[productId]
  const willRenew = expiresDate === null
    ? true
    : (sub?.unsubscribe_detected_at ?? null) === null

  return {
    productId,
    expiresAt: expiresDate === null ? null : new Date(expiresDate).toISOString(),
    willRenew,
  }
}

// ─── RC REST adaptörü ───────────────────────────────────────────────────────────

const RC_API_BASE = 'https://api.revenuecat.com/v1'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * `GET /v1/subscribers/{id}` — Bearer gizli anahtar.
 *
 * `secretKey` çağıran tarafından İSTEK ANINDA okunur (`Deno.env.get`),
 * modül seviyesinde tutulmaz. Anahtar hiçbir hata mesajına, loga veya
 * Sentry alanına girmez; HTTP hata gövdesi de okunmaz (RC hata gövdesi
 * isteği yansıtabilir).
 *
 * Not: Bu uç "yoksa müşteri yaratır". `transferred_to` RC'nin kendi
 * bildirdiği, var olan bir müşteri olduğundan yan etkisi yoktur; (a)
 * dalındaki id'ler için bu yüzden ÇAĞRILMAZ.
 */
export async function fetchRcSubscriber(
  rcAppUserId: string,
  secretKey: string | undefined,
  fetchImpl: typeof fetch,
): Promise<RcSubscriberInfo> {
  if (!secretKey) {
    throw new RcRestError('RC_SECRET_KEY_MISSING', 'REVENUECAT_SECRET_KEY tanımsız')
  }

  let res: Response
  try {
    res = await fetchImpl(`${RC_API_BASE}/subscribers/${encodeURIComponent(rcAppUserId)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${secretKey}`, Accept: 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.name : 'unknown'
    throw new RcRestError('RC_REST_NETWORK', `RC REST ağ hatası (${msg})`)
  }

  if (!res.ok) {
    // Gövde tüketilir ama İÇERİĞİ kullanılmaz (bağlantı sızıntısı olmasın).
    await res.body?.cancel()
    throw new RcRestError('RC_REST_HTTP', `RC REST HTTP ${res.status}`, res.status)
  }

  let body: unknown
  try {
    body = await res.json()
  } catch (_err) {
    throw new RcRestError('RC_REST_MALFORMED', 'RC REST yanıtı JSON değil', res.status)
  }

  const subscriber = isRecord(body) ? body.subscriber : undefined
  if (!isRecord(subscriber)) {
    throw new RcRestError('RC_REST_MALFORMED', 'RC REST yanıtında subscriber yok', res.status)
  }

  return {
    entitlements: (isRecord(subscriber.entitlements)
      ? subscriber.entitlements
      : {}) as RcSubscriberInfo['entitlements'],
    subscriptions: (isRecord(subscriber.subscriptions)
      ? subscriber.subscriptions
      : {}) as RcSubscriberInfo['subscriptions'],
  }
}

/**
 * TRANSFER'da `event.environment` opsiyoneldir. Yoksa environment, RC REST'teki
 * aktif ürünün abonelik kaydının `is_sandbox` alanından türetilir (otoriter
 * kaynak, varsayılan DEĞİL). Alan boolean değilse null → çağıran yazmaz.
 */
export function environmentFromSubscriber(
  info: RcSubscriberInfo,
  productId: string,
): RcEnvironment | null {
  const flag = info.subscriptions[productId]?.is_sandbox
  if (typeof flag !== 'boolean') return null
  return flag ? 'SANDBOX' : 'PRODUCTION'
}

// ─── Tanı logu (R-B-0e, DUR 1 kararı 3) ─────────────────────────────────────────

/** Hedef id'nin ilk 8 karakteri — PII yazmadan korelasyon için yeter. */
export function shortId(id: string): string {
  return id.slice(0, 8)
}

/**
 * RC REST yanıtından `chosy_plus` entitlement'ının kaynağını gösteren alanlar.
 * YALNIZ tanıdır: `pickActiveEntitlement`/plan mantığı bunu okumaz. Amaç,
 * "entitlement neden com.chosy.lifetime gösteriyor" sorusunu RC'nin ham
 * yanıtıyla yanıtlamak. `entitlement: null` = `chosy_plus` yok.
 */
export function buildTransferDiagnostic(targetId: string, info: RcSubscriberInfo) {
  const ent = info.entitlements[RC_ENTITLEMENT_ID]
  const productId = ent && typeof ent.product_identifier === 'string' ? ent.product_identifier : null
  const sub = productId ? info.subscriptions[productId] : undefined
  return {
    tag: 'rc_transfer_diag',
    target: shortId(targetId),
    entitlement: ent ? RC_ENTITLEMENT_ID : null,
    product_identifier: productId,
    purchase_date: ent?.purchase_date ?? sub?.purchase_date ?? null,
    expires_date: ent?.expires_date ?? null,
    store: sub?.store ?? null,
    period_type: sub?.period_type ?? null,
    is_sandbox: sub?.is_sandbox ?? null,
    subscription_product_ids: Object.keys(info.subscriptions),
  }
}

// ─── processTransfer ────────────────────────────────────────────────────────────

const FN = 'revenuecat-webhook'
const EVENT_TYPE = 'TRANSFER'

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * TRANSFER olayını işler. Her `transferred_to` id'si SIRAYLA işlenir; bir
 * id'nin 500 gerektirmesi diğerlerini durdurmaz (hepsi idempotent, retry
 * hepsini yeniden işler). Herhangi biri yeniden denenebilir sonuç verirse
 * genel yanıt 500'dür.
 */
export async function processTransfer(
  transferredTo: unknown,
  ctx: { rcEventId: string | null; transferredFrom: unknown; environment: RcEnvironment | null },
  deps: TransferDeps,
): Promise<TransferResult> {
  const baseExtra = {
    rc_event_id: ctx.rcEventId,
    transferred_from: ctx.transferredFrom ?? null,
  }

  // Şema kayması: alan "Always" belgeleniyor. Gelmezse retry düzeltmez → 200.
  if (
    !Array.isArray(transferredTo) ||
    transferredTo.length === 0 ||
    !transferredTo.every((v): v is string => typeof v === 'string')
  ) {
    console.warn('[rc-webhook] TRANSFER: transferred_to geçersiz veya boş')
    await deps.report({
      message: 'revenuecat-webhook: TRANSFER transferred_to geçersiz/boş — işlem yapılmadı',
      level: 'warning',
      tags: { error_code: 'RC_TRANSFER_PAYLOAD_INVALID', function: FN, event_type: EVENT_TYPE },
      extra: { ...baseExtra, transferred_to: transferredTo ?? null },
    })
    return { status: 200, errorCode: null, outcomes: [] }
  }

  const outcomes: TransferIdOutcome[] = []

  const fail = async (
    id: string,
    errorCode: string,
    message: string,
    extra: Record<string, unknown>,
  ): Promise<void> => {
    console.error(`[rc-webhook] TRANSFER ${errorCode} — target=${id}: ${message}`)
    await deps.report({
      message: `revenuecat-webhook: TRANSFER ${errorCode} — ${message}`,
      level: 'error',
      tags: { error_code: errorCode, function: FN, event_type: EVENT_TYPE },
      extra: { ...baseExtra, target_auth_id: id, ...extra },
    })
    outcomes.push({ id, kind: 'failed', errorCode })
  }

  for (const id of transferredTo) {
    // ── (a) çözülemeyen hedef: REST ÇAĞRILMAZ ─────────────────────────────
    let unresolvable: 'rc_anonymous' | 'not_uuid' | 'auth_user_missing' | null = null
    if (id.startsWith('$RCAnonymousID')) unresolvable = 'rc_anonymous'
    else if (!isUuid(id)) unresolvable = 'not_uuid'
    else {
      let exists: boolean
      try {
        exists = await deps.authUserExists(id)
      } catch (err) {
        await fail(id, 'RC_TRANSFER_AUTH_LOOKUP_FAILED', errorMessage(err), {})
        continue
      }
      if (!exists) unresolvable = 'auth_user_missing'
    }

    if (unresolvable) {
      // `rc_anonymous` / `not_uuid`: hedef hiçbir zaman çözülemez, RC'nin
      // retry'ı düzeltmez → 200 ama SESSİZ DEĞİL (error). `auth_user_missing`
      // silinmiş hesap demektir (TestFlight'ta hesap silme beklenen bir yol):
      // aynı kod, warning seviyesi.
      const level = unresolvable === 'auth_user_missing' ? 'warning' : 'error'
      console.error(`[rc-webhook] TRANSFER hedefi çözülemedi (${unresolvable}) — target=${shortId(id)}`)
      await deps.report({
        message: `revenuecat-webhook: TRANSFER hedefi çözülemedi (${unresolvable}) — abonelik yazılmadı`,
        level,
        tags: {
          error_code: 'TRANSFER_TARGET_UNRESOLVED',
          function: FN,
          event_type: EVENT_TYPE,
          reason: unresolvable,
        },
        extra: { ...baseExtra, target_id: id, environment: ctx.environment },
      })
      outcomes.push({ id, kind: 'unresolvable', reason: unresolvable })
      continue
    }

    // ── (b) auth var, public.users yok: giriş yarışı → 500 ────────────────
    let appUserId: string | null
    try {
      appUserId = await deps.resolveAppUserId(id)
    } catch (err) {
      await fail(id, 'APP_USER_RESOLVE_FAILED', errorMessage(err), {})
      continue
    }

    if (!appUserId) {
      // `error`: retry'lar tükenirse ödeme yapan kullanıcı Free kalır —
      // INITIAL_PURCHASE'taki `APP_USER_NOT_FOUND` ile aynı ağırlık.
      console.error(`[rc-webhook] TRANSFER: public.users satırı yok — auth_id=${id}`)
      await deps.report({
        message: 'revenuecat-webhook: TRANSFER hedefinin public.users satırı yok (giriş yarışı) — retry bekleniyor',
        level: 'error',
        tags: { error_code: 'RC_TRANSFER_APP_USER_RACE', function: FN, event_type: EVENT_TYPE },
        extra: { ...baseExtra, target_auth_id: id },
      })
      outcomes.push({ id, kind: 'app_user_race' })
      continue
    }

    // ── (c) RC REST ───────────────────────────────────────────────────────
    let info: RcSubscriberInfo
    try {
      info = await deps.fetchSubscriber(id)
    } catch (err) {
      const code = err instanceof RcRestError ? err.code : 'RC_REST_UNKNOWN'
      const httpStatus = err instanceof RcRestError ? err.httpStatus : null
      await fail(id, code, errorMessage(err), { app_user_id: appUserId, http_status: httpStatus })
      continue
    }

    console.log(JSON.stringify(buildTransferDiagnostic(id, info)))

    const active = pickActiveEntitlement(info, deps.nowMs())
    if (!active) {
      console.log(`[rc-webhook] TRANSFER: aktif ${RC_ENTITLEMENT_ID} yok — yazılmadı, target=${id}`)
      await deps.report({
        message: `revenuecat-webhook: TRANSFER hedefinde aktif ${RC_ENTITLEMENT_ID} yok — hiçbir şey yazılmadı`,
        level: 'info',
        tags: { error_code: 'RC_TRANSFER_NO_ACTIVE_ENTITLEMENT', function: FN, event_type: EVENT_TYPE },
        extra: { ...baseExtra, target_auth_id: id, app_user_id: appUserId },
      })
      outcomes.push({ id, kind: 'no_active_entitlement' })
      continue
    }

    // environment: olaydaki değer; yoksa RC REST `is_sandbox`'tan; o da yoksa
    // YAZILMAZ (varsayılan yok) — 200, retry çözmez ama Sentry error.
    const environment = ctx.environment ?? environmentFromSubscriber(info, active.productId)
    if (!environment) {
      console.error(`[rc-webhook] TRANSFER: environment belirlenemedi — target=${shortId(id)}`)
      await deps.report({
        message: 'revenuecat-webhook: TRANSFER environment eksik (olayda yok, RC REST is_sandbox yok) — yazım yapılmadı',
        level: 'error',
        tags: { error_code: 'RC_ENVIRONMENT_MISSING', function: FN, event_type: EVENT_TYPE },
        extra: { ...baseExtra, target_auth_id: id, product_id: active.productId },
      })
      outcomes.push({ id, kind: 'environment_missing' })
      continue
    }

    const result = await applyEntitlement(
      deps.writer,
      appUserId,
      active.productId,
      active.expiresAt,
      active.willRenew,
      environment,
    )

    const writeExtra = {
      app_user_id: appUserId,
      product_id: active.productId,
      expires_at: active.expiresAt,
      will_renew: active.willRenew,
      environment,
    }

    switch (result.kind) {
      case 'unmapped_product': {
        // INITIAL_PURCHASE ile aynı kod ve gerekçe: retry düzeltmez → 200.
        console.error(`[rc-webhook] TRANSFER: eşlenemeyen product_id ${active.productId}`)
        await deps.report({
          message: `revenuecat-webhook: TRANSFER product_id eşlenemedi (${active.productId}) — hiçbir şey yazılmadı`,
          level: 'error',
          tags: {
            error_code: 'PRODUCT_ID_UNMAPPED',
            function: FN,
            event_type: EVENT_TYPE,
            tier: result.tier,
          },
          extra: { ...baseExtra, target_auth_id: id, ...writeExtra },
        })
        outcomes.push({ id, kind: 'unmapped_product', productId: active.productId })
        break
      }
      case 'users_row_vanished': {
        await fail(id, 'USERS_ROW_VANISHED', 'users update 0 satır — satır çözümlemeden sonra kayboldu', writeExtra)
        break
      }
      case 'db_error': {
        await fail(
          id,
          result.step === 'users' ? 'USERS_TIER_UPDATE_FAILED' : 'SUBSCRIPTION_UPSERT_FAILED',
          result.error.message,
          { ...writeExtra, pg_code: result.error.code ?? null, pg_details: result.error.details ?? null },
        )
        break
      }
      case 'applied': {
        console.log(`[rc-webhook] TRANSFER: ${result.tier} yazıldı — app_user_id=${appUserId}`)
        if (result.tier === 'lifetime') {
          // Kural 4: yalnız tier + plan. `lifetime_sales` / `claim_lifetime_spot`
          // (Uzay B, sayaç) TAŞINMAZ — iz bırakılır.
          await deps.report({
            message: 'revenuecat-webhook: TRANSFER lifetime taşındı — yalnız tier/plan yazıldı, lifetime_sales dokunulmadı',
            level: 'info',
            tags: { error_code: 'RC_TRANSFER_LIFETIME', function: FN, event_type: EVENT_TYPE },
            extra: { ...baseExtra, target_auth_id: id, ...writeExtra },
          })
        }
        outcomes.push({ id, kind: 'applied', tier: result.tier, plan: result.plan })
        break
      }
    }
  }

  const retryable = outcomes.find((o) => o.kind === 'app_user_race' || o.kind === 'failed')
  if (!retryable) return { status: 200, errorCode: null, outcomes }

  return {
    status: 500,
    errorCode: retryable.kind === 'failed' ? retryable.errorCode : 'RC_TRANSFER_APP_USER_RACE',
    outcomes,
  }
}
