/**
 * F2.3 — şampiyon ekranının fold geometrisi: dinamik hero + Spotlight kartı.
 * Run: npm run test:champion
 *
 * NE KANITLAR: `heroHeight` (ChampionReveal/heroHeight.ts) altındaki içerikle
 * birlikte hesaplandığında Watch now satırı ve Spotlight kartı hangi pencerede
 * kaydırmasız görünür; S-1 dwell ölçütü (`isCardFullyVisible`) ve F2.3
 * görünürlük ölçütü (`cardVisibleFraction`) bu geometriyle nasıl davranır.
 * NE KANITLAMAZ: cihazdaki gerçek onLayout değerlerini ve 8 sn / 1 sn
 * zamanlayıcılarını (RN hook'ları, Deno'da koşmaz) — cihaz doğrulaması gerekir.
 *
 * ── VARSAYIMLAR (ölçüm DEĞİL) ────────────────────────────────────────────────
 * 1. ScrollView viewport yüksekliği = pencere yüksekliği (champion dalında
 *    `insetLayer` dolgusuz).
 * 2. Tab bar payı T = 49pt bar + alt güvenli alan: Face ID 83, SE 49.
 *    Kaydırma içeriğinin alt boşluğu `space.lg` (24) hero hesabına girer.
 * 3. Yükseklikler lineHeight tokenlarından, varsayılan Dynamic Type. LAYOUT
 *    her satırda kaynağını yazar; stil değişirse bu model de güncellenmeli.
 */

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { heroHeight } from '../../components/gauntlet/ChampionReveal/heroHeight.ts'
import { TITLE_OVERLAP } from '../../components/gauntlet/ChampionReveal/heroScrim.ts'
import {
  isSpotlightPlayable,
  spotlightCardStateFrom,
} from '../../components/gauntlet/SpotlightBonusCard/cardState.ts'
import { cardVisibleFraction } from '../../components/gauntlet/SpotlightBonusCard/visibility.ts'
import { isCardFullyVisible } from '../../utils/askDecision.ts'
import {
  MOOD_ENTRY_CARD_HEIGHT,
  MOOD_ENTRY_MARGIN,
  MOOD_ENTRY_RESERVE_HEIGHT,
  moodEntryFits,
} from '../../utils/moodEntry.ts'

const T_FACE_ID = 83
const T_SE = 49
/** `SCROLL_BOTTOM_GAP` (ChampionReveal) = space.lg */
const SCROLL_GAP = 24

/** Düzen modeli (pt). */
const LAYOUT = {
  /** `kicker` label-caps lineHeight 16 + `kickerInBody.marginBottom` space.sm */
  kicker: 16 + 8,
  /** `title` lineHeight 44 (kademe dışı başlık) */
  titleLine: 44,
  /** `body.gap` space.md */
  bodyGap: 12,
  /** `metaLine` meta lineHeight */
  meta: 16,
  /** Home-A1.1 WatchOptionsCard: padding 2×16 + başlık 24 + logo 40 + "Ülke · Özet" 18 + atıf 18 + 3 boşluk × 4 (bölge satırı kalktı: 166 → 144) */
  providers: 32 + 24 + 40 + 18 + 18 + 12,
  /** `actionsWrapper.gap` space.sm (Home-A1: Pro Result ile aynı token) */
  wrapperGap: 8,
  /** Save · Share satırı (ikon + metin): size.actionHeight */
  actionsRow: 48,
  /** `bonusCardInline.marginTop` space.lg */
  cardMargin: 24,
  /** SpotlightBonusCard TÜM durumlar (Home-B1.2 B+ `cardTall`): 2 × space.sm + 56pt içerik — bitmiş artık kısalmaz */
  card: 8 + 56 + 8,
  /** CycleRow: marginTop space.base + caption 18 */
  cycle: 16 + 18,
  /** CycleRow + "Remind me" 44pt satırı */
  cycleRemind: 16 + 44,
  /** ArchiveTrigger: paddingTop 12 + caption 18 (yalnız missedCount > 0) */
  archive: 12 + 18,
  /** Home-B2 MoodEntryCard: marginTop 16 + minHeight 92 (Spotlight kartı ile CycleRow arası; yalnız sığarsa) */
  entry: MOOD_ENTRY_MARGIN + MOOD_ENTRY_CARD_HEIGHT,
}

