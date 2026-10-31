-- MOOD-VEC-2b Faz 2C (parça 5/19): 22 arşiv filminin release_date[/imdb_id] + imdb_votes[/imdb_rating] + curation_tier'ı. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Kaynak: TMDb (release_date, imdb_id) + IMDb veri dosyası (oy/rating). Her UPDATE filmin hâlâ archive + release_date NULL + oyun eski değerde olduğunu doğrular.
-- Beklenen: 22 UPDATE × 1 satır.

BEGIN;

CREATE TABLE films_phase2c_backup_20261031_5 AS
  SELECT id, imdb_id, imdb_rating, imdb_votes, release_date, curation_tier FROM films WHERE id IN ('3f21810d-daa7-4d28-9f1f-5470691da960', '3f4829bb-bd0a-4c85-8a55-137fcf856f20', '3fbb1abd-5bd7-454f-a06c-1009356e9b68', '403ad09d-b881-4c03-b281-6976a4dc3e08', '406413b3-53c6-423a-b37e-59cd93652b83', '412d40e0-013b-45c7-bc34-31b25cfd2ea7', '42958bc3-5932-4bca-a653-5a949bf4f372', '42e3bfb9-1d8e-4d39-9690-b996bd41a5d4', '43fa1d77-92c3-4066-b933-33367540c412', '44a6e7d4-4462-42f4-9cf7-75d1a0ed475c', '454cc41d-10c5-4bbb-a211-c15903aa2bc0', '45765a22-648d-4fe6-8ecd-c06f89973866', '469664b0-f755-4607-8bde-ee97620c37f4', '46c8a971-b53e-487a-b536-42a177150d08', '47c331c3-d808-4fda-b0fd-8c9f301fbea9', '47f12ad8-e76e-46d9-b481-bc7cc42b381d', '48156c90-aab8-493c-842e-ef8f6e3ddbbf', '48e8c5d7-f2e9-43fc-9cf5-bb834eccba3c', '4ad79197-6883-497c-975a-97bdf2f3f875', '4b42f33e-44c6-41b6-8e62-09630142d9bd', '4c2b3d48-55f4-44d0-a6b5-26f0970a9b1f', '4c2f8484-cd01-4c02-900c-5e63881abb39');
ALTER TABLE films_phase2c_backup_20261031_5 ENABLE ROW LEVEL SECURITY;

