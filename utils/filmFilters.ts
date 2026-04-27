/**
 * FilmFilters yardımcı fonksiyonları.
 * TasteProfile alanlarına dönüşüm ve JS tarafı filtreleme için kullanılır.
 */
import { EraPreference, FilmFilters, YearRangeFilter } from '../types';

// ─── Genre Normalizer ─────────────────────────────────────────────────────────

/**
 * Türkçe genre adlarını İngilizce karşılıklarına eşler.
 * films tablosu Türkçe genre string'leriyle seeded; UI'da EN göstermek için kullanılır.
 */
const TR_TO_EN_GENRE: Record<string, string> = {
  Aksiyon: 'Action',
  Macera: 'Adventure',
  Animasyon: 'Animation',
  Komedi: 'Comedy',
  Suç: 'Crime',
  Belgesel: 'Documentary',
  Drama: 'Drama',
  Aile: 'Family',
  Fantezi: 'Fantasy',
  Tarih: 'History',
  Korku: 'Horror',
  Müzik: 'Music',
  Gizem: 'Mystery',
  Romantik: 'Romance',
  'Bilim Kurgu': 'Science Fiction',
  'TV Filmi': 'TV Movie',
  Gerilim: 'Thriller',
  Savaş: 'War',
  Western: 'Western',
};

/**
 * Tek bir genre string'ini normalize eder: Türkçe → İngilizce.
 * Eşleşme yoksa (zaten İngilizce veya bilinmeyen) orijinal döner.
 *
 * @param genre - DB'den gelen raw genre string
 * @returns İngilizce genre adı
 */
export function normalizeGenre(genre: string): string {
  return TR_TO_EN_GENRE[genre] ?? genre;
}

/**
 * Bir genre dizisini toplu normalize eder.
 *
 * @param genres - DB'den gelen raw genre dizisi
 * @returns Normalize edilmiş İngilizce genre dizisi
 */
export function normalizeGenres(genres: string[]): string[] {
  return genres.map(normalizeGenre);
}

/**
 * İngilizce genre adlarını Türkçe karşılıklarına eşler.
 * Uygulama dili TR iken EN genre string'lerini geri çevirmek için kullanılır.
 */
const EN_TO_TR_GENRE: Record<string, string> = {
  Action: 'Aksiyon',
  Adventure: 'Macera',
  Animation: 'Animasyon',
  Comedy: 'Komedi',
  Crime: 'Suç',
  Documentary: 'Belgesel',
  Drama: 'Drama',
  Family: 'Aile',
  Fantasy: 'Fantezi',
  History: 'Tarih',
  Horror: 'Korku',
  Music: 'Müzik',
  Mystery: 'Gizem',
  Romance: 'Romantik',
  'Science Fiction': 'Bilim Kurgu',
  'TV Movie': 'TV Filmi',
  Thriller: 'Gerilim',
  War: 'Savaş',
  Western: 'Western',
};

/**
 * Tek bir genre string'ini aktif uygulama diline göre lokalize eder.
 * DB'deki string'ler Türkçedir; locale='en' ise EN'e çevirir, 'tr' ise olduğu gibi bırakır.
 * Ters yönde de çalışır: zaten EN olan bir string 'tr' locale'inde TR'ye döner.
 *
 * @param genre  - DB'den gelen ham genre string (genellikle TR)
 * @param locale - Aktif uygulama dili ('en' | 'tr')
 * @returns Locale'e uygun genre adı
 */
export function localizeGenre(genre: string, locale: string): string {
  if (locale === 'tr') {
    // TR → TR (no-op) veya EN → TR
    return TR_TO_EN_GENRE[genre]
      ? genre                       // zaten TR
      : EN_TO_TR_GENRE[genre] ?? genre; // EN ise geri çevir
  }
  // EN: TR → EN
  return TR_TO_EN_GENRE[genre] ?? genre;
}

/**
 * Bir genre dizisini aktif uygulama diline göre toplu lokalize eder.
 *
 * @param genres - DB'den gelen ham genre dizisi
 * @param locale - Aktif uygulama dili ('en' | 'tr')
 * @returns Locale'e uygun genre dizisi
 */
export function localizeGenres(genres: string[], locale: string): string[] {
  return genres.map((g) => localizeGenre(g, locale));
}

/** Yıl aralığı filtresini era_preference'a dönüştürür */
export function yearRangeToEra(range: YearRangeFilter): EraPreference {
  switch (range) {
    case 'pre1990': return { from: 1900, to: 1989 };
    case '1990s':   return { from: 1990, to: 1999 };
    case '2000s':   return { from: 2000, to: 2009 };
    case '2010s':   return { from: 2010, to: 2019 };
    case '2020s':   return { from: 2020, to: 2030 };
    default:        return { from: 1900, to: 2030 };
  }
}

/**
 * Bölge etiketlerini TMDb ISO 3166-1 alpha-2 ülke kodlarına eşler.
 * films.country sütununda bu kodlar saklanır; SQL && operatörüyle filtrelenir.
 */
export function regionsToCulturalContext(regions: string[]): string[] {
  const MAP: Record<string, string[]> = {
    hollywood:    ['US'],
    british:      ['GB'],
    french:       ['FR'],
    german:       ['DE'],
    eastAsia:     ['JP', 'CN', 'HK'],
    korean:       ['KR'],
    turkish:      ['TR'],
    scandinavian: ['SE', 'DK', 'NO', 'FI'],
  };
  return regions.flatMap((r) => MAP[r] ?? [r.toLocaleUpperCase('en-US')]);
}

/**
 * Minimum oy ortalaması eşiğini döndürür.
 * "top250" ≈ 8.5 olarak tahmin edilir.
 */
export function minRatingThreshold(rating: FilmFilters['minRating']): number | null {
  if (rating === null || rating === undefined) return null;
  if (rating === 'top250') return 8.5;
  return rating;
}
