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

Deno.test('adım 3: min girdi + hata mesajı yalnız offerEnabled ile devreye girer', () => {
  const screen = read('components/Home/MoodSearchScreen/index.tsx')
  assertMatch(screen, /isMoodInputSubmittable\(trimmed, offerEnabled\)/)
  assertMatch(screen, /moodErrorMessageKey\(errorCode, offerEnabled\)/)
  assertMatch(screen, /const canSubmit = isMoodInputSubmittable\(moodText, offerEnabled\)/)
})

Deno.test('locales: moodOffer anahtarları en/tr tam parite', () => {
  const keys = (l: string) => Object.keys(JSON.parse(read(`locales/${l}.json`)).moodOffer ?? {}).sort()
  assert(keys('en').length > 0)
  assert(JSON.stringify(keys('en')) === JSON.stringify(keys('tr')))
})

Deno.test('adım 4: davet kartı iki yüzeyde de bayrak + sığma kapısının arkasında; Spotlight kartı yerinde', () => {
  const shell = read('components/gauntlet/GauntletShell/index.tsx')
  assertMatch(shell, /const showMoodInvite =\s*moodOfferEnabled &&/)
  assertMatch(shell, /\{showMoodInvite && \(\s*<View onLayout=\{below\.onLayoutOf\('invite'\)\}>/)
  // Kart Spotlight kartından SONRA, sayaç satırından ÖNCE (altında) — Spotlight konumu değişmedi.
  const spot = shell.indexOf('<SpotlightBonusCard')
  const invite = shell.indexOf('<MoodInviteCard')
  const cycle = shell.indexOf('<CycleRow')
  assert(spot > 0 && invite > spot && cycle > invite)
  // Bayrak kapalıyken hero hesabına davet girmez.
  assertMatch(shell, /invite: showMoodInvite,/)
  const result = read('components/games/Spotlight/SpotlightResult.tsx')
  assertMatch(result, /const showMoodInvite = moodOfferEnabled && spotlightInviteFits\(/)
  assertMatch(result, /\{showMoodInvite \? <MoodInviteCard surface="spotlight_card" \/> : null\}/)
})

Deno.test('adım 4: askDecision / useChampionAsk dosyalarına dokunulmadı', () => {
  const ask = read('utils/askDecision.ts')
  assert(!/mood_offer|MoodInvite|moodInvite/.test(ask))
  assert(!/mood_offer|MoodInvite|moodInvite/.test(read('components/gauntlet/GauntletShell/useChampionAsk.ts')))
})
