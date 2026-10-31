-- MOOD-VEC-2b Faz 2C (parça 6/19): c-apply'ın geri alması. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Her UPDATE yalnız uygulanan değerleri taşıyan satırı eski haline (release_date NULL, tier archive) döndürür.

BEGIN;

-- The Purple Rose of Cairo (1985) 7.6/58593 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '4eaeef89-556f-43ac-bc15-1d968b39ab50' AND curation_tier = 'extended' AND release_date = '1985-03-01' AND imdb_votes = 58593 AND imdb_id = 'tt0089853' AND imdb_rating = 7.6;
-- The Princess Bride (1987) 8/492695 → core
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '4ebd2e6d-960e-465f-b9c4-26656a3a7ef4' AND curation_tier = 'core' AND release_date = '1987-09-25' AND imdb_votes = 492695 AND imdb_id = 'tt0093779' AND imdb_rating = 8;
-- Pretty Woman (1990) 7.1/413789 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '4ed0f20c-b4db-43d3-b028-fd67fb9feb7a' AND curation_tier = 'extended' AND release_date = '1990-03-23' AND imdb_votes = 413789 AND imdb_id = 'tt0100405' AND imdb_rating = 7.1;
-- The Quiet Girl (2022) 7.7/30218 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '4ee7f4f4-41aa-4113-858d-11a54e3b9751' AND curation_tier = 'extended' AND release_date = '2022-05-12' AND imdb_votes = 30218 AND imdb_id = 'tt15109082' AND imdb_rating = 7.7;
-- Çığlık 6 (2023) 6.4/156989 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '4fad1aa3-4b9a-4dff-aeff-b7fa63d68851' AND curation_tier = 'extended' AND release_date = '2023-03-08' AND imdb_votes = 156989 AND imdb_rating = 6.4;
-- Ant-Man (2015) 7.2/798889 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '506deb6a-2e79-4e92-b6ec-d3c539910719' AND curation_tier = 'extended' AND release_date = '2015-07-14' AND imdb_votes = 798889 AND imdb_rating = 7.2;
-- The Ugly Stepsister (2025) 7/50120 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '5091cc5f-6231-41a0-9539-7a34016856fb' AND curation_tier = 'extended' AND release_date = '2025-03-07' AND imdb_votes = 50120 AND imdb_rating = 7;
-- The Amateur (2025) 6.5/104791 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '50db5aa5-65e5-4904-9397-a7a143f58f3a' AND curation_tier = 'extended' AND release_date = '2025-04-09' AND imdb_votes = 104791 AND imdb_id = 'tt0899043' AND imdb_rating = 6.5;
-- Tropic Thunder (2008) 7.1/499696 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '51172771-304e-4727-a383-6e3b179bfe4b' AND curation_tier = 'extended' AND release_date = '2008-08-09' AND imdb_votes = 499696 AND imdb_id = 'tt0942385' AND imdb_rating = 7.1;
-- My Left Foot: The Story of Christy Brown (1989) 7.8/86266 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '51f59189-488e-4c26-a318-d9b5d09286a1' AND curation_tier = 'extended' AND release_date = '1989-04-07' AND imdb_votes = 86266 AND imdb_id = 'tt0097937' AND imdb_rating = 7.8;
-- Predestination (2014) 7.4/342646 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '523c4862-e8f8-4f4b-856d-18a6c507610e' AND curation_tier = 'extended' AND release_date = '2014-08-28' AND imdb_votes = 342646 AND imdb_id = 'tt2397535' AND imdb_rating = 7.4;
-- Lethal Weapon (1987) 7.6/299804 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '542925e1-ece4-40f6-95e7-d5acf43c832c' AND curation_tier = 'extended' AND release_date = '1987-03-06' AND imdb_votes = 299804 AND imdb_id = 'tt0093409' AND imdb_rating = 7.6;
-- The Croods: A New Age (2020) 6.9/63398 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '547b0218-3c24-41bb-b6d5-495adc39f851' AND curation_tier = 'extended' AND release_date = '2020-11-25' AND imdb_votes = 63398 AND imdb_id = 'tt2850386' AND imdb_rating = 6.9;
-- Captain Phillips (2013) 7.8/524205 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '57f9d029-4ff1-407b-86e1-43e8169034f8' AND curation_tier = 'extended' AND release_date = '2013-10-10' AND imdb_votes = 524205 AND imdb_id = 'tt1535109' AND imdb_rating = 7.8;
-- Richard Jewell (2019) 7.5/109250 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '58103526-9821-49a1-b62f-945eae0d7e1e' AND curation_tier = 'extended' AND release_date = '2019-12-13' AND imdb_votes = 109250 AND imdb_id = 'tt3513548' AND imdb_rating = 7.5;
-- X-Men: Days of Future Past (2014) 7.9/800595 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '58e965db-c419-4a90-a183-7496ffe5e292' AND curation_tier = 'extended' AND release_date = '2014-05-15' AND imdb_votes = 800595 AND imdb_id = 'tt1877832' AND imdb_rating = 7.9;
-- Pirates of the Caribbean: Dead Men Tell No Tales (2017) 6.5/393614 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '5937e00f-3601-4907-9f8a-189f9f9f432d' AND curation_tier = 'extended' AND release_date = '2017-05-23' AND imdb_votes = 393614 AND imdb_id = 'tt1790809' AND imdb_rating = 6.5;
-- The Reader (2008) 7.6/276151 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '59925d86-e640-49ee-82aa-93a083b3ae2c' AND curation_tier = 'extended' AND release_date = '2008-12-10' AND imdb_votes = 276151 AND imdb_id = 'tt0976051' AND imdb_rating = 7.6;
-- The Alamo (2004) 6.1/23908 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '5aac58b3-0fc5-4833-8b1f-062212897fad' AND curation_tier = 'extended' AND release_date = '2004-04-07' AND imdb_votes = 23908 AND imdb_rating = 6.1;
-- Indiana Jones and the Dial of Destiny (2023) 6.5/238055 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '5ba231a7-2b54-41db-9748-f423fd868ad6' AND curation_tier = 'extended' AND release_date = '2023-06-25' AND imdb_votes = 238055 AND imdb_id = 'tt1462764' AND imdb_rating = 6.5;
-- The Greatest Beer Run Ever (2022) 6.8/38475 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '5bfc56d9-4bf3-4fd1-a5e5-ac6f5cccb45d' AND curation_tier = 'extended' AND release_date = '2022-09-23' AND imdb_votes = 38475 AND imdb_id = 'tt10268488' AND imdb_rating = 6.8;

COMMIT;
