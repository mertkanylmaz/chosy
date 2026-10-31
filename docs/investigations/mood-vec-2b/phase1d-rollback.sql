-- MOOD-VEC-2b Faz 1D: phase1d-apply.sql'in geri alması. HAZIRLANDI, ÇALIŞTIRILMADI.
-- UPDATE yalnız uygulanan değerleri taşıyan satırı eski haline (oy 144, tier archive) döndürür.

BEGIN;

-- Burning Days (2022, A, 7.5/15259; eski DB oyu 144) → extended
UPDATE films SET imdb_votes = 144, curation_tier = 'archive' WHERE id = '937fd106-34d1-49cf-a34a-bb3045c4d91d' AND curation_tier = 'extended' AND imdb_votes = 15259;

COMMIT;
