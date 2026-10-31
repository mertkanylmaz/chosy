-- MOOD-VEC-2b Faz 2C (parça 4/19): 21 arşiv filminin release_date[/imdb_id] + imdb_votes[/imdb_rating] + curation_tier'ı. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Kaynak: TMDb (release_date, imdb_id) + IMDb veri dosyası (oy/rating). Her UPDATE filmin hâlâ archive + release_date NULL + oyun eski değerde olduğunu doğrular.
-- Beklenen: 21 UPDATE × 1 satır.

BEGIN;

CREATE TABLE films_phase2c_backup_20261031_4 AS
  SELECT id, imdb_id, imdb_rating, imdb_votes, release_date, curation_tier FROM films WHERE id IN ('33cf446f-68de-43e9-aee9-36ebd7b301fd', '345533cd-2aa8-45f0-b783-29fcba4aafa3', '347676d4-0b0e-4d2e-8284-909080f2c43e', '35313f3e-ad36-4c8d-94d1-12b29eff14a1', '35eed166-37c6-4ce0-b89b-f91c8887d02c', '360ebec4-e484-4a7b-90f5-650c9ae97ea0', '36c2814e-461a-4746-b611-1ec77450f500', '38345eb2-0f5b-4872-adf9-e5355c8020d6', '39e89fac-6172-4826-80a6-4d2b2fcd08af', '3a1e3537-4da7-4097-bd32-d671f8ca8ef1', '3a214e4e-9438-4e81-96c7-5ba990d06565', '3a686125-c206-4d79-a44e-f76a1b397509', '3b7eba47-3876-4dcb-a4a1-10ebf104444e', '3c129e5a-3b05-48fe-9087-2f7dc73f7be6', '3cf552f1-27ba-4586-8bd0-e530378b2aa8', '3cf9dc31-0ba2-455c-848f-b606b7f72e89', '3d7f28a9-6a54-43e6-8188-9edc81e09558', '3d8dd80b-7444-45fc-bc22-f95c613243d0', '3de85234-93fd-40e9-9cee-d29e42e98762', '3df241d4-9c12-4cb9-9ccf-e54732840eda', '3eba73e4-4416-4687-852b-cb4eaa37d3de');
ALTER TABLE films_phase2c_backup_20261031_4 ENABLE ROW LEVEL SECURITY;

