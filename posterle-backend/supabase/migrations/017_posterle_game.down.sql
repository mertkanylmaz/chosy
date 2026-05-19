-- ============================================================================
-- Rollback for Migration 017: Posterle (Daily Poster Puzzle Game)
-- ============================================================================
-- WARNING: This DROPS all puzzle data. Backup puzzle_attempts and
--          puzzle_streaks before running in production.
-- ============================================================================

BEGIN;

DROP VIEW IF EXISTS v_puzzle_daily_stats;

DROP FUNCTION IF EXISTS apply_streak_freeze(UUID);
DROP FUNCTION IF EXISTS update_user_streak(UUID, BOOLEAN, DATE, TEXT);
DROP FUNCTION IF EXISTS record_hint_reveal(BIGINT, SMALLINT, TEXT, TEXT);
DROP FUNCTION IF EXISTS get_puzzle_candidates(FLOAT, FLOAT, INT, DATE, INT);

DROP TRIGGER IF EXISTS trg_streaks_updated_at ON puzzle_streaks;
DROP FUNCTION IF EXISTS update_streaks_updated_at();

DROP TABLE IF EXISTS puzzle_hint_reveals;
DROP TABLE IF EXISTS puzzle_streaks;
DROP TABLE IF EXISTS puzzle_attempts;
DROP TABLE IF EXISTS daily_puzzles;

COMMIT;
