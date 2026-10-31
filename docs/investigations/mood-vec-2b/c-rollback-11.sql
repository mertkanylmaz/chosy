-- MOOD-VEC-2b Faz 2C (parça 11/19): c-apply'ın geri alması. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Her UPDATE yalnız uygulanan değerleri taşıyan satırı eski haline (release_date NULL, tier archive) döndürür.

BEGIN;

-- Back to the Outback (2021) 6.5/13139 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '87a436b9-114b-4f79-8279-9142f0232a97' AND curation_tier = 'extended' AND release_date = '2021-12-03' AND imdb_votes = 13139 AND imdb_id = 'tt13575806' AND imdb_rating = 6.5;
-- Angel Has Fallen (2019) 6.4/124971 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '87b2999e-f027-4336-8c8c-9443f92f6965' AND curation_tier = 'extended' AND release_date = '2019-08-21' AND imdb_votes = 124971 AND imdb_id = 'tt6189022' AND imdb_rating = 6.4;
-- Men of Honor (2000) 7.2/131981 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '889d8584-ae01-49dc-94cb-fdd01c697a1a' AND curation_tier = 'extended' AND release_date = '2000-09-13' AND imdb_votes = 131981 AND imdb_id = 'tt0203019' AND imdb_rating = 7.2;
-- Prey (2022) 7.1/279059 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '892cabd1-d91d-4256-a583-30c8303396c0' AND curation_tier = 'extended' AND release_date = '2022-08-05' AND imdb_votes = 279059 AND imdb_id = 'tt11866324' AND imdb_rating = 7.1;
-- Midnight in Paris (2011) 7.6/475144 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '89d7cf26-1b41-441c-b726-2a683e7d69d3' AND curation_tier = 'extended' AND release_date = '2011-05-11' AND imdb_votes = 475144 AND imdb_id = 'tt1605783' AND imdb_rating = 7.6;
-- The Dirt (2019) 7/61711 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '8a126265-871c-4520-acaa-24437a86c87e' AND curation_tier = 'extended' AND release_date = '2019-03-18' AND imdb_votes = 61711 AND imdb_id = 'tt0800325' AND imdb_rating = 7;
-- Ice Station Zebra (1968) 6.6/13174 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '8abd503b-5bb3-4ef4-bfb9-3e6e1e1ccbff' AND curation_tier = 'extended' AND release_date = '1968-04-04' AND imdb_votes = 13174 AND imdb_rating = 6.6;
-- Entergalactic (2022) 7.4/21759 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '8b58c490-a572-4017-91ce-96ca970db2fe' AND curation_tier = 'extended' AND release_date = '2022-09-28' AND imdb_votes = 21759 AND imdb_id = 'tt10687116' AND imdb_rating = 7.4;
-- Children of Men (2006) 7.9/574128 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '8b75b450-8f43-40c7-aa88-49f5063cae26' AND curation_tier = 'extended' AND release_date = '2006-09-22' AND imdb_votes = 574128 AND imdb_id = 'tt0206634' AND imdb_rating = 7.9;
-- Dhurandhar (2025) 8.2/152541 → core
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '8de5d529-28ee-49a5-9c2f-ac445c1c806e' AND curation_tier = 'core' AND release_date = '2025-12-05' AND imdb_votes = 152541 AND imdb_rating = 8.2;
-- Sentimental Value (2025) 7.7/92444 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '8f71ca3e-f71f-4f20-a995-a208d504de71' AND curation_tier = 'extended' AND release_date = '2025-08-20' AND imdb_votes = 92444 AND imdb_rating = 7.7;
-- Hotel Transylvania (2012) 7.1/321621 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '8f83dadf-cfdd-4c7f-8652-d4c9adb93307' AND curation_tier = 'extended' AND release_date = '2012-09-20' AND imdb_votes = 321621 AND imdb_id = 'tt0837562' AND imdb_rating = 7.1;
-- Lucy (2014) 6.4/587591 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '8f98acc7-8d93-4dfa-bfdb-0abf2fdd4284' AND curation_tier = 'extended' AND release_date = '2014-07-25' AND imdb_votes = 587591 AND imdb_id = 'tt2872732' AND imdb_rating = 6.4;
-- The Fall Guy (2024) 6.8/276443 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '9077bd5a-2627-4d4a-a0f2-7233c091e2bc' AND curation_tier = 'extended' AND release_date = '2024-04-24' AND imdb_votes = 276443 AND imdb_id = 'tt1684562' AND imdb_rating = 6.8;
-- Hannah and Her Sisters (1986) 7.8/82381 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '90c2bf59-4847-4580-8675-77852f029cf5' AND curation_tier = 'extended' AND release_date = '1986-02-07' AND imdb_votes = 82381 AND imdb_id = 'tt0091167' AND imdb_rating = 7.8;
-- As Good as It Gets (1997) 7.7/341189 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '90f6c2eb-055d-4dce-93b4-aff005889f61' AND curation_tier = 'extended' AND release_date = '1997-12-19' AND imdb_votes = 341189 AND imdb_id = 'tt0119822' AND imdb_rating = 7.7;
-- Ip Man 2 (2010) 7.5/118121 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '9142ffe9-7684-46ea-af98-05f0770a2bb2' AND curation_tier = 'extended' AND release_date = '2010-04-29' AND imdb_votes = 118121 AND imdb_id = 'tt1386932' AND imdb_rating = 7.5;
-- Time of the Gypsies (1988) 8.1/34931 → core
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '915d86fa-3756-495b-aca1-815e42f5db2a' AND curation_tier = 'core' AND release_date = '1988-12-21' AND imdb_votes = 34931 AND imdb_id = 'tt0097223' AND imdb_rating = 8.1;
-- E.T. the Extra-Terrestrial (1982) 7.9/478551 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '92955d8e-1f7e-475c-8805-119b41a39445' AND curation_tier = 'extended' AND release_date = '1982-06-11' AND imdb_votes = 478551 AND imdb_id = 'tt0083866' AND imdb_rating = 7.9;
-- Warfare (2025) 7.1/118346 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '92de6582-14bd-429e-b3a6-5ed37500093b' AND curation_tier = 'extended' AND release_date = '2025-04-09' AND imdb_votes = 118346 AND imdb_id = 'tt31434639' AND imdb_rating = 7.1;
-- Dumb and Dumber (1994) 7.3/449280 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '9321a442-0786-45ad-ad0f-18a1ccb3e528' AND curation_tier = 'extended' AND release_date = '1994-12-16' AND imdb_votes = 449280 AND imdb_id = 'tt0109686' AND imdb_rating = 7.3;

COMMIT;
