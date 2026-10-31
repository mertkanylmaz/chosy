-- MOOD-VEC-2b Faz 2C (parça 7/19): 22 arşiv filminin release_date[/imdb_id] + imdb_votes[/imdb_rating] + curation_tier'ı. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Kaynak: TMDb (release_date, imdb_id) + IMDb veri dosyası (oy/rating). Her UPDATE filmin hâlâ archive + release_date NULL + oyun eski değerde olduğunu doğrular.
-- Beklenen: 22 UPDATE × 1 satır.

BEGIN;

CREATE TABLE films_phase2c_backup_20261031_7 AS
  SELECT id, imdb_id, imdb_rating, imdb_votes, release_date, curation_tier FROM films WHERE id IN ('5c2e5eaa-e837-45e7-837f-5fb8f893a646', '5d1c19c0-c075-4d85-84dc-690b987a8c77', '5e628ad9-02db-4f7f-bc91-9cb14ecb91ec', '6023a6ab-b1a5-4524-ba32-caef8a603df6', '606b3a19-f5f4-4f8a-9a68-94773be534e5', '607b939b-69ed-4bda-90b6-9c7934b33dc7', '609370c2-4ce2-473f-832e-3009ac02c0c0', '60adf11d-22f7-4c7a-bb07-db0c95c10514', '60f37326-65f0-44f6-b215-b72cbf26cd01', '613dce9d-5d27-4675-9ee3-17494477ffe7', '62022058-4c8b-4b0e-956d-19c52c519d39', '622cb266-651b-47d9-8fd4-0947a8fba1e0', '6304ffc3-d437-4fda-9305-81b05f44cb79', '647d5657-795c-452c-99c2-ec07716657c7', '647d88c1-2344-43aa-8c3b-a552157ce655', '64b63a2a-09a3-45c0-9e5f-a49357b80672', '6551dc95-f001-4720-a26b-ede198e4b416', '65ff0736-0bd7-4baa-9901-13380aa7ad80', '666a71b4-dfce-4dc1-864a-7b6dc0262348', '66cb0e29-102e-4fa0-a348-eb373f9bb4de', '66e68014-769b-4809-8200-b8a98e1fab2a', '6730d166-f8fa-4988-932e-f961f02202ce');
ALTER TABLE films_phase2c_backup_20261031_7 ENABLE ROW LEVEL SECURITY;

