-- MOOD-VEC-2b Faz 2C (parça 12/19): 22 arşiv filminin release_date[/imdb_id] + imdb_votes[/imdb_rating] + curation_tier'ı. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Kaynak: TMDb (release_date, imdb_id) + IMDb veri dosyası (oy/rating). Her UPDATE filmin hâlâ archive + release_date NULL + oyun eski değerde olduğunu doğrular.
-- Beklenen: 22 UPDATE × 1 satır.

BEGIN;

CREATE TABLE films_phase2c_backup_20261031_12 AS
  SELECT id, imdb_id, imdb_rating, imdb_votes, release_date, curation_tier FROM films WHERE id IN ('935a3af6-eb81-4693-bd90-4ef09f19cfb9', '94127cf6-1c29-4c4b-9a69-55e47d7e3a54', '947f095b-1c5f-4c7d-9b15-ab519acb67b0', '94ddb2aa-5d49-428e-9334-11a7f6adbaad', '950b6f4d-4b73-454f-a823-97a0f8cd1ee3', '95596467-ff82-4159-b9c1-8a64762e4fb4', '9688fcab-7307-43e7-8c30-4a8d316b15fe', '9795b0c5-f165-4457-92d7-0aaac5979fce', '98a56260-86b7-4e54-9fa0-de07bcea47b2', '98fcb39d-33ac-4bbd-842c-bf8fa800f5fc', '9be3491d-2ff2-42ba-b73f-df803061f4dc', '9c375abf-541b-4fd4-b288-0b8b44f10cca', '9c977ddc-b554-4d49-85f5-31ffa35f9359', '9c9ccbd2-e54e-4a87-b7f3-aeebd72b6098', '9ca6fda9-a326-4564-bffa-4211243949da', '9cb88272-ace2-4107-bff6-6f90f655ad5e', '9cfefcb8-9c56-42e2-98b1-644875c54fcf', '9dd3196c-bc6b-4c98-a9bd-0684227f2bd0', '9e45da7f-e6b6-45cf-8494-58ac29216bbd', 'a2c07e00-6141-48d7-a4aa-d79a53a4f72a', 'a3bff360-e1c3-47c8-87b7-e12d11bb6095', 'a479f99a-cec4-4fb8-9f17-a1d5c0f63597');
ALTER TABLE films_phase2c_backup_20261031_12 ENABLE ROW LEVEL SECURITY;