-- One Day (2011) 7/181981 → extended
UPDATE films SET release_date = '2011-03-02', imdb_id = 'tt1563738', imdb_votes = 181981, imdb_rating = 7, curation_tier = 'extended' WHERE id = '3f21810d-daa7-4d28-9f1f-5470691da960' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Seven Swords (2005) 6.1/10273 → extended
UPDATE films SET release_date = '2005-07-25', imdb_votes = 10273, imdb_rating = 6.1, curation_tier = 'extended' WHERE id = '3f4829bb-bd0a-4c85-8a55-137fcf856f20' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Paulie (1998) 6.6/17710 → extended
UPDATE films SET release_date = '1998-04-17', imdb_votes = 17710, imdb_rating = 6.6, curation_tier = 'extended' WHERE id = '3fbb1abd-5bd7-454f-a06c-1009356e9b68' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Joy Ride (2001) 6.6/85783 → extended
UPDATE films SET release_date = '2001-10-05', imdb_votes = 85783, imdb_rating = 6.6, curation_tier = 'extended' WHERE id = '403ad09d-b881-4c03-b281-6976a4dc3e08' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- The Mask (1994) 7/479686 → extended
UPDATE films SET release_date = '1994-07-29', imdb_votes = 479686, imdb_rating = 7, curation_tier = 'extended' WHERE id = '406413b3-53c6-423a-b37e-59cd93652b83' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- IF (2024) 6.4/69391 → extended
UPDATE films SET release_date = '2024-05-08', imdb_id = 'tt11152168', imdb_votes = 69391, imdb_rating = 6.4, curation_tier = 'extended' WHERE id = '412d40e0-013b-45c7-bc34-31b25cfd2ea7' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Creed II (2018) 7.1/175200 → extended
UPDATE films SET release_date = '2018-11-21', imdb_id = 'tt6343314', imdb_votes = 175200, imdb_rating = 7.1, curation_tier = 'extended' WHERE id = '42958bc3-5932-4bca-a653-5a949bf4f372' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Devil's Advocate (1997) 7.5/454357 → extended
UPDATE films SET release_date = '1997-10-17', imdb_votes = 454357, imdb_rating = 7.5, curation_tier = 'extended' WHERE id = '42e3bfb9-1d8e-4d39-9690-b996bd41a5d4' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Nebraska (2013) 7.7/129759 → extended
UPDATE films SET release_date = '2013-09-21', imdb_id = 'tt1821549', imdb_votes = 129759, imdb_rating = 7.7, curation_tier = 'extended' WHERE id = '43fa1d77-92c3-4066-b933-33367540c412' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Tumbbad (2018) 8.2/78145 → core
UPDATE films SET release_date = '2018-10-12', imdb_id = 'tt8239946', imdb_votes = 78145, imdb_rating = 8.2, curation_tier = 'core' WHERE id = '44a6e7d4-4462-42f4-9cf7-75d1a0ed475c' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Thor: The Dark World (2013) 6.7/796283 → extended
UPDATE films SET release_date = '2013-10-30', imdb_id = 'tt1981115', imdb_votes = 796283, imdb_rating = 6.7, curation_tier = 'extended' WHERE id = '454cc41d-10c5-4bbb-a211-c15903aa2bc0' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Ginger & Rosa (2012) 6.2/12299 → extended
UPDATE films SET release_date = '2012-10-18', imdb_votes = 12299, imdb_rating = 6.2, curation_tier = 'extended' WHERE id = '45765a22-648d-4fe6-8ecd-c06f89973866' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Battleship (2012) 5.8/272419 → extended
UPDATE films SET release_date = '2012-04-11', imdb_id = 'tt1440129', imdb_votes = 272419, imdb_rating = 5.8, curation_tier = 'extended' WHERE id = '469664b0-f755-4607-8bde-ee97620c37f4' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Monsters University (2013) 7.2/432884 → extended
UPDATE films SET release_date = '2013-06-19', imdb_id = 'tt1453405', imdb_votes = 432884, imdb_rating = 7.2, curation_tier = 'extended' WHERE id = '46c8a971-b53e-487a-b536-42a177150d08' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Edge of Tomorrow (2014) 7.9/819641 → extended
UPDATE films SET release_date = '2014-05-27', imdb_id = 'tt1631867', imdb_votes = 819641, imdb_rating = 7.9, curation_tier = 'extended' WHERE id = '47c331c3-d808-4fda-b0fd-8c9f301fbea9' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Alien: Covenant (2017) 6.4/350462 → extended
UPDATE films SET release_date = '2017-05-09', imdb_votes = 350462, imdb_rating = 6.4, curation_tier = 'extended' WHERE id = '47f12ad8-e76e-46d9-b481-bc7cc42b381d' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Fever Pitch (2005) 6.3/50531 → extended
UPDATE films SET release_date = '2005-04-06', imdb_votes = 50531, imdb_rating = 6.3, curation_tier = 'extended' WHERE id = '48156c90-aab8-493c-842e-ef8f6e3ddbbf' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- True Romance (1993) 7.9/265347 → extended
UPDATE films SET release_date = '1993-09-09', imdb_id = 'tt0108399', imdb_votes = 265347, imdb_rating = 7.9, curation_tier = 'extended' WHERE id = '48e8c5d7-f2e9-43fc-9cf5-bb834eccba3c' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Captain Marvel (2019) 6.7/676767 → extended
UPDATE films SET release_date = '2019-03-06', imdb_id = 'tt4154664', imdb_votes = 676767, imdb_rating = 6.7, curation_tier = 'extended' WHERE id = '4ad79197-6883-497c-975a-97bdf2f3f875' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Muppet Christmas Carol (1992) 7.8/82947 → extended
UPDATE films SET release_date = '1992-12-11', imdb_id = 'tt0104940', imdb_votes = 82947, imdb_rating = 7.8, curation_tier = 'extended' WHERE id = '4b42f33e-44c6-41b6-8e62-09630142d9bd' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- It Was Just an Accident (2025) 7.4/40350 → extended
UPDATE films SET release_date = '2025-10-01', imdb_id = 'tt36491653', imdb_votes = 40350, imdb_rating = 7.4, curation_tier = 'extended' WHERE id = '4c2b3d48-55f4-44d0-a6b5-26f0970a9b1f' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Ordinary Angels (2024) 7.4/23738 → extended
UPDATE films SET release_date = '2024-02-22', imdb_id = 'tt4996328', imdb_votes = 23738, imdb_rating = 7.4, curation_tier = 'extended' WHERE id = '4c2f8484-cd01-4c02-900c-5e63881abb39' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;

DO $$
DECLARE _backup INT; _unchanged INT;
BEGIN
  SELECT count(*) INTO _backup FROM films_phase2c_backup_20261031_5;
  SELECT count(*) INTO _unchanged FROM films f JOIN films_phase2c_backup_20261031_5 b ON b.id = f.id WHERE f.curation_tier = b.curation_tier;
  IF _backup <> 22 THEN RAISE EXCEPTION 'ABORT: yedek % satir (beklenen 22)', _backup; END IF;
  IF _unchanged <> 0 THEN RAISE EXCEPTION 'ABORT: % film degismedi (UPDATE 0 satir etkiledi)', _unchanged; END IF;
END $$;

COMMIT;
