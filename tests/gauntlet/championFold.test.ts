/**
 * S-2 — şampiyon ekranında Spotlight kartının fold geometrisi + kart durumu.
 * Run: npm run test:champion
 *
 * NE KANITLAR: kartın düzen modeli altında S-1 dwell ölçütü
 * (`isCardFullyVisible`, utils/askDecision.ts) hangi pencerede kaydırmasız
 * sağlanıyor. NE KANITLAMAZ: 8 sn zamanlayıcının ateşlendiğini — o
 * `useChampionAsk`'te (RN hook'u, Deno'da koşmaz) ve cihazda `__DEV__`
 * log'uyla doğrulanır ("[S-2 dwell] …", GauntletShell). Cihaz doğrulaması
 * bekliyor: docs/05_SPRINTS/ACTIVE/V1_TESTFLIGHT_CHECKLIST.md §N.
 *
 * ── VARSAYIMLAR (ölçüm DEĞİL) ────────────────────────────────────────────────
 * 1. ScrollView viewport yüksekliği = pencere yüksekliği. Champion dalında
 *    `insetLayer` dolgusuz (GauntletShell `isChampionView`).
 * 2. Tab bar payı T = 49pt bar + alt güvenli alan: Face ID cihazlarda
 *    49 + 34 = 83, SE'de 49 + 0 = 49. iOS standart değerleri; saha ölçümü
 *    (TabBarInsetTelemetry) Sentry'de bulunamadı (S-2 keşif raporu).
 *    iOS 26 yüzen tab bar'ı farklı olabilir.
 * 3. Yükseklikler lineHeight tokenlarından (constants/design/semantic.ts),
 *    varsayılan Dynamic Type. Aşağıdaki LAYOUT her satırda kaynağını yazar;
 *    stil değişirse bu model de güncellenmeli.
 * 4. "See all" yok, arşiv bağlantısı yok, sağlayıcılar yüklendi (son tur
 *    başında prefetch edilir) — ayrı senaryolar aşağıda.
 */

import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  HERO_HEIGHT_RATIO,
  TITLE_OVERLAP,
} from '../../components/gauntlet/ChampionReveal/heroScrim.ts'
import {
  isSpotlightPlayable,
  spotlightCardStateFrom,
} from '../../components/gauntlet/SpotlightBonusCard/cardState.ts'
import { isCardFullyVisible } from '../../utils/askDecision.ts'

/** Varsayım 2 — tab bar + home indicator. */
const T_FACE_ID = 83
const T_SE = 49

/** Düzen modeli (pt). Kaynaklar: ChampionReveal/styles.ts, WatchProviders/styles.ts, … */
const LAYOUT = {
  /** `kicker` label-caps lineHeight 16 + `kickerInBody.marginBottom` space.sm */
  kicker: 16 + 8,
  /** `title` lineHeight 44 (kademe dışı başlık) */
  titleLine: 44,
  /** `body.gap` space.md */
  bodyGap: 12,
  /** `metaLine` meta lineHeight */
  meta: 16,
  /** WatchProvidersRow: etiket 16 + gap 8 + logo satırı 60 + gap 8 + atıf 18 */
  providers: 16 + 8 + 60 + 8 + 18,
  /** "See all" pill: `logoLine.gap` 12 + caption 18 + 2 × space.sm */
  seeAll: 12 + 34,
  /** `actionsWrapper.gap` space.base */
  wrapperGap: 16,
  /** S-2 yığını: birincil 48 (size.actionHeight) + space.sm + ikon satırı 44 */
  actionsStack: 48 + 8 + 44,
  /** S-2 ÖNCESİ yığın: 3 × 48 + 2 × 8 — gerileme referansı */
  actionsStackLegacy: 3 * 48 + 2 * 8,
  /** ArchiveTrigger: paddingTop 12 + caption 18 (yalnız missedCount > 0) */
  archive: 12 + 18,
  /** `bonusCardInline.marginTop` space.lg */
  cardMargin: 24,
  /** SpotlightBonusCard: 2 × space.sm + 56pt kare */
  card: 8 + 56 + 8,
}

interface Scenario {
  windowHeight: number
  tabBar: number
  titleLines?: 1 | 2
  seeAll?: boolean
  archive?: boolean
  legacyActions?: boolean
  scrollY?: number
}

