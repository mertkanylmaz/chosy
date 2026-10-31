/**
 * İstemci abonelik/tier YAZMAZ (MONEY-1C g1; kök neden: 2.1.2 build 912).
 *
 * Canlı kanıt (Sentry, 25 Eki 2026 03:55 UTC, release chosy-ai@2.1.2):
 *   REACT-NATIVE-C : "permission denied for table subscriptions" (istemci INSERT, migration 135 GRANT'ı aldı)
 *   REACT-NATIVE-16: 42501 "entitlement columns are server-managed" (users.subscription_tier UPDATE, 135 tetikleyicisi)
 * İkisi de `handled` ve postPurchaseStep içinde yutuldu → kullanıcı hata UI'ı görmedi; DB satırını
 * webhook / sync-entitlement yazdı. Düzeltme 7b2555f'te (MONEY-SEC-1): tek yazıcı sunucu.
 * Bu test o düzeltmenin geri alınmasını yakalar.
 * Run: deno test --allow-read tests/subscription/noClientEntitlementWrite.test.ts
 */
import { assert, assertMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts'

const read = (p: string) =>
  Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url)).replaceAll('\r\n', '\n')

const CLIENT_FILES = [
  'components/paywalls/PaywallBase/index.tsx',
  'contexts/SubscriptionContext.tsx',
  'services/subscriptionService.ts',
  'services/purchaseService.ts',
]

Deno.test('istemci subscriptions tablosuna yazmaz, users.subscription_tier güncellemez', () => {
  for (const f of CLIENT_FILES) {
    const src = read(f)
    assert(!/from\('subscriptions'\)[\s\S]{0,120}\.(insert|update|upsert|delete)\(/.test(src), `${f}: subscriptions yazımı`)
    assert(!/from\('users'\)[\s\S]{0,120}\.update\([\s\S]{0,120}subscription_tier/.test(src), `${f}: users.subscription_tier yazımı`)
    assert(!/upsertSubscription|updateSubscriptionStatus|getOrCreateSubscription\([^)]*plan/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')), `${f}: eski yazma fonksiyonu`)
  }
})

Deno.test('satın alma ve restore sonrası adım sunucu sync\'ini çağırır; hata UI\'a çıkmaz', () => {
  const paywall = read('components/paywalls/PaywallBase/index.tsx')
  assertMatch(paywall, /postPurchaseStep\('sync_entitlement', \(\) => syncEntitlement\('purchase'\)\)/)
  assertMatch(paywall, /syncEntitlement\('restore'\)/)
  // postPurchaseStep hatayı yutar ama Sentry'ye yazar (kural 1)
  assertMatch(paywall, /async function postPurchaseStep[\s\S]*catch \(err\)[\s\S]*logger\.error/)
})
