-- MOOD-VEC-2b Faz 2C (parça 8/19): 21 arşiv filminin release_date[/imdb_id] + imdb_votes[/imdb_rating] + curation_tier'ı. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Kaynak: TMDb (release_date, imdb_id) + IMDb veri dosyası (oy/rating). Her UPDATE filmin hâlâ archive + release_date NULL + oyun eski değerde olduğunu doğrular.
-- Beklenen: 21 UPDATE × 1 satır.

BEGIN;

CREATE TABLE films_phase2c_backup_20261031_8 AS
  SELECT id, imdb_id, imdb_rating, imdb_votes, release_date, curation_tier FROM films WHERE id IN ('674ec9ea-082f-4d12-a0f1-4a19412ad25f', '682860b5-c196-4fe0-a128-3b8c24787ab9', '6856a805-e2ab-4dd6-ac6e-ca59ef6e7ae4', '690c0924-79c6-413c-af14-61f92cfa7988', '6a7a4397-a7bf-45bf-9a1b-275ab01d210e', '6adf65a6-9926-40e4-a958-88a2c6e3ba23', '6af13db8-7808-4b42-9d31-16c807da0c10', '6bd8b2ce-7274-4bcd-8ae5-a55cdbd1185f', '6ce86f8f-0199-46e1-8c80-7728de9a226d', '6ea3796d-1f11-4ebb-b01a-b8170bf50b3a', '6eaa39a8-1162-409b-aa3d-069d13e437a8', '6f384e8c-620e-496b-8a9a-4a9686268e15', '6f3f08e3-16e5-4963-ba7e-757b9191735d', '6fbf049a-86a4-498b-a26e-f35ca18f427b', '6fe2399f-aff9-42d4-a4ba-626043e9fb41', '70d23797-9de5-434b-810e-16ff484631f0', '70d306c4-8bb3-4387-ad90-6536c1a53bc5', '70e2f184-90b4-489f-bfd2-35752c9f52a5', '70f9c303-6772-453b-9b4b-f475e9ffb89e', '713775f2-0d42-427b-acc4-74cf474837ba', '718ec327-8296-4932-97f6-a4f8be8317d5');
ALTER TABLE films_phase2c_backup_20261031_8 ENABLE ROW LEVEL SECURITY;

