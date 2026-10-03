/**
 * ChampionActionButton stilleri — V-3 Tur G2 (C6). Drop shadow YOK (§4.3).
 * Kontrast: `ink` metin `marquee` üstünde 8.9:1, `bone` üstünde 16.6:1;
 * `bone` metin `ink` üstünde 16.6:1.
 */
import { StyleSheet } from 'react-native';

import { color, radius, size, space, type } from '@/constants/design/semantic';

export const styles = StyleSheet.create({
  button: {
    alignSelf: 'stretch',
    minHeight: size.actionHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.base,
    borderRadius: radius.pill,
  },
  /** S-2: ikincil ikon satırı — 44pt kare dokunma hedefi (K-54), metin yok. */
  iconButton: {
    width: size.touchTarget,
    height: size.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  marquee: {
    backgroundColor: color.reward.primary,
  },
  filled: {
    backgroundColor: color.text.primary,
  },
  outline: {
    borderWidth: size.hairline,
    borderColor: color.surface.border,
  },
  text: {
    ...type['body-strong'],
  },
  textOnFill: {
    color: color.surface.base,
  },
  textOnDark: {
    color: color.text.primary,
  },
  /** OutlineAction / QuietAction ile aynı 0.35 — V-2 Tur A davranışı. */
  disabled: {
    opacity: 0.35,
  },
});
