-- ============================================================================
-- Migration 023: Paywall Events — Conversion funnel tracking + A/B testing
-- ============================================================================

-- Contextual paywall gosterim, dismiss, conversion ve trial event'lerini kaydeder.
-- A/B test group'lari da burada loglanir.

CREATE TABLE IF NOT EXISTS paywall_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  variant TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_context JSONB DEFAULT '{}',
  action TEXT NOT NULL CHECK (action IN ('shown', 'dismissed', 'converted', 'trial_started')),
  ab_test_group TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index: kullanici bazli sorgular
CREATE INDEX IF NOT EXISTS idx_paywall_events_user_id ON paywall_events(user_id);

-- Index: variant bazli analiz
CREATE INDEX IF NOT EXISTS idx_paywall_events_variant ON paywall_events(variant, action);

-- Index: A/B test analizi
CREATE INDEX IF NOT EXISTS idx_paywall_events_ab_group ON paywall_events(ab_test_group, variant, action);

-- Index: zaman bazli sorgular
CREATE INDEX IF NOT EXISTS idx_paywall_events_created ON paywall_events(created_at DESC);

-- RLS
ALTER TABLE paywall_events ENABLE ROW LEVEL SECURITY;

-- Kullanicilar kendi event'lerini yazabilir
CREATE POLICY "Users can insert own paywall events"
  ON paywall_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Kullanicilar kendi event'lerini okuyabilir
CREATE POLICY "Users can read own paywall events"
  ON paywall_events FOR SELECT
  USING (auth.uid() = user_id);
