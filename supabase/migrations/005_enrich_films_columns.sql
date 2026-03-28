-- ============================================================
-- MoodFlix — Film Zenginleştirme Sütunları
-- 005_enrich_films_columns.sql
-- ============================================================

ALTER TABLE films
  ADD COLUMN IF NOT EXISTS director  TEXT,
  ADD COLUMN IF NOT EXISTS country   TEXT,
  ADD COLUMN IF NOT EXISTS cast_json JSONB;
