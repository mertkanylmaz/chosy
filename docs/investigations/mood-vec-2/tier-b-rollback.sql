-- MOOD-VEC-2b: tier-b-apply.sql'in geri alması. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Her UPDATE yalnız hâlâ 'archive' olan satırı eski tier'ına döndürür.

BEGIN;

-- Ice Cream Man
UPDATE films SET curation_tier = 'trending' WHERE id = 'f82060d0-a2f9-455c-afcc-2a22b3c6966b' AND curation_tier = 'archive';
-- Surviving Hurricane Otis
UPDATE films SET curation_tier = 'trending' WHERE id = 'c1a8b975-3602-41f8-84d2-10e518ce1a9e' AND curation_tier = 'archive';
-- Other Mommy
UPDATE films SET curation_tier = 'trending' WHERE id = '4a370d13-9c8c-4741-a94b-c7a3055cbcb1' AND curation_tier = 'archive';
-- Masterplan
UPDATE films SET curation_tier = 'trending' WHERE id = '09c776d8-e3c0-4385-a8c3-3e09e810d2b2' AND curation_tier = 'archive';
-- Burning Days
UPDATE films SET curation_tier = 'extended' WHERE id = '937fd106-34d1-49cf-a34a-bb3045c4d91d' AND curation_tier = 'archive';
-- Beyond the Hill
UPDATE films SET curation_tier = 'extended' WHERE id = '86fe70b3-8fb3-461f-aa8c-0b4834ff0a38' AND curation_tier = 'archive';

COMMIT;
