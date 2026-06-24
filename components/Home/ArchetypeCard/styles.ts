/**
 * ArchetypeCard stilleri.
 * CDO polish: Kart gölge/depth, icon circle glow, badge refinement.
 */

import { Platform, StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 20,
    marginTop: 16,
  },

  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.white10,
    backgroundColor: Colors.bgCard,
    padding: 16,
    // Subtle card depth
    ...Theme.shadow.card,
  },

  // ── Başlık satırı ──────────────────────────────────────────────────────────

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: Theme.typography.micro.fontSize,
    lineHeight: Theme.typography.micro.lineHeight,
    color: Colors.textSecondary,
    letterSpacing: 1.2,
    fontWeight: '600',
  },
  filmCountBadge: {
    backgroundColor: Colors.accentDim,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.accentPrimary + '20',
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  filmCountText: {
    fontSize: Theme.typography.micro.fontSize,
    lineHeight: Theme.typography.micro.lineHeight,
    color: Colors.accentPrimary,
    fontWeight: '700',
  },

  // ── Arketip satırı ─────────────────────────────────────────────────────────

  archetypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  /** Icon circle — glow efekti arketip renginden türetilir */
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  /** Dynamic glow shadow — applied via inline style with archetype color */
  iconGlow: Platform.select({
    ios: {
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.45,
      shadowRadius: 12,
    },
    android: {
      elevation: 6,
    },
    default: {},
  }),
  iconEmoji: {
    width: 32,
    height: 32,
  },
  archetypeInfo: {
    flex: 1,
  },
  archetypeName: {
    fontSize: Theme.typography.h3.fontSize,
    lineHeight: Theme.typography.h3.lineHeight,
    fontFamily: 'PlayfairDisplay_700Bold',
    marginBottom: 4,
  },
  archetypeDesc: {
    fontSize: Theme.typography.caption.fontSize,
    color: Colors.textSecondary,
    lineHeight: Theme.typography.caption.lineHeight,
  },

  // ── Kalibrasyon CTA ────────────────────────────────────────────────────────

  calibrateCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.accentDim,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.accentPrimary + '18',
  },
  calibrateText: {
    flex: 1,
  },
  calibrateTitle: {
    fontSize: Theme.typography.body.fontSize,
    lineHeight: Theme.typography.body.lineHeight,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  calibrateHint: {
    fontSize: Theme.typography.caption.fontSize,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: Theme.typography.caption.lineHeight,
  },
});
