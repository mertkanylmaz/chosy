/**
 * Spotlight V2 — StyleSheet definitions.
 */
import { Dimensions, StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_GAP = Theme.spacing.sm;
/** Poster kart genisligi — 2 sutun, gap ve padding hesabi */
const CARD_W = (SCREEN_W - Theme.spacing.md * 2 - GRID_GAP) / 2;
/** Poster karti yuksekligi — 2:3 oran (6 kart sığması için küçültüldü) */
const CARD_H = Math.round(CARD_W * 1.35);

export { CARD_W, CARD_H, SCREEN_W };

/** Spotlight oyun rengi — violet-500 */
const VIOLET = Colors.violet;
const VIOLET_DIM = 'rgba(139,92,246,0.15)';

export const styles = StyleSheet.create({
  /** Paylasim karti ekran disinda render edilir (PNG capture) */
  offscreenCard: {
    position: 'absolute',
    top: -9999,
    left: -9999,
    opacity: 0,
  },
  // ─── Layout ──────────────────────────────────────────────────────────────
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.lg,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textWhite,
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: Colors.accentPrimary,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: Theme.borderRadius.md,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textOnAccent,
  },

  // ─── Scroll ──────────────────────────────────────────────────────────────
  scrollContent: {
    padding: Theme.spacing.md,
    paddingBottom: 20,
  },

  // ─── Clue Panel ──────────────────────────────────────────────────────────
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
    backgroundColor: VIOLET_DIM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clueLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    width: 62,
  },
  clueValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },

  // ─── Turn Indicator ──────────────────────────────────────────────────────
  turnIndicator: {
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
    gap: 8,
  },
  turnText: {
    fontSize: 13,
    fontWeight: '700',
    color: VIOLET,
    letterSpacing: 0.5,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: Colors.bgSubtle,
    borderRadius: 2,
    overflow: 'hidden' as const,
  },
  progressFill: {
    height: '100%',
    backgroundColor: VIOLET,
    borderRadius: 2,
  },

  // ─── Film Cards Grid ─────────────────────────────────────────────────────
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    marginBottom: Theme.spacing.md,
  },
  filmCard: {
    width: CARD_W,
    borderRadius: Theme.borderRadius.md,
    overflow: 'hidden' as const,
    backgroundColor: Colors.bgCard,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  filmCardSelected: {
    borderColor: VIOLET,
  },
  filmCardCorrect: {
    borderColor: Colors.success,
  },
  filmCardWrong: {
    borderColor: Colors.error,
  },
  filmCardEliminated: {
    borderColor: 'rgba(239,68,68,0.3)',
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

  // ─── Eliminated Overlay ───────────────────────────────────────────────────
  eliminatedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(239,68,68,0.35)',
    borderRadius: Theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Guess Button ────────────────────────────────────────────────────────
  guessButton: {
    backgroundColor: VIOLET,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.md,
  },
  guessButtonDisabled: {
    backgroundColor: Colors.bgSubtle,
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

  // ─── Completed ───────────────────────────────────────────────────────────
  completedContainer: {
    alignItems: 'center',
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  completedPoster: {
    width: SCREEN_W * 0.45,
    height: SCREEN_W * 0.45 * 1.5,
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
  },
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
    backgroundColor: VIOLET_DIM,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Theme.borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.3)',
  },
  dnaText: {
    fontSize: 13,
    fontWeight: '600',
    color: VIOLET,
  },
  countdownLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  countdownTime: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textWhite,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  completedActions: {
    width: '100%',
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.sm,
  },
  shareButton: {
    backgroundColor: VIOLET,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
  hubButton: {
    height: 50,
    borderRadius: 25,
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

  // ─── Skeleton ────────────────────────────────────────────────────────────
  skeletonPanel: {
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.lg,
    height: 80,
    marginBottom: Theme.spacing.md,
  },
  skeletonCard: {
    width: CARD_W,
    height: CARD_H + 48,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Colors.bgCard,
  },
});
