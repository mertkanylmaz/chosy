/**
 * SpotlightResult stilleri — "Karanlık Salon". Yalnız Design OS token'ları;
 * ham hex yok. `marquee` (ödül katmanı) yalnız kazanç başlığında ve birincil
 * eylemde — kayıp ekranı altın taşımaz.
 */
import { StyleSheet } from 'react-native';

import { color, space, type } from '@/constants/design/semantic';
import { withAlpha } from '@/constants/gameThemes';

export const resultStyles = StyleSheet.create({
  container: {
    gap: space.md,
    paddingTop: space.lg,
    alignItems: 'center',
  },
  /** Film adı — Design OS `display-m` (Archivo Expanded 600, 22/26) */
  title: {
    ...type['display-m'],
    color: color.text.primary,
    textAlign: 'center',
  },
  /** Yıl (+ süre, varsa) — bone@70% (smoke 13pt altı yasak, §2.7) */
  meta: {
    ...type.meta,
    color: withAlpha(color.text.primary, 0.7),
    textAlign: 'center',
  },
  status: {
    alignItems: 'center',
    gap: space.xs,
    paddingTop: space.sm,
  },
  /** FLAWLESS — marquee: ödül katmanı yalnız kusursuzda */
  statusFlawless: {
    ...type['display-m'],
    color: color.reward.primary,
    textAlign: 'center',
  },
  /** FOUND IT — bone, bir kademe küçük (`title`): FLAWLESS'tan ayrışır, film adıyla yarışmaz */
  statusFound: {
    ...type.title,
    color: color.text.primary,
    textAlign: 'center',
  },
  /** Kayıp başlığı — altın YOK */
  statusLost: {
    ...type['display-m'],
    color: color.text.primary,
    textAlign: 'center',
  },
  statusDetail: {
    ...type.meta,
    color: withAlpha(color.text.primary, 0.7),
    textAlign: 'center',
  },
  statusSub: {
    ...type.callout,
    color: withAlpha(color.text.primary, 0.7),
    textAlign: 'center',
  },
  actions: {
    alignSelf: 'stretch',
    gap: space.sm,
    paddingTop: space.sm,
  },
  /** İkincil eylemler — Save + Share yan yana (fontScale <= 1.3) */
  actionsRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
  actionsRowItem: {
    flex: 1,
  },
  /** Kaydet hatası — sakin satır içi metin; kutu/renk dolgusu yok */
  saveError: {
    ...type.caption,
    color: withAlpha(color.text.primary, 0.7),
    textAlign: 'center',
  },
  /** Alt satır — saat/sayaç YOK (M2 öncesi saat yalan olur) */
  footer: {
    ...type['label-caps'],
    color: withAlpha(color.text.primary, 0.7),
    textAlign: 'center',
    paddingTop: space.md,
  },
});
