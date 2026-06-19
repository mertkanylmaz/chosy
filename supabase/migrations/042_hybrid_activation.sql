-- =====================================================================
-- Migration 042: v3 Hybrid Activation + match_reason + director cap
--
-- 1. Seed use_hybrid_recommendation = true in app_config
-- 2. Add match_reason to match_films_v3 RETURNS (tmdb_keywords based)
-- 3. Reduce default per_director_cap from 3 to 2
-- =====================================================================

-- ── 1. Seed use_hybrid_recommendation flag ──────────────────────────────────

INSERT INTO app_config (key, value, description) VALUES
  ('use_hybrid_recommendation', 'true'::jsonb, 'v3 hybrid mood + user vector recommendation. false=v2 rollback')
ON CONFLICT (key) DO NOTHING;

-- ── 2+3. Recreate match_films_v3 with match_reason + default per_director_cap = 2 ──
-- DROP first: return type changed (match_reason TEXT added) — OR REPLACE cannot do that.

DROP FUNCTION IF EXISTS public.match_films_v3(
  vector(384), vector(384), double precision, double precision,
  integer, integer, integer, double precision, text[], text[],
  uuid[], double precision, integer, boolean
);

CREATE FUNCTION public.match_films_v3(
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
  per_director_cap integer          DEFAULT 2,
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
  mood_similarity double precision,
  user_similarity double precision,
  match_reason    text
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
      f.year AS film_year,
      f.tmdb_keywords
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
      c.tmdb_keywords,
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
      (1 - b.blended_sim) + (random() * 0.12) AS sort_key,
      (1 - b.blended_sim) / (b.tier_multiplier * b.trust_factor) AS adjusted_sort_key
    FROM blended b
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
    c.user_sim AS user_similarity,
    -- match_reason: first 3 tmdb_keywords joined, NULL if empty
    CASE
      WHEN c.tmdb_keywords IS NOT NULL AND cardinality(c.tmdb_keywords) > 0
      THEN array_to_string(c.tmdb_keywords[1:3], ', ')
      ELSE NULL
    END AS match_reason
  FROM capped c
  JOIN films f ON f.id = c.film_id
  ORDER BY c.adjusted_sort_key
  LIMIT match_count;
$$;

-- Grants (re-applied after DROP + CREATE)
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
  'v3 hybrid recommendation with match_reason (tmdb_keywords) and per_director_cap=2 default. '
  'Backward compatible: user_vector=NULL + mood_weight=1.0 -> v2 behavior.';