interface Scenario {
  windowHeight: number
  tabBar: number
  /** Başlık satırı sayısı (1–3) */
  titleLines?: number
  remind?: boolean
  archive?: boolean
  /** Dynamic Type ile gövdenin eklenen yüksekliği */
  extraBody?: number
  /** Spotlight kartı yüksekliği; B+ ile tüm durumlarda 72 (varsayılan). */
  card?: number
  /** Pro kartı (Home-B2) çiziliyor mu — çağıran `moodEntryFits` ile karar verir. */
  entry?: boolean
}

/** ScrollView içerik koordinatları: hero + Watch now satırı + kart. */
function geometry(s: Scenario) {
  const body =
    LAYOUT.kicker +
    LAYOUT.titleLine * (s.titleLines ?? 1) +
    LAYOUT.bodyGap +
    LAYOUT.meta +
    LAYOUT.bodyGap +
    LAYOUT.providers +
    LAYOUT.wrapperGap +
    LAYOUT.actionsRow +
    (s.extraBody ?? 0)
  const below =
    LAYOUT.cardMargin +
    (s.card ?? LAYOUT.card) +
    (s.remind ? LAYOUT.cycleRemind : LAYOUT.cycle) +
    (s.archive ? LAYOUT.archive : 0) +
    (s.entry ? LAYOUT.entry : 0)
  const contentH = body - TITLE_OVERLAP + below
  const hero = heroHeight(s.windowHeight, contentH, s.tabBar + SCROLL_GAP)
  const bodyTop = hero - TITLE_OVERLAP
  return {
    hero,
    contentH,
    watchNowBottom: bodyTop + body,
    cardY: bodyTop + body + LAYOUT.cardMargin,
    cardHeight: s.card ?? LAYOUT.card,
    viewportHeight: s.windowHeight,
    bottomInset: s.tabBar,
    totalContent: hero + contentH + s.tabBar + SCROLL_GAP,
  }
}

function fraction(s: Scenario, scrollY = 0): number {
  return cardVisibleFraction({ ...geometry(s), scrollY })
}

// ── F2.3 kabul: ≥ 812pt'de Watch now satırı + kartın TAMAMI kaydırmasız ──────

Deno.test('≥812pt: Watch now satırı ve Spotlight kartının tamamı kaydırmasız görünür', () => {
  for (const h of [812, 844, 852, 874, 932, 956]) {
    const s = { windowHeight: h, tabBar: T_FACE_ID }
    const g = geometry(s)
    assert(g.watchNowBottom <= h - T_FACE_ID, `${h}pt Watch now satırı`)
    assertEquals(fraction(s), 1, `${h}pt kart`)
    assertEquals(isCardFullyVisible({ ...g, scrollY: 0 }), true, `${h}pt dwell`)
  }
})

Deno.test("667pt (SE): Watch now görünür, kartın en az üst 24pt'si görünür", () => {
  const se = { windowHeight: 667, tabBar: T_SE }
  const g = geometry(se)
  assert(g.watchNowBottom <= 667 - T_SE, 'Watch now satırı')
  assert(fraction(se) * g.cardHeight >= 24, "kartın üst 24pt'si")
})

Deno.test('667pt en kötü durum (3 satır başlık + Remind + arşiv + büyük yazı): hero 160, Watch now görünür, kaydırılabilir', () => {
  const worst = {
    windowHeight: 667,
    tabBar: T_SE,
    titleLines: 3,
    remind: true,
    archive: true,
    extraBody: 60,
  }
  const g = geometry(worst)
  assertEquals(g.hero, 160)
  assert(g.watchNowBottom <= 667 - T_SE, 'Watch now satırı')
  assert(fraction(worst) * g.cardHeight >= 24, "kartın üst 24pt'si")
  assert(g.totalContent > 667, "içerik viewport'tan uzun → kaydırma çalışır")
})

