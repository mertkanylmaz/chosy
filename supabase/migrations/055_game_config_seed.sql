-- Migration 055: Oyun sistemi config seed'leri
-- XP katsayıları, DNA ağırlıkları, rank eşikleri
-- Tüm değerler lazy getter ile okunur — module-level constant YASAK

INSERT INTO app_config (key, value, description) VALUES
  (
    'game_xp_config',
    '{
      "daily_base": 50,
      "guess_ladder": [100, 85, 70, 55, 45, 35],
      "fail_xp": 10,
      "streak_mult_7": 1.1,
      "streak_mult_30": 1.25,
      "arcade_run_cap": 30,
      "arcade_daily_cap": 90
    }'::jsonb,
    'XP katsayıları: günlük taban, tahmin merdiveni, streak çarpanları, arcade tavanları'
  ),
  (
    'dna_config',
    '{
      "ewma_alpha": 0.15,
      "weights": {
        "knowledge": 0.30,
        "deduction": 0.20,
        "auteur": 0.15,
        "instinct": 0.15,
        "consistency": 0.20
      },
      "rank_thresholds": [0, 20, 35, 50, 65, 80],
      "rank_min_dailies": [0, 5, 15, 30, 60, 100],
      "rank_names": [
        "Movie Lover",
        "Film Explorer",
        "Cinema Apprentice",
        "Film Scholar",
        "Cinephile",
        "Cinema Master"
      ]
    }'::jsonb,
    'Cinema DNA: EWMA alpha, boyut ağırlıkları, rank eşikleri ve isimleri'
  )
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      description = EXCLUDED.description,
      updated_at = now();
