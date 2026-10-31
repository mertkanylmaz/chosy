-- MOOD-VEC-2b Faz 2C (parça 16/19): c-apply'ın geri alması. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Her UPDATE yalnız uygulanan değerleri taşıyan satırı eski haline (release_date NULL, tier archive) döndürür.

BEGIN;

-- Rio (2011) 6.9/278914 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'd252966b-0968-400c-a918-69dc905aff64' AND curation_tier = 'extended' AND release_date = '2011-04-03' AND imdb_votes = 278914 AND imdb_id = 'tt1436562' AND imdb_rating = 6.9;
-- Bridesmaids (2011) 6.8/329238 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'd3c52089-4d58-4002-8fda-fc1acadb54e2' AND curation_tier = 'extended' AND release_date = '2011-05-13' AND imdb_votes = 329238 AND imdb_id = 'tt1478338' AND imdb_rating = 6.8;
-- Alfie (1966) 7/17056 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'd40fdddf-5435-4be6-ad94-a43380b7e1d3' AND curation_tier = 'extended' AND release_date = '1966-03-29' AND imdb_votes = 17056 AND imdb_rating = 7;
-- Liar Liar (1997) 6.9/368179 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'd4ecf4c8-c80b-4de1-9aa0-3e5c47e60a7c' AND curation_tier = 'extended' AND release_date = '1997-03-21' AND imdb_votes = 368179 AND imdb_rating = 6.9;
-- Onward (2020) 7.3/190217 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'd4ee2252-84bf-47f4-b125-c51b51b8290b' AND curation_tier = 'extended' AND release_date = '2020-02-29' AND imdb_votes = 190217 AND imdb_id = 'tt7146812' AND imdb_rating = 7.3;
-- Günahkârlar (2025) 7.5/536290 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'd54e3a9c-c3ce-4cdb-9a50-eddad7ed0932' AND curation_tier = 'extended' AND release_date = '2025-04-16' AND imdb_votes = 536290 AND imdb_rating = 7.5;
-- Treasure Planet (2002) 7.2/151326 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'd59969b7-24cd-49cf-9aeb-9e6debc095ec' AND curation_tier = 'extended' AND release_date = '2002-11-26' AND imdb_votes = 151326 AND imdb_id = 'tt0133240' AND imdb_rating = 7.2;
-- Friday the 13th (1980) 6.3/180804 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'd6503943-a4fb-4401-a88b-78e9ba30dd8a' AND curation_tier = 'extended' AND release_date = '1980-05-09' AND imdb_votes = 180804 AND imdb_id = 'tt0080761' AND imdb_rating = 6.3;
-- The Others (2001) 7.6/434733 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'd72db544-1aff-4688-8b78-96009379354d' AND curation_tier = 'extended' AND release_date = '2001-08-02' AND imdb_votes = 434733 AND imdb_id = 'tt0230600' AND imdb_rating = 7.6;
-- I Swear (2025) 8.3/71330 → core
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'd75cb3c5-bc77-449e-8af6-92ba107cae41' AND curation_tier = 'core' AND release_date = '2025-09-22' AND imdb_votes = 71330 AND imdb_rating = 8.3;
-- Barfi! (2012) 8.1/95278 → core
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'd7910765-666d-48a0-abf2-f43c356e3809' AND curation_tier = 'core' AND release_date = '2012-09-13' AND imdb_votes = 95278 AND imdb_id = 'tt2082197' AND imdb_rating = 8.1;
-- Paul, Apostle of Christ (2018) 6.7/11714 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'd8edc243-0be6-47c5-a0c6-492c466a45e9' AND curation_tier = 'extended' AND release_date = '2018-03-22' AND imdb_votes = 11714 AND imdb_id = 'tt7388562' AND imdb_rating = 6.7;
-- Code 3 (2025) 7.2/23116 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'd8fbdb58-318b-4b9d-a307-a45688133798' AND curation_tier = 'extended' AND release_date = '2025-09-12' AND imdb_votes = 23116 AND imdb_id = 'tt26394837' AND imdb_rating = 7.2;
-- Where the Crawdads Sing (2022) 7.2/162070 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'd916cfbf-faac-4c03-ae4e-36286bdf667e' AND curation_tier = 'extended' AND release_date = '2022-07-14' AND imdb_votes = 162070 AND imdb_id = 'tt9411972' AND imdb_rating = 7.2;
-- Aladdin (2019) 6.9/320799 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'd92822cd-e809-4943-b1a1-9acd5aa796dd' AND curation_tier = 'extended' AND release_date = '2019-05-22' AND imdb_votes = 320799 AND imdb_id = 'tt6139732' AND imdb_rating = 6.9;
-- Heads of State (2025) 6.4/73336 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'da17a8f1-c718-41ec-a1bf-cde2539e7d35' AND curation_tier = 'extended' AND release_date = '2025-06-24' AND imdb_votes = 73336 AND imdb_id = 'tt13357520' AND imdb_rating = 6.4;
-- The Butterfly Effect (2004) 7.6/563361 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'da9f43d4-93ba-42bc-abd2-73cb94e5f0cb' AND curation_tier = 'extended' AND release_date = '2004-01-17' AND imdb_votes = 563361 AND imdb_id = 'tt0289879' AND imdb_rating = 7.6;
-- Eternals (2021) 6.2/439532 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'dc24b447-2f02-414b-977f-4de17877ee90' AND curation_tier = 'extended' AND release_date = '2021-11-03' AND imdb_votes = 439532 AND imdb_id = 'tt9032400' AND imdb_rating = 6.2;
-- Still Alice (2014) 7.5/152152 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'dc7bd17f-80a2-4f43-bad3-17657e4ce894' AND curation_tier = 'extended' AND release_date = '2014-12-05' AND imdb_votes = 152152 AND imdb_id = 'tt3316960' AND imdb_rating = 7.5;
-- Charlie and the Chocolate Factory (2005) 6.7/580870 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'dc817b72-829d-43ad-9f82-a3db2f1063cf' AND curation_tier = 'extended' AND release_date = '2005-07-13' AND imdb_votes = 580870 AND imdb_id = 'tt0367594' AND imdb_rating = 6.7;
-- Shrek the Third (2007) 6.1/366782 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'dcd1b6d2-4270-4c33-8683-19492313b910' AND curation_tier = 'extended' AND release_date = '2007-05-17' AND imdb_votes = 366782 AND imdb_id = 'tt0413267' AND imdb_rating = 6.1;

COMMIT;
