import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const POSTER_W = 80;
export const POSTER_H = 110;

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
    fontSize: Theme.typography.body.fontSize,
    fontFamily: 'PlayfairDisplay_700Bold',
    letterSpacing: 0.2,
  },
  seeAll: {
    color: Colors.gold,
    fontSize: Theme.typography.caption.fontSize,
    fontWeight: '600',
  },

  // ── Progress bar ──
  progressContainer: {
    gap: 6,
  },
  progressLabel: {
    color: Colors.textGrey,
    fontSize: Theme.typography.micro.fontSize,
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

  // ── 2×2 poster ızgarası ──
  posterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skeletonItem: {
    width: '48%',
  },

  // ── Poster kartı ──
  posterCard: {
    width: '48%',
    alignItems: 'center',
    gap: 6,
  },
  posterImage: {
    width: '100%',
    height: POSTER_H,
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  posterWatched: {
    opacity: 0.45,
  },
  posterPlaceholder: {
    width: '100%',
    height: POSTER_H,
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  filmTitle: {
    color: Colors.textWhite,
    fontSize: Theme.typography.micro.fontSize,
    textAlign: 'center',
    lineHeight: Theme.typography.micro.lineHeight,
  },

  // ── İzlendi toggle (poster üst sağ) ──
  watchedToggle: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(10,10,15,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  watchedToggleActive: {
    backgroundColor: Colors.accentDim,
  },

  // ── Boş durum ──
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 6,
  },
  emptyText: {
    color: Colors.textGrey,
    fontSize: Theme.typography.caption.fontSize,
    textAlign: 'center',
    lineHeight: Theme.typography.caption.lineHeight,
    maxWidth: 220,
  },

});
