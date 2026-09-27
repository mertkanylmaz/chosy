import { StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { color } from '@/constants/design/semantic';
import { withAlpha } from '@/constants/gameThemes';
import { Theme } from '@/constants/theme';

/** Uniform card height — all cards same size in 2-column grid */
export const CARD_HEIGHT = 120;
/** Gap between cards */
export const CARD_GAP = 12;

export const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },

  // ─── Card ─────────────────────────────────────────────────────────────────
  card: {
    height: CARD_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardGradient: {
    flex: 1,
    padding: 16,
    justifyContent: 'flex-end',
  },

  // ─── Emoji glow — small corner element, NOT the visual focus ──────────
  emojiContainer: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiGlow: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  emojiText: {
    fontSize: 24,
  },

  // ─── Text — bottom-left, never overlaps with emoji top-right ──────────
  textBlock: {
    gap: 2,
    maxWidth: '75%',
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  /**
   * DESIGN_OS §2.7: `smoke` küçük metinde kullanılmaz → `bone`@70%.
   * Kart gradient'lerinin en açık ucunda bile ≥6.6:1 (önce 4.2:1).
   */
  subtitle: {
    fontSize: Theme.typography.caption.fontSize,
    lineHeight: Theme.typography.caption.lineHeight,
    fontWeight: '400',
    color: withAlpha(color.text.primary, 0.7),
  },
});
