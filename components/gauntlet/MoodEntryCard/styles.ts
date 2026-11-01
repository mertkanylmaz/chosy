/**
 * MoodEntryCard stilleri — MoodInviteCard / SpotlightBonusCard ile aynı dil: raised yüzey,
 * vurgu rengi yok (DESIGN_OS: ışık vurgudur). Satır içi, modal değil.
 */
import { StyleSheet } from 'react-native';

import { color, radius, space, type } from '@/constants/design/semantic';
import { MOOD_ENTRY_CARD_HEIGHT, MOOD_ENTRY_MARGIN } from '@/utils/moodEntry';

export const styles = StyleSheet.create({
  slot: {
    marginTop: MOOD_ENTRY_MARGIN,
  },
  card: {
    minHeight: MOOD_ENTRY_CARD_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.base,
    marginHorizontal: space.base,
    borderRadius: radius.surface,
    backgroundColor: color.surface.raised,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...type.callout,
    color: color.text.primary,
  },
  subtitle: {
    ...type.caption,
    color: color.text.secondary,
  },
  /** Pro rozeti: okunur boy (callout 15pt, ana renk) ve pill; asla satır kırmaz / küçülmez. */
  badgePill: {
    flexShrink: 0,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.accent.edgeStrong,
  },
  badge: {
    ...type.callout,
    fontWeight: '600',
    color: color.text.primary,
  },
  chevron: {
    ...type.caption,
    color: color.text.secondary,
  },
});
