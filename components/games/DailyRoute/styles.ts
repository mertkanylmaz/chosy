/**
 * DailyRoute stilleri — Festival Layer.
 *
 * Dikey "metro hatti": solda 1px altin cizgi + dugum noktalari,
 * sagda oyun satiri. Tamamlanan dugum altin muhur olur.
 */
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

/** Dugum capi — hat cizgisi bunun ortasindan gecer */
export const NODE_SIZE = 28;
/** Dugum sutununun toplam genisligi */
const RAIL_WIDTH = 44;

export const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Theme.spacing.md,
    paddingBottom: Theme.spacing.lg,
  },
  sectionLabel: {
    ...Theme.typography.eyebrow,
    marginBottom: Theme.spacing.md,
  },

  // ─── Satir ────────────────────────────────────────────────────────────────
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  rail: {
    width: RAIL_WIDTH,
    alignItems: 'center',
  },
  /** Dugumun ustundeki ve altindaki hat parcasi */
  railLine: {
    width: 1,
    flex: 1,
    backgroundColor: Colors.goldHairline,
  },
  railLineHidden: {
    backgroundColor: 'transparent',
  },
  node: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 1,
    borderColor: Colors.goldHairline,
    backgroundColor: Colors.bgPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Cozulmus oyun — altin muhur */
  nodeSolved: {
    backgroundColor: Colors.goldSeal,
    borderColor: Colors.gold,
  },
  /** Oynanmis ama cozulememis — sonuk */
  nodeMissed: {
    borderColor: Colors.border,
  },
  /** Onerilen sonraki oyun — dolu altin halka */
  nodeRecommended: {
    borderColor: Colors.gold,
    borderWidth: 2,
  },

  // ─── Oyun satiri ──────────────────────────────────────────────────────────
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    paddingVertical: Theme.spacing.md,
    paddingLeft: Theme.spacing.xs,
  },
  cardPlayed: {
    opacity: 0.55,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  gameTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontFamily: Theme.fonts.display,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  gameDescription: {
    ...Theme.typography.caption,
    color: Colors.textSecondary,
  },
  statusLabel: {
    ...Theme.typography.eyebrow,
    color: Colors.gold,
    marginTop: 2,
  },
  streakText: {
    ...Theme.typography.micro,
    color: Colors.textTertiary,
    marginTop: 2,
  },

  /** Sag taraftaki oyna gostergesi */
  playChevron: {
    width: 28,
    alignItems: 'flex-end',
  },
});
