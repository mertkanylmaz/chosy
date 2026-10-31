-- MOOD-VEC-2b Faz 2C (parça 1/19): 21 arşiv filminin release_date[/imdb_id] + imdb_votes[/imdb_rating] + curation_tier'ı. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Kaynak: TMDb (release_date, imdb_id) + IMDb veri dosyası (oy/rating). Her UPDATE filmin hâlâ archive + release_date NULL + oyun eski değerde olduğunu doğrular.
-- Beklenen: 21 UPDATE × 1 satır.

BEGIN;

CREATE TABLE films_phase2c_backup_20261031_1 AS
  SELECT id, imdb_id, imdb_rating, imdb_votes, release_date, curation_tier FROM films WHERE id IN ('00f5aac4-7343-4837-bda8-7ba46259add8', '0132f958-aaed-42d6-b2c5-2adea62b74a9', '0164e409-786f-456b-97f3-739960d2b010', '019ef115-f82e-4921-a468-e4d02ec67530', '04061131-d663-4abb-8102-e3967f556bfe', '053c4667-80e9-447d-ad74-7b13c7f0f573', '05957a7f-5c7e-4fff-b06d-94f2aa427ac5', '06245b84-4f03-4e28-a974-741948a52736', '06d71590-3556-42ca-b7fa-eac2b3b6818c', '070df024-6b09-4caa-b444-381026025aa8', '0781ea87-ed15-48b1-9119-95f5032f6b21', '089b5b52-bbf7-4224-911e-e9cf1311e2db', '09168ccf-9afa-4fdd-a426-02adfb33191b', '09e64246-d6d0-4bda-9555-9559f970081b', '0a27ed0b-f9c5-41b5-a060-e215d5ee9443', '0b743437-b683-4e46-b9e7-85c1b1767b2e', '0bba7a5f-db1e-4c07-8408-4ce63fe1e943', '0c3b6122-6352-4948-b7fa-24ab921cead9', '0fae4218-edfc-4392-9113-0e5fd417050d', '1029de98-ee33-4c91-bc46-1cd2de9464ee', '105b7ebe-7aef-4841-953e-313103e560a3');
ALTER TABLE films_phase2c_backup_20261031_1 ENABLE ROW LEVEL SECURITY;