-- Jurassic World (2015) 6.9/740311 → extended
UPDATE films SET release_date = '2015-06-06', imdb_id = 'tt0369610', imdb_votes = 740311, imdb_rating = 6.9, curation_tier = 'extended' WHERE id = '33cf446f-68de-43e9-aee9-36ebd7b301fd' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Mauritanian (2021) 7.5/73211 → extended
UPDATE films SET release_date = '2021-02-12', imdb_id = 'tt4761112', imdb_votes = 73211, imdb_rating = 7.5, curation_tier = 'extended' WHERE id = '345533cd-2aa8-45f0-b783-29fcba4aafa3' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- My Cousin Vinny (1992) 7.6/162749 → extended
UPDATE films SET release_date = '1992-03-13', imdb_id = 'tt0104952', imdb_votes = 162749, imdb_rating = 7.6, curation_tier = 'extended' WHERE id = '347676d4-0b0e-4d2e-8284-909080f2c43e' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Jurassic World: Yeniden Doğuş (2025) 5.8/207918 → extended
UPDATE films SET release_date = '2025-06-23', imdb_votes = 207918, imdb_rating = 5.8, curation_tier = 'extended' WHERE id = '35313f3e-ad36-4c8d-94d1-12b29eff14a1' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- mid90s (2018) 7.4/90171 → extended
UPDATE films SET release_date = '2018-10-19', imdb_id = 'tt5613484', imdb_votes = 90171, imdb_rating = 7.4, curation_tier = 'extended' WHERE id = '35eed166-37c6-4ce0-b89b-f91c8887d02c' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Passion of the Christ (2004) 7.3/278043 → extended
UPDATE films SET release_date = '2004-02-25', imdb_id = 'tt0335345', imdb_votes = 278043, imdb_rating = 7.3, curation_tier = 'extended' WHERE id = '360ebec4-e484-4a7b-90f5-650c9ae97ea0' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Pillion (2025) 6.9/25292 → extended
UPDATE films SET release_date = '2025-11-28', imdb_id = 'tt32321317', imdb_votes = 25292, imdb_rating = 6.9, curation_tier = 'extended' WHERE id = '36c2814e-461a-4746-b611-1ec77450f500' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Synecdoche, New York (2008) 7.5/106242 → extended
UPDATE films SET release_date = '2008-10-24', imdb_id = 'tt0383028', imdb_votes = 106242, imdb_rating = 7.5, curation_tier = 'extended' WHERE id = '38345eb2-0f5b-4872-adf9-e5355c8020d6' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- I Can Only Imagine (2018) 7.3/21273 → extended
UPDATE films SET release_date = '2018-02-14', imdb_id = 'tt6450186', imdb_votes = 21273, imdb_rating = 7.3, curation_tier = 'extended' WHERE id = '39e89fac-6172-4826-80a6-4d2b2fcd08af' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Invisible Life (2019) 7.7/10962 → extended
UPDATE films SET release_date = '2019-08-30', imdb_id = 'tt6390668', imdb_votes = 10962, imdb_rating = 7.7, curation_tier = 'extended' WHERE id = '3a1e3537-4da7-4097-bd32-d671f8ca8ef1' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Birdman or (The Unexpected Virtue of Ignorance) (2014) 7.7/705545 → extended
UPDATE films SET release_date = '2014-10-17', imdb_id = 'tt2562232', imdb_votes = 705545, imdb_rating = 7.7, curation_tier = 'extended' WHERE id = '3a214e4e-9438-4e81-96c7-5ba990d06565' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Sihirbazlar Çetesi: Daha Bir Şey Görmediniz (2025) 5.9/82027 → extended
UPDATE films SET release_date = '2025-11-12', imdb_votes = 82027, imdb_rating = 5.9, curation_tier = 'extended' WHERE id = '3a686125-c206-4d79-a44e-f76a1b397509' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- First Blood (1982) 7.7/307333 → extended
UPDATE films SET release_date = '1982-10-22', imdb_id = 'tt0083944', imdb_votes = 307333, imdb_rating = 7.7, curation_tier = 'extended' WHERE id = '3b7eba47-3876-4dcb-a4a1-10ebf104444e' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Facing the Giants (2006) 6.5/19486 → extended
UPDATE films SET release_date = '2006-09-29', imdb_id = 'tt0805526', imdb_votes = 19486, imdb_rating = 6.5, curation_tier = 'extended' WHERE id = '3c129e5a-3b05-48fe-9087-2f7dc73f7be6' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Terminator Genisys (2015) 6.3/310895 → extended
UPDATE films SET release_date = '2015-06-23', imdb_votes = 310895, imdb_rating = 6.3, curation_tier = 'extended' WHERE id = '3cf552f1-27ba-4586-8bd0-e530378b2aa8' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- American Made (2017) 7.2/238385 → extended
UPDATE films SET release_date = '2017-08-18', imdb_votes = 238385, imdb_rating = 7.2, curation_tier = 'extended' WHERE id = '3cf9dc31-0ba2-455c-848f-b606b7f72e89' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- American Sniper (2014) 7.3/578212 → extended
UPDATE films SET release_date = '2014-12-25', imdb_id = 'tt2179136', imdb_votes = 578212, imdb_rating = 7.3, curation_tier = 'extended' WHERE id = '3d7f28a9-6a54-43e6-8188-9edc81e09558' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Bāhubali: The Beginning (2015) 8/157474 → core
UPDATE films SET release_date = '2015-07-09', imdb_id = 'tt2631186', imdb_votes = 157474, imdb_rating = 8, curation_tier = 'core' WHERE id = '3d8dd80b-7444-45fc-bc22-f95c613243d0' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Karate Kid: Legends (2025) 6.3/51126 → extended
UPDATE films SET release_date = '2025-05-08', imdb_id = 'tt1674782', imdb_votes = 51126, imdb_rating = 6.3, curation_tier = 'extended' WHERE id = '3de85234-93fd-40e9-9cee-d29e42e98762' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Machinist (2004) 7.6/448073 → extended
UPDATE films SET release_date = '2004-09-24', imdb_id = 'tt0361862', imdb_votes = 448073, imdb_rating = 7.6, curation_tier = 'extended' WHERE id = '3df241d4-9c12-4cb9-9ccf-e54732840eda' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Skyfall (2012) 7.8/782676 → extended
UPDATE films SET release_date = '2012-10-24', imdb_id = 'tt1074638', imdb_votes = 782676, imdb_rating = 7.8, curation_tier = 'extended' WHERE id = '3eba73e4-4416-4687-852b-cb4eaa37d3de' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;

DO $$
DECLARE _backup INT; _unchanged INT;
BEGIN
  SELECT count(*) INTO _backup FROM films_phase2c_backup_20261031_4;
  SELECT count(*) INTO _unchanged FROM films f JOIN films_phase2c_backup_20261031_4 b ON b.id = f.id WHERE f.curation_tier = b.curation_tier;
  IF _backup <> 21 THEN RAISE EXCEPTION 'ABORT: yedek % satir (beklenen 21)', _backup; END IF;
  IF _unchanged <> 0 THEN RAISE EXCEPTION 'ABORT: % film degismedi (UPDATE 0 satir etkiledi)', _unchanged; END IF;
END $$;

COMMIT;