-- Çığlık 4 (2011) 6.3/195299 → extended
UPDATE films SET release_date = '2011-04-13', imdb_votes = 195299, imdb_rating = 6.3, curation_tier = 'extended' WHERE id = '5c2e5eaa-e837-45e7-837f-5fb8f893a646' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- El Conde (2023) 6.3/16794 → extended
UPDATE films SET release_date = '2023-09-07', imdb_votes = 16794, imdb_rating = 6.3, curation_tier = 'extended' WHERE id = '5d1c19c0-c075-4d85-84dc-690b987a8c77' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- The Call of the Wild (2020) 6.7/65440 → extended
UPDATE films SET release_date = '2020-02-19', imdb_id = 'tt7504726', imdb_votes = 65440, imdb_rating = 6.7, curation_tier = 'extended' WHERE id = '5e628ad9-02db-4f7f-bc91-9cb14ecb91ec' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Tatilde Tanıştığımız İnsanlar (2026) 6.6/55354 → extended
UPDATE films SET release_date = '2026-01-06', imdb_votes = 55354, imdb_rating = 6.6, curation_tier = 'extended' WHERE id = '6023a6ab-b1a5-4524-ba32-caef8a603df6' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Hallow Road (2025) 6/15193 → extended
UPDATE films SET release_date = '2025-04-16', imdb_votes = 15193, imdb_rating = 6, curation_tier = 'extended' WHERE id = '606b3a19-f5f4-4f8a-9a68-94773be534e5' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Despicable Me 2 (2013) 7.3/466932 → extended
UPDATE films SET release_date = '2013-06-26', imdb_id = 'tt1690953', imdb_votes = 466932, imdb_rating = 7.3, curation_tier = 'extended' WHERE id = '607b939b-69ed-4bda-90b6-9c7934b33dc7' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Hunger Games: Mockingjay - Part 1 (2014) 6.6/556464 → extended
UPDATE films SET release_date = '2014-11-19', imdb_id = 'tt1951265', imdb_votes = 556464, imdb_rating = 6.6, curation_tier = 'extended' WHERE id = '609370c2-4ce2-473f-832e-3009ac02c0c0' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- In Time (2011) 6.7/490401 → extended
UPDATE films SET release_date = '2011-10-27', imdb_id = 'tt1637688', imdb_votes = 490401, imdb_rating = 6.7, curation_tier = 'extended' WHERE id = '60adf11d-22f7-4c7a-bb07-db0c95c10514' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Creed (2015) 7.6/341505 → extended
UPDATE films SET release_date = '2015-11-25', imdb_id = 'tt3076658', imdb_votes = 341505, imdb_rating = 7.6, curation_tier = 'extended' WHERE id = '60f37326-65f0-44f6-b215-b72cbf26cd01' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Fallout (2021) 7/44378 → extended
UPDATE films SET release_date = '2021-03-17', imdb_id = 'tt11847410', imdb_votes = 44378, imdb_rating = 7, curation_tier = 'extended' WHERE id = '613dce9d-5d27-4675-9ee3-17494477ffe7' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Walk the Line (2005) 7.8/283242 → extended
UPDATE films SET release_date = '2005-09-13', imdb_id = 'tt0358273', imdb_votes = 283242, imdb_rating = 7.8, curation_tier = 'extended' WHERE id = '62022058-4c8b-4b0e-956d-19c52c519d39' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Ağır Siklet (2012) 6.4/100302 → extended
UPDATE films SET release_date = '2012-10-10', imdb_votes = 100302, imdb_rating = 6.4, curation_tier = 'extended' WHERE id = '622cb266-651b-47d9-8fd4-0947a8fba1e0' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Sing (2016) 7.1/218051 → extended
UPDATE films SET release_date = '2016-11-23', imdb_id = 'tt3470600', imdb_votes = 218051, imdb_rating = 7.1, curation_tier = 'extended' WHERE id = '6304ffc3-d437-4fda-9305-81b05f44cb79' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Woman in Cabin 10 (2025) 5.8/77001 → extended
UPDATE films SET release_date = '2025-10-09', imdb_id = 'tt7130300', imdb_votes = 77001, imdb_rating = 5.8, curation_tier = 'extended' WHERE id = '647d5657-795c-452c-99c2-ec07716657c7' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Incredibles 2 (2018) 7.5/379571 → extended
UPDATE films SET release_date = '2018-06-14', imdb_id = 'tt3606756', imdb_votes = 379571, imdb_rating = 7.5, curation_tier = 'extended' WHERE id = '647d88c1-2344-43aa-8c3b-a552157ce655' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Drishyam (2015) 8.2/112265 → core
UPDATE films SET release_date = '2015-07-30', imdb_id = 'tt4430212', imdb_votes = 112265, imdb_rating = 8.2, curation_tier = 'core' WHERE id = '64b63a2a-09a3-45c0-9e5f-a49357b80672' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Sirāt (2025) 7/39069 → extended
UPDATE films SET release_date = '2025-06-06', imdb_votes = 39069, imdb_rating = 7, curation_tier = 'extended' WHERE id = '6551dc95-f001-4720-a26b-ede198e4b416' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Superbad (2007) 7.6/706728 → extended
UPDATE films SET release_date = '2007-08-17', imdb_id = 'tt0829482', imdb_votes = 706728, imdb_rating = 7.6, curation_tier = 'extended' WHERE id = '65ff0736-0bd7-4baa-9901-13380aa7ad80' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- A Star Is Born (2018) 7.6/454244 → extended
UPDATE films SET release_date = '2018-10-03', imdb_id = 'tt1517451', imdb_votes = 454244, imdb_rating = 7.6, curation_tier = 'extended' WHERE id = '666a71b4-dfce-4dc1-864a-7b6dc0262348' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Man on Fire (2004) 7.7/427807 → extended
UPDATE films SET release_date = '2004-04-23', imdb_id = 'tt0328107', imdb_votes = 427807, imdb_rating = 7.7, curation_tier = 'extended' WHERE id = '66cb0e29-102e-4fa0-a348-eb373f9bb4de' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Work It (2020) 6.1/18378 → extended
UPDATE films SET release_date = '2020-08-07', imdb_id = 'tt10276470', imdb_votes = 18378, imdb_rating = 6.1, curation_tier = 'extended' WHERE id = '66e68014-769b-4809-8200-b8a98e1fab2a' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Dark Waters (2019) 7.6/124032 → extended
UPDATE films SET release_date = '2019-11-22', imdb_id = 'tt9071322', imdb_votes = 124032, imdb_rating = 7.6, curation_tier = 'extended' WHERE id = '6730d166-f8fa-4988-932e-f961f02202ce' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;

DO $$
DECLARE _backup INT; _unchanged INT;
BEGIN
  SELECT count(*) INTO _backup FROM films_phase2c_backup_20261031_7;
  SELECT count(*) INTO _unchanged FROM films f JOIN films_phase2c_backup_20261031_7 b ON b.id = f.id WHERE f.curation_tier = b.curation_tier;
  IF _backup <> 22 THEN RAISE EXCEPTION 'ABORT: yedek % satir (beklenen 22)', _backup; END IF;
  IF _unchanged <> 0 THEN RAISE EXCEPTION 'ABORT: % film degismedi (UPDATE 0 satir etkiledi)', _unchanged; END IF;
END $$;

COMMIT;