Deno.test('hero hiçbir senaryoda [160, %42] dışına çıkmaz', () => {
  for (const h of [568, 667, 812, 852, 956]) {
    for (const extra of [0, 60, 200]) {
      const g = geometry({ windowHeight: h, tabBar: T_FACE_ID, extraBody: extra })
      assert(g.hero >= 160, `${h}/${extra} alt sınır`)
      assert(g.hero <= Math.round(h * 0.42), `${h}/${extra} üst sınır`)
    }
  }
})

// ── Görünürlük ölçüsü (spotlight_card_visible) ───────────────────────────────

Deno.test('cardVisibleFraction: tam, yarım, görünmez, ölçüsüz', () => {
  const m = { cardY: 500, cardHeight: 72, scrollY: 0, viewportHeight: 800, bottomInset: 83 }
  assertEquals(cardVisibleFraction(m), 1)
  // görünür alan 0–717; kartın alt 36pt'si tab bar altında → tam %50
  assertEquals(cardVisibleFraction({ ...m, cardY: 681 }), 36 / 72)
  assertEquals(cardVisibleFraction({ ...m, cardY: 717 }), 0)
  assertEquals(cardVisibleFraction({ ...m, cardHeight: 0 }), 0)
  assertEquals(cardVisibleFraction({ ...m, viewportHeight: 0 }), 0)
})

Deno.test('kart mount edilmeden (yükseklik 0) dwell kurulmaz — giriş gecikmesi', () => {
  const g = geometry({ windowHeight: 956, tabBar: T_FACE_ID })
  assertEquals(isCardFullyVisible({ ...g, scrollY: 0, cardHeight: 0 }), false)
})

// ── Kart durumu ──────────────────────────────────────────────────────────────

Deno.test('spotlightCardStateFrom: dört durum', () => {
  assertEquals(spotlightCardStateFrom(null), 'not_started')
  assertEquals(spotlightCardStateFrom(undefined), 'not_started')
  assertEquals(spotlightCardStateFrom({ completed: false, won: false }), 'in_progress')
  assertEquals(spotlightCardStateFrom({ completed: true, won: true }), 'solved')
  assertEquals(spotlightCardStateFrom({ completed: true, won: false }), 'failed')
})

Deno.test('bitmiş oyun yeniden oynatılabilir görünmez (K-22)', () => {
  assertEquals(isSpotlightPlayable('not_started'), true)
  assertEquals(isSpotlightPlayable('in_progress'), true)
  assertEquals(isSpotlightPlayable('solved'), false)
  assertEquals(isSpotlightPlayable('failed'), false)
})

// ── Home-B1.2 (B+): kart TÜM durumlarda 72pt — bitmiş dahil ilk ekranda ────────

Deno.test('Home-B1.2: bitmiş kart da 72pt; ≥812pt ve SE (667pt) için kaydırmasız TAMAMEN görünür', () => {
  for (const h of [667, 812, 852, 932]) {
    const s = { windowHeight: h, tabBar: h === 667 ? T_SE : T_FACE_ID }
    const g = geometry(s)
    assertEquals(g.cardHeight, 72, `${h}pt bitmiş kart yüksekliği`)
    assertEquals(fraction(s), 1, `${h}pt bitmiş kart`)
    assert(g.cardY + g.cardHeight <= h - s.tabBar, `${h}pt: kart tab bar'ın üstünde`)
  }
})

Deno.test('Home-B1: oynanabilir kart (72pt) SE ve iPhone 15 ilk ekranında; en kötü durumda üst 24pt görünür', () => {
  for (const [h, tab] of [
    [667, T_SE],
    [852, T_FACE_ID],
  ] as const) {
    const s = { windowHeight: h, tabBar: tab }
    const g = geometry(s)
    assertEquals(fraction(s), 1, `${h}pt oynanabilir kart`)
    assert(g.cardY + g.cardHeight <= h - tab)
  }
  const worst = { windowHeight: 667, tabBar: T_SE, titleLines: 3, remind: true, archive: true, extraBody: 60 }
  assert(fraction(worst) * LAYOUT.card >= 24, "SE en kötü: kartın üst 24pt'si")
})

