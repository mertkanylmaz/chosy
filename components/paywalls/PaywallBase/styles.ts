/**
 * PaywallBase — shared styles for all contextual paywall variants.
 */

import { Dimensions, StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const PAYWALL_HEIGHT = SCREEN_HEIGHT * 0.85;

export const styles = StyleSheet.create({
  // ─── Bottom Sheet Overlay ──────────────────────────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    height: PAYWALL_HEIGHT,
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Theme.borderRadius.xl,
    borderTopRightRadius: Theme.borderRadius.xl,
    overflow: 'hidden',
  },

  // ─── Drag Handle ──────────────────────────────────────────────────────────
  dragHandleArea: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.bgSubtle,
  },

  // ─── Scroll Content ───────────────────────────────────────────────────────
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // ─── Header ───────────────────────────────────────────────────────────────
  header: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 20,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: Theme.typography.h2.fontSize,
    lineHeight: Theme.typography.h2.lineHeight,
    fontWeight: '800',
    color: Colors.textWhite,
    textAlign: 'center',
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: Theme.typography.body.fontSize,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: Theme.typography.body.lineHeight,
    paddingHorizontal: 12,
  },

  // ─── Plan Cards ───────────────────────────────────────────────────────────
  planContainer: {
    gap: 10,
    marginBottom: 16,
  },
  planCard: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Theme.borderRadius.lg,
    padding: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planCardSelected: {
    borderColor: Colors.accentPrimary,
    backgroundColor: Colors.accentDim,
  },
  planInfo: {
    flex: 1,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  planTitle: {
    fontSize: Theme.typography.h3.fontSize,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  planTitleSelected: {
    color: Colors.accentPrimary,
  },
  planBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: Colors.gold + '20',
  },
  planBadgeText: {
    fontSize: Theme.typography.micro.fontSize,
    fontWeight: '700',
    color: Colors.gold,
    letterSpacing: 0.4,
  },
  planPrice: {
    fontSize: Theme.typography.caption.fontSize,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  planSaving: {
    fontSize: Theme.typography.micro.fontSize,
    color: Colors.success,
    fontWeight: '600',
    marginTop: 2,
  },

  // Radio indicator
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.bgSubtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  radioOuterSelected: {
    borderColor: Colors.accentPrimary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.accentPrimary,
  },

  // ─── Trial Info ───────────────────────────────────────────────────────────
  trialInfo: {
    fontSize: Theme.typography.caption.fontSize,
    color: Colors.accentPrimary,
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 12,
  },

  // ─── CTA Button ──────────────────────────────────────────────────────────
  ctaButton: {
    borderRadius: Theme.borderRadius.lg,
    overflow: 'hidden',
    marginBottom: 10,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
  },
  ctaText: {
    fontSize: Theme.typography.h3.fontSize,
    fontWeight: '800',
    color: Colors.textOnAccent,
    letterSpacing: 0.3,
  },
  ctaDisabled: {
    opacity: 0.6,
  },

  // ─── Secondary Actions ────────────────────────────────────────────────────
  dismissButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dismissText: {
    fontSize: Theme.typography.body.fontSize,
    color: Colors.textTertiary,
    fontWeight: '500',
  },

  // ─── Restore ──────────────────────────────────────────────────────────────
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  restoreText: {
    fontSize: Theme.typography.caption.fontSize,
    color: Colors.textTertiary,
  },

  // ─── Legal ────────────────────────────────────────────────────────────────
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  legalLink: {
    fontSize: Theme.typography.micro.fontSize,
    color: Colors.accentPrimary,
    textDecorationLine: 'underline',
  },
  legalSeparator: {
    fontSize: Theme.typography.micro.fontSize,
    color: Colors.textTertiary,
  },
  autoRenew: {
    fontSize: Theme.typography.micro.fontSize,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: Theme.typography.micro.lineHeight,
    paddingHorizontal: 16,
    marginTop: 8,
  },
});
