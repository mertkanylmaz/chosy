-- =====================================================================
-- Migration 046: Era Balance — reduce pre-2000 core dominance
--
-- Problem: pre-1990 has 467 core films vs ~150-270 in other eras,
-- causing old films to dominate recommendations when user doesn't
-- specifically request classics.
--
-- Solution: Demote low-popularity older films from core → extended.
-- Iconic films (200k+ votes pre-1990, 100k+ votes 1990s) stay core.
--
-- Expected result:
--   pre-1990: 467 core → ~101 core (366 → extended)
--   1990-1999: 139 core → ~99 core (40 → extended)
--   2000+ eras: UNTOUCHED
--
-- SAFE: Only core → extended (never archive). Films not deleted.
-- =====================================================================

DO $$
DECLARE
  _demoted_pre1990 INT;
  _demoted_1990s   INT;
BEGIN

  -- A) pre-1990: demote core films with < 200k votes
  UPDATE films
  SET curation_tier = 'extended'
  WHERE year < 1990
    AND curation_tier = 'core'
    AND (imdb_votes < 200000 OR imdb_votes IS NULL);
  GET DIAGNOSTICS _demoted_pre1990 = ROW_COUNT;
  RAISE NOTICE '046A: % pre-1990 films demoted core → extended (votes < 200k)', _demoted_pre1990;

  -- B) 1990-1999: demote core films with < 100k votes
  UPDATE films
  SET curation_tier = 'extended'
  WHERE year BETWEEN 1990 AND 1999
    AND curation_tier = 'core'
    AND (imdb_votes < 100000 OR imdb_votes IS NULL);
  GET DIAGNOSTICS _demoted_1990s = ROW_COUNT;
  RAISE NOTICE '046B: % 1990s films demoted core → extended (votes < 100k)', _demoted_1990s;

  RAISE NOTICE '046 DONE — total demoted: %', _demoted_pre1990 + _demoted_1990s;

END $$;
