-- MOOD-VEC-2b Faz 2C (parça 6/19): 21 arşiv filminin release_date[/imdb_id] + imdb_votes[/imdb_rating] + curation_tier'ı. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Kaynak: TMDb (release_date, imdb_id) + IMDb veri dosyası (oy/rating). Her UPDATE filmin hâlâ archive + release_date NULL + oyun eski değerde olduğunu doğrular.
-- Beklenen: 21 UPDATE × 1 satır.

BEGIN;

CREATE TABLE films_phase2c_backup_20261031_6 AS
  SELECT id, imdb_id, imdb_rating, imdb_votes, release_date, curation_tier FROM films WHERE id IN ('4eaeef89-556f-43ac-bc15-1d968b39ab50', '4ebd2e6d-960e-465f-b9c4-26656a3a7ef4', '4ed0f20c-b4db-43d3-b028-fd67fb9feb7a', '4ee7f4f4-41aa-4113-858d-11a54e3b9751', '4fad1aa3-4b9a-4dff-aeff-b7fa63d68851', '506deb6a-2e79-4e92-b6ec-d3c539910719', '5091cc5f-6231-41a0-9539-7a34016856fb', '50db5aa5-65e5-4904-9397-a7a143f58f3a', '51172771-304e-4727-a383-6e3b179bfe4b', '51f59189-488e-4c26-a318-d9b5d09286a1', '523c4862-e8f8-4f4b-856d-18a6c507610e', '542925e1-ece4-40f6-95e7-d5acf43c832c', '547b0218-3c24-41bb-b6d5-495adc39f851', '57f9d029-4ff1-407b-86e1-43e8169034f8', '58103526-9821-49a1-b62f-945eae0d7e1e', '58e965db-c419-4a90-a183-7496ffe5e292', '5937e00f-3601-4907-9f8a-189f9f9f432d', '59925d86-e640-49ee-82aa-93a083b3ae2c', '5aac58b3-0fc5-4833-8b1f-062212897fad', '5ba231a7-2b54-41db-9748-f423fd868ad6', '5bfc56d9-4bf3-4fd1-a5e5-ac6f5cccb45d');
ALTER TABLE films_phase2c_backup_20261031_6 ENABLE ROW LEVEL SECURITY;

