-- MOOD-VEC-2b Faz 2C (parça 12/19): c-apply'ın geri alması. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Her UPDATE yalnız uygulanan değerleri taşıyan satırı eski haline (release_date NULL, tier archive) döndürür.

BEGIN;

-- Elvis (2022) 7.3/265789 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '935a3af6-eb81-4693-bd90-4ef09f19cfb9' AND curation_tier = 'extended' AND release_date = '2022-06-22' AND imdb_votes = 265789 AND imdb_id = 'tt3704428' AND imdb_rating = 7.3;
-- My Girl (1991) 6.9/99689 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '94127cf6-1c29-4c4b-9a69-55e47d7e3a54' AND curation_tier = 'extended' AND release_date = '1991-11-21' AND imdb_votes = 99689 AND imdb_id = 'tt0102492' AND imdb_rating = 6.9;
-- Saw (2004) 7.6/519214 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '947f095b-1c5f-4c7d-9b15-ab519acb67b0' AND curation_tier = 'extended' AND release_date = '2004-10-01' AND imdb_votes = 519214 AND imdb_id = 'tt0387564' AND imdb_rating = 7.6;
-- When Harry Met Sally... (1989) 7.7/277129 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '94ddb2aa-5d49-428e-9334-11a7f6adbaad' AND curation_tier = 'extended' AND release_date = '1989-07-12' AND imdb_votes = 277129 AND imdb_id = 'tt0098635' AND imdb_rating = 7.7;
-- Train Dreams (2025) 7.5/118112 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '950b6f4d-4b73-454f-a823-97a0f8cd1ee3' AND curation_tier = 'extended' AND release_date = '2025-11-05' AND imdb_votes = 118112 AND imdb_rating = 7.5;
-- Da Vinci Şifresi (2006) 6.7/491799 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '95596467-ff82-4159-b9c1-8a64762e4fb4' AND curation_tier = 'extended' AND release_date = '2006-05-17' AND imdb_votes = 491799 AND imdb_rating = 6.7;
-- Paddington 2 (2017) 7.8/117092 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '9688fcab-7307-43e7-8c30-4a8d316b15fe' AND curation_tier = 'extended' AND release_date = '2017-11-05' AND imdb_votes = 117092 AND imdb_id = 'tt4468740' AND imdb_rating = 7.8;
-- The Two Popes (2019) 7.6/148516 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '9795b0c5-f165-4457-92d7-0aaac5979fce' AND curation_tier = 'extended' AND release_date = '2019-11-27' AND imdb_votes = 148516 AND imdb_id = 'tt8404614' AND imdb_rating = 7.6;
-- M3GAN 2.0 (2025) 6/56991 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '98a56260-86b7-4e54-9fa0-de07bcea47b2' AND curation_tier = 'extended' AND release_date = '2025-06-25' AND imdb_votes = 56991 AND imdb_rating = 6;
-- Eenie Meanie (2025) 5.9/14339 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '98fcb39d-33ac-4bbd-842c-bf8fa800f5fc' AND curation_tier = 'extended' AND release_date = '2025-08-21' AND imdb_votes = 14339 AND imdb_id = 'tt15514498' AND imdb_rating = 5.9;
-- Wicked (2024) 7.3/259313 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '9be3491d-2ff2-42ba-b73f-df803061f4dc' AND curation_tier = 'extended' AND release_date = '2024-10-16' AND imdb_votes = 259313 AND imdb_rating = 7.3;
-- Nocturnal Animals (2016) 7.4/347125 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '9c375abf-541b-4fd4-b288-0b8b44f10cca' AND curation_tier = 'extended' AND release_date = '2016-11-04' AND imdb_votes = 347125 AND imdb_id = 'tt4550098' AND imdb_rating = 7.4;
-- The Lego Movie (2014) 7.7/422748 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '9c977ddc-b554-4d49-85f5-31ffa35f9359' AND curation_tier = 'extended' AND release_date = '2014-02-06' AND imdb_votes = 422748 AND imdb_id = 'tt1490017' AND imdb_rating = 7.7;
-- Sosis Partisi (2016) 6.1/229866 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '9c9ccbd2-e54e-4a87-b7f3-aeebd72b6098' AND curation_tier = 'extended' AND release_date = '2016-07-11' AND imdb_votes = 229866 AND imdb_rating = 6.1;
-- The Fugitive (1993) 7.8/351715 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '9ca6fda9-a326-4564-bffa-4211243949da' AND curation_tier = 'extended' AND release_date = '1993-08-06' AND imdb_votes = 351715 AND imdb_id = 'tt0106977' AND imdb_rating = 7.8;
-- The Girl Next Door (2004) 6.7/267950 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '9cb88272-ace2-4107-bff6-6f90f655ad5e' AND curation_tier = 'extended' AND release_date = '2004-04-09' AND imdb_votes = 267950 AND imdb_id = 'tt0265208' AND imdb_rating = 6.7;
-- Lucky Number Slevin (2006) 7.7/342446 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '9cfefcb8-9c56-42e2-98b1-644875c54fcf' AND curation_tier = 'extended' AND release_date = '2006-02-24' AND imdb_votes = 342446 AND imdb_id = 'tt0425210' AND imdb_rating = 7.7;
-- Blue Moon (2025) 6.8/26739 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '9dd3196c-bc6b-4c98-a9bd-0684227f2bd0' AND curation_tier = 'extended' AND release_date = '2025-10-17' AND imdb_votes = 26739 AND imdb_rating = 6.8;
-- Moulin Rouge! (2001) 7.5/317819 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '9e45da7f-e6b6-45cf-8494-58ac29216bbd' AND curation_tier = 'extended' AND release_date = '2001-05-18' AND imdb_votes = 317819 AND imdb_id = 'tt0203009' AND imdb_rating = 7.5;
-- The Wrestler (2008) 7.9/333314 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'a2c07e00-6141-48d7-a4aa-d79a53a4f72a' AND curation_tier = 'extended' AND release_date = '2008-12-17' AND imdb_votes = 333314 AND imdb_id = 'tt1125849' AND imdb_rating = 7.9;
-- In Bruges (2008) 7.9/499693 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'a3bff360-e1c3-47c8-87b7-e12d11bb6095' AND curation_tier = 'extended' AND release_date = '2008-02-08' AND imdb_votes = 499693 AND imdb_id = 'tt0780536' AND imdb_rating = 7.9;
-- A Perfect World (1993) 7.5/95165 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'a479f99a-cec4-4fb8-9f17-a1d5c0f63597' AND curation_tier = 'extended' AND release_date = '1993-11-24' AND imdb_votes = 95165 AND imdb_id = 'tt0107808' AND imdb_rating = 7.5;

COMMIT;
