/**
 * Pro Mode Faz 2-2 — Mood Gauntlet giriş noktası: sığma, bayrak kapalı regresyon,
 * paywall metni kaynak eşlemesi, TR saat eki, olay bir-kez kuralı.
 * Çalıştırma: npm run test:mood-entry
 */
import { assert, assertEquals, assertMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  createEntryViewedTracker,
  formatEntryTime,
  isMoodGauntletEntryTrigger,
  MOOD_ENTRY_MAX_FONT_SCALE,
  MOOD_ENTRY_RESERVE_HEIGHT,
  MOOD_GAUNTLET_ENTRY_SOURCE,
  moodEntryFits,
  moodEntryTapTarget,
  paywallEntrySource,
} from '../../utils/moodEntry.ts'

const read = (p: string): string => Deno.readTextFileSync(new URL(p, import.meta.url)).replaceAll('\r\n', '\n')

// ── Sığma ────────────────────────────────────────────────────────────────────

Deno.test('moodEntryFits: yüksek ekranda sığar, kısa ekranda gizlenir', () => {
  assert(moodEntryFits({ screenH: 900, belowWithoutEntry: 200, tabInset: 90, fontScale: 1 }))
  assert(!moodEntryFits({ screenH: 667, belowWithoutEntry: 200, tabInset: 90, fontScale: 1 }))
})

Deno.test('moodEntryFits: büyük yazı ölçeğinde (>1.3) sığmaz; sınırda sığar', () => {
  const base = { screenH: 900, belowWithoutEntry: 200, tabInset: 90 }
  assert(moodEntryFits({ ...base, fontScale: MOOD_ENTRY_MAX_FONT_SCALE }))
  assert(!moodEntryFits({ ...base, fontScale: MOOD_ENTRY_MAX_FONT_SCALE + 0.01 }))
})

Deno.test('moodEntryFits: hero tabanı korunur — tam eşikte sığar, 1pt altında sığmaz', () => {
  // heroLeft = screenH - 260 - below - reserve - inset >= 180
  const below = 200
  const inset = 90
  const edge = 180 + 260 + below + MOOD_ENTRY_RESERVE_HEIGHT + inset
  assert(moodEntryFits({ screenH: edge, belowWithoutEntry: below, tabInset: inset, fontScale: 1 }))
  assert(!moodEntryFits({ screenH: edge - 1, belowWithoutEntry: below, tabInset: inset, fontScale: 1 }))
})

// ── Dokunuş yönü ve kaynak eşlemesi ──────────────────────────────────────────

Deno.test('dokunuş: Pro/legacy → /pro-mode; ücretsiz → paywall', () => {
  assertEquals(moodEntryTapTarget(true), 'pro_mode')
  assertEquals(moodEntryTapTarget(false), 'paywall')
})

Deno.test('paywall metni kaynak eşlemesi: yalnız profile_upgrade + mood_gauntlet_entry', () => {
  assert(isMoodGauntletEntryTrigger({ type: 'profile_upgrade', entry: MOOD_GAUNTLET_ENTRY_SOURCE }))
  assert(!isMoodGauntletEntryTrigger({ type: 'profile_upgrade', entry: 'profile_tab' }))
  assert(!isMoodGauntletEntryTrigger({ type: 'profile_upgrade', entry: 'pro_mode_locked' }))
  assert(!isMoodGauntletEntryTrigger({ type: 'profile_upgrade' }))
  assert(!isMoodGauntletEntryTrigger({ type: 'mood_offer', entry: MOOD_GAUNTLET_ENTRY_SOURCE }))
})

Deno.test('paywall_viewed source: yalnız Mood Gauntlet girişinde; diğerlerinde olay şekli aynı', () => {
  assertEquals(paywallEntrySource({ type: 'profile_upgrade', entry: MOOD_GAUNTLET_ENTRY_SOURCE }), { source: 'mood_gauntlet_entry' })
  assertEquals(paywallEntrySource({ type: 'profile_upgrade', entry: 'profile_tab' }), {})
  assertEquals(paywallEntrySource({ type: 'quota_exhausted' }), {})
})

Deno.test('PaywallProfileUpgrade: metin seti kaynaktan seçilir; ProHero varsayılanı eski metin', () => {
  const src = read('../../components/paywalls/PaywallProfileUpgrade/index.tsx')
  assertMatch(src, /isMoodGauntletEntryTrigger\(variant\.trigger\) \? 'gauntlet' : 'search'/)
  assertMatch(src, /<ProHero hideSubhead=\{ctx\.trialShown\} copy=\{copy\} \/>/)
  assertMatch(src, /<ProBenefits copy=\{copy\} \/>/)
  const hero = read('../../components/paywalls/ProHero/index.tsx')
  assertMatch(hero, /copy = 'search'/)
  assertEquals((hero.match(/gauntletBenefit\dTitle/g) ?? []).length, 3)
  const cp = read('../../components/paywalls/ContextualPaywall.tsx')
  assertMatch(cp, /\.\.\.paywallEntrySource\(variant\.trigger\),/)
})

