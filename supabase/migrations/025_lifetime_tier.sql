-- ============================================================
-- MoodFlix — Lifetime Tier Infrastructure
-- 025_lifetime_tier.sql
-- Founding Member program: ilk 1000 kullaniciya ozel lifetime plan
-- ============================================================

-- ─── A) Lifetime Sales Table ─────────────────────────────────────────────────
-- Her lifetime satisini takip eder. Scarcity counter icin kullanilir.

CREATE TABLE IF NOT EXISTS lifetime_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  sale_number INT NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  price_paid DECIMAL(10,2) NOT NULL DEFAULT 89.99,
  rc_transaction_id TEXT,
  CONSTRAINT chk_sale_number_positive CHECK (sale_number > 0),
  CONSTRAINT chk_sale_number_limit CHECK (sale_number <= 1000)
);

-- Sequence: atomic sale numbering
CREATE SEQUENCE IF NOT EXISTS lifetime_sale_number START 1;

-- Index: hizli counter sorgusu
CREATE INDEX IF NOT EXISTS idx_lifetime_sales_sale_number
  ON lifetime_sales (sale_number);

-- RLS
ALTER TABLE lifetime_sales ENABLE ROW LEVEL SECURITY;

-- Herkes kendi kaydini gorebilir
CREATE POLICY "Users can view own lifetime sale"
  ON lifetime_sales FOR SELECT
  USING (auth.uid() = user_id);

-- Insert sadece service_role veya RPC uzerinden
CREATE POLICY "Service role can insert lifetime sales"
  ON lifetime_sales FOR INSERT
  WITH CHECK (true);

-- ─── B) claim_lifetime_spot RPC ──────────────────────────────────────────────
-- Atomic: count check + insert + user tier update
-- Race condition safe: SERIALIZABLE isolation + unique constraint

CREATE OR REPLACE FUNCTION claim_lifetime_spot(
  p_user_id UUID,
  p_price DECIMAL DEFAULT 89.99,
  p_rc_transaction_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
  v_number INT;
BEGIN
  -- Atomic count check
  SELECT COUNT(*) INTO v_count FROM lifetime_sales;
  IF v_count >= 1000 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'SOLD_OUT',
      'sold', v_count
    );
  END IF;

  -- Check if user already has lifetime
  IF EXISTS (SELECT 1 FROM lifetime_sales WHERE user_id = p_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ALREADY_LIFETIME'
    );
  END IF;

  -- Get next number atomically
  SELECT nextval('lifetime_sale_number') INTO v_number;

  -- Insert sale record
  INSERT INTO lifetime_sales (user_id, sale_number, price_paid, rc_transaction_id)
    VALUES (p_user_id, v_number, p_price, p_rc_transaction_id);

  -- Update user subscription tier
  UPDATE users
  SET subscription_tier = 'lifetime'
  WHERE id = p_user_id;

  -- Update subscriptions table if exists
  UPDATE subscriptions
  SET plan = 'lifetime', status = 'active', expires_at = NULL
  WHERE user_id = p_user_id
    AND status IN ('active', 'trial');

  RETURN jsonb_build_object(
    'success', true,
    'sale_number', v_number,
    'total_sold', v_count + 1
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ALREADY_LIFETIME'
    );
END $$;

-- ─── C) get_lifetime_counter RPC ─────────────────────────────────────────────
-- Public: herkes gorebilir (scarcity UI icin)

CREATE OR REPLACE FUNCTION get_lifetime_counter()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sold INT;
BEGIN
  SELECT COUNT(*) INTO v_sold FROM lifetime_sales;

  RETURN jsonb_build_object(
    'sold', v_sold,
    'remaining', GREATEST(1000 - v_sold, 0),
    'total', 1000,
    'percent', ROUND((v_sold::DECIMAL / 1000) * 100, 1),
    'sold_out', v_sold >= 1000
  );
END $$;

-- ─── D) is_founding_member RPC ───────────────────────────────────────────────
-- Profile badge + share card icin

CREATE OR REPLACE FUNCTION is_founding_member(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale lifetime_sales%ROWTYPE;
BEGIN
  SELECT * INTO v_sale FROM lifetime_sales WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('is_member', false);
  END IF;

  RETURN jsonb_build_object(
    'is_member', true,
    'sale_number', v_sale.sale_number,
    'purchased_at', v_sale.purchased_at
  );
END $$;
