-- Migration 054: arcade_runs tablosu
-- Faz 2 arcade oyunları (Clash, Blitz) için skor kaydı + leaderboard

CREATE TABLE IF NOT EXISTS arcade_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id       TEXT NOT NULL,
  score         INTEGER NOT NULL,
  duration_ms   INTEGER NOT NULL,
  detail_json   JSONB,
  verified      BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Günlük leaderboard index'i — yalnızca doğrulanmış skorlar
CREATE INDEX idx_arcade_leaderboard
  ON arcade_runs (game_id, created_at DESC, score DESC)
  WHERE verified = true;

-- Kullanıcı bazlı sorgu index'i
CREATE INDEX idx_arcade_runs_user
  ON arcade_runs (user_id, created_at DESC);

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE arcade_runs ENABLE ROW LEVEL SECURITY;

-- Kullanıcı kendi run'larını okuyabilir
CREATE POLICY "arcade_runs: owner read"
  ON arcade_runs FOR SELECT
  USING (auth.uid() = user_id);

-- Leaderboard view'ı (Faz 2'de eklenecek) service_role ile çalışır.
-- INSERT yalnızca service_role (submit-arcade-run Edge Function).
