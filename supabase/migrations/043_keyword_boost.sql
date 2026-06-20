-- =====================================================================
-- Migration 043: match_films_v3 — Thematic Keyword Overlap Boost
--
-- Problem: "thailand trip", "heist movie" gibi tematik/kavramsal mood
-- girdilerinde, sadece duygu vektoru eslesmesi yapiliyor. Temayla ilgili
-- filmler (tmdb_keywords'te "travel", "heist" vb.) onceliklendirilmiyor.
--
-- Cozum: Yeni search_keywords parametresi — LLM'den cikarilan tematik
-- keyword'ler, filmlerin tmdb_keywords'u ile karsilastirilir.
-- Eslesme sayisina gore olcekli bonus eklenir (maks +0.20).
--
-- BACKWARD COMPATIBLE: search_keywords NULL veya bos array ise
-- keyword_boost = 0, mevcut davranis korunur.
--
-- IMZA DEGISIYOR (yeni parametre) → DROP + CREATE gerekli.
-- =====================================================================

-- DROP old signature (14 params)
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
  tier_boost       boolean          DEFAULT false,
  search_keywords  text[]           DEFAULT NULL
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
      END AS tier_multiplier,
      -- Keyword overlap boost (NEW: migration 043)
      -- Count: how many search_keywords partially match any tmdb_keyword (bidirectional ILIKE)
      CASE
        WHEN search_keywords IS NULL OR cardinality(search_keywords) = 0
             OR c.tmdb_keywords IS NULL OR cardinality(c.tmdb_keywords) = 0
        THEN 0
        ELSE (
          SELECT COUNT(*)::int FROM unnest(search_keywords) sk
          WHERE EXISTS (
            SELECT 1 FROM unnest(c.tmdb_keywords) tk
            WHERE lower(tk) ILIKE '%' || lower(sk) || '%'
               OR lower(sk) ILIKE '%' || lower(tk) || '%'
          )
        )
      END AS keyword_match_count
    FROM candidates c
  ),
  blended AS (
    SELECT
      s.*,
      (mood_weight * s.mood_sim) + (user_weight * s.user_sim) AS blended_sim,
      -- Scaled keyword boost: +0.06 per match, capped at +0.20
      LEAST(s.keyword_match_count * 0.06, 0.20) AS keyword_boost
    FROM scored s
  ),
  boosted AS (
    SELECT
      b.*,
      -- Final score = blended_sim + keyword_boost (additive, not multiplicative)
      (b.blended_sim + b.keyword_boost) * b.tier_multiplier * b.trust_factor AS boosted_similarity,
      (1 - (b.blended_sim + b.keyword_boost)) + (random() * 0.12) AS sort_key,
      (1 - (b.blended_sim + b.keyword_boost)) / (b.tier_multiplier * b.trust_factor) AS adjusted_sort_key
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
    -- match_reason: keyword matches first, then fallback to tmdb_keywords
    CASE
      WHEN c.keyword_match_count > 0 THEN
        'Matches: ' || (
          SELECT string_agg(sk, ', ')
          FROM unnest(search_keywords) sk
          WHERE EXISTS (
            SELECT 1 FROM unnest(c.tmdb_keywords) tk
            WHERE lower(tk) ILIKE '%' || lower(sk) || '%'
               OR lower(sk) ILIKE '%' || lower(tk) || '%'
          )
        )
      WHEN c.tmdb_keywords IS NOT NULL AND cardinality(c.tmdb_keywords) > 0
      THEN array_to_string(c.tmdb_keywords[1:3], ', ')
      ELSE NULL
    END AS match_reason
  FROM capped c
  JOIN films f ON f.id = c.film_id
  ORDER BY c.adjusted_sort_key
  LIMIT match_count;
$$;

-- Grants (15 params now — search_keywords added)
GRANT EXECUTE ON FUNCTION public.match_films_v3(
  vector(384), vector(384), double precision, double precision, integer,
  integer, integer, double precision, text[], text[], uuid[],
  double precision, integer, boolean, text[]
) TO anon;

GRANT EXECUTE ON FUNCTION public.match_films_v3(
  vector(384), vector(384), double precision, double precision, integer,
  integer, integer, double precision, text[], text[], uuid[],
  double precision, integer, boolean, text[]
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.match_films_v3(
  vector(384), vector(384), double precision, double precision, integer,
  integer, integer, double precision, text[], text[], uuid[],
  double precision, integer, boolean, text[]
) TO service_role;

COMMENT ON FUNCTION public.match_films_v3 IS
  'v3 hybrid recommendation with keyword overlap boost (migration 043). '
  'search_keywords: LLM-extracted thematic keywords, matched against tmdb_keywords. '
  '+0.06 per match, capped at +0.20. NULL/empty = no boost (backward compatible).';
