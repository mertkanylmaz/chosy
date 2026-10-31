-- MOOD-VEC-2b Faz 2C (parça 10/19): 22 arşiv filminin release_date[/imdb_id] + imdb_votes[/imdb_rating] + curation_tier'ı. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Kaynak: TMDb (release_date, imdb_id) + IMDb veri dosyası (oy/rating). Her UPDATE filmin hâlâ archive + release_date NULL + oyun eski değerde olduğunu doğrular.
-- Beklenen: 22 UPDATE × 1 satır.

BEGIN;

CREATE TABLE films_phase2c_backup_20261031_10 AS
  SELECT id, imdb_id, imdb_rating, imdb_votes, release_date, curation_tier FROM films WHERE id IN ('7a54994a-5b7d-4771-801a-46dae677acf5', '7af96bb1-90eb-4934-b5ff-4f1f2ffd164a', '7bc68be2-d54b-4fba-a2c6-6af7711a6b76', '7cbcfd92-1f1d-47dc-8ab0-39e6feb8598f', '7cd3dc97-8913-4884-9a87-6a26cef5044a', '7d4e9928-5e4c-4692-a5cf-ae8ee69555c9', '7e38f4c0-2a43-44a3-81f1-097beeccc598', '7e4ba268-065c-4761-96f2-0e7f21cbeed1', '7e7bac90-e401-401b-9c3e-3e6e0875207a', '7f03cf96-2de6-4a7c-a906-afac60756307', '7fb1905c-676c-423f-887e-2ee9153494a2', '80f59a4d-3560-4363-82ce-53006befe6f9', '8206b35b-97b2-44b1-bd40-d733971835c8', '82457104-c187-4a5f-8b2e-4f2c84a05af0', '82ee4b64-f231-420a-bff5-652ff92c5ec0', '83709df2-318b-4e6b-9123-4c64c5c328a5', '84387156-ccb0-4b82-80e0-abab1a7e11dc', '8504e080-bc08-4f4c-9be6-0688c64327b7', '86597a3f-acdb-495b-bf59-a41c42c89d92', '86dcc414-7ec0-4d6a-b539-42e03321d2ce', '87057820-7574-4855-a68d-837168f64429', '8728e3ef-0152-45aa-b924-3830b651232d');
ALTER TABLE films_phase2c_backup_20261031_10 ENABLE ROW LEVEL SECURITY;

