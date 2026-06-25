-- ============================================================
-- MoodFlix — Weekly Trending Sync Cron Job
-- 049_trending_sync_cron.sql
--
-- Schedules sync-trending Edge Function every Monday 06:00 UTC.
-- Uses pg_cron + pg_net (both active).
--
-- Function is deployed with --no-verify-jwt, so no auth header needed.
-- Service role auth happens inside the function via Deno.env secrets.
-- ============================================================

-- Schedule: Every Monday at 06:00 UTC
SELECT cron.schedule(
  'weekly-trending-sync',
  '0 6 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://xpcwihldlnlmyopjubdc.supabase.co/functions/v1/sync-trending',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
