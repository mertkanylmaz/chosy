import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardSolid,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Theme.spacing.md,
    gap: 14,
    /** Sabit minHeight — veri yuklenene kadar layout shift'i engeller */
    minHeight: 140,
  },

  // ── Başlık ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: Colors.textWhite,
    fontSize: 15,
    fontFamily: 'PlayfairDisplay_700Bold',
    letterSpacing: 0.2,
  },

  // ── 2×2 stat grid ──
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: '47%',
    backgroundColor: Colors.white05,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.white10,
    padding: 14,
    gap: 6,
  },
  statIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    color: Colors.gold,
    fontSize: 28,
    fontFamily: 'PlayfairDisplay_700Bold',
    lineHeight: 34,
  },
  /** 0 degeri altin vurguyu hak etmiyor — "basarisiz" hissini yumusatir */
  statValueEmpty: {
    color: Colors.textGrey,
  },
  statLabel: {
    color: Colors.textGrey,
    fontSize: 11,
    fontWeight: '500',
  },

  // ── Top Genre pills ──
  insightsSection: {
    gap: 8,
  },
  insightsLabel: {
    color: Colors.textGrey,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genrePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Theme.borderRadius.pill,
    backgroundColor: Colors.accentDim,
    borderWidth: 1,
    borderColor: Colors.accentPrimary + '30',
  },
  genrePillText: {
    color: Colors.textWhite,
    fontSize: 13,
    fontWeight: '600',
  },
  genrePct: {
    color: Colors.accentPrimary,
    fontSize: 12,
    fontWeight: '700',
  },

  // ── Boş durum ──
  empty: {
    color: Colors.textGrey,
    fontSize: 13,
    paddingVertical: 8,
    fontStyle: 'italic',
  },

  // ── Skeleton ──
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  skeletonCard: {
    width: '47%',
  },
});
