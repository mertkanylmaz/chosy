-- ============================================================================
-- Cron schedule for Posterle daily curation
-- ============================================================================
-- Run separately AFTER deploying the curate-posterle edge function.
-- Requires pg_cron extension (enable via Supabase dashboard).
-- ============================================================================

-- Enable extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any existing job with the same name (idempotent re-deployment)
SELECT cron.unschedule('posterle-daily-curation')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'posterle-daily-curation'
  );

-- Schedule daily at 23:00 UTC (= 02:00 TRT, 01:00 CET, 18:00 EST)
SELECT cron.schedule(
  'posterle-daily-curation',
  '0 23 * * *',
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/curate-posterle',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    ) AS request_id;
  $$
);

-- ----------------------------------------------------------------------------
-- Required settings (run once per environment)
-- ----------------------------------------------------------------------------
-- ALTER DATABASE postgres
--   SET app.settings.supabase_url = 'https://YOUR-PROJECT.supabase.co';
--
-- ALTER DATABASE postgres
--   SET app.settings.service_role_key = 'YOUR-SERVICE-ROLE-KEY';
