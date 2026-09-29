import { StyleSheet } from 'react-native';

import { color, radius, size, space, type } from '@/constants/design/semantic';

/**
 * V-4 Tur C: Design OS token'larina tasindi. Eski kartin altin ust kenari
 * (`Colors.gold`) ve `minHeight: 100` kalkti — bos durumda tek satirlik ipucu
 * 100pt'lik bos bir kutu ciziyordu. Kompakt versiyonda kullanilmayan stiller
 * (arketip banner, duygu/enerji barlari, tempo secenekleri) silindi; JSX'te
 * karsiliklari yoktu.
 *
 * K-32 guven gostergesi (%N + 9 segment) bu turda EKLENMEDI: kaynak kolon
 * `cinema_dna.user_confidence` hesaplanmiyor — bkz. docs/TEKNIK_BORC.md.
 */
export const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface.raised,
    borderRadius: radius.surface,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
    padding: space.base,
    gap: space.md,
  },

  // ── Dominant emotion (compact) ──
  dominantEmotionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  dominantEmotionText: {
    ...type['body-strong'],
    color: color.text.primary,
  },

  // ── Genre chips ──
  genresBlock: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  genreChip: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
  },
  genreChipText: {
    ...type.caption,
    color: color.text.secondary,
  },

  // ── AI summary / bos durum ipucu ──
  summary: {
    ...type.callout,
    color: color.text.secondary,
  },

  // ── Skeleton ──
  skeletonRow: {
    gap: space.sm,
  },
});
