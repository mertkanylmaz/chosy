-- ============================================================
-- MoodFlix — Gamification Schema
-- 009_gamification.sql
-- Daily streak, milestone tracking, reward system
-- ============================================================

-- ─── user_streaks ───────────────────────────────────────────────────────────
-- Her kullanıcının günlük streak durumu.
-- Bir "aktif gün" = en az 1 swipe (right veya left) yapılan gün.

CREATE TABLE IF NOT EXISTS user_streaks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  current_streak   INTEGER NOT NULL DEFAULT 0,
  longest_streak   INTEGER NOT NULL DEFAULT 0,
  last_active_date DATE,                         -- son swipe yapılan gün (UTC)
  total_active_days INTEGER NOT NULL DEFAULT 0,  -- toplam aktif gün sayısı
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_streaks_user_id ON user_streaks(user_id);

CREATE TRIGGER trg_user_streaks_updated_at
  BEFORE UPDATE ON user_streaks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── milestones ─────────────────────────────────────────────────────────────
-- Sistem tanımlı milestone'lar (sabit kayıtlar).

CREATE TABLE IF NOT EXISTS milestones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,          -- 'films_10', 'films_25', 'streak_7' vb.
  title       TEXT NOT NULL,                 -- "Film Explorer"
  description TEXT,                          -- "You have swiped 10 films!"
  category    TEXT NOT NULL DEFAULT 'films', -- 'films' | 'streak' | 'watchlist' | 'mood'
  threshold   INTEGER NOT NULL,              -- tetiklenme eşiği (10, 25, 50, 100...)
  icon        TEXT,                          -- emoji veya ikon kodu
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── user_milestones ────────────────────────────────────────────────────────
-- Kullanıcının kazandığı milestone'lar.

CREATE TABLE IF NOT EXISTS user_milestones (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  milestone_id UUID NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  achieved_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  seen         BOOLEAN NOT NULL DEFAULT FALSE,  -- kullanıcı kutlamayı gördü mü?
  UNIQUE (user_id, milestone_id)
);

CREATE INDEX IF NOT EXISTS idx_user_milestones_user_id ON user_milestones(user_id);
CREATE INDEX IF NOT EXISTS idx_user_milestones_unseen
  ON user_milestones(user_id) WHERE seen = FALSE;

-- ─── Seed: Varsayılan milestone tanımları ───────────────────────────────────

INSERT INTO milestones (slug, title, description, category, threshold, icon) VALUES
  -- Film swipe milestones
  ('films_10',    'Film Explorer',     'You have swiped through 10 films!',  'films',     10,  '🎬'),
  ('films_25',    'Movie Buff',        '25 films explored. Nice taste!',     'films',     25,  '🍿'),
  ('films_50',    'Cinema Devotee',    '50 films! You are a true cinephile.','films',     50,  '🎥'),
  ('films_100',   'Film Connoisseur',  '100 films! Legendary explorer.',     'films',     100, '🏆'),
  ('films_250',   'Screen Legend',      '250 films — unstoppable!',          'films',     250, '⭐'),

  -- Streak milestones
  ('streak_3',    'Getting Started',   '3 days in a row!',                   'streak',    3,   '🔥'),
  ('streak_7',    'Week Warrior',      'A full week streak!',                'streak',    7,   '💪'),
  ('streak_14',   'Two Week Titan',    '14 days without missing!',           'streak',    14,  '🌟'),
  ('streak_30',   'Monthly Master',    '30 day streak. Incredible!',         'streak',    30,  '👑'),

  -- Watchlist milestones
  ('watchlist_5',  'Curator',          '5 films saved to watchlist.',        'watchlist',  5,   '📋'),
  ('watchlist_20', 'Collection Pro',   '20 saved films. Great collection!',  'watchlist', 20,  '💎'),
  ('watchlist_50', 'Library Builder',  '50 films in your watchlist!',        'watchlist', 50,  '📚'),

  -- Mood milestones
  ('mood_5',      'Mood Explorer',     '5 different moods explored.',        'mood',       5,  '🎭'),
  ('mood_15',     'Emotion Navigator', '15 mood sessions. Deep explorer!',   'mood',      15,  '🧭'),
  ('mood_30',     'Soul Searcher',     '30 mood entries. You know yourself.','mood',      30,  '🔮')
ON CONFLICT (slug) DO NOTHING;

-- ─── RLS Policies ───────────────────────────────────────────────────────────

ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_milestones ENABLE ROW LEVEL SECURITY;

-- user_streaks: kullanıcı sadece kendi streak'ini okuyabilir/güncelleyebilir
CREATE POLICY "user_streaks: owner read"
  ON user_streaks FOR SELECT
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  );

CREATE POLICY "user_streaks: owner upsert"
  ON user_streaks FOR INSERT
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  );

CREATE POLICY "user_streaks: owner update"
  ON user_streaks FOR UPDATE
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  );

