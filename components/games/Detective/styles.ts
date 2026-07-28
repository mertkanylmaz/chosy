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
import { Theme } from '@/constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Shared Grid Constants ────────────────────────────────────────────────────
const GRID_PADDING = Theme.spacing.md;
const GRID_GAP = Theme.spacing.sm;

/**
 * Stage 1 — 3 columns, so cards are narrower.
 * (SCREEN_W - left_pad - right_pad - gap1 - gap2) / 3
 */
const CARD_W_SMALL = Math.floor(
  (SCREEN_W - GRID_PADDING * 2 - GRID_GAP * 2) / 3,
);
const CARD_H_SMALL = Math.round(CARD_W_SMALL * 1.4);

/**
 * Stage 2 — 2 columns, same formula as Spotlight.
 * (SCREEN_W - left_pad - right_pad - gap) / 2
 */
const CARD_W = Math.floor((SCREEN_W - GRID_PADDING * 2 - GRID_GAP) / 2);
const CARD_H = Math.round(CARD_W * 1.35);

/** Detective accent — teal-600 */
const TEAL = '#0D9488';
const TEAL_DIM = 'rgba(13,148,136,0.15)';
const TEAL_BORDER = 'rgba(13,148,136,0.35)';

export { CARD_W, CARD_H, CARD_W_SMALL, CARD_H_SMALL, SCREEN_W, TEAL, TEAL_DIM };

