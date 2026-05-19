-- ============================================================
-- MoodFlix — Referral Program
-- 026_referrals.sql
-- Invite code + referral tracking + reward milestones
-- ============================================================

-- ─── A) Users tablosuna invite_code + referred_by ────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES auth.users(id);

-- Generate invite codes for existing users (8 char alphanumeric)
UPDATE users
SET invite_code = UPPER(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8))
WHERE invite_code IS NULL;

-- Index for invite code lookups
CREATE INDEX IF NOT EXISTS idx_users_invite_code
  ON users (invite_code);

-- ─── B) Referrals Table ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'activated', 'rewarded', 'expired')),
  referee_signed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  referee_activated_at TIMESTAMPTZ,
  rewards_granted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(referrer_id, referee_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee ON referrals(referee_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_invite_code ON referrals(invite_code);

-- RLS
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Referrer kendi davetlerini gorebilir
CREATE POLICY "Users can view own referrals as referrer"
  ON referrals FOR SELECT
  USING (auth.uid() = referrer_id);

-- Referee kendi davet kaydini gorebilir
CREATE POLICY "Users can view own referral as referee"
  ON referrals FOR SELECT
  USING (auth.uid() = referee_id);

-- Insert service_role veya RPC uzerinden
CREATE POLICY "Service role can manage referrals"
  ON referrals FOR ALL
  USING (true)
  WITH CHECK (true);

-- ─── C) Referral Rewards Table ───────────────────────────────────────────────
-- Verilen oduller log'u

CREATE TABLE IF NOT EXISTS referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL
    CHECK (reward_type IN (
      'free_month',       -- 1 ay ucretsiz
      'slot_tokens',      -- Bonus slot token
      'lifetime_upgrade', -- Lifetime'a upgrade
      'ambassador_badge'  -- Cinema Ambassador badge
    )),
  referral_count INT NOT NULL,
  metadata JSONB DEFAULT '{}',
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_user ON referral_rewards(user_id);

ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rewards"
  ON referral_rewards FOR SELECT
  USING (auth.uid() = user_id);

-- ─── D) apply_invite_code RPC ────────────────────────────────────────────────
-- Signup'ta invite code ile kayit

CREATE OR REPLACE FUNCTION apply_invite_code(
  p_referee_id UUID,
  p_invite_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referrer_id UUID;
  v_referrer_code TEXT;
BEGIN
  -- Find referrer by invite code
  SELECT id, invite_code INTO v_referrer_id, v_referrer_code
  FROM users
  WHERE invite_code = UPPER(p_invite_code);

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CODE');
  END IF;

  -- Self-referral block
  IF v_referrer_id = p_referee_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'SELF_REFERRAL');
  END IF;

  -- Already referred check
  IF EXISTS (SELECT 1 FROM referrals WHERE referee_id = p_referee_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_REFERRED');
  END IF;

  -- Already has this referrer
  IF EXISTS (SELECT 1 FROM referrals WHERE referrer_id = v_referrer_id AND referee_id = p_referee_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE');
  END IF;

  -- Create referral record
  INSERT INTO referrals (referrer_id, referee_id, invite_code, status)
    VALUES (v_referrer_id, p_referee_id, v_referrer_code, 'pending');

  -- Update referee's referred_by
  UPDATE users SET referred_by = v_referrer_id WHERE id = p_referee_id;

  RETURN jsonb_build_object(
    'success', true,
    'referrer_id', v_referrer_id
  );
END $$;

-- ─── E) get_referral_stats RPC ───────────────────────────────────────────────
-- Kullanicinin referral istatistikleri

CREATE OR REPLACE FUNCTION get_referral_stats(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total INT;
  v_activated INT;
  v_pending INT;
  v_invite_code TEXT;
  v_rewards JSONB;
  v_next_milestone INT;
  v_next_reward TEXT;
BEGIN
  -- Counts
  SELECT COUNT(*) INTO v_total
  FROM referrals WHERE referrer_id = p_user_id;

  SELECT COUNT(*) INTO v_activated
  FROM referrals WHERE referrer_id = p_user_id AND status IN ('activated', 'rewarded');

  SELECT COUNT(*) INTO v_pending
  FROM referrals WHERE referrer_id = p_user_id AND status = 'pending';

  -- User's invite code
  SELECT invite_code INTO v_invite_code FROM users WHERE id = p_user_id;

  -- Earned rewards
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'type', reward_type,
    'count', referral_count,
    'granted_at', granted_at
  )), '[]'::jsonb) INTO v_rewards
  FROM referral_rewards WHERE user_id = p_user_id;

  -- Next milestone calculation
  IF v_activated < 1 THEN
    v_next_milestone := 1;
    v_next_reward := 'free_month';
  ELSIF v_activated < 3 THEN
    v_next_milestone := 3;
    v_next_reward := 'slot_tokens';
  ELSIF v_activated < 5 THEN
    v_next_milestone := 5;
    v_next_reward := 'lifetime_upgrade';
  ELSIF v_activated < 10 THEN
    v_next_milestone := 10;
    v_next_reward := 'ambassador_badge';
  ELSE
    v_next_milestone := NULL;
    v_next_reward := NULL;
  END IF;

  RETURN jsonb_build_object(
    'invite_code', v_invite_code,
    'total_referrals', v_total,
    'activated_referrals', v_activated,
    'pending_referrals', v_pending,
    'rewards', v_rewards,
    'next_milestone', v_next_milestone,
    'next_reward', v_next_reward,
    'progress', CASE
      WHEN v_next_milestone IS NOT NULL
        THEN ROUND((v_activated::DECIMAL / v_next_milestone) * 100, 1)
      ELSE 100
    END
  );
