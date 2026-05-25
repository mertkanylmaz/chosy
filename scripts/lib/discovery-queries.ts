/**
 * Discovery query configurations for TMDb /discover/movie endpoint.
 * Each query defines parameters and a target number of films to collect.
 */

export interface DiscoveryQuery {
  /** Human-readable label for logging */
  label: string;
  /** TMDb /discover/movie query parameters */
  params: Record<string, string>;
  /** Target number of films to collect from this query */
  target: number;
}

/**
 * All discovery queries.
 * Combined with auteur director filmographies, these produce the full
 * 3,000–4,000 unique film ID pool before enrichment.
 */
export const DISCOVERY_QUERIES: DiscoveryQuery[] = [
  // ── A) Top Rated — high vote_average with sufficient vote_count ──
  {
    label: 'Top Rated (vote_count >= 1000)',
    params: {
      sort_by: 'vote_average.desc',
      'vote_count.gte': '1000',
    },
    target: 500,
  },

  // ── B) Popular — most popular recent films ──
  {
    label: 'Popular',
    params: {
      sort_by: 'popularity.desc',
      'vote_count.gte': '300',
    },
    target: 300,
  },

  // ── D) Awards Winners — keyword-based ──
  // TMDb keyword IDs: oscar-winner (not keyword but using text search)
  // Using high-rated + specific genre combos as proxy for award films
  {
    label: 'Awards — Drama + High Rating',
    params: {
      sort_by: 'vote_average.desc',
      with_genres: '18', // Drama
      'vote_average.gte': '7.5',
      'vote_count.gte': '500',
    },
    target: 300,
  },

  // ── E) International Cinema ──
  {
    label: 'International — French',
    params: {
      with_original_language: 'fr',
      sort_by: 'vote_average.desc',
      'vote_count.gte': '200',
    },
    target: 100,
  },
  {
    label: 'International — German',
    params: {
      with_original_language: 'de',
      sort_by: 'vote_average.desc',
      'vote_count.gte': '200',
    },
    target: 60,
  },
  {
    label: 'International — Spanish',
    params: {
      with_original_language: 'es',
      sort_by: 'vote_average.desc',
      'vote_count.gte': '200',
    },
    target: 80,
  },
  {
    label: 'International — Italian',
    params: {
      with_original_language: 'it',
      sort_by: 'vote_average.desc',
      'vote_count.gte': '200',
    },
    target: 60,
  },
  {
    label: 'International — Japanese',
    params: {
      with_original_language: 'ja',
      sort_by: 'vote_average.desc',
      'vote_count.gte': '200',
    },
    target: 100,
  },
  {
    label: 'International — Korean',
    params: {
      with_original_language: 'ko',
      sort_by: 'vote_average.desc',
      'vote_count.gte': '200',
    },
    target: 80,
  },
  {
    label: 'International — Chinese',
    params: {
      with_original_language: 'zh',
      sort_by: 'vote_average.desc',
      'vote_count.gte': '200',
    },
    target: 60,
  },
  {
    label: 'International — Turkish',
    params: {
      with_original_language: 'tr',
      sort_by: 'vote_average.desc',
      'vote_count.gte': '100',
    },
    target: 60,
  },
  {
    label: 'International — Swedish',
    params: {
      with_original_language: 'sv',
      sort_by: 'vote_average.desc',
      'vote_count.gte': '100',
    },
    target: 40,
  },
  {
    label: 'International — Danish',
    params: {
      with_original_language: 'da',
      sort_by: 'vote_average.desc',
      'vote_count.gte': '100',
    },
    target: 40,
  },
  {
    label: 'International — Polish',
    params: {
      with_original_language: 'pl',
      sort_by: 'vote_average.desc',
      'vote_count.gte': '100',
    },
    target: 40,
  },

  // ── F) Decades — Classics ──
  {
    label: 'Classics — 1950s',
    params: {
      sort_by: 'vote_average.desc',
      'primary_release_date.gte': '1950-01-01',
      'primary_release_date.lte': '1959-12-31',
      'vote_count.gte': '200',
    },
    target: 80,
  },
  {
    label: 'Classics — 1960s',
    params: {
      sort_by: 'vote_average.desc',
      'primary_release_date.gte': '1960-01-01',
      'primary_release_date.lte': '1969-12-31',
      'vote_count.gte': '200',
    },
    target: 80,
  },
  {
    label: 'Classics — 1970s',
    params: {
      sort_by: 'vote_average.desc',
      'primary_release_date.gte': '1970-01-01',
      'primary_release_date.lte': '1979-12-31',
      'vote_count.gte': '200',
    },
    target: 80,
  },
];
