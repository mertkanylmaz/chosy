-- MOOD-VEC-2b Faz 2C (parça 19/19): 14 arşiv filminin release_date[/imdb_id] + imdb_votes[/imdb_rating] + curation_tier'ı. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Kaynak: TMDb (release_date, imdb_id) + IMDb veri dosyası (oy/rating). Her UPDATE filmin hâlâ archive + release_date NULL + oyun eski değerde olduğunu doğrular.
-- Beklenen: 14 UPDATE × 1 satır.

BEGIN;

CREATE TABLE films_phase2c_backup_20261031_19 AS
  SELECT id, imdb_id, imdb_rating, imdb_votes, release_date, curation_tier FROM films WHERE id IN ('f806fed3-4e69-47d7-a2bf-f1d75d16420f', 'f81715cf-84ec-4cd2-907d-b9269ea2bf7a', 'f8a8cc67-d3f4-4e68-b74c-fb0614bdb581', 'f8d6fa68-f2ce-411f-9338-a9ce2b426bc9', 'f8dd0980-71d2-4797-a213-588445ed12fc', 'faf04bbd-fbdc-45ca-8d3e-4b02b0918a1b', 'fd28e942-d253-4a99-b7e7-a30d49b87d70', 'fd3b6d8d-4804-4f59-b88d-0f1aa5b4ea73', 'fdb2699d-1f36-4f41-8f77-71f67b9c3014', 'fdc23009-0a77-44f0-a419-6c032cf0eb77', 'fe398408-9165-464e-b870-830f00f69b6d', 'fe4ba05d-2525-4f0e-9c84-0c15a4b86c55', 'ffa8f7b8-6191-438b-988c-e5e57b5efaa0', 'fffe9440-cf5d-4760-8aee-6970291b3dda');
ALTER TABLE films_phase2c_backup_20261031_19 ENABLE ROW LEVEL SECURITY;

-- The Farewell (2019) 7.5/76301 → extended
UPDATE films SET release_date = '2019-07-12', imdb_id = 'tt8637428', imdb_votes = 76301, imdb_rating = 7.5, curation_tier = 'extended' WHERE id = 'f806fed3-4e69-47d7-a2bf-f1d75d16420f' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Scott Pilgrim vs. the World (2010) 7.5/502355 → extended
UPDATE films SET release_date = '2010-08-12', imdb_id = 'tt0446029', imdb_votes = 502355, imdb_rating = 7.5, curation_tier = 'extended' WHERE id = 'f81715cf-84ec-4cd2-907d-b9269ea2bf7a' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Silent Hill (2006) 6.5/264509 → extended
UPDATE films SET release_date = '2006-04-21', imdb_id = 'tt0384537', imdb_votes = 264509, imdb_rating = 6.5, curation_tier = 'extended' WHERE id = 'f8a8cc67-d3f4-4e68-b74c-fb0614bdb581' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Contact (1997) 7.5/318277 → extended
UPDATE films SET release_date = '1997-07-11', imdb_id = 'tt0118884', imdb_votes = 318277, imdb_rating = 7.5, curation_tier = 'extended' WHERE id = 'f8d6fa68-f2ce-411f-9338-a9ce2b426bc9' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Last Duel (2021) 7.3/211709 → extended
UPDATE films SET release_date = '2021-10-13', imdb_id = 'tt4244994', imdb_votes = 211709, imdb_rating = 7.3, curation_tier = 'extended' WHERE id = 'f8dd0980-71d2-4797-a213-588445ed12fc' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Shark Tale (2004) 6/217071 → extended
UPDATE films SET release_date = '2004-09-20', imdb_id = 'tt0307453', imdb_votes = 217071, imdb_rating = 6, curation_tier = 'extended' WHERE id = 'faf04bbd-fbdc-45ca-8d3e-4b02b0918a1b' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Sin City (2005) 8/825225 → core
UPDATE films SET release_date = '2005-04-01', imdb_id = 'tt0401792', imdb_votes = 825225, imdb_rating = 8, curation_tier = 'core' WHERE id = 'fd28e942-d253-4a99-b7e7-a30d49b87d70' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Hercules (1997) 7.3/285201 → extended
UPDATE films SET release_date = '1997-06-13', imdb_id = 'tt0119282', imdb_votes = 285201, imdb_rating = 7.3, curation_tier = 'extended' WHERE id = 'fd3b6d8d-4804-4f59-b88d-0f1aa5b4ea73' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Eternity (2025) 6.9/70050 → extended
UPDATE films SET release_date = '2025-11-10', imdb_votes = 70050, imdb_rating = 6.9, curation_tier = 'extended' WHERE id = 'fdb2699d-1f36-4f41-8f77-71f67b9c3014' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Shooter (2007) 7.2/380426 → extended
UPDATE films SET release_date = '2007-03-22', imdb_id = 'tt0822854', imdb_votes = 380426, imdb_rating = 7.2, curation_tier = 'extended' WHERE id = 'fdc23009-0a77-44f0-a419-6c032cf0eb77' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Who Framed Roger Rabbit (1988) 7.7/236307 → extended
UPDATE films SET release_date = '1988-06-22', imdb_id = 'tt0096438', imdb_votes = 236307, imdb_rating = 7.7, curation_tier = 'extended' WHERE id = 'fe398408-9165-464e-b870-830f00f69b6d' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Die My Love (2025) 6/50647 → extended
UPDATE films SET release_date = '2025-10-06', imdb_id = 'tt9362736', imdb_votes = 50647, imdb_rating = 6, curation_tier = 'extended' WHERE id = 'fe4ba05d-2525-4f0e-9c84-0c15a4b86c55' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Spectre (2015) 6.8/503373 → extended
UPDATE films SET release_date = '2015-10-26', imdb_id = 'tt2379713', imdb_votes = 503373, imdb_rating = 6.8, curation_tier = 'extended' WHERE id = 'ffa8f7b8-6191-438b-988c-e5e57b5efaa0' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Nosferatu (2024) 7.1/281015 → extended
UPDATE films SET release_date = '2024-12-25', imdb_id = 'tt5040012', imdb_votes = 281015, imdb_rating = 7.1, curation_tier = 'extended' WHERE id = 'fffe9440-cf5d-4760-8aee-6970291b3dda' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;

DO $$
DECLARE _backup INT; _unchanged INT;
BEGIN
  SELECT count(*) INTO _backup FROM films_phase2c_backup_20261031_19;
  SELECT count(*) INTO _unchanged FROM films f JOIN films_phase2c_backup_20261031_19 b ON b.id = f.id WHERE f.curation_tier = b.curation_tier;
  IF _backup <> 14 THEN RAISE EXCEPTION 'ABORT: yedek % satir (beklenen 14)', _backup; END IF;
  IF _unchanged <> 0 THEN RAISE EXCEPTION 'ABORT: % film degismedi (UPDATE 0 satir etkiledi)', _unchanged; END IF;
END $$;

COMMIT;
