/**
 * CineMetrics — StyleSheet definitions.
 *
 * ── 1 Ağu 2026 yeniden yazımı ─────────────────────────────────────────────
 * Eski dosya 6 sabit sütunlu bir tabloyu tarif ediyordu (`FILM_COL_W`,
 * `DATA_COL_W`, `columnHeaders`, `guessRow`, `cell*`) ve `ResultCard`'a
 * geçildiğinden beri referanssız kalmış ~120 satır ölü stil taşıyordu
 * (`completedPoster`, `wonMessage`, `xpChip`, `shareButton`, `retryButton`,
 * `offscreenCard`…). İkisi de silindi.
 *
 * Yeni dil: tahmin = kart, öznitelik = çip. Çipler 3'erli sarılır, kartlar
 * arası hizalama korunur.
 */
import { Dimensions, StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { withAlpha, type GameTheme } from '@/constants/gameThemes';
import { Theme } from '@/constants/theme';
import { gameContentWidth } from '@/constants/gameLayout';

const { width: SCREEN_W } = Dimensions.get('window');

/**
 * Kullanılabilir genişlik — GameShell'in verdiği yatay padding düşülmüş hali.
 * Sözleşme: constants/gameLayout.ts
 */
const CONTENT_W = gameContentWidth(SCREEN_W);

/** Kartın iç boşluğu — concentric hesabın girdisi */
const CARD_PADDING = Theme.spacing.md;
/** Çipler arası boşluk */
const CHIP_GAP = Theme.spacing.sm;
/** Satır başına 3 çip — sabit ızgara, kartlar arası sütun karşılaştırması korunur */
const CHIPS_PER_ROW = 3;
/** Çip genişliği: kart içi alandan boşluklar düşülüp 3'e bölünür */
const CHIP_W = (CONTENT_W - CARD_PADDING * 2 - CHIP_GAP * (CHIPS_PER_ROW - 1)) / CHIPS_PER_ROW;

/** Kartın dış yarıçapı — çip yarıçapı bundan concentric türetilir */
const CARD_RADIUS = Theme.borderRadius.xl;

export { SCREEN_W, CHIP_W };

export const createStyles = (theme: GameTheme) => {
  /** Accent'in hairline hali — %22 alfa */
  const accentHairline = withAlpha(theme.accent, 0.22);

  return StyleSheet.create({
  /**
   * Tek sayfa kabı — ScrollView YOK (Festival Layer Kural 7).
   * Yatay padding GameShell'den; burası yalnız dikey akışı kurar.
   */
  screen: {
    flex: 1,
    paddingBottom: Theme.spacing.sm,
  },
  /** Esnek boşluk — aksiyon barını dibe iter, içerik yukarıda toplanır */
  spacer: {
    flex: 1,
    minHeight: Theme.spacing.sm,
  },

  // ─── Geçmiş şeridi ─────────────────────────────────────────────────────────
  /**
   * Son tahminden önceki tahminler. Her biri tek satır: film adı + 6 renk
   * noktası. Altı açık kart tek sayfaya sığmadığı için (6 × 148px ≈ 890px,
   * kullanılabilir alan ≈ 480px) karşılaştırma renk desenine indirgendi —
   * Wordle'ın kendi çözümü.
   */
  history: {
    gap: 2,
    marginBottom: Theme.spacing.sm,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    paddingVertical: 5,
  },
  historyTitle: {
    flex: 1,
    ...Theme.typography.caption,
    color: Colors.textSecondary,
  },
  historyDots: {
    flexDirection: 'row',
    gap: 4,
  },
  /**
   * Nokta ölçüsü: 10px'in altında renk ayrımı iPhone SE'de kayboluyor.
   * Renk stilleri çiplerle ORTAK (`chipGreen`/`chipYellow`/`chipGray`) —
   * geçmiş ve açık kart aynı dili konuşmalı.
   */
  historyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
  },

  /** Kalan hak + legend tek şeritte — Kural 7 dikey bütçesi dar */
  metaRow: {
    gap: Theme.spacing.xs,
    paddingBottom: Theme.spacing.sm,
  },

  // ─── Üst şerit: puzzle no + zorluk ─────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Theme.spacing.sm,
    marginBottom: Theme.spacing.sm,
  },
  puzzleNo: {
    ...Theme.typography.eyebrow,
  },
  difficultyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  difficultyText: {
    ...Theme.typography.micro,
    fontWeight: '600',
  },

  // ─── Tahmin kartı ──────────────────────────────────────────────────────────
  /**
   * İÇERİK yüzeyi — cam DEĞİL. Tahmin geçmişi kartı Kural 5'in üç sorusundan
   * hiçbirini geçmiyor (dokunulamaz, state değiştirmez, seçili hali yok):
   * düz `bgCard` + accent hairline. Cam yalnız chrome katmanında.
   */
  guessCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: accentHairline,
    padding: CARD_PADDING,
    marginBottom: Theme.spacing.sm,
  },
  /** Film adı = "yayın" öğesi, serif (Kural 2) */
  guessTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: Theme.fonts.display,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: Colors.textPrimary,
    marginBottom: Theme.spacing.md,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CHIP_GAP,
  },

  // ─── Öznitelik çipi ────────────────────────────────────────────────────────
  /**
   * Concentric: kart radius'u CARD_RADIUS, iç boşluk CARD_PADDING →
   * çipin radius'u aradaki farktan türetilir, köşeler eş merkezli görünür.
   */
  chip: {
    width: CHIP_W,
    borderRadius: Theme.concentric(CARD_RADIUS, CARD_PADDING),
    borderWidth: 1,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.sm,
    minHeight: 52,
    justifyContent: 'center',
  },
  /** Etiket artık kolon başlığında değil çipin içinde — 9px tipografi gerekmiyor */
  chipLabel: {
    ...Theme.typography.eyebrow,
    fontSize: 9,
    letterSpacing: 1.1,
    marginBottom: 2,
  },
  chipValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  chipValue: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
  },

  /**
   * Geri bildirim yüzeyleri. Kural 1: çip yüzeyi düz doygun semantik renge
   * BOYANMAZ — kenarlık + düşük alfa yıkama + renkli metin ile verilir.
   * Eski hâli `backgroundColor: '#22C55E'` gibi tam doygun dolgulardı.
   */
  chipGreen: {
    borderColor: Colors.greenBright,
    backgroundColor: Colors.successWash,
  },
  chipYellow: {
    borderColor: Colors.gold,
    backgroundColor: Colors.goldSeal,
  },
  chipGray: {
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.white05,
  },
  /** Flip'in ilk yarısı — değer henüz görünmüyor */
  chipPending: {
    borderColor: Colors.borderSubtle,
    backgroundColor: 'transparent',
  },
  chipValueGreen: {
    color: Colors.greenBright,
  },
  chipValueYellow: {
    color: Colors.gold,
  },
  chipValueGray: {
    color: Colors.textSecondary,
  },

  // ─── Kalan deneme göstergesi ───────────────────────────────────────────────
  /**
   * Eskiden burada 36 boş hairline kutu vardı ve ekran ilk açılışta boş bir
   * tabloya benziyordu. Artık tek satır: kaç hakkın kaldı.
   */
  remainingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.xs,
  },
  remainingPip: {
    width: 8,
    height: 8,
    borderRadius: Theme.borderRadius.xs,
    backgroundColor: Colors.white10,
  },
  /** Sıradaki deneme — accent, "sıra sende" sinyali */
  remainingPipActive: {
    backgroundColor: theme.accent,
  },
  remainingText: {
    ...Theme.typography.caption,
    marginLeft: Theme.spacing.xs,
  },

  // ─── Legend ────────────────────────────────────────────────────────────────
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  /** Çip dilinin küçültülmüş hâli — legend ile çipler aynı şeyi göstermeli */
  legendSwatch: {
    width: 14,
    height: 14,
    borderRadius: Theme.borderRadius.xs,
    borderWidth: 1,
  },
  legendText: {
    ...Theme.typography.caption,
    color: Colors.textTertiary,
  },

  // ─── Aksiyon barı (chrome — cam) ───────────────────────────────────────────
  /**
   * Aksiyon barı — artık YÜZMÜYOR, normal akışta ekranın dibinde.
   *
   * Eskiden `position: 'absolute'` + `GlassSurface` idi; gerekçesi "içerik
   * altından akıyor"du. Kural 7 (oynanış tek sayfa) ile ekran kaymayı bıraktı,
   * yani altından geçecek içerik kalmadı — cam orada Kural 5'in derinlik
   * testini geçmezdi ve dekorasyona düşerdi.
   */
  inputArea: {
    paddingTop: Theme.spacing.sm,
  },
  submitButton: {
    marginTop: Theme.spacing.sm,
    backgroundColor: theme.accent,
    borderRadius: Theme.borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: theme.accentOn,
  },

  // ─── Completed State ───────────────────────────────────────────────────────
  /** Yatay padding YOK — GameShell veriyor */
  completedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.md,
  },
  });
};
