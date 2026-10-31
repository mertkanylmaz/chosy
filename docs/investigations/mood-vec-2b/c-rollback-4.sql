-- MOOD-VEC-2b Faz 2C (parça 4/19): c-apply'ın geri alması. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Her UPDATE yalnız uygulanan değerleri taşıyan satırı eski haline (release_date NULL, tier archive) döndürür.

BEGIN;

-- Jurassic World (2015) 6.9/740311 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '33cf446f-68de-43e9-aee9-36ebd7b301fd' AND curation_tier = 'extended' AND release_date = '2015-06-06' AND imdb_votes = 740311 AND imdb_id = 'tt0369610' AND imdb_rating = 6.9;
-- The Mauritanian (2021) 7.5/73211 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '345533cd-2aa8-45f0-b783-29fcba4aafa3' AND curation_tier = 'extended' AND release_date = '2021-02-12' AND imdb_votes = 73211 AND imdb_id = 'tt4761112' AND imdb_rating = 7.5;
-- My Cousin Vinny (1992) 7.6/162749 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '347676d4-0b0e-4d2e-8284-909080f2c43e' AND curation_tier = 'extended' AND release_date = '1992-03-13' AND imdb_votes = 162749 AND imdb_id = 'tt0104952' AND imdb_rating = 7.6;
-- Jurassic World: Yeniden Doğuş (2025) 5.8/207918 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '35313f3e-ad36-4c8d-94d1-12b29eff14a1' AND curation_tier = 'extended' AND release_date = '2025-06-23' AND imdb_votes = 207918 AND imdb_rating = 5.8;
-- mid90s (2018) 7.4/90171 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '35eed166-37c6-4ce0-b89b-f91c8887d02c' AND curation_tier = 'extended' AND release_date = '2018-10-19' AND imdb_votes = 90171 AND imdb_id = 'tt5613484' AND imdb_rating = 7.4;
-- The Passion of the Christ (2004) 7.3/278043 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '360ebec4-e484-4a7b-90f5-650c9ae97ea0' AND curation_tier = 'extended' AND release_date = '2004-02-25' AND imdb_votes = 278043 AND imdb_id = 'tt0335345' AND imdb_rating = 7.3;
-- Pillion (2025) 6.9/25292 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '36c2814e-461a-4746-b611-1ec77450f500' AND curation_tier = 'extended' AND release_date = '2025-11-28' AND imdb_votes = 25292 AND imdb_id = 'tt32321317' AND imdb_rating = 6.9;
-- Synecdoche, New York (2008) 7.5/106242 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '38345eb2-0f5b-4872-adf9-e5355c8020d6' AND curation_tier = 'extended' AND release_date = '2008-10-24' AND imdb_votes = 106242 AND imdb_id = 'tt0383028' AND imdb_rating = 7.5;
-- I Can Only Imagine (2018) 7.3/21273 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '39e89fac-6172-4826-80a6-4d2b2fcd08af' AND curation_tier = 'extended' AND release_date = '2018-02-14' AND imdb_votes = 21273 AND imdb_id = 'tt6450186' AND imdb_rating = 7.3;
-- Invisible Life (2019) 7.7/10962 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '3a1e3537-4da7-4097-bd32-d671f8ca8ef1' AND curation_tier = 'extended' AND release_date = '2019-08-30' AND imdb_votes = 10962 AND imdb_id = 'tt6390668' AND imdb_rating = 7.7;
-- Birdman or (The Unexpected Virtue of Ignorance) (2014) 7.7/705545 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '3a214e4e-9438-4e81-96c7-5ba990d06565' AND curation_tier = 'extended' AND release_date = '2014-10-17' AND imdb_votes = 705545 AND imdb_id = 'tt2562232' AND imdb_rating = 7.7;
-- Sihirbazlar Çetesi: Daha Bir Şey Görmediniz (2025) 5.9/82027 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '3a686125-c206-4d79-a44e-f76a1b397509' AND curation_tier = 'extended' AND release_date = '2025-11-12' AND imdb_votes = 82027 AND imdb_rating = 5.9;
-- First Blood (1982) 7.7/307333 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '3b7eba47-3876-4dcb-a4a1-10ebf104444e' AND curation_tier = 'extended' AND release_date = '1982-10-22' AND imdb_votes = 307333 AND imdb_id = 'tt0083944' AND imdb_rating = 7.7;
-- Facing the Giants (2006) 6.5/19486 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '3c129e5a-3b05-48fe-9087-2f7dc73f7be6' AND curation_tier = 'extended' AND release_date = '2006-09-29' AND imdb_votes = 19486 AND imdb_id = 'tt0805526' AND imdb_rating = 6.5;
-- Terminator Genisys (2015) 6.3/310895 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '3cf552f1-27ba-4586-8bd0-e530378b2aa8' AND curation_tier = 'extended' AND release_date = '2015-06-23' AND imdb_votes = 310895 AND imdb_rating = 6.3;
-- American Made (2017) 7.2/238385 → extended
UPDATE films SET release_date = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '3cf9dc31-0ba2-455c-848f-b606b7f72e89' AND curation_tier = 'extended' AND release_date = '2017-08-18' AND imdb_votes = 238385 AND imdb_rating = 7.2;
-- American Sniper (2014) 7.3/578212 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '3d7f28a9-6a54-43e6-8188-9edc81e09558' AND curation_tier = 'extended' AND release_date = '2014-12-25' AND imdb_votes = 578212 AND imdb_id = 'tt2179136' AND imdb_rating = 7.3;
-- Bāhubali: The Beginning (2015) 8/157474 → core
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '3d8dd80b-7444-45fc-bc22-f95c613243d0' AND curation_tier = 'core' AND release_date = '2015-07-09' AND imdb_votes = 157474 AND imdb_id = 'tt2631186' AND imdb_rating = 8;
-- Karate Kid: Legends (2025) 6.3/51126 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '3de85234-93fd-40e9-9cee-d29e42e98762' AND curation_tier = 'extended' AND release_date = '2025-05-08' AND imdb_votes = 51126 AND imdb_id = 'tt1674782' AND imdb_rating = 6.3;
-- The Machinist (2004) 7.6/448073 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '3df241d4-9c12-4cb9-9ccf-e54732840eda' AND curation_tier = 'extended' AND release_date = '2004-09-24' AND imdb_votes = 448073 AND imdb_id = 'tt0361862' AND imdb_rating = 7.6;
-- Skyfall (2012) 7.8/782676 → extended
UPDATE films SET release_date = NULL, imdb_id = NULL, imdb_votes = NULL, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '3eba73e4-4416-4687-852b-cb4eaa37d3de' AND curation_tier = 'extended' AND release_date = '2012-10-24' AND imdb_votes = 782676 AND imdb_id = 'tt1074638' AND imdb_rating = 7.8;

COMMIT;
