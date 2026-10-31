-- MOOD-VEC-2b Faz 2C (parça 13/19): 21 arşiv filminin release_date[/imdb_id] + imdb_votes[/imdb_rating] + curation_tier'ı. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Kaynak: TMDb (release_date, imdb_id) + IMDb veri dosyası (oy/rating). Her UPDATE filmin hâlâ archive + release_date NULL + oyun eski değerde olduğunu doğrular.
-- Beklenen: 21 UPDATE × 1 satır.

BEGIN;

CREATE TABLE films_phase2c_backup_20261031_13 AS
  SELECT id, imdb_id, imdb_rating, imdb_votes, release_date, curation_tier FROM films WHERE id IN ('a5d544d1-bccb-4878-b58a-fa3ad6f1d8be', 'a8695d6c-6ec4-4aae-9501-20ba36a5f10e', 'a872da83-dd53-458d-bdfc-dcdbb6e2d5ff', 'a8e3c9f8-345c-4ce9-9b93-8c3563d59f9c', 'a9b0f1dd-301c-4cb6-a2f8-c41be062c832', 'aa01a9c2-558c-4143-8ba7-59ea2da83b8d', 'aa78c71c-98e5-4edf-b813-2ce8da6a0fac', 'aae7922c-0dd2-42bf-a5b2-5f5ee6737974', 'aaebfbd7-2e9f-4739-aaf6-b40c13e69e68', 'ab54bd73-7bd9-4ac9-918b-04b771b16687', 'ac259d60-c25a-46dc-bc5e-264298bfe7d9', 'ad650743-9a70-4843-9ccc-ae99ed6d217c', 'ad8bbb1d-7a93-48ba-8f44-bb4eba256a1d', 'ae977e46-eaf2-4d76-b2f4-9202530a9693', 'b04cc5f7-84d6-4554-bcc0-847843b9ee32', 'b1076760-4ff5-47bb-ab7b-74b719f727bc', 'b133a54f-308a-4574-ad4d-76cb30a48490', 'b147a5e8-22f3-4f68-acf1-07a5f384e549', 'b2abed8c-cf73-4950-aa27-d9b163a2b52e', 'b2b31533-25cb-48c8-8062-dfd321efc989', 'b2cca4ec-9871-4417-88ef-a6cd96512bb7');
ALTER TABLE films_phase2c_backup_20261031_13 ENABLE ROW LEVEL SECURITY;

