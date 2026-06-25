import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

/** Poster kart boyutlari */
export const POSTER_WIDTH = 140;
export const POSTER_HEIGHT = 210;

export const styles = StyleSheet.create({
  container: {
    marginBottom: Theme.spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
  },
  headerTitle: {
    ...Theme.typography.h2,
  },
  listContent: {
    paddingHorizontal: Theme.spacing.md,
    gap: Theme.spacing.sm + 4,
  },
  card: {
    width: POSTER_WIDTH,
  },
  poster: {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Colors.bgElevated,
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    borderBottomLeftRadius: Theme.borderRadius.md,
    borderBottomRightRadius: Theme.borderRadius.md,
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  filmTitle: {
    ...Theme.typography.caption,
    color: Colors.textWhite,
    fontWeight: '600',
  },
  // ─── Date Badge ────────────────────────────────────────────────────────
  dateBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: Colors.accentPrimary,
    borderRadius: Theme.borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dateBadgeText: {
    ...Theme.typography.micro,
    color: Colors.textOnAccent,
    fontWeight: '700',
  },
  // ─── Skeleton ──────────────────────────────────────────────────────────
  skeletonCard: {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Colors.bgElevated,
  },
});
