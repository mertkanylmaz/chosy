-- MOOD-VEC-2b Faz 2C (parça 16/19): 21 arşiv filminin release_date[/imdb_id] + imdb_votes[/imdb_rating] + curation_tier'ı. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Kaynak: TMDb (release_date, imdb_id) + IMDb veri dosyası (oy/rating). Her UPDATE filmin hâlâ archive + release_date NULL + oyun eski değerde olduğunu doğrular.
-- Beklenen: 21 UPDATE × 1 satır.

BEGIN;

CREATE TABLE films_phase2c_backup_20261031_16 AS
  SELECT id, imdb_id, imdb_rating, imdb_votes, release_date, curation_tier FROM films WHERE id IN ('d252966b-0968-400c-a918-69dc905aff64', 'd3c52089-4d58-4002-8fda-fc1acadb54e2', 'd40fdddf-5435-4be6-ad94-a43380b7e1d3', 'd4ecf4c8-c80b-4de1-9aa0-3e5c47e60a7c', 'd4ee2252-84bf-47f4-b125-c51b51b8290b', 'd54e3a9c-c3ce-4cdb-9a50-eddad7ed0932', 'd59969b7-24cd-49cf-9aeb-9e6debc095ec', 'd6503943-a4fb-4401-a88b-78e9ba30dd8a', 'd72db544-1aff-4688-8b78-96009379354d', 'd75cb3c5-bc77-449e-8af6-92ba107cae41', 'd7910765-666d-48a0-abf2-f43c356e3809', 'd8edc243-0be6-47c5-a0c6-492c466a45e9', 'd8fbdb58-318b-4b9d-a307-a45688133798', 'd916cfbf-faac-4c03-ae4e-36286bdf667e', 'd92822cd-e809-4943-b1a1-9acd5aa796dd', 'da17a8f1-c718-41ec-a1bf-cde2539e7d35', 'da9f43d4-93ba-42bc-abd2-73cb94e5f0cb', 'dc24b447-2f02-414b-977f-4de17877ee90', 'dc7bd17f-80a2-4f43-bad3-17657e4ce894', 'dc817b72-829d-43ad-9f82-a3db2f1063cf', 'dcd1b6d2-4270-4c33-8683-19492313b910');
ALTER TABLE films_phase2c_backup_20261031_16 ENABLE ROW LEVEL SECURITY;

