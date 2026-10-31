-- MOOD-VEC-2b Faz 2C (parça 11/19): 21 arşiv filminin release_date[/imdb_id] + imdb_votes[/imdb_rating] + curation_tier'ı. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Kaynak: TMDb (release_date, imdb_id) + IMDb veri dosyası (oy/rating). Her UPDATE filmin hâlâ archive + release_date NULL + oyun eski değerde olduğunu doğrular.
-- Beklenen: 21 UPDATE × 1 satır.

BEGIN;

CREATE TABLE films_phase2c_backup_20261031_11 AS
  SELECT id, imdb_id, imdb_rating, imdb_votes, release_date, curation_tier FROM films WHERE id IN ('87a436b9-114b-4f79-8279-9142f0232a97', '87b2999e-f027-4336-8c8c-9443f92f6965', '889d8584-ae01-49dc-94cb-fdd01c697a1a', '892cabd1-d91d-4256-a583-30c8303396c0', '89d7cf26-1b41-441c-b726-2a683e7d69d3', '8a126265-871c-4520-acaa-24437a86c87e', '8abd503b-5bb3-4ef4-bfb9-3e6e1e1ccbff', '8b58c490-a572-4017-91ce-96ca970db2fe', '8b75b450-8f43-40c7-aa88-49f5063cae26', '8de5d529-28ee-49a5-9c2f-ac445c1c806e', '8f71ca3e-f71f-4f20-a995-a208d504de71', '8f83dadf-cfdd-4c7f-8652-d4c9adb93307', '8f98acc7-8d93-4dfa-bfdb-0abf2fdd4284', '9077bd5a-2627-4d4a-a0f2-7233c091e2bc', '90c2bf59-4847-4580-8675-77852f029cf5', '90f6c2eb-055d-4dce-93b4-aff005889f61', '9142ffe9-7684-46ea-af98-05f0770a2bb2', '915d86fa-3756-495b-aca1-815e42f5db2a', '92955d8e-1f7e-475c-8805-119b41a39445', '92de6582-14bd-429e-b3a6-5ed37500093b', '9321a442-0786-45ad-ad0f-18a1ccb3e528');
ALTER TABLE films_phase2c_backup_20261031_11 ENABLE ROW LEVEL SECURITY;

