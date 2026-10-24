/**
 * Entitlement sync — `sync-entitlement` Edge Function istemcisi (MONEY-SEC-1).
 *
 * İstemci artık `users.subscription_tier` / `subscriptions` tablolarına YAZMAZ
 * (migration 135 yazımı kapatır). Satın alma, restore ve RC dinleyicisi bu
 * servisi çağırır; sunucu RC'nin O ANKİ durumunu okuyup yazar. İstek gövdesi
 * yoktur — istemci hiçbir plan/tier değeri beyan edemez.
 *
 * Başarısızlıkta UI bozulmaz: erişim RC'den (`premiumStatus`) çözülmeye devam
 * eder, yalnız sunucu tarafı tier webhook gelene kadar gecikebilir. Hata
 * Sentry'ye gider (`logger.error`, kural 1) ve false döner.
 *
 * Aynı anda tek istek uçar (çift tıklama / dinleyici+paywall çakışması).
 */

import { supabase } from './supabase';
import { logger } from '@/utils/logger';
import { shouldSyncFromListener, type ListenerSyncState } from '@/utils/entitlementSyncPolicy';

export type EntitlementSyncReason = 'purchase' | 'restore' | 'rc_listener';

interface SyncResponse {
  synced?: boolean;
  reason?: string;
}

let inFlight: Promise<boolean> | null = null;
const listenerState: ListenerSyncState = { lastSyncedKey: null, lastAttemptAtMs: null };

async function invokeSync(reason: EntitlementSyncReason): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke('sync-entitlement', { method: 'POST' });

  if (error) {
    logger.error('[entitlement-sync] sync-entitlement çağrısı başarısız:', error, {
      code: 'ENTITLEMENT_SYNC_FAILED',
      extra: { reason },
    });
    return false;
  }

  const res = (data ?? {}) as SyncResponse;
  if (res.synced === true) return true;

  // 200 ama yazılmadı: RC henüz entitlement'ı yansıtmamış olabilir. Hata değil
  // ama sessiz de değil — satın alma/restore sonrası beklenmedikse görünür olsun.
  logger.error('[entitlement-sync] sunucu yazmadı', new Error(`sync-entitlement synced=false (${res.reason ?? 'bilinmiyor'})`), {
    code: 'ENTITLEMENT_SYNC_NOT_SYNCED',
    sampleRate: reason === 'rc_listener' ? 0.1 : 1.0,
    extra: { reason, serverReason: res.reason ?? null },
  });
  return false;
}

/**
 * Satın alma / restore sonrası zorunlu sync. true → sunucu tier'ı yazdı.
 * Hata fırlatmaz.
 */
export async function syncEntitlement(reason: 'purchase' | 'restore'): Promise<boolean> {
  if (inFlight) return inFlight;
  inFlight = invokeSync(reason).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/**
 * RC dinleyicisinden (her customerInfo değişimi) sync. Aynı kullanıcı+plan için
 * bir kez başarılıysa ya da cooldown içindeyse çağrı YAPILMAZ (sunucu 5/dk).
 */
export async function syncEntitlementFromListener(userKey: string, activePlanId: string): Promise<boolean> {
  const key = `${userKey}:${activePlanId}`;
  const now = Date.now();
  if (!shouldSyncFromListener(key, listenerState, now)) return false;
  if (inFlight) return inFlight;

  listenerState.lastAttemptAtMs = now;
  inFlight = invokeSync('rc_listener')
    .then((ok) => {
      if (ok) listenerState.lastSyncedKey = key;
      return ok;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
