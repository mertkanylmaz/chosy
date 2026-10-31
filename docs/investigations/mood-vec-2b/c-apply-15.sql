-- MOOD-VEC-2b Faz 2C (parça 15/19): 22 arşiv filminin release_date[/imdb_id] + imdb_votes[/imdb_rating] + curation_tier'ı. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Kaynak: TMDb (release_date, imdb_id) + IMDb veri dosyası (oy/rating). Her UPDATE filmin hâlâ archive + release_date NULL + oyun eski değerde olduğunu doğrular.
-- Beklenen: 22 UPDATE × 1 satır.

BEGIN;

CREATE TABLE films_phase2c_backup_20261031_15 AS
  SELECT id, imdb_id, imdb_rating, imdb_votes, release_date, curation_tier FROM films WHERE id IN ('c1ad63f5-17dc-41de-acd2-dde9448b0c44', 'c1bb5f92-119b-4f79-bb62-9e8889bfe5d0', 'c284851d-5cb2-4605-aa87-1d0de6f326cd', 'c294c9b2-7bbb-4d1e-b806-ecf5fb70311f', 'c312e0b5-2d3f-44e6-b9b3-2ff3d4ffab3c', 'c4674bdf-3ca6-4c6c-bacb-748ca33afb4c', 'c604baf1-b034-4db4-920d-58bfd90fe6ff', 'c6d6654f-ea18-4635-a876-49294e295076', 'c6d6d563-c537-42bb-9c18-2dad55affa0c', 'c9bad052-079c-4196-b4ca-5fee393c9d11', 'ca143b9f-14d1-4050-8c5f-3733dc4dfd57', 'cb370633-e568-4e69-b007-e45ef24f09e9', 'cb5e0457-35ed-420b-ad30-5bb600427e0b', 'cb6380c3-c974-44c4-ae05-7d053585a3cd', 'cb766746-a7f1-4cf6-a14d-138ecc743932', 'cd784d4b-1bf6-4eee-a7fb-e90bbca22783', 'cf54f3dd-62c1-40a0-8724-bfe9d896ec2c', 'cfc44b9b-3c11-4c61-b337-c752e37d477f', 'cfd99fe8-06ea-41ac-bbad-a9789fa80309', 'd0bbba25-d3b9-4eb9-bf19-4c15409e565b', 'd13cb5d9-53f8-4846-bc1c-6e4072de4494', 'd18c11b4-4b28-459f-8e7f-0f4d3b89cbc5');
ALTER TABLE films_phase2c_backup_20261031_15 ENABLE ROW LEVEL SECURITY;

