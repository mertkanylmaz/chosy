/**
 * StreakCard stilleri — CDO spec'e uygun.
 * Spec: .claude/specs/GAMIFICATION_UI_SPEC.md — Component 3
 */
import { StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

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
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.lg,
  },
  headerEmoji: {
    fontSize: 20,
  },
  headerTitle: {
    ...Theme.typography.h3,
    color: Colors.textPrimary,
  },

  // ─── 3-Stat Row ─────────────────────────────────────────────────────────────
  statRow: {
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
    ...Theme.typography.h2,
  },
  statValueCurrent: {
    color: Colors.accentPrimary,
  },
  statValueBest: {
    color: Colors.gold,
  },
  statValueTotal: {
    color: Colors.textPrimary,
  },
  statLabel: {
    ...Theme.typography.caption,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  statSublabel: {
    ...Theme.typography.caption,
    color: Colors.textSecondary,
  },

  // ─── 14-Gün Dot Row ────────────────────────────────────────────────────────
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.xs,
  },
  dotWrapper: {
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotActive: {
    backgroundColor: Colors.accentPrimary,
    shadowColor: Colors.accentPrimary,
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  dotToday: {
    backgroundColor: Colors.accentPrimary,
    borderWidth: 2,
    borderColor: Colors.gold,
  },
  dotInactive: {
    backgroundColor: Colors.bgSubtle,
  },
  dayLabel: {
    fontSize: 9,
    color: Colors.textTertiary,
  },

  // ─── Progress Bar ───────────────────────────────────────────────────────────
  progressSection: {
    marginTop: Theme.spacing.lg,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.sm,
  },
  progressLabel: {
    ...Theme.typography.caption,
    color: Colors.textTertiary,
  },
  progressMilestone: {
    ...Theme.typography.caption,
    color: Colors.textSecondary,
  },
  progressValue: {
    ...Theme.typography.caption,
    color: Colors.textSecondary,
  },
  progressBar: {
    height: 6,
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Colors.bgSubtle,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Colors.accentPrimary,
  },
  allAchieved: {
    ...Theme.typography.caption,
    color: Colors.gold,
    textAlign: 'center',
    marginTop: Theme.spacing.lg,
  },

  // ─── Empty / Zero State ─────────────────────────────────────────────────────
  emptyMessage: {
    ...Theme.typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: Theme.spacing.md,
  },

  // ─── Skeleton ───────────────────────────────────────────────────────────────
  skeletonRow: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
  },
  skeletonBox: {
    flex: 1,
  },
});
