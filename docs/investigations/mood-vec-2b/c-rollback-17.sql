-- MOOD-VEC-2b Faz 2C (parça 17/19): c-apply'ın geri alması. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Her UPDATE yalnız uygulanan değerleri taşıyan satırı eski haline (release_date NULL, tier archive) döndürür.

BEGIN;

-- The Witcher: Nightmare of the Wolf (2021) 7.2/55846 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'dceaf443-4052-4bc5-b986-5103425a4098' AND curation_tier = 'extended' AND release_date = '2021-08-22' AND imdb_votes = 55846 AND imdb_id = 'tt11657662' AND imdb_rating = 7.2;
-- Farewell, My Lovely (1975) 7/11193 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'dcf88f3e-8936-43b6-aab7-8df57b60ac34' AND curation_tier = 'extended' AND release_date = '1975-08-08' AND imdb_votes = 11193 AND imdb_rating = 7;
-- Bram Stoker's Dracula (1992) 7.4/272534 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'dd049035-3120-4feb-bd79-a51bf9eb297c' AND curation_tier = 'extended' AND release_date = '1992-11-13' AND imdb_votes = 272534 AND imdb_id = 'tt0103874' AND imdb_rating = 7.4;
-- The Hundred-Foot Journey (2014) 7.3/92220 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'dd0803f3-57fc-4ef4-bc80-ade33542da88' AND curation_tier = 'extended' AND release_date = '2014-08-06' AND imdb_votes = 92220 AND imdb_rating = 7.3;
-- Kong: Skull Island (2017) 6.7/380330 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'dd35086e-1a7a-4bfc-9c2b-1407834d3f04' AND curation_tier = 'extended' AND release_date = '2017-03-08' AND imdb_votes = 380330 AND imdb_id = 'tt3731562' AND imdb_rating = 6.7;
-- The Name of the Rose (1986) 7.7/129222 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'dda69a85-5a6a-4d90-8b0f-6c2cfba64c60' AND curation_tier = 'extended' AND release_date = '1986-09-24' AND imdb_votes = 129222 AND imdb_id = 'tt0091605' AND imdb_rating = 7.7;
-- Ocean's Eleven (2001) 7.7/687132 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'ddf32d20-9c85-4f78-98db-ca0cfb417d8d' AND curation_tier = 'extended' AND release_date = '2001-12-07' AND imdb_votes = 687132 AND imdb_id = 'tt0240772' AND imdb_rating = 7.7;
-- Bring Her Back (2025) 7.1/144598 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'df254bec-27bd-4e17-9cf2-8365067c2dd5' AND curation_tier = 'extended' AND release_date = '2025-05-19' AND imdb_votes = 144598 AND imdb_id = 'tt32246771' AND imdb_rating = 7.1;
-- Enola Holmes (2020) 6.7/256612 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'e0a69f79-1fca-4d68-abba-574eb5df43fa' AND curation_tier = 'extended' AND release_date = '2020-09-22' AND imdb_votes = 256612 AND imdb_rating = 6.7;
-- The Raid 2 (2014) 7.9/141038 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'e105ec3e-5661-432b-9f2c-2914bb0d8863' AND curation_tier = 'extended' AND release_date = '2014-03-27' AND imdb_votes = 141038 AND imdb_id = 'tt2265171' AND imdb_rating = 7.9;
-- It (2017) 7.3/714208 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'e11c307c-4b48-4a58-a60a-c5e6ca5cad2c' AND curation_tier = 'extended' AND release_date = '2017-09-06' AND imdb_votes = 714208 AND imdb_rating = 7.3;
-- 27 Dresses (2008) 6.2/195829 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'e3e6a469-9867-4f23-a8b5-9f6a4f835b46' AND curation_tier = 'extended' AND release_date = '2008-01-10' AND imdb_votes = 195829 AND imdb_id = 'tt0988595' AND imdb_rating = 6.2;
-- Ray (2004) 7.7/167722 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'e3ffc0b9-e197-4890-9b1f-cd3c4379635a' AND curation_tier = 'extended' AND release_date = '2004-10-29' AND imdb_votes = 167722 AND imdb_id = 'tt0350258' AND imdb_rating = 7.7;
-- Upgrade (2018) 7.5/239716 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'e509845a-c161-4761-8321-c208022374c2' AND curation_tier = 'extended' AND release_date = '2018-05-31' AND imdb_votes = 239716 AND imdb_id = 'tt6499752' AND imdb_rating = 7.5;
-- Sisu (2022) 6.9/127084 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'e5e6b53b-0ae8-43ca-beb0-0acaa5af7d5d' AND curation_tier = 'extended' AND release_date = '2022-09-09' AND imdb_votes = 127084 AND imdb_id = 'tt14846026' AND imdb_rating = 6.9;
-- Play Dirty (2025) 5.9/30063 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'e71db524-3c8f-4d35-8053-b85ac14090c0' AND curation_tier = 'extended' AND release_date = '2025-09-30' AND imdb_votes = 30063 AND imdb_rating = 5.9;
-- King Kong (2005) 7.2/476138 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'e7360d83-4261-4c35-b573-3d84674ef1fb' AND curation_tier = 'extended' AND release_date = '2005-12-12' AND imdb_votes = 476138 AND imdb_id = 'tt0360717' AND imdb_rating = 7.2;
-- Bad Boys II (2003) 6.6/291681 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'e73f356a-0ebf-44ef-97a0-88fc8e3566e8' AND curation_tier = 'extended' AND release_date = '2003-07-18' AND imdb_votes = 291681 AND imdb_id = 'tt0172156' AND imdb_rating = 6.6;
-- If I Had Legs I'd Kick You (2025) 6.6/42741 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'e796d05d-86d1-4210-be55-4700a5818d81' AND curation_tier = 'extended' AND release_date = '2025-10-10' AND imdb_votes = 42741 AND imdb_id = 'tt18382850' AND imdb_rating = 6.6;
-- The Magnificent Seven (2016) 6.9/250170 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'e8cf68d7-748c-44e7-8993-69b372136e2b' AND curation_tier = 'extended' AND release_date = '2016-09-14' AND imdb_votes = 250170 AND imdb_id = 'tt2404435' AND imdb_rating = 6.9;
-- Gladiator (1992) 6.6/12061 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'e9918708-ed1b-43c4-98b2-2ee3c18c3a1a' AND curation_tier = 'extended' AND release_date = '1992-03-06' AND imdb_votes = 12061 AND imdb_id = 'tt0104346' AND imdb_rating = 6.6;

COMMIT;
