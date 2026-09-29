/**
 * RoundIndicator stilleri — DESIGN_OS v4.1 §10.1 (C.9b-UI, L-6).
 *
 * V-3 Tur G1 (G2): 3 segment → 3 nokta, sayaç altta.
 * V-4 Tur B (V4-D4): bağlı stepper. Tamamlanan `bone`, aktif `marquee`
 * (`color.reward.primary` — bu ekranda marquee'nin üç izinli yerinden
 * biri), bekleyen `graphite`. Düğümle sayaç arasında `space.sm` nefes.
 * Toplam yükseklik `ROUND_INDICATOR_HEIGHT` — yükleme iskeleti aynı payı
 * ayırır.
 */
import { StyleSheet } from 'react-native';

import { color, size, space, type } from '@/constants/design/semantic';

/** Düğüm + nefes + sayaç satırı — iskelet bu değeri kullanır, düzen kaymaz. */
export const ROUND_INDICATOR_HEIGHT = size.progressDot + space.sm + type.meta.lineHeight;

export const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: space.sm,
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  node: {
    width: size.progressDot,
    height: size.progressDot,
    borderRadius: size.progressDot / 2,
  },
  nodeDone: {
    backgroundColor: color.text.primary,
  },
  nodeActive: {
    backgroundColor: color.reward.primary,
  },
  nodePending: {
    backgroundColor: color.surface.border,
  },
  /** Düğümler arası bağlantı — `space.lg` uzunluk, çizgi kalınlığı. */
  connector: {
    width: space.lg,
    height: size.hairline,
  },
  connectorReached: {
    backgroundColor: color.text.primary,
  },
  connectorPending: {
    backgroundColor: color.surface.border,
  },
  /** Sayaç — §10.1'in mono istisnası (yıl·süre·tur sayacı). */
  label: {
    ...type.meta,
    color: color.text.secondary,
  },
});
