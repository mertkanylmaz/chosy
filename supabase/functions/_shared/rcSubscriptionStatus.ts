/**
 * revenuecat-webhook — `subscriptions.status` kararı (MONEY-1A).
 *
 * Eskiden her satın alma olayı `'active'` yazıyordu; RC `period_type` hiç
 * okunmuyordu. Deneme (7 gün ücretsiz) açılınca trial ile ücretli ayrışmalı:
 *
 *   INITIAL_PURCHASE + TRIAL          → 'trial'
 *   RENEWAL (trial sonrası ilk dahil) → 'active'
 *   PRODUCT_CHANGE / UNCANCELLATION   → period_type TRIAL ise 'trial', değilse 'active'
 *   CANCELLATION (gönüllü)            → subscriptions'a DOKUNULMAZ: status ve
 *                                        expires_at korunur, trial 'trial' kalır
 *   CANCELLATION (refund)             → 'cancelled' (active + trial'dan)
 *   EXPIRATION                        → 'expired' (active + trial'dan)
 *
 * Yetki taşıyıcısı `users.subscription_tier` değişmedi (trial'da da yazılır);
 * burada yalnız `subscriptions.status` kararı verilir.
 *
 * `period_type` yok/tanınmayan: davranış eskisi gibi 'active' (erişim kapanmaz)
 * AMA sessiz değil — `warn` döner, çağıran Sentry'ye yazar (kural 1).
 *
 * Saf modül: import yok.
 */

/** RC dokümanındaki `period_type` değer kümesi. */
const KNOWN_PERIOD_TYPES = ['TRIAL', 'INTRO', 'NORMAL', 'PROMOTIONAL', 'PREPAID'] as const
export type RcPeriodType = typeof KNOWN_PERIOD_TYPES[number]

/** Tam eşitlik (büyük harf); yok/tanınmayan → null. */
export function parseRcPeriodType(value: unknown): RcPeriodType | null {
  return KNOWN_PERIOD_TYPES.find((p) => p === value) ?? null
}

/** Satın alma dalındaki olay tipleri (`subscriptions.status` yazan). */
export type PurchaseEventType =
  | 'INITIAL_PURCHASE'
  | 'RENEWAL'
  | 'PRODUCT_CHANGE'
  | 'UNCANCELLATION'

export interface PurchaseStatusDecision {
  status: 'trial' | 'active'
  /** Log etiketi (her durum için). */
  label:
    | 'trial_started'
    | 'trial_continued'
    | 'trial_converted_or_renewed'
    | 'paid_started'
    | 'paid_continued'
    | 'period_type_missing'
  /** true → çağıran Sentry `warning` yazar (RC_PERIOD_TYPE_MISSING). */
  warn: boolean
}

export function decidePurchaseStatus(
  eventType: PurchaseEventType,
  rawPeriodType: unknown,
): PurchaseStatusDecision {
  const periodType = parseRcPeriodType(rawPeriodType)

  // RENEWAL her zaman ücretli dönemdir: trial → ödeme geçişi RC'de RENEWAL'dır.
  if (eventType === 'RENEWAL') {
    return { status: 'active', label: 'trial_converted_or_renewed', warn: false }
  }

  if (periodType === null) {
    // Alan yok/tanınmayan: erişimi kapatma, eski davranış ('active'), ama görünür.
    return { status: 'active', label: 'period_type_missing', warn: true }
  }

  if (periodType === 'TRIAL') {
    return {
      status: 'trial',
      label: eventType === 'INITIAL_PURCHASE' ? 'trial_started' : 'trial_continued',
      warn: false,
    }
  }

  return {
    status: 'active',
    label: eventType === 'INITIAL_PURCHASE' ? 'paid_started' : 'paid_continued',
    warn: false,
  }
}

/** Erişim veren (henüz kapanmamış) durumlar: EXPIRATION / refund bunlardan kapatır. */
export const OPEN_SUBSCRIPTION_STATUSES: readonly string[] = ['active', 'trial']

export interface SubscriptionsWrite {
  status: 'expired' | 'cancelled'
  /** `.in('status', fromStatuses)` filtresi. */
  fromStatuses: readonly string[]
  label: 'expired' | 'refund_cancelled'
}

/**
 * EXPIRATION ve refund CANCELLATION'ın `subscriptions` yazımı. Gönüllü
 * CANCELLATION için `null`: tablo değişmez, status/expires_at korunur.
 */
export function decideTerminalWrite(
  eventType: 'EXPIRATION' | 'CANCELLATION',
  revokeNow: boolean,
): SubscriptionsWrite | null {
  if (eventType === 'EXPIRATION') {
    return { status: 'expired', fromStatuses: OPEN_SUBSCRIPTION_STATUSES, label: 'expired' }
  }
  return revokeNow
    ? { status: 'cancelled', fromStatuses: OPEN_SUBSCRIPTION_STATUSES, label: 'refund_cancelled' }
    : null
}

// ─── subscriptions upsert satırı (MONEY-1A commit 4) ───────────────────────────

/**
 * `subscriptions` upsert gövdesi (`onConflict: 'user_id'`, UNIQUE). Yalnız bu
 * kolonlar yazılır; started_at / trial_used / rc_customer_id mevcut satırda
 * korunur. Webhook (INITIAL_PURCHASE/RENEWAL/…, lifetime) ve sync-entitlement
 * aynı biçimi kullanır — iki yazıcı çelişemez.
 */
export interface SubscriptionUpsertFields {
  user_id: string
  plan: string
  status: 'trial' | 'active'
  /** null = lifetime */
  expires_at: string | null
  entitlement_id: string
  environment: 'PRODUCTION' | 'SANDBOX'
}

export function buildSubscriptionUpsertRow(p: {
  userId: string
  plan: string
  status: 'trial' | 'active'
  expiresAt: string | null
  entitlementId: string
  environment: 'PRODUCTION' | 'SANDBOX'
}): SubscriptionUpsertFields {
  return {
    user_id: p.userId,
    plan: p.plan,
    status: p.status,
    expires_at: p.expiresAt,
    entitlement_id: p.entitlementId,
    environment: p.environment,
  }
}
