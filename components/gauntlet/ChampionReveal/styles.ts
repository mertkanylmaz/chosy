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
  dismissWrapper: {
    marginTop: space.lg,
  },
});
