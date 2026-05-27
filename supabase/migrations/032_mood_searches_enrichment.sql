-- =====================================================================
-- TASK 1.A — mood_searches tablosu enrichment
-- Amac: Production debugging icin her aramayi tam log'lamak
-- Geriye uyumlu: mevcut kolonlar (id, user_id, searched_at) korunur
-- =====================================================================

-- Yeni kolonlar (hepsi nullable, mevcut satirlar etkilenmez)
ALTER TABLE public.mood_searches
  ADD COLUMN IF NOT EXISTS mood_text TEXT,
  ADD COLUMN IF NOT EXISTS parsed_profile JSONB,
  ADD COLUMN IF NOT EXISTS query_vector_preview TEXT,
  ADD COLUMN IF NOT EXISTS recommended_film_ids UUID[],
  ADD COLUMN IF NOT EXISTS rpc_version TEXT,
  ADD COLUMN IF NOT EXISTS latency_ms INTEGER,
  ADD COLUMN IF NOT EXISTS tier_used INTEGER,
  ADD COLUMN IF NOT EXISTS cache_hit BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ADD COLUMN IF NOT EXISTS llm_tokens_in INTEGER,
  ADD COLUMN IF NOT EXISTS llm_tokens_out INTEGER;

-- Index'ler (analytics icin)
CREATE INDEX IF NOT EXISTS idx_mood_searches_searched_at
  ON public.mood_searches (searched_at DESC);

CREATE INDEX IF NOT EXISTS idx_mood_searches_user_searched
  ON public.mood_searches (user_id, searched_at DESC);

CREATE INDEX IF NOT EXISTS idx_mood_searches_error_code
  ON public.mood_searches (error_code)
  WHERE error_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mood_searches_cache_hit
  ON public.mood_searches (cache_hit, searched_at DESC);

COMMENT ON COLUMN public.mood_searches.mood_text IS
  'Raw user input (max 500 char, validated)';
COMMENT ON COLUMN public.mood_searches.parsed_profile IS
  'parse-mood Claude output (12-dim + v4 fields)';
COMMENT ON COLUMN public.mood_searches.query_vector_preview IS
  'First 100 chars of vector for debugging';
COMMENT ON COLUMN public.mood_searches.recommended_film_ids IS
  'Top N films returned by match_films RPC';
COMMENT ON COLUMN public.mood_searches.rpc_version IS
  'match_films | match_films_v2';
COMMENT ON COLUMN public.mood_searches.latency_ms IS
  'Total time from edge function request to response';
COMMENT ON COLUMN public.mood_searches.tier_used IS
  '1=vector-only, 2=LLM-light, 3=LLM-full';
COMMENT ON COLUMN public.mood_searches.cache_hit IS
  'TRUE if served from mood_cache (future)';
COMMENT ON COLUMN public.mood_searches.error_code IS
  'QUOTA_EXCEEDED | INVALID_INPUT | PARSE_FAILED | CONFIG_ERROR | null on success';
COMMENT ON COLUMN public.mood_searches.llm_tokens_in IS
  'Claude API input tokens';
COMMENT ON COLUMN public.mood_searches.llm_tokens_out IS
  'Claude API output tokens';

-- UPDATE RLS politikasi — client-side recommendations.ts mood_searches'i
-- guncelleyebilsin (recommended_film_ids, rpc_version)
DROP POLICY IF EXISTS "Users can update own mood searches" ON mood_searches;
CREATE POLICY "Users can update own mood searches"
  ON mood_searches FOR UPDATE
  USING (user_id = auth_user_id());

-- Service role icin GRANT (edge function insert + view query)
GRANT SELECT, INSERT, UPDATE ON public.mood_searches TO service_role;

-- Read-only view — production debugging (son 7 gun)
CREATE OR REPLACE VIEW public.v_mood_searches_recent AS
SELECT
  ms.id,
  ms.user_id,
  ms.searched_at,
  ms.mood_text,
  ms.tier_used,
  ms.cache_hit,
  ms.rpc_version,
  ms.latency_ms,
  ms.llm_tokens_in,
  ms.llm_tokens_out,
  ms.error_code,
  ms.parsed_profile->'concept_tags' AS concept_tags,
  ms.parsed_profile->'profile_name' AS profile_name,
  array_length(ms.recommended_film_ids, 1) AS result_count
FROM public.mood_searches ms
WHERE ms.searched_at >= NOW() - INTERVAL '7 days'
ORDER BY ms.searched_at DESC;

GRANT SELECT ON public.v_mood_searches_recent TO authenticated, service_role;
