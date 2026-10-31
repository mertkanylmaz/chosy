/**
 * MoodInviteCard stilleri — SpotlightBonusCard ile aynı dil: raised yüzey, hairline
 * kenar yok, vurgu rengi yok (DESIGN_OS: ışık vurgudur, renk değil). Satır içi,
 * modal değil.
 */
import { StyleSheet } from 'react-native';

import { color, radius, space, type } from '@/constants/design/semantic';
import { MOOD_INVITE_CARD_HEIGHT, MOOD_INVITE_MARGIN } from '@/utils/moodInvite';

export const styles = StyleSheet.create({
  slot: {
    marginTop: MOOD_INVITE_MARGIN,
  },
  card: {
    minHeight: MOOD_INVITE_CARD_HEIGHT,
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
  kicker: {
    ...type['label-caps'],
    color: color.text.secondary,
  },
  title: {
    ...type.caption,
    color: color.text.primary,
  },
  chevron: {
    ...type.caption,
    color: color.text.secondary,
  },
});
