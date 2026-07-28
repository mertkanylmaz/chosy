-- Migration 063: Günlük tema (Cross-Game Knowledge Reinforcement)
--
-- Günün oyunlarından 3-4'ü gizli bir bağlantıyla (yönetmen/oyuncu/tür/dönem/ülke)
-- birbirine bağlanır. Bağlantı yalnızca temalı oyunların hepsi tamamlanınca açılır.
--
-- Hard Rule 1: tema etiketi oynanmamış bir bulmaca için çözüm ipucudur.
-- Bu yüzden tema ne puzzle_data'ya ne public_daily_puzzles view'ına girer;
-- istemci daily_themes tablosuna ASLA erişmez, yalnızca get-daily-theme okur.

-- ─── daily_themes ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS daily_themes (
  theme_date  DATE PRIMARY KEY,
  theme_type  TEXT NOT NULL CHECK (theme_type IN ('director','actor','genre','decade','country')),
  -- Eşleştirme anahtarı (normalize, ör. 'christopher nolan')
  theme_key   TEXT NOT NULL,
  -- Gösterim etiketi (ör. 'Christopher Nolan', '1990s')
  theme_label TEXT NOT NULL,
  -- Reconciliation sonrası GERÇEKTEN eşleşen oyunlar
  game_types  TEXT[] NOT NULL DEFAULT '{}',
  meta        JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Son N günde aynı temanın tekrarını engellemek için
CREATE INDEX IF NOT EXISTS idx_daily_themes_key_date
  ON daily_themes(theme_key, theme_date DESC);

-- RLS: SELECT policy bilerek YOK — istemci erişimi kapalı.
-- Yalnızca service_role (get-daily-theme, generate-puzzles) okur/yazar.
ALTER TABLE daily_themes ENABLE ROW LEVEL SECURITY;

-- ─── daily_puzzles.theme_matched ────────────────────────────────────────────
-- Bulmacanın o günün temasına gerçekten uyup uymadığı.
-- public_daily_puzzles view'ı kolonları açıkça sayar (bkz. 057) — bu kolon
-- view'a girmez, dolayısıyla istemciye sızmaz. View'a EKLENMEMELİDİR.

ALTER TABLE daily_puzzles
  ADD COLUMN IF NOT EXISTS theme_matched BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_daily_puzzles_theme
  ON daily_puzzles(date) WHERE theme_matched = true;

-- ─── app_config: daily_theme_config ─────────────────────────────────────────
-- Lazy getter ile okunur — module-level constant YASAK (Hard Rule 4).
-- quoted bilerek eligible_games dışında: replik havuzu donmuş (Hard Rule 7),
-- film seçimi tema ile yönlendirilemez.

INSERT INTO app_config (key, value, description) VALUES (
  'daily_theme_config',
  '{
    "enabled": true,
    "target_game_count": 4,
    "min_matched_games": 3,
    "repeat_cooldown_days": 14,
    "type_weights": {
      "director": 3,
      "actor": 3,
      "decade": 2,
      "genre": 2,
      "country": 1
    },
    "min_pool_per_type": {
      "director": 4,
      "actor": 4,
      "decade": 6,
      "genre": 6,
      "country": 6
    },
    "eligible_games": ["cinemetrics","logline","spotlight","imposter","fadein","detective"]
  }'::jsonb,
  'Günlük tema: kapsanan oyun sayısı, tema tipi ağırlıkları, minimum havuz eşikleri'
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
