/**
 * PROTOTİP — statik sahne stilleri. Token dosyaları tek kaynak (semantic); Your four düzeni
 * `components/MoodGauntlet/styles.ts` (intro*) üzerinden aynen kullanılır, burada kopyalanmaz.
 */
import { StyleSheet } from 'react-native';

import { color, radius, size, space, type } from '@/constants/design/semantic';

export const styles = StyleSheet.create({
  root: { backgroundColor: color.surface.base },
  backdrop: { ...StyleSheet.absoluteFillObject },
  /** Bekleme başlığı: "Finding your four" + mood çipi (storyboard kare 3 başlık bloğu). */
  waitingHead: { alignItems: 'center', gap: space.md, paddingTop: space.lg },
  waitingTitle: { ...type['display-m'], color: color.text.primary, textAlign: 'center' },
  moodChip: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: size.hairline,
    borderColor: color.accent.edgeStrong,
    backgroundColor: color.accent.fill,
  },
  moodChipText: { ...type['label-caps'], color: color.text.primary },
  /** Bekleme sahnesinde CTA alanı ayrılır ama görünmez → iki sahnede ızgara kutusu aynı tabandan ölçülür. */
  footerReserved: { opacity: 0 },
  poster: { position: 'absolute' },
  guard: {
    padding: space.base,
    borderRadius: radius.poster,
    borderWidth: size.hairline,
    borderColor: color.accent.focus,
    backgroundColor: color.surface.raised,
  },
  guardText: { ...type.callout, color: color.text.primary, textAlign: 'center' },
});
