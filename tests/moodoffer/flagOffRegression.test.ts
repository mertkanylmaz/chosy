/**
 * Bayrak KAPALI regresyon sözleşmesi (MONEY-1C). Repoda React render altyapısı yok
 * (deno + saf mantık); bu testler kaynağı okur — davranışsal doğrulama cihazda.
 * Her MONEY-1C yüzeyi `mood_offer_enabled` arkasında olmalı; kapalıyken eski yol aynen durur.
 * Run: npm run test:mood-offer
 */
import { assert, assertMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts'

const read = (p: string) =>
  Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url)).replaceAll('\r\n', '\n')

Deno.test('bayrak varsayılanı false ve kill-switch === true', () => {
  assertMatch(read('services/remoteConfig.ts'), /mood_offer_enabled: false/)
  assertMatch(read('services/appConfigFlags.ts'), /remoteConfig\.get\('mood_offer_enabled'\)[\s\S]*?value === true/)
})

Deno.test('adım 1: pro-mode kilitli ekran yalnız gate === locked; hook bayrak kapalıyken quota okumaz', () => {
  const screen = read('app/pro-mode.tsx')
  assertMatch(screen, /if \(gate === 'locked'\)/)
  const hook = read('hooks/useProModeAccess.ts')
  assertMatch(hook, /needsQuota = withQuota && offerEnabled && !stillLoading && !allowed/)
  assertMatch(hook, /offerEnabled: withQuota && offerEnabled/)
})

Deno.test('adım 2: istemci AsyncStorage arama sayacı bayrak kapalıyken AYNEN tüketilir, açıkken atlanır', () => {
  const screen = read('components/Home/MoodSearchScreen/index.tsx')
  assertMatch(screen, /if \(!isOnboarding && !quotaExempt && !offerEnabled\) \{\s*const quotaResult = await consumeQuota\('search'\)/)
  assert(!/FREE_DAILY_LIMIT/.test(screen))
})
