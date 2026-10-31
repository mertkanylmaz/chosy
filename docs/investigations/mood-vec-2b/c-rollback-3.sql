-- MOOD-VEC-2b Faz 2C (parça 3/19): c-apply'ın geri alması. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Her UPDATE yalnız uygulanan değerleri taşıyan satırı eski haline (release_date NULL, tier archive) döndürür.

BEGIN;

-- Aquaman (2018) 6.8/561603 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '23f2260b-bcd7-488e-bec0-7673ab5c2dd1' AND curation_tier = 'extended' AND release_date = '2018-12-07' AND imdb_votes = 561603 AND imdb_id = 'tt1477834' AND imdb_rating = 6.8;
-- Lost in Translation (2003) 7.7/536340 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '2403581d-d8b8-4aa6-a306-42c948061e7e' AND curation_tier = 'extended' AND release_date = '2003-09-18' AND imdb_votes = 536340 AND imdb_id = 'tt0335266' AND imdb_rating = 7.7;
-- Before Midnight (2013) 7.9/189017 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '24c35e04-5730-4562-aa3d-3281d27254bf' AND curation_tier = 'extended' AND release_date = '2013-04-05' AND imdb_votes = 189017 AND imdb_id = 'tt2209418' AND imdb_rating = 7.9;
-- Kubo and the Two Strings (2016) 7.7/149219 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '2582db7e-429c-44cf-94a4-8a90c1f16585' AND curation_tier = 'extended' AND release_date = '2016-08-18' AND imdb_votes = 149219 AND imdb_id = 'tt4302938' AND imdb_rating = 7.7;
-- Where Is The Friend's House? (1987) 8.1/23874 → core
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '25d60d82-4e17-4869-9661-e7105fd85a1f' AND curation_tier = 'core' AND release_date = '1987-07-01' AND imdb_votes = 23874 AND imdb_rating = 8.1;
-- The Cure (1995) 7.7/12343 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '284ad83a-abf8-4a64-bb2d-052ed5919a20' AND curation_tier = 'extended' AND release_date = '1995-04-21' AND imdb_votes = 12343 AND imdb_rating = 7.7;
-- 4 Months, 3 Weeks and 2 Days (2007) 7.9/66749 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '28ccb5e3-c702-4cf2-8363-9441a62b4c2e' AND curation_tier = 'extended' AND release_date = '2007-08-24' AND imdb_votes = 66749 AND imdb_id = 'tt1032846' AND imdb_rating = 7.9;
-- Abominable (2019) 7/47612 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '28ccfff1-ead8-4b15-858e-1b2bd83c50f4' AND curation_tier = 'extended' AND release_date = '2019-09-19' AND imdb_votes = 47612 AND imdb_id = 'tt6324278' AND imdb_rating = 7;
-- He's Just Not That Into You (2009) 6.4/198559 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '2b8a20a7-a768-406b-a0d2-8664be127ba6' AND curation_tier = 'extended' AND release_date = '2009-02-06' AND imdb_votes = 198559 AND imdb_rating = 6.4;
-- The Conjuring: The Devil Made Me Do It (2021) 6.2/174909 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '2be92070-7483-41af-ae37-590fe94a4056' AND curation_tier = 'extended' AND release_date = '2021-05-25' AND imdb_votes = 174909 AND imdb_id = 'tt7069210' AND imdb_rating = 6.2;
-- Ed Wood (1994) 7.8/191405 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '2bfa498c-0c4d-420a-9dbb-fb36b5622922' AND curation_tier = 'extended' AND release_date = '1994-09-28' AND imdb_votes = 191405 AND imdb_id = 'tt0109707' AND imdb_rating = 7.8;
-- The Good Boy (2026) 6.8/19852 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '2c2883e5-5691-40ce-bdaa-cd4538e2f745' AND curation_tier = 'extended' AND release_date = '2026-03-05' AND imdb_votes = 19852 AND imdb_rating = 6.8;
-- Mission: Impossible - Fallout (2018) 7.7/426408 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '2c5a608f-5cb1-45ba-94c6-dd9355337305' AND curation_tier = 'extended' AND release_date = '2018-07-25' AND imdb_votes = 426408 AND imdb_id = 'tt4912910' AND imdb_rating = 7.7;
-- Life of Pi (2012) 7.9/707606 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '2c9d1385-6f17-4696-aec0-263194d5a3dd' AND curation_tier = 'extended' AND release_date = '2012-11-20' AND imdb_votes = 707606 AND imdb_id = 'tt0454876' AND imdb_rating = 7.9;
-- Dünyanın Tarihi (1981) 6.8/59742 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '2dbe2e78-4e6b-4d37-821e-95ddb3a93ebe' AND curation_tier = 'extended' AND release_date = '1981-06-12' AND imdb_votes = 59742 AND imdb_rating = 6.8;
-- The Best of Me (2014) 6.7/82076 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '2dfaf663-7489-4fac-9833-cff811bcf1b4' AND curation_tier = 'extended' AND release_date = '2014-10-15' AND imdb_votes = 82076 AND imdb_id = 'tt1972779' AND imdb_rating = 6.7;
-- 21 Jump Street (2012) 7.2/658046 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '3049e34e-d4f4-4298-92c2-578ae83c39ee' AND curation_tier = 'extended' AND release_date = '2012-03-14' AND imdb_votes = 658046 AND imdb_id = 'tt1232829' AND imdb_rating = 7.2;
-- Damsel (2024) 6.1/123115 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '319e50e9-3c86-4d17-bc84-8c90e3067fc7' AND curation_tier = 'extended' AND release_date = '2024-03-07' AND imdb_votes = 123115 AND imdb_id = 'tt13452446' AND imdb_rating = 6.1;
-- Argo (2012) 7.7/675181 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '3228fe33-0219-4564-a5e9-79aa491368e5' AND curation_tier = 'extended' AND release_date = '2012-10-11' AND imdb_votes = 675181 AND imdb_id = 'tt1024648' AND imdb_rating = 7.7;
-- Space Pirate Captain Harlock (2013) 6.4/13472 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '325a79a0-89fc-4385-bd86-a510791f4f2d' AND curation_tier = 'extended' AND release_date = '2013-09-07' AND imdb_votes = 13472 AND imdb_rating = 6.4;
-- Moana (2016) 7.6/452413 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '33040d95-bee1-4286-9800-50bcdd4a0a88' AND curation_tier = 'extended' AND release_date = '2016-10-13' AND imdb_votes = 452413 AND imdb_id = 'tt3521164' AND imdb_rating = 7.6;

COMMIT;
