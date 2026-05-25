/**
 * Curation Tier Assignment Logic
 *
 * Determines quality tier for each film:
 *   - core: Top ~15-20% — auteur directors, high IMDb, Oscar winners, Criterion-adjacent
 *   - archive: Low engagement or niche — few votes or low rating
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
 * ARCHIVE criteria (any one):
 *   1. IMDb votes < 5,000
 *   2. IMDb rating < 6.5
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
  if (votes < 5000) {
    return 'archive';
  }

  if (rating < 6.5) {
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
