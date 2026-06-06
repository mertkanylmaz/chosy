-- =====================================================================
-- Migration 038: match_films_v3 — Hybrid Mood + User Vector Recommendation
--
-- Sprint 2 TASK 2.4
--
-- Additions over v2:
--   1. user_vector parameter (NULL-safe — backward compatible)
--   2. mood_weight + user_weight blending (default 0.7 / 0.3)
--   3. Blended similarity replaces raw_similarity in trust/tier pipeline
--
-- PRESERVES from v2:
--   - Spam penalty (trust_factor 0.5)
--   - Future film filter (hard exclude)
--   - Per-director cap
--   - Tier boost multiplier
--   - NULL vector exclusion
--   - sort_key randomness
--   - All original parameters
--
-- BACKWARD COMPATIBILITY:
--   user_vector NULL + mood_weight 1.0 + user_weight 0.0
--   → identical to v2 behavior (mood-only).
--
-- NOTE: caller's responsibility to ensure mood_weight + user_weight = 1.0
-- =====================================================================

CREATE OR REPLACE FUNCTION public.match_films_v3(
  query_vector     vector(384),
  user_vector      vector(384)      DEFAULT NULL,
  mood_weight      double precision DEFAULT 0.7,
  user_weight      double precision DEFAULT 0.3,
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
  curation_tier   text,
  -- v3 only: debug fields, mood ve user katkılarını ayrı görmek için
  mood_similarity double precision,
  user_similarity double precision
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
      f.imdb_votes,
      f.imdb_rating,
      f.year AS film_year
    FROM film_profiles fp
    JOIN films f ON f.id = fp.film_id
    WHERE
      fp.profile_vector IS NOT NULL
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
      -- Mood similarity (always computed)
      (1 - (c.profile_vector <=> query_vector)) AS mood_sim,
      -- User similarity (NULL-safe: 0 if no user vector)
      CASE
        WHEN user_vector IS NULL THEN 0.0
        ELSE (1 - (c.profile_vector <=> user_vector))
      END AS user_sim,
      -- Spam penalty (unchanged from v2)
      CASE
        WHEN c.imdb_votes IS NULL
             AND c.imdb_rating IS NULL
             AND c.film_year >= 2024
             AND c.tier != 'core'
        THEN 0.5
        ELSE 1.0
      END AS trust_factor,
      -- Tier boost (unchanged from v2)
      CASE
        WHEN tier_boost AND c.tier = 'core'     THEN 1.15
        WHEN tier_boost AND c.tier = 'extended' THEN 1.00
        WHEN tier_boost AND c.tier = 'archive'  THEN 0.85
        ELSE 1.0
      END AS tier_multiplier
    FROM candidates c
  ),
  blended AS (
    -- v3 core: weighted blend of mood + user similarities
    SELECT
      s.*,
      (mood_weight * s.mood_sim) + (user_weight * s.user_sim) AS blended_sim
    FROM scored s
  ),
  boosted AS (
    SELECT
      b.*,
      b.blended_sim * b.tier_multiplier * b.trust_factor AS boosted_similarity,
      -- sort_key uses blended similarity (so randomness respects both vectors)
      (1 - b.blended_sim) + (random() * 0.12) AS sort_key,
      (1 - b.blended_sim) / (b.tier_multiplier * b.trust_factor) AS adjusted_sort_key
    FROM blended b
    -- min_similarity applies to BLENDED similarity (final user-facing relevance)
    WHERE (min_similarity IS NULL OR b.blended_sim >= min_similarity)
  ),
  oversampled AS (
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
       OR per_director_cap <= 0
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
    c.tier AS curation_tier,
    c.mood_sim AS mood_similarity,
    c.user_sim AS user_similarity
  FROM capped c
  JOIN films f ON f.id = c.film_id
  ORDER BY c.adjusted_sort_key
  LIMIT match_count;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.match_films_v3(
  vector(384), vector(384), double precision, double precision, integer,
  integer, integer, double precision, text[], text[], uuid[],
  double precision, integer, boolean
) TO anon;

GRANT EXECUTE ON FUNCTION public.match_films_v3(
  vector(384), vector(384), double precision, double precision, integer,
  integer, integer, double precision, text[], text[], uuid[],
  double precision, integer, boolean
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.match_films_v3(
  vector(384), vector(384), double precision, double precision, integer,
  integer, integer, double precision, text[], text[], uuid[],
  double precision, integer, boolean
) TO service_role;

COMMENT ON FUNCTION public.match_films_v3 IS
  'Sprint 2 TASK 2.4: hybrid mood + user vector recommendation. '
  'Backward compatible: user_vector=NULL + mood_weight=1.0 → v2 behavior. '
  'Returns extra fields mood_similarity and user_similarity for debug/analytics. '
  'Caller responsibility: ensure mood_weight + user_weight = 1.0.';
