-- ============================================================
-- MoodFlix — Film Search Improvements
-- 029_search_improvements.sql
--
-- Multi-layer search: title, original_title, tr_title, director, cast
-- Full-text search with tsvector + GIN index + ILIKE fallback
-- ============================================================

-- Turkish title column (backward compatibility for old TR titles)
ALTER TABLE films ADD COLUMN IF NOT EXISTS tr_title TEXT;

-- Full-text search vector column
ALTER TABLE films ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- ── Trigger: auto-update search_vector on INSERT/UPDATE ──────────────────────

CREATE OR REPLACE FUNCTION update_film_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.original_title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.tr_title, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.director, '')), 'C') ||
    setweight(to_tsvector('simple', array_to_string(COALESCE(NEW."cast", ARRAY[]::TEXT[]), ' ')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop if exists to allow re-run
DROP TRIGGER IF EXISTS films_search_vector_update ON films;

CREATE TRIGGER films_search_vector_update
  BEFORE INSERT OR UPDATE ON films
  FOR EACH ROW EXECUTE FUNCTION update_film_search_vector();

-- ── GIN index for fast full-text search ──────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_films_search_vector ON films USING GIN(search_vector);

-- ── Trigram index for ILIKE fallback (fuzzy partial matching) ────────────────

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_films_title_trgm ON films USING GIN(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_films_original_title_trgm ON films USING GIN(original_title gin_trgm_ops) WHERE original_title IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_films_tr_title_trgm ON films USING GIN(tr_title gin_trgm_ops) WHERE tr_title IS NOT NULL;

-- ── Backfill: save Turkish titles before English migration ───────────────────
-- Films with Turkish characters in title get their title saved to tr_title
UPDATE films
SET tr_title = title
WHERE tr_title IS NULL
  AND title ~ '[şğüöçıİŞĞÜÖÇ]';

-- ── Backfill: trigger search_vector for all existing films ───────────────────
-- A no-op UPDATE that fires the trigger
UPDATE films SET title = title;

-- ── RPC: search_films ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION search_films(
  search_query TEXT,
  result_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  tmdb_id INTEGER,
  title TEXT,
  original_title TEXT,
  tr_title TEXT,
  year INTEGER,
  poster_url TEXT,
  director TEXT,
  imdb_rating NUMERIC(3,1),
  relevance_rank FLOAT
) AS $$
DECLARE
  clean_query TEXT;
BEGIN
  clean_query := trim(search_query);
  IF length(clean_query) < 1 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    f.id,
    f.tmdb_id,
    f.title,
    f.original_title,
    f.tr_title,
    f.year,
    f.poster_url,
    f.director,
    f.imdb_rating,
    COALESCE(ts_rank(f.search_vector, websearch_to_tsquery('simple', clean_query)), 0)::FLOAT AS relevance_rank
  FROM films f
  WHERE
    -- Full-text search
    f.search_vector @@ websearch_to_tsquery('simple', clean_query)
    -- ILIKE fallback for partial/fuzzy matching
    OR f.title ILIKE '%' || clean_query || '%'
    OR f.original_title ILIKE '%' || clean_query || '%'
    OR f.tr_title ILIKE '%' || clean_query || '%'
    OR f.director ILIKE '%' || clean_query || '%'
  ORDER BY
    -- Exact match first
    CASE
      WHEN LOWER(f.title) = LOWER(clean_query) THEN 0
      WHEN LOWER(f.original_title) = LOWER(clean_query) THEN 0
      WHEN LOWER(f.tr_title) = LOWER(clean_query) THEN 1
      ELSE 2
    END,
    -- Then full-text relevance
    ts_rank(f.search_vector, websearch_to_tsquery('simple', clean_query)) DESC,
    -- Then IMDb rating as tiebreaker
    f.imdb_rating DESC NULLS LAST
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant access to authenticated users (RLS on films already allows SELECT)
GRANT EXECUTE ON FUNCTION search_films(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION search_films(TEXT, INT) TO anon;