-- Wicked: İyilik Uğruna (2025) 6.6/75687 → extended
UPDATE films SET release_date = '2025-11-19', imdb_votes = 75687, imdb_rating = 6.6, curation_tier = 'extended' WHERE id = '00f5aac4-7343-4837-bda8-7ba46259add8' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- The Expendables (2010) 6.4/383815 → extended
UPDATE films SET release_date = '2010-08-07', imdb_id = 'tt1320253', imdb_votes = 383815, imdb_rating = 6.4, curation_tier = 'extended' WHERE id = '0132f958-aaed-42d6-b2c5-2adea62b74a9' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Werckmeister Harmonies (2001) 7.9/18529 → extended
UPDATE films SET release_date = '2001-02-01', imdb_votes = 18529, imdb_rating = 7.9, curation_tier = 'extended' WHERE id = '0164e409-786f-456b-97f3-739960d2b010' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Night on Earth (1991) 7.6/71957 → extended
UPDATE films SET release_date = '1991-12-12', imdb_id = 'tt0102536', imdb_votes = 71957, imdb_rating = 7.6, curation_tier = 'extended' WHERE id = '019ef115-f82e-4921-a468-e4d02ec67530' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Fool (2014) 7.9/18973 → extended
UPDATE films SET release_date = '2014-08-09', imdb_id = 'tt3560686', imdb_votes = 18973, imdb_rating = 7.9, curation_tier = 'extended' WHERE id = '04061131-d663-4abb-8102-e3967f556bfe' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Uçurum (2026) 5.8/20119 → extended
UPDATE films SET release_date = '2026-02-17', imdb_votes = 20119, imdb_rating = 5.8, curation_tier = 'extended' WHERE id = '053c4667-80e9-447d-ad74-7b13c7f0f573' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Adele H'nin Öyküsü (1975) 7.2/10099 → extended
UPDATE films SET release_date = '1975-10-08', imdb_votes = 10099, imdb_rating = 7.2, curation_tier = 'extended' WHERE id = '05957a7f-5c7e-4fff-b06d-94f2aa427ac5' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Jurassic World: Fallen Kingdom (2018) 6.2/389314 → extended
UPDATE films SET release_date = '2018-06-06', imdb_id = 'tt4881806', imdb_votes = 389314, imdb_rating = 6.2, curation_tier = 'extended' WHERE id = '06245b84-4f03-4e28-a974-741948a52736' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Life of David Gale (2003) 7.5/133802 → extended
UPDATE films SET release_date = '2003-02-21', imdb_id = 'tt0289992', imdb_votes = 133802, imdb_rating = 7.5, curation_tier = 'extended' WHERE id = '06d71590-3556-42ca-b7fa-eac2b3b6818c' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Thin Red Line (1998) 7.6/214491 → extended
UPDATE films SET release_date = '1998-12-23', imdb_id = 'tt0120863', imdb_votes = 214491, imdb_rating = 7.6, curation_tier = 'extended' WHERE id = '070df024-6b09-4caa-b444-381026025aa8' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Basketball Diaries (1995) 7.3/135038 → extended
UPDATE films SET release_date = '1995-04-21', imdb_id = 'tt0112461', imdb_votes = 135038, imdb_rating = 7.3, curation_tier = 'extended' WHERE id = '0781ea87-ed15-48b1-9119-95f5032f6b21' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Maleficent (2014) 6.9/429203 → extended
UPDATE films SET release_date = '2014-05-28', imdb_id = 'tt1587310', imdb_votes = 429203, imdb_rating = 6.9, curation_tier = 'extended' WHERE id = '089b5b52-bbf7-4224-911e-e9cf1311e2db' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Tarzan (1999) 7.3/273243 → extended
UPDATE films SET release_date = '1999-06-17', imdb_id = 'tt0120855', imdb_votes = 273243, imdb_rating = 7.3, curation_tier = 'extended' WHERE id = '09168ccf-9afa-4fdd-a426-02adfb33191b' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Song Sung Blue (2025) 7.3/34020 → extended
UPDATE films SET release_date = '2025-12-15', imdb_id = 'tt30343021', imdb_votes = 34020, imdb_rating = 7.3, curation_tier = 'extended' WHERE id = '09e64246-d6d0-4bda-9555-9559f970081b' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Big George Foreman (2023) 6.7/13125 → extended
UPDATE films SET release_date = '2023-04-27', imdb_id = 'tt12226632', imdb_votes = 13125, imdb_rating = 6.7, curation_tier = 'extended' WHERE id = '0a27ed0b-f9c5-41b5-a060-e215d5ee9443' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Stand and Deliver (1988) 7.3/22887 → extended
UPDATE films SET release_date = '1988-03-11', imdb_id = 'tt0094027', imdb_votes = 22887, imdb_rating = 7.3, curation_tier = 'extended' WHERE id = '0b743437-b683-4e46-b9e7-85c1b1767b2e' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- District 9 (2009) 7.9/759474 → extended
UPDATE films SET release_date = '2009-08-05', imdb_id = 'tt1136608', imdb_votes = 759474, imdb_rating = 7.9, curation_tier = 'extended' WHERE id = '0bba7a5f-db1e-4c07-8408-4ce63fe1e943' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Age of Adaline (2015) 7.2/233040 → extended
UPDATE films SET release_date = '2015-04-16', imdb_id = 'tt1655441', imdb_votes = 233040, imdb_rating = 7.2, curation_tier = 'extended' WHERE id = '0c3b6122-6352-4948-b7fa-24ab921cead9' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Reminders of Him (2026) 6.3/13832 → extended
UPDATE films SET release_date = '2026-03-11', imdb_votes = 13832, imdb_rating = 6.3, curation_tier = 'extended' WHERE id = '0fae4218-edfc-4392-9113-0e5fd417050d' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Downton Abbey: Büyük Final (2025) 7.3/20235 → extended
UPDATE films SET release_date = '2025-09-10', imdb_votes = 20235, imdb_rating = 7.3, curation_tier = 'extended' WHERE id = '1029de98-ee33-4c91-bc46-1cd2de9464ee' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- How to Make Millions Before Grandma Dies (2024) 7.9/23709 → extended
UPDATE films SET release_date = '2024-04-04', imdb_votes = 23709, imdb_rating = 7.9, curation_tier = 'extended' WHERE id = '105b7ebe-7aef-4841-953e-313103e560a3' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;

DO $$
DECLARE _backup INT; _unchanged INT;
BEGIN
  SELECT count(*) INTO _backup FROM films_phase2c_backup_20261031_1;
  SELECT count(*) INTO _unchanged FROM films f JOIN films_phase2c_backup_20261031_1 b ON b.id = f.id WHERE f.curation_tier = b.curation_tier;
  IF _backup <> 21 THEN RAISE EXCEPTION 'ABORT: yedek % satir (beklenen 21)', _backup; END IF;
  IF _unchanged <> 0 THEN RAISE EXCEPTION 'ABORT: % film degismedi (UPDATE 0 satir etkiledi)', _unchanged; END IF;
END $$;

COMMIT;
