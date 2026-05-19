-- ============================================================================
-- Cron schedule for Posterle daily curation
-- ============================================================================
-- Run separately AFTER deploying the curate-daily-puzzle edge function.
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
-- Chosen so the puzzle is ready BEFORE most users wake up in any timezone.
SELECT cron.schedule(
  'posterle-daily-curation',
  '0 23 * * *', -- minute hour day month weekday
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/curate-daily-puzzle',
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
-- The cron job above reads SUPABASE_URL and SERVICE_ROLE_KEY from PG settings.
-- Set these via the Supabase SQL editor with your project's actual values:
--
-- ALTER DATABASE postgres
--   SET app.settings.supabase_url = 'https://YOUR-PROJECT.supabase.co';
--
-- ALTER DATABASE postgres
--   SET app.settings.service_role_key = 'YOUR-SERVICE-ROLE-KEY';
--
-- Restart database connections after setting (or wait ~30s for new connections).

-- ----------------------------------------------------------------------------
-- Verify schedule
-- ----------------------------------------------------------------------------
-- SELECT jobname, schedule, command, active
-- FROM cron.job
-- WHERE jobname = 'posterle-daily-curation';
--
-- Check recent runs:
-- SELECT * FROM cron.job_run_details
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'posterle-daily-curation')
-- ORDER BY start_time DESC
-- LIMIT 10;

-- ----------------------------------------------------------------------------
-- Manual trigger (for testing or backfill)
-- ----------------------------------------------------------------------------
-- curl -X POST \
--   "https://YOUR-PROJECT.supabase.co/functions/v1/curate-daily-puzzle" \
--   -H "Authorization: Bearer YOUR-SERVICE-ROLE-KEY"
--
-- Backfill a specific date:
-- curl -X POST \
--   "https://YOUR-PROJECT.supabase.co/functions/v1/curate-daily-puzzle?date=2026-05-20" \
--   -H "Authorization: Bearer YOUR-SERVICE-ROLE-KEY"
