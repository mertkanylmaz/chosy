-- Mini Games: daily_puzzles + game_scores
-- Migration 016 — 2026-05-14

-- Günlük bulmacalar
CREATE TABLE IF NOT EXISTS daily_puzzles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  game_type TEXT NOT NULL,
  film_id BIGINT NOT NULL,
  clues JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_attempts INT NOT NULL DEFAULT 6,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(date, game_type)
);

-- Oyuncu skorları
CREATE TABLE IF NOT EXISTS game_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  puzzle_id UUID REFERENCES daily_puzzles(id) ON DELETE CASCADE,
  solved BOOLEAN NOT NULL DEFAULT FALSE,
  attempts INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, puzzle_id)
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_daily_puzzles_date_type ON daily_puzzles(date, game_type);
CREATE INDEX IF NOT EXISTS idx_game_scores_user ON game_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_game_scores_puzzle ON game_scores(puzzle_id);

-- RLS: Puzzle'lar herkese açık (SELECT), sadece server INSERT
ALTER TABLE daily_puzzles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Puzzles are readable by all"
  ON daily_puzzles FOR SELECT
  USING (true);

CREATE POLICY "Puzzles insertable by authenticated"
  ON daily_puzzles FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- RLS: Skorlar sadece kendi kullanıcısına
ALTER TABLE game_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own scores"
  ON game_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own scores"
  ON game_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own scores"
  ON game_scores FOR UPDATE
  USING (auth.uid() = user_id);
