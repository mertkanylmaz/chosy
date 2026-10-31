-- MOOD-VEC-2b Faz 2C (parça 9/19): 22 arşiv filminin release_date[/imdb_id] + imdb_votes[/imdb_rating] + curation_tier'ı. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Kaynak: TMDb (release_date, imdb_id) + IMDb veri dosyası (oy/rating). Her UPDATE filmin hâlâ archive + release_date NULL + oyun eski değerde olduğunu doğrular.
-- Beklenen: 22 UPDATE × 1 satır.

BEGIN;

CREATE TABLE films_phase2c_backup_20261031_9 AS
  SELECT id, imdb_id, imdb_rating, imdb_votes, release_date, curation_tier FROM films WHERE id IN ('729d7fd2-9c73-4212-a04d-4894993a7c6d', '73e8cf7b-dbd4-44ce-844f-1b08549ec521', '73e9d966-0ef6-4be9-bd41-6b20e241119b', '74988b28-83d1-4f5a-bbb8-3303c840d5cd', '74ebfc5e-10a8-48d4-9b33-9da6c03dadeb', '74eda9d5-737e-4f3b-a280-4b4fd2c9b6fc', '7532d99b-f0fb-4372-9ba2-21abe2d93727', '75830c87-91c7-4f99-8332-90fb46dc5d4c', '75ae31cd-a7a1-4cef-aa92-5e656298f2b2', '75bae1ec-6839-4f75-a85d-c885b073b0f0', '75d22631-a4cd-40be-bf91-8d056f65fa3c', '76203667-9cc3-45e2-aeb7-87b95575c81f', '76b143d7-eb75-4f1a-a2ce-c9a72dc27d9f', '78145823-c902-4306-8ab6-b0037cb4e296', '787f0fc6-b083-44b8-9d75-204d6fe2e0f4', '78942796-d7f9-4ee5-a47f-27f8f8285cd0', '78cea26c-b421-4df2-9cbe-7aa39af968ca', '78f142e8-5c5f-4a95-bbe9-474024414700', '79103307-84ce-4bea-ab38-b2351dff448b', '7998841b-aea5-4165-bb49-4ed0c020133c', '7a2e5bc9-3693-4d0b-bab5-6ffe68aad3e4', '7a3602d1-0134-4898-96b3-b40c48d5fb61');
ALTER TABLE films_phase2c_backup_20261031_9 ENABLE ROW LEVEL SECURITY;

