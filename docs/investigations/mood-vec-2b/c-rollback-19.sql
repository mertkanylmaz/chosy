-- MOOD-VEC-2b Faz 2C (parça 19/19): c-apply'ın geri alması. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Her UPDATE yalnız uygulanan değerleri taşıyan satırı eski haline (release_date NULL, tier archive) döndürür.

BEGIN;

-- The Farewell (2019) 7.5/76301 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'f806fed3-4e69-47d7-a2bf-f1d75d16420f' AND curation_tier = 'extended' AND release_date = '2019-07-12' AND imdb_votes = 76301 AND imdb_id = 'tt8637428' AND imdb_rating = 7.5;
-- Scott Pilgrim vs. the World (2010) 7.5/502355 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'f81715cf-84ec-4cd2-907d-b9269ea2bf7a' AND curation_tier = 'extended' AND release_date = '2010-08-12' AND imdb_votes = 502355 AND imdb_id = 'tt0446029' AND imdb_rating = 7.5;
-- Silent Hill (2006) 6.5/264509 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'f8a8cc67-d3f4-4e68-b74c-fb0614bdb581' AND curation_tier = 'extended' AND release_date = '2006-04-21' AND imdb_votes = 264509 AND imdb_id = 'tt0384537' AND imdb_rating = 6.5;
-- Contact (1997) 7.5/318277 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'f8d6fa68-f2ce-411f-9338-a9ce2b426bc9' AND curation_tier = 'extended' AND release_date = '1997-07-11' AND imdb_votes = 318277 AND imdb_id = 'tt0118884' AND imdb_rating = 7.5;
-- The Last Duel (2021) 7.3/211709 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'f8dd0980-71d2-4797-a213-588445ed12fc' AND curation_tier = 'extended' AND release_date = '2021-10-13' AND imdb_votes = 211709 AND imdb_id = 'tt4244994' AND imdb_rating = 7.3;
-- Shark Tale (2004) 6/217071 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'faf04bbd-fbdc-45ca-8d3e-4b02b0918a1b' AND curation_tier = 'extended' AND release_date = '2004-09-20' AND imdb_votes = 217071 AND imdb_id = 'tt0307453' AND imdb_rating = 6;
-- Sin City (2005) 8/825225 → core
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'fd28e942-d253-4a99-b7e7-a30d49b87d70' AND curation_tier = 'core' AND release_date = '2005-04-01' AND imdb_votes = 825225 AND imdb_id = 'tt0401792' AND imdb_rating = 8;
-- Hercules (1997) 7.3/285201 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'fd3b6d8d-4804-4f59-b88d-0f1aa5b4ea73' AND curation_tier = 'extended' AND release_date = '1997-06-13' AND imdb_votes = 285201 AND imdb_id = 'tt0119282' AND imdb_rating = 7.3;
-- Eternity (2025) 6.9/70050 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'fdb2699d-1f36-4f41-8f77-71f67b9c3014' AND curation_tier = 'extended' AND release_date = '2025-11-10' AND imdb_votes = 70050 AND imdb_rating = 6.9;
-- Shooter (2007) 7.2/380426 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'fdc23009-0a77-44f0-a419-6c032cf0eb77' AND curation_tier = 'extended' AND release_date = '2007-03-22' AND imdb_votes = 380426 AND imdb_id = 'tt0822854' AND imdb_rating = 7.2;
-- Who Framed Roger Rabbit (1988) 7.7/236307 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'fe398408-9165-464e-b870-830f00f69b6d' AND curation_tier = 'extended' AND release_date = '1988-06-22' AND imdb_votes = 236307 AND imdb_id = 'tt0096438' AND imdb_rating = 7.7;
-- Die My Love (2025) 6/50647 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'fe4ba05d-2525-4f0e-9c84-0c15a4b86c55' AND curation_tier = 'extended' AND release_date = '2025-10-06' AND imdb_votes = 50647 AND imdb_id = 'tt9362736' AND imdb_rating = 6;
-- Spectre (2015) 6.8/503373 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'ffa8f7b8-6191-438b-988c-e5e57b5efaa0' AND curation_tier = 'extended' AND release_date = '2015-10-26' AND imdb_votes = 503373 AND imdb_id = 'tt2379713' AND imdb_rating = 6.8;
-- Nosferatu (2024) 7.1/281015 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'fffe9440-cf5d-4760-8aee-6970291b3dda' AND curation_tier = 'extended' AND release_date = '2024-12-25' AND imdb_votes = 281015 AND imdb_id = 'tt5040012' AND imdb_rating = 7.1;

COMMIT;
