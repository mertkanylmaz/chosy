import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const POSTER_W = 80;
export const POSTER_H = 120;

export const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.cardSolid,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Theme.spacing.md,
    gap: 12,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: Colors.textWhite,
    fontSize: 15,
    fontFamily: 'PlayfairDisplay_700Bold',
    letterSpacing: 0.2,
  },
  seeAll: {
    color: Colors.gold,
    fontSize: 12,
    fontWeight: '600',
  },

  // ── Progress bar ──
  progressContainer: {
    gap: 6,
  },
  progressLabel: {
    color: Colors.textGrey,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.bgElevated,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: Colors.accentPrimary,
  },

  // ── Horizontal scroll ──
  scrollContent: {
    gap: 10,
    paddingRight: 4,
  },

  // ── Poster kartı ──
  posterCard: {
    width: POSTER_W,
    alignItems: 'center',
    gap: 6,
  },
  posterImage: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  posterWatched: {
    opacity: 0.45,
  },
  posterPlaceholder: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  filmTitle: {
    color: Colors.textWhite,
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
  },

  // ── İzlendi toggle (poster üst sağ) ──
  watchedToggle: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  watchedToggleActive: {
    backgroundColor: 'rgba(139,92,246,0.25)',
  },

  // ── Boş durum ──
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 6,
  },
  emptyText: {
    color: Colors.textGrey,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 220,
  },

  // ── Skeleton ──
  skeletonRow: {
    flexDirection: 'row',
    gap: 10,
  },
});
