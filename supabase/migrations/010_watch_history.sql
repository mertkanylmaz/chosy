-- ============================================================
-- MoodFlix — Watch History & Stats Support
-- 010_watch_history.sql
-- Swipe geçmişi sorguları ve istatistik hesaplama desteği
-- ============================================================

-- ─── swipes tablosuna user erişimi kolaylaştırmak için view ─────────────────
-- Mevcut swipes → sessions → users JOIN'ini basitleştirir.

CREATE OR REPLACE VIEW user_swipe_history AS
SELECT
  sw.id AS swipe_id,
  s.user_id,
  sw.film_id,
  sw.direction,
  sw.timestamp AS swiped_at,
  s.id AS session_id,
  s.raw_input AS mood_text
FROM swipes sw
JOIN sessions s ON s.id = sw.session_id;

-- ─── Performans indexleri ───────────────────────────────────────────────────

-- Swipe timestamp'ına göre sıralama (son swipe'lar önce)
CREATE INDEX IF NOT EXISTS idx_swipes_timestamp ON swipes(timestamp DESC);

-- Session bazlı swipe sayısı sorguları
CREATE INDEX IF NOT EXISTS idx_swipes_direction ON swipes(direction);

-- ─── RPC: get_user_stats ────────────────────────────────────────────────────
-- Kullanıcının genel istatistiklerini tek sorguda döner.

CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_swipes     INTEGER;
  v_right_swipes     INTEGER;
  v_left_swipes      INTEGER;
  v_total_watchlist  INTEGER;
  v_total_sessions   INTEGER;
  v_genre_counts     JSONB;
  v_first_swipe      TIMESTAMPTZ;
  v_streak           RECORD;
BEGIN
  -- Swipe sayıları
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE sw.direction = 'right'),
    COUNT(*) FILTER (WHERE sw.direction = 'left'),
    MIN(sw.timestamp)
  INTO v_total_swipes, v_right_swipes, v_left_swipes, v_first_swipe
  FROM swipes sw
  JOIN sessions s ON s.id = sw.session_id
  WHERE s.user_id = p_user_id;

  -- Watchlist boyutu
  SELECT COUNT(*) INTO v_total_watchlist
  FROM watchlist WHERE user_id = p_user_id;

  -- Toplam mood session
  SELECT COUNT(*) INTO v_total_sessions
  FROM sessions WHERE user_id = p_user_id;

  -- Tür dağılımı (sağa kaydırılan filmlerden)
  SELECT COALESCE(jsonb_object_agg(genre, cnt), '{}'::JSONB)
  INTO v_genre_counts
  FROM (
    SELECT unnest(f.genres) AS genre, COUNT(*) AS cnt
    FROM swipes sw
    JOIN sessions s ON s.id = sw.session_id
    JOIN films f ON f.id = sw.film_id
    WHERE s.user_id = p_user_id
      AND sw.direction = 'right'
      AND f.genres IS NOT NULL
    GROUP BY genre
    ORDER BY cnt DESC
    LIMIT 10
  ) sub;

  -- Streak bilgisi
  SELECT current_streak, longest_streak, total_active_days, last_active_date
  INTO v_streak
  FROM user_streaks
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'total_swipes',       v_total_swipes,
    'right_swipes',       v_right_swipes,
    'left_swipes',        v_left_swipes,
    'save_rate',          CASE WHEN v_total_swipes > 0
                            THEN ROUND((v_right_swipes::NUMERIC / v_total_swipes) * 100, 1)
                            ELSE 0
                          END,
    'total_watchlist',    v_total_watchlist,
    'total_sessions',     v_total_sessions,
    'first_swipe_at',     v_first_swipe,
    'top_genres',         v_genre_counts,
    'current_streak',     COALESCE(v_streak.current_streak, 0),
    'longest_streak',     COALESCE(v_streak.longest_streak, 0),
    'total_active_days',  COALESCE(v_streak.total_active_days, 0),
    'last_active_date',   v_streak.last_active_date
  );
END;
$$;

-- ─── RPC: get_swipe_history ─────────────────────────────────────────────────
-- Sayfalanmış swipe geçmişi (film bilgisiyle birlikte)

CREATE OR REPLACE FUNCTION get_swipe_history(
  p_user_id UUID,
  p_limit   INTEGER DEFAULT 20,
  p_offset  INTEGER DEFAULT 0,
  p_direction TEXT DEFAULT NULL   -- NULL=hepsi, 'right'=kaydedilenler, 'left'=atlananlar
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items JSONB;
  v_total INTEGER;
BEGIN
  -- Toplam kayıt sayısı (sayfalama için)
  SELECT COUNT(*) INTO v_total
  FROM swipes sw
  JOIN sessions s ON s.id = sw.session_id
  WHERE s.user_id = p_user_id
    AND (p_direction IS NULL OR sw.direction = p_direction);

  -- Sayfalanmış sonuçlar
  SELECT COALESCE(jsonb_agg(item ORDER BY item->>'swiped_at' DESC), '[]'::JSONB)
  INTO v_items
  FROM (
    SELECT jsonb_build_object(
      'swipe_id',    sw.id,
      'film_id',     f.id,
      'title',       f.title,
      'year',        f.year,
      'poster_url',  f.poster_url,
      'vote_average',f.vote_average,
      'genres',      f.genres,
      'direction',   sw.direction,
      'swiped_at',   sw.timestamp,
      'mood_text',   s.raw_input
    ) AS item
    FROM swipes sw
    JOIN sessions s ON s.id = sw.session_id
    JOIN films f ON f.id = sw.film_id
    WHERE s.user_id = p_user_id
      AND (p_direction IS NULL OR sw.direction = p_direction)
    ORDER BY sw.timestamp DESC
    LIMIT p_limit
    OFFSET p_offset
  ) sub;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'limit', p_limit,
    'offset', p_offset
  );
END;
$$;

-- ─── RPC: get_mood_timeline ─────────────────────────────────────────────────
-- Kullanıcının mood geçmişi (tarih + mood metni + profil özeti)

CREATE OR REPLACE FUNCTION get_mood_timeline(
  p_user_id UUID,
  p_limit   INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(item ORDER BY item->>'created_at' DESC), '[]'::JSONB)
  INTO v_items
  FROM (
    SELECT jsonb_build_object(
      'session_id',  s.id,
      'mood_text',   s.raw_input,
      'profile',     s.parsed_profile_json,
      'created_at',  s.created_at,
      'swipe_count', (
        SELECT COUNT(*) FROM swipes sw WHERE sw.session_id = s.id
      ),
      'save_count', (
        SELECT COUNT(*) FROM swipes sw WHERE sw.session_id = s.id AND sw.direction = 'right'
      )
    ) AS item
    FROM sessions s
    WHERE s.user_id = p_user_id
    ORDER BY s.created_at DESC
    LIMIT p_limit
  ) sub;

  RETURN v_items;
END;
$$;
