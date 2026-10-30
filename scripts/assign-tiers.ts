/**
 * Curation Tier Assignment Logic
 *
 * Determines quality tier for each film:
 *   - core: Top ~15-20% — auteur directors, high IMDb, Oscar winners, Criterion-adjacent
 *   - archive: Low engagement or niche — few votes or low rating (tier-dependent thresholds)
 *   - extended: Everything else (solid middle ground)
 *
 * Usage: import { determineCurationTier } from './assign-tiers'
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FilmForTier {
  director: string | null;
  imdb_rating: number | null;
  imdb_votes: number | null;
  metascore: number | null;
  oscar_wins: number;
  oscar_nominations: number;
  keywords: string[];
  /**
   * Filmin şu anki tier'ı (opsiyonel). Yalnız arşiv eşiğini seçmek için okunur:
   * `'trending'` ise TRENDING eşikleri, diğer her durumda (yok dahil) core/extended
   * eşikleri uygulanır. Fonksiyon hiçbir zaman `'trending'` DÖNDÜRMEZ.
   */
  current_tier?: string | null;
}

export type CurationTier = 'core' | 'extended' | 'archive';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Auteur directors — widely recognized masters of cinema.
 * A film by these directors with IMDb >= 7.0 auto-qualifies as core.
 */
const AUTEUR_DIRECTORS: ReadonlySet<string> = new Set([
  // Classic masters
  'Alfred Hitchcock',
  'Stanley Kubrick',
  'Akira Kurosawa',
  'Ingmar Bergman',
  'Federico Fellini',
  'Andrei Tarkovsky',
  'Billy Wilder',
  'Orson Welles',
  'Fritz Lang',
  'Luis Bunuel',
  'Jean Renoir',
  'Yasujiro Ozu',
  'Robert Bresson',
  'Satyajit Ray',
  'Carl Theodor Dreyer',
  'F.W. Murnau',

  // New Hollywood & Modern masters
  'Martin Scorsese',
  'Francis Ford Coppola',
  'Steven Spielberg',
  'David Lynch',
  'Ridley Scott',
  'Terry Gilliam',
  'Michael Mann',

  // Contemporary auteurs
  'Christopher Nolan',
  'David Fincher',
  'Quentin Tarantino',
  'Denis Villeneuve',
  'Wes Anderson',
  'Paul Thomas Anderson',
  'Coen Brothers',
  'Joel Coen',
  'Ethan Coen',
  'Spike Lee',
  'Terrence Malick',
  'Alfonso Cuaron',
  'Guillermo del Toro',
  'Alejandro Gonzalez Inarritu',

  // Asian cinema
  'Wong Kar-Wai',
  'Park Chan-wook',
  'Bong Joon-ho',
  'Hayao Miyazaki',
  'Isao Takahata',
  'Hirokazu Kore-eda',
  'Edward Yang',
  'Hou Hsiao-hsien',
  'Satoshi Kon',

  // European contemporary
  'Pedro Almodovar',
  'Lars von Trier',
  'Michael Haneke',
  'Roman Polanski',
  'Jean-Luc Godard',
  'Francois Truffaut',
  'Krzysztof Kieslowski',
  'Andrzej Wajda',
  'Theo Angelopoulos',
  'Nuri Bilge Ceylan',
  'Yorgos Lanthimos',
  'Paolo Sorrentino',

  // Other
  'Abbas Kiarostami',
  'Asghar Farhadi',
  'Celine Sciamma',
  'Greta Gerwig',
  'Jordan Peele',
  'Barry Jenkins',
  'Sean Baker',
  'Robert Eggers',
  'Ari Aster',
]);

/**
 * Keywords that indicate Criterion Collection / arthouse quality.
 * Matched case-insensitively against film keywords.
 */
const CRITERION_KEYWORDS: ReadonlySet<string> = new Set([
  'criterion collection',
  'arthouse',
  'art house',
  'art house film',
  'film noir',
  'neo-noir',
  'french new wave',
  'japanese new wave',
  'czech new wave',
  'new wave',
  'masterpiece',
  'nordic noir',
]);

/**
 * Arşive düşme eşikleri — kural B (30 Eki 2026, CTO + kurucu onayı).
 * Arşiv eşiklerinin TEK kaynağı burasıdır; başka yerde sabit tutulmaz.
 * Bir film `rating < minRating` VEYA `votes < minVotes` ise arşive düşer.
 *
 *   trending        : rating < 5.5  veya votes < 300
 *   core + extended : rating < 5.8  veya votes < 5000
 *
 * Eski kural (tüm tier'larda votes < 5000 veya rating < 6.5) kaldırıldı.
 * `imdb_votes` NULL olan canlı filmler (yayınlanmamış) bu kuralla ellenmez;
 * fonksiyonun NULL → 0 davranışı (aşağıda) değiştirilmedi.
 */
interface ArchiveThresholds {
  readonly minRating: number;
  readonly minVotes: number;
}

const ARCHIVE_THRESHOLDS_TRENDING: ArchiveThresholds = { minRating: 5.5, minVotes: 300 };
const ARCHIVE_THRESHOLDS_STANDARD: ArchiveThresholds = { minRating: 5.8, minVotes: 5000 };

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Determines the curation tier for a single film.
 *
 * CORE criteria (any one is enough):
 *   1. Auteur director + IMDb >= 7.0
 *   2. IMDb >= 8.0
 *   3. Oscar wins >= 2
 *   4. Metascore >= 85 + IMDb votes >= 50,000
 *   5. Has a Criterion/arthouse keyword
 *
 * ARCHIVE criteria (rule B, tier-dependent — see ARCHIVE_THRESHOLDS_*):
 *   trending:        IMDb rating < 5.5 or votes < 300
 *   core / extended: IMDb rating < 5.8 or votes < 5,000
 *
 * Everything else: EXTENDED
 */
export function determineCurationTier(film: FilmForTier): CurationTier {
  const rating = film.imdb_rating ?? 0;
  const votes = film.imdb_votes ?? 0;
  const meta = film.metascore ?? 0;
  const oscars = film.oscar_wins ?? 0;

  // --- CORE checks ---
  if (film.director && AUTEUR_DIRECTORS.has(film.director) && rating >= 7.0) {
    return 'core';
  }

  if (rating >= 8.0) {
    return 'core';
  }

  if (oscars >= 2) {
    return 'core';
  }

  if (meta >= 85 && votes >= 50000) {
    return 'core';
  }

  const lowerKeywords = film.keywords.map((k) => k.toLowerCase());
  if (lowerKeywords.some((k) => CRITERION_KEYWORDS.has(k))) {
    return 'core';
  }

  // --- ARCHIVE checks ---
  const limits =
    film.current_tier === 'trending' ? ARCHIVE_THRESHOLDS_TRENDING : ARCHIVE_THRESHOLDS_STANDARD;

  if (votes < limits.minVotes) {
    return 'archive';
  }

  if (rating < limits.minRating) {
    return 'archive';
  }

  // --- Default ---
  return 'extended';
}

/**
 * Returns tier distribution stats for a set of films.
 */
export function getTierStats(
  films: FilmForTier[],
): Record<CurationTier, number> {
  const stats: Record<CurationTier, number> = {
    core: 0,
    extended: 0,
    archive: 0,
  };

  for (const film of films) {
    stats[determineCurationTier(film)]++;
  }

  return stats;
}
