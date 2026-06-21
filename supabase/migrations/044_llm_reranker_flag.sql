-- =====================================================================
-- Migration 044: LLM Re-ranker Feature Flag
--
-- Adds use_llm_reranker to app_config for A/B testing the LLM re-rank
-- step that improves thematic relevance of recommendations.
--
-- Default: true (enabled). Client-side SAFE_DEFAULTS = false.
-- =====================================================================

INSERT INTO app_config (key, value, description) VALUES
  ('use_llm_reranker', 'true'::jsonb, 'Enable LLM re-ranking of match_films_v3 results for thematic relevance. false = vector-only ranking.')
ON CONFLICT (key) DO NOTHING;
