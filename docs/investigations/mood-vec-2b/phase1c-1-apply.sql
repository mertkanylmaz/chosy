-- MOOD-VEC-2b Faz 1C-1: 30 arşiv filminin imdb_votes[/imdb_rating] + curation_tier'ı (oy: IMDb veri dosyası). HAZIRLANDI, ÇALIŞTIRILMADI.
-- Her UPDATE filmin hâlâ archive olduğunu ve imdb_votes'un hazırlık anındaki değerde olduğunu doğrular (kayma varsa 0 satır).
-- Beklenen: 30 UPDATE × 1 satır. Geri alma: phase1c-1-rollback.sql.

BEGIN;

-- Yedek: değişecek 30 filmin önceki değerleri. Tablo zaten varsa bu satır hata verir ve işlem durur (üzerine yazma yok).
CREATE TABLE films_phase1c1_backup_20261031 AS
  SELECT id, imdb_id, imdb_rating, imdb_votes, curation_tier FROM films WHERE id IN ('0ad988cd-0575-44d5-8862-7e4c6e72ea68', '13e91e46-87c4-4635-aa56-4793d48a43c1', '1f36b8b7-ac62-48be-acbd-17bef716b3bb', '21b5214e-6055-465f-b053-3542bd7fe8cd', '251b49c2-bef5-4ba6-a673-0cf19ff7f4fd', '26b94fcf-4aff-44ff-9f68-d23d1bee9132', '289cab7d-e354-472d-8fc5-d0d2e8303afc', '363e0143-a063-412a-8cc6-6bdc3a0fd7fd', '479f4368-baeb-4cdf-8af6-1122ecda4d07', '4efba55a-cc49-4baf-81a2-c5d6ebf22c15', '56094c0d-c1ad-415d-9f57-46c94d8d2ed2', '5b937f7a-f68a-40f3-8481-371c538f69e1', '617a44ee-e88e-4afb-8396-2d5af3c7af3e', '634fec75-7e9d-4c85-b501-5b38bf711f4a', '7098fbaa-7eb4-42c4-a69a-81ab8cde0381', '7558f34a-eca9-4e8d-9191-a664519f9fa6', '7805287d-0bca-4877-acc5-771819ca1e2c', '7c9e8338-e918-4355-98ba-f991f8c4a1e6', '7cdb2fc9-ccda-4e93-8a4d-e43eb2ca1871', '7f6f735b-7f48-4584-b1a1-cd31fd8ed4ce', '806c845d-a95f-4b83-8b56-b6b3e0c1c832', '837397a9-e4bf-4755-a462-9e7455fd0563', '88fa0cc2-412e-4bb5-8e03-83bb5b9a0997', '8f860992-c53f-4390-8088-e063bc4465b3', '93943fad-ec69-4c0a-9fe1-5f9537680807', '96274104-3278-4a0d-ab7a-4ae6816fc335', '9c983c98-1419-43d5-9b16-74a1b7588dfe', '9fb78847-79a5-4342-9b76-2945ecc7cd28', '9fe39854-4a0c-4398-95c4-abec922e1335', 'a0ef0ce9-95fe-44b9-8a09-adccf1a1dad3');
ALTER TABLE films_phase1c1_backup_20261031 ENABLE ROW LEVEL SECURITY;

