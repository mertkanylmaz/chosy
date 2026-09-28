/**
 * RoundIndicator stilleri — DESIGN_OS v4.1 §10.1 (C.9b-UI, L-6).
 *
 * V-3 Tur G1 (G2): 3 segment → **3 nokta**, sayaç altta. Aktif `beam`,
 * pasif `graphite` (renk dili C.9b-UI'daki gibi). Toplam yükseklik
 * `ROUND_INDICATOR_HEIGHT` — yükleme iskeleti aynı payı ayırır.
 */
import { StyleSheet } from 'react-native';

import { color, size, space, type } from '@/constants/design/semantic';

/** Nokta + boşluk + sayaç satırı — iskelet bu değeri kullanır, düzen kaymaz. */
export const ROUND_INDICATOR_HEIGHT = size.progressDot + space.xs + type.meta.lineHeight;

export const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: space.xs,
  },
  dots: {
    flexDirection: 'row',
    gap: space.sm,
  },
  dot: {
    width: size.progressDot,
    height: size.progressDot,
    borderRadius: size.progressDot / 2,
    backgroundColor: color.surface.border,
  },
  dotActive: {
    backgroundColor: color.accent.active,
  },
  /** Sayaç — §10.1'in mono istisnası (yıl·süre·tur sayacı). */
  label: {
    ...type.meta,
    color: color.text.secondary,
  },
});
