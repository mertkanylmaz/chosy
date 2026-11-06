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
  MOOD_ENTRY_CARD_HEIGHT,
  MOOD_ENTRY_MAX_FONT_SCALE,
  MOOD_ENTRY_RESERVE_HEIGHT,
  MOOD_GAUNTLET_ENTRY_SOURCE,
  moodEntryContent,
  moodEntryFits,
  moodEntryTapTarget,
  moodEntryVariant,
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

Deno.test('Home-B2 varyant: yetki → open, yetkisiz → explore; dokunuş yönüyle tutarlı', () => {
  assertEquals(moodEntryVariant(true), 'open')
  assertEquals(moodEntryVariant(false), 'explore')
  for (const allowed of [true, false]) {
    assertEquals(moodEntryTapTarget(allowed) === 'pro_mode', moodEntryVariant(allowed) === 'open')
  }
})

Deno.test('Home-B2 içerik eşlemesi: ortak başlık; explore çipli, open çipsiz (rozet/çip yok)', () => {
  const explore = moodEntryContent('explore')
  const open = moodEntryContent('open')
  assertEquals(explore.titleKey, 'moodEntry.cardTitle')
  assertEquals(open.titleKey, explore.titleKey)
  assertEquals(explore.subtitleKey, 'moodEntry.subtitleExplore')
  assertEquals(open.subtitleKey, 'moodEntry.subtitleOpen')
  assertEquals(explore.chipKey, 'moodEntry.chipExplore')
  assertEquals(open.chipKey, null)
  assertEquals(explore.hintKey, 'moodEntry.hintExplore')
  assertEquals(open.hintKey, 'moodEntry.hintOpen')
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

Deno.test('pro_entry_viewed: oturumda YÜZEY BAŞINA bir kez (CTO: profile + champion iki ayrı yüzey, çift değil)', () => {
  const tr = createEntryViewedTracker()
  assert(tr.claim('champion'))
  assert(!tr.claim('champion'))
  assert(tr.claim('profile'), 'ikinci yüzey kendi olayını üretir')
  assert(!tr.claim('profile'))
  const other = createEntryViewedTracker()
  assert(other.claim('profile'), 'yeni oturum (yeni izleyici) yine sayar')
  assert(other.claim('champion'))
  // Her iki yüzey de AYNI paylaşılan izleyiciyi kullanır (iki ayrı izleyici = çift olay)
  const profile = read('../../app/(tabs)/profile.tsx')
  assertMatch(profile, /import \{[^}]*entryViewed[^}]*\} from '@\/components\/gauntlet\/MoodEntryCard'/)
  assertMatch(profile, /entryViewed\.claim\('profile'\)/)
})

Deno.test('kart olayları: viewed {surface}, tapped {surface,is_pro}; paywall kaynağı etiketi', () => {
  const card = read('../../components/gauntlet/MoodEntryCard/index.tsx')
  assertMatch(card, /track\('pro_entry_viewed', \{ surface: 'champion' \}\)/)
  assertMatch(card, /track\('pro_entry_tapped', \{ surface: 'champion', is_pro: allowed \}\)/)
  assertMatch(card, /type: 'profile_upgrade', entry: MOOD_GAUNTLET_ENTRY_SOURCE/)
})

// ── Görünüm (Home-B2) ────────────────────────────────────────────────────────

