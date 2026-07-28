-- Migration 058: Streak freeze sistemi
-- Rank 5+ (Cinephile) kullanıcılar ayda 2 streak freeze hakkı kazanır.
-- Streak kırılacaksa otomatik olarak freeze kullanılır.

-- ─── Kolon ekle ────────────────────────────────────────────────────────────
ALTER TABLE user_streaks
  ADD COLUMN IF NOT EXISTS streak_freezes_remaining INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_freeze_grant DATE;

-- ─── Config seed ───────────────────────────────────────────────────────────
INSERT INTO app_config (key, value, description) VALUES
  (
    'streak_freeze_config',
    '{
      "freezes_per_month": 2,
      "min_rank_index": 4,
      "max_freezes": 4
    }'::jsonb,
    'Streak freeze: ayda kaç freeze, minimum rank index (0-based), maksimum birikim'
  )
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      description = EXCLUDED.description,
      updated_at = now();

-- ─── update_streak v2: freeze desteği ──────────────────────────────────────
CREATE OR REPLACE FUNCTION update_streak(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today         DATE := CURRENT_DATE;
  v_yesterday     DATE := CURRENT_DATE - INTERVAL '1 day';
  v_streak        RECORD;
  v_new_streak    INTEGER;
  v_longest       INTEGER;
  v_total_days    INTEGER;
  v_freeze_used   BOOLEAN := false;
  v_freezes_left  INTEGER := 0;
  v_result        JSONB := '{"streak_updated": false, "new_milestones": []}'::JSONB;
  v_new_ms        JSONB := '[]'::JSONB;
  v_milestone     RECORD;
  -- Freeze grant
  v_freeze_cfg    JSONB;
  v_dna_cfg       JSONB;
  v_rank_index    INTEGER;
  v_user_dna_avg  NUMERIC;
  v_user_dailies  INTEGER;
  v_rank_thresholds JSONB;
  v_rank_min_dailies JSONB;
  v_month_start   DATE;
BEGIN
  -- Streak kaydını al veya oluştur
  SELECT * INTO v_streak FROM user_streaks WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_active_date, total_active_days)
    VALUES (p_user_id, 1, 1, v_today, 1);

    v_new_streak := 1;
    v_longest := 1;
    v_total_days := 1;
    v_freezes_left := 0;
  ELSE
    -- Bugün zaten aktifse bir şey yapma
    IF v_streak.last_active_date = v_today THEN
      v_result := jsonb_build_object(
        'streak_updated', false,
        'current_streak', v_streak.current_streak,
        'longest_streak', v_streak.longest_streak,
        'freeze_used', false,
        'freezes_remaining', v_streak.streak_freezes_remaining,
        'new_milestones', '[]'::JSONB
      );
      RETURN v_result;
    END IF;

    -- Dün aktifse streak devam eder
    IF v_streak.last_active_date = v_yesterday THEN
      v_new_streak := v_streak.current_streak + 1;
    -- Dün aktif değilse: freeze var mı?
    ELSIF v_streak.streak_freezes_remaining > 0 AND v_streak.current_streak > 0 THEN
      -- Freeze kullan — streak korunur
      v_new_streak := v_streak.current_streak + 1;
      v_freeze_used := true;
      v_freezes_left := v_streak.streak_freezes_remaining - 1;
    ELSE
      -- Streak kırılır
      v_new_streak := 1;
    END IF;

    IF NOT v_freeze_used THEN
      v_freezes_left := v_streak.streak_freezes_remaining;
    END IF;

    v_longest := GREATEST(v_streak.longest_streak, v_new_streak);
    v_total_days := v_streak.total_active_days + 1;

    UPDATE user_streaks SET
      current_streak = v_new_streak,
      longest_streak = v_longest,
      last_active_date = v_today,
      total_active_days = v_total_days,
      streak_freezes_remaining = v_freezes_left
    WHERE user_id = p_user_id;
  END IF;

  -- ─── Aylık freeze grant kontrolü ──────────────────────────────────────
  v_month_start := date_trunc('month', v_today)::DATE;

  SELECT * INTO v_streak FROM user_streaks WHERE user_id = p_user_id;

  IF v_streak.last_freeze_grant IS NULL OR v_streak.last_freeze_grant < v_month_start THEN
    -- Kullanıcının rank'ını hesapla
    SELECT value INTO v_freeze_cfg FROM app_config WHERE key = 'streak_freeze_config';
    SELECT value INTO v_dna_cfg FROM app_config WHERE key = 'dna_config';

    IF v_freeze_cfg IS NOT NULL AND v_dna_cfg IS NOT NULL THEN
      v_rank_thresholds := v_dna_cfg->'rank_thresholds';
      v_rank_min_dailies := v_dna_cfg->'rank_min_dailies';

      -- DNA ortalaması
      SELECT COALESCE(
        (knowledge + deduction + visual_sense + auteur_sense + instinct) / 5.0,
        0
      ) INTO v_user_dna_avg
      FROM cinema_dna WHERE user_id = p_user_id;

      -- Tamamlanan günlük sayısı
      SELECT COUNT(DISTINCT puzzle_id) INTO v_user_dailies
      FROM game_scores
      WHERE user_id = p_user_id AND completed_at IS NOT NULL;

      v_user_dna_avg := COALESCE(v_user_dna_avg, 0);
      v_user_dailies := COALESCE(v_user_dailies, 0);

      -- Rank index hesapla (en yüksek eşiği geçen)
      v_rank_index := 0;
      FOR i IN 0..5 LOOP
        IF v_user_dna_avg >= (v_rank_thresholds->>i)::NUMERIC
           AND v_user_dailies >= (v_rank_min_dailies->>i)::INTEGER THEN
          v_rank_index := i;
        END IF;
      END LOOP;

      -- Yeterli rank'ta mı?
      IF v_rank_index >= (v_freeze_cfg->>'min_rank_index')::INTEGER THEN
        v_freezes_left := LEAST(
          v_freezes_left + (v_freeze_cfg->>'freezes_per_month')::INTEGER,
          (v_freeze_cfg->>'max_freezes')::INTEGER
        );

        UPDATE user_streaks SET
          streak_freezes_remaining = v_freezes_left,
          last_freeze_grant = v_today
        WHERE user_id = p_user_id;
      END IF;
    END IF;
  END IF;

  -- ─── Milestone kontrolü ───────────────────────────────────────────────
  FOR v_milestone IN
    SELECT m.id, m.slug, m.title, m.icon, m.threshold
    FROM milestones m
    WHERE m.category = 'streak'
      AND m.threshold <= v_new_streak
      AND NOT EXISTS (
        SELECT 1 FROM user_milestones um
        WHERE um.user_id = p_user_id AND um.milestone_id = m.id
      )
  LOOP
    INSERT INTO user_milestones (user_id, milestone_id)
    VALUES (p_user_id, v_milestone.id)
    ON CONFLICT (user_id, milestone_id) DO NOTHING;

    v_new_ms := v_new_ms || jsonb_build_object(
      'slug', v_milestone.slug,
      'title', v_milestone.title,
      'icon', v_milestone.icon
    );
  END LOOP;

  v_result := jsonb_build_object(
    'streak_updated', true,
    'current_streak', v_new_streak,
    'longest_streak', v_longest,
    'total_active_days', v_total_days,
    'freeze_used', v_freeze_used,
    'freezes_remaining', v_freezes_left,
    'new_milestones', v_new_ms
  );

  RETURN v_result;
END;
$$;
