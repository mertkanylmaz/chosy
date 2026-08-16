/**
 * ChampionReveal stilleri — DESIGN_OS §10.2: tek poster ortalanmış,
 * display-xl başlık (Archivo Expanded — bu ekrandaki TEK kullanım),
 * meta satırı Martian Mono. Drop shadow YOK (§4.3).
 */
import { StyleSheet } from 'react-native';

import { color, radius, space, type } from '@/constants/design/semantic';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface.base,
    paddingHorizontal: space.lg,
    gap: space.lg,
  },
  posterWrapper: {
    width: '58%',
    aspectRatio: 2 / 3,
    borderRadius: radius.poster,
    overflow: 'hidden',
    backgroundColor: color.surface.raised,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  kicker: {
    ...type.meta,
    color: color.text.secondary,
    textAlign: 'center',
    marginBottom: space.sm,
  },
  title: {
    ...type['display-xl'],
    color: color.text.primary,
    textAlign: 'center',
  },
  metaLine: {
    ...type.meta,
    color: color.text.secondary,
    textAlign: 'center',
  },
  /** "Paylaş · Kapat" — sessiz eylemler, cam yok (§4.4 muafiyet listesi). */
  actionsWrapper: {
    marginTop: space.lg,
    alignItems: 'center',
    gap: space.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  actionSeparator: {
    ...type.caption,
    color: color.text.secondary,
    opacity: 0.7,
  },
  /** Pano onayı — kısa ömürlü, eylemin ÜSTÜNDE (düzen zıplamasın diye sabit sıra) */
  shareNotice: {
    ...type.caption,
    color: color.text.secondary,
    textAlign: 'center',
  },
});
