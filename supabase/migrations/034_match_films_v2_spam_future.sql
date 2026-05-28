-- =====================================================================
-- Migration 034: match_films_v2 — Spam Penalty + Future Film Filter
--
-- Sprint 1 v5.0 TASK 1.D-LITE
--
-- Additions over 031:
--   1. Future filter: year > EXTRACT(YEAR FROM CURRENT_DATE) excluded (hard)
--   2. Spam penalty: imdb_votes NULL + imdb_rating NULL + year>=2024
--      + tier!='core' → trust_factor 0.5 (soft demotion, NOT removal)
--
-- PRESERVES: per-director cap, tier boost, NULL vector exclusion,
--            sort_key randomness, all original parameters
-- match_films v1 is UNTOUCHED
-- =====================================================================

CREATE OR REPLACE FUNCTION public.match_films_v2(
  query_vector     vector(384),
  match_count      integer          DEFAULT 20,
  year_from        integer          DEFAULT NULL,
  year_to          integer          DEFAULT NULL,
  min_rating       double precision DEFAULT NULL,
  countries        text[]           DEFAULT NULL,
  directors        text[]           DEFAULT NULL,
  exclude_ids      uuid[]           DEFAULT NULL,
  min_similarity   double precision DEFAULT NULL,
  per_director_cap integer          DEFAULT 3,
  tier_boost       boolean          DEFAULT false
)
RETURNS TABLE (
  id              uuid,
  tmdb_id         integer,
  title           text,
  year            integer,
  poster_url      text,
  backdrop_url    text,
  overview        text,
  genres          text[],
  runtime         integer,
  vote_average    double precision,
  director        text,
  country         text[],
  similarity      double precision,
  dimensions_json jsonb,
  curation_tier   text
)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH candidates AS (
    SELECT
      fp.film_id,
      fp.profile_vector,
      fp.dimensions_json,
      f.curation_tier AS tier,
      -- Pull columns needed for spam penalty
      f.imdb_votes,
      f.imdb_rating,
      f.year AS film_year
    FROM film_profiles fp
    JOIN films f ON f.id = fp.film_id
    WHERE
      fp.profile_vector IS NOT NULL          -- NULL vector exclusion
      -- FUTURE FILTER (hard): exclude films with year > current year
      AND (f.year IS NULL OR f.year <= EXTRACT(YEAR FROM CURRENT_DATE)::int)
      AND (year_from   IS NULL OR f.year          >= year_from)
      AND (year_to     IS NULL OR f.year          <= year_to)
      AND (min_rating  IS NULL OR f.vote_average  >= min_rating)
      AND (
        countries IS NULL
        OR cardinality(countries) = 0
        OR f.country && countries
      )
      AND (
        directors IS NULL
        OR cardinality(directors) = 0
        OR f.director = ANY(directors)
      )
      AND (
        exclude_ids IS NULL
        OR cardinality(exclude_ids) = 0
        OR f.id != ALL(exclude_ids)
      )
  ),
  scored AS (
    SELECT
      c.film_id,
      c.profile_vector,
      c.dimensions_json,
      c.tier,
      -- Base similarity (1 - cosine_distance)
      (1 - (c.profile_vector <=> query_vector)) AS raw_similarity,
      -- SPAM PENALTY: new + no IMDb signals + not core → demote
      CASE
        WHEN c.imdb_votes IS NULL
             AND c.imdb_rating IS NULL
             AND c.film_year >= 2024
             AND c.tier != 'core'
        THEN 0.5   -- spam suspect: halve similarity
        ELSE 1.0
      END AS trust_factor,
      -- Tier boost multiplier (only when tier_boost = true)
      CASE
        WHEN tier_boost AND c.tier = 'core'     THEN 1.15
        WHEN tier_boost AND c.tier = 'extended' THEN 1.00
        WHEN tier_boost AND c.tier = 'archive'  THEN 0.85
        ELSE 1.0
      END AS tier_multiplier,
      -- Sort key with v1 randomness (PROTECTED)
      (c.profile_vector <=> query_vector) + (random() * 0.12) AS sort_key
    FROM candidates c
  ),
  boosted AS (
    SELECT
      s.*,
      s.raw_similarity * s.tier_multiplier * s.trust_factor AS boosted_similarity,
      -- Adjust sort_key with tier boost AND trust factor (lower = better)
      s.sort_key / (s.tier_multiplier * s.trust_factor) AS adjusted_sort_key
    FROM scored s
    WHERE (min_similarity IS NULL OR s.raw_similarity >= min_similarity)
  ),
  oversampled AS (
    -- Oversample for per-director cap (need enough films per director to fill quota)
    SELECT
      b.*,
      f.director AS film_director,
      f.title AS film_title
    FROM boosted b
    JOIN films f ON f.id = b.film_id
    ORDER BY b.adjusted_sort_key
    LIMIT match_count * GREATEST(per_director_cap, 1) * 3
  ),
  ranked AS (
    SELECT
      o.*,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(o.film_director, 'unknown_' || o.film_id::text)
        ORDER BY o.adjusted_sort_key
      ) AS director_rank
    FROM oversampled o
  ),
  capped AS (
    SELECT *
    FROM ranked
    WHERE director_rank <= per_director_cap
       OR per_director_cap <= 0  -- 0 = cap disabled
  )
  SELECT
    f.id,
    f.tmdb_id,
    f.title,
    f.year,
    f.poster_url,
    f.backdrop_url,
    f.overview,
    f.genres,
    f.runtime,
    f.vote_average,
    f.director,
    f.country,
    c.boosted_similarity AS similarity,
    c.dimensions_json,
    c.tier AS curation_tier
  FROM capped c
  JOIN films f ON f.id = c.film_id
  ORDER BY c.adjusted_sort_key
  LIMIT match_count;
$$;

-- Grant permissions (matches v1 pattern)
GRANT EXECUTE ON FUNCTION public.match_films_v2(
  vector(384), integer, integer, integer, double precision,
  text[], text[], uuid[], double precision, integer, boolean
) TO anon;

GRANT EXECUTE ON FUNCTION public.match_films_v2(
  vector(384), integer, integer, integer, double precision,
  text[], text[], uuid[], double precision, integer, boolean
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.match_films_v2(
  vector(384), integer, integer, integer, double precision,
  text[], text[], uuid[], double precision, integer, boolean
) TO service_role;

COMMENT ON FUNCTION public.match_films_v2 IS
  'Sprint 1 v5.0 enhanced match_films_v2. Adds future film filter (hard) '
  'and spam penalty (soft 0.5x for no-IMDb + year>=2024 + non-core). '
  'Preserves per-director cap, tier boost, NULL vector exclusion from 031.';
