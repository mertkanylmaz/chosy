/**
 * PendingWatchFeedbackCard stilleri — T3. Tokenlar YALNIZCA
 * `constants/design/semantic.ts`'ten; hardcoded renk yok. `bone@70%` / `@85%`
 * semantic `bone` tokenından `withAlpha` ile türetilir (yeni hex yok).
 *
 * `makeStyles(highContrast)`: Increase Contrast (Design OS §11) — `smoke` →
 * `bone`@85%, `graphite` kenar → `smoke`. Sızma kapatma `LightBleed`'in işi.
 *
 * 13pt tabanı: meta ve ikincil metin 13pt'nin altına inmez. `type.meta` /
 * `label-caps` tokenları 12pt — burada yalnız boyut/satır yüksekliği 13/18'e
 * çekilir (ailesi ve harf aralığı oranı korunur), token dosyası değişmez.
 */
import { StyleSheet } from 'react-native';

import { withAlpha } from '@/constants/gameThemes';
import { color, radius, size, space, type } from '@/constants/design/semantic';

/** Poster slotunun asgari yüksekliği — çok büyük Dynamic Type'ta kaydırma devreye girer. */
export const POSTER_SLOT_MIN_HEIGHT = 96;

export function makeStyles(highContrast: boolean) {
  const secondary = highContrast ? withAlpha(color.text.primary, 0.85) : color.text.secondary;
  const link = withAlpha(color.text.primary, highContrast ? 0.85 : 0.7);
  const hairline = highContrast ? color.text.secondary : color.surface.border;

  return StyleSheet.create({
    scroll: {
      flexGrow: 1,
    },
    root: {
      flex: 1,
      backgroundColor: 'transparent', // zemini Shell'in `ink` + LightBleed katmanı verir
      paddingHorizontal: space.lg,
      paddingTop: space.base,
      paddingBottom: space.base,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
    },
    hairline: {
      flex: 1,
      height: size.hairline,
      backgroundColor: hairline,
    },
    label: {
      ...type['label-caps'],
      fontSize: 13,
      lineHeight: 18,
      letterSpacing: 1.04, // 13 × 0.08
      color: color.reward.primary,
      textTransform: 'uppercase',
      textAlign: 'center',
      flexShrink: 1,
    },
    posterSlot: {
      flex: 1,
      minHeight: POSTER_SLOT_MIN_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: space.base,
    },
    poster: {
      borderRadius: radius.poster,
      borderWidth: size.hairline,
      borderColor: color.accent.edge,
      overflow: 'hidden',
    },
    titleBlock: {
      alignItems: 'center',
      gap: space.xs,
    },
    title: {
      ...type['display-m'],
      color: color.text.primary, // bone — başlıkta vurgu rengi YOK
      textAlign: 'center',
      alignSelf: 'stretch',
    },
    meta: {
      ...type.meta,
      fontSize: 13,
      lineHeight: 18,
      color: secondary,
      textAlign: 'center',
    },
    actionBlock: {
      marginTop: space.lg,
      alignItems: 'stretch',
    },
    question: {
      ...type.title,
      color: color.text.primary,
      textAlign: 'center',
      marginBottom: space.base,
    },
    buttons: {
      alignSelf: 'stretch',
      gap: space.md,
    },
    button: {
      alignSelf: 'stretch',
      minHeight: size.actionHeight,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: space.sm,
      paddingHorizontal: space.base,
      borderRadius: radius.pill,
      borderWidth: size.hairline,
      backgroundColor: color.accent.fill,
      borderColor: color.accent.edgeStrong,
    },
    buttonText: {
      ...type['body-strong'],
      color: color.text.primary,
      textAlign: 'center',
    },
    pressed: {
      opacity: 0.8,
    },
    disabled: {
      opacity: 0.35,
    },
    linkRow: {
      alignItems: 'center',
      marginTop: space.lg,
    },
    linkText: {
      ...type.caption, // 13pt — tabanın üstünde
      color: link,
    },
  });
}