-- Elvis (2022) 7.3/265789 → extended
UPDATE films SET release_date = '2022-06-22', imdb_id = 'tt3704428', imdb_votes = 265789, imdb_rating = 7.3, curation_tier = 'extended' WHERE id = '935a3af6-eb81-4693-bd90-4ef09f19cfb9' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- My Girl (1991) 6.9/99689 → extended
UPDATE films SET release_date = '1991-11-21', imdb_id = 'tt0102492', imdb_votes = 99689, imdb_rating = 6.9, curation_tier = 'extended' WHERE id = '94127cf6-1c29-4c4b-9a69-55e47d7e3a54' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Saw (2004) 7.6/519214 → extended
UPDATE films SET release_date = '2004-10-01', imdb_id = 'tt0387564', imdb_votes = 519214, imdb_rating = 7.6, curation_tier = 'extended' WHERE id = '947f095b-1c5f-4c7d-9b15-ab519acb67b0' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- When Harry Met Sally... (1989) 7.7/277129 → extended
UPDATE films SET release_date = '1989-07-12', imdb_id = 'tt0098635', imdb_votes = 277129, imdb_rating = 7.7, curation_tier = 'extended' WHERE id = '94ddb2aa-5d49-428e-9334-11a7f6adbaad' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Train Dreams (2025) 7.5/118112 → extended
UPDATE films SET release_date = '2025-11-05', imdb_votes = 118112, imdb_rating = 7.5, curation_tier = 'extended' WHERE id = '950b6f4d-4b73-454f-a823-97a0f8cd1ee3' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Da Vinci Şifresi (2006) 6.7/491799 → extended
UPDATE films SET release_date = '2006-05-17', imdb_votes = 491799, imdb_rating = 6.7, curation_tier = 'extended' WHERE id = '95596467-ff82-4159-b9c1-8a64762e4fb4' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Paddington 2 (2017) 7.8/117092 → extended
UPDATE films SET release_date = '2017-11-05', imdb_id = 'tt4468740', imdb_votes = 117092, imdb_rating = 7.8, curation_tier = 'extended' WHERE id = '9688fcab-7307-43e7-8c30-4a8d316b15fe' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Two Popes (2019) 7.6/148516 → extended
UPDATE films SET release_date = '2019-11-27', imdb_id = 'tt8404614', imdb_votes = 148516, imdb_rating = 7.6, curation_tier = 'extended' WHERE id = '9795b0c5-f165-4457-92d7-0aaac5979fce' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- M3GAN 2.0 (2025) 6/56991 → extended
UPDATE films SET release_date = '2025-06-25', imdb_votes = 56991, imdb_rating = 6, curation_tier = 'extended' WHERE id = '98a56260-86b7-4e54-9fa0-de07bcea47b2' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Eenie Meanie (2025) 5.9/14339 → extended
UPDATE films SET release_date = '2025-08-21', imdb_id = 'tt15514498', imdb_votes = 14339, imdb_rating = 5.9, curation_tier = 'extended' WHERE id = '98fcb39d-33ac-4bbd-842c-bf8fa800f5fc' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Wicked (2024) 7.3/259313 → extended
UPDATE films SET release_date = '2024-10-16', imdb_votes = 259313, imdb_rating = 7.3, curation_tier = 'extended' WHERE id = '9be3491d-2ff2-42ba-b73f-df803061f4dc' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Nocturnal Animals (2016) 7.4/347125 → extended
UPDATE films SET release_date = '2016-11-04', imdb_id = 'tt4550098', imdb_votes = 347125, imdb_rating = 7.4, curation_tier = 'extended' WHERE id = '9c375abf-541b-4fd4-b288-0b8b44f10cca' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Lego Movie (2014) 7.7/422748 → extended
UPDATE films SET release_date = '2014-02-06', imdb_id = 'tt1490017', imdb_votes = 422748, imdb_rating = 7.7, curation_tier = 'extended' WHERE id = '9c977ddc-b554-4d49-85f5-31ffa35f9359' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Sosis Partisi (2016) 6.1/229866 → extended
UPDATE films SET release_date = '2016-07-11', imdb_votes = 229866, imdb_rating = 6.1, curation_tier = 'extended' WHERE id = '9c9ccbd2-e54e-4a87-b7f3-aeebd72b6098' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- The Fugitive (1993) 7.8/351715 → extended
UPDATE films SET release_date = '1993-08-06', imdb_id = 'tt0106977', imdb_votes = 351715, imdb_rating = 7.8, curation_tier = 'extended' WHERE id = '9ca6fda9-a326-4564-bffa-4211243949da' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Girl Next Door (2004) 6.7/267950 → extended
UPDATE films SET release_date = '2004-04-09', imdb_id = 'tt0265208', imdb_votes = 267950, imdb_rating = 6.7, curation_tier = 'extended' WHERE id = '9cb88272-ace2-4107-bff6-6f90f655ad5e' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Lucky Number Slevin (2006) 7.7/342446 → extended
UPDATE films SET release_date = '2006-02-24', imdb_id = 'tt0425210', imdb_votes = 342446, imdb_rating = 7.7, curation_tier = 'extended' WHERE id = '9cfefcb8-9c56-42e2-98b1-644875c54fcf' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Blue Moon (2025) 6.8/26739 → extended
UPDATE films SET release_date = '2025-10-17', imdb_votes = 26739, imdb_rating = 6.8, curation_tier = 'extended' WHERE id = '9dd3196c-bc6b-4c98-a9bd-0684227f2bd0' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Moulin Rouge! (2001) 7.5/317819 → extended
UPDATE films SET release_date = '2001-05-18', imdb_id = 'tt0203009', imdb_votes = 317819, imdb_rating = 7.5, curation_tier = 'extended' WHERE id = '9e45da7f-e6b6-45cf-8494-58ac29216bbd' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Wrestler (2008) 7.9/333314 → extended
UPDATE films SET release_date = '2008-12-17', imdb_id = 'tt1125849', imdb_votes = 333314, imdb_rating = 7.9, curation_tier = 'extended' WHERE id = 'a2c07e00-6141-48d7-a4aa-d79a53a4f72a' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- In Bruges (2008) 7.9/499693 → extended
UPDATE films SET release_date = '2008-02-08', imdb_id = 'tt0780536', imdb_votes = 499693, imdb_rating = 7.9, curation_tier = 'extended' WHERE id = 'a3bff360-e1c3-47c8-87b7-e12d11bb6095' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- A Perfect World (1993) 7.5/95165 → extended
UPDATE films SET release_date = '1993-11-24', imdb_id = 'tt0107808', imdb_votes = 95165, imdb_rating = 7.5, curation_tier = 'extended' WHERE id = 'a479f99a-cec4-4fb8-9f17-a1d5c0f63597' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;

DO $$
DECLARE _backup INT; _unchanged INT;
BEGIN
  SELECT count(*) INTO _backup FROM films_phase2c_backup_20261031_12;
  SELECT count(*) INTO _unchanged FROM films f JOIN films_phase2c_backup_20261031_12 b ON b.id = f.id WHERE f.curation_tier = b.curation_tier;
  IF _backup <> 22 THEN RAISE EXCEPTION 'ABORT: yedek % satir (beklenen 22)', _backup; END IF;
  IF _unchanged <> 0 THEN RAISE EXCEPTION 'ABORT: % film degismedi (UPDATE 0 satir etkiledi)', _unchanged; END IF;
END $$;

COMMIT;
