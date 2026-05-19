-- ============================================================
-- MoodFlix — Slot Variants & Token Economy
-- 022_slot_variants.sql
-- 3 slot variant tracking + free user token economy
-- ============================================================

-- ─── A) Slot spins tablosu (variant-aware) ───────────────────────────────────
-- roulette_picks zaten var ama bu tablo variant bazli analitik icin

CREATE TABLE IF NOT EXISTS slot_spins (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  film_id      UUID REFERENCES films(id) ON DELETE SET NULL,
  variant      TEXT NOT NULL CHECK (variant IN ('pure_random', 'mood_filtered', 'triple')),
  mood_context TEXT,
  filters      JSONB,
  match_score  FLOAT,
  accepted     BOOLEAN DEFAULT FALSE,
  spun_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slot_spins_user_date
  ON slot_spins(user_id, spun_at DESC);

-- RLS
ALTER TABLE slot_spins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "slot_spins: owner all"
  ON slot_spins
  FOR ALL
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  )
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  );

-- ─── B) Token economy — free user slot token sistemi ─────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS slot_tokens INT DEFAULT 0;

CREATE TABLE IF NOT EXISTS slot_token_transactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount     INT NOT NULL,    -- positive = earn, negative = spend
  reason     TEXT NOT NULL,   -- 'streak_3day', 'game_perfect', 'daily_login_7', 'spin_used'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slot_token_tx_user
  ON slot_token_transactions(user_id, created_at DESC);

-- RLS
ALTER TABLE slot_token_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "slot_token_transactions: owner all"
  ON slot_token_transactions
  FOR ALL
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  )
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  );

-- ─── C) Token RPC: earn tokens (max 5 balance for free users) ────────────────

CREATE OR REPLACE FUNCTION earn_slot_token(
  p_user_id UUID,
  p_amount  INT,
  p_reason  TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier     TEXT;
  v_current  INT;
  v_new      INT;
  v_max      INT := 5;
BEGIN
  SELECT subscription_tier, slot_tokens INTO v_tier, v_current
    FROM users WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'USER_NOT_FOUND');
  END IF;

  -- Premium kullanicilar icin token sistemi gereksiz ama log'la
  IF v_tier NOT IN ('free', 'weekly_legacy') THEN
    RETURN jsonb_build_object('success', false, 'error', 'PREMIUM_NO_TOKENS_NEEDED');
  END IF;

  -- Max balance check
  v_new := LEAST(v_current + p_amount, v_max);
  IF v_new <= v_current THEN
    RETURN jsonb_build_object('success', false, 'error', 'MAX_BALANCE', 'balance', v_current);
  END IF;

  -- Update balance
  UPDATE users SET slot_tokens = v_new WHERE id = p_user_id;

  -- Log transaction
  INSERT INTO slot_token_transactions (user_id, amount, reason)
    VALUES (p_user_id, v_new - v_current, p_reason);

  RETURN jsonb_build_object('success', true, 'balance', v_new, 'earned', v_new - v_current);
END $$;

-- ─── D) Token RPC: spend token (1 token = 1 extra spin) ─────────────────────

CREATE OR REPLACE FUNCTION spend_slot_token(
  p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current INT;
BEGIN
  SELECT slot_tokens INTO v_current FROM users WHERE id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'USER_NOT_FOUND');
  END IF;

  IF v_current <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'NO_TOKENS', 'balance', 0);
  END IF;

  UPDATE users SET slot_tokens = slot_tokens - 1 WHERE id = p_user_id;

  INSERT INTO slot_token_transactions (user_id, amount, reason)
    VALUES (p_user_id, -1, 'spin_used');

  RETURN jsonb_build_object('success', true, 'balance', v_current - 1);
END $$;