// ── Bayrak kapalı regresyon ──────────────────────────────────────────────────

Deno.test('bayrak kapalı: giriş kartı yalnız moodGauntletOn ile çizilir, yükseklik 0', () => {
  const shell = read('../../components/gauntlet/GauntletShell/index.tsx')
  assertMatch(shell, /const showMoodEntry =\n\s+moodGauntletOn &&/)
  assertMatch(shell, /entry: showMoodEntry,/)
  assertMatch(shell, /\{showMoodEntry && countdownTarget !== null && \(/)
  const below = read('../../components/gauntlet/GauntletShell/useBelowHeight.ts')
  assertMatch(below, /entry: 0,/)
  assertMatch(below, /\(rendered\.entry \? heights\.entry : 0\)/)
})

Deno.test('peek daveti giriş kartıyla birlikte görünmez: bayrak açıkken moodOfferEnabled kapalı', () => {
  const shell = read('../../components/gauntlet/GauntletShell/index.tsx')
  assertMatch(shell, /const moodOfferEnabled = peekOfferEnabled && !moodGauntletOn/)
})

Deno.test('profil olayları yalnız bayrak açıkken; satır davranışı (router.push) aynı', () => {
  const src = read('../../app/(tabs)/profile.tsx')
  assertMatch(src, /const proEntryReady = moodGauntletOn && !proAccess\.loading && !proAccess\.error/)
  assertMatch(src, /if \(proEntryReady\) \{\n\s+posthogAnalytics\.track\('pro_entry_tapped', \{ surface: 'profile', is_pro: proAccess\.allowed \}\)/)
  assertMatch(src, /router\.push\('\/pro-mode' as never\)/)
})

// ── Olaylar ─────────────────────────────────────────────────────────────────

Deno.test('pro_entry_viewed: oturumda yüzey başına bir kez', () => {
  const tr = createEntryViewedTracker()
  assert(tr.claim('champion'))
  assert(!tr.claim('champion'))
  assert(tr.claim('profile'))
  assert(!tr.claim('profile'))
})

Deno.test('kart olayları: viewed {surface}, tapped {surface,is_pro}; paywall kaynağı etiketi', () => {
  const card = read('../../components/gauntlet/MoodEntryCard/index.tsx')
  assertMatch(card, /track\('pro_entry_viewed', \{ surface: 'champion' \}\)/)
  assertMatch(card, /track\('pro_entry_tapped', \{ surface: 'champion', is_pro: allowed \}\)/)
  assertMatch(card, /type: 'profile_upgrade', entry: MOOD_GAUNTLET_ENTRY_SOURCE/)
})

// ── Metin ───────────────────────────────────────────────────────────────────

Deno.test('saat biçimi HH:MM iki haneli', () => {
  assertEquals(formatEntryTime(new Date(2026, 10, 1, 8, 5)), '08:05')
  assertEquals(formatEntryTime(new Date(2026, 10, 1, 18, 0)), '18:00')
})

Deno.test('locales: moodEntry + paywallPro.gauntlet* en/tr parite, dolu, yer tutucu doğru', () => {
  const en = JSON.parse(read('../../locales/en.json'))
  const tr = JSON.parse(read('../../locales/tr.json'))
  for (const [lang, d] of [['en', en], ['tr', tr]] as const) {
    for (const k of ['title', 'subtitle', 'badge']) assert(String(d.moodEntry[k]).length > 0, `${lang}.moodEntry.${k}`)
    assertMatch(d.moodEntry.title, /%\{time\}/)
  }
  // TR başlık ek KULLANMAZ: saat, ek almayan bir kalıpta ("Sonraki dörtlü: HH:MM · ...")
  assertEquals(tr.moodEntry.title, 'Sonraki dörtlü: %{time} · Beklemek istemiyor musun?')
  assertEquals(en.moodEntry.title, "Next four at %{time} · Can't wait?")
  assert(!/suffix/.test(JSON.stringify(tr.moodEntry)), 'tr.moodEntry yer tutucu olarak suffix içermemeli')
  assert(!/Suffix/.test(read('../../utils/moodEntry.ts')), 'belirtme eki kodu silinmiş olmalı')
  assertEquals(en.paywallPro.gauntletBenefit3Title, 'Any mood, any night')
  assertEquals(tr.paywallPro.gauntletBenefit3Title, 'Her akşam, her mood')
  assertEquals(en.moodEntry.subtitle, 'Pick by mood — four films, three choices, one pick')
  const gk = Object.keys(en.paywallPro).filter((k) => k.startsWith('gauntlet')).sort()
  assertEquals(gk, Object.keys(tr.paywallPro).filter((k) => k.startsWith('gauntlet')).sort())
  assertEquals(gk.length, 9)
  assertEquals(en.paywallPro.gauntletHeadline, 'Your mood, your four — anytime')
  assertEquals(tr.paywallPro.gauntletHeadline, "Mood'una göre dörtlü, istediğin an")
  assertMatch(tr.paywallPro.gauntletBenefit1Title, /^4 film/)
})
