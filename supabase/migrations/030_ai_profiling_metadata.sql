-- ============================================================
-- 030 — AI Profiling Metadata
-- Adds tracking columns for AI-based film profiling
-- ============================================================

ALTER TABLE film_profiles
  ADD COLUMN IF NOT EXISTS profiling_method TEXT DEFAULT 'rule_based',
  ADD COLUMN IF NOT EXISTS profiled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS profiling_reasoning TEXT;

CREATE INDEX IF NOT EXISTS idx_film_profiles_method
  ON film_profiles(profiling_method);

COMMENT ON COLUMN film_profiles.profiling_method IS 'rule_based | ai_haiku_v1';
COMMENT ON COLUMN film_profiles.profiled_at IS 'Timestamp of last profiling run';
COMMENT ON COLUMN film_profiles.profiling_reasoning IS 'AI reasoning for the profile assignment';
