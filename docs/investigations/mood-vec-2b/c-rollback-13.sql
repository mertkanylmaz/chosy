-- MOOD-VEC-2b Faz 2C (parça 13/19): c-apply'ın geri alması. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Her UPDATE yalnız uygulanan değerleri taşıyan satırı eski haline (release_date NULL, tier archive) döndürür.

BEGIN;

-- The Electric State (2025) 5.9/88282 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'a5d544d1-bccb-4878-b58a-fa3ad6f1d8be' AND curation_tier = 'extended' AND release_date = '2025-02-24' AND imdb_votes = 88282 AND imdb_id = 'tt7766378' AND imdb_rating = 5.9;
-- The Testament of Ann Lee (2025) 6.4/11062 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'a8695d6c-6ec4-4aae-9501-20ba36a5f10e' AND curation_tier = 'extended' AND release_date = '2025-12-25' AND imdb_votes = 11062 AND imdb_rating = 6.4;
-- The Accountant² (2025) 6.6/138054 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'a872da83-dd53-458d-bdfc-dcdbb6e2d5ff' AND curation_tier = 'extended' AND release_date = '2025-04-23' AND imdb_votes = 138054 AND imdb_id = 'tt7068946' AND imdb_rating = 6.6;
-- The Last King of Scotland (2006) 7.6/207785 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'a8e3c9f8-345c-4ce9-9b93-8c3563d59f9c' AND curation_tier = 'extended' AND release_date = '2006-09-27' AND imdb_votes = 207785 AND imdb_id = 'tt0455590' AND imdb_rating = 7.6;
-- Teenage Mutant Ninja Turtles (2014) 5.8/232526 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'a9b0f1dd-301c-4cb6-a2f8-c41be062c832' AND curation_tier = 'extended' AND release_date = '2014-08-07' AND imdb_votes = 232526 AND imdb_id = 'tt1291150' AND imdb_rating = 5.8;
-- The Banshees of Inisherin (2022) 7.6/301814 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'aa01a9c2-558c-4143-8ba7-59ea2da83b8d' AND curation_tier = 'extended' AND release_date = '2022-10-20' AND imdb_votes = 301814 AND imdb_id = 'tt11813216' AND imdb_rating = 7.6;
-- Shaun of the Dead (2004) 7.8/647067 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'aa78c71c-98e5-4edf-b813-2ce8da6a0fac' AND curation_tier = 'extended' AND release_date = '2004-04-09' AND imdb_votes = 647067 AND imdb_id = 'tt0365748' AND imdb_rating = 7.8;
-- To All the Boys I've Loved Before (2018) 7/143885 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'aae7922c-0dd2-42bf-a5b2-5f5ee6737974' AND curation_tier = 'extended' AND release_date = '2018-08-17' AND imdb_votes = 143885 AND imdb_id = 'tt3846674' AND imdb_rating = 7;
-- A Nightmare on Elm Street (1984) 7.4/297287 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'aaebfbd7-2e9f-4739-aaf6-b40c13e69e68' AND curation_tier = 'extended' AND release_date = '1984-11-09' AND imdb_votes = 297287 AND imdb_id = 'tt0087800' AND imdb_rating = 7.4;
-- Red One (2024) 6.2/162580 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'ab54bd73-7bd9-4ac9-918b-04b771b16687' AND curation_tier = 'extended' AND release_date = '2024-10-31' AND imdb_votes = 162580 AND imdb_rating = 6.2;
-- Instant Family (2018) 7.3/138161 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'ac259d60-c25a-46dc-bc5e-264298bfe7d9' AND curation_tier = 'extended' AND release_date = '2018-11-13' AND imdb_votes = 138161 AND imdb_id = 'tt7401588' AND imdb_rating = 7.3;
-- Independence Day (1996) 7/656432 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'ad650743-9a70-4843-9ccc-ae99ed6d217c' AND curation_tier = 'extended' AND release_date = '1996-07-02' AND imdb_votes = 656432 AND imdb_id = 'tt0116629' AND imdb_rating = 7;
-- Fakülte (1998) 6.6/150656 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'ad8bbb1d-7a93-48ba-8f44-bb4eba256a1d' AND curation_tier = 'extended' AND release_date = '1998-12-25' AND imdb_votes = 150656 AND imdb_rating = 6.6;
-- Me and Earl and the Dying Girl (2015) 7.7/145618 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'ae977e46-eaf2-4d76-b2f4-9202530a9693' AND curation_tier = 'extended' AND release_date = '2015-06-12' AND imdb_votes = 145618 AND imdb_id = 'tt2582496' AND imdb_rating = 7.7;
-- Solo Mio (2026) 6.6/16107 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'b04cc5f7-84d6-4554-bcc0-847843b9ee32' AND curation_tier = 'extended' AND release_date = '2026-02-05' AND imdb_votes = 16107 AND imdb_rating = 6.6;
-- The Hunt for Red October (1990) 7.5/235168 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'b1076760-4ff5-47bb-ab7b-74b719f727bc' AND curation_tier = 'extended' AND release_date = '1990-03-02' AND imdb_votes = 235168 AND imdb_id = 'tt0099810' AND imdb_rating = 7.5;
-- The Unforgivable (2021) 7.2/130428 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'b133a54f-308a-4574-ad4d-76cb30a48490' AND curation_tier = 'extended' AND release_date = '2021-11-24' AND imdb_votes = 130428 AND imdb_id = 'tt11233960' AND imdb_rating = 7.2;
-- The Incredible Hulk (2008) 6.6/580813 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'b147a5e8-22f3-4f68-acf1-07a5f384e549' AND curation_tier = 'extended' AND release_date = '2008-06-12' AND imdb_votes = 580813 AND imdb_id = 'tt0800080' AND imdb_rating = 6.6;
-- The Hobbit: The Desolation of Smaug (2013) 7.8/763834 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'b2abed8c-cf73-4950-aa27-d9b163a2b52e' AND curation_tier = 'extended' AND release_date = '2013-12-11' AND imdb_votes = 763834 AND imdb_id = 'tt1170358' AND imdb_rating = 7.8;
-- Captain America: The Winter Soldier (2014) 7.7/994588 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'b2b31533-25cb-48c8-8062-dfd321efc989' AND curation_tier = 'extended' AND release_date = '2014-03-20' AND imdb_votes = 994588 AND imdb_id = 'tt1843866' AND imdb_rating = 7.7;
-- The Favourite (2018) 7.5/262194 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'b2cca4ec-9871-4417-88ef-a6cd96512bb7' AND curation_tier = 'extended' AND release_date = '2018-11-23' AND imdb_votes = 262194 AND imdb_id = 'tt5083738' AND imdb_rating = 7.5;

COMMIT;
