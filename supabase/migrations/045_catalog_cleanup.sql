-- =====================================================================
-- Migration 045: Catalog Cleanup — Archive unreliable films, promote proven ones
--
-- Problem: Films with NULL imdb_rating or very low vote counts appear
-- in recommendations alongside well-known titles, hurting trust.
--
-- Solution: Reclassify curation_tier based on reliability signals:
--   A) imdb_rating IS NULL → archive
--   B) imdb_votes < 10000 → archive
--   C) imdb_rating >= 7.0 AND imdb_votes >= 50000 → core
--   D) imdb_votes >= 100000 AND imdb_rating >= 6.0 → core
--
-- Archive films are NOT deleted — they still exist in the DB but
-- receive a 0.85x penalty when tier_boost is active in match_films_v3.
--
-- SAFE: Does not downgrade existing core films (WHERE clauses prevent it).
-- =====================================================================

DO $$
DECLARE
  _archived_null_rating INT;
  _archived_low_votes  INT;
  _promoted_high_rated INT;
  _promoted_popular    INT;
BEGIN

  -- A) Archive films with no IMDb rating
  UPDATE films
  SET curation_tier = 'archive'
  WHERE imdb_rating IS NULL
    AND curation_tier IS DISTINCT FROM 'archive';
  GET DIAGNOSTICS _archived_null_rating = ROW_COUNT;
  RAISE NOTICE '045A: % films archived (imdb_rating IS NULL)', _archived_null_rating;

  -- B) Archive films with < 10k IMDb votes
  UPDATE films
  SET curation_tier = 'archive'
  WHERE imdb_votes < 10000
    AND curation_tier IS DISTINCT FROM 'archive';
  GET DIAGNOSTICS _archived_low_votes = ROW_COUNT;
  RAISE NOTICE '045B: % films archived (imdb_votes < 10000)', _archived_low_votes;

  -- C) Promote high-rated, well-known films to core
  UPDATE films
  SET curation_tier = 'core'
  WHERE imdb_rating >= 7.0
    AND imdb_votes >= 50000
    AND curation_tier IS DISTINCT FROM 'core';
  GET DIAGNOSTICS _promoted_high_rated = ROW_COUNT;
  RAISE NOTICE '045C: % films promoted to core (rating >= 7.0, votes >= 50k)', _promoted_high_rated;

  -- D) Promote very popular films to core (even if rating is 6.0-6.9)
  UPDATE films
  SET curation_tier = 'core'
  WHERE imdb_votes >= 100000
    AND imdb_rating >= 6.0
    AND curation_tier IS DISTINCT FROM 'core';
  GET DIAGNOSTICS _promoted_popular = ROW_COUNT;
  RAISE NOTICE '045D: % films promoted to core (votes >= 100k, rating >= 6.0)', _promoted_popular;

  RAISE NOTICE '045 DONE — archived: %, promoted: %',
    _archived_null_rating + _archived_low_votes,
    _promoted_high_rated + _promoted_popular;

END $$;
