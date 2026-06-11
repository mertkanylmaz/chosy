-- =====================================================================
-- Migration 041: Watchlist Activation Notifications
--
-- Adds watchlist_notifications_enabled to users, plus pg_cron schedules
-- for two patterns: weekend_pick (Friday 15:00 UTC) and mood_recall
-- (Wednesday 17:00 UTC).
-- =====================================================================

-- ─── A) Users tablosuna watchlist_notifications_enabled kolonu ──────────────

ALTER TABLE users ADD COLUMN IF NOT EXISTS
  watchlist_notifications_enabled BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_users_watchlist_notif
  ON users(watchlist_notifications_enabled)
  WHERE push_token IS NOT NULL AND push_enabled = true AND watchlist_notifications_enabled = true;

-- ─── B) notification_log indeks (watchlist activation analytics) ────────────

CREATE INDEX IF NOT EXISTS idx_notif_log_watchlist_activation
  ON notification_log(user_id, type, created_at DESC)
  WHERE type IN ('weekend_pick', 'mood_recall');

-- ─── C) pg_cron: weekend_pick — Cuma 15:00 UTC ─────────────────────────────

-- NOT: current_setting('app.supabase_functions_url') ve
-- current_setting('app.service_role_key') Supabase projelerinde
-- varsayilan olarak set edilmis olmayabilir.
-- Bu durumda asagidaki yorumlu alternatifi kullan.

SELECT cron.schedule(
  'watchlist-activation-weekend',
  '0 15 * * 5',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_functions_url') || '/watchlist-activation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{"pattern":"weekend_pick"}'::jsonb
  );
  $$
);

-- ─── D) pg_cron: mood_recall — Carsamba 17:00 UTC ──────────────────────────

SELECT cron.schedule(
  'watchlist-activation-mood-recall',
  '0 17 * * 3',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_functions_url') || '/watchlist-activation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{"pattern":"mood_recall"}'::jsonb
  );
  $$
);

-- NOT: current_setting calismiyorsa, hardcode URL alternatifi:
--
-- SELECT cron.schedule(
--   'watchlist-activation-weekend',
--   '0 15 * * 5',
--   $$
--   SELECT net.http_post(
--     url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/watchlist-activation',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
--     ),
--     body := '{"pattern":"weekend_pick"}'::jsonb
--   );
--   $$
-- );
--
-- SELECT cron.schedule(
--   'watchlist-activation-mood-recall',
--   '0 17 * * 3',
--   $$
--   SELECT net.http_post(
--     url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/watchlist-activation',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
--     ),
--     body := '{"pattern":"mood_recall"}'::jsonb
--   );
--   $$
-- );
