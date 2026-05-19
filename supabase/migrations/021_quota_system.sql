-- ============================================================
-- MoodFlix — Quota System Migration
-- 021_quota_system.sql
-- Yeni 4-tier subscription + DB-driven quota tracking
-- ============================================================

-- ─── A) Users tablosuna subscription_tier kolonu ────────────────────────────
-- Mevcut plan bilgisi subscriptions tablosunda, ama RPC'ler icin
-- users tablosunda da hizli erisim kolonu lazim.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'free';

CREATE INDEX IF NOT EXISTS idx_users_subscription_tier
  ON users (subscription_tier);

-- Mevcut weekly aboneleri weekly_legacy'ye migrate et
-- (subscriptions tablosunda aktif weekly plan varsa)
UPDATE users u
SET subscription_tier = 'weekly_legacy'
WHERE EXISTS (
  SELECT 1 FROM subscriptions s
  WHERE s.user_id = u.id
    AND s.plan = 'weekly'
    AND s.status IN ('active', 'trial')
);

-- Mevcut monthly aboneleri
UPDATE users u
SET subscription_tier = 'monthly'
WHERE EXISTS (
  SELECT 1 FROM subscriptions s
  WHERE s.user_id = u.id
    AND s.plan = 'monthly'
    AND s.status IN ('active', 'trial')
);

-- Mevcut yearly aboneleri -> annual
UPDATE users u
SET subscription_tier = 'annual'
WHERE EXISTS (
  SELECT 1 FROM subscriptions s
  WHERE s.user_id = u.id
    AND s.plan = 'yearly'
    AND s.status IN ('active', 'trial')
);

-- ─── B) Quota tracking tablosu ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_daily_quotas (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  searches_used INT DEFAULT 0,
  refines_used INT DEFAULT 0,
  rerolls_used INT DEFAULT 0,
  slot_spins_used INT DEFAULT 0,
  games_played JSONB DEFAULT '{}'::jsonb,
  bonus_searches_earned INT DEFAULT 0,
  bonus_searches_used INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_quotas_user_recent
  ON user_daily_quotas(user_id, date DESC);

-- RLS
ALTER TABLE user_daily_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quotas"
  ON user_daily_quotas FOR SELECT
  USING (user_id IN (SELECT id FROM users WHERE auth_id = (SELECT auth.uid()::text)));

CREATE POLICY "Users can insert own quotas"
  ON user_daily_quotas FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_id = (SELECT auth.uid()::text)));

CREATE POLICY "Users can update own quotas"
  ON user_daily_quotas FOR UPDATE
  USING (user_id IN (SELECT id FROM users WHERE auth_id = (SELECT auth.uid()::text)));

-- ─── C) Subscription limits konfigürasyon tablosu ──────────────────────────

CREATE TABLE IF NOT EXISTS subscription_limits (
  tier TEXT PRIMARY KEY,
  daily_search_limit INT NOT NULL,
  daily_refine_limit INT NOT NULL,       -- -1 = sinirsiz
  daily_slot_limit INT NOT NULL,         -- -1 = sinirsiz
  daily_game_limit_per_game INT NOT NULL,-- -1 = sinirsiz
  watchlist_max_films INT NOT NULL,      -- -1 = sinirsiz
  mood_history_days INT NOT NULL,
  advanced_filters BOOLEAN DEFAULT FALSE,
  streaming_availability BOOLEAN DEFAULT FALSE,
  custom_lists BOOLEAN DEFAULT FALSE,
  priority_ai BOOLEAN DEFAULT FALSE
);

INSERT INTO subscription_limits VALUES
  ('free',           3,  1,  1,  1,  30,   0, false, false, false, false),
  ('weekly_legacy', 14, -1,  5, -1,  -1,  30, true,  true,  true,  false),
  ('monthly',       15, -1, -1, -1,  -1,  30, true,  true,  true,  true),
  ('annual',        25, -1, -1, -1,  -1, 365, true,  true,  true,  true),
  ('lifetime',      50, -1, -1, -1,  -1,  -1, true,  true,  true,  true)
ON CONFLICT (tier) DO NOTHING;

-- RLS: subscription_limits herkes okuyabilir (public config)
ALTER TABLE subscription_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read subscription limits"
  ON subscription_limits FOR SELECT
  USING (true);

