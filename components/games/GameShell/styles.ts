/**
 * GameShell stilleri — Festival Layer.
 *
 * Anatomi: geri oku · (eyebrow + serif başlık) · sağ slot
 *          → altın segment çubuğu → içerik
 * Ayrıntı: DESIGN_SYSTEM.md › "Festival Layer — Games"
 */
import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingBottom: 83,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingBottom: Theme.spacing.sm,
    minHeight: 56,
  },
  /** Geri butonu ve sağ slot aynı genişlikte — başlık optik olarak ortalanır */
  headerSlot: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  eyebrow: {
    ...Theme.typography.eyebrow,
  },
  /**
   * Header başlığı serifTitle'ın (26) küçültülmüş hâli — üst barda 26 fazla
   * yer kaplıyor. serifTitle token'ı ekran içi dava/oyun başlıkları için durur.
   */
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: Theme.fonts.display,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: Colors.textPrimary,
    textAlign: 'center',
  },

  // ─── Progress: altın segment çubuğu (nokta değil) ─────────────────────────
  progressRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: Theme.spacing.md,
    paddingBottom: Theme.spacing.md,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  segmentUsed: {
    backgroundColor: Colors.gold,
  },
  segmentEmpty: {
    backgroundColor: Colors.white05,
  },

  content: {
    flex: 1,
    paddingHorizontal: Theme.spacing.md,
  },
});
