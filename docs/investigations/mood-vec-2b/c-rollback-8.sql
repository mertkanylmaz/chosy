-- MOOD-VEC-2b Faz 2C (parça 8/19): c-apply'ın geri alması. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Her UPDATE yalnız uygulanan değerleri taşıyan satırı eski haline (release_date NULL, tier archive) döndürür.

BEGIN;

-- Conclave (2024) 7.4/290202 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '674ec9ea-082f-4d12-a0f1-4a19412ad25f' AND curation_tier = 'extended' AND release_date = '2024-10-25' AND imdb_votes = 290202 AND imdb_rating = 7.4;
-- Lilo & Stitch (2002) 7.4/248109 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '682860b5-c196-4fe0-a128-3b8c24787ab9' AND curation_tier = 'extended' AND release_date = '2002-06-21' AND imdb_votes = 248109 AND imdb_id = 'tt0275847' AND imdb_rating = 7.4;
-- Wake Up Dead Man: A Knives Out Mystery (2025) 7.3/263892 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '6856a805-e2ab-4dd6-ac6e-ca59ef6e7ae4' AND curation_tier = 'extended' AND release_date = '2025-11-26' AND imdb_votes = 263892 AND imdb_rating = 7.3;
-- Somewhere in Time (1980) 7.2/37205 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '690c0924-79c6-413c-af14-61f92cfa7988' AND curation_tier = 'extended' AND release_date = '1980-10-02' AND imdb_votes = 37205 AND imdb_id = 'tt0081534' AND imdb_rating = 7.2;
-- Mean Girls (2004) 7.1/495964 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '6a7a4397-a7bf-45bf-9a1b-275ab01d210e' AND curation_tier = 'extended' AND release_date = '2004-04-30' AND imdb_votes = 495964 AND imdb_id = 'tt0377092' AND imdb_rating = 7.1;
-- Black Book (2006) 7.7/84605 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '6adf65a6-9926-40e4-a958-88a2c6e3ba23' AND curation_tier = 'extended' AND release_date = '2006-09-14' AND imdb_votes = 84605 AND imdb_id = 'tt0389557' AND imdb_rating = 7.7;
-- The Insider (1999) 7.8/194001 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '6af13db8-7808-4b42-9d31-16c807da0c10' AND curation_tier = 'extended' AND release_date = '1999-10-28' AND imdb_votes = 194001 AND imdb_id = 'tt0140352' AND imdb_rating = 7.8;
-- Mr. & Mrs. Smith (2005) 6.5/604821 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '6bd8b2ce-7274-4bcd-8ae5-a55cdbd1185f' AND curation_tier = 'extended' AND release_date = '2005-06-07' AND imdb_votes = 604821 AND imdb_id = 'tt0356910' AND imdb_rating = 6.5;
-- Star Trek II: The Wrath of Khan (1982) 7.7/137442 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '6ce86f8f-0199-46e1-8c80-7728de9a226d' AND curation_tier = 'extended' AND release_date = '1982-06-04' AND imdb_votes = 137442 AND imdb_id = 'tt0084726' AND imdb_rating = 7.7;
-- The Bad Guys (2022) 6.9/83225 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '6ea3796d-1f11-4ebb-b01a-b8170bf50b3a' AND curation_tier = 'extended' AND release_date = '2022-03-17' AND imdb_votes = 83225 AND imdb_id = 'tt8115900' AND imdb_rating = 6.9;
-- Frozen II (2019) 6.8/224777 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '6eaa39a8-1162-409b-aa3d-069d13e437a8' AND curation_tier = 'extended' AND release_date = '2019-11-20' AND imdb_votes = 224777 AND imdb_id = 'tt4520988' AND imdb_rating = 6.8;
-- Wreck-It Ralph (2012) 7.7/507467 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '6f384e8c-620e-496b-8a9a-4a9686268e15' AND curation_tier = 'extended' AND release_date = '2012-11-01' AND imdb_votes = 507467 AND imdb_id = 'tt1772341' AND imdb_rating = 7.7;
-- Only the Brave (2017) 7.6/94516 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '6f3f08e3-16e5-4963-ba7e-757b9191735d' AND curation_tier = 'extended' AND release_date = '2017-09-22' AND imdb_votes = 94516 AND imdb_id = 'tt3829920' AND imdb_rating = 7.6;
-- This Is Spinal Tap (1984) 7.9/162071 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '6fbf049a-86a4-498b-a26e-f35ca18f427b' AND curation_tier = 'extended' AND release_date = '1984-03-02' AND imdb_votes = 162071 AND imdb_id = 'tt0088258' AND imdb_rating = 7.9;
-- Wonka (2023) 6.9/198496 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '6fe2399f-aff9-42d4-a4ba-626043e9fb41' AND curation_tier = 'extended' AND release_date = '2023-12-06' AND imdb_votes = 198496 AND imdb_id = 'tt6166392' AND imdb_rating = 6.9;
-- The Shack (2017) 6.3/43331 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '70d23797-9de5-434b-810e-16ff484631f0' AND curation_tier = 'extended' AND release_date = '2017-03-02' AND imdb_votes = 43331 AND imdb_id = 'tt2872518' AND imdb_rating = 6.3;
-- To All the Boys: Always and Forever (2021) 6.3/41171 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '70d306c4-8bb3-4387-ad90-6536c1a53bc5' AND curation_tier = 'extended' AND release_date = '2021-02-12' AND imdb_votes = 41171 AND imdb_id = 'tt10676012' AND imdb_rating = 6.3;
-- Arthur the King (2024) 7/42150 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '70e2f184-90b4-489f-bfd2-35752c9f52a5' AND curation_tier = 'extended' AND release_date = '2024-02-22' AND imdb_votes = 42150 AND imdb_id = 'tt10720352' AND imdb_rating = 7;
-- Chaplin (1992) 7.5/66351 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '70f9c303-6772-453b-9b4b-f475e9ffb89e' AND curation_tier = 'extended' AND release_date = '1992-12-17' AND imdb_votes = 66351 AND imdb_id = 'tt0103939' AND imdb_rating = 7.5;
-- Godzilla (2014) 6.4/469571 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '713775f2-0d42-427b-acc4-74cf474837ba' AND curation_tier = 'extended' AND release_date = '2014-05-14' AND imdb_votes = 469571 AND imdb_id = 'tt0831387' AND imdb_rating = 6.4;
-- The Tomorrow War (2021) 6.6/258936 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '718ec327-8296-4932-97f6-a4f8be8317d5' AND curation_tier = 'extended' AND release_date = '2021-09-03' AND imdb_votes = 258936 AND imdb_rating = 6.6;

COMMIT;