-- ─── D) RPC: Atomic quota check + increment ────────────────────────────────

CREATE OR REPLACE FUNCTION check_and_consume_quota(
  p_user_id UUID,
  p_quota_type TEXT -- 'search' | 'refine' | 'slot'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier TEXT;
  v_limit INT;
  v_used INT;
  v_bonus INT;
  v_today DATE := CURRENT_DATE;
  v_quota_row user_daily_quotas%ROWTYPE;
BEGIN
  -- Get user tier
  SELECT subscription_tier INTO v_tier FROM users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'USER_NOT_FOUND');
  END IF;

  -- Upsert today's quota row (atomic)
  INSERT INTO user_daily_quotas (user_id, date)
    VALUES (p_user_id, v_today)
    ON CONFLICT (user_id, date) DO NOTHING;

  -- Lock and read
  SELECT * INTO v_quota_row
    FROM user_daily_quotas
    WHERE user_id = p_user_id AND date = v_today
    FOR UPDATE;

  -- Get limit based on quota type
  CASE p_quota_type
    WHEN 'search' THEN
      SELECT daily_search_limit INTO v_limit FROM subscription_limits WHERE tier = v_tier;
      v_used := v_quota_row.searches_used;
      v_bonus := v_quota_row.bonus_searches_earned - v_quota_row.bonus_searches_used;
    WHEN 'refine' THEN
      SELECT daily_refine_limit INTO v_limit FROM subscription_limits WHERE tier = v_tier;
      v_used := v_quota_row.refines_used;
      v_bonus := 0;
    WHEN 'slot' THEN
      SELECT daily_slot_limit INTO v_limit FROM subscription_limits WHERE tier = v_tier;
      v_used := v_quota_row.slot_spins_used;
      v_bonus := 0;
    ELSE
      RETURN jsonb_build_object('allowed', false, 'error', 'INVALID_QUOTA_TYPE');
  END CASE;

  -- If limit not found (tier missing from config), deny
  IF v_limit IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'TIER_NOT_CONFIGURED', 'tier', v_tier);
  END IF;

  -- Check (-1 = unlimited)
  IF v_limit != -1 AND v_used >= (v_limit + GREATEST(v_bonus, 0)) THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'QUOTA_EXCEEDED',
      'used', v_used,
      'limit', v_limit + GREATEST(v_bonus, 0),
      'tier', v_tier,
      'reset_at', (v_today + INTERVAL '1 day')::timestamptz
    );
  END IF;

  -- Increment (use bonus first if available for search)
  CASE p_quota_type
    WHEN 'search' THEN
      IF v_bonus > 0 AND v_used >= v_limit THEN
        UPDATE user_daily_quotas
          SET bonus_searches_used = bonus_searches_used + 1, updated_at = NOW()
          WHERE user_id = p_user_id AND date = v_today;
      ELSE
        UPDATE user_daily_quotas
          SET searches_used = searches_used + 1, updated_at = NOW()
          WHERE user_id = p_user_id AND date = v_today;
      END IF;
    WHEN 'refine' THEN
      UPDATE user_daily_quotas
        SET refines_used = refines_used + 1, updated_at = NOW()
        WHERE user_id = p_user_id AND date = v_today;
    WHEN 'slot' THEN
      UPDATE user_daily_quotas
        SET slot_spins_used = slot_spins_used + 1, updated_at = NOW()
        WHERE user_id = p_user_id AND date = v_today;
  END CASE;

  RETURN jsonb_build_object(
    'allowed', true,
    'used', v_used + 1,
    'limit', CASE WHEN v_limit = -1 THEN 999999 ELSE v_limit + GREATEST(v_bonus, 0) END,
    'tier', v_tier
  );
END $$;

-- ─── E) RPC: Game quota (JSONB-based) ──────────────────────────────────────