END $$;

-- ─── F) activate_referral RPC ────────────────────────────────────────────────
-- 7 gun aktif kullanim sonrasi cron tarafindan cagrilir

CREATE OR REPLACE FUNCTION activate_referral(p_referee_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referral referrals%ROWTYPE;
  v_referrer_activated_count INT;
BEGIN
  -- Find pending referral
  SELECT * INTO v_referral
  FROM referrals
  WHERE referee_id = p_referee_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NO_PENDING_REFERRAL');
  END IF;

  -- Activate
  UPDATE referrals
  SET status = 'activated', referee_activated_at = NOW()
  WHERE id = v_referral.id;

  -- Count referrer's total activated referrals
  SELECT COUNT(*) INTO v_referrer_activated_count
  FROM referrals
  WHERE referrer_id = v_referral.referrer_id
    AND status IN ('activated', 'rewarded');

  -- Grant milestone rewards
  -- 1st referral: 1 month free
  IF v_referrer_activated_count = 1 THEN
    INSERT INTO referral_rewards (user_id, reward_type, referral_count)
      VALUES (v_referral.referrer_id, 'free_month', 1);
  END IF;

  -- 3rd referral: 1 more month + 10 slot tokens
  IF v_referrer_activated_count = 3 THEN
    INSERT INTO referral_rewards (user_id, reward_type, referral_count)
      VALUES (v_referral.referrer_id, 'free_month', 3);
    INSERT INTO referral_rewards (user_id, reward_type, referral_count, metadata)
      VALUES (v_referral.referrer_id, 'slot_tokens', 3, '{"tokens": 10}');
  END IF;

  -- 5th referral: Lifetime upgrade (if available)
  IF v_referrer_activated_count = 5 THEN
    DECLARE
      v_lifetime_result JSONB;
    BEGIN
      SELECT claim_lifetime_spot(v_referral.referrer_id, 0, 'referral_reward') INTO v_lifetime_result;
      IF (v_lifetime_result->>'success')::boolean THEN
        INSERT INTO referral_rewards (user_id, reward_type, referral_count, metadata)
          VALUES (v_referral.referrer_id, 'lifetime_upgrade', 5, v_lifetime_result);
      END IF;
    END;
  END IF;

  -- 10th referral: Ambassador badge
  IF v_referrer_activated_count = 10 THEN
    INSERT INTO referral_rewards (user_id, reward_type, referral_count)
      VALUES (v_referral.referrer_id, 'ambassador_badge', 10);
  END IF;

  -- Mark as rewarded
  UPDATE referrals
  SET status = 'rewarded', rewards_granted_at = NOW()
  WHERE id = v_referral.id;

  RETURN jsonb_build_object(
    'success', true,
    'activated_count', v_referrer_activated_count,
    'referrer_id', v_referral.referrer_id
  );
END $$;

-- ─── G) Ensure invite code trigger for new users ─────────────────────────────

CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.invite_code IS NULL THEN
    NEW.invite_code := UPPER(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_generate_invite_code ON users;
CREATE TRIGGER trg_generate_invite_code
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION generate_invite_code();
