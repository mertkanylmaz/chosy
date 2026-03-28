/**
 * StreakBadge stilleri — CDO spec'e uygun.
 * Spec: .claude/specs/GAMIFICATION_UI_SPEC.md — Component 1
 */
import { StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  // ─── Container ──────────────────────────────────────────────────────────────
  /** Pill şeklinde badge — minimum dokunma alanı 44px */
  touchable: {
    minWidth: 52,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    borderRadius: 9999,
    borderWidth: 1,
    gap: Theme.spacing.xs,
  },

  // ─── Aktif streak (>= 1) ───────────────────────────────────────────────────
  pillActive: {
    backgroundColor: Colors.accentDim,
    borderColor: Colors.accentPrimary,
  },

  // ─── Sıfır streak (=== 0) ──────────────────────────────────────────────────
  pillZero: {
    backgroundColor: Colors.white05,
    borderColor: Colors.bgSubtle,
  },

  // ─── Emoji ──────────────────────────────────────────────────────────────────
  emoji: {
    fontSize: 14,
  },
  emojiDim: {
    opacity: 0.4,
  },

  // ─── Streak sayısı ─────────────────────────────────────────────────────────
  count: {
    fontSize: 16,
    fontWeight: '600',
  },
  countActive: {
    color: Colors.textPrimary,
  },
  countZero: {
    color: Colors.textTertiary,
  },

  // ─── Skeleton ───────────────────────────────────────────────────────────────
  skeleton: {
    width: 52,
    height: 32,
    borderRadius: 9999,
  },
});
