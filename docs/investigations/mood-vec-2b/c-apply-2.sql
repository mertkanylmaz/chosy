-- MOOD-VEC-2b Faz 2C (parça 2/19): 21 arşiv filminin release_date[/imdb_id] + imdb_votes[/imdb_rating] + curation_tier'ı. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Kaynak: TMDb (release_date, imdb_id) + IMDb veri dosyası (oy/rating). Her UPDATE filmin hâlâ archive + release_date NULL + oyun eski değerde olduğunu doğrular.
-- Beklenen: 21 UPDATE × 1 satır.

BEGIN;

CREATE TABLE films_phase2c_backup_20261031_2 AS
  SELECT id, imdb_id, imdb_rating, imdb_votes, release_date, curation_tier FROM films WHERE id IN ('107ccb84-9846-425c-a93c-c48f0c9d8c1c', '10f3c8c0-c094-4c2a-bfb4-6f65587cd986', '1140113a-d4fb-40e5-8848-b1f5be1db314', '146d1d49-4c22-4ea2-b89b-720df225d04e', '14ed0ce6-d01a-4f8a-990d-9fabd78f755a', '158a5e5d-7888-44ba-b343-8e95fd931666', '15be5594-e8ad-477c-9b82-75abfdca95ff', '1603a0d0-d23f-4d0c-8a40-f34c42600622', '16937274-36c0-4a03-a9ae-e42a44eb63ee', '17469e41-6994-4908-b4d5-27d00f5d3741', '18ce61db-c6c3-404a-8343-3dac541c00e4', '1a8071cb-a123-4e0e-9d95-b48398b1aa0a', '1b4d21c8-fdbe-4e4d-9e38-745afa6086e7', '1bb85b65-c475-42ca-a353-9ca933a33e21', '1c0776ce-7ae0-49c0-a92d-40fd0896eeaa', '1cf0dfa0-d44e-4895-b3f2-7c0a34766798', '1d81adbf-7c14-426d-a521-be7a2ab872d6', '1dff175f-021f-4861-93e4-3aaaa7fbfc33', '21acbc8e-d76c-418e-85d1-5154596adb6d', '21e72948-4046-4ee8-8959-f527ee1104f7', '2300f2ea-53bc-448c-81c0-35a568229aad');
ALTER TABLE films_phase2c_backup_20261031_2 ENABLE ROW LEVEL SECURITY;

