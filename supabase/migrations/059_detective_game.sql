-- Migration 059: Chosy Detective oyun sistemi
-- CineMetrics + Spotlight birlesimi: 3 asamali gunluk dedektiflik oyunu

-- 1. detective_score kolonu (composite skor 0-1000)
ALTER TABLE game_scores
  ADD COLUMN IF NOT EXISTS detective_score INTEGER;

-- 2. Gunluk siralama view (percentile hesabi icin)
CREATE OR REPLACE VIEW detective_daily_scores AS
  SELECT
    gs.user_id,
    dp.date AS puzzle_date,
    gs.detective_score,
    gs.solved,
    gs.completed_at,
    gs.xp_awarded,
    gs.progress_json
  FROM game_scores gs
  JOIN daily_puzzles dp ON dp.id = gs.puzzle_id
  WHERE dp.game_type = 'detective'
    AND gs.completed_at IS NOT NULL
    AND gs.detective_score IS NOT NULL;

-- 3. Percentile fonksiyonu — oyuncunun gunluk siralamadaki yuzdelik dilimini doner
CREATE OR REPLACE FUNCTION detective_percentile(
  p_puzzle_date DATE,
  p_score INTEGER
) RETURNS NUMERIC AS $$
  SELECT COALESCE(
    round(
      (SELECT COUNT(*)::NUMERIC FROM detective_daily_scores
       WHERE puzzle_date = p_puzzle_date AND detective_score <= p_score)
      / NULLIF(
        (SELECT COUNT(*) FROM detective_daily_scores
         WHERE puzzle_date = p_puzzle_date), 0
      ) * 100
    ),
    50
  );
$$ LANGUAGE SQL STABLE;

-- 4. Community distribution fonksiyonu — tahmin sayisi dagilimi (histogram)
CREATE OR REPLACE FUNCTION detective_distribution(p_puzzle_date DATE)
RETURNS JSONB AS $$
  SELECT COALESCE(
    jsonb_object_agg(bucket, cnt),
    '{}'::jsonb
  )
  FROM (
    SELECT
      CASE
        WHEN NOT gs.solved THEN 0
        ELSE LEAST(
          COALESCE((gs.progress_json->>'total_guesses')::int, gs.attempts),
          12
        )
      END AS bucket,
      COUNT(*) AS cnt
    FROM game_scores gs
    JOIN daily_puzzles dp ON dp.id = gs.puzzle_id
    WHERE dp.game_type = 'detective'
      AND dp.date = p_puzzle_date
      AND gs.completed_at IS NOT NULL
    GROUP BY bucket
  ) sub;
$$ LANGUAGE SQL STABLE;