Deno.test('Home-B1.2: durum değişince düzen kaymaz — kart yüksekliği sabit 72, hero [160, %42] içinde', () => {
  assertEquals(LAYOUT.card, 72)
  for (const h of [667, 852]) {
    const tab = h === 667 ? T_SE : T_FACE_ID
    const g = geometry({ windowHeight: h, tabBar: tab })
    assert(g.hero >= 160 && g.hero <= Math.round(h * 0.42))
  }
})

// ── Home-B2: Pro kartı (92 + 16) — iPhone 15'te görünür, SE'de gizli ──────────────

/** Kabuğun `moodEntryFits` girdisi: kart HARİÇ alt içerik (Spotlight kartı + CycleRow + isteğe bağlı arşiv). */
function entryFits(s: Scenario): boolean {
  const belowWithoutEntry =
    LAYOUT.cardMargin + (s.card ?? LAYOUT.card) + (s.remind ? LAYOUT.cycleRemind : LAYOUT.cycle) + (s.archive ? LAYOUT.archive : 0)
  return moodEntryFits({ screenH: s.windowHeight, belowWithoutEntry, tabInset: s.tabBar, fontScale: 1 })
}

Deno.test('Home-B2: Pro kartı yeri 108pt (16 + 92)', () => {
  assertEquals(LAYOUT.entry, 108)
  assertEquals(MOOD_ENTRY_RESERVE_HEIGHT, 108)
})

Deno.test('Home-B2: iPhone 15 (852pt) — Pro kartı sığar; Watch now ve Spotlight kartı yine kaydırmasız tam görünür', () => {
  const base = { windowHeight: 852, tabBar: T_FACE_ID }
  assertEquals(entryFits(base), true)
  const s = { ...base, entry: true }
  const g = geometry(s)
  assert(g.hero >= 160 && g.hero <= Math.round(852 * 0.42), 'hero sınırları')
  assert(g.watchNowBottom <= 852 - T_FACE_ID, 'Watch now satırı')
  assertEquals(fraction(s), 1, 'Spotlight kartı tam görünür')
  assertEquals(isCardFullyVisible({ ...g, scrollY: 0 }), true, 'dwell ölçütü')
})

Deno.test('Home-B2: ≥812pt Face ID cihazlarda Pro kartı sığar ve Spotlight ilk ekranda kalır', () => {
  for (const h of [812, 844, 852, 874, 932, 956]) {
    const s = { windowHeight: h, tabBar: T_FACE_ID, entry: true }
    assertEquals(entryFits(s), true, `${h}pt sığar`)
    assertEquals(fraction(s), 1, `${h}pt Spotlight kartı`)
  }
})

Deno.test('Home-B2: SE (667pt) — Pro kartı GİZLİ; düzen Home-B1.2 ile birebir (Spotlight tam görünür)', () => {
  const se = { windowHeight: 667, tabBar: T_SE }
  assertEquals(entryFits(se), false, 'moodEntryFits SE\'de false')
  // Gizliyken `entry` eklenmez → B1.2 geometrisi korunur.
  assertEquals(geometry(se).contentH, geometry({ ...se, entry: false }).contentH)
  assertEquals(fraction(se), 1)
  const g = geometry(se)
  assert(g.cardY + g.cardHeight <= 667 - T_SE, "Spotlight kartı tab bar'ın üstünde")
  // En kötü durum (3 satır başlık + Remind + arşiv) da gizli
  assertEquals(entryFits({ ...se, remind: true, archive: true }), false)
})

Deno.test('Home-B2: büyük yazı ölçeğinde (>1.3) Pro kartı 852pt\'de bile gizlenir', () => {
  assertEquals(
    moodEntryFits({
      screenH: 852,
      belowWithoutEntry: LAYOUT.cardMargin + LAYOUT.card + LAYOUT.cycle,
      tabInset: T_FACE_ID,
      fontScale: 1.31,
    }),
    false,
  )
})
