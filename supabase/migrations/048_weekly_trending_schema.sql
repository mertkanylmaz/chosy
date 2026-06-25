-- ============================================================
-- MoodFlix — Weekly Trending Sync Schema
-- 048_weekly_trending_schema.sql
--
-- Extends films table for weekly trending/upcoming sync:
--   1. Adds 'trending' to curation_tier CHECK constraint
--   2. Adds trending metadata columns (trending_added_at, trending_type)
--   3. Creates indexes for trending queries and tmdb_id lookups
--
-- Note: tmdb_id already exists (001_initial_schema.sql, INTEGER NOT NULL UNIQUE)
-- Note: curation_tier already exists (028_imdb_and_curation.sql)
-- ============================================================

-- ─── A) Update curation_tier CHECK constraint ─────────────────────────────────
-- Existing constraint: films_curation_tier_check
-- Old values: ('core', 'extended', 'archive')
-- New values: ('core', 'extended', 'archive', 'trending')

ALTER TABLE films DROP CONSTRAINT IF EXISTS films_curation_tier_check;
ALTER TABLE films ADD CONSTRAINT films_curation_tier_check
  CHECK (curation_tier IN ('core', 'extended', 'archive', 'trending'));

-- ─── B) Trending metadata columns ─────────────────────────────────────────────

-- When this film was added/refreshed by the trending sync
ALTER TABLE films ADD COLUMN IF NOT EXISTS trending_added_at TIMESTAMPTZ;

-- Source type: 'weekly_trending' or 'upcoming'
ALTER TABLE films ADD COLUMN IF NOT EXISTS trending_type TEXT
  CHECK (trending_type IN ('weekly_trending', 'upcoming'));

-- ─── C) Indexes ───────────────────────────────────────────────────────────────

-- Fast lookup: all currently trending films by type
CREATE INDEX IF NOT EXISTS idx_films_tier_trending
  ON films (curation_tier, trending_type) WHERE curation_tier = 'trending';

-- Note: tmdb_id already has a UNIQUE constraint (implicit unique index)
-- No additional index needed for tmdb_id lookups