Deno.test('Home-B2 kart: mutlak saat yok, eski anahtarlar kullanılmıyor, a11y etiket+ipucu, çip koşullu', () => {
  const card = read('../../components/gauntlet/MoodEntryCard/index.tsx')
  assert(!/formatEntryTime|nextFourAt/.test(card), 'mutlak saat karttan kalktı')
  assert(!/moodEntry\.(title|subtitle|badge)\b/.test(card), 'eski anahtarlar kullanım dışı')
  assertMatch(card, /accessibilityLabel=\{`\$\{title\}\. \$\{subtitle\}`\}/)
  assertMatch(card, /accessibilityHint=\{t\(content\.hintKey\)\}/)
  assertMatch(card, /content\.chipKey !== null && \(/)
  assertMatch(card, /moodEntryContent\(moodEntryVariant\(allowed\)\)/)
  const shell = read('../../components/gauntlet/GauntletShell/index.tsx')
  assertMatch(shell, /<MoodEntryCard \/>/)
  // Rota / tetikleyici / kota: değişmez
  assertMatch(card, /router\.push\(\{ pathname: '\/pro-mode', params: \{ entry: 'champion' \} \}\)/)
  assertMatch(card, /type: 'profile_upgrade', entry: MOOD_GAUNTLET_ENTRY_SOURCE/)
  assert(!/withQuota|fetchSearchQuota|get_quota_status/.test(card), 'kart kota okumaz (yeni RPC yok)')
})

Deno.test('Home-B2 stil: yükseklik 92 kalır, altın/marquee yok', () => {
  assertEquals(MOOD_ENTRY_CARD_HEIGHT, 92)
  const styles = read('../../components/gauntlet/MoodEntryCard/styles.ts')
  assert(!/marquee|gold/i.test(styles))
})

// ── Metin ───────────────────────────────────────────────────────────────────

Deno.test('Home-B2 locales: eşlemedeki her anahtar en/tr dolu; "free" vaadi yok; eski anahtarlar yerinde', () => {
  const en = JSON.parse(read('../../locales/en.json'))
  const tr = JSON.parse(read('../../locales/tr.json'))
  const pick = (d: Record<string, Record<string, string>>, key: string): string => d.moodEntry[key.replace('moodEntry.', '')]
  for (const variant of ['explore', 'open'] as const) {
    const c = moodEntryContent(variant)
    const keys = [c.titleKey, c.subtitleKey, c.hintKey, ...(c.chipKey ? [c.chipKey] : [])]
    for (const k of keys) {
      for (const [lang, d] of [['en', en], ['tr', tr]] as const) {
        const v = pick(d, k)
        assert(typeof v === 'string' && v.length > 0, `${lang}.${k}`)
        assert(!/free|ücretsiz|bedava/i.test(v), `${lang}.${k} "free" vaadi içermemeli`)
      }
    }
  }
  assertEquals(en.moodEntry.cardTitle, 'Pick a film for your mood')
  assertEquals(tr.moodEntry.cardTitle, 'Ruh hâline göre film seç')
  assertEquals(en.moodEntry.chipExplore, 'Explore Pro')
  assertEquals(tr.moodEntry.chipExplore, "Pro'yu keşfet")
  assertEquals(en.moodEntry.subtitleOpen, 'Open Pro Mode')
  assertEquals(tr.moodEntry.subtitleOpen, "Pro Mode'u aç")
  assertEquals(Object.keys(en.moodEntry).sort(), Object.keys(tr.moodEntry).sort())
  // Eski anahtarlar SİLİNMEZ (karar); kullanım dışı — kart onlara başvurmaz (görünüm commit'inde kilitli).
  for (const k of ['title', 'subtitle', 'badge']) {
    assert(String(en.moodEntry[k]).length > 0 && String(tr.moodEntry[k]).length > 0, `eski moodEntry.${k}`)
  }
})

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
  assertEquals(en.moodEntry.subtitle, '4 films · 3 choices · 1 pick')
  assertEquals(tr.moodEntry.subtitle, '4 film · 3 seçim · 1 film')
  const gk = Object.keys(en.paywallPro).filter((k) => k.startsWith('gauntlet')).sort()
  assertEquals(gk, Object.keys(tr.paywallPro).filter((k) => k.startsWith('gauntlet')).sort())
  assertEquals(gk.length, 9)
  assertEquals(en.paywallPro.gauntletHeadline, 'Your mood, your four — anytime')
  assertEquals(tr.paywallPro.gauntletHeadline, "Mood'una göre dörtlü, istediğin an")
  assertMatch(tr.paywallPro.gauntletBenefit1Title, /^4 film/)
})
