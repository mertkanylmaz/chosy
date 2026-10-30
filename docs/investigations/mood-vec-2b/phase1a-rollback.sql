-- MOOD-VEC-2b Faz 1A: phase1a-apply.sql'in geri alması. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Her UPDATE yalnız uygulanan yeni tier'daki satırı 'archive'e döndürür.

BEGIN;

-- My Fault (2023, 6.1/43031) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = '027758d2-17e6-49dc-8772-01b02543beef' AND curation_tier = 'extended';
-- New York Stories (1989, 6.4/20904) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = '03d5611a-ca7a-4224-bdcc-5934bfc0ac22' AND curation_tier = 'extended';
-- Despicable Me 4 (2024, 6.2/76384) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = '051602cb-e012-4024-b0a2-b37311c18922' AND curation_tier = 'extended';
-- TRON: Ares (2025, 6.2/78081) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = '0703aa6c-28ba-4c1a-bc8a-0838a79ce4a3' AND curation_tier = 'extended';
-- The Family Plan (2023, 6.3/62349) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = '1c589cd9-853d-4f97-af4d-91bb55e9157b' AND curation_tier = 'extended';
-- Breakthrough (2019, 6.3/11613) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = '258ac055-79e6-4dd0-9221-76f330abb047' AND curation_tier = 'extended';
-- Terrifier 3 (2024, 6.2/61278) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = '291e176c-9fac-48f1-9e6f-ff16a11fd830' AND curation_tier = 'extended';
-- Kung Fu Panda 4 (2024, 6.3/78494) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = '2d636056-f749-4909-b04a-812d2d7aaebb' AND curation_tier = 'extended';
-- Love (2015, 6.1/73447) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = '38198cf8-4c06-4ff9-9711-e0e6f595eedb' AND curation_tier = 'extended';
-- The Wrecking Crew (2026, 6.4/45325) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = '44e59f0a-b5bf-4a8b-bfe1-f35f49046550' AND curation_tier = 'extended';
-- Mike & Nick & Nick & Alice (2026, 6.2/15353) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = '453a4df3-f613-4846-af6e-494da889194d' AND curation_tier = 'extended';
-- Cold Storage (2026, 6.1/15845) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = '456355cc-a774-45b6-beac-91dfac23769e' AND curation_tier = 'extended';
-- Girl in the Basement (2021, 6.3/17040) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = '4a7a6058-1286-4ccc-8e59-664428beb693' AND curation_tier = 'extended';
-- Exit 8 (2025, 6.4/14034) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = '4a9b5c77-0ee4-4c03-9633-86de7abb434c' AND curation_tier = 'extended';
-- Mercy (2026, 6.2/56372) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = '4dfaef83-9d19-4a05-ad92-b0d44e8bd411' AND curation_tier = 'extended';
-- Black Phone 2 (2025, 6.1/58077) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = '56438f31-e5c3-4268-857f-5033ec1e6958' AND curation_tier = 'extended';
-- The Conjuring: Last Rites (2025, 6.2/98159) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = '5b3f9148-9542-4c95-b9c4-f6ca05df456b' AND curation_tier = 'extended';
-- Topaz (1969, 6.2/20404) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = '6243e1b9-0a2a-4a75-8965-9b2cb00828a2' AND curation_tier = 'extended';
-- Moonwalker (1988, 6.1/19527) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = '681551fe-6bcf-4533-ac44-e5c8c8dcf3cf' AND curation_tier = 'extended';
-- #Alive (2020, 6.3/52542) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = '70ae93d3-166a-4239-aff3-c10dfe0bc243' AND curation_tier = 'extended';
-- Shelter (2026, 6.1/25305) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = '77e564c5-292c-4402-bd29-ece23e7a35e1' AND curation_tier = 'extended';
-- The Super Mario Galaxy Movie (2026, 6.4/33056) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = '7c1f2ec5-a3d9-4972-9393-ecb65f97a2d1' AND curation_tier = 'extended';
-- Emancipation (2022, 6.3/30693) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = '7dc07448-582f-4588-b525-25ce3f8e4db4' AND curation_tier = 'extended';
-- Feel the Beat (2020, 6.3/14201) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = '81d89861-f723-45c7-af78-d2a2159e965a' AND curation_tier = 'extended';
-- Jamaica Inn (1939, 6.3/11887) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = '827aa7d3-0030-4984-b4f4-85f7adb3c521' AND curation_tier = 'extended';
-- The Idea of You (2024, 6.3/82785) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = '839123ed-1ed2-4bce-ba70-2ba8cdbcc820' AND curation_tier = 'extended';
-- Miracle at St. Anna (2008, 6.1/19697) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = '9050bdf5-48fc-4434-87b8-198839fe006a' AND curation_tier = 'extended';
-- The Running Man (2025, 6.4/92947) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = '912dd8c0-6c03-44d9-b90a-3c4c08c7e459' AND curation_tier = 'extended';
-- I Spit on Your Grave (2010, 6.2/99752) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = '92c61fd6-bedb-46dc-9fbc-81496f3d856e' AND curation_tier = 'extended';
-- Dracula (2025, 6.2/34913) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = '9c15981f-7f81-4daf-9cfb-9041b392480a' AND curation_tier = 'extended';
-- Room in Rome (2010, 6/27407) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = '9d2ac55b-4be1-406a-aa3f-c112e32a9ea8' AND curation_tier = 'extended';
-- Unlocked (2023, 6.4/12243) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = 'a8882105-8999-4bf2-9217-d4f83f893bdf' AND curation_tier = 'extended';
-- My Fault: London (2025, 6.2/13668) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = 'bf2d5bfc-89ca-44d1-b7e0-313fbbccd584' AND curation_tier = 'extended';
-- Nobody 2 (2025, 6.3/89019) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = 'cb235f44-6062-43db-8396-cbe61db95f0f' AND curation_tier = 'extended';
-- Life in a Year (2020, 6.2/11138) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = 'd0f83a8d-5353-434e-be27-3b4a1c9acc7e' AND curation_tier = 'extended';
-- Freakier Friday (2025, 6.2/38258) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = 'd8b36078-715a-4837-bd12-9055a9e6e11b' AND curation_tier = 'extended';
-- The Voyeurs (2021, 6.1/44090) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = 'db8ae63e-ef64-47a8-a437-655d62cc6684' AND curation_tier = 'extended';
-- Comidark Films: In Between (2019, 6.4/13837) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = 'dfc688d6-10b9-4e70-b6fe-5c373c0221e9' AND curation_tier = 'extended';
-- War Machine (2026, 6.3/86956) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = 'e78929bb-6fa6-423c-9dd1-e741edecfd7a' AND curation_tier = 'extended';
-- Nowhere (2023, 6.3/48244) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = 'e7c7ce77-d2e9-41a1-93ee-a747fab9b0dd' AND curation_tier = 'extended';
-- "Wuthering Heights" (2026, 6.2/57394) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = 'f744f73a-70ba-46d1-9459-9f4cdcf17c12' AND curation_tier = 'extended';
-- How to Have Sex (2023, 6.4/22391) → extended
UPDATE films SET curation_tier = 'archive' WHERE id = 'f75c5819-077f-4fef-aab0-0dc0d6d42aca' AND curation_tier = 'extended';

COMMIT;
