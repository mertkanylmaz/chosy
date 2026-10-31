-- MOOD-VEC-2b Faz 2C (parça 10/19): c-apply'ın geri alması. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Her UPDATE yalnız uygulanan değerleri taşıyan satırı eski haline (release_date NULL, tier archive) döndürür.

BEGIN;

-- I, Tonya (2017) 7.5/264675 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '7a54994a-5b7d-4771-801a-46dae677acf5' AND curation_tier = 'extended' AND release_date = '2017-12-07' AND imdb_votes = 264675 AND imdb_id = 'tt5580036' AND imdb_rating = 7.5;
-- Bobby Z (2007) 5.8/16202 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '7af96bb1-90eb-4934-b5ff-4f1f2ffd164a' AND curation_tier = 'extended' AND release_date = '2007-07-23' AND imdb_votes = 16202 AND imdb_rating = 5.8;
-- The Karate Kid (2010) 6.3/231031 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '7bc68be2-d54b-4fba-a2c6-6af7711a6b76' AND curation_tier = 'extended' AND release_date = '2010-06-10' AND imdb_votes = 231031 AND imdb_id = 'tt1155076' AND imdb_rating = 6.3;
-- Aşkın Gücü (1998) 7/122190 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '7cbcfd92-1f1d-47dc-8ab0-39e6feb8598f' AND curation_tier = 'extended' AND release_date = '1998-10-02' AND imdb_votes = 122190 AND imdb_rating = 7;
-- A Quiet Place (2018) 7.5/672743 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '7cd3dc97-8913-4884-9a87-6a26cef5044a' AND curation_tier = 'extended' AND release_date = '2018-04-03' AND imdb_votes = 672743 AND imdb_id = 'tt6644200' AND imdb_rating = 7.5;
-- Jack Reacher (2012) 7/396899 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '7d4e9928-5e4c-4692-a5cf-ae8ee69555c9' AND curation_tier = 'extended' AND release_date = '2012-12-20' AND imdb_votes = 396899 AND imdb_id = 'tt0790724' AND imdb_rating = 7;
-- Rogue One: A Star Wars Story (2016) 7.8/768349 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '7e38f4c0-2a43-44a3-81f1-097beeccc598' AND curation_tier = 'extended' AND release_date = '2016-12-14' AND imdb_votes = 768349 AND imdb_id = 'tt3748528' AND imdb_rating = 7.8;
-- Toz Yumağı (2025) 6.5/22274 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '7e4ba268-065c-4761-96f2-0e7f21cbeed1' AND curation_tier = 'extended' AND release_date = '2025-12-11' AND imdb_votes = 22274 AND imdb_rating = 6.5;
-- Taken (2008) 7.7/680318 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '7e7bac90-e401-401b-9c3e-3e6e0875207a' AND curation_tier = 'extended' AND release_date = '2008-02-18' AND imdb_votes = 680318 AND imdb_rating = 7.7;
-- The Princess and the Frog (2009) 7.2/191335 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '7f03cf96-2de6-4a7c-a906-afac60756307' AND curation_tier = 'extended' AND release_date = '2009-12-08' AND imdb_votes = 191335 AND imdb_id = 'tt0780521' AND imdb_rating = 7.2;
-- Ferris Bueller's Day Off (1986) 7.8/421863 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '7fb1905c-676c-423f-887e-2ee9153494a2' AND curation_tier = 'extended' AND release_date = '1986-06-11' AND imdb_votes = 421863 AND imdb_id = 'tt0091042' AND imdb_rating = 7.8;
-- Baby Driver (2017) 7.5/698359 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '80f59a4d-3560-4363-82ce-53006befe6f9' AND curation_tier = 'extended' AND release_date = '2017-06-28' AND imdb_votes = 698359 AND imdb_id = 'tt3890160' AND imdb_rating = 7.5;
-- ಕಾಂತಾರ: ಅಧ್ಯಾಯ - ೧ (2025) 8.1/59930 → core
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '8206b35b-97b2-44b1-bd40-d733971835c8' AND curation_tier = 'core' AND release_date = '2025-10-02' AND imdb_votes = 59930 AND imdb_rating = 8.1;
-- Greyhound (2020) 7/137732 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '82457104-c187-4a5f-8b2e-4f2c84a05af0' AND curation_tier = 'extended' AND release_date = '2020-07-09' AND imdb_votes = 137732 AND imdb_id = 'tt6048922' AND imdb_rating = 7;
-- Dead of Winter (2025) 6.1/24916 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '82ee4b64-f231-420a-bff5-652ff92c5ec0' AND curation_tier = 'extended' AND release_date = '2025-09-23' AND imdb_votes = 24916 AND imdb_id = 'tt7574556' AND imdb_rating = 6.1;
-- The Turin Horse (2011) 7.7/21874 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '83709df2-318b-4e6b-9123-4c64c5c328a5' AND curation_tier = 'extended' AND release_date = '2011-03-31' AND imdb_votes = 21874 AND imdb_id = 'tt1316540' AND imdb_rating = 7.7;
-- Idiocracy (2006) 6.5/223320 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '84387156-ccb0-4b82-80e0-abab1a7e11dc' AND curation_tier = 'extended' AND release_date = '2006-09-01' AND imdb_votes = 223320 AND imdb_id = 'tt0387808' AND imdb_rating = 6.5;
-- The Hurricane (1999) 7.6/109416 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '8504e080-bc08-4f4c-9be6-0688c64327b7' AND curation_tier = 'extended' AND release_date = '1999-09-17' AND imdb_votes = 109416 AND imdb_id = 'tt0174856' AND imdb_rating = 7.6;
-- A Walk Among the Tombstones (2014) 6.5/132660 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '86597a3f-acdb-495b-bf59-a41c42c89d92' AND curation_tier = 'extended' AND release_date = '2014-09-18' AND imdb_votes = 132660 AND imdb_id = 'tt0365907' AND imdb_rating = 6.5;
-- Andhadhun (2018) 8.2/118929 → core
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '86dcc414-7ec0-4d6a-b539-42e03321d2ce' AND curation_tier = 'core' AND release_date = '2018-10-05' AND imdb_votes = 118929 AND imdb_id = 'tt8108198' AND imdb_rating = 8.2;
-- Donnie Brasco (1997) 7.7/362082 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '87057820-7574-4855-a68d-837168f64429' AND curation_tier = 'extended' AND release_date = '1997-02-27' AND imdb_votes = 362082 AND imdb_id = 'tt0119008' AND imdb_rating = 7.7;
-- The Cider House Rules (1999) 7.4/110486 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '8728e3ef-0152-45aa-b924-3830b651232d' AND curation_tier = 'extended' AND release_date = '1999-12-17' AND imdb_votes = 110486 AND imdb_rating = 7.4;

COMMIT;
