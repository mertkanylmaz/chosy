-- MOOD-VEC-2b Faz 2C (parça 17/19): 21 arşiv filminin release_date[/imdb_id] + imdb_votes[/imdb_rating] + curation_tier'ı. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Kaynak: TMDb (release_date, imdb_id) + IMDb veri dosyası (oy/rating). Her UPDATE filmin hâlâ archive + release_date NULL + oyun eski değerde olduğunu doğrular.
-- Beklenen: 21 UPDATE × 1 satır.

BEGIN;

CREATE TABLE films_phase2c_backup_20261031_17 AS
  SELECT id, imdb_id, imdb_rating, imdb_votes, release_date, curation_tier FROM films WHERE id IN ('dceaf443-4052-4bc5-b986-5103425a4098', 'dcf88f3e-8936-43b6-aab7-8df57b60ac34', 'dd049035-3120-4feb-bd79-a51bf9eb297c', 'dd0803f3-57fc-4ef4-bc80-ade33542da88', 'dd35086e-1a7a-4bfc-9c2b-1407834d3f04', 'dda69a85-5a6a-4d90-8b0f-6c2cfba64c60', 'ddf32d20-9c85-4f78-98db-ca0cfb417d8d', 'df254bec-27bd-4e17-9cf2-8365067c2dd5', 'e0a69f79-1fca-4d68-abba-574eb5df43fa', 'e105ec3e-5661-432b-9f2c-2914bb0d8863', 'e11c307c-4b48-4a58-a60a-c5e6ca5cad2c', 'e3e6a469-9867-4f23-a8b5-9f6a4f835b46', 'e3ffc0b9-e197-4890-9b1f-cd3c4379635a', 'e509845a-c161-4761-8321-c208022374c2', 'e5e6b53b-0ae8-43ca-beb0-0acaa5af7d5d', 'e71db524-3c8f-4d35-8053-b85ac14090c0', 'e7360d83-4261-4c35-b573-3d84674ef1fb', 'e73f356a-0ebf-44ef-97a0-88fc8e3566e8', 'e796d05d-86d1-4210-be55-4700a5818d81', 'e8cf68d7-748c-44e7-8993-69b372136e2b', 'e9918708-ed1b-43c4-98b2-2ee3c18c3a1a');
ALTER TABLE films_phase2c_backup_20261031_17 ENABLE ROW LEVEL SECURITY;

