/**
 * Detective ipucu bicimlendirme yardimcilari.
 *
 * Sunucu ipucu degerlerini ham gonderir (dizi, sayi veya metin); etiket ve
 * gosterim bicimi burada uretilir. Ayri dosyada durmasinin sebebi: hem oyun
 * ekrani (index.tsx) hem oyun sonu ogrenme karti (WhyThisMovie.tsx) ayni
 * bicimlendiriciyi kullaniyor — index.tsx'ten export edilseydi dairesel
 * import olusurdu.
 */
import type { SpotlightClueType } from '@/types/game';

/** Ipucu degerini gosterim formatina cevirir */
export function formatClueValue(
  type: SpotlightClueType | string,
  value: string | number | string[],
  t: (key: string) => string,
): string {
  switch (type) {
    case 'runtime':
      return `${String(value)} ${t('games.detective.clue_labels.minutes')}`;
    case 'imdb_rating':
      return `${String(value)} IMDb`;
    case 'genres':
    case 'cast':
      return Array.isArray(value) ? value.join(', ') : String(value);
    default:
      return Array.isArray(value) ? value.join(', ') : String(value);
  }
}

/** Ipucu turunun yerellestirilmis etiketini dondurur */
export function clueTypeLabel(
  type: SpotlightClueType | string,
  t: (key: string) => string,
): string {
  return t(`games.detective.clue_labels.${type}`);
}

/** "Tur: Aksiyon, Komedi" bicimindeki tam satiri uretir */
export function formatClueLine(
  type: SpotlightClueType | string,
  value: string | number | string[],
  t: (key: string) => string,
): string {
  return `${clueTypeLabel(type, t)}: ${formatClueValue(type, value, t)}`;
}