-- How to Train Your Dragon 2 (2014) 7.8/408774 → extended
UPDATE films SET release_date = '2014-06-05', imdb_id = 'tt1646971', imdb_votes = 408774, imdb_rating = 7.8, curation_tier = 'extended' WHERE id = '107ccb84-9846-425c-a93c-c48f0c9d8c1c' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Casino Royale (2006) 8/757341 → core
UPDATE films SET release_date = '2006-11-14', imdb_id = 'tt0381061', imdb_votes = 757341, imdb_rating = 8, curation_tier = 'core' WHERE id = '10f3c8c0-c094-4c2a-bfb4-6f65587cd986' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Book of Henry (2017) 6.6/31014 → extended
UPDATE films SET release_date = '2017-06-16', imdb_id = 'tt4572792', imdb_votes = 31014, imdb_rating = 6.6, curation_tier = 'extended' WHERE id = '1140113a-d4fb-40e5-8848-b1f5be1db314' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Unbroken (2014) 7.2/200955 → extended
UPDATE films SET release_date = '2014-12-25', imdb_id = 'tt1809398', imdb_votes = 200955, imdb_rating = 7.2, curation_tier = 'extended' WHERE id = '146d1d49-4c22-4ea2-b89b-720df225d04e' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Get Out (2017) 7.8/843625 → core
UPDATE films SET release_date = '2017-02-24', imdb_votes = 843625, imdb_rating = 7.8, curation_tier = 'core' WHERE id = '14ed0ce6-d01a-4f8a-990d-9fabd78f755a' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Control (2007) 7.6/72367 → extended
UPDATE films SET release_date = '2007-09-12', imdb_id = 'tt0421082', imdb_votes = 72367, imdb_rating = 7.6, curation_tier = 'extended' WHERE id = '158a5e5d-7888-44ba-b343-8e95fd931666' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Florida Project (2017) 7.6/150113 → extended
UPDATE films SET release_date = '2017-10-06', imdb_id = 'tt5649144', imdb_votes = 150113, imdb_rating = 7.6, curation_tier = 'extended' WHERE id = '15be5594-e8ad-477c-9b82-75abfdca95ff' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Danish Girl (2015) 7.1/207844 → extended
UPDATE films SET release_date = '2015-11-27', imdb_id = 'tt0810819', imdb_votes = 207844, imdb_rating = 7.1, curation_tier = 'extended' WHERE id = '1603a0d0-d23f-4d0c-8a40-f34c42600622' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Glory (1989) 7.8/154724 → extended
UPDATE films SET release_date = '1989-12-15', imdb_id = 'tt0097441', imdb_votes = 154724, imdb_rating = 7.8, curation_tier = 'extended' WHERE id = '16937274-36c0-4a03-a9ae-e42a44eb63ee' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Batman: Mask of the Phantasm (1993) 7.8/65438 → extended
UPDATE films SET release_date = '1993-12-25', imdb_id = 'tt0106364', imdb_votes = 65438, imdb_rating = 7.8, curation_tier = 'extended' WHERE id = '17469e41-6994-4908-b4d5-27d00f5d3741' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- xXx (2002) 5.9/195583 → extended
UPDATE films SET release_date = '2002-08-09', imdb_votes = 195583, imdb_rating = 5.9, curation_tier = 'extended' WHERE id = '18ce61db-c6c3-404a-8343-3dac541c00e4' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Blade (1998) 7.1/337822 → extended
UPDATE films SET release_date = '1998-08-21', imdb_id = 'tt0120611', imdb_votes = 337822, imdb_rating = 7.1, curation_tier = 'extended' WHERE id = '1a8071cb-a123-4e0e-9d95-b48398b1aa0a' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Sense and Sensibility (1995) 7.7/139012 → extended
UPDATE films SET release_date = '1995-12-13', imdb_id = 'tt0114388', imdb_votes = 139012, imdb_rating = 7.7, curation_tier = 'extended' WHERE id = '1b4d21c8-fdbe-4e4d-9e38-745afa6086e7' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Crazy, Stupid, Love. (2011) 7.4/632400 → extended
UPDATE films SET release_date = '2011-07-28', imdb_id = 'tt1570728', imdb_votes = 632400, imdb_rating = 7.4, curation_tier = 'extended' WHERE id = '1bb85b65-c475-42ca-a353-9ca933a33e21' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Mission: Impossible - Ghost Protocol (2011) 7.4/570987 → extended
UPDATE films SET release_date = '2011-12-07', imdb_id = 'tt1229238', imdb_votes = 570987, imdb_rating = 7.4, curation_tier = 'extended' WHERE id = '1c0776ce-7ae0-49c0-a92d-40fd0896eeaa' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Solo Leveling -ReAwakening- (2024) 8.7/17968 → core
UPDATE films SET release_date = '2024-11-26', imdb_votes = 17968, imdb_rating = 8.7, curation_tier = 'core' WHERE id = '1cf0dfa0-d44e-4895-b3f2-7c0a34766798' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Ani Tehlike (1965) 7.1/19918 → extended
UPDATE films SET release_date = '1965-03-18', imdb_votes = 19918, imdb_rating = 7.1, curation_tier = 'extended' WHERE id = '1d81adbf-7c14-426d-a521-be7a2ab872d6' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Desert Flower (2009) 7.3/15682 → extended
UPDATE films SET release_date = '2009-09-24', imdb_id = 'tt1054580', imdb_votes = 15682, imdb_rating = 7.3, curation_tier = 'extended' WHERE id = '1dff175f-021f-4861-93e4-3aaaa7fbfc33' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Worst Person in the World (2021) 7.7/133707 → extended
UPDATE films SET release_date = '2021-10-13', imdb_id = 'tt10370710', imdb_votes = 133707, imdb_rating = 7.7, curation_tier = 'extended' WHERE id = '21acbc8e-d76c-418e-85d1-5154596adb6d' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Erin Brockovich (2000) 7.5/250819 → extended
UPDATE films SET release_date = '2000-03-17', imdb_id = 'tt0195685', imdb_votes = 250819, imdb_rating = 7.5, curation_tier = 'extended' WHERE id = '21e72948-4046-4ee8-8959-f527ee1104f7' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Being John Malkovich (1999) 7.7/372179 → extended
UPDATE films SET release_date = '1999-10-29', imdb_id = 'tt0120601', imdb_votes = 372179, imdb_rating = 7.7, curation_tier = 'extended' WHERE id = '2300f2ea-53bc-448c-81c0-35a568229aad' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;

DO $$
DECLARE _backup INT; _unchanged INT;
BEGIN
  SELECT count(*) INTO _backup FROM films_phase2c_backup_20261031_2;
  SELECT count(*) INTO _unchanged FROM films f JOIN films_phase2c_backup_20261031_2 b ON b.id = f.id WHERE f.curation_tier = b.curation_tier;
  IF _backup <> 21 THEN RAISE EXCEPTION 'ABORT: yedek % satir (beklenen 21)', _backup; END IF;
  IF _unchanged <> 0 THEN RAISE EXCEPTION 'ABORT: % film degismedi (UPDATE 0 satir etkiledi)', _unchanged; END IF;
END $$;

COMMIT;