-- The Witcher: Nightmare of the Wolf (2021) 7.2/55846 → extended
UPDATE films SET release_date = '2021-08-22', imdb_id = 'tt11657662', imdb_votes = 55846, imdb_rating = 7.2, curation_tier = 'extended' WHERE id = 'dceaf443-4052-4bc5-b986-5103425a4098' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Farewell, My Lovely (1975) 7/11193 → extended
UPDATE films SET release_date = '1975-08-08', imdb_votes = 11193, imdb_rating = 7, curation_tier = 'extended' WHERE id = 'dcf88f3e-8936-43b6-aab7-8df57b60ac34' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Bram Stoker's Dracula (1992) 7.4/272534 → extended
UPDATE films SET release_date = '1992-11-13', imdb_id = 'tt0103874', imdb_votes = 272534, imdb_rating = 7.4, curation_tier = 'extended' WHERE id = 'dd049035-3120-4feb-bd79-a51bf9eb297c' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Hundred-Foot Journey (2014) 7.3/92220 → extended
UPDATE films SET release_date = '2014-08-06', imdb_votes = 92220, imdb_rating = 7.3, curation_tier = 'extended' WHERE id = 'dd0803f3-57fc-4ef4-bc80-ade33542da88' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Kong: Skull Island (2017) 6.7/380330 → extended
UPDATE films SET release_date = '2017-03-08', imdb_id = 'tt3731562', imdb_votes = 380330, imdb_rating = 6.7, curation_tier = 'extended' WHERE id = 'dd35086e-1a7a-4bfc-9c2b-1407834d3f04' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Name of the Rose (1986) 7.7/129222 → extended
UPDATE films SET release_date = '1986-09-24', imdb_id = 'tt0091605', imdb_votes = 129222, imdb_rating = 7.7, curation_tier = 'extended' WHERE id = 'dda69a85-5a6a-4d90-8b0f-6c2cfba64c60' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Ocean's Eleven (2001) 7.7/687132 → extended
UPDATE films SET release_date = '2001-12-07', imdb_id = 'tt0240772', imdb_votes = 687132, imdb_rating = 7.7, curation_tier = 'extended' WHERE id = 'ddf32d20-9c85-4f78-98db-ca0cfb417d8d' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Bring Her Back (2025) 7.1/144598 → extended
UPDATE films SET release_date = '2025-05-19', imdb_id = 'tt32246771', imdb_votes = 144598, imdb_rating = 7.1, curation_tier = 'extended' WHERE id = 'df254bec-27bd-4e17-9cf2-8365067c2dd5' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Enola Holmes (2020) 6.7/256612 → extended
UPDATE films SET release_date = '2020-09-22', imdb_votes = 256612, imdb_rating = 6.7, curation_tier = 'extended' WHERE id = 'e0a69f79-1fca-4d68-abba-574eb5df43fa' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- The Raid 2 (2014) 7.9/141038 → extended
UPDATE films SET release_date = '2014-03-27', imdb_id = 'tt2265171', imdb_votes = 141038, imdb_rating = 7.9, curation_tier = 'extended' WHERE id = 'e105ec3e-5661-432b-9f2c-2914bb0d8863' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- It (2017) 7.3/714208 → extended
UPDATE films SET release_date = '2017-09-06', imdb_votes = 714208, imdb_rating = 7.3, curation_tier = 'extended' WHERE id = 'e11c307c-4b48-4a58-a60a-c5e6ca5cad2c' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- 27 Dresses (2008) 6.2/195829 → extended
UPDATE films SET release_date = '2008-01-10', imdb_id = 'tt0988595', imdb_votes = 195829, imdb_rating = 6.2, curation_tier = 'extended' WHERE id = 'e3e6a469-9867-4f23-a8b5-9f6a4f835b46' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Ray (2004) 7.7/167722 → extended
UPDATE films SET release_date = '2004-10-29', imdb_id = 'tt0350258', imdb_votes = 167722, imdb_rating = 7.7, curation_tier = 'extended' WHERE id = 'e3ffc0b9-e197-4890-9b1f-cd3c4379635a' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Upgrade (2018) 7.5/239716 → extended
UPDATE films SET release_date = '2018-05-31', imdb_id = 'tt6499752', imdb_votes = 239716, imdb_rating = 7.5, curation_tier = 'extended' WHERE id = 'e509845a-c161-4761-8321-c208022374c2' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Sisu (2022) 6.9/127084 → extended
UPDATE films SET release_date = '2022-09-09', imdb_id = 'tt14846026', imdb_votes = 127084, imdb_rating = 6.9, curation_tier = 'extended' WHERE id = 'e5e6b53b-0ae8-43ca-beb0-0acaa5af7d5d' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Play Dirty (2025) 5.9/30063 → extended
UPDATE films SET release_date = '2025-09-30', imdb_votes = 30063, imdb_rating = 5.9, curation_tier = 'extended' WHERE id = 'e71db524-3c8f-4d35-8053-b85ac14090c0' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- King Kong (2005) 7.2/476138 → extended
UPDATE films SET release_date = '2005-12-12', imdb_id = 'tt0360717', imdb_votes = 476138, imdb_rating = 7.2, curation_tier = 'extended' WHERE id = 'e7360d83-4261-4c35-b573-3d84674ef1fb' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Bad Boys II (2003) 6.6/291681 → extended
UPDATE films SET release_date = '2003-07-18', imdb_id = 'tt0172156', imdb_votes = 291681, imdb_rating = 6.6, curation_tier = 'extended' WHERE id = 'e73f356a-0ebf-44ef-97a0-88fc8e3566e8' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- If I Had Legs I'd Kick You (2025) 6.6/42741 → extended
UPDATE films SET release_date = '2025-10-10', imdb_id = 'tt18382850', imdb_votes = 42741, imdb_rating = 6.6, curation_tier = 'extended' WHERE id = 'e796d05d-86d1-4210-be55-4700a5818d81' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Magnificent Seven (2016) 6.9/250170 → extended
UPDATE films SET release_date = '2016-09-14', imdb_id = 'tt2404435', imdb_votes = 250170, imdb_rating = 6.9, curation_tier = 'extended' WHERE id = 'e8cf68d7-748c-44e7-8993-69b372136e2b' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Gladiator (1992) 6.6/12061 → extended
UPDATE films SET release_date = '1992-03-06', imdb_id = 'tt0104346', imdb_votes = 12061, imdb_rating = 6.6, curation_tier = 'extended' WHERE id = 'e9918708-ed1b-43c4-98b2-2ee3c18c3a1a' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;

DO $$
DECLARE _backup INT; _unchanged INT;
BEGIN
  SELECT count(*) INTO _backup FROM films_phase2c_backup_20261031_17;
  SELECT count(*) INTO _unchanged FROM films f JOIN films_phase2c_backup_20261031_17 b ON b.id = f.id WHERE f.curation_tier = b.curation_tier;
  IF _backup <> 21 THEN RAISE EXCEPTION 'ABORT: yedek % satir (beklenen 21)', _backup; END IF;
  IF _unchanged <> 0 THEN RAISE EXCEPTION 'ABORT: % film degismedi (UPDATE 0 satir etkiledi)', _unchanged; END IF;
END $$;

COMMIT;