/** Kartın ScrollView içerik koordinatındaki y'si ve viewport ölçüleri. */
function viewport(s: Scenario) {
  const body =
    LAYOUT.kicker +
    LAYOUT.titleLine * (s.titleLines ?? 1) +
    LAYOUT.bodyGap +
    LAYOUT.meta +
    LAYOUT.bodyGap +
    LAYOUT.providers +
    (s.seeAll ? LAYOUT.seeAll : 0) +
    LAYOUT.wrapperGap +
    (s.legacyActions ? LAYOUT.actionsStackLegacy : LAYOUT.actionsStack)
  const hero = Math.round(s.windowHeight * HERO_HEIGHT_RATIO)
  const cardY =
    hero - TITLE_OVERLAP + body + (s.archive ? LAYOUT.archive : 0) + LAYOUT.cardMargin
  return {
    cardY,
    cardHeight: LAYOUT.card,
    scrollY: s.scrollY ?? 0,
    viewportHeight: s.windowHeight,
    bottomInset: s.tabBar,
  }
}

/** Kartın görünen payı (0–1) — fold içi peek ölçütü için. */
function visibleFraction(s: Scenario): number {
  const v = viewport(s)
  const top = Math.max(v.cardY, v.scrollY)
  const bottom = Math.min(v.cardY + v.cardHeight, v.scrollY + v.viewportHeight - v.bottomInset)
  return Math.max(0, bottom - top) / v.cardHeight
}

// ── Kaydırmasız dwell (kart tamamen görünür) ─────────────────────────────────

Deno.test('844pt (12–14/16e): kart kaydırmasız TAMAMEN görünür → dwell kurulur', () => {
  assertEquals(isCardFullyVisible(viewport({ windowHeight: 844, tabBar: T_FACE_ID })), true)
})

Deno.test('852 / 874 / 932 / 956pt: kart kaydırmasız tamamen görünür', () => {
  for (const h of [852, 874, 932, 956]) {
    assertEquals(isCardFullyVisible(viewport({ windowHeight: h, tabBar: T_FACE_ID })), true, `${h}pt`)
  }
})

Deno.test('S-2 öncesi yığın (3 tam genişlik buton) 844pt\'de kartı fold dışında bırakıyordu', () => {
  const legacy = { windowHeight: 844, tabBar: T_FACE_ID, legacyActions: true }
  assertEquals(isCardFullyVisible(viewport(legacy)), false)
})

// ── Kabul edilen sınırlar (CTO kararı 4, 3 Eki 2026): kaydırma sonrası dwell ──

Deno.test('812pt (mini): tam görünmez — kaydırınca görünür (kabul)', () => {
  assertEquals(isCardFullyVisible(viewport({ windowHeight: 812, tabBar: T_FACE_ID })), false)
  assertEquals(
    isCardFullyVisible(viewport({ windowHeight: 812, tabBar: T_FACE_ID, scrollY: 8 })),
    true,
  )
})

Deno.test('667pt (SE): tam görünmez ama ilk viewport\'ta ≥ %30 peek', () => {
  const se = { windowHeight: 667, tabBar: T_SE }
  assertEquals(isCardFullyVisible(viewport(se)), false)
  assert(visibleFraction(se) >= 0.3, `SE peek ${visibleFraction(se).toFixed(2)}`)
  assertEquals(isCardFullyVisible(viewport({ ...se, scrollY: 60 })), true)
})

Deno.test('2 satır başlık (kırpma yok): 844pt\'de kaydırma gerekir (kabul)', () => {
  const twoLines = { windowHeight: 844, tabBar: T_FACE_ID, titleLines: 2 as const }
  assertEquals(isCardFullyVisible(viewport(twoLines)), false)
  assertEquals(isCardFullyVisible(viewport({ ...twoLines, scrollY: 60 })), true)
})

Deno.test('arşiv bağlantısı: 874pt\'de tam görünür, 844pt\'de kaydırma (kabul)', () => {
  assertEquals(
    isCardFullyVisible(viewport({ windowHeight: 874, tabBar: T_FACE_ID, archive: true })),
    true,
  )
  assertEquals(
    isCardFullyVisible(viewport({ windowHeight: 844, tabBar: T_FACE_ID, archive: true })),
    false,
  )
})

Deno.test('"See all" (+46pt): 932pt\'de tam görünür, 874pt\'de kaydırma (kabul)', () => {
  assertEquals(
    isCardFullyVisible(viewport({ windowHeight: 932, tabBar: T_FACE_ID, seeAll: true })),
    true,
  )
  assertEquals(
    isCardFullyVisible(viewport({ windowHeight: 874, tabBar: T_FACE_ID, seeAll: true })),
    false,
  )
})

Deno.test('kart mount edilmeden (yükseklik 0) dwell kurulmaz — giriş gecikmesi', () => {
  const v = viewport({ windowHeight: 956, tabBar: T_FACE_ID })
  assertEquals(isCardFullyVisible({ ...v, cardHeight: 0 }), false)
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
