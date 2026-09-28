/**
 * OutlineAction stilleri — V-3 Tur G1 (G6). Dolgu YOK, `graphite` kenar:
 * birincil eylem poster dokunuşudur, bu butonlar onunla yarışmaz.
 * `accent.*` (beam) ve `reward.*` (marquee) burada kullanılmaz.
 */
import { StyleSheet } from 'react-native';

import { color, radius, size, space, type } from '@/constants/design/semantic';

export const styles = StyleSheet.create({
  /** `flex: 1` — satırdaki kardeşiyle eşit genişlik; yükseklik ≥ 44pt. */
  button: {
    flex: 1,
    minHeight: size.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
  },
  /** Metin `bone` — ink üstünde 16.56:1, charcoal üstünde 15.06:1. */
  text: {
    ...type.callout,
    color: color.text.primary,
  },
  /**
   * Disabled (V-2 Tur A davranışı korunur): QuietAction'daki 0.35 opaklık —
   * kenar ve metin birlikte söner, enabled'dan belirgin ayrı.
   */
  disabled: {
    opacity: 0.35,
  },
});