export const styles = StyleSheet.create({
  // ─── Layout ──────────────────────────────────────────────────────────────────
  /** Full-screen centering — used for loading / error states */
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.lg,
  },
  scrollContent: {
    padding: GRID_PADDING,
    paddingBottom: 100,
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
    backgroundColor: TEAL,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: Theme.borderRadius.md,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
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
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
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
    borderColor: Colors.cardBorder,
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
    backgroundColor: TEAL_DIM,
    borderWidth: 1,
    borderColor: TEAL_BORDER,
  },
  stageBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: TEAL,
    letterSpacing: 1.0,
    textTransform: 'uppercase',
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
    color: TEAL,
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
    backgroundColor: TEAL,
    borderRadius: 2,
  },

  // ─── Clue Panel ──────────────────────────────────────────────────────────────
  cluePanel: {
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 10,
  },
  cluePanelTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textTertiary,
    letterSpacing: 1.5,
    marginBottom: 4,
    textTransform: 'uppercase',
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
    backgroundColor: TEAL_DIM,
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
    color: TEAL,
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
    borderColor: TEAL,
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
    backgroundColor: 'rgba(10,10,15,0.97)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    gap: Theme.spacing.md,
  },
  stageTransitionIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: TEAL_DIM,
    borderWidth: 2,
    borderColor: TEAL_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.sm,
  },
  stageTransitionTitle: {
    fontSize: 28,
    fontFamily: 'PlayfairDisplay_700Bold',
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
    backgroundColor: TEAL,
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
    borderColor: Colors.cardBorder,
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
    backgroundColor: '#22C55E',
  },
  flipCellYellow: {
    backgroundColor: Colors.gold,
  },
  flipCellGray: {
    backgroundColor: Colors.bgSubtle,
  },
  flipCellTeal: {
    backgroundColor: TEAL,
  },
  flipCellText: {
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  flipCellTextGreen: {
    color: '#FFFFFF',
  },
  flipCellTextYellow: {
    color: Colors.textOnAccent,
  },
  flipCellTextGray: {
    color: Colors.textTertiary,
  },
  flipCellTextTeal: {
    color: '#FFFFFF',
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
    backgroundColor: TEAL,
    height: 50,
    borderRadius: Theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.md,
    ...Theme.shadow.card,
    shadowColor: TEAL,
  },
  guessButtonDisabled: {
    backgroundColor: Colors.bgSubtle,
    shadowOpacity: 0,
    elevation: 0,
  },
  guessButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
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
  finalRevealContainer: {
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    gap: Theme.spacing.md,
    paddingBottom: 20,
  },
  finalRevealBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.full,
    backgroundColor: TEAL_DIM,
    borderWidth: 1,
    borderColor: TEAL_BORDER,
    marginBottom: Theme.spacing.xs,
  },
  finalRevealBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: TEAL,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  finalRevealPoster: {
    width: SCREEN_W * 0.42,
    height: SCREEN_W * 0.42 * 1.5,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.white10,
  },
  finalRevealTitle: {
    fontSize: 24,
    fontFamily: 'PlayfairDisplay_900Black',
    color: Colors.textWhite,
    textAlign: 'center',
    letterSpacing: -0.3,
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
    borderColor: Colors.cardBorder,
    gap: Theme.spacing.sm,
    ...Theme.shadow.card,
  },
  scoreCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textTertiary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
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
    color: TEAL,
    lineHeight: 56,
  },
  scoreMainLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  scoreDivider: {
    height: 1,
    backgroundColor: Colors.cardBorder,
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
    backgroundColor: Colors.goldDim,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Theme.borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(212,168,67,0.3)',
  },
  xpText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gold,
  },
  dnaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: TEAL_DIM,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Theme.borderRadius.full,
    borderWidth: 1,
    borderColor: TEAL_BORDER,
  },
  dnaText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEAL,
  },

  // ─── Community Histogram ──────────────────────────────────────────────────────
  histogramCard: {
    width: '100%',
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
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
    backgroundColor: TEAL,
  },
  histogramBarLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  histogramBarLabelActive: {
    color: TEAL,
  },
  /** "You" marker above the player's bar */
  histogramYouMarker: {
    position: 'absolute',
    top: -18,
    alignSelf: 'center',
    backgroundColor: TEAL,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Theme.borderRadius.full,
  },
  histogramYouText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
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
    borderColor: Colors.cardBorder,
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
    backgroundColor: TEAL_DIM,
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
    color: TEAL,
    fontWeight: '600',
  },

  // ─── Film Discovery Bridge ────────────────────────────────────────────────────
  discoveryBridgeCard: {
    width: '100%',
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
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
    backgroundColor: TEAL_DIM,
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
    backgroundColor: TEAL,
    height: 50,
    borderRadius: Theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...Theme.shadow.card,
    shadowColor: TEAL,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
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
  },
  caseHeaderTimer: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  caseHeaderStageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Theme.borderRadius.full,
    backgroundColor: TEAL_DIM,
    borderWidth: 1,
    borderColor: TEAL_BORDER,
  },
  caseHeaderStageLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: TEAL,
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },

  // ─── Stage Transition (used by StageTransition.tsx) ─────────────────────────
  transitionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10,10,15,0.97)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.md,
  },
  transitionGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: TEAL_DIM,
    opacity: 0.4,
  },
  transitionTitleWrap: {
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  transitionTitle: {
    fontSize: 28,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: Colors.textWhite,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  transitionSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Theme.spacing.xl,
    lineHeight: 22,
  },
  transitionButton: {
    backgroundColor: TEAL,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: Theme.borderRadius.full,
    marginTop: Theme.spacing.md,
  },
  transitionButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  // ─── Score Card (used by DetectiveScoreCard.tsx) ────────────────────────────
  scoreCardContainer: {
    width: '100%',
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
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
    color: TEAL,
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
    backgroundColor: Colors.goldDim,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(212,168,67,0.3)',
    alignSelf: 'flex-start',
  },
  scoreCardLuckyText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.gold,
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
  completedContainer: {
    alignItems: 'center',
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
    paddingBottom: 20,
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
    backgroundColor: TEAL,
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
    backgroundColor: '#22C55E',
  },
  cellYellow: {
    backgroundColor: '#D4A843',
  },
  cellGray: {
    backgroundColor: Colors.bgSubtle,
  },
  cellTextGreen: {
    color: '#FFFFFF',
  },
  cellTextYellow: {
    color: '#0A0A0F',
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
    borderColor: TEAL_BORDER,
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
    backgroundColor: '#22C55E',
  },
  dotYellow: {
    backgroundColor: '#D4A843',
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
    borderColor: Colors.cardBorder,
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
    color: TEAL,
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
    backgroundColor: TEAL,
  },
  histogramCount: {
    width: 28,
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  histogramCountActive: {
    color: TEAL,
    fontWeight: '800',
  },
  histogramYouBadge: {
    backgroundColor: TEAL,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Theme.borderRadius.full,
    marginLeft: 4,
  },
  histogramYouBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  histogramPercentile: {
    fontSize: 13,
    fontWeight: '600',
    color: TEAL,
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
    borderColor: Colors.cardBorder,
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
    backgroundColor: TEAL_DIM,
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
    backgroundColor: TEAL,
    marginTop: 6,
  },
  whyBulletText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textSecondary,
  },
  whyBulletHighlight: {
    color: TEAL,
    fontWeight: '600',
  },
  whyDivider: {
    height: 1,
    backgroundColor: Colors.cardBorder,
    marginVertical: 4,
  },
  whyFunFact: {
    fontSize: 12,
    fontStyle: 'italic',
    color: Colors.textTertiary,
    lineHeight: 18,
  },

  // ─── Film Discovery Bridge (used by FilmDiscoveryBridge.tsx) ───────────────
  bridgeContainer: {
    width: '100%',
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: Theme.spacing.sm,
  },
  bridgeWatchedText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  bridgeActions: {
    gap: 8,
  },
  bridgeActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: TEAL_DIM,
    paddingVertical: 10,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: TEAL_BORDER,
  },
  bridgeActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEAL,
  },
  bridgeSecondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.white10,
  },
  bridgeSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
