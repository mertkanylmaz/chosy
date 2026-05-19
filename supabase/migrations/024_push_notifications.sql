-- ============================================================
-- MoodFlix — Push Notifications & Streak Rewards
-- 024_push_notifications.sql
-- Push token storage, notification log, streak reward config
-- ============================================================

-- ─── A) Users tablosuna push notification kolonları ────────────────────────────

ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_notification_hour INT DEFAULT 9;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_push_enabled
  ON users (push_enabled) WHERE push_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_last_activity
  ON users (last_activity_at);

-- ─── B) Notification log ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notification_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  type           TEXT NOT NULL,          -- 'daily_hook' | 'sunday_ritual' | 'streak_warning' | 'quota_refill' | 'streak_reward' | 'winback_14' | 'winback_21' | 'winback_30' | 'winback_60'
  title          TEXT,
  body           TEXT,
  data           JSONB,                  -- deep link, extras
  status         TEXT DEFAULT 'queued',  -- queued | sent | failed | opened
  retry_count    INT DEFAULT 0,
  scheduled_for  TIMESTAMPTZ,
  sent_at        TIMESTAMPTZ,
  opened_at      TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_scheduled
  ON notification_log(scheduled_for)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS idx_notifications_user_type
  ON notification_log(user_id, type, created_at DESC);

-- RLS: kullanici kendi notification'larini okuyabilir
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_log: owner read"
  ON notification_log FOR SELECT
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  );

-- Service role can insert/update (Edge Functions)
CREATE POLICY "notification_log: service manage"
  ON notification_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── C) Streak rewards konfigürasyonu ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS streak_rewards (
  streak_days     INT PRIMARY KEY,
  bonus_searches  INT DEFAULT 0,
  slot_tokens     INT DEFAULT 0,
  special_reward  TEXT                   -- badge slug (milestones.slug) veya NULL
);

INSERT INTO streak_rewards (streak_days, bonus_searches, slot_tokens, special_reward) VALUES
  (3,   1,  1,  NULL),
  (7,   3,  2,  'badge_week_warrior'),
  (14,  5,  3,  'badge_fortnight_fan'),
  (30,  10, 5,  'badge_monthly_master'),
  (100, 20, 10, 'badge_century_cinephile')
ON CONFLICT (streak_days) DO NOTHING;

-- RLS: herkes okuyabilir (public config)
ALTER TABLE streak_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "streak_rewards: public read"
  ON streak_rewards FOR SELECT
  USING (true);

-- ─── D) Win-back tracking ─────────────────────────────────────────────────────

ALTER TABLE users ADD COLUMN IF NOT EXISTS winback_stage TEXT DEFAULT NULL;
-- NULL = aktif kullanici, 'day14' | 'day21' | 'day30' | 'day60' | 'inactive'

-- ─── E) RPC: Push token kaydetme ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION save_push_token(
  p_user_id UUID,
  p_push_token TEXT,
  p_timezone TEXT DEFAULT 'UTC'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE users SET
    push_token = p_push_token,
    timezone = COALESCE(p_timezone, 'UTC'),
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

-- ─── F) RPC: Push notification toggle ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION toggle_push_notifications(
  p_user_id UUID,
  p_enabled BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE users SET
    push_enabled = p_enabled,
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

-- ─── G) RPC: Update last activity (for churn detection) ──────────────────────

CREATE OR REPLACE FUNCTION touch_user_activity(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE users SET
    last_activity_at = NOW(),
    winback_stage = NULL  -- Re-engaged: clear winback stage
  WHERE id = p_user_id;
END;
$$;

-- ─── H) RPC: Grant streak rewards ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION grant_streak_rewards(p_user_id UUID, p_streak_days INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward RECORD;
  v_granted JSONB := '{"bonus_searches": 0, "slot_tokens": 0, "special_reward": null}'::jsonb;
BEGIN
  -- Tam eşleşen streak reward var mı?
  SELECT * INTO v_reward
    FROM streak_rewards
    WHERE streak_days = p_streak_days;

  IF NOT FOUND THEN
    RETURN v_granted;
  END IF;

  -- Bonus searches
  IF v_reward.bonus_searches > 0 THEN
    PERFORM grant_bonus_searches(
      p_user_id,
      v_reward.bonus_searches,
      'streak_' || p_streak_days || '_day'
    );
  END IF;

  -- Notification queue for reward
  INSERT INTO notification_log (user_id, type, title, body, data, status, scheduled_for)
  VALUES (
    p_user_id,
    'streak_reward',
    'Streak Reward!',
    p_streak_days || '-day streak bonus: +' || v_reward.bonus_searches || ' searches',
    jsonb_build_object(
      'streak_days', p_streak_days,
      'bonus_searches', v_reward.bonus_searches,
      'slot_tokens', v_reward.slot_tokens,
      'special_reward', v_reward.special_reward
    ),
    'queued',
    NOW()
  );

  v_granted := jsonb_build_object(
    'bonus_searches', v_reward.bonus_searches,
    'slot_tokens', v_reward.slot_tokens,
    'special_reward', v_reward.special_reward
  );

  RETURN v_granted;
END;
$$;

-- ─── I) Frequency limiter view ────────────────────────────────────────────────
-- Son 24 saatte kullaniciya kac notification gonderildi

CREATE OR REPLACE FUNCTION user_notification_count_24h(p_user_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::int
  FROM notification_log
  WHERE user_id = p_user_id
    AND status IN ('sent', 'queued')
    AND created_at > NOW() - INTERVAL '24 hours';
$$;