-- I, Tonya (2017) 7.5/264675 → extended
UPDATE films SET release_date = '2017-12-07', imdb_id = 'tt5580036', imdb_votes = 264675, imdb_rating = 7.5, curation_tier = 'extended' WHERE id = '7a54994a-5b7d-4771-801a-46dae677acf5' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Bobby Z (2007) 5.8/16202 → extended
UPDATE films SET release_date = '2007-07-23', imdb_votes = 16202, imdb_rating = 5.8, curation_tier = 'extended' WHERE id = '7af96bb1-90eb-4934-b5ff-4f1f2ffd164a' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- The Karate Kid (2010) 6.3/231031 → extended
UPDATE films SET release_date = '2010-06-10', imdb_id = 'tt1155076', imdb_votes = 231031, imdb_rating = 6.3, curation_tier = 'extended' WHERE id = '7bc68be2-d54b-4fba-a2c6-6af7711a6b76' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Aşkın Gücü (1998) 7/122190 → extended
UPDATE films SET release_date = '1998-10-02', imdb_votes = 122190, imdb_rating = 7, curation_tier = 'extended' WHERE id = '7cbcfd92-1f1d-47dc-8ab0-39e6feb8598f' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- A Quiet Place (2018) 7.5/672743 → extended
UPDATE films SET release_date = '2018-04-03', imdb_id = 'tt6644200', imdb_votes = 672743, imdb_rating = 7.5, curation_tier = 'extended' WHERE id = '7cd3dc97-8913-4884-9a87-6a26cef5044a' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Jack Reacher (2012) 7/396899 → extended
UPDATE films SET release_date = '2012-12-20', imdb_id = 'tt0790724', imdb_votes = 396899, imdb_rating = 7, curation_tier = 'extended' WHERE id = '7d4e9928-5e4c-4692-a5cf-ae8ee69555c9' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Rogue One: A Star Wars Story (2016) 7.8/768349 → extended
UPDATE films SET release_date = '2016-12-14', imdb_id = 'tt3748528', imdb_votes = 768349, imdb_rating = 7.8, curation_tier = 'extended' WHERE id = '7e38f4c0-2a43-44a3-81f1-097beeccc598' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Toz Yumağı (2025) 6.5/22274 → extended
UPDATE films SET release_date = '2025-12-11', imdb_votes = 22274, imdb_rating = 6.5, curation_tier = 'extended' WHERE id = '7e4ba268-065c-4761-96f2-0e7f21cbeed1' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Taken (2008) 7.7/680318 → extended
UPDATE films SET release_date = '2008-02-18', imdb_votes = 680318, imdb_rating = 7.7, curation_tier = 'extended' WHERE id = '7e7bac90-e401-401b-9c3e-3e6e0875207a' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- The Princess and the Frog (2009) 7.2/191335 → extended
UPDATE films SET release_date = '2009-12-08', imdb_id = 'tt0780521', imdb_votes = 191335, imdb_rating = 7.2, curation_tier = 'extended' WHERE id = '7f03cf96-2de6-4a7c-a906-afac60756307' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Ferris Bueller's Day Off (1986) 7.8/421863 → extended
UPDATE films SET release_date = '1986-06-11', imdb_id = 'tt0091042', imdb_votes = 421863, imdb_rating = 7.8, curation_tier = 'extended' WHERE id = '7fb1905c-676c-423f-887e-2ee9153494a2' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Baby Driver (2017) 7.5/698359 → extended
UPDATE films SET release_date = '2017-06-28', imdb_id = 'tt3890160', imdb_votes = 698359, imdb_rating = 7.5, curation_tier = 'extended' WHERE id = '80f59a4d-3560-4363-82ce-53006befe6f9' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- ಕಾಂತಾರ: ಅಧ್ಯಾಯ - ೧ (2025) 8.1/59930 → core
UPDATE films SET release_date = '2025-10-02', imdb_votes = 59930, imdb_rating = 8.1, curation_tier = 'core' WHERE id = '8206b35b-97b2-44b1-bd40-d733971835c8' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;
-- Greyhound (2020) 7/137732 → extended
UPDATE films SET release_date = '2020-07-09', imdb_id = 'tt6048922', imdb_votes = 137732, imdb_rating = 7, curation_tier = 'extended' WHERE id = '82457104-c187-4a5f-8b2e-4f2c84a05af0' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Dead of Winter (2025) 6.1/24916 → extended
UPDATE films SET release_date = '2025-09-23', imdb_id = 'tt7574556', imdb_votes = 24916, imdb_rating = 6.1, curation_tier = 'extended' WHERE id = '82ee4b64-f231-420a-bff5-652ff92c5ec0' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Turin Horse (2011) 7.7/21874 → extended
UPDATE films SET release_date = '2011-03-31', imdb_id = 'tt1316540', imdb_votes = 21874, imdb_rating = 7.7, curation_tier = 'extended' WHERE id = '83709df2-318b-4e6b-9123-4c64c5c328a5' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Idiocracy (2006) 6.5/223320 → extended
UPDATE films SET release_date = '2006-09-01', imdb_id = 'tt0387808', imdb_votes = 223320, imdb_rating = 6.5, curation_tier = 'extended' WHERE id = '84387156-ccb0-4b82-80e0-abab1a7e11dc' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Hurricane (1999) 7.6/109416 → extended
UPDATE films SET release_date = '1999-09-17', imdb_id = 'tt0174856', imdb_votes = 109416, imdb_rating = 7.6, curation_tier = 'extended' WHERE id = '8504e080-bc08-4f4c-9be6-0688c64327b7' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- A Walk Among the Tombstones (2014) 6.5/132660 → extended
UPDATE films SET release_date = '2014-09-18', imdb_id = 'tt0365907', imdb_votes = 132660, imdb_rating = 6.5, curation_tier = 'extended' WHERE id = '86597a3f-acdb-495b-bf59-a41c42c89d92' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Andhadhun (2018) 8.2/118929 → core
UPDATE films SET release_date = '2018-10-05', imdb_id = 'tt8108198', imdb_votes = 118929, imdb_rating = 8.2, curation_tier = 'core' WHERE id = '86dcc414-7ec0-4d6a-b539-42e03321d2ce' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- Donnie Brasco (1997) 7.7/362082 → extended
UPDATE films SET release_date = '1997-02-27', imdb_id = 'tt0119008', imdb_votes = 362082, imdb_rating = 7.7, curation_tier = 'extended' WHERE id = '87057820-7574-4855-a68d-837168f64429' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_id IS NULL AND imdb_rating IS NULL;
-- The Cider House Rules (1999) 7.4/110486 → extended
UPDATE films SET release_date = '1999-12-17', imdb_votes = 110486, imdb_rating = 7.4, curation_tier = 'extended' WHERE id = '8728e3ef-0152-45aa-b924-3830b651232d' AND curation_tier = 'archive' AND release_date IS NULL AND imdb_votes IS NOT DISTINCT FROM NULL AND imdb_rating IS NULL;

DO $$
DECLARE _backup INT; _unchanged INT;
BEGIN
  SELECT count(*) INTO _backup FROM films_phase2c_backup_20261031_10;
  SELECT count(*) INTO _unchanged FROM films f JOIN films_phase2c_backup_20261031_10 b ON b.id = f.id WHERE f.curation_tier = b.curation_tier;
  IF _backup <> 22 THEN RAISE EXCEPTION 'ABORT: yedek % satir (beklenen 22)', _backup; END IF;
  IF _unchanged <> 0 THEN RAISE EXCEPTION 'ABORT: % film degismedi (UPDATE 0 satir etkiledi)', _unchanged; END IF;
END $$;

COMMIT;
