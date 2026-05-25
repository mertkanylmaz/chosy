-- ============================================================
-- MoodFlix — IMDb Enrichment & Curation Tiers
-- 028_imdb_and_curation.sql
--
-- Adds IMDb metadata columns and curation tier system.
-- Existing columns (director, country, cast_json from 005) are untouched.
-- ============================================================

-- New metadata columns
ALTER TABLE films ADD COLUMN IF NOT EXISTS imdb_id TEXT UNIQUE;
ALTER TABLE films ADD COLUMN IF NOT EXISTS imdb_rating NUMERIC(3,1);
ALTER TABLE films ADD COLUMN IF NOT EXISTS imdb_votes INTEGER;
ALTER TABLE films ADD COLUMN IF NOT EXISTS metascore INTEGER;
ALTER TABLE films ADD COLUMN IF NOT EXISTS oscar_wins INTEGER DEFAULT 0;
ALTER TABLE films ADD COLUMN IF NOT EXISTS oscar_nominations INTEGER DEFAULT 0;
ALTER TABLE films ADD COLUMN IF NOT EXISTS content_rating TEXT;
ALTER TABLE films ADD COLUMN IF NOT EXISTS original_title TEXT;
ALTER TABLE films ADD COLUMN IF NOT EXISTS original_language TEXT;
ALTER TABLE films ADD COLUMN IF NOT EXISTS "cast" TEXT[];
ALTER TABLE films ADD COLUMN IF NOT EXISTS tmdb_keywords TEXT[];
ALTER TABLE films ADD COLUMN IF NOT EXISTS release_date TEXT;
ALTER TABLE films ADD COLUMN IF NOT EXISTS curation_tier TEXT
  CHECK (curation_tier IN ('core', 'extended', 'archive'))
  DEFAULT 'extended';

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_films_imdb_rating ON films(imdb_rating) WHERE imdb_rating IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_films_curation_tier ON films(curation_tier);
CREATE INDEX IF NOT EXISTS idx_films_director_text ON films(director) WHERE director IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_films_country ON films(country) WHERE country IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_films_original_language ON films(original_language);
CREATE INDEX IF NOT EXISTS idx_films_imdb_id ON films(imdb_id) WHERE imdb_id IS NOT NULL;