-- Conclave (2024) 7.4/290202 → extended
UPDATE films SET release_date = '2024-10-25', imdb_votes = 290202, imdb_rating = 7.4, curation_tier = 'extended' WHERE id = '674ec9ea-082f-4d12-a0f1-4a19412ad25f' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Lilo & Stitch (2002) 7.4/248109 → extended
UPDATE films SET release_date = '2002-06-21', imdb_id = 'tt0275847', imdb_votes = 248109, imdb_rating = 7.4, curation_tier = 'extended' WHERE id = '682860b5-c196-4fe0-a128-3b8c24787ab9' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Wake Up Dead Man: A Knives Out Mystery (2025) 7.3/263892 → extended
UPDATE films SET release_date = '2025-11-26', imdb_votes = 263892, imdb_rating = 7.3, curation_tier = 'extended' WHERE id = '6856a805-e2ab-4dd6-ac6e-ca59ef6e7ae4' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Somewhere in Time (1980) 7.2/37205 → extended
UPDATE films SET release_date = '1980-10-02', imdb_id = 'tt0081534', imdb_votes = 37205, imdb_rating = 7.2, curation_tier = 'extended' WHERE id = '690c0924-79c6-413c-af14-61f92cfa7988' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Mean Girls (2004) 7.1/495964 → extended
UPDATE films SET release_date = '2004-04-30', imdb_id = 'tt0377092', imdb_votes = 495964, imdb_rating = 7.1, curation_tier = 'extended' WHERE id = '6a7a4397-a7bf-45bf-9a1b-275ab01d210e' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Black Book (2006) 7.7/84605 → extended
UPDATE films SET release_date = '2006-09-14', imdb_id = 'tt0389557', imdb_votes = 84605, imdb_rating = 7.7, curation_tier = 'extended' WHERE id = '6adf65a6-9926-40e4-a958-88a2c6e3ba23' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Insider (1999) 7.8/194001 → extended
UPDATE films SET release_date = '1999-10-28', imdb_id = 'tt0140352', imdb_votes = 194001, imdb_rating = 7.8, curation_tier = 'extended' WHERE id = '6af13db8-7808-4b42-9d31-16c807da0c10' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Mr. & Mrs. Smith (2005) 6.5/604821 → extended
UPDATE films SET release_date = '2005-06-07', imdb_id = 'tt0356910', imdb_votes = 604821, imdb_rating = 6.5, curation_tier = 'extended' WHERE id = '6bd8b2ce-7274-4bcd-8ae5-a55cdbd1185f' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Star Trek II: The Wrath of Khan (1982) 7.7/137442 → extended
UPDATE films SET release_date = '1982-06-04', imdb_id = 'tt0084726', imdb_votes = 137442, imdb_rating = 7.7, curation_tier = 'extended' WHERE id = '6ce86f8f-0199-46e1-8c80-7728de9a226d' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Bad Guys (2022) 6.9/83225 → extended
UPDATE films SET release_date = '2022-03-17', imdb_id = 'tt8115900', imdb_votes = 83225, imdb_rating = 6.9, curation_tier = 'extended' WHERE id = '6ea3796d-1f11-4ebb-b01a-b8170bf50b3a' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Frozen II (2019) 6.8/224777 → extended
UPDATE films SET release_date = '2019-11-20', imdb_id = 'tt4520988', imdb_votes = 224777, imdb_rating = 6.8, curation_tier = 'extended' WHERE id = '6eaa39a8-1162-409b-aa3d-069d13e437a8' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Wreck-It Ralph (2012) 7.7/507467 → extended
UPDATE films SET release_date = '2012-11-01', imdb_id = 'tt1772341', imdb_votes = 507467, imdb_rating = 7.7, curation_tier = 'extended' WHERE id = '6f384e8c-620e-496b-8a9a-4a9686268e15' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Only the Brave (2017) 7.6/94516 → extended
UPDATE films SET release_date = '2017-09-22', imdb_id = 'tt3829920', imdb_votes = 94516, imdb_rating = 7.6, curation_tier = 'extended' WHERE id = '6f3f08e3-16e5-4963-ba7e-757b9191735d' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- This Is Spinal Tap (1984) 7.9/162071 → extended
UPDATE films SET release_date = '1984-03-02', imdb_id = 'tt0088258', imdb_votes = 162071, imdb_rating = 7.9, curation_tier = 'extended' WHERE id = '6fbf049a-86a4-498b-a26e-f35ca18f427b' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Wonka (2023) 6.9/198496 → extended
UPDATE films SET release_date = '2023-12-06', imdb_id = 'tt6166392', imdb_votes = 198496, imdb_rating = 6.9, curation_tier = 'extended' WHERE id = '6fe2399f-aff9-42d4-a4ba-626043e9fb41' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Shack (2017) 6.3/43331 → extended
UPDATE films SET release_date = '2017-03-02', imdb_id = 'tt2872518', imdb_votes = 43331, imdb_rating = 6.3, curation_tier = 'extended' WHERE id = '70d23797-9de5-434b-810e-16ff484631f0' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- To All the Boys: Always and Forever (2021) 6.3/41171 → extended
UPDATE films SET release_date = '2021-02-12', imdb_id = 'tt10676012', imdb_votes = 41171, imdb_rating = 6.3, curation_tier = 'extended' WHERE id = '70d306c4-8bb3-4387-ad90-6536c1a53bc5' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Arthur the King (2024) 7/42150 → extended
UPDATE films SET release_date = '2024-02-22', imdb_id = 'tt10720352', imdb_votes = 42150, imdb_rating = 7, curation_tier = 'extended' WHERE id = '70e2f184-90b4-489f-bfd2-35752c9f52a5' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Chaplin (1992) 7.5/66351 → extended
UPDATE films SET release_date = '1992-12-17', imdb_id = 'tt0103939', imdb_votes = 66351, imdb_rating = 7.5, curation_tier = 'extended' WHERE id = '70f9c303-6772-453b-9b4b-f475e9ffb89e' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Godzilla (2014) 6.4/469571 → extended
UPDATE films SET release_date = '2014-05-14', imdb_id = 'tt0831387', imdb_votes = 469571, imdb_rating = 6.4, curation_tier = 'extended' WHERE id = '713775f2-0d42-427b-acc4-74cf474837ba' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Tomorrow War (2021) 6.6/258936 → extended
UPDATE films SET release_date = '2021-09-03', imdb_votes = 258936, imdb_rating = 6.6, curation_tier = 'extended' WHERE id = '718ec327-8296-4932-97f6-a4f8be8317d5' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;

DO $$
DECLARE _backup INT; _unchanged INT;
BEGIN
  SELECT count(*) INTO _backup FROM films_phase2c_backup_20261031_8;
  SELECT count(*) INTO _unchanged FROM films f JOIN films_phase2c_backup_20261031_8 b ON b.id = f.id WHERE f.curation_tier = b.curation_tier;
  IF _backup <> 21 THEN RAISE EXCEPTION 'ABORT: yedek % satir (beklenen 21)', _backup; END IF;
  IF _unchanged <> 0 THEN RAISE EXCEPTION 'ABORT: % film degismedi (UPDATE 0 satir etkiledi)', _unchanged; END IF;
END $$;

COMMIT;