-- The Electric State (2025) 5.9/88282 → extended
UPDATE films SET release_date = '2025-02-24', imdb_id = 'tt7766378', imdb_votes = 88282, imdb_rating = 5.9, curation_tier = 'extended' WHERE id = 'a5d544d1-bccb-4878-b58a-fa3ad6f1d8be' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Testament of Ann Lee (2025) 6.4/11062 → extended
UPDATE films SET release_date = '2025-12-25', imdb_votes = 11062, imdb_rating = 6.4, curation_tier = 'extended' WHERE id = 'a8695d6c-6ec4-4aae-9501-20ba36a5f10e' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- The Accountant² (2025) 6.6/138054 → extended
UPDATE films SET release_date = '2025-04-23', imdb_id = 'tt7068946', imdb_votes = 138054, imdb_rating = 6.6, curation_tier = 'extended' WHERE id = 'a872da83-dd53-458d-bdfc-dcdbb6e2d5ff' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Last King of Scotland (2006) 7.6/207785 → extended
UPDATE films SET release_date = '2006-09-27', imdb_id = 'tt0455590', imdb_votes = 207785, imdb_rating = 7.6, curation_tier = 'extended' WHERE id = 'a8e3c9f8-345c-4ce9-9b93-8c3563d59f9c' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Teenage Mutant Ninja Turtles (2014) 5.8/232526 → extended
UPDATE films SET release_date = '2014-08-07', imdb_id = 'tt1291150', imdb_votes = 232526, imdb_rating = 5.8, curation_tier = 'extended' WHERE id = 'a9b0f1dd-301c-4cb6-a2f8-c41be062c832' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Banshees of Inisherin (2022) 7.6/301814 → extended
UPDATE films SET release_date = '2022-10-20', imdb_id = 'tt11813216', imdb_votes = 301814, imdb_rating = 7.6, curation_tier = 'extended' WHERE id = 'aa01a9c2-558c-4143-8ba7-59ea2da83b8d' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Shaun of the Dead (2004) 7.8/647067 → extended
UPDATE films SET release_date = '2004-04-09', imdb_id = 'tt0365748', imdb_votes = 647067, imdb_rating = 7.8, curation_tier = 'extended' WHERE id = 'aa78c71c-98e5-4edf-b813-2ce8da6a0fac' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- To All the Boys I've Loved Before (2018) 7/143885 → extended
UPDATE films SET release_date = '2018-08-17', imdb_id = 'tt3846674', imdb_votes = 143885, imdb_rating = 7, curation_tier = 'extended' WHERE id = 'aae7922c-0dd2-42bf-a5b2-5f5ee6737974' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- A Nightmare on Elm Street (1984) 7.4/297287 → extended
UPDATE films SET release_date = '1984-11-09', imdb_id = 'tt0087800', imdb_votes = 297287, imdb_rating = 7.4, curation_tier = 'extended' WHERE id = 'aaebfbd7-2e9f-4739-aaf6-b40c13e69e68' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Red One (2024) 6.2/162580 → extended
UPDATE films SET release_date = '2024-10-31', imdb_votes = 162580, imdb_rating = 6.2, curation_tier = 'extended' WHERE id = 'ab54bd73-7bd9-4ac9-918b-04b771b16687' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Instant Family (2018) 7.3/138161 → extended
UPDATE films SET release_date = '2018-11-13', imdb_id = 'tt7401588', imdb_votes = 138161, imdb_rating = 7.3, curation_tier = 'extended' WHERE id = 'ac259d60-c25a-46dc-bc5e-264298bfe7d9' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Independence Day (1996) 7/656432 → extended
UPDATE films SET release_date = '1996-07-02', imdb_id = 'tt0116629', imdb_votes = 656432, imdb_rating = 7, curation_tier = 'extended' WHERE id = 'ad650743-9a70-4843-9ccc-ae99ed6d217c' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Fakülte (1998) 6.6/150656 → extended
UPDATE films SET release_date = '1998-12-25', imdb_votes = 150656, imdb_rating = 6.6, curation_tier = 'extended' WHERE id = 'ad8bbb1d-7a93-48ba-8f44-bb4eba256a1d' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Me and Earl and the Dying Girl (2015) 7.7/145618 → extended
UPDATE films SET release_date = '2015-06-12', imdb_id = 'tt2582496', imdb_votes = 145618, imdb_rating = 7.7, curation_tier = 'extended' WHERE id = 'ae977e46-eaf2-4d76-b2f4-9202530a9693' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Solo Mio (2026) 6.6/16107 → extended
UPDATE films SET release_date = '2026-02-05', imdb_votes = 16107, imdb_rating = 6.6, curation_tier = 'extended' WHERE id = 'b04cc5f7-84d6-4554-bcc0-847843b9ee32' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- The Hunt for Red October (1990) 7.5/235168 → extended
UPDATE films SET release_date = '1990-03-02', imdb_id = 'tt0099810', imdb_votes = 235168, imdb_rating = 7.5, curation_tier = 'extended' WHERE id = 'b1076760-4ff5-47bb-ab7b-74b719f727bc' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Unforgivable (2021) 7.2/130428 → extended
UPDATE films SET release_date = '2021-11-24', imdb_id = 'tt11233960', imdb_votes = 130428, imdb_rating = 7.2, curation_tier = 'extended' WHERE id = 'b133a54f-308a-4574-ad4d-76cb30a48490' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Incredible Hulk (2008) 6.6/580813 → extended
UPDATE films SET release_date = '2008-06-12', imdb_id = 'tt0800080', imdb_votes = 580813, imdb_rating = 6.6, curation_tier = 'extended' WHERE id = 'b147a5e8-22f3-4f68-acf1-07a5f384e549' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Hobbit: The Desolation of Smaug (2013) 7.8/763834 → extended
UPDATE films SET release_date = '2013-12-11', imdb_id = 'tt1170358', imdb_votes = 763834, imdb_rating = 7.8, curation_tier = 'extended' WHERE id = 'b2abed8c-cf73-4950-aa27-d9b163a2b52e' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Captain America: The Winter Soldier (2014) 7.7/994588 → extended
UPDATE films SET release_date = '2014-03-20', imdb_id = 'tt1843866', imdb_votes = 994588, imdb_rating = 7.7, curation_tier = 'extended' WHERE id = 'b2b31533-25cb-48c8-8062-dfd321efc989' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Favourite (2018) 7.5/262194 → extended
UPDATE films SET release_date = '2018-11-23', imdb_id = 'tt5083738', imdb_votes = 262194, imdb_rating = 7.5, curation_tier = 'extended' WHERE id = 'b2cca4ec-9871-4417-88ef-a6cd96512bb7' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;

DO $$
DECLARE _backup INT; _unchanged INT;
BEGIN
  SELECT count(*) INTO _backup FROM films_phase2c_backup_20261031_13;
  SELECT count(*) INTO _unchanged FROM films f JOIN films_phase2c_backup_20261031_13 b ON b.id = f.id WHERE f.curation_tier = b.curation_tier;
  IF _backup <> 21 THEN RAISE EXCEPTION 'ABORT: yedek % satir (beklenen 21)', _backup; END IF;
  IF _unchanged <> 0 THEN RAISE EXCEPTION 'ABORT: % film degismedi (UPDATE 0 satir etkiledi)', _unchanged; END IF;
END $$;

COMMIT;
