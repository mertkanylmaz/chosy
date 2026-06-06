-- Migration 036: user_taste_signals — Personalization event log

CREATE TYPE taste_signal_type AS ENUM (
  'watchlist_add',
  'watchlist_remove',
  'detail_view',
  'swipe_right',
  'swipe_left',
  'pick_clicked',
  'mood_search_completed'
);

CREATE TABLE user_taste_signals (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  film_id     UUID REFERENCES films(id) ON DELETE CASCADE,
  signal_type taste_signal_type NOT NULL,
  strength    REAL NOT NULL CHECK (strength >= -1.0 AND strength <= 1.0),
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_taste_signals_user_recent
  ON user_taste_signals(user_id, created_at DESC);

CREATE INDEX idx_taste_signals_user_film
  ON user_taste_signals(user_id, film_id)
  WHERE film_id IS NOT NULL;

CREATE INDEX idx_taste_signals_type
  ON user_taste_signals(user_id, signal_type, created_at DESC);

ALTER TABLE user_taste_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see only their signals"
  ON user_taste_signals FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()::text
    )
  );

CREATE POLICY "Users write only their signals"
  ON user_taste_signals FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()::text
    )
  );

COMMENT ON TABLE user_taste_signals IS
  'Append-only event log of user taste signals. Source of truth for personalization (TASK 2.4 aggregation).';
COMMENT ON COLUMN user_taste_signals.strength IS
  'Signal strength in [-1, 1]. Negative = aversion signal.';
COMMENT ON COLUMN user_taste_signals.metadata IS
  'Flexible per-signal data. detail_view: {duration_ms}. swipe: {position, deck_index}. mood_search: {search_id}.';
