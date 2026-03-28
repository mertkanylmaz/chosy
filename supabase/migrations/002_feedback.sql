-- ============================================================
-- MoodFlix — Feedback Migration
-- 002_feedback.sql
-- ============================================================

-- watchlist'e izlenme zamanı ekle
ALTER TABLE watchlist ADD COLUMN IF NOT EXISTS watched_at TIMESTAMPTZ;

-- ============================================================
-- feedback tablosu
-- ============================================================

CREATE TABLE IF NOT EXISTS feedback (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  film_id     UUID NOT NULL REFERENCES films(id) ON DELETE CASCADE,
  star_rating INTEGER NOT NULL CHECK (star_rating BETWEEN 1 AND 5),
  on_point    BOOLEAN NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, film_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_film_id ON feedback(film_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback: owner read"
  ON feedback FOR SELECT
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  );

CREATE POLICY "feedback: owner insert"
  ON feedback FOR INSERT
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  );

CREATE POLICY "feedback: owner update"
  ON feedback FOR UPDATE
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  );