CREATE OR REPLACE FUNCTION check_and_consume_game_quota(
  p_user_id UUID,
  p_game_id TEXT -- 'posterle' | 'imposter' | 'pinpoint' | 'roast'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier TEXT;
  v_limit INT;
  v_used INT;
  v_today DATE := CURRENT_DATE;
  v_games JSONB;
BEGIN
  -- Get user tier
  SELECT subscription_tier INTO v_tier FROM users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'USER_NOT_FOUND');
  END IF;

  -- Get game limit for tier
  SELECT daily_game_limit_per_game INTO v_limit FROM subscription_limits WHERE tier = v_tier;
  IF v_limit IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'TIER_NOT_CONFIGURED', 'tier', v_tier);
  END IF;

  -- Upsert today's quota row
  INSERT INTO user_daily_quotas (user_id, date)
    VALUES (p_user_id, v_today)
    ON CONFLICT (user_id, date) DO NOTHING;

  -- Lock and read games_played
  SELECT games_played INTO v_games
    FROM user_daily_quotas
    WHERE user_id = p_user_id AND date = v_today
    FOR UPDATE;

  -- Get current count for this game
  v_used := COALESCE((v_games->>p_game_id)::int, 0);

  -- Check (-1 = unlimited)
  IF v_limit != -1 AND v_used >= v_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'QUOTA_EXCEEDED',
      'used', v_used,
      'limit', v_limit,
      'game_id', p_game_id,
      'tier', v_tier,
      'reset_at', (v_today + INTERVAL '1 day')::timestamptz
    );
  END IF;

  -- Increment game count in JSONB
  UPDATE user_daily_quotas
    SET games_played = jsonb_set(
          COALESCE(games_played, '{}'::jsonb),
          ARRAY[p_game_id],
          to_jsonb(v_used + 1)
        ),
        updated_at = NOW()
    WHERE user_id = p_user_id AND date = v_today;

  RETURN jsonb_build_object(
    'allowed', true,
    'used', v_used + 1,
    'limit', CASE WHEN v_limit = -1 THEN 999999 ELSE v_limit END,
    'game_id', p_game_id,
    'tier', v_tier
  );
END $$;

-- ─── F) RPC: Grant bonus searches ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION grant_bonus_searches(
  p_user_id UUID,
  p_amount INT,
  p_reason TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Upsert today's quota row
  INSERT INTO user_daily_quotas (user_id, date)
    VALUES (p_user_id, v_today)
    ON CONFLICT (user_id, date) DO NOTHING;

  -- Add bonus
  UPDATE user_daily_quotas
    SET bonus_searches_earned = bonus_searches_earned + p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id AND date = v_today;

  -- Log for auditing (optional: could insert into a bonus_log table)
  RAISE NOTICE 'Bonus searches granted: user=%, amount=%, reason=%', p_user_id, p_amount, p_reason;
END $$;

-- ─── G) Helper RPC: Get quota status (read-only) ───────────────────────────

CREATE OR REPLACE FUNCTION get_quota_status(
  p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier TEXT;
  v_today DATE := CURRENT_DATE;
  v_quota_row user_daily_quotas%ROWTYPE;
  v_limits subscription_limits%ROWTYPE;
BEGIN
  SELECT subscription_tier INTO v_tier FROM users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'USER_NOT_FOUND');
  END IF;

  SELECT * INTO v_limits FROM subscription_limits WHERE tier = v_tier;

  -- Get or create today's row
  INSERT INTO user_daily_quotas (user_id, date)
    VALUES (p_user_id, v_today)
    ON CONFLICT (user_id, date) DO NOTHING;

  SELECT * INTO v_quota_row
    FROM user_daily_quotas
    WHERE user_id = p_user_id AND date = v_today;

  RETURN jsonb_build_object(
    'tier', v_tier,
    'searches', jsonb_build_object(
      'used', v_quota_row.searches_used,
      'limit', v_limits.daily_search_limit,
      'bonus_available', GREATEST(0, v_quota_row.bonus_searches_earned - v_quota_row.bonus_searches_used)
    ),
    'refines', jsonb_build_object(
      'used', v_quota_row.refines_used,
      'limit', v_limits.daily_refine_limit
    ),
    'slots', jsonb_build_object(
      'used', v_quota_row.slot_spins_used,
      'limit', v_limits.daily_slot_limit
    ),
    'games', jsonb_build_object(
      'played', v_quota_row.games_played,
      'limit_per_game', v_limits.daily_game_limit_per_game
    ),
    'reset_at', (v_today + INTERVAL '1 day')::timestamptz
  );
END $$;
