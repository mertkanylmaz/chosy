/**
 * Detective — StyleSheet definitions.
 *
 * Accent: teal-600 (#0D9488)
 * Stage 1 (Investigation): 3x4 grid of 12 smaller film posters
 * Stage 2 (Deduction):     2x3 grid of 6 larger film posters (always visible)
 * Stage 3 (FinalReveal):   Score card, histogram, discovery bridge, actions
 */
import { Dimensions, StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { GAME_THEMES, withAlpha, type GameTheme } from '@/constants/gameThemes';
import { Theme } from '@/constants/theme';
import { gameContentWidth, gridItemWidth } from '@/constants/gameLayout';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Shared Grid Constants ────────────────────────────────────────────────────
const GRID_GAP = Theme.spacing.sm;

/**
 * Kullanilabilir genislik — GameShell'in verdigi yatay padding dusulmus hali.
 *
 * Eskiden burada `GRID_PADDING = Theme.spacing.md` vardi ve hem kart
 * genisligi hesabindan hem de `scrollContent`'ten dusuluyordu. Ama GameShell
 * zaten ayni padding'i veriyor (components/games/GameShell/styles.ts) —
 * yani padding iki kez uygulaniyor, kart hesabi ise bir kez dusuyordu.
 * Sonuc: 3 sutunluk izgara sigmayip 2 sutuna dusuyordu (12 kart 4 satir
 * yerine 6 satir). Sozlesme: constants/gameLayout.ts
 */
const CONTENT_W = gameContentWidth(SCREEN_W);

/** Stage 1 — 3 sutun, kartlar dar */
const CARD_W_SMALL = gridItemWidth(CONTENT_W, 3, GRID_GAP);
const CARD_H_SMALL = Math.round(CARD_W_SMALL * 1.4);

/** Stage 2 — 2 sutun, daha buyuk kartlar */
const CARD_W = gridItemWidth(CONTENT_W, 2, GRID_GAP);
const CARD_H = Math.round(CARD_W * 1.35);

export { CARD_W, CARD_H, CARD_W_SMALL, CARD_H_SMALL, SCREEN_W };

/**
 * Detective vurgusu.
 *
 * ── TARIHCE ───────────────────────────────────────────────────────────────
 * Ekran bastan sona teal (#0D9488) idi. 29 Tem 2026'da "tek altin" kurali
 * geregi altina cevrildi ve bu uc sabit tanimlandi — ama HICBIRI kullanilmadi,
 * stiller `ACCENT_BORDER` yazmaya devam etti. Yani indirection vardi,
 * bagli degildi.
 *
 * 1 Agu 2026: oyun basina tema geldi ve Detective kendi rengine dondu.
 * Sabitler artik gercekten bagli ve temadan besleniyor.
 */
export const createStyles = (theme: GameTheme) => {
  const ACCENT = theme.accent;
  const ACCENT_DIM = theme.accentDim;
  const ACCENT_BORDER = withAlpha(theme.accent, 0.22);

  return StyleSheet.create({
  /** Paylasim karti ekran disinda render edilir (PNG capture) */
  offscreenCard: {
    position: 'absolute',
    top: -9999,
    left: -9999,
    opacity: 0,
  },
  // ─── Layout ──────────────────────────────────────────────────────────────────
  /** Full-screen centering — used for loading / error states */
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.lg,
  },
  /** Yatay padding YOK — GameShell veriyor (bkz. constants/gameLayout.ts) */
  scrollContent: {
    paddingTop: Theme.spacing.sm,
    paddingBottom: Theme.spacing.xl,
  },

  // ─── Loading / Error ─────────────────────────────────────────────────────────
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: Theme.spacing.sm,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textWhite,
    textAlign: 'center',
    marginBottom: Theme.spacing.sm,
  },
  errorSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.md,
  },
  retryButton: {
    backgroundColor: ACCENT,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: Theme.borderRadius.md,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },

  // ─── Case Header ─────────────────────────────────────────────────────────────
  /** Container row: case number (left) + timer (center) + stage badge (right) */
  caseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.md,
  },
  caseNumber: {
    ...Theme.typography.eyebrow,
    fontSize: 12,
    lineHeight: 16,
  },

  // ─── Timer ───────────────────────────────────────────────────────────────────
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.bgElevated,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Theme.borderRadius.full,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
  },
  timerText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  timerTextWarning: {
    color: Colors.error,
  },

  // ─── Stage Badge ─────────────────────────────────────────────────────────────
  /** Small pill: "INVESTIGATION" | "DEDUCTION" | "CASE CLOSED" */
  stageBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Theme.borderRadius.full,
    backgroundColor: ACCENT_DIM,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
  },
  stageBadgeText: {
    ...Theme.typography.eyebrow,
    fontSize: 10,
    lineHeight: 13,
    color: ACCENT,
  },

  // ─── Turn Indicator ──────────────────────────────────────────────────────────
  turnIndicator: {
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  turnText: {
    fontSize: 13,
    fontWeight: '700',
    color: ACCENT,
    letterSpacing: 0.5,
  },
  progressBarTrack: {
    width: '100%',
    height: 4,
    backgroundColor: Colors.bgSubtle,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: 2,
  },

  // ─── Clue Panel ──────────────────────────────────────────────────────────────
  cluePanel: {
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    gap: 10,
  },
  cluePanelTitle: {
    ...Theme.typography.eyebrow,
    marginBottom: 4,
  },
  clueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  clueIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: ACCENT_DIM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clueLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    width: 70,
  },
  clueValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  clueValueRevealed: {
    color: ACCENT,
  },
  clueValueHidden: {
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },

  // ─── Stage 1 Card Grid (3 columns) ───────────────────────────────────────────
  cardGridSmall: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    marginBottom: Theme.spacing.md,
  },
  filmCardSmall: {
    width: CARD_W_SMALL,
    borderRadius: Theme.borderRadius.sm,
    overflow: 'hidden',
    backgroundColor: Colors.bgCard,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  filmPosterSmall: {
    width: '100%',
    height: CARD_H_SMALL,
  },
  filmPosterPlaceholderSmall: {
    width: '100%',
    height: CARD_H_SMALL,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filmInfoBarSmall: {
    padding: 5,
    gap: 1,
  },
  filmTitleSmall: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  filmYearSmall: {
    fontSize: 9,
    color: Colors.textSecondary,
  },

  // ─── Stage 2 Card Grid (2 columns) ───────────────────────────────────────────
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    marginBottom: Theme.spacing.md,
  },
  filmCard: {
    width: CARD_W,
    borderRadius: Theme.borderRadius.md,
    overflow: 'hidden',
    backgroundColor: Colors.bgCard,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  filmPoster: {
    width: '100%',
    height: CARD_H,
  },
  filmPosterPlaceholder: {
    width: '100%',
    height: CARD_H,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filmInfoBar: {
    padding: 8,
    gap: 2,
  },
  filmTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  filmYear: {
    fontSize: 12,
    color: Colors.textSecondary,
  },

  // ─── Film Card State Borders ──────────────────────────────────────────────────
  filmCardSelected: {
    borderColor: ACCENT,
  },
  filmCardCorrect: {
    borderColor: Colors.success,
  },
  filmCardWrong: {
    borderColor: Colors.error,
  },
  filmCardEliminated: {
    borderColor: 'rgba(239,68,68,0.3)',
    opacity: 0.5,
  },

  // ─── Eliminated Overlay ───────────────────────────────────────────────────────
  eliminatedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(239,68,68,0.30)',
    borderRadius: Theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eliminatedOverlaySmall: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(239,68,68,0.30)',
    borderRadius: Theme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Stage Transition (fullscreen cinematic overlay) ─────────────────────────
  stageTransitionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    gap: Theme.spacing.md,
  },
  stageTransitionIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: ACCENT_DIM,
    borderWidth: 2,
    borderColor: ACCENT_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.sm,
  },
  stageTransitionTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textWhite,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  stageTransitionSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Theme.spacing.xl,
    lineHeight: 22,
  },
  stageTransitionAccentLine: {
    width: 48,
    height: 3,
    borderRadius: 2,
    backgroundColor: ACCENT,
    marginVertical: Theme.spacing.sm,
  },

  // ─── Stage 2 Feedback Panel ───────────────────────────────────────────────────
  /**
   * Shown below the selected poster in Stage 2.
   * Contains a row of FlipCells (green / yellow / gray pattern).
   */
  feedbackPanel: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    gap: Theme.spacing.sm,
  },
  feedbackPanelTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textTertiary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  feedbackRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  feedbackHint: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: 4,
  },

  // ─── FlipCells (Stage 2 feedback — mirrors CineMetrics green/yellow/gray) ────
  flipCell: {
    width: 36,
    height: 36,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  flipCellEmpty: {
    borderWidth: 1,
    borderColor: Colors.bgSubtle,
    backgroundColor: 'transparent',
  },
  flipCellGreen: {
    backgroundColor: Colors.greenBright,
  },
  flipCellYellow: {
    backgroundColor: ACCENT,
  },
  flipCellGray: {
    backgroundColor: Colors.bgSubtle,
  },
  flipCellTeal: {
    backgroundColor: ACCENT,
  },
  flipCellText: {
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  flipCellTextGreen: {
    color: Colors.white,
  },
  flipCellTextYellow: {
    color: Colors.textOnAccent,
  },
  flipCellTextGray: {
    color: Colors.textTertiary,
  },
  flipCellTextTeal: {
    color: Colors.white,
  },
  flipCellLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 3,
  },

  // ─── Guess / Action Buttons ───────────────────────────────────────────────────
  /** Primary action button — teal, pill shape */
  guessButton: {
    backgroundColor: ACCENT,
    height: 50,
    borderRadius: Theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.md,
    ...Theme.shadow.card,
    shadowColor: ACCENT,
  },
  guessButtonDisabled: {
    backgroundColor: Colors.bgSubtle,
    shadowOpacity: 0,
    elevation: 0,
  },
  guessButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  guessButtonTextDisabled: {
    color: Colors.textTertiary,
  },

  // ─── Skeleton Loading States ──────────────────────────────────────────────────
  skeletonPanel: {
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.lg,
    height: 96,
    marginBottom: Theme.spacing.md,
  },
  skeletonCardSmall: {
    width: CARD_W_SMALL,
    height: CARD_H_SMALL + 40,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Colors.bgCard,
  },
  skeletonCard: {
    width: CARD_W,
    height: CARD_H + 48,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Colors.bgCard,
  },
  skeletonHeader: {
    height: 20,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Colors.bgCard,
    marginBottom: Theme.spacing.md,
    width: '60%',
  },
  skeletonButton: {
    height: 50,
    borderRadius: Theme.borderRadius.full,
    backgroundColor: Colors.bgCard,
    marginTop: Theme.spacing.sm,
  },

  // ─── Final Reveal / Case Closed ──────────────────────────────────────────────
  /** Yatay padding YOK — GameShell veriyor */
  finalRevealContainer: {
    alignItems: 'center',
    gap: Theme.spacing.md,
    paddingBottom: Theme.spacing.lg,
  },
  finalRevealBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.full,
    backgroundColor: ACCENT_DIM,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    marginBottom: Theme.spacing.xs,
  },
  finalRevealBadgeText: {
    ...Theme.typography.eyebrow,
    letterSpacing: 2,
    color: ACCENT,
  },
  finalRevealPoster: {
    width: SCREEN_W * 0.42,
    height: SCREEN_W * 0.42 * 1.5,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.white10,
  },
  finalRevealTitle: {
    ...Theme.typography.serifHero,
    fontSize: 28,
    lineHeight: 34,
    textAlign: 'center',
  },
  wonMessage: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.success,
    textAlign: 'center',
  },
  lostMessage: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.error,
    textAlign: 'center',
  },
  lostSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: -6,
  },

  // ─── Detective Score Card ─────────────────────────────────────────────────────
  scoreCard: {
    width: '100%',
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    gap: Theme.spacing.sm,
    ...Theme.shadow.card,
  },
  scoreCardTitle: {
    ...Theme.typography.eyebrow,
    marginBottom: 4,
  },
  scoreMainRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  scoreMainValue: {
    fontSize: 48,
    fontFamily: 'PlayfairDisplay_900Black',
    color: ACCENT,
    lineHeight: 56,
  },
  scoreMainLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  scoreDivider: {
    height: 1,
    backgroundColor: ACCENT_BORDER,
    marginVertical: Theme.spacing.xs,
  },
  scoreBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreBreakdownLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  scoreBreakdownValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  scoreBreakdownValuePositive: {
    color: Colors.success,
  },
  scoreBreakdownValueNegative: {
    color: Colors.error,
  },

  // ─── XP / DNA Chips ──────────────────────────────────────────────────────────
  xpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: ACCENT_DIM,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Theme.borderRadius.full,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
  },
  xpText: {
    fontSize: 14,
    fontWeight: '700',
    color: ACCENT,
  },
  dnaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: ACCENT_DIM,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Theme.borderRadius.full,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
  },
  dnaText: {
    fontSize: 13,
    fontWeight: '600',
    color: ACCENT,
  },

  // ─── Community Histogram ──────────────────────────────────────────────────────
  histogramCard: {
    width: '100%',
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    gap: Theme.spacing.sm,
  },
  histogramTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textTertiary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  histogramBarsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 64,
  },
  histogramBarWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  histogramBar: {
    width: '100%',
    backgroundColor: Colors.bgSubtle,
    borderRadius: 3,
    minHeight: 4,
  },
  histogramBarActive: {
    backgroundColor: ACCENT,
  },
  histogramBarLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  histogramBarLabelActive: {
    color: ACCENT,
  },
  /** "You" marker above the player's bar */
  histogramYouMarker: {
    position: 'absolute',
    top: -18,
    alignSelf: 'center',
    backgroundColor: ACCENT,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Theme.borderRadius.full,
  },
  histogramYouText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.white,
  },
  histogramXAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  histogramXLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
    textAlign: 'center',
  },

  // ─── "Why This Movie?" Card ──────────────────────────────────────────────────
  whyCard: {
    width: '100%',
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    gap: Theme.spacing.sm,
  },
  whyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  whyCardIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ACCENT_DIM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whyCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  whyCardBody: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textSecondary,
  },
  whyCardHighlight: {
    color: ACCENT,
    fontWeight: '600',
  },

  // ─── Film Discovery Bridge ────────────────────────────────────────────────────
  discoveryBridgeCard: {
    width: '100%',
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    overflow: 'hidden',
  },
  discoveryBridgeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Theme.spacing.md,
    gap: Theme.spacing.md,
  },
  discoveryBridgePoster: {
    width: 60,
    height: 88,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Colors.bgElevated,
  },
  discoveryBridgeContent: {
    flex: 1,
    gap: 4,
  },
  discoveryBridgeEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  discoveryBridgeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  discoveryBridgeMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  discoveryBridgeArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: ACCENT_DIM,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Countdown ───────────────────────────────────────────────────────────────
  countdownLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Theme.spacing.sm,
  },
  countdownTime: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textWhite,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },

  // ─── Action Buttons (Case Closed) ─────────────────────────────────────────────
  completedActions: {
    width: '100%',
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.sm,
  },
  shareButton: {
    backgroundColor: ACCENT,
    height: 50,
    borderRadius: Theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...Theme.shadow.card,
    shadowColor: ACCENT,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
  hubButton: {
    height: 50,
    borderRadius: Theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.white10,
  },
  hubButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  // ─── CaseHeader (used by CaseHeader.tsx) ───────────────────────────────────
  caseHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.md,
  },
  caseHeaderCaseNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    // Uzun cevirilerin ortadaki sayaci ezmesini onler
    flexShrink: 1,
  },
  caseHeaderTimer: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
    // Sayac hicbir zaman kirpilmaz — "00" gibi yarim gorunmesinin sebebi buydu
    flexShrink: 0,
    paddingHorizontal: Theme.spacing.sm,
  },
  caseHeaderStageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Theme.borderRadius.full,
    backgroundColor: ACCENT_DIM,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
  },
  caseHeaderStageLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: ACCENT,
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },


  // ─── Score Card (used by DetectiveScoreCard.tsx) ────────────────────────────
  scoreCardContainer: {
    width: '100%',
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    gap: Theme.spacing.sm,
    ...Theme.shadow.card,
  },
  scoreCardScoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  scoreCardBigScore: {
    fontSize: 48,
    fontFamily: 'PlayfairDisplay_900Black',
    color: ACCENT,
    lineHeight: 56,
  },
  scoreCardOutOf: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  scoreCardLuckyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: ACCENT_DIM,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.full,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    alignSelf: 'flex-start',
  },
  scoreCardLuckyText: {
    fontSize: 12,
    fontWeight: '700',
    color: ACCENT,
  },
  scoreCardBreakdown: {
    gap: Theme.spacing.sm,
  },
  scoreCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreCardRowLabel: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  scoreCardRowValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  scoreCardResultText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  scoreCardResultWon: {
    color: Colors.success,
  },
  scoreCardResultLost: {
    color: Colors.error,
  },

  // ─── Completed Container (Stage 3 wrapper) ─────────────────────────────────
  /** Yatay padding YOK — GameShell veriyor */
  completedContainer: {
    alignItems: 'center',
    paddingTop: Theme.spacing.lg,
    gap: Theme.spacing.md,
    paddingBottom: Theme.spacing.lg,
  },
  completedPoster: {
    width: SCREEN_W * 0.42,
    height: SCREEN_W * 0.42 * 1.5,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.white10,
  },
  completedTitle: {
    fontSize: 24,
    fontFamily: 'PlayfairDisplay_900Black',
    color: Colors.textWhite,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  countdownSection: {
    alignItems: 'center',
    gap: 4,
  },

  // ─── Progress Bar (Stage 1 turn indicator) ─────────────────────────────────
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: Colors.bgSubtle,
    borderRadius: 2,
    overflow: 'hidden' as const,
  },
  progressFill: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: 2,
  },

  // ─── Stage 2 Feedback column layout ────────────────────────────────────────
  feedbackCell: {
    width: 44,
    height: 36,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  feedbackCellText: {
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  cellEmpty: {
    borderWidth: 1,
    borderColor: Colors.bgSubtle,
    backgroundColor: 'transparent',
  },
  cellGreen: {
    backgroundColor: Colors.greenBright,
  },
  cellYellow: {
    backgroundColor: ACCENT,
  },
  cellGray: {
    backgroundColor: Colors.bgSubtle,
  },
  cellTextGreen: {
    color: Colors.white,
  },
  cellTextYellow: {
    color: Colors.bgPrimary,
  },
  cellTextGray: {
    color: Colors.textTertiary,
  },
  directionArrow: {
    position: 'absolute',
    bottom: 2,
    right: 3,
  },
  feedbackColWrap: {
    alignItems: 'center',
    gap: 4,
  },
  feedbackColLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.textTertiary,
    textAlign: 'center',
  },

  // ─── Previous Guesses Summary (Stage 2) ───────────────────────────────────
  previousGuesses: {
    marginBottom: Theme.spacing.md,
    gap: 6,
  },
  prevGuessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.sm,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  prevGuessRowActive: {
    borderColor: ACCENT_BORDER,
  },
  prevGuessTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  prevGuessDots: {
    flexDirection: 'row',
    gap: 4,
  },
  prevGuessDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotGreen: {
    backgroundColor: Colors.greenBright,
  },
  dotYellow: {
    backgroundColor: ACCENT,
  },
  dotGray: {
    backgroundColor: Colors.bgSubtle,
  },

  // ─── Community Histogram (used by CommunityHistogram.tsx) ──────────────────
  histogramContainer: {
    width: '100%',
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    gap: Theme.spacing.sm,
  },
  histogramHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textTertiary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  histogramBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 22,
  },
  histogramBarRowActive: {
    height: 26,
  },
  histogramLabel: {
    width: 24,
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textTertiary,
    textAlign: 'right',
  },
  histogramLabelActive: {
    color: ACCENT,
    fontWeight: '800',
  },
  histogramBarTrack: {
    flex: 1,
    height: 14,
    borderRadius: 3,
    backgroundColor: Colors.bgSubtle,
    overflow: 'hidden' as const,
  },
  histogramBarFill: {
    height: '100%',
    backgroundColor: Colors.bgSubtle,
    borderRadius: 3,
  },
  histogramBarFillActive: {
    backgroundColor: ACCENT,
  },
  histogramCount: {
    width: 28,
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  histogramCountActive: {
    color: ACCENT,
    fontWeight: '800',
  },
  histogramYouBadge: {
    backgroundColor: ACCENT,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Theme.borderRadius.full,
    marginLeft: 4,
  },
  histogramYouBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.white,
  },
  histogramPercentile: {
    fontSize: 13,
    fontWeight: '600',
    color: ACCENT,
    textAlign: 'center',
    marginTop: 4,
  },

  // ─── Why This Movie (used by WhyThisMovie.tsx) ─────────────────────────────
  whyContainer: {
    width: '100%',
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    gap: Theme.spacing.sm,
  },
  whyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  whyIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ACCENT_DIM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  whySubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  whyBullet: {
    flexDirection: 'row',
    gap: 8,
    paddingLeft: 4,
  },
  whyBulletDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: ACCENT,
    marginTop: 6,
  },
  whyBulletText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textSecondary,
  },
  whyBulletHighlight: {
    color: ACCENT,
    fontWeight: '600',
  },
  whyDivider: {
    height: 1,
    backgroundColor: ACCENT_BORDER,
    marginVertical: 4,
  },
  whyFunFact: {
    fontSize: 12,
    fontStyle: 'italic',
    color: Colors.textTertiary,
    lineHeight: 18,
  },

  });
};

/**
 * Detective'in bagli stilleri.
 *
 * Fabrika modul seviyesinde CAGRILIYOR, hook'la degil: bu ekranin `gameType`'i
 * her zaman 'detective', yani tema calisma zamaninda degismiyor. Hook'a
 * baglamak `styles`'i tuketen bes dosyaya (CaseHeader, CommunityHistogram,
 * DetectiveScoreCard, WhyThisMovie, index) prop ya da ayri `useMemo` tasimayi
 * gerektirirdi — sabit bir deger icin gereksiz.
 *
 * `useGameTheme()` context'i, hangi oyunda oldugunu BILMEYEN paylasilan
 * bilesenler icindir (FilmSearchInput, GameStateView, HintBoard).
 */
/**
 * Bu ekranin oyun kimligi. Hem tema hem GameShell bunu okur — iki ayri
 * literal birbirinden kayamaz.
 */
export const GAME_TYPE = 'detective' as const;

export const styles = createStyles(GAME_THEMES[GAME_TYPE]);

/** JSX icinde ikon/metin rengi olarak kullanilan vurgu — stille ayni kaynak */
export const ACCENT = GAME_THEMES.detective.accent;
export const ACCENT_DIM = GAME_THEMES.detective.accentDim;
