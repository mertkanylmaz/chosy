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

Deno.test('adım 3: hata mesajı yalnız offerEnabled ile; min girdi (2) bayraktan BAĞIMSIZ — bilinçli istisna', () => {
  const screen = read('components/Home/MoodSearchScreen/index.tsx')
  assertMatch(screen, /isMoodInputSubmittable\(trimmed\)/)
  assertMatch(screen, /moodErrorMessageKey\(errorCode, offerEnabled\)/)
  assertMatch(screen, /const canSubmit = isMoodInputSubmittable\(moodText\)/)
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

Deno.test('adım 5: mood_offer tetikleyici/varyant, IMMEDIATE, kill-switch ve router', () => {
  const orch = read('services/conversion/triggerOrchestrator.ts')
  assertMatch(orch, /case 'mood_offer':\s*return 'mood_offer';/)
  assertMatch(orch, /IMMEDIATE_TRIGGERS[\s\S]*?'mood_offer',\s*\]\)/)
  assertMatch(orch, /mood_offer: 'mood_offer_enabled'/)
  assertMatch(read('components/paywalls/ContextualPaywall.tsx'), /case 'mood_offer':\s*return <PaywallMoodOffer/)
  // Teklif kopyasında deneme vaadi yok (eligibility yalnız PaywallBase/buildOffer'da).
  const paywall = read('components/paywalls/PaywallMoodOffer/index.tsx')
  assert(!/trial|7 days|7 gün/i.test(paywall.replace(/trialShown/g, '').replace(/[^\n]*\*[^\n]*/g, '')))
  const loc = JSON.parse(read('locales/en.json')).moodOffer
  assert(!/free trial|7 days|7-day/i.test(`${loc.paywallKickerQuota} ${loc.paywallKickerDeck}`))
})

Deno.test('adım 6: deste/çıkış teklifi eligible kapısında; slot muafiyeti bayrak arkasında; askDecision dokunulmadı', () => {
  const d = read('app/discover.tsx')
  assertMatch(d, /offerLedger\.claim\(\{ eligible: true, moment: 'exit'/)
  assertMatch(d, /addListener\('beforeRemove'/)
  // x / özet kapat işleyicileri DEĞİŞMEDİ (test:deck-summary aynı kalıbı pinler)
  assertMatch(d, /handleClose = useCallback\(\(\) => \{\s*router\.dismissTo\('\/\(tabs\)'\)/)
  assertMatch(d, /offerLedger\.claim\(\{ eligible: offerEligible, moment: 'deck_end'/)
  assertMatch(d, /premiumStatus !== 'premium' && !quotaExempt && !slotExemptFreeDeck/)
  assertMatch(d, /isOfferEligible\(\{\s*offerEnabled,/)
  const m = read('components/Home/MoodSearchScreen/index.tsx')
  assertMatch(m, /if \(offerEnabled\) \{[\s\S]*?entry: 'quota_exhausted'[\s\S]*?\} else \{\s*await showQuotaWall\(\);/)
})

Deno.test('adım 8: analitik olayları — yalnız ilgili yüzeyde ve bayrak/varyant kapısı arkasında', () => {
  const m = read('components/Home/MoodSearchScreen/index.tsx')
  assertMatch(m, /if \(freeSearch && \(await hasAiConsent\(\)\)\) \{\s*posthogAnalytics\.track\('mood_search_free_started'/)
  assertMatch(m, /if \(freeSearch\) \{\s*posthogAnalytics\.track\('mood_search_free_completed'/)
  const o = read('services/conversion/triggerOrchestrator.ts')
  assertMatch(o, /if \(variant\.trigger\.type !== 'mood_offer'\) return;/)
  for (const e of ['mood_offer_shown', 'mood_offer_dismissed']) assert(o.includes(`trackMoodOffer('${e}'`), e)
  assertMatch(read('components/paywalls/PaywallBase/index.tsx'), /trackMoodOffer\('mood_offer_cta'/)
  const c = read('components/gauntlet/MoodInviteCard/index.tsx')
  for (const e of ['mood_invite_shown', 'mood_invite_tapped']) assert(c.includes(`track('${e}'`), e)
})

Deno.test('hak bitti metni limit sayısından bağımsız (rakam yok; 1 ve 3 için doğru okunur)', () => {
  for (const l of ['en', 'tr']) {
    const m = JSON.parse(read(`locales/${l}.json`)).moodOffer
    for (const k of ['offerTitle', 'offerBody', 'offerBodyTime']) assert(!/\d/.test(m[k]), `${l}:${k}`)
  }
})