-- Rio (2011) 6.9/278914 → extended
UPDATE films SET release_date = '2011-04-03', imdb_id = 'tt1436562', imdb_votes = 278914, imdb_rating = 6.9, curation_tier = 'extended' WHERE id = 'd252966b-0968-400c-a918-69dc905aff64' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Bridesmaids (2011) 6.8/329238 → extended
UPDATE films SET release_date = '2011-05-13', imdb_id = 'tt1478338', imdb_votes = 329238, imdb_rating = 6.8, curation_tier = 'extended' WHERE id = 'd3c52089-4d58-4002-8fda-fc1acadb54e2' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Alfie (1966) 7/17056 → extended
UPDATE films SET release_date = '1966-03-29', imdb_votes = 17056, imdb_rating = 7, curation_tier = 'extended' WHERE id = 'd40fdddf-5435-4be6-ad94-a43380b7e1d3' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Liar Liar (1997) 6.9/368179 → extended
UPDATE films SET release_date = '1997-03-21', imdb_votes = 368179, imdb_rating = 6.9, curation_tier = 'extended' WHERE id = 'd4ecf4c8-c80b-4de1-9aa0-3e5c47e60a7c' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Onward (2020) 7.3/190217 → extended
UPDATE films SET release_date = '2020-02-29', imdb_id = 'tt7146812', imdb_votes = 190217, imdb_rating = 7.3, curation_tier = 'extended' WHERE id = 'd4ee2252-84bf-47f4-b125-c51b51b8290b' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Günahkârlar (2025) 7.5/536290 → extended
UPDATE films SET release_date = '2025-04-16', imdb_votes = 536290, imdb_rating = 7.5, curation_tier = 'extended' WHERE id = 'd54e3a9c-c3ce-4cdb-9a50-eddad7ed0932' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Treasure Planet (2002) 7.2/151326 → extended
UPDATE films SET release_date = '2002-11-26', imdb_id = 'tt0133240', imdb_votes = 151326, imdb_rating = 7.2, curation_tier = 'extended' WHERE id = 'd59969b7-24cd-49cf-9aeb-9e6debc095ec' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Friday the 13th (1980) 6.3/180804 → extended
UPDATE films SET release_date = '1980-05-09', imdb_id = 'tt0080761', imdb_votes = 180804, imdb_rating = 6.3, curation_tier = 'extended' WHERE id = 'd6503943-a4fb-4401-a88b-78e9ba30dd8a' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Others (2001) 7.6/434733 → extended
UPDATE films SET release_date = '2001-08-02', imdb_id = 'tt0230600', imdb_votes = 434733, imdb_rating = 7.6, curation_tier = 'extended' WHERE id = 'd72db544-1aff-4688-8b78-96009379354d' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- I Swear (2025) 8.3/71330 → core
UPDATE films SET release_date = '2025-09-22', imdb_votes = 71330, imdb_rating = 8.3, curation_tier = 'core' WHERE id = 'd75cb3c5-bc77-449e-8af6-92ba107cae41' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Barfi! (2012) 8.1/95278 → core
UPDATE films SET release_date = '2012-09-13', imdb_id = 'tt2082197', imdb_votes = 95278, imdb_rating = 8.1, curation_tier = 'core' WHERE id = 'd7910765-666d-48a0-abf2-f43c356e3809' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Paul, Apostle of Christ (2018) 6.7/11714 → extended
UPDATE films SET release_date = '2018-03-22', imdb_id = 'tt7388562', imdb_votes = 11714, imdb_rating = 6.7, curation_tier = 'extended' WHERE id = 'd8edc243-0be6-47c5-a0c6-492c466a45e9' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Code 3 (2025) 7.2/23116 → extended
UPDATE films SET release_date = '2025-09-12', imdb_id = 'tt26394837', imdb_votes = 23116, imdb_rating = 7.2, curation_tier = 'extended' WHERE id = 'd8fbdb58-318b-4b9d-a307-a45688133798' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Where the Crawdads Sing (2022) 7.2/162070 → extended
UPDATE films SET release_date = '2022-07-14', imdb_id = 'tt9411972', imdb_votes = 162070, imdb_rating = 7.2, curation_tier = 'extended' WHERE id = 'd916cfbf-faac-4c03-ae4e-36286bdf667e' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Aladdin (2019) 6.9/320799 → extended
UPDATE films SET release_date = '2019-05-22', imdb_id = 'tt6139732', imdb_votes = 320799, imdb_rating = 6.9, curation_tier = 'extended' WHERE id = 'd92822cd-e809-4943-b1a1-9acd5aa796dd' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Heads of State (2025) 6.4/73336 → extended
UPDATE films SET release_date = '2025-06-24', imdb_id = 'tt13357520', imdb_votes = 73336, imdb_rating = 6.4, curation_tier = 'extended' WHERE id = 'da17a8f1-c718-41ec-a1bf-cde2539e7d35' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Butterfly Effect (2004) 7.6/563361 → extended
UPDATE films SET release_date = '2004-01-17', imdb_id = 'tt0289879', imdb_votes = 563361, imdb_rating = 7.6, curation_tier = 'extended' WHERE id = 'da9f43d4-93ba-42bc-abd2-73cb94e5f0cb' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Eternals (2021) 6.2/439532 → extended
UPDATE films SET release_date = '2021-11-03', imdb_id = 'tt9032400', imdb_votes = 439532, imdb_rating = 6.2, curation_tier = 'extended' WHERE id = 'dc24b447-2f02-414b-977f-4de17877ee90' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Still Alice (2014) 7.5/152152 → extended
UPDATE films SET release_date = '2014-12-05', imdb_id = 'tt3316960', imdb_votes = 152152, imdb_rating = 7.5, curation_tier = 'extended' WHERE id = 'dc7bd17f-80a2-4f43-bad3-17657e4ce894' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Charlie and the Chocolate Factory (2005) 6.7/580870 → extended
UPDATE films SET release_date = '2005-07-13', imdb_id = 'tt0367594', imdb_votes = 580870, imdb_rating = 6.7, curation_tier = 'extended' WHERE id = 'dc817b72-829d-43ad-9f82-a3db2f1063cf' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Shrek the Third (2007) 6.1/366782 → extended
UPDATE films SET release_date = '2007-05-17', imdb_id = 'tt0413267', imdb_votes = 366782, imdb_rating = 6.1, curation_tier = 'extended' WHERE id = 'dcd1b6d2-4270-4c33-8683-19492313b910' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;

DO $$
DECLARE _backup INT; _unchanged INT;
BEGIN
  SELECT count(*) INTO _backup FROM films_phase2c_backup_20261031_16;
  SELECT count(*) INTO _unchanged FROM films f JOIN films_phase2c_backup_20261031_16 b ON b.id = f.id WHERE f.curation_tier = b.curation_tier;
  IF _backup <> 21 THEN RAISE EXCEPTION 'ABORT: yedek % satir (beklenen 21)', _backup; END IF;
  IF _unchanged <> 0 THEN RAISE EXCEPTION 'ABORT: % film degismedi (UPDATE 0 satir etkiledi)', _unchanged; END IF;
END $$;

COMMIT;