-- Now You See Me (2013) 7.2/780991 → extended
UPDATE films SET release_date = '2013-05-29', imdb_id = 'tt1670345', imdb_votes = 780991, imdb_rating = 7.2, curation_tier = 'extended' WHERE id = 'c1ad63f5-17dc-41de-acd2-dde9448b0c44' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Black Cat, White Cat (1998) 8/59409 → core
UPDATE films SET release_date = '1998-06-01', imdb_id = 'tt0118843', imdb_votes = 59409, imdb_rating = 8, curation_tier = 'core' WHERE id = 'c1bb5f92-119b-4f79-bb62-9e8889bfe5d0' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Groundhog Day (1993) 8/742702 → core
UPDATE films SET release_date = '1993-02-11', imdb_id = 'tt0107048', imdb_votes = 742702, imdb_rating = 8, curation_tier = 'core' WHERE id = 'c284851d-5cb2-4605-aa87-1d0de6f326cd' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Boyhood (2014) 7.9/384522 → extended
UPDATE films SET release_date = '2014-06-05', imdb_id = 'tt1065073', imdb_votes = 384522, imdb_rating = 7.9, curation_tier = 'extended' WHERE id = 'c294c9b2-7bbb-4d1e-b806-ecf5fb70311f' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Interstella 5555: The 5tory of the 5ecret 5tar 5ystem (2003) 7.8/18073 → extended
UPDATE films SET release_date = '2003-05-28', imdb_id = 'tt0368667', imdb_votes = 18073, imdb_rating = 7.8, curation_tier = 'extended' WHERE id = 'c312e0b5-2d3f-44e6-b9b3-2ff3d4ffab3c' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Torrente, the Dumb Arm of the Law (1998) 6.8/15583 → extended
UPDATE films SET release_date = '1998-03-13', imdb_votes = 15583, imdb_rating = 6.8, curation_tier = 'extended' WHERE id = 'c4674bdf-3ca6-4c6c-bacb-748ca33afb4c' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Hard Boiled (1992) 7.7/61031 → extended
UPDATE films SET release_date = '1992-04-16', imdb_id = 'tt0104684', imdb_votes = 61031, imdb_rating = 7.7, curation_tier = 'extended' WHERE id = 'c604baf1-b034-4db4-920d-58bfd90fe6ff' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Free Guy (2021) 7.1/500304 → extended
UPDATE films SET release_date = '2021-08-11', imdb_id = 'tt6264654', imdb_votes = 500304, imdb_rating = 7.1, curation_tier = 'extended' WHERE id = 'c6d6654f-ea18-4635-a876-49294e295076' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Letters from Iwo Jima (2006) 7.8/178620 → extended
UPDATE films SET release_date = '2006-12-09', imdb_id = 'tt0498380', imdb_votes = 178620, imdb_rating = 7.8, curation_tier = 'extended' WHERE id = 'c6d6d563-c537-42bb-9c18-2dad55affa0c' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Book of Life (2014) 7.2/86098 → extended
UPDATE films SET release_date = '2014-10-01', imdb_id = 'tt2262227', imdb_votes = 86098, imdb_rating = 7.2, curation_tier = 'extended' WHERE id = 'c9bad052-079c-4196-b4ca-5fee393c9d11' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Training Day (2001) 7.8/528414 → extended
UPDATE films SET release_date = '2001-10-05', imdb_id = 'tt0139654', imdb_votes = 528414, imdb_rating = 7.8, curation_tier = 'extended' WHERE id = 'ca143b9f-14d1-4050-8c5f-3733dc4dfd57' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Ghostbusters (1984) 7.8/492877 → extended
UPDATE films SET release_date = '1984-06-08', imdb_id = 'tt0087332', imdb_votes = 492877, imdb_rating = 7.8, curation_tier = 'extended' WHERE id = 'cb370633-e568-4e69-b007-e45ef24f09e9' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Voices (2014) 6.3/67539 → extended
UPDATE films SET release_date = '2014-01-19', imdb_votes = 67539, imdb_rating = 6.3, curation_tier = 'extended' WHERE id = 'cb5e0457-35ed-420b-ad30-5bb600427e0b' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Almost Famous (2000) 7.9/318750 → extended
UPDATE films SET release_date = '2000-09-15', imdb_id = 'tt0181875', imdb_votes = 318750, imdb_rating = 7.9, curation_tier = 'extended' WHERE id = 'cb6380c3-c974-44c4-ae05-7d053585a3cd' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Tank (2025) 6.5/17329 → extended
UPDATE films SET release_date = '2025-09-18', imdb_votes = 17329, imdb_rating = 6.5, curation_tier = 'extended' WHERE id = 'cb766746-a7f1-4cf6-a14d-138ecc743932' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Non si deve profanare il sonno dei morti (1974) 6.7/10741 → extended
UPDATE films SET release_date = '1974-11-28', imdb_votes = 10741, imdb_rating = 6.7, curation_tier = 'extended' WHERE id = 'cd784d4b-1bf6-4eee-a7fb-e90bbca22783' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Bacurau (2019) 7.3/35602 → extended
UPDATE films SET release_date = '2019-08-29', imdb_id = 'tt2762506', imdb_votes = 35602, imdb_rating = 7.3, curation_tier = 'extended' WHERE id = 'cf54f3dd-62c1-40a0-8724-bfe9d896ec2c' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- We Need to Talk About Kevin (2011) 7.4/184313 → extended
UPDATE films SET release_date = '2011-09-28', imdb_id = 'tt1242460', imdb_votes = 184313, imdb_rating = 7.4, curation_tier = 'extended' WHERE id = 'cfc44b9b-3c11-4c61-b337-c752e37d477f' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Dead Silence (2007) 6.2/110237 → extended
UPDATE films SET release_date = '2007-03-16', imdb_votes = 110237, imdb_rating = 6.2, curation_tier = 'extended' WHERE id = 'cfd99fe8-06ea-41ac-bbad-a9789fa80309' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- War of the Worlds (2005) 6.6/516210 → extended
UPDATE films SET release_date = '2005-06-28', imdb_id = 'tt0407304', imdb_votes = 516210, imdb_rating = 6.6, curation_tier = 'extended' WHERE id = 'd0bbba25-d3b9-4eb9-bf19-4c15409e565b' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- X (2022) 6.5/231426 → extended
UPDATE films SET release_date = '2022-03-17', imdb_id = 'tt13560574', imdb_votes = 231426, imdb_rating = 6.5, curation_tier = 'extended' WHERE id = 'd13cb5d9-53f8-4846-bc1c-6e4072de4494' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- 2012 (2009) 5.9/428527 → extended
UPDATE films SET release_date = '2009-10-10', imdb_votes = 428527, imdb_rating = 5.9, curation_tier = 'extended' WHERE id = 'd18c11b4-4b28-459f-8e7f-0f4d3b89cbc5' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;

DO $$
DECLARE _backup INT; _unchanged INT;
BEGIN
  SELECT count(*) INTO _backup FROM films_phase2c_backup_20261031_15;
  SELECT count(*) INTO _unchanged FROM films f JOIN films_phase2c_backup_20261031_15 b ON b.id = f.id WHERE f.curation_tier = b.curation_tier;
  IF _backup <> 22 THEN RAISE EXCEPTION 'ABORT: yedek % satir (beklenen 22)', _backup; END IF;
  IF _unchanged <> 0 THEN RAISE EXCEPTION 'ABORT: % film degismedi (UPDATE 0 satir etkiledi)', _unchanged; END IF;
END $$;

COMMIT;
