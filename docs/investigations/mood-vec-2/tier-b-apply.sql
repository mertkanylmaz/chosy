-- MOOD-VEC-2b: tier kuralı B — 6 filmi arşive alır (30 Eki 2026). HAZIRLANDI, ÇALIŞTIRILMADI.
-- Yalnız films.curation_tier değişir. Her UPDATE mevcut tier'ı da doğrular (kayma varsa 0 satır).
-- Beklenen: 6 UPDATE × 1 satır. Geri alma: tier-b-rollback.sql.

BEGIN;

-- Yedek: değişecek 6 filmin önceki tier'ı. Tablo zaten varsa bu satır hata verir ve işlem durur (üzerine yazma yok).
CREATE TABLE films_tier_b_backup_20261030 AS
  SELECT id, curation_tier FROM films WHERE id IN ('f82060d0-a2f9-455c-afcc-2a22b3c6966b', 'c1a8b975-3602-41f8-84d2-10e518ce1a9e', '4a370d13-9c8c-4741-a94b-c7a3055cbcb1', '09c776d8-e3c0-4385-a8c3-3e09e810d2b2', '937fd106-34d1-49cf-a34a-bb3045c4d91d', '86fe70b3-8fb3-461f-aa8c-0b4834ff0a38');
ALTER TABLE films_tier_b_backup_20261030 ENABLE ROW LEVEL SECURITY;

-- Ice Cream Man
UPDATE films SET curation_tier = 'archive' WHERE id = 'f82060d0-a2f9-455c-afcc-2a22b3c6966b' AND curation_tier = 'trending';
-- Surviving Hurricane Otis
UPDATE films SET curation_tier = 'archive' WHERE id = 'c1a8b975-3602-41f8-84d2-10e518ce1a9e' AND curation_tier = 'trending';
-- Other Mommy
UPDATE films SET curation_tier = 'archive' WHERE id = '4a370d13-9c8c-4741-a94b-c7a3055cbcb1' AND curation_tier = 'trending';
-- Masterplan
UPDATE films SET curation_tier = 'archive' WHERE id = '09c776d8-e3c0-4385-a8c3-3e09e810d2b2' AND curation_tier = 'trending';
-- Burning Days
UPDATE films SET curation_tier = 'archive' WHERE id = '937fd106-34d1-49cf-a34a-bb3045c4d91d' AND curation_tier = 'extended';
-- Beyond the Hill
UPDATE films SET curation_tier = 'archive' WHERE id = '86fe70b3-8fb3-461f-aa8c-0b4834ff0a38' AND curation_tier = 'extended';

COMMIT;
