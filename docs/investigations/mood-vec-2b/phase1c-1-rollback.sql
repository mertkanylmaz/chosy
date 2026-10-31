-- MOOD-VEC-2b Faz 1C-1: phase1c-1-apply.sql'in geri alması. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Her UPDATE yalnız uygulanan değerleri taşıyan satırı eski haline (eski oy, B'de rating NULL, tier archive) döndürür.

BEGIN;

-- Bleeder (1999, A, 6.8/11822; eski DB oyu 9890) → extended
UPDATE films SET imdb_votes = 9890, curation_tier = 'archive' WHERE id = '0ad988cd-0575-44d5-8862-7e4c6e72ea68' AND curation_tier = 'extended' AND imdb_votes = 11822;
-- The Ballad of Narayama (1983, A, 7.8/10140; eski DB oyu 9789) → extended
UPDATE films SET imdb_votes = 9789, curation_tier = 'archive' WHERE id = '13e91e46-87c4-4635-aa56-4793d48a43c1' AND curation_tier = 'extended' AND imdb_votes = 10140;
-- Dr. Mabuse, the Gambler (1922, A, 7.8/10117; eski DB oyu 9645) → core
UPDATE films SET imdb_votes = 9645, curation_tier = 'archive' WHERE id = '1f36b8b7-ac62-48be-acbd-17bef716b3bb' AND curation_tier = 'core' AND imdb_votes = 10117;
-- One Piece: Stampede (2019, A, 7.5/10206; eski DB oyu 9548) → extended
UPDATE films SET imdb_votes = 9548, curation_tier = 'archive' WHERE id = '21b5214e-6055-465f-b053-3542bd7fe8cd' AND curation_tier = 'extended' AND imdb_votes = 10206;
-- No Mercy (2010, A, 7.4/11205; eski DB oyu 9896) → extended
UPDATE films SET imdb_votes = 9896, curation_tier = 'archive' WHERE id = '251b49c2-bef5-4ba6-a673-0cf19ff7f4fd' AND curation_tier = 'extended' AND imdb_votes = 11205;
-- It Ends with Us (2024, B, 6.3/106254; eski DB oyu 1965) → extended
UPDATE films SET imdb_votes = 1965, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '26b94fcf-4aff-44ff-9f68-d23d1bee9132' AND curation_tier = 'extended' AND imdb_votes = 106254 AND imdb_rating = 6.3;
-- Tuner (2026, B, 7.2/37829; eski DB oyu 78) → extended
UPDATE films SET imdb_votes = 78, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '289cab7d-e354-472d-8fc5-d0d2e8303afc' AND curation_tier = 'extended' AND imdb_votes = 37829 AND imdb_rating = 7.2;
-- Officer Black Belt (2024, A, 6.9/11178; eski DB oyu 9895) → extended
UPDATE films SET imdb_votes = 9895, curation_tier = 'archive' WHERE id = '363e0143-a063-412a-8cc6-6bdc3a0fd7fd' AND curation_tier = 'extended' AND imdb_votes = 11178;
-- The Sheep Detectives (2026, B, 7.4/123542; eski DB oyu 185) → extended
UPDATE films SET imdb_votes = 185, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '479f4368-baeb-4cdf-8af6-1122ecda4d07' AND curation_tier = 'extended' AND imdb_votes = 123542 AND imdb_rating = 7.4;
-- They Will Kill You (2026, A, 6.5/55202; eski DB oyu 8025) → extended
UPDATE films SET imdb_votes = 8025, curation_tier = 'archive' WHERE id = '4efba55a-cc49-4baf-81a2-c5d6ebf22c15' AND curation_tier = 'extended' AND imdb_votes = 55202;
-- Humanist Vampire Seeking Consenting Suicidal Person (2023, A, 7/13035; eski DB oyu 8736) → extended
UPDATE films SET imdb_votes = 8736, curation_tier = 'archive' WHERE id = '56094c0d-c1ad-415d-9f57-46c94d8d2ed2' AND curation_tier = 'extended' AND imdb_votes = 13035;
-- Pirates (1986, A, 6/10309; eski DB oyu 9984) → extended
UPDATE films SET imdb_votes = 9984, curation_tier = 'archive' WHERE id = '5b937f7a-f68a-40f3-8481-371c538f69e1' AND curation_tier = 'extended' AND imdb_votes = 10309;
-- Satluj (2026, B, 8.8/106958; eski DB oyu 8) → core
UPDATE films SET imdb_votes = 8, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '617a44ee-e88e-4afb-8396-2d5af3c7af3e' AND curation_tier = 'core' AND imdb_votes = 106958 AND imdb_rating = 8.8;
-- The Summit of the Gods (2021, A, 7.5/11923; eski DB oyu 9339) → extended
UPDATE films SET imdb_votes = 9339, curation_tier = 'archive' WHERE id = '634fec75-7e9d-4c85-b501-5b38bf711f4a' AND curation_tier = 'extended' AND imdb_votes = 11923;
-- Fuze (2026, B, 6.3/19848; eski DB oyu 166) → extended
UPDATE films SET imdb_votes = 166, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '7098fbaa-7eb4-42c4-a69a-81ab8cde0381' AND curation_tier = 'extended' AND imdb_votes = 19848 AND imdb_rating = 6.3;
-- Your Name Engraved Herein (2020, A, 7.3/10293; eski DB oyu 8433) → extended
UPDATE films SET imdb_votes = 8433, curation_tier = 'archive' WHERE id = '7558f34a-eca9-4e8d-9191-a664519f9fa6' AND curation_tier = 'extended' AND imdb_votes = 10293;
-- Samurai I: Musashi Miyamoto (1954, A, 7.4/10521; eski DB oyu 9728) → extended
UPDATE films SET imdb_votes = 9728, curation_tier = 'archive' WHERE id = '7805287d-0bca-4877-acc5-771819ca1e2c' AND curation_tier = 'extended' AND imdb_votes = 10521;
-- French Fried Vacation 2 (1979, A, 7.4/10380; eski DB oyu 9323) → extended
UPDATE films SET imdb_votes = 9323, curation_tier = 'archive' WHERE id = '7c9e8338-e918-4355-98ba-f991f8c4a1e6' AND curation_tier = 'extended' AND imdb_votes = 10380;
-- Secret (2007, A, 7.5/10015; eski DB oyu 9636) → extended
UPDATE films SET imdb_votes = 9636, curation_tier = 'archive' WHERE id = '7cdb2fc9-ccda-4e93-8a4d-e43eb2ca1871' AND curation_tier = 'extended' AND imdb_votes = 10015;
-- Angel's Egg (1985, A, 7.7/18380; eski DB oyu 7817) → extended
UPDATE films SET imdb_votes = 7817, curation_tier = 'archive' WHERE id = '7f6f735b-7f48-4584-b1a1-cd31fd8ed4ce' AND curation_tier = 'extended' AND imdb_votes = 18380;
-- Paisan (1946, A, 7.6/10916; eski DB oyu 9963) → extended
UPDATE films SET imdb_votes = 9963, curation_tier = 'archive' WHERE id = '806c845d-a95f-4b83-8b56-b6b3e0c1c832' AND curation_tier = 'extended' AND imdb_votes = 10916;
-- Black Clover: Sword of the Wizard King (2023, A, 7.4/10616; eski DB oyu 9611) → extended
UPDATE films SET imdb_votes = 9611, curation_tier = 'archive' WHERE id = '837397a9-e4bf-4755-a462-9e7455fd0563' AND curation_tier = 'extended' AND imdb_votes = 10616;
-- I'm No Longer Here (2019, A, 7.3/10643; eski DB oyu 9619) → extended
UPDATE films SET imdb_votes = 9619, curation_tier = 'archive' WHERE id = '88fa0cc2-412e-4bb5-8e03-83bb5b9a0997' AND curation_tier = 'extended' AND imdb_votes = 10643;
-- Escape Plan (2013, B, 6.7/273173; eski DB oyu 5606) → extended
UPDATE films SET imdb_votes = 5606, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '8f860992-c53f-4390-8088-e063bc4465b3' AND curation_tier = 'extended' AND imdb_votes = 273173 AND imdb_rating = 6.7;
-- Package Tour (1980, A, 7.2/10080; eski DB oyu 9242) → extended
UPDATE films SET imdb_votes = 9242, curation_tier = 'archive' WHERE id = '93943fad-ec69-4c0a-9fe1-5f9537680807' AND curation_tier = 'extended' AND imdb_votes = 10080;
-- Satantango (1994, B, 8.2/14693; eski DB oyu 309) → core
UPDATE films SET imdb_votes = 309, imdb_rating = NULL, curation_tier = 'archive' WHERE id = '96274104-3278-4a0d-ab7a-4ae6816fc335' AND curation_tier = 'core' AND imdb_votes = 14693 AND imdb_rating = 8.2;
-- Late Shift (2025, A, 7.7/11872; eski DB oyu 8557) → extended
UPDATE films SET imdb_votes = 8557, curation_tier = 'archive' WHERE id = '9c983c98-1419-43d5-9b16-74a1b7588dfe' AND curation_tier = 'extended' AND imdb_votes = 11872;
-- The Round Up (2010, A, 7/10057; eski DB oyu 9559) → extended
UPDATE films SET imdb_votes = 9559, curation_tier = 'archive' WHERE id = '9fb78847-79a5-4342-9b76-2945ecc7cd28' AND curation_tier = 'extended' AND imdb_votes = 10057;
-- Early Summer (1951, A, 8.1/10947; eski DB oyu 9910) → core
UPDATE films SET imdb_votes = 9910, curation_tier = 'archive' WHERE id = '9fe39854-4a0c-4398-95c4-abec922e1335' AND curation_tier = 'core' AND imdb_votes = 10947;
-- Black Adam (2022, B, 6.1/310189; eski DB oyu 7046) → extended
UPDATE films SET imdb_votes = 7046, imdb_rating = NULL, curation_tier = 'archive' WHERE id = 'a0ef0ce9-95fe-44b9-8a09-adccf1a1dad3' AND curation_tier = 'extended' AND imdb_votes = 310189 AND imdb_rating = 6.1;

COMMIT;
