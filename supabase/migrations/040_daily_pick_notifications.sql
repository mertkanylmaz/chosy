-- =====================================================================
-- Migration 040: Daily Cinema Pick Notifications
--
-- Adds daily_pick_enabled to users table, notification_log analytics
-- index for daily_pick type, and pg_cron schedule for hourly trigger.
-- =====================================================================

-- ─── A) Users tablosuna daily_pick_enabled kolonu ────────────────────────────

ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_pick_enabled BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_daily_pick_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_daily_pick
  ON users(daily_pick_enabled, preferred_notification_hour)
  WHERE push_token IS NOT NULL AND push_enabled = true AND daily_pick_enabled = true;

-- ─── B) notification_log ek indeks (daily_pick analytics) ────────────────────

CREATE INDEX IF NOT EXISTS idx_notif_log_daily_pick_30d
  ON notification_log(user_id, type, created_at DESC)
  WHERE type = 'daily_pick';

-- ─── C) pg_cron: send-daily-pick hourly trigger ─────────────────────────────

-- NOT: pg_cron + pg_net uzantilari Supabase'te varsayilan olarak aktif.
-- current_setting calismiyorsa hardcode URL kullanilmali — deploy sonrasi kontrol et.
-- Bu schedule Supabase Dashboard > SQL Editor'den de calistirilabilir.

SELECT cron.schedule(
  'send-daily-pick-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_functions_url') || '/send-daily-pick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- NOT: current_setting('app.supabase_functions_url') ve current_setting('app.service_role_key')
-- Supabase projelerinde varsayilan olarak set edilmis olmayabilir.
-- Bu durumda asagidaki alternatifi kullan (URL ve key'i Supabase Dashboard'tan al):
--
-- SELECT cron.schedule(
--   'send-daily-pick-hourly',
--   '0 * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-daily-pick',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );
