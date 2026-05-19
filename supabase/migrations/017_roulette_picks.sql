-- ============================================================
-- MoodFlix — Watchlist Roulette Analytics
-- 017_roulette_picks.sql
-- Roulette spin sonuclarini kaydeder (engagement metrikleri)
-- ============================================================

CREATE TABLE IF NOT EXISTS roulette_picks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  film_id         UUID REFERENCES films(id) ON DELETE SET NULL,
  runtime_filter  TEXT,                          -- 'short' | 'medium' | 'long' | 'any'
  excluded_genres TEXT[],                        -- kullanicinin cikarttigi turler
  used_mood       BOOLEAN DEFAULT false,         -- mood text kullanildi mi
  outcome         TEXT DEFAULT 'shown',          -- 'shown' | 'accepted' | 'spin_again' | 'closed'
  candidate_count INTEGER,                       -- filtreleme sonrasi kac film vardi
  picked_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Indexler
CREATE INDEX IF NOT EXISTS idx_roulette_picks_user_date
  ON roulette_picks(user_id, picked_at DESC);

-- Watchlist unwatched hizli erisim (mevcut watchlist tablosunda)
-- Not: watched_at kolonu yok, bu index user_id bazli partial index
CREATE INDEX IF NOT EXISTS idx_watchlist_user_film
  ON watchlist(user_id, film_id);

-- RLS
ALTER TABLE roulette_picks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roulette_picks: owner all"
  ON roulette_picks
  FOR ALL
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  )
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  );
