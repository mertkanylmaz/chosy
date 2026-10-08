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
  /** WatchProvidersRow: etiket 16 + gap 8 + logo satırı 52 + gap 8 + atıf 18 ("See all" satırın içinde) */
  providers: 16 + 8 + 52 + 8 + 18,
  /** `actionsWrapper.gap` space.base */
  wrapperGap: 16,
  /** Watch now satırı: size.actionHeight */
  actionsRow: 48,
  /** `bonusCardInline.marginTop` space.lg */
  cardMargin: 24,
  /** SpotlightBonusCard: 2 × space.sm + 56pt kare */
  card: 8 + 56 + 8,
  /** CycleRow: marginTop space.base + caption 18 */
  cycle: 16 + 18,
  /** CycleRow + "Remind me" 44pt satırı */
  cycleRemind: 16 + 44,
  /** ArchiveTrigger: paddingTop 12 + caption 18 (yalnız missedCount > 0) */
  archive: 12 + 18,
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
    LAYOUT.card +
    (s.remind ? LAYOUT.cycleRemind : LAYOUT.cycle) +
    (s.archive ? LAYOUT.archive : 0)
  const contentH = body - TITLE_OVERLAP + below
  const hero = heroHeight(s.windowHeight, contentH, s.tabBar + SCROLL_GAP)
  const bodyTop = hero - TITLE_OVERLAP
  return {
    hero,
    contentH,
    watchNowBottom: bodyTop + body,
    cardY: bodyTop + body + LAYOUT.cardMargin,
    cardHeight: LAYOUT.card,
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