-- Poor Things (2023) 7.7/426481 → extended
UPDATE films SET release_date = '2023-12-07', imdb_id = 'tt14230458', imdb_votes = 426481, imdb_rating = 7.7, curation_tier = 'extended' WHERE id = '729d7fd2-9c73-4212-a04d-4894993a7c6d' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Zaman Yolculuğu Hakkında Sıkça Sorulan Sorular (2009) 6.9/39085 → extended
UPDATE films SET release_date = '2009-04-24', imdb_votes = 39085, imdb_rating = 6.9, curation_tier = 'extended' WHERE id = '73e8cf7b-dbd4-44ce-844f-1b08549ec521' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Holding the Man (2015) 7.5/14415 → extended
UPDATE films SET release_date = '2015-08-27', imdb_id = 'tt3671542', imdb_votes = 14415, imdb_rating = 7.5, curation_tier = 'extended' WHERE id = '73e9d966-0ef6-4be9-bd41-6b20e241119b' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Spies in Disguise (2019) 6.8/64152 → extended
UPDATE films SET release_date = '2019-12-04', imdb_id = 'tt5814534', imdb_votes = 64152, imdb_rating = 6.8, curation_tier = 'extended' WHERE id = '74988b28-83d1-4f5a-bbb8-3303c840d5cd' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Twelve Monkeys (1995) 8/686259 → core
UPDATE films SET release_date = '1995-12-29', imdb_id = 'tt0114746', imdb_votes = 686259, imdb_rating = 8, curation_tier = 'core' WHERE id = '74ebfc5e-10a8-48d4-9b33-9da6c03dadeb' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Ghost (1990) 7.1/260476 → extended
UPDATE films SET release_date = '1990-07-13', imdb_id = 'tt0099653', imdb_votes = 260476, imdb_rating = 7.1, curation_tier = 'extended' WHERE id = '74eda9d5-737e-4f3b-a280-4b4fd2c9b6fc' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Kung Fu Panda 3 (2016) 7.1/224793 → extended
UPDATE films SET release_date = '2016-01-23', imdb_id = 'tt2267968', imdb_votes = 224793, imdb_rating = 7.1, curation_tier = 'extended' WHERE id = '7532d99b-f0fb-4372-9ba2-21abe2d93727' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Enemy at the Gates (2001) 7.5/296625 → extended
UPDATE films SET release_date = '2001-02-28', imdb_id = 'tt0215750', imdb_votes = 296625, imdb_rating = 7.5, curation_tier = 'extended' WHERE id = '75830c87-91c7-4f99-8332-90fb46dc5d4c' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Boys Don't Cry (1999) 7.5/108484 → extended
UPDATE films SET release_date = '1999-09-02', imdb_id = 'tt0171804', imdb_votes = 108484, imdb_rating = 7.5, curation_tier = 'extended' WHERE id = '75ae31cd-a7a1-4cef-aa92-5e656298f2b2' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Jay Kelly (2025) 6.5/42710 → extended
UPDATE films SET release_date = '2025-11-14', imdb_votes = 42710, imdb_rating = 6.5, curation_tier = 'extended' WHERE id = '75bae1ec-6839-4f75-a85d-c885b073b0f0' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- White Chicks (2004) 6/202896 → extended
UPDATE films SET release_date = '2004-06-23', imdb_id = 'tt0381707', imdb_votes = 202896, imdb_rating = 6, curation_tier = 'extended' WHERE id = '75d22631-a4cd-40be-bf91-8d056f65fa3c' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Book Thief (2013) 7.5/148762 → extended
UPDATE films SET release_date = '2013-11-08', imdb_id = 'tt0816442', imdb_votes = 148762, imdb_rating = 7.5, curation_tier = 'extended' WHERE id = '76203667-9cc3-45e2-aeb7-87b95575c81f' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Star Trek (2009) 7.9/642381 → extended
UPDATE films SET release_date = '2009-05-06', imdb_id = 'tt0796366', imdb_votes = 642381, imdb_rating = 7.9, curation_tier = 'extended' WHERE id = '76b143d7-eb75-4f1a-a2ce-c9a72dc27d9f' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Batman v Superman: Dawn of Justice (2016) 6.4/801371 → extended
UPDATE films SET release_date = '2016-03-23', imdb_votes = 801371, imdb_rating = 6.4, curation_tier = 'extended' WHERE id = '78145823-c902-4306-8ab6-b0037cb4e296' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Miss Sloane (2016) 7.5/90198 → extended
UPDATE films SET release_date = '2016-11-25', imdb_id = 'tt4540710', imdb_votes = 90198, imdb_rating = 7.5, curation_tier = 'extended' WHERE id = '787f0fc6-b083-44b8-9d75-204d6fe2e0f4' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Young Woman and the Sea (2024) 7.5/20946 → extended
UPDATE films SET release_date = '2024-05-31', imdb_votes = 20946, imdb_rating = 7.5, curation_tier = 'extended' WHERE id = '78942796-d7f9-4ee5-a47f-27f8f8285cd0' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- The Hunger Games: Catching Fire (2013) 7.5/786197 → extended
UPDATE films SET release_date = '2013-11-15', imdb_id = 'tt1951264', imdb_votes = 786197, imdb_rating = 7.5, curation_tier = 'extended' WHERE id = '78cea26c-b421-4df2-9cbe-7aa39af968ca' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Roofman (2025) 6.9/90600 → extended
UPDATE films SET release_date = '2025-10-06', imdb_votes = 90600, imdb_rating = 6.9, curation_tier = 'extended' WHERE id = '78f142e8-5c5f-4a95-bbe9-474024414700' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Home Alone (1990) 7.8/757729 → extended
UPDATE films SET release_date = '1990-11-16', imdb_id = 'tt0099785', imdb_votes = 757729, imdb_rating = 7.8, curation_tier = 'extended' WHERE id = '79103307-84ce-4bea-ab38-b2351dff448b' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Çığlık (2022) 6.3/192539 → extended
UPDATE films SET release_date = '2022-01-12', imdb_votes = 192539, imdb_rating = 6.3, curation_tier = 'extended' WHERE id = '7998841b-aea5-4165-bb49-4ed0c020133c' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Corpse Bride (2005) 7.4/334659 → extended
UPDATE films SET release_date = '2005-09-12', imdb_id = 'tt0121164', imdb_votes = 334659, imdb_rating = 7.4, curation_tier = 'extended' WHERE id = '7a2e5bc9-3693-4d0b-bab5-6ffe68aad3e4' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Lone Survivor (2013) 7.5/327372 → extended
UPDATE films SET release_date = '2013-12-24', imdb_id = 'tt1091191', imdb_votes = 327372, imdb_rating = 7.5, curation_tier = 'extended' WHERE id = '7a3602d1-0134-4898-96b3-b40c48d5fb61' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;

DO $$
DECLARE _backup INT; _unchanged INT;
BEGIN
  SELECT count(*) INTO _backup FROM films_phase2c_backup_20261031_9;
  SELECT count(*) INTO _unchanged FROM films f JOIN films_phase2c_backup_20261031_9 b ON b.id = f.id WHERE f.curation_tier = b.curation_tier;
  IF _backup <> 22 THEN RAISE EXCEPTION 'ABORT: yedek % satir (beklenen 22)', _backup; END IF;
  IF _unchanged <> 0 THEN RAISE EXCEPTION 'ABORT: % film degismedi (UPDATE 0 satir etkiledi)', _unchanged; END IF;
END $$;

COMMIT;
