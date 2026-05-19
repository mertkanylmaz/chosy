-- ============================================================
-- MoodFlix — Webhook Support Columns
-- 027_webhook_columns.sql
-- RevenueCat webhook handler icin users tablosuna ek kolonlar
-- ============================================================

-- ─── A) Users tablosuna webhook kolonlari ─────────────────────────────────────
-- subscription_active_until: aboneliğin bitiş tarihi (lifetime = NULL)
-- subscription_will_renew: otomatik yenileme durumu (cancel = false)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subscription_active_until TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS subscription_will_renew BOOLEAN DEFAULT TRUE;

-- ─── B) Winback queue tablosu ──────────────────────────────────────────────────
-- Churn olan kullanicilari takip eder, winback-sequencer tarafindan kullanilir

CREATE TABLE IF NOT EXISTS winback_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  churned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_winback_queue_user
  ON winback_queue (user_id);

CREATE INDEX IF NOT EXISTS idx_winback_queue_unprocessed
  ON winback_queue (processed) WHERE NOT processed;

-- RLS
ALTER TABLE winback_queue ENABLE ROW LEVEL SECURITY;

-- Service role only (webhook'tan yazilir)
CREATE POLICY "Service role manages winback queue"
  ON winback_queue FOR ALL
  USING (true)
  WITH CHECK (true);

-- ─── C) Notification log tablosu (yoksa olustur) ──────────────────────────────
-- Webhook billing_issue vb. icin

CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT,
  body TEXT,
  data JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued',
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_user
  ON notification_log (user_id);

CREATE INDEX IF NOT EXISTS idx_notification_log_status
  ON notification_log (status) WHERE status = 'queued';
