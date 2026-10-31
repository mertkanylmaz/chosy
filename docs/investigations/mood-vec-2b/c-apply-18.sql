-- MOOD-VEC-2b Faz 2C (parça 18/19): 21 arşiv filminin release_date[/imdb_id] + imdb_votes[/imdb_rating] + curation_tier'ı. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Kaynak: TMDb (release_date, imdb_id) + IMDb veri dosyası (oy/rating). Her UPDATE filmin hâlâ archive + release_date NULL + oyun eski değerde olduğunu doğrular.
-- Beklenen: 21 UPDATE × 1 satır.

BEGIN;

CREATE TABLE films_phase2c_backup_20261031_18 AS
  SELECT id, imdb_id, imdb_rating, imdb_votes, release_date, curation_tier FROM films WHERE id IN ('ea4ad9a0-7cba-47f8-8305-9600c03e79e4', 'ebabdfd2-d8c6-48bb-8ffb-ccb6e06f738e', 'ec387422-9142-407f-accf-5c8fe1fe94d7', 'ed7e8abd-6a71-4d43-b01c-4d998e960860', 'ee6d3138-3887-4fb2-861f-d08a5e0d4277', 'ee8b1e5b-4e5e-4cdb-8a9e-969b531cddd1', 'efbadd0e-ee8e-488f-b39e-160e782fe41d', 'f0127741-2948-4d4f-aa15-271a646de577', 'f060adba-9da0-4d23-9f53-6be399235f07', 'f187fd0b-0cc6-4686-bd81-be4cf9c47ad1', 'f18e3003-dbb6-4bcc-929e-f0c9a69f54e9', 'f39abb51-d61d-45b0-812a-b46d38376ad7', 'f3ea6f4e-b01a-45ed-99f1-aadad58e748f', 'f42b7399-b6d5-4187-947b-242b36b2a37b', 'f4cab7d1-8060-45cc-84a1-a48c1c0a54b8', 'f67272ce-73de-434d-be99-8306f71dcb9b', 'f68028a7-3beb-4e25-8e5f-fb52dcd352d8', 'f6bb549c-fddc-4755-8e90-f6611972c85a', 'f7455189-ccff-4004-a268-08ad3ad0442b', 'f76f1377-2fe9-4117-a695-50965b046ab6', 'f7f5c350-bf8a-4086-b7dd-0c2ffabe73b0');
ALTER TABLE films_phase2c_backup_20261031_18 ENABLE ROW LEVEL SECURITY;

