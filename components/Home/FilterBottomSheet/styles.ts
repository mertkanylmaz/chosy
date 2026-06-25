import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  // ─── Trigger row ──────────────────────────────────────────────────────────
  triggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 6,
  },
  triggerText: {
    fontSize: Theme.typography.caption.fontSize,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  triggerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Theme.borderRadius.full,
    backgroundColor: Colors.accentDim,
  },
  triggerBadgeText: {
    fontSize: Theme.typography.micro.fontSize,
    color: Colors.accentPrimary,
    fontWeight: '700',
  },

  // ─── Modal overlay ────────────────────────────────────────────────────────
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 40,
    paddingHorizontal: 20,
    gap: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textTertiary,
    alignSelf: 'center',
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: Theme.typography.h3.fontSize,
    fontWeight: '700',
    color: Colors.textPrimary,
  },

  // ─── Filter section ───────────────────────────────────────────────────────
  filterSection: {
    gap: 10,
  },
  filterLabel: {
    fontSize: Theme.typography.micro.fontSize,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: Colors.bgElevated,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Theme.borderRadius.full,
  },
  chipActive: {
    backgroundColor: Colors.accentPrimary,
  },
  chipText: {
    fontSize: Theme.typography.caption.fontSize,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: Colors.textOnAccent,
    fontWeight: '700',
  },

  // ─── Action buttons ───────────────────────────────────────────────────────
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  clearBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  clearBtnText: {
    fontSize: Theme.typography.body.fontSize,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  applyBtn: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accentPrimary,
  },
  applyBtnText: {
    fontSize: Theme.typography.body.fontSize,
    fontWeight: '700',
    color: Colors.textOnAccent,
  },
});
