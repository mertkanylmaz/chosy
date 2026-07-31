/**
 * CineMetrics — StyleSheet definitions.
 */
import { Dimensions, StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { gameContentWidth } from '@/constants/gameLayout';

const { width: SCREEN_W } = Dimensions.get('window');

/**
 * Kullanilabilir genislik — GameShell'in verdigi yatay padding dusulmus hali.
 *
 * Eskiden burada `GRID_PADDING = Theme.spacing.sm` vardi ve satir genisligi
 * `SCREEN_W - 16` varsayiliyordu; GameShell ayrica 32px daha dusuyordu.
 * `guessRow`'da `flexWrap` olmadigi icin fazlalik sarmiyor, KIRPILIYORDU:
 * 6. sutun (Ulke) ekranin disinda kaliyordu. Sozlesme: constants/gameLayout.ts
 */
const CONTENT_W = gameContentWidth(SCREEN_W);

/** Film adı sütunu genişliği — metadata değerleri için daraltıldı */
const FILM_COL_W = 84;
/** 6 data sütunu — kalan alan eşit bölünür */
const DATA_COL_W = (CONTENT_W - FILM_COL_W) / 6;

export { FILM_COL_W, DATA_COL_W, SCREEN_W };

export const styles = StyleSheet.create({
  /** Paylasim karti ekran disinda render edilir (PNG capture) */
  offscreenCard: {
    position: 'absolute',
    top: -9999,
    left: -9999,
    opacity: 0,
  },
  // ─── Layout ────────────────────────────────────────────────────────────────
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textWhite,
    marginBottom: Theme.spacing.sm,
  },
  errorSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Theme.spacing.xl,
  },
  scrollContent: {
    paddingBottom: Theme.spacing.md,
  },

  // ─── Header info ───────────────────────────────────────────────────────────
  /** Yatay padding YOK — GameShell veriyor */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Theme.spacing.sm,
  },
  puzzleNo: {
    ...Theme.typography.eyebrow,
    fontSize: 12,
    lineHeight: 16,
  },
  difficultyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: Theme.borderRadius.full,
    borderWidth: 1,
    borderColor: Colors.goldHairline,
  },
  difficultyText: {
    ...Theme.typography.eyebrow,
    fontSize: 10,
    lineHeight: 13,
  },

  // ─── Grid ──────────────────────────────────────────────────────────────────
  /**
   * Yatay padding YOK — GameShell veriyor. DATA_COL_W bu genislige gore
   * hesaplandi, buraya padding eklenirse 6. sutun yine kirpilir.
   */
  gridContainer: {},
  columnHeaders: {
    flexDirection: 'row',
    marginBottom: Theme.spacing.xs,
  },
  filmColHeader: {
    width: FILM_COL_W,
  },
  colHeader: {
    width: DATA_COL_W,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  colHeaderText: {
    ...Theme.typography.eyebrow,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1,
    textAlign: 'center',
  },
  guessRow: {
    flexDirection: 'row',
    marginBottom: 4,
    alignItems: 'center',
  },
  filmNameCol: {
    width: FILM_COL_W,
    paddingRight: 4,
    justifyContent: 'center',
  },
  /**
   * Iki satira kadar sarar. 84px'e uzun film adlari tek satirda sigmiyordu ve
   * kesiliyordu; hucre yuksekligi 40 oldugu icin iki satir rahat siger.
   */
  filmNameText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    color: Colors.textWhite,
  },

  // ─── Grid Cells ────────────────────────────────────────────────────────────
  cell: {
    width: DATA_COL_W - 2,
    height: 40,
    marginHorizontal: 1,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cellEmpty: {
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    backgroundColor: 'transparent',
  },
  /** Siradaki tahmin satiri — bos grid'de "buraya yazacaksin" isareti */
  cellActiveRow: {
    borderColor: Colors.accentPrimary,
    backgroundColor: Colors.white05,
  },
  cellGreen: {
    backgroundColor: Colors.greenBright,
  },
  cellYellow: {
    backgroundColor: Colors.gold,
  },
  cellGray: {
    backgroundColor: Colors.bgSubtle,
  },
  cellText: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 1,
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

  // ─── Empty rows placeholder ────────────────────────────────────────────────
  emptyRow: {
    flexDirection: 'row',
    marginBottom: 4,
    alignItems: 'center',
  },
  emptyFilmCol: {
    width: FILM_COL_W,
  },

  // ─── Input Area ────────────────────────────────────────────────────────────
  /** Yatay padding YOK — GameShell veriyor */
  inputArea: {
    paddingTop: Theme.spacing.md,
    paddingBottom: Theme.spacing.sm,
  },
  submitButton: {
    marginTop: Theme.spacing.sm,
    backgroundColor: Colors.accentPrimary,
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
    color: Colors.textOnAccent,
  },

  // ─── Completed State ───────────────────────────────────────────────────────
  /** Yatay padding YOK — GameShell veriyor */
  completedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.md,
  },
  completedPoster: {
    width: 200,
    height: 300,
    borderRadius: Theme.borderRadius.lg,
  },
  completedTitle: {
    fontSize: 24,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: Colors.textWhite,
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
    fontWeight: '500',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  lostSubtext: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: -8,
  },
  xpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.goldDim,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.full,
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
    borderWidth: 1,
    borderColor: Colors.goldHairline,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.full,
  },
  dnaText: {
    ...Theme.typography.micro,
    color: Colors.gold,
    fontWeight: '600',
  },
  countdownLabel: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  countdownTime: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textWhite,
    fontVariant: ['tabular-nums'],
  },
  completedActions: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    width: '100%',
    paddingHorizontal: Theme.spacing.md,
  },
  shareButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.accentPrimary,
  },
  hubButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textOnAccent,
  },
  retryButton: {
    marginTop: Theme.spacing.md,
    paddingVertical: 12,
    paddingHorizontal: Theme.spacing.xl,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Colors.accentPrimary,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textOnAccent,
  },

  // ── Legend (renk/ok dili) ──
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Theme.spacing.md,
    marginTop: Theme.spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
});