-- Bleeder (1999, A, 6.8/11822; eski DB oyu 9890) → extended
UPDATE films SET imdb_votes = 11822, curation_tier = 'extended' WHERE id = '0ad988cd-0575-44d5-8862-7e4c6e72ea68' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 9890;
-- The Ballad of Narayama (1983, A, 7.8/10140; eski DB oyu 9789) → extended
UPDATE films SET imdb_votes = 10140, curation_tier = 'extended' WHERE id = '13e91e46-87c4-4635-aa56-4793d48a43c1' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 9789;
-- Dr. Mabuse, the Gambler (1922, A, 7.8/10117; eski DB oyu 9645) → core
UPDATE films SET imdb_votes = 10117, curation_tier = 'core' WHERE id = '1f36b8b7-ac62-48be-acbd-17bef716b3bb' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 9645;
-- One Piece: Stampede (2019, A, 7.5/10206; eski DB oyu 9548) → extended
UPDATE films SET imdb_votes = 10206, curation_tier = 'extended' WHERE id = '21b5214e-6055-465f-b053-3542bd7fe8cd' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 9548;
-- No Mercy (2010, A, 7.4/11205; eski DB oyu 9896) → extended
UPDATE films SET imdb_votes = 11205, curation_tier = 'extended' WHERE id = '251b49c2-bef5-4ba6-a673-0cf19ff7f4fd' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 9896;
-- It Ends with Us (2024, B, 6.3/106254; eski DB oyu 1965) → extended
UPDATE films SET imdb_votes = 106254, imdb_rating = 6.3, curation_tier = 'extended' WHERE id = '26b94fcf-4aff-44ff-9f68-d23d1bee9132' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 1965 AND imdb_rating IS NULL;
-- Tuner (2026, B, 7.2/37829; eski DB oyu 78) → extended
UPDATE films SET imdb_votes = 37829, imdb_rating = 7.2, curation_tier = 'extended' WHERE id = '289cab7d-e354-472d-8fc5-d0d2e8303afc' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 78 AND imdb_rating IS NULL;
-- Officer Black Belt (2024, A, 6.9/11178; eski DB oyu 9895) → extended
UPDATE films SET imdb_votes = 11178, curation_tier = 'extended' WHERE id = '363e0143-a063-412a-8cc6-6bdc3a0fd7fd' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 9895;
-- The Sheep Detectives (2026, B, 7.4/123542; eski DB oyu 185) → extended
UPDATE films SET imdb_votes = 123542, imdb_rating = 7.4, curation_tier = 'extended' WHERE id = '479f4368-baeb-4cdf-8af6-1122ecda4d07' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 185 AND imdb_rating IS NULL;
-- They Will Kill You (2026, A, 6.5/55202; eski DB oyu 8025) → extended
UPDATE films SET imdb_votes = 55202, curation_tier = 'extended' WHERE id = '4efba55a-cc49-4baf-81a2-c5d6ebf22c15' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 8025;
-- Humanist Vampire Seeking Consenting Suicidal Person (2023, A, 7/13035; eski DB oyu 8736) → extended
UPDATE films SET imdb_votes = 13035, curation_tier = 'extended' WHERE id = '56094c0d-c1ad-415d-9f57-46c94d8d2ed2' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 8736;
-- Pirates (1986, A, 6/10309; eski DB oyu 9984) → extended
UPDATE films SET imdb_votes = 10309, curation_tier = 'extended' WHERE id = '5b937f7a-f68a-40f3-8481-371c538f69e1' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 9984;
-- Satluj (2026, B, 8.8/106958; eski DB oyu 8) → core
UPDATE films SET imdb_votes = 106958, imdb_rating = 8.8, curation_tier = 'core' WHERE id = '617a44ee-e88e-4afb-8396-2d5af3c7af3e' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 8 AND imdb_rating IS NULL;
-- The Summit of the Gods (2021, A, 7.5/11923; eski DB oyu 9339) → extended
UPDATE films SET imdb_votes = 11923, curation_tier = 'extended' WHERE id = '634fec75-7e9d-4c85-b501-5b38bf711f4a' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 9339;
-- Fuze (2026, B, 6.3/19848; eski DB oyu 166) → extended
UPDATE films SET imdb_votes = 19848, imdb_rating = 6.3, curation_tier = 'extended' WHERE id = '7098fbaa-7eb4-42c4-a69a-81ab8cde0381' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 166 AND imdb_rating IS NULL;
-- Your Name Engraved Herein (2020, A, 7.3/10293; eski DB oyu 8433) → extended
UPDATE films SET imdb_votes = 10293, curation_tier = 'extended' WHERE id = '7558f34a-eca9-4e8d-9191-a664519f9fa6' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 8433;
-- Samurai I: Musashi Miyamoto (1954, A, 7.4/10521; eski DB oyu 9728) → extended
UPDATE films SET imdb_votes = 10521, curation_tier = 'extended' WHERE id = '7805287d-0bca-4877-acc5-771819ca1e2c' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 9728;
-- French Fried Vacation 2 (1979, A, 7.4/10380; eski DB oyu 9323) → extended
UPDATE films SET imdb_votes = 10380, curation_tier = 'extended' WHERE id = '7c9e8338-e918-4355-98ba-f991f8c4a1e6' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 9323;
-- Secret (2007, A, 7.5/10015; eski DB oyu 9636) → extended
UPDATE films SET imdb_votes = 10015, curation_tier = 'extended' WHERE id = '7cdb2fc9-ccda-4e93-8a4d-e43eb2ca1871' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 9636;
-- Angel's Egg (1985, A, 7.7/18380; eski DB oyu 7817) → extended
UPDATE films SET imdb_votes = 18380, curation_tier = 'extended' WHERE id = '7f6f735b-7f48-4584-b1a1-cd31fd8ed4ce' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 7817;
-- Paisan (1946, A, 7.6/10916; eski DB oyu 9963) → extended
UPDATE films SET imdb_votes = 10916, curation_tier = 'extended' WHERE id = '806c845d-a95f-4b83-8b56-b6b3e0c1c832' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 9963;
-- Black Clover: Sword of the Wizard King (2023, A, 7.4/10616; eski DB oyu 9611) → extended
UPDATE films SET imdb_votes = 10616, curation_tier = 'extended' WHERE id = '837397a9-e4bf-4755-a462-9e7455fd0563' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 9611;
-- I'm No Longer Here (2019, A, 7.3/10643; eski DB oyu 9619) → extended
UPDATE films SET imdb_votes = 10643, curation_tier = 'extended' WHERE id = '88fa0cc2-412e-4bb5-8e03-83bb5b9a0997' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 9619;
-- Escape Plan (2013, B, 6.7/273173; eski DB oyu 5606) → extended
UPDATE films SET imdb_votes = 273173, imdb_rating = 6.7, curation_tier = 'extended' WHERE id = '8f860992-c53f-4390-8088-e063bc4465b3' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 5606 AND imdb_rating IS NULL;
-- Package Tour (1980, A, 7.2/10080; eski DB oyu 9242) → extended
UPDATE films SET imdb_votes = 10080, curation_tier = 'extended' WHERE id = '93943fad-ec69-4c0a-9fe1-5f9537680807' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 9242;
-- Satantango (1994, B, 8.2/14693; eski DB oyu 309) → core
UPDATE films SET imdb_votes = 14693, imdb_rating = 8.2, curation_tier = 'core' WHERE id = '96274104-3278-4a0d-ab7a-4ae6816fc335' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 309 AND imdb_rating IS NULL;
-- Late Shift (2025, A, 7.7/11872; eski DB oyu 8557) → extended
UPDATE films SET imdb_votes = 11872, curation_tier = 'extended' WHERE id = '9c983c98-1419-43d5-9b16-74a1b7588dfe' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 8557;
-- The Round Up (2010, A, 7/10057; eski DB oyu 9559) → extended
UPDATE films SET imdb_votes = 10057, curation_tier = 'extended' WHERE id = '9fb78847-79a5-4342-9b76-2945ecc7cd28' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 9559;
-- Early Summer (1951, A, 8.1/10947; eski DB oyu 9910) → core
UPDATE films SET imdb_votes = 10947, curation_tier = 'core' WHERE id = '9fe39854-4a0c-4398-95c4-abec922e1335' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 9910;
-- Black Adam (2022, B, 6.1/310189; eski DB oyu 7046) → extended
UPDATE films SET imdb_votes = 310189, imdb_rating = 6.1, curation_tier = 'extended' WHERE id = 'a0ef0ce9-95fe-44b9-8a09-adccf1a1dad3' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 7046 AND imdb_rating IS NULL;

-- Doğrulama: yedek 30 satır olmalı ve hiçbir film eski tier'da kalmamalı; aksi halde işlem geri alınır.
DO $$
DECLARE _backup INT; _unchanged INT;
BEGIN
  SELECT count(*) INTO _backup FROM films_phase1c1_backup_20261031;
  SELECT count(*) INTO _unchanged FROM films f JOIN films_phase1c1_backup_20261031 b ON b.id = f.id WHERE f.curation_tier = b.curation_tier;
  IF _backup <> 30 THEN RAISE EXCEPTION 'ABORT: yedek % satır (beklenen 30)', _backup; END IF;
  IF _unchanged <> 0 THEN RAISE EXCEPTION 'ABORT: % film tier degistirmedi (UPDATE 0 satir etkiledi)', _unchanged; END IF;
END $$;

COMMIT;
