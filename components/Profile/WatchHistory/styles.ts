/**
 * WatchHistory stilleri — Profile ekranında swipe geçmişi liste kartı.
 */
import { StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const POSTER_W = 56;
export const POSTER_H = 84;

export const styles = StyleSheet.create({
  // ─── Kart ───────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Theme.spacing.lg,
  },

  // ─── Header ─────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  headerTitle: {
    ...Theme.typography.h3,
    color: Colors.textPrimary,
  },
  totalCount: {
    ...Theme.typography.caption,
    color: Colors.textSecondary,
  },

  // ─── Filter tabs ──────────────────────────────────────────────────────────
  filterRow: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.lg,
  },
  filterTab: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: 6,
    borderRadius: Theme.borderRadius.pill,
    borderWidth: 1,
    borderColor: Colors.bgSubtle,
    backgroundColor: Colors.white05,
  },
  filterTabActive: {
    backgroundColor: Colors.accentPrimary,
    borderColor: Colors.accentPrimary,
  },
  filterTabText: {
    ...Theme.typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  filterTabTextActive: {
    color: Colors.textPrimary,
  },

  // ─── Stats row ──────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.lg,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.white05,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.sm,
    alignItems: 'center',
  },
  statValue: {
    ...Theme.typography.h3,
    color: Colors.textPrimary,
  },
  statLabel: {
    ...Theme.typography.caption,
    color: Colors.textTertiary,
    marginTop: 2,
  },

  // ─── Film listesi ──────────────────────────────────────────────────────────
  filmList: {
    gap: Theme.spacing.sm,
  },
  filmRow: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
    alignItems: 'center',
  },
  posterImage: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Colors.bgSubtle,
  },
  posterPlaceholder: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  filmInfo: {
    flex: 1,
    gap: 2,
  },
  filmTitle: {
    ...Theme.typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  filmMeta: {
    ...Theme.typography.caption,
    color: Colors.textSecondary,
  },
  filmGenres: {
    ...Theme.typography.caption,
    color: Colors.textTertiary,
  },
  directionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  directionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  directionDotSaved: {
    backgroundColor: Colors.success,
  },
  directionDotSkipped: {
    backgroundColor: Colors.textTertiary,
  },
  directionText: {
    fontSize: 11,
    color: Colors.textTertiary,
  },

  // ─── Load more ──────────────────────────────────────────────────────────────
  loadMoreBtn: {
    marginTop: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    alignItems: 'center',
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.bgSubtle,
  },
  loadMoreText: {
    ...Theme.typography.caption,
    color: Colors.accentPrimary,
    fontWeight: '600',
  },

  // ─── Empty / Skeleton ──────────────────────────────────────────────────────
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.xl,
    gap: Theme.spacing.sm,
  },
  emptyText: {
    ...Theme.typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  skeletonList: {
    gap: Theme.spacing.sm,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
    alignItems: 'center',
  },
  skeletonInfo: {
    flex: 1,
    gap: 6,
  },
});