-- The Purple Rose of Cairo (1985) 7.6/58593 → extended
UPDATE films SET release_date = '1985-03-01', imdb_id = 'tt0089853', imdb_votes = 58593, imdb_rating = 7.6, curation_tier = 'extended' WHERE id = '4eaeef89-556f-43ac-bc15-1d968b39ab50' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Princess Bride (1987) 8/492695 → core
UPDATE films SET release_date = '1987-09-25', imdb_id = 'tt0093779', imdb_votes = 492695, imdb_rating = 8, curation_tier = 'core' WHERE id = '4ebd2e6d-960e-465f-b9c4-26656a3a7ef4' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Pretty Woman (1990) 7.1/413789 → extended
UPDATE films SET release_date = '1990-03-23', imdb_id = 'tt0100405', imdb_votes = 413789, imdb_rating = 7.1, curation_tier = 'extended' WHERE id = '4ed0f20c-b4db-43d3-b028-fd67fb9feb7a' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Quiet Girl (2022) 7.7/30218 → extended
UPDATE films SET release_date = '2022-05-12', imdb_id = 'tt15109082', imdb_votes = 30218, imdb_rating = 7.7, curation_tier = 'extended' WHERE id = '4ee7f4f4-41aa-4113-858d-11a54e3b9751' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Çığlık 6 (2023) 6.4/156989 → extended
UPDATE films SET release_date = '2023-03-08', imdb_votes = 156989, imdb_rating = 6.4, curation_tier = 'extended' WHERE id = '4fad1aa3-4b9a-4dff-aeff-b7fa63d68851' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Ant-Man (2015) 7.2/798889 → extended
UPDATE films SET release_date = '2015-07-14', imdb_votes = 798889, imdb_rating = 7.2, curation_tier = 'extended' WHERE id = '506deb6a-2e79-4e92-b6ec-d3c539910719' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- The Ugly Stepsister (2025) 7/50120 → extended
UPDATE films SET release_date = '2025-03-07', imdb_votes = 50120, imdb_rating = 7, curation_tier = 'extended' WHERE id = '5091cc5f-6231-41a0-9539-7a34016856fb' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- The Amateur (2025) 6.5/104791 → extended
UPDATE films SET release_date = '2025-04-09', imdb_id = 'tt0899043', imdb_votes = 104791, imdb_rating = 6.5, curation_tier = 'extended' WHERE id = '50db5aa5-65e5-4904-9397-a7a143f58f3a' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Tropic Thunder (2008) 7.1/499696 → extended
UPDATE films SET release_date = '2008-08-09', imdb_id = 'tt0942385', imdb_votes = 499696, imdb_rating = 7.1, curation_tier = 'extended' WHERE id = '51172771-304e-4727-a383-6e3b179bfe4b' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- My Left Foot: The Story of Christy Brown (1989) 7.8/86266 → extended
UPDATE films SET release_date = '1989-04-07', imdb_id = 'tt0097937', imdb_votes = 86266, imdb_rating = 7.8, curation_tier = 'extended' WHERE id = '51f59189-488e-4c26-a318-d9b5d09286a1' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Predestination (2014) 7.4/342646 → extended
UPDATE films SET release_date = '2014-08-28', imdb_id = 'tt2397535', imdb_votes = 342646, imdb_rating = 7.4, curation_tier = 'extended' WHERE id = '523c4862-e8f8-4f4b-856d-18a6c507610e' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Lethal Weapon (1987) 7.6/299804 → extended
UPDATE films SET release_date = '1987-03-06', imdb_id = 'tt0093409', imdb_votes = 299804, imdb_rating = 7.6, curation_tier = 'extended' WHERE id = '542925e1-ece4-40f6-95e7-d5acf43c832c' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Croods: A New Age (2020) 6.9/63398 → extended
UPDATE films SET release_date = '2020-11-25', imdb_id = 'tt2850386', imdb_votes = 63398, imdb_rating = 6.9, curation_tier = 'extended' WHERE id = '547b0218-3c24-41bb-b6d5-495adc39f851' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Captain Phillips (2013) 7.8/524205 → extended
UPDATE films SET release_date = '2013-10-10', imdb_id = 'tt1535109', imdb_votes = 524205, imdb_rating = 7.8, curation_tier = 'extended' WHERE id = '57f9d029-4ff1-407b-86e1-43e8169034f8' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Richard Jewell (2019) 7.5/109250 → extended
UPDATE films SET release_date = '2019-12-13', imdb_id = 'tt3513548', imdb_votes = 109250, imdb_rating = 7.5, curation_tier = 'extended' WHERE id = '58103526-9821-49a1-b62f-945eae0d7e1e' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- X-Men: Days of Future Past (2014) 7.9/800595 → extended
UPDATE films SET release_date = '2014-05-15', imdb_id = 'tt1877832', imdb_votes = 800595, imdb_rating = 7.9, curation_tier = 'extended' WHERE id = '58e965db-c419-4a90-a183-7496ffe5e292' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Pirates of the Caribbean: Dead Men Tell No Tales (2017) 6.5/393614 → extended
UPDATE films SET release_date = '2017-05-23', imdb_id = 'tt1790809', imdb_votes = 393614, imdb_rating = 6.5, curation_tier = 'extended' WHERE id = '5937e00f-3601-4907-9f8a-189f9f9f432d' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Reader (2008) 7.6/276151 → extended
UPDATE films SET release_date = '2008-12-10', imdb_id = 'tt0976051', imdb_votes = 276151, imdb_rating = 7.6, curation_tier = 'extended' WHERE id = '59925d86-e640-49ee-82aa-93a083b3ae2c' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Alamo (2004) 6.1/23908 → extended
UPDATE films SET release_date = '2004-04-07', imdb_votes = 23908, imdb_rating = 6.1, curation_tier = 'extended' WHERE id = '5aac58b3-0fc5-4833-8b1f-062212897fad' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Indiana Jones and the Dial of Destiny (2023) 6.5/238055 → extended
UPDATE films SET release_date = '2023-06-25', imdb_id = 'tt1462764', imdb_votes = 238055, imdb_rating = 6.5, curation_tier = 'extended' WHERE id = '5ba231a7-2b54-41db-9748-f423fd868ad6' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Greatest Beer Run Ever (2022) 6.8/38475 → extended
UPDATE films SET release_date = '2022-09-23', imdb_id = 'tt10268488', imdb_votes = 38475, imdb_rating = 6.8, curation_tier = 'extended' WHERE id = '5bfc56d9-4bf3-4fd1-a5e5-ac6f5cccb45d' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;

DO $$
DECLARE _backup INT; _unchanged INT;
BEGIN
  SELECT count(*) INTO _backup FROM films_phase2c_backup_20261031_6;
  SELECT count(*) INTO _unchanged FROM films f JOIN films_phase2c_backup_20261031_6 b ON b.id = f.id WHERE f.curation_tier = b.curation_tier;
  IF _backup <> 21 THEN RAISE EXCEPTION 'ABORT: yedek % satir (beklenen 21)', _backup; END IF;
  IF _unchanged <> 0 THEN RAISE EXCEPTION 'ABORT: % film degismedi (UPDATE 0 satir etkiledi)', _unchanged; END IF;
END $$;

COMMIT;
