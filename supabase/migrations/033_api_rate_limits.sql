-- =====================================================================
-- api_rate_limits tablosu -- IP/user bazli rate limiting
-- _shared/rateLimit.ts ARTIK calisacak
--
-- IMPORTANT: Column names MUST match _shared/rateLimit.ts expectations:
--   user_id, function_name, window_start, request_count, updated_at
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,              -- auth.uid or 'anon'
  function_name TEXT NOT NULL,        -- 'parse-mood', 'explain-match', etc
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Composite unique for upsert (matches rateLimit.ts onConflict)
  UNIQUE (user_id, function_name, window_start)
);

-- Performans index'leri
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
  ON public.api_rate_limits (user_id, function_name, window_start DESC);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window_cleanup
  ON public.api_rate_limits (window_start);

-- Eski kayitlari temizleme fonksiyonu (cron icin)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.api_rate_limits
  WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$;

-- RLS -- sadece service role yazabilir, kullanici okuyamaz
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON public.api_rate_limits
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE public.api_rate_limits IS
  'Rate limit counter table -- used by _shared/rateLimit.ts in edge functions';

-- pg_cron schedule (eger extension varsa)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup-rate-limits',
      '0 * * * *',
      'SELECT public.cleanup_rate_limits();'
    );
  END IF;
END $$;
