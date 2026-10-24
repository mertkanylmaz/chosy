/**
 * sync-entitlement — saf çekirdek (MONEY-SEC-1).
 *
 * Satın alma/restore sonrası istemci artık `users.subscription_tier` ve
 * `subscriptions` tablolarına yazmaz (migration 135 yazımı kapatır). Bunun yerine
 * kendi JWT'siyle `sync-entitlement` çağırır; fonksiyon RC REST'ten O ANKİ durumu
 * okur ve service role ile yazar. Webhook gelene kadarki kota penceresini kapatır.
 *
 * Karar ve yazma mantığı webhook TRANSFER ile AYNI: `pickActiveEntitlement` →
 * `environmentFromSubscriber` → `applyEntitlement` (status kararı
 * `decidePurchaseStatus`). İki yazıcı aynı değeri üretir, çelişemez.
 *
 * İstemci beyanı HİÇ okunmaz (ürün, tier, tarih): yazılan her şey RC'den gelir.
 *
 * Aktif entitlement yoksa HİÇBİR ŞEY yazılmaz — downgrade bu fonksiyonun işi
 * değil (EXPIRATION webhook'u yapar); aksi halde RC REST gecikmesi ücretli
 * kullanıcıyı Free'ye düşürürdü.
 *
 * Lifetime yalnız tier + plan taşır; `lifetime_sales` / `claim_lifetime_spot`
 * sayacı webhook NON_RENEWING_PURCHASE dalında kalır (TRANSFER ile aynı sınır).
 *
 * Saf modül: dış dünya `EntitlementWriter` ile enjekte edilir.
 */

import {
  applyEntitlement,
  type DbError,
  type EntitlementWriter,
  environmentFromSubscriber,
  pickActiveEntitlement,
  type RcSubscriberInfo,
} from './rcTransfer.ts'

export type SyncOutcome =
  | { kind: 'synced'; tier: string; plan: string; status: 'trial' | 'active'; warnPeriodType: boolean }
  | { kind: 'no_active_entitlement' }
  | { kind: 'environment_missing'; productId: string }
  | { kind: 'unmapped_product'; productId: string }
  | { kind: 'users_row_vanished' }
  | { kind: 'db_error'; step: 'users' | 'subscriptions'; error: DbError }

export async function syncEntitlementFromRc(
  info: RcSubscriberInfo,
  writer: EntitlementWriter,
  appUserId: string,
  nowMs: number,
): Promise<SyncOutcome> {
  const active = pickActiveEntitlement(info, nowMs)
  if (!active) return { kind: 'no_active_entitlement' }

  // Varsayılan YOK: environment RC'den okunamazsa yazılmaz (kolon DEFAULT'u
  // 'PRODUCTION' sandbox satırını sessizce prod yapardı).
  const environment = environmentFromSubscriber(info, active.productId)
  if (!environment) return { kind: 'environment_missing', productId: active.productId }

  const result = await applyEntitlement(
    writer,
    appUserId,
    active.productId,
    active.expiresAt,
    active.willRenew,
    environment,
    active.periodType,
  )

  switch (result.kind) {
    case 'applied':
      return {
        kind: 'synced',
        tier: result.tier,
        plan: result.plan,
        status: result.status.status,
        warnPeriodType: result.status.warn,
      }
    case 'unmapped_product':
      return { kind: 'unmapped_product', productId: active.productId }
    case 'users_row_vanished':
      return { kind: 'users_row_vanished' }
    case 'db_error':
      return { kind: 'db_error', step: result.step, error: result.error }
  }
}
