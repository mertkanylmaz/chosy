-- ============================================================
-- MoodFlix — Security RLS Update
-- 008_security_rls_update.sql
-- Mevcut politikaları güvenli şekilde yeniden oluşturur.
-- Ayrıca Edge Function rate limiting tablosunu ekler.
-- ============================================================

-- ─── Watchlist RLS (yeniden uygula) ──────────────────────────────────────────

DROP POLICY IF EXISTS "watchlist: owner read"   ON watchlist;
DROP POLICY IF EXISTS "watchlist: owner insert" ON watchlist;
DROP POLICY IF EXISTS "watchlist: owner delete" ON watchlist;

ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "watchlist: owner read"
  ON watchlist FOR SELECT
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  );

CREATE POLICY "watchlist: owner insert"
  ON watchlist FOR INSERT
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  );

CREATE POLICY "watchlist: owner delete"
  ON watchlist FOR DELETE
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  );

-- ─── Swipes RLS (yeniden uygula) ─────────────────────────────────────────────

DROP POLICY IF EXISTS "swipes: owner read"   ON swipes;
DROP POLICY IF EXISTS "swipes: owner insert" ON swipes;

ALTER TABLE swipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "swipes: owner read"
  ON swipes FOR SELECT
  USING (
    session_id IN (
      SELECT s.id FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE u.auth_id = auth.uid()::text
    )
  );

CREATE POLICY "swipes: owner insert"
  ON swipes FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT s.id FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE u.auth_id = auth.uid()::text
    )
  );

-- ─── Sessions RLS (yeniden uygula) ───────────────────────────────────────────

DROP POLICY IF EXISTS "sessions: owner read"   ON sessions;
DROP POLICY IF EXISTS "sessions: owner insert" ON sessions;

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions: owner read"
  ON sessions FOR SELECT
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  );

CREATE POLICY "sessions: owner insert"
  ON sessions FOR INSERT
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  );

-- ─── API Rate Limits Tablosu (Edge Function rate limiting) ───────────────────

CREATE TABLE IF NOT EXISTS api_rate_limits (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT NOT NULL,          -- auth.uid() veya 'anon'
  function_name TEXT NOT NULL,         -- 'parse-mood' | 'explain-match'
  window_start TIMESTAMPTZ NOT NULL,   -- pencere başlangıcı (dakika bazlı)
  request_count INTEGER NOT NULL DEFAULT 1,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, function_name, window_start)
);

-- Eski kayıtları temizleme için index
CREATE INDEX IF NOT EXISTS idx_rate_limits_window
  ON api_rate_limits (function_name, window_start);

-- Servis rolü tüm işlemleri yapabilir (Edge Functions service_role kullanır)
ALTER TABLE api_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_limits: service full access"
  ON api_rate_limits
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── Eski kayıt temizleme fonksiyonu (opsiyonel cron) ────────────────────────

CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM api_rate_limits
  WHERE window_start < NOW() - INTERVAL '2 hours';
$$;