-- milestones: herkese açık okuma (sabit veri)
CREATE POLICY "milestones: public read"
  ON milestones FOR SELECT
  USING (true);

CREATE POLICY "milestones: service insert"
  ON milestones FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- user_milestones: kullanıcı sadece kendi milestone'larını okuyabilir/güncelleyebilir
CREATE POLICY "user_milestones: owner read"
  ON user_milestones FOR SELECT
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  );

CREATE POLICY "user_milestones: owner insert"
  ON user_milestones FOR INSERT
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  );

CREATE POLICY "user_milestones: owner update"
  ON user_milestones FOR UPDATE
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  );

-- ─── RPC: update_streak ─────────────────────────────────────────────────────
-- Bir swipe sonrası çağrılır. Streak'i günceller ve yeni milestone kontrolü yapar.
-- Return: { streak_updated, new_milestones[] }

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
  v_result        JSONB := '{"streak_updated": false, "new_milestones": []}'::JSONB;
  v_new_ms        JSONB := '[]'::JSONB;
  v_milestone     RECORD;
BEGIN
  -- Streak kaydını al veya oluştur
  SELECT * INTO v_streak FROM user_streaks WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_active_date, total_active_days)
    VALUES (p_user_id, 1, 1, v_today, 1);

    v_new_streak := 1;
    v_longest := 1;
    v_total_days := 1;
  ELSE
    -- Bugün zaten aktifse bir şey yapma
    IF v_streak.last_active_date = v_today THEN
      v_result := jsonb_build_object(
        'streak_updated', false,
        'current_streak', v_streak.current_streak,
        'longest_streak', v_streak.longest_streak,
        'new_milestones', '[]'::JSONB
      );
      RETURN v_result;
    END IF;

    -- Dün aktifse streak devam eder, değilse sıfırlanır
    IF v_streak.last_active_date = v_yesterday THEN
      v_new_streak := v_streak.current_streak + 1;
    ELSE
      v_new_streak := 1;
    END IF;

    v_longest := GREATEST(v_streak.longest_streak, v_new_streak);
    v_total_days := v_streak.total_active_days + 1;

    UPDATE user_streaks SET
      current_streak = v_new_streak,
      longest_streak = v_longest,
      last_active_date = v_today,
      total_active_days = v_total_days
    WHERE user_id = p_user_id;
  END IF;

  -- Yeni streak milestone kontrolü
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
    'new_milestones', v_new_ms
  );

  RETURN v_result;
END;
$$;

-- ─── RPC: check_milestones ──────────────────────────────────────────────────
-- Genel milestone kontrolü — film sayısı, watchlist boyutu, mood sayısına göre.
-- Swipe sonrası veya periyodik olarak çağrılabilir.

CREATE OR REPLACE FUNCTION check_milestones(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_swipes   INTEGER;
  v_total_watchlist INTEGER;
  v_total_moods    INTEGER;
  v_milestone      RECORD;
  v_new_ms         JSONB := '[]'::JSONB;
  v_count          INTEGER;
BEGIN
  -- Toplam swipe sayısı (sessions üzerinden)
  SELECT COUNT(*) INTO v_total_swipes
  FROM swipes sw
  JOIN sessions s ON s.id = sw.session_id
  WHERE s.user_id = p_user_id;

  -- Toplam watchlist sayısı
  SELECT COUNT(*) INTO v_total_watchlist
  FROM watchlist
  WHERE user_id = p_user_id;

  -- Toplam mood session sayısı
  SELECT COUNT(*) INTO v_total_moods
  FROM sessions
  WHERE user_id = p_user_id;

  -- Her kategori için threshold kontrolü
  FOR v_milestone IN
    SELECT m.id, m.slug, m.title, m.icon, m.category, m.threshold
    FROM milestones m
    WHERE NOT EXISTS (
      SELECT 1 FROM user_milestones um
      WHERE um.user_id = p_user_id AND um.milestone_id = m.id
    )
    AND m.category IN ('films', 'watchlist', 'mood')
  LOOP
    -- Kategoriye göre doğru sayacı seç
    CASE v_milestone.category
      WHEN 'films' THEN v_count := v_total_swipes;
      WHEN 'watchlist' THEN v_count := v_total_watchlist;
      WHEN 'mood' THEN v_count := v_total_moods;
      ELSE v_count := 0;
    END CASE;

    IF v_count >= v_milestone.threshold THEN
      INSERT INTO user_milestones (user_id, milestone_id)
      VALUES (p_user_id, v_milestone.id)
      ON CONFLICT (user_id, milestone_id) DO NOTHING;

      v_new_ms := v_new_ms || jsonb_build_object(
        'slug', v_milestone.slug,
        'title', v_milestone.title,
        'icon', v_milestone.icon
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'total_swipes', v_total_swipes,
    'total_watchlist', v_total_watchlist,
    'total_moods', v_total_moods,
    'new_milestones', v_new_ms
  );
END;
$$;
