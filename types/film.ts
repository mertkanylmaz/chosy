/**
 * Uygulamada kullanılan film veri yapısı.
 * Tüm film verisi bu tip üzerinden taşınır.
 */
export interface Film {
  id: string;
  title: string;
  year: number;
  /** TMDb tam poster URL'i */
  posterUrl: string;
  /** Kullanıcı talebiyle eşleşme skoru, 0-100 arası */
  matchScore: number;
  /** Kartın altında görünen duygu/tema etiketleri */
  moodTags: string[];
  /** "Neden bu film?" kısa açıklaması */
  whyThisFilm: string;
  /** TMDb backdrop görseli tam URL'i (detay sayfası için) */
  backdropUrl?: string;
  /** Film özeti */
  overview?: string;
  /** Dakika cinsinden süre */
  runtime?: number;
  /** TMDb oy ortalaması, 0-10 arası */
  voteAverage?: number;
  /** YouTube fragman URL'i (varsa) */
  trailerUrl?: string;
  /** Yönetmen adı */
  director?: string;
  /** Başrol oyuncuları listesi */
  cast?: Array<{ name: string; avatarUrl?: string }>;
  /** Sürpriz kart türü — her 5-7 filmde bir atanır */
  surpriseType?: 'hidden_gem' | 'ai_pick' | 'unexpected';
  /**
   * Veri tabanlı pick türü — recommendations.ts'te similarity/vote/genre'a
   * göre atanır. Gösterimde surpriseType'ın önüne geçer.
   */
  pick_type?: 'hidden_gem' | 'ai_pick' | 'unexpected' | null;
  /** film_profiles.dimensions_json — matchExplanation servisi için */
  dimensions?: Record<string, unknown>;
}
