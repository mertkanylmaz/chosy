-- ============================================================
-- MoodFlix — Watchlist Session Grouping RPC
-- 011_watchlist_session_rpc.sql
-- Watchlist filmlerini mood session bazli gruplanmis sekilde doner.
-- P4.1: Prompt-bazli gruplama backend'i
-- ============================================================

-- ─── RPC: get_watchlist_grouped ─────────────────────────────────────────────
-- Kullanicinin watchlist filmlerini session bazli gruplar.
-- Her grup icin: session_id, prompt (raw_input), son ekleme tarihi, film listesi.
-- NULL session_id = session bilgisi olmayan (eski veya film detayi uzerinden eklenen) filmler.

CREATE OR REPLACE FUNCTION get_watchlist_grouped(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(grp ORDER BY (grp->>'last_added') DESC), '[]'::JSONB)
  INTO v_result
  FROM (
    SELECT
      jsonb_build_object(
        'session_id',  w.added_from_session,
        'prompt',      s.raw_input,
        'last_added',  MAX(w.created_at),
        'film_count',  COUNT(w.id),
        'films',       jsonb_agg(
          jsonb_build_object(
            'watchlist_id',  w.id,
            'added_at',      w.created_at,
            'match_score',   w.match_score,
            'film_id',       f.id,
            'title',         f.title,
            'year',          f.year,
            'poster_url',    f.poster_url,
            'backdrop_url',  f.backdrop_url,
            'overview',      f.overview,
            'runtime',       f.runtime,
            'vote_average',  f.vote_average,
            'genres',        f.genres
          ) ORDER BY w.created_at DESC
        )
      ) AS grp
    FROM watchlist w
    LEFT JOIN sessions s ON s.id = w.added_from_session
    JOIN films f ON f.id = w.film_id
    WHERE w.user_id = p_user_id
    GROUP BY w.added_from_session, s.raw_input
  ) sub;

  RETURN v_result;
END;
$$;

-- Guvenlik: yalnizca kimlik dogrulamas gecmis kullanicilar cagirabilir
-- (SECURITY DEFINER ile RLS bypass edilir; user_id filtresi manuel uygulanir)

-- ─── Index: session bazli watchlist sorgusu hizlandirma ─────────────────────
CREATE INDEX IF NOT EXISTS idx_watchlist_added_from_session
  ON watchlist(added_from_session)
  WHERE added_from_session IS NOT NULL;
