-- ============================================================================
-- Migration 018: Posterle (Daily Poster Puzzle Game)
-- ============================================================================
-- Adapted from posterle-backend spec:
-- - Table names: posterle_* (daily_puzzles already exists in 016)
-- - film_id: UUID (films.id is UUID, not BIGINT)
-- - RLS: subquery pattern matching existing codebase
-- - get_posterle_candidates: uses vote_average + metadata_json
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- TABLES
-- ----------------------------------------------------------------------------

-- Daily puzzle assignments (one row per calendar date, globally shared)
CREATE TABLE IF NOT EXISTS posterle_puzzles (
  id              BIGSERIAL PRIMARY KEY,
  puzzle_date     DATE UNIQUE NOT NULL,
  film_id         UUID NOT NULL REFERENCES films(id) ON DELETE RESTRICT,
  difficulty_tier TEXT NOT NULL CHECK (difficulty_tier IN ('easy', 'medium', 'hard')),
  curator_notes   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT posterle_puzzles_date_not_future CHECK (puzzle_date <= CURRENT_DATE + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS idx_posterle_puzzles_date_desc
  ON posterle_puzzles(puzzle_date DESC);

CREATE INDEX IF NOT EXISTS idx_posterle_puzzles_film_recent
  ON posterle_puzzles(film_id, puzzle_date DESC);

COMMENT ON TABLE posterle_puzzles IS
  'Global daily poster puzzle assignments. Curated by curate-posterle edge function at 23:00 UTC.';

-- Per-user puzzle attempts (one row per user per puzzle)
CREATE TABLE IF NOT EXISTS posterle_attempts (
  id                  BIGSERIAL PRIMARY KEY,
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  puzzle_id           BIGINT NOT NULL REFERENCES posterle_puzzles(id) ON DELETE CASCADE,
  attempts_used       SMALLINT NOT NULL DEFAULT 0 CHECK (attempts_used BETWEEN 0 AND 6),
  guesses             JSONB NOT NULL DEFAULT '[]'::jsonb,
  result              TEXT NOT NULL DEFAULT 'in_progress'
                        CHECK (result IN ('in_progress', 'won', 'lost')),
  won_on_attempt      SMALLINT CHECK (won_on_attempt IS NULL OR won_on_attempt BETWEEN 1 AND 6),
  archetype_at_time   TEXT,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  UNIQUE(user_id, puzzle_id),
  CONSTRAINT posterle_won_attempt_matches_result CHECK (
    (result = 'won' AND won_on_attempt IS NOT NULL) OR
    (result != 'won' AND won_on_attempt IS NULL)
  ),
  CONSTRAINT posterle_completed_at_matches_result CHECK (
    (result = 'in_progress' AND completed_at IS NULL) OR
    (result != 'in_progress' AND completed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_posterle_attempts_user_date
  ON posterle_attempts(user_id, completed_at DESC NULLS FIRST);

CREATE INDEX IF NOT EXISTS idx_posterle_attempts_puzzle_result
  ON posterle_attempts(puzzle_id, result)
  WHERE result != 'in_progress';

COMMENT ON TABLE posterle_attempts IS
  'User game state per posterle puzzle. JSONB guesses for flexible analytics.';

-- Aggregate streak/lifetime stats per user
CREATE TABLE IF NOT EXISTS posterle_streaks (
  user_id              UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak       INT NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  longest_streak       INT NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
  last_played_date     DATE,
  last_won_date        DATE,
  total_wins           INT NOT NULL DEFAULT 0 CHECK (total_wins >= 0),
  total_attempts       INT NOT NULL DEFAULT 0 CHECK (total_attempts >= 0),
  archetype_wins       JSONB NOT NULL DEFAULT '{}'::jsonb,
  freeze_tokens        SMALLINT NOT NULL DEFAULT 0
                         CHECK (freeze_tokens BETWEEN 0 AND 3),
  last_freeze_used_at  TIMESTAMPTZ,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT posterle_longest_gte_current CHECK (longest_streak >= current_streak)
);

CREATE INDEX IF NOT EXISTS idx_posterle_streaks_current_desc
  ON posterle_streaks(current_streak DESC)
  WHERE current_streak > 0;

COMMENT ON TABLE posterle_streaks IS
  'Denormalized posterle lifetime stats. Updated by submit-posterle edge function.';

-- Hint reveals (analytics)
CREATE TABLE IF NOT EXISTS posterle_hint_reveals (
  id              BIGSERIAL PRIMARY KEY,
  attempt_id      BIGINT NOT NULL REFERENCES posterle_attempts(id) ON DELETE CASCADE,
  attempt_number  SMALLINT NOT NULL CHECK (attempt_number BETWEEN 1 AND 6),
  hint_type       TEXT NOT NULL CHECK (hint_type IN (
                    'genre', 'decade', 'year', 'director', 'cast',
                    'mood', 'runtime', 'writer', 'rating'
                  )),
  hint_value      TEXT NOT NULL,
  revealed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(attempt_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_posterle_hints_attempt
  ON posterle_hint_reveals(attempt_id, attempt_number);

-- ----------------------------------------------------------------------------
-- TRIGGERS
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_posterle_streaks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_posterle_streaks_updated_at ON posterle_streaks;
CREATE TRIGGER trg_posterle_streaks_updated_at
  BEFORE UPDATE ON posterle_streaks
  FOR EACH ROW
  EXECUTE FUNCTION update_posterle_streaks_updated_at();

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------

ALTER TABLE posterle_puzzles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posterle_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE posterle_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE posterle_hint_reveals ENABLE ROW LEVEL SECURITY;

-- Puzzles: readable by authenticated (past + today only)
DROP POLICY IF EXISTS "posterle_puzzles_read" ON posterle_puzzles;
CREATE POLICY "posterle_puzzles_read" ON posterle_puzzles
  FOR SELECT
  TO authenticated
  USING (puzzle_date <= CURRENT_DATE);

-- Attempts: user sees/writes own only
DROP POLICY IF EXISTS "posterle_attempts_own" ON posterle_attempts;
CREATE POLICY "posterle_attempts_own" ON posterle_attempts
  FOR ALL
  TO authenticated
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  )
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  );

-- Streaks: user sees/writes own only
DROP POLICY IF EXISTS "posterle_streaks_own" ON posterle_streaks;
CREATE POLICY "posterle_streaks_own" ON posterle_streaks
  FOR ALL
  TO authenticated
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  )
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  );

-- Hint reveals: user reads own (via attempt ownership)
DROP POLICY IF EXISTS "posterle_hints_own" ON posterle_hint_reveals;
CREATE POLICY "posterle_hints_own" ON posterle_hint_reveals
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM posterle_attempts pa
      WHERE pa.id = attempt_id
        AND pa.user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
    )
  );

-- ----------------------------------------------------------------------------
-- HELPER RPCs
-- ----------------------------------------------------------------------------

-- Get puzzle candidates using vote_average for difficulty tiers
-- (films table has no popularity/vote_count columns; we use vote_average + metadata_json)
CREATE OR REPLACE FUNCTION get_posterle_candidates(
  p_vote_avg_min FLOAT DEFAULT 0,
  p_vote_avg_max FLOAT DEFAULT 10,
  p_exclude_after_date DATE DEFAULT NULL,
  p_limit INT DEFAULT 20
) RETURNS TABLE (
  id UUID,
  title TEXT,
  poster_url TEXT,
  vote_average FLOAT,
  year INT,
  director TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id,
    f.title,
    f.poster_url,
    f.vote_average,
    f.year,
    f.director
  FROM films f
  WHERE f.vote_average BETWEEN p_vote_avg_min AND p_vote_avg_max
    AND f.poster_url IS NOT NULL
    AND LENGTH(f.poster_url) > 5
    AND f.id NOT IN (
      SELECT pp.film_id
      FROM posterle_puzzles pp
      WHERE p_exclude_after_date IS NULL OR pp.puzzle_date > p_exclude_after_date
    )
  ORDER BY RANDOM()
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION get_posterle_candidates IS
  'Selects random posterle candidates excluding recently-used films. Service-role only.';

-- Record hint reveal (idempotent)
CREATE OR REPLACE FUNCTION record_posterle_hint(
  p_attempt_id BIGINT,
  p_attempt_number SMALLINT,
  p_hint_type TEXT,
  p_hint_value TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO posterle_hint_reveals (attempt_id, attempt_number, hint_type, hint_value)
  VALUES (p_attempt_id, p_attempt_number, p_hint_type, p_hint_value)
  ON CONFLICT (attempt_id, attempt_number) DO NOTHING;
END;
$$;

-- Atomic streak update
CREATE OR REPLACE FUNCTION update_posterle_streak(
  p_user_id UUID,
  p_won BOOLEAN,
  p_puzzle_date DATE,
  p_archetype TEXT
) RETURNS posterle_streaks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing posterle_streaks;
  v_continuing BOOLEAN;
  v_new_current INT;
  v_new_longest INT;
  v_archetype_wins JSONB;
  v_result posterle_streaks;
BEGIN
  SELECT * INTO v_existing
  FROM posterle_streaks
  WHERE user_id = p_user_id
  FOR UPDATE;

  v_continuing := (
    v_existing.last_played_date IS NOT NULL
    AND v_existing.last_played_date = p_puzzle_date - INTERVAL '1 day'
  );

  IF p_won THEN
    v_new_current := CASE
      WHEN v_existing IS NULL THEN 1
      WHEN v_continuing THEN v_existing.current_streak + 1
      ELSE 1
    END;
  ELSE
    v_new_current := 0;
  END IF;

  v_new_longest := GREATEST(
    COALESCE(v_existing.longest_streak, 0),
    v_new_current
  );

  v_archetype_wins := COALESCE(v_existing.archetype_wins, '{}'::jsonb);
  IF p_won AND p_archetype IS NOT NULL THEN
    v_archetype_wins := jsonb_set(
      v_archetype_wins,
      ARRAY[p_archetype],
      to_jsonb(COALESCE((v_archetype_wins->>p_archetype)::INT, 0) + 1),
      true
    );
  END IF;

  INSERT INTO posterle_streaks (
    user_id, current_streak, longest_streak,
    last_played_date, last_won_date,
    total_wins, total_attempts, archetype_wins
  ) VALUES (
    p_user_id, v_new_current, v_new_longest,
    p_puzzle_date,
    CASE WHEN p_won THEN p_puzzle_date ELSE v_existing.last_won_date END,
    COALESCE(v_existing.total_wins, 0) + (CASE WHEN p_won THEN 1 ELSE 0 END),
    COALESCE(v_existing.total_attempts, 0) + 1,
    v_archetype_wins
  )
  ON CONFLICT (user_id) DO UPDATE SET
    current_streak = EXCLUDED.current_streak,
    longest_streak = EXCLUDED.longest_streak,
    last_played_date = EXCLUDED.last_played_date,
    last_won_date = EXCLUDED.last_won_date,
    total_wins = EXCLUDED.total_wins,
    total_attempts = EXCLUDED.total_attempts,
    archetype_wins = EXCLUDED.archetype_wins
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- Streak freeze (premium feature)
CREATE OR REPLACE FUNCTION apply_posterle_freeze(
  p_user_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_streak posterle_streaks;
BEGIN
  SELECT * INTO v_streak
  FROM posterle_streaks
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_streak.freeze_tokens <= 0 THEN
    RETURN FALSE;
  END IF;

  IF v_streak.last_played_date = CURRENT_DATE THEN
    RETURN FALSE;
  END IF;

  UPDATE posterle_streaks
  SET
    freeze_tokens = freeze_tokens - 1,
    last_played_date = CURRENT_DATE,
    last_freeze_used_at = NOW()
  WHERE user_id = p_user_id;

  RETURN TRUE;
END;
$$;

-- ----------------------------------------------------------------------------
-- ANALYTICS VIEW
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_posterle_daily_stats AS
SELECT
  pp.puzzle_date,
  pp.difficulty_tier,
  f.title AS film_title,
  COUNT(pa.id) AS total_attempts,
  COUNT(pa.id) FILTER (WHERE pa.result = 'won') AS total_wins,
  COUNT(pa.id) FILTER (WHERE pa.result = 'lost') AS total_losses,
  ROUND(AVG(pa.won_on_attempt) FILTER (WHERE pa.result = 'won')::NUMERIC, 2)
    AS avg_attempts_to_win,
  ROUND(
    100.0 * COUNT(pa.id) FILTER (WHERE pa.result = 'won') /
    NULLIF(COUNT(pa.id) FILTER (WHERE pa.result != 'in_progress'), 0),
    1
  ) AS win_rate_pct
FROM posterle_puzzles pp
LEFT JOIN films f ON f.id = pp.film_id
LEFT JOIN posterle_attempts pa ON pa.puzzle_id = pp.id
GROUP BY pp.puzzle_date, pp.difficulty_tier, f.title
ORDER BY pp.puzzle_date DESC;

-- ----------------------------------------------------------------------------
-- GRANTS
-- ----------------------------------------------------------------------------

GRANT SELECT ON posterle_puzzles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON posterle_attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON posterle_streaks TO authenticated;
GRANT SELECT ON posterle_hint_reveals TO authenticated;

GRANT USAGE ON SEQUENCE posterle_puzzles_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE posterle_attempts_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE posterle_hint_reveals_id_seq TO authenticated;

GRANT EXECUTE ON FUNCTION get_posterle_candidates TO service_role;
GRANT EXECUTE ON FUNCTION record_posterle_hint TO service_role;
GRANT EXECUTE ON FUNCTION update_posterle_streak TO service_role;
GRANT EXECUTE ON FUNCTION apply_posterle_freeze TO authenticated, service_role;

COMMIT;
