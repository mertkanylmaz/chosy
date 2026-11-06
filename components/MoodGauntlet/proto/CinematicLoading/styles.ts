/**
 * PROTOTİP — Cinematic Discovery Loading stilleri. Token dosyaları tek kaynak (semantic).
 * Altın yalnız `color.reward.primary` (= palette.marquee): film şeridi + CTA. Projektör nötr.
 */
import { StyleSheet } from 'react-native';

import { color, radius, size, space } from '@/constants/design/semantic';

/** Projektör çizim kutusu (pt) — boşluk merdiveninden. */
export const PROJECTOR_W = space.xxxl * 2; // 128
export const PROJECTOR_H = space.xxxl + space.sm; // 72
/** SVG viewBox'ı (projektör iç koordinatları); mercek ucu = (60, 66). */
export const PROJECTOR_VIEW = { w: 120, h: 68, lensX: 60, lensY: 66 } as const;
export const REEL_R = 14;

export const styles = StyleSheet.create({
  /** Kök: Your four köküyle aynı (introRoot) — başlık · ölçülen ızgara kutusu · CTA. */
  sceneLayer: { ...StyleSheet.absoluteFillObject },
  projector: { position: 'absolute', top: 0, width: PROJECTOR_W, height: PROJECTOR_H },
  reel: { position: 'absolute', width: REEL_R * 2 + 2, height: REEL_R * 2 + 2 },
  frame: { position: 'absolute', left: 0, top: 0 },
  frameOutline: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    borderRadius: radius.poster,
    borderWidth: size.hairline,
    borderColor: color.accent.edge,
    backgroundColor: color.surface.raised,
  },
  blurLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    borderRadius: radius.poster,
    overflow: 'hidden',
  },
  blurImage: { width: '100%', height: '100%' },
});
