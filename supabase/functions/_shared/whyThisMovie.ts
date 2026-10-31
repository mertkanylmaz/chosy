/**
 * WhyThisMovie — oyun sonrası film keşfi köprüsünün metni.
 *
 * Bugüne kadar yalnızca Detective bu alanı dolduruyordu; diğer oyunlarda
 * ortak WhyThisMovie kartı hiç render edilmiyordu (prop hiç gelmiyordu).
 *
 * Metin YALNIZCA films tablosundaki gerçek verilerden kurulur — uydurma
 * trivia üretilmez. Elde veri yoksa alan boş döner ve kart gizlenir.
 */

export interface WhyThisMovieText {
  why_text?: string
  fun_fact?: string
}

interface FilmForWhy {
  title: string
  year: number | null
  director: string | null
  genres: string[] | null
  runtime: number | null
  vote_average: number | null
  metadata_json?: Record<string, unknown> | null
}

/** TMDb en-US tür adı → TR. Bilinmeyen etiket (Drama, Western, zaten TR) olduğu gibi kalır. */
const GENRE_TR: Record<string, string> = {
  Action: 'Aksiyon',
  Adventure: 'Macera',
  Animation: 'Animasyon',
  Comedy: 'Komedi',
  Crime: 'Suç',
  Documentary: 'Belgesel',
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
}

/**
 * Çözüm filminden gerçek verilere dayalı bağlam metni üretir.
 *
 * @param film - Çözüm filmi (submit-guess'in zaten çektiği kolonlar)
 * @param locale - 'tr' ise Türkçe, aksi halde İngilizce
 */
export function buildWhyThisMovie(film: FilmForWhy, locale = 'en'): WhyThisMovieText {
  const tr = locale === 'tr'
  const parts: string[] = []

  if (film.director) {
    parts.push(tr ? `Yönetmen: ${film.director}` : `Directed by ${film.director}`)
  }
  if (film.year) {
    parts.push(String(film.year))
  }
  const genres = (film.genres ?? []).slice(0, 2)
  if (genres.length > 0) {
    parts.push((tr ? genres.map((g) => GENRE_TR[g] ?? g) : genres).join(', '))
  }
  if (film.runtime) {
    parts.push(tr ? `${film.runtime} dk` : `${film.runtime} min`)
  }

  const whyText = parts.length > 0 ? parts.join(' · ') : undefined

  // Tagline gerçek TMDB verisidir — yoksa oy ortalamasına düşülür,
  // o da yoksa alan hiç gönderilmez.
  const tagline = typeof film.metadata_json?.tagline === 'string'
    ? (film.metadata_json.tagline as string).trim()
    : ''

  let funFact: string | undefined
  if (tagline.length > 0) {
    funFact = `"${tagline}"`
  } else if (film.vote_average != null) {
    funFact = tr
      ? `TMDB izleyici puanı: ${film.vote_average.toFixed(1)}/10`
      : `TMDB audience score: ${film.vote_average.toFixed(1)}/10`
  }

  return {
    ...(whyText ? { why_text: whyText } : {}),
    ...(funFact ? { fun_fact: funFact } : {}),
  }
}
