import { StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

const POSTER_W = 60;
const POSTER_H = 90;
const POSTER_OFFSET = 15;

export const POSTER_DIMENSIONS = { w: POSTER_W, h: POSTER_H, offset: POSTER_OFFSET };

export const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.cardSolid,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Theme.spacing.md,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
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

  // ── Entry kartı ──
  entryCard: {
    backgroundColor: Colors.card,
    borderRadius: Theme.borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  entryLeft: {
    flex: 1,
  },
  entryDate: {
    color: Colors.textGrey,
    fontSize: 11,
    marginBottom: 3,
    letterSpacing: 0.2,
  },
  entryMoodText: {
    color: Colors.textWhite,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 3,
  },
  entryMeta: {
    color: Colors.textGrey,
    fontSize: 11,
  },

  // ── Poster fan ──
  posterStack: {
    flexDirection: 'row',
  },
  posterItem: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.background,
    overflow: 'hidden',
    backgroundColor: Colors.cardSolid,
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  posterPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
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
  },

  // ── Go to Mood butonu ──
  goMoodButton: {
    marginTop: 10,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  goMoodButtonText: {
    color: Colors.gold,
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Skeleton ──
  skeletonRow: {
    marginBottom: 8,
  },
});