-- Back to the Outback (2021) 6.5/13139 → extended
UPDATE films SET release_date = '2021-12-03', imdb_id = 'tt13575806', imdb_votes = 13139, imdb_rating = 6.5, curation_tier = 'extended' WHERE id = '87a436b9-114b-4f79-8279-9142f0232a97' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Angel Has Fallen (2019) 6.4/124971 → extended
UPDATE films SET release_date = '2019-08-21', imdb_id = 'tt6189022', imdb_votes = 124971, imdb_rating = 6.4, curation_tier = 'extended' WHERE id = '87b2999e-f027-4336-8c8c-9443f92f6965' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Men of Honor (2000) 7.2/131981 → extended
UPDATE films SET release_date = '2000-09-13', imdb_id = 'tt0203019', imdb_votes = 131981, imdb_rating = 7.2, curation_tier = 'extended' WHERE id = '889d8584-ae01-49dc-94cb-fdd01c697a1a' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Prey (2022) 7.1/279059 → extended
UPDATE films SET release_date = '2022-08-05', imdb_id = 'tt11866324', imdb_votes = 279059, imdb_rating = 7.1, curation_tier = 'extended' WHERE id = '892cabd1-d91d-4256-a583-30c8303396c0' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Midnight in Paris (2011) 7.6/475144 → extended
UPDATE films SET release_date = '2011-05-11', imdb_id = 'tt1605783', imdb_votes = 475144, imdb_rating = 7.6, curation_tier = 'extended' WHERE id = '89d7cf26-1b41-441c-b726-2a683e7d69d3' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Dirt (2019) 7/61711 → extended
UPDATE films SET release_date = '2019-03-18', imdb_id = 'tt0800325', imdb_votes = 61711, imdb_rating = 7, curation_tier = 'extended' WHERE id = '8a126265-871c-4520-acaa-24437a86c87e' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Ice Station Zebra (1968) 6.6/13174 → extended
UPDATE films SET release_date = '1968-04-04', imdb_votes = 13174, imdb_rating = 6.6, curation_tier = 'extended' WHERE id = '8abd503b-5bb3-4ef4-bfb9-3e6e1e1ccbff' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Entergalactic (2022) 7.4/21759 → extended
UPDATE films SET release_date = '2022-09-28', imdb_id = 'tt10687116', imdb_votes = 21759, imdb_rating = 7.4, curation_tier = 'extended' WHERE id = '8b58c490-a572-4017-91ce-96ca970db2fe' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Children of Men (2006) 7.9/574128 → extended
UPDATE films SET release_date = '2006-09-22', imdb_id = 'tt0206634', imdb_votes = 574128, imdb_rating = 7.9, curation_tier = 'extended' WHERE id = '8b75b450-8f43-40c7-aa88-49f5063cae26' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Dhurandhar (2025) 8.2/152541 → core
UPDATE films SET release_date = '2025-12-05', imdb_votes = 152541, imdb_rating = 8.2, curation_tier = 'core' WHERE id = '8de5d529-28ee-49a5-9c2f-ac445c1c806e' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Sentimental Value (2025) 7.7/92444 → extended
UPDATE films SET release_date = '2025-08-20', imdb_votes = 92444, imdb_rating = 7.7, curation_tier = 'extended' WHERE id = '8f71ca3e-f71f-4f20-a995-a208d504de71' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Hotel Transylvania (2012) 7.1/321621 → extended
UPDATE films SET release_date = '2012-09-20', imdb_id = 'tt0837562', imdb_votes = 321621, imdb_rating = 7.1, curation_tier = 'extended' WHERE id = '8f83dadf-cfdd-4c7f-8652-d4c9adb93307' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Lucy (2014) 6.4/587591 → extended
UPDATE films SET release_date = '2014-07-25', imdb_id = 'tt2872732', imdb_votes = 587591, imdb_rating = 6.4, curation_tier = 'extended' WHERE id = '8f98acc7-8d93-4dfa-bfdb-0abf2fdd4284' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Fall Guy (2024) 6.8/276443 → extended
UPDATE films SET release_date = '2024-04-24', imdb_id = 'tt1684562', imdb_votes = 276443, imdb_rating = 6.8, curation_tier = 'extended' WHERE id = '9077bd5a-2627-4d4a-a0f2-7233c091e2bc' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Hannah and Her Sisters (1986) 7.8/82381 → extended
UPDATE films SET release_date = '1986-02-07', imdb_id = 'tt0091167', imdb_votes = 82381, imdb_rating = 7.8, curation_tier = 'extended' WHERE id = '90c2bf59-4847-4580-8675-77852f029cf5' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- As Good as It Gets (1997) 7.7/341189 → extended
UPDATE films SET release_date = '1997-12-19', imdb_id = 'tt0119822', imdb_votes = 341189, imdb_rating = 7.7, curation_tier = 'extended' WHERE id = '90f6c2eb-055d-4dce-93b4-aff005889f61' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Ip Man 2 (2010) 7.5/118121 → extended
UPDATE films SET release_date = '2010-04-29', imdb_id = 'tt1386932', imdb_votes = 118121, imdb_rating = 7.5, curation_tier = 'extended' WHERE id = '9142ffe9-7684-46ea-af98-05f0770a2bb2' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Time of the Gypsies (1988) 8.1/34931 → core
UPDATE films SET release_date = '1988-12-21', imdb_id = 'tt0097223', imdb_votes = 34931, imdb_rating = 8.1, curation_tier = 'core' WHERE id = '915d86fa-3756-495b-aca1-815e42f5db2a' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- E.T. the Extra-Terrestrial (1982) 7.9/478551 → extended
UPDATE films SET release_date = '1982-06-11', imdb_id = 'tt0083866', imdb_votes = 478551, imdb_rating = 7.9, curation_tier = 'extended' WHERE id = '92955d8e-1f7e-475c-8805-119b41a39445' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Warfare (2025) 7.1/118346 → extended
UPDATE films SET release_date = '2025-04-09', imdb_id = 'tt31434639', imdb_votes = 118346, imdb_rating = 7.1, curation_tier = 'extended' WHERE id = '92de6582-14bd-429e-b3a6-5ed37500093b' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Dumb and Dumber (1994) 7.3/449280 → extended
UPDATE films SET release_date = '1994-12-16', imdb_id = 'tt0109686', imdb_votes = 449280, imdb_rating = 7.3, curation_tier = 'extended' WHERE id = '9321a442-0786-45ad-ad0f-18a1ccb3e528' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;

DO $$
DECLARE _backup INT; _unchanged INT;
BEGIN
  SELECT count(*) INTO _backup FROM films_phase2c_backup_20261031_11;
  SELECT count(*) INTO _unchanged FROM films f JOIN films_phase2c_backup_20261031_11 b ON b.id = f.id WHERE f.curation_tier = b.curation_tier;
  IF _backup <> 21 THEN RAISE EXCEPTION 'ABORT: yedek % satir (beklenen 21)', _backup; END IF;
  IF _unchanged <> 0 THEN RAISE EXCEPTION 'ABORT: % film degismedi (UPDATE 0 satir etkiledi)', _unchanged; END IF;
END $$;

COMMIT;
