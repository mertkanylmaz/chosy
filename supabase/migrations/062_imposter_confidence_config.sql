-- Migration 062: Imposter güven bahsi (confidence betting) config'i
-- Oyuncu her round'da %50/%75/%100 güven seçer; XP çarpanı buradan okunur.
-- Formül değil açık map — deploy'suz tune edilebilsin diye.
-- Lazy getter ile okunur (getAppConfig) — module-level constant YASAK.
--
-- %50  = nötr bahis: doğru da yanlış da ×1.0 (varsayılan, bugünkü davranış)
-- %75  = ödül ×1.5 / ceza ×0.5
-- %100 = ödül ×2.0 / ceza ×0.0

INSERT INTO app_config (key, value, description) VALUES
  (
    'imposter_confidence_config',
    '{
      "levels": [50, 75, 100],
      "correct_factor": { "50": 1.0, "75": 1.5, "100": 2.0 },
      "wrong_factor":   { "50": 1.0, "75": 0.5, "100": 0.0 }
    }'::jsonb,
    'Imposter güven bahsi: seçilebilir seviyeler ve doğru/yanlış XP çarpanları'
  )
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      description = EXCLUDED.description,
      updated_at = now();
