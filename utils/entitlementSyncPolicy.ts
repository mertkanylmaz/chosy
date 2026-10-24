/**
 * sync-entitlement istemci politikası (MONEY-SEC-1) — saf karar fonksiyonu.
 *
 * Satın alma ve restore HER ZAMAN senkronize eder (kullanıcı eylemi).
 * RC dinleyicisi (`addSubscriptionListener`) ise her customerInfo değişiminde
 * tetiklenir; sunucu 5/dk sınırlı olduğundan:
 *   - aynı plan için bir kez başarılı sync yapıldıysa tekrar çağrılmaz,
 *   - başarısız denemeden sonra `cooldownMs` dolmadan tekrar denenmez.
 *
 * Modül hiçbir şey import etmez (Deno testi native modül çekmeden koşar).
 */

export const LISTENER_SYNC_COOLDOWN_MS = 30_000

export interface ListenerSyncState {
  /** Son BAŞARILI sync'in anahtarı (`${userKey}:${activePlanId}`); yoksa null. */
  lastSyncedKey: string | null
  /** Son deneme (başarılı ya da değil) zamanı; hiç deneme yoksa null. */
  lastAttemptAtMs: number | null
}

export function shouldSyncFromListener(
  key: string,
  state: ListenerSyncState,
  nowMs: number,
  cooldownMs: number = LISTENER_SYNC_COOLDOWN_MS,
): boolean {
  if (state.lastSyncedKey === key) return false
  if (state.lastAttemptAtMs !== null && nowMs - state.lastAttemptAtMs < cooldownMs) return false
  return true
}
