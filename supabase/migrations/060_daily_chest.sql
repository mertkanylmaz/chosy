-- Daily Chest log — 7/7 tamamlama odulleri
CREATE TABLE IF NOT EXISTS daily_chest_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  chest_date DATE NOT NULL,
  rewards_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, chest_date)
);

-- RLS: users can read their own
ALTER TABLE daily_chest_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own chests" ON daily_chest_log
  FOR SELECT USING (auth.uid() = user_id);
-- Insert only via service_role (Edge Function)

-- app_config: daily_chest_rewards
INSERT INTO app_config (key, value) VALUES (
  'daily_chest_rewards',
  '{"dna_boost_percent": 25, "streak_shield_count": 1, "double_xp_tomorrow": true}'::jsonb
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
