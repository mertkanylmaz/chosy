-- ============================================================================
-- Migration 017: Posterle (Daily Poster Puzzle Game)
-- ============================================================================
-- Description: Wordle-style daily poster guessing game with archetype-aware
--              hints, streak tracking, and discovery-on-loss funnel.
-- Dependencies: users (id, archetype), films (id, poster_url, popularity, etc.)
-- Rollback: See 017_posterle_game.down.sql
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- TABLES
-- ----------------------------------------------------------------------------

-- Daily puzzle assignments (one row per calendar date, globally shared)
CREATE TABLE IF NOT EXISTS daily_puzzles (
  id              BIGSERIAL PRIMARY KEY,
  puzzle_date     DATE UNIQUE NOT NULL,
  film_id         BIGINT NOT NULL REFERENCES films(id) ON DELETE RESTRICT,
  difficulty_tier TEXT NOT NULL CHECK (difficulty_tier IN ('easy', 'medium', 'hard')),
  curator_notes   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Prevent same film being puzzle twice within 180-day window via partial unique
  -- (enforced at curation function level, but indexed for fast checks)
  CONSTRAINT daily_puzzles_date_not_future CHECK (puzzle_date <= CURRENT_DATE + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS idx_daily_puzzles_date_desc
  ON daily_puzzles(puzzle_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_puzzles_film_recent
  ON daily_puzzles(film_id, puzzle_date DESC);

COMMENT ON TABLE daily_puzzles IS
  'Global daily puzzle assignments. Curated by curate-daily-puzzle edge function at 23:00 UTC.';

-- Per-user puzzle attempts (one row per user per puzzle)
CREATE TABLE IF NOT EXISTS puzzle_attempts (
  id                  BIGSERIAL PRIMARY KEY,
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  puzzle_id           BIGINT NOT NULL REFERENCES daily_puzzles(id) ON DELETE CASCADE,
  attempts_used       SMALLINT NOT NULL DEFAULT 0 CHECK (attempts_used BETWEEN 0 AND 6),
  guesses             JSONB NOT NULL DEFAULT '[]'::jsonb,
  result              TEXT NOT NULL DEFAULT 'in_progress'
                        CHECK (result IN ('in_progress', 'won', 'lost')),
  won_on_attempt      SMALLINT CHECK (won_on_attempt IS NULL OR won_on_attempt BETWEEN 1 AND 6),
  archetype_at_time   TEXT, -- snapshot for analytics (user can change archetype)
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  -- One attempt per user per puzzle
  UNIQUE(user_id, puzzle_id),
  -- Consistency: won_on_attempt only if result = 'won'
  CONSTRAINT won_attempt_matches_result CHECK (
    (result = 'won' AND won_on_attempt IS NOT NULL) OR
    (result != 'won' AND won_on_attempt IS NULL)
  ),
  -- Consistency: completed_at only if result != in_progress
  CONSTRAINT completed_at_matches_result CHECK (
    (result = 'in_progress' AND completed_at IS NULL) OR
    (result != 'in_progress' AND completed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_attempts_user_date
  ON puzzle_attempts(user_id, completed_at DESC NULLS FIRST);

CREATE INDEX IF NOT EXISTS idx_attempts_puzzle_result
  ON puzzle_attempts(puzzle_id, result)
  WHERE result != 'in_progress';

CREATE INDEX IF NOT EXISTS idx_attempts_archetype_analytics
  ON puzzle_attempts(archetype_at_time, result)
  WHERE result != 'in_progress';

COMMENT ON TABLE puzzle_attempts IS
  'User game state per daily puzzle. JSONB guesses for flexible analytics.';

-- Aggregate streak/lifetime stats per user (denormalized for read perf)
CREATE TABLE IF NOT EXISTS puzzle_streaks (
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
  CONSTRAINT longest_gte_current CHECK (longest_streak >= current_streak)
);

CREATE INDEX IF NOT EXISTS idx_streaks_current_desc
  ON puzzle_streaks(current_streak DESC)
  WHERE current_streak > 0;

COMMENT ON TABLE puzzle_streaks IS
  'Denormalized lifetime stats. Updated transactionally by submit-puzzle-guess function.';

-- Hint reveals (separate table for analytics on which hints are most/least useful)
CREATE TABLE IF NOT EXISTS puzzle_hint_reveals (
  id              BIGSERIAL PRIMARY KEY,
  attempt_id      BIGINT NOT NULL REFERENCES puzzle_attempts(id) ON DELETE CASCADE,
  attempt_number  SMALLINT NOT NULL CHECK (attempt_number BETWEEN 1 AND 6),
  hint_type       TEXT NOT NULL CHECK (hint_type IN (
                    'genre', 'decade', 'year', 'director', 'cast',
                    'mood', 'runtime', 'writer', 'rating'
                  )),
  hint_value      TEXT NOT NULL,
  revealed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(attempt_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_hint_reveals_attempt
  ON puzzle_hint_reveals(attempt_id, attempt_number);

-- ----------------------------------------------------------------------------
-- TRIGGERS
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_streaks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_streaks_updated_at ON puzzle_streaks;
CREATE TRIGGER trg_streaks_updated_at
  BEFORE UPDATE ON puzzle_streaks
  FOR EACH ROW
  EXECUTE FUNCTION update_streaks_updated_at();

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------

ALTER TABLE daily_puzzles ENABLE ROW LEVEL SECURITY;
ALTER TABLE puzzle_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE puzzle_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE puzzle_hint_reveals ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read past + today's puzzle (but not future)
DROP POLICY IF EXISTS "puzzles_read_past_and_today" ON daily_puzzles;
CREATE POLICY "puzzles_read_past_and_today" ON daily_puzzles
  FOR SELECT
  TO authenticated
  USING (puzzle_date <= CURRENT_DATE);

-- Users can only read/write their own attempts
DROP POLICY IF EXISTS "attempts_own" ON puzzle_attempts;
CREATE POLICY "attempts_own" ON puzzle_attempts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only read their own streaks
DROP POLICY IF EXISTS "streaks_own" ON puzzle_streaks;
CREATE POLICY "streaks_own" ON puzzle_streaks
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own hint reveals
DROP POLICY IF EXISTS "hints_own" ON puzzle_hint_reveals;
CREATE POLICY "hints_own" ON puzzle_hint_reveals
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM puzzle_attempts pa
      WHERE pa.id = attempt_id AND pa.user_id = auth.uid()
    )
  );

-- Service role bypasses RLS automatically — edge functions use service key

-- ----------------------------------------------------------------------------
-- HELPER RPCs (callable from edge functions with service role)
-- ----------------------------------------------------------------------------

-- Get puzzle candidates filtered by popularity, vote count, and recency exclusion.
-- Used by curate-daily-puzzle edge function.
CREATE OR REPLACE FUNCTION get_puzzle_candidates(
  p_popularity_min FLOAT,
  p_popularity_max FLOAT,
  p_min_vote_count INT,
  p_exclude_after_date DATE,
  p_limit INT DEFAULT 20
) RETURNS TABLE (
  id BIGINT,
  title TEXT,
  poster_url TEXT,
  popularity FLOAT,
  vote_count INT,
  original_language TEXT,
  release_year INT
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
    f.popularity,
    f.vote_count,
    f.original_language,
    EXTRACT(YEAR FROM f.release_date)::INT AS release_year
  FROM films f
  WHERE f.popularity BETWEEN p_popularity_min AND p_popularity_max
    AND f.vote_count >= p_min_vote_count
    AND f.poster_url IS NOT NULL
    AND LENGTH(f.poster_url) > 10
    AND f.id NOT IN (
      SELECT film_id
      FROM daily_puzzles
      WHERE puzzle_date > p_exclude_after_date
    )
  ORDER BY RANDOM()
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION get_puzzle_candidates IS
  'Selects random puzzle candidates excluding recently-used films. Service-role only in practice.';

-- Atomically increment hint reveal (idempotent per attempt+attempt_number).
CREATE OR REPLACE FUNCTION record_hint_reveal(
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
  INSERT INTO puzzle_hint_reveals (attempt_id, attempt_number, hint_type, hint_value)
  VALUES (p_attempt_id, p_attempt_number, p_hint_type, p_hint_value)
  ON CONFLICT (attempt_id, attempt_number) DO NOTHING;
END;
$$;

-- Atomic streak update: recomputes streak based on previous played date.
-- Returns the updated streak row for the response payload.
CREATE OR REPLACE FUNCTION update_user_streak(
  p_user_id UUID,
  p_won BOOLEAN,
  p_puzzle_date DATE,
  p_archetype TEXT
) RETURNS puzzle_streaks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing puzzle_streaks;
  v_continuing BOOLEAN;
  v_new_current INT;
  v_new_longest INT;
  v_archetype_wins JSONB;
  v_result puzzle_streaks;
BEGIN
  -- Lock the streak row (or NULL if first play)
  SELECT * INTO v_existing
  FROM puzzle_streaks
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

  INSERT INTO puzzle_streaks (
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

COMMENT ON FUNCTION update_user_streak IS
  'Transactional streak update with row-level lock. Handles streak continuation, breakage, and archetype-specific win tracking.';

-- Use a freeze token to preserve streak (premium feature).
-- Returns TRUE if freeze applied, FALSE if no tokens or already played today.
CREATE OR REPLACE FUNCTION apply_streak_freeze(
  p_user_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_streak puzzle_streaks;
BEGIN
  SELECT * INTO v_streak
  FROM puzzle_streaks
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_streak.freeze_tokens <= 0 THEN
    RETURN FALSE;
  END IF;

  -- Can't freeze if already played today
  IF v_streak.last_played_date = CURRENT_DATE THEN
    RETURN FALSE;
  END IF;

  UPDATE puzzle_streaks
  SET
    freeze_tokens = freeze_tokens - 1,
    last_played_date = CURRENT_DATE,
    last_freeze_used_at = NOW()
  WHERE user_id = p_user_id;

  RETURN TRUE;
END;
$$;

-- ----------------------------------------------------------------------------
-- ANALYTICS VIEWS
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_puzzle_daily_stats AS
SELECT
  dp.puzzle_date,
  dp.difficulty_tier,
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
FROM daily_puzzles dp
LEFT JOIN films f ON f.id = dp.film_id
LEFT JOIN puzzle_attempts pa ON pa.puzzle_id = dp.id
GROUP BY dp.puzzle_date, dp.difficulty_tier, f.title
ORDER BY dp.puzzle_date DESC;

COMMENT ON VIEW v_puzzle_daily_stats IS
  'Per-puzzle aggregate stats for difficulty calibration. Internal use.';

-- ----------------------------------------------------------------------------
-- GRANTS
-- ----------------------------------------------------------------------------

GRANT SELECT ON daily_puzzles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON puzzle_attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON puzzle_streaks TO authenticated;
GRANT SELECT ON puzzle_hint_reveals TO authenticated;

GRANT USAGE ON SEQUENCE puzzle_attempts_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE puzzle_hint_reveals_id_seq TO authenticated;

-- RPCs are SECURITY DEFINER so authenticated users can call them
GRANT EXECUTE ON FUNCTION get_puzzle_candidates TO service_role;
GRANT EXECUTE ON FUNCTION record_hint_reveal TO service_role;
GRANT EXECUTE ON FUNCTION update_user_streak TO service_role;
GRANT EXECUTE ON FUNCTION apply_streak_freeze TO authenticated, service_role;

COMMIT;

-- ============================================================================
-- POST-DEPLOY VERIFICATION (run manually after migration)
-- ============================================================================
-- SELECT COUNT(*) FROM information_schema.tables
--   WHERE table_name IN ('daily_puzzles', 'puzzle_attempts', 'puzzle_streaks',
--                        'puzzle_hint_reveals');
-- -- Expected: 4
--
-- SELECT polname FROM pg_policies
--   WHERE schemaname = 'public'
--     AND tablename IN ('daily_puzzles', 'puzzle_attempts', 'puzzle_streaks',
--                       'puzzle_hint_reveals');
-- -- Expected: 4+ policies
--
-- SELECT proname FROM pg_proc
--   WHERE proname IN ('get_puzzle_candidates', 'record_hint_reveal',
--                     'update_user_streak', 'apply_streak_freeze');
-- -- Expected: 4