-- Prometheus (2012) 7/709327 → extended
UPDATE films SET release_date = '2012-05-30', imdb_id = 'tt1446714', imdb_votes = 709327, imdb_rating = 7, curation_tier = 'extended' WHERE id = 'ea4ad9a0-7cba-47f8-8305-9600c03e79e4' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Close-Up (1990) 8.2/27626 → core
UPDATE films SET release_date = '1990-05-09', imdb_votes = 27626, imdb_rating = 8.2, curation_tier = 'core' WHERE id = 'ebabdfd2-d8c6-48bb-8ffb-ccb6e06f738e' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- The Contractor (2022) 5.8/36348 → extended
UPDATE films SET release_date = '2022-03-10', imdb_id = 'tt10323676', imdb_votes = 36348, imdb_rating = 5.8, curation_tier = 'extended' WHERE id = 'ec387422-9142-407f-accf-5c8fe1fe94d7' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- John Wick: Chapter 3 - Parabellum (2019) 7.4/490426 → extended
UPDATE films SET release_date = '2019-05-15', imdb_id = 'tt6146586', imdb_votes = 490426, imdb_rating = 7.4, curation_tier = 'extended' WHERE id = 'ed7e8abd-6a71-4d43-b01c-4d998e960860' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Empire of the Sun (1987) 7.7/145380 → extended
UPDATE films SET release_date = '1987-12-09', imdb_id = 'tt0092965', imdb_votes = 145380, imdb_rating = 7.7, curation_tier = 'extended' WHERE id = 'ee6d3138-3887-4fb2-861f-d08a5e0d4277' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Carol (2015) 7.3/155457 → extended
UPDATE films SET release_date = '2015-11-20', imdb_id = 'tt2402927', imdb_votes = 155457, imdb_rating = 7.3, curation_tier = 'extended' WHERE id = 'ee8b1e5b-4e5e-4cdb-8a9e-969b531cddd1' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Sonic the Hedgehog (2020) 6.5/197693 → extended
UPDATE films SET release_date = '2020-02-12', imdb_id = 'tt3794354', imdb_votes = 197693, imdb_rating = 6.5, curation_tier = 'extended' WHERE id = 'efbadd0e-ee8e-488f-b39e-160e782fe41d' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Fatherhood (2021) 6.6/47595 → extended
UPDATE films SET release_date = '2021-06-18', imdb_id = 'tt4733624', imdb_votes = 47595, imdb_rating = 6.6, curation_tier = 'extended' WHERE id = 'f0127741-2948-4d4f-aa15-271a646de577' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Abigail (2024) 6.5/125148 → extended
UPDATE films SET release_date = '2024-04-16', imdb_id = 'tt27489557', imdb_votes = 125148, imdb_rating = 6.5, curation_tier = 'extended' WHERE id = 'f060adba-9da0-4d23-9f53-6be399235f07' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Sling Blade (1996) 8/105088 → core
UPDATE films SET release_date = '1996-08-30', imdb_id = 'tt0117666', imdb_votes = 105088, imdb_rating = 8, curation_tier = 'core' WHERE id = 'f187fd0b-0cc6-4686-bd81-be4cf9c47ad1' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Batman (1989) 7.5/437645 → extended
UPDATE films SET release_date = '1989-06-21', imdb_id = 'tt0096895', imdb_votes = 437645, imdb_rating = 7.5, curation_tier = 'extended' WHERE id = 'f18e3003-dbb6-4bcc-929e-f0c9a69f54e9' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- A Few Good Men (1992) 7.8/323948 → extended
UPDATE films SET release_date = '1992-12-11', imdb_id = 'tt0104257', imdb_votes = 323948, imdb_rating = 7.8, curation_tier = 'extended' WHERE id = 'f39abb51-d61d-45b0-812a-b46d38376ad7' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Fly (1986) 7.6/228889 → extended
UPDATE films SET release_date = '1986-08-15', imdb_id = 'tt0091064', imdb_votes = 228889, imdb_rating = 7.6, curation_tier = 'extended' WHERE id = 'f3ea6f4e-b01a-45ed-99f1-aadad58e748f' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Six Triple Eight (2024) 6.7/33217 → extended
UPDATE films SET release_date = '2024-12-06', imdb_id = 'tt24458622', imdb_votes = 33217, imdb_rating = 6.7, curation_tier = 'extended' WHERE id = 'f42b7399-b6d5-4187-947b-242b36b2a37b' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Back to the Future Part III (1990) 7.5/528305 → extended
UPDATE films SET release_date = '1990-05-25', imdb_id = 'tt0099088', imdb_votes = 528305, imdb_rating = 7.5, curation_tier = 'extended' WHERE id = 'f4cab7d1-8060-45cc-84a1-a48c1c0a54b8' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Lighthouse (2019) 7.3/312317 → extended
UPDATE films SET release_date = '2019-10-18', imdb_id = 'tt7984734', imdb_votes = 312317, imdb_rating = 7.3, curation_tier = 'extended' WHERE id = 'f67272ce-73de-434d-be99-8306f71dcb9b' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Ocean's Eight (2018) 6.3/265986 → extended
UPDATE films SET release_date = '2018-06-07', imdb_id = 'tt5164214', imdb_votes = 265986, imdb_rating = 6.3, curation_tier = 'extended' WHERE id = 'f68028a7-3beb-4e25-8e5f-fb52dcd352d8' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Godzilla vs. Kong (2021) 6.3/272281 → extended
UPDATE films SET release_date = '2021-03-24', imdb_id = 'tt5034838', imdb_votes = 272281, imdb_rating = 6.3, curation_tier = 'extended' WHERE id = 'f6bb549c-fddc-4755-8e90-f6611972c85a' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Hot Fuzz (2007) 7.8/574612 → extended
UPDATE films SET release_date = '2007-02-14', imdb_id = 'tt0425112', imdb_votes = 574612, imdb_rating = 7.8, curation_tier = 'extended' WHERE id = 'f7455189-ccff-4004-a268-08ad3ad0442b' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Sonic the Hedgehog 2 (2022) 6.5/120329 → extended
UPDATE films SET release_date = '2022-03-30', imdb_id = 'tt12412888', imdb_votes = 120329, imdb_rating = 6.5, curation_tier = 'extended' WHERE id = 'f76f1377-2fe9-4117-a695-50965b046ab6' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Terminator: Dark Fate (2019) 6.2/215974 → extended
UPDATE films SET release_date = '2019-10-23', imdb_id = 'tt6450804', imdb_votes = 215974, imdb_rating = 6.2, curation_tier = 'extended' WHERE id = 'f7f5c350-bf8a-4086-b7dd-0c2ffabe73b0' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;

DO $$
DECLARE _backup INT; _unchanged INT;
BEGIN
  SELECT count(*) INTO _backup FROM films_phase2c_backup_20261031_18;
  SELECT count(*) INTO _unchanged FROM films f JOIN films_phase2c_backup_20261031_18 b ON b.id = f.id WHERE f.curation_tier = b.curation_tier;
  IF _backup <> 21 THEN RAISE EXCEPTION 'ABORT: yedek % satir (beklenen 21)', _backup; END IF;
  IF _unchanged <> 0 THEN RAISE EXCEPTION 'ABORT: % film degismedi (UPDATE 0 satir etkiledi)', _unchanged; END IF;
END $$;

COMMIT;
