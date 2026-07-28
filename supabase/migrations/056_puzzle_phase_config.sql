-- Migration 056: Bulmaca faz konfigürasyonu
-- İlk 50 gün: yalnızca çok popüler filmler (vote_count >= 15000)
-- 51-150 gün: popüler filmler (>= 5000)
-- 151+ gün: geniş havuz (>= 3000)

INSERT INTO app_config (key, value, description) VALUES (
  'puzzle_phase_config',
  '{
    "phases": [
      {"from_day": 1,   "to_day": 50,  "min_vote_count": 15000},
      {"from_day": 51,  "to_day": 150, "min_vote_count": 5000},
      {"from_day": 151, "to_day": 9999,"min_vote_count": 3000}
    ]
  }'::jsonb,
  'Bulmaca film havuzu faz konfigürasyonu: gün aralığına göre minimum vote_count eşiği'
) ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      description = EXCLUDED.description,
      updated_at = now();
