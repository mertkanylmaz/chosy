/**
 * revenuecat-webhook — `public.users` satırı YOKKEN karar kuralı (Sprint 5).
 *
 * Kapı `appUserMissing()` (index.ts). Eskiden her durumda 500 + retry'dı;
 * meşru silinmiş hesabın yenilemeleri bu yüzden RC'de sonsuza dek retry'a
 * düşüyordu. Ayrım `auth.users` varlığına göre:
 *
 *   (a) id UUID değil (`$RCAnonymousID:…`) → 500 + retry, bugünkü gibi.
 *       Anonim alım, TRANSFER gelene kadar canlı kalmalı.
 *   (b) UUID, `auth.users`'ta YOK → 200, retry YOK. Hesap silinmiş.
 *       - ilk satın alma (para alındı) → `error` + `refund_review`
 *       - yaşam döngüsü olayları      → `warning` + `expected_deleted_user`
 *   (c) UUID, `auth.users`'ta VAR → 500 + retry (giriş yarışı), bugünkü gibi.
 *   (d) varlık sorgusu düştü → 500 + `error` (güvenli yön; "yok" varsayılmaz).
 *
 * Seviye/etiket (a) ve (c)'de `missingUserSeverity`'den gelir (değişmedi).
 *
 * Saf modül: varlık sorgusu enjekte edilir, Deno testi sahte ile okur.
 */

import { isFirstPurchaseEvent, missingUserSeverity } from './rcMissingUserSeverity.ts'
import { isUuid } from './rcAuthUser.ts'

/** Sentry `error_code` etiketi ve yanıt gövdesi bu alanlardan okunur. */
type DecisionBase = {
  errorCode: 'APP_USER_NOT_FOUND' | 'AUTH_USER_LOOKUP_FAILED'
  /** true → yanıt gövdesine `retryable: true`; RC yeniden dener. */
  retryable: boolean
}

export type MissingUserDecision = DecisionBase &
  (
  | {
      kind: 'unresolvable_id' | 'login_race'
      status: 500
      level: 'error' | 'warning'
      expectedDeletedUser: boolean
      refundReview: false
    }
  | {
      kind: 'deleted_account'
      status: 200
      level: 'error' | 'warning'
      expectedDeletedUser: boolean
      /** true → ödeme alınmış ama hesap yok; iade incelemesi gerekir. */
      refundReview: boolean
    }
  | {
      kind: 'lookup_failed'
      status: 500
      level: 'error'
      expectedDeletedUser: false
      refundReview: false
      errorMessage: string
    }
  )

export async function decideMissingUser(
  eventType: string,
  authUserId: string,
  authUserExists: (id: string) => Promise<boolean>,
): Promise<MissingUserDecision> {
  const severity = missingUserSeverity(eventType)

  if (!isUuid(authUserId)) {
    return { kind: 'unresolvable_id', status: 500, ...severity, refundReview: false, errorCode: 'APP_USER_NOT_FOUND', retryable: true }
  }

  let exists: boolean
  try {
    exists = await authUserExists(authUserId)
  } catch (err) {
    return {
      kind: 'lookup_failed',
      status: 500,
      level: 'error',
      expectedDeletedUser: false,
      refundReview: false,
      errorMessage: err instanceof Error ? err.message : String(err),
      errorCode: 'AUTH_USER_LOOKUP_FAILED',
      retryable: true,
    }
  }

  if (exists) {
    return { kind: 'login_race', status: 500, ...severity, refundReview: false, errorCode: 'APP_USER_NOT_FOUND', retryable: true }
  }

  return {
    kind: 'deleted_account',
    status: 200,
    level: severity.level,
    expectedDeletedUser: severity.expectedDeletedUser,
    refundReview: isFirstPurchaseEvent(eventType),
    errorCode: 'APP_USER_NOT_FOUND',
    retryable: false,
  }
}
