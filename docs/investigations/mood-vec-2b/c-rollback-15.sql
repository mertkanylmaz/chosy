-- MOOD-VEC-2b Faz 2C (parça 15/19): c-apply'ın geri alması. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Her UPDATE yalnız uygulanan değerleri taşıyan satırı eski haline (release_date NULL, tier archive) döndürür.

BEGIN;

-- Now You See Me (2013) 7.2/780991 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'c1ad63f5-17dc-41de-acd2-dde9448b0c44' AND curation_tier = 'extended' AND release_date = '2013-05-29' AND imdb_votes = 780991 AND imdb_id = 'tt1670345' AND imdb_rating = 7.2;
-- Black Cat, White Cat (1998) 8/59409 → core
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'c1bb5f92-119b-4f79-bb62-9e8889bfe5d0' AND curation_tier = 'core' AND release_date = '1998-06-01' AND imdb_votes = 59409 AND imdb_id = 'tt0118843' AND imdb_rating = 8;
-- Groundhog Day (1993) 8/742702 → core
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'c284851d-5cb2-4605-aa87-1d0de6f326cd' AND curation_tier = 'core' AND release_date = '1993-02-11' AND imdb_votes = 742702 AND imdb_id = 'tt0107048' AND imdb_rating = 8;
-- Boyhood (2014) 7.9/384522 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'c294c9b2-7bbb-4d1e-b806-ecf5fb70311f' AND curation_tier = 'extended' AND release_date = '2014-06-05' AND imdb_votes = 384522 AND imdb_id = 'tt1065073' AND imdb_rating = 7.9;
-- Interstella 5555: The 5tory of the 5ecret 5tar 5ystem (2003) 7.8/18073 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'c312e0b5-2d3f-44e6-b9b3-2ff3d4ffab3c' AND curation_tier = 'extended' AND release_date = '2003-05-28' AND imdb_votes = 18073 AND imdb_id = 'tt0368667' AND imdb_rating = 7.8;
-- Torrente, the Dumb Arm of the Law (1998) 6.8/15583 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'c4674bdf-3ca6-4c6c-bacb-748ca33afb4c' AND curation_tier = 'extended' AND release_date = '1998-03-13' AND imdb_votes = 15583 AND imdb_rating = 6.8;
-- Hard Boiled (1992) 7.7/61031 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'c604baf1-b034-4db4-920d-58bfd90fe6ff' AND curation_tier = 'extended' AND release_date = '1992-04-16' AND imdb_votes = 61031 AND imdb_id = 'tt0104684' AND imdb_rating = 7.7;
-- Free Guy (2021) 7.1/500304 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'c6d6654f-ea18-4635-a876-49294e295076' AND curation_tier = 'extended' AND release_date = '2021-08-11' AND imdb_votes = 500304 AND imdb_id = 'tt6264654' AND imdb_rating = 7.1;
-- Letters from Iwo Jima (2006) 7.8/178620 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'c6d6d563-c537-42bb-9c18-2dad55affa0c' AND curation_tier = 'extended' AND release_date = '2006-12-09' AND imdb_votes = 178620 AND imdb_id = 'tt0498380' AND imdb_rating = 7.8;
-- The Book of Life (2014) 7.2/86098 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'c9bad052-079c-4196-b4ca-5fee393c9d11' AND curation_tier = 'extended' AND release_date = '2014-10-01' AND imdb_votes = 86098 AND imdb_id = 'tt2262227' AND imdb_rating = 7.2;
-- Training Day (2001) 7.8/528414 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'ca143b9f-14d1-4050-8c5f-3733dc4dfd57' AND curation_tier = 'extended' AND release_date = '2001-10-05' AND imdb_votes = 528414 AND imdb_id = 'tt0139654' AND imdb_rating = 7.8;
-- Ghostbusters (1984) 7.8/492877 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'cb370633-e568-4e69-b007-e45ef24f09e9' AND curation_tier = 'extended' AND release_date = '1984-06-08' AND imdb_votes = 492877 AND imdb_id = 'tt0087332' AND imdb_rating = 7.8;
-- The Voices (2014) 6.3/67539 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'cb5e0457-35ed-420b-ad30-5bb600427e0b' AND curation_tier = 'extended' AND release_date = '2014-01-19' AND imdb_votes = 67539 AND imdb_rating = 6.3;
-- Almost Famous (2000) 7.9/318750 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'cb6380c3-c974-44c4-ae05-7d053585a3cd' AND curation_tier = 'extended' AND release_date = '2000-09-15' AND imdb_votes = 318750 AND imdb_id = 'tt0181875' AND imdb_rating = 7.9;
-- Tank (2025) 6.5/17329 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'cb766746-a7f1-4cf6-a14d-138ecc743932' AND curation_tier = 'extended' AND release_date = '2025-09-18' AND imdb_votes = 17329 AND imdb_rating = 6.5;
-- Non si deve profanare il sonno dei morti (1974) 6.7/10741 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'cd784d4b-1bf6-4eee-a7fb-e90bbca22783' AND curation_tier = 'extended' AND release_date = '1974-11-28' AND imdb_votes = 10741 AND imdb_rating = 6.7;
-- Bacurau (2019) 7.3/35602 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'cf54f3dd-62c1-40a0-8724-bfe9d896ec2c' AND curation_tier = 'extended' AND release_date = '2019-08-29' AND imdb_votes = 35602 AND imdb_id = 'tt2762506' AND imdb_rating = 7.3;
-- We Need to Talk About Kevin (2011) 7.4/184313 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'cfc44b9b-3c11-4c61-b337-c752e37d477f' AND curation_tier = 'extended' AND release_date = '2011-09-28' AND imdb_votes = 184313 AND imdb_id = 'tt1242460' AND imdb_rating = 7.4;
-- Dead Silence (2007) 6.2/110237 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'cfd99fe8-06ea-41ac-bbad-a9789fa80309' AND curation_tier = 'extended' AND release_date = '2007-03-16' AND imdb_votes = 110237 AND imdb_rating = 6.2;
-- War of the Worlds (2005) 6.6/516210 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'd0bbba25-d3b9-4eb9-bf19-4c15409e565b' AND curation_tier = 'extended' AND release_date = '2005-06-28' AND imdb_votes = 516210 AND imdb_id = 'tt0407304' AND imdb_rating = 6.6;
-- X (2022) 6.5/231426 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'd13cb5d9-53f8-4846-bc1c-6e4072de4494' AND curation_tier = 'extended' AND release_date = '2022-03-17' AND imdb_votes = 231426 AND imdb_id = 'tt13560574' AND imdb_rating = 6.5;
-- 2012 (2009) 5.9/428527 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'd18c11b4-4b28-459f-8e7f-0f4d3b89cbc5' AND curation_tier = 'extended' AND release_date = '2009-10-10' AND imdb_votes = 428527 AND imdb_rating = 5.9;

COMMIT;
