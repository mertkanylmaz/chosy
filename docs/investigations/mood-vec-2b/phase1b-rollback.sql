-- MOOD-VEC-2b Faz 1B: phase1b-apply.sql'in geri alması. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Her UPDATE yalnız uygulanan değerleri taşıyan satırı eski haline (rating NULL, tier archive) döndürür.

BEGIN;

-- In the Grey (tt27681354) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '024e64eb-7cb2-4076-8729-b73b147263a8' AND imdb_rating = 6.3 AND curation_tier = 'extended';
-- Heartstopper Forever (tt36619926) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = 95, curation_tier = 'archive' WHERE id = '0b219ade-d398-4aad-9daf-386ebba9d905' AND imdb_rating = 6.9 AND curation_tier = 'extended';
-- Drishyam: The Conclusion (tt27050858) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '1732bea6-ac67-451a-a0b9-b42281912400' AND imdb_rating = 7.7 AND curation_tier = 'extended';
-- Leviticus (tt39143902) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '1d623f94-8769-473c-b74c-b6f71daec231' AND imdb_rating = 6.4 AND curation_tier = 'extended';
-- The Death of Robin Hood (tt32273171) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '1ed485f9-9b4a-4ac5-afa8-a70cef98d376' AND imdb_rating = 6 AND curation_tier = 'extended';
-- It Ends with Us (tt10655524) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = 1965, curation_tier = 'archive' WHERE id = '26b94fcf-4aff-44ff-9f68-d23d1bee9132' AND imdb_rating = 6.3 AND curation_tier = 'extended';
-- The Social Reckoning (tt37510326) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '2b25e9be-ffa4-4e3a-a7a9-23ad21e1def0' AND imdb_rating = 6.7 AND curation_tier = 'extended';
-- The Dink (tt33499146) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '2dc0ab07-b53d-4d9b-a1ae-df2b2aee7a98' AND imdb_rating = 6.1 AND curation_tier = 'extended';
-- Heart of the Beast (tt7526136) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '33bac263-99cc-48a0-a0ef-c4477f50449a' AND imdb_rating = 7.2 AND curation_tier = 'extended';
-- The Whisper Man (tt11561116) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '3433262f-d0e8-42cb-8d30-74313dd73949' AND imdb_rating = 6.2 AND curation_tier = 'extended';
-- The Devil Wears Prada 2 (tt33612209) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '362b8024-5e47-4a6f-830c-2f15e0362a44' AND imdb_rating = 6.3 AND curation_tier = 'extended';
-- Minions & Monsters (tt32890033) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '42f199eb-31c8-496f-8b21-2b269b7562fd' AND imdb_rating = 6.3 AND curation_tier = 'extended';
-- Avatar Aang: The Last Airbender (tt18259538) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '43cde8b8-7a60-43d3-9237-e0231da2eb65' AND imdb_rating = 7.7 AND curation_tier = 'extended';
-- The Secret Woman (tt37275992) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '45ef5c1e-bdd1-4d5b-8cc1-131247893268' AND imdb_rating = 6 AND curation_tier = 'extended';
-- The Sheep Detectives (tt32565993) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = 185, curation_tier = 'archive' WHERE id = '479f4368-baeb-4cdf-8af6-1122ecda4d07' AND imdb_rating = 7.4 AND curation_tier = 'extended';
-- Pet Sematary (tt0098084) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '4c5db4ec-e6c0-49e9-9ef7-496509e516fc' AND imdb_rating = 6.5 AND curation_tier = 'extended';
-- It Ends (tt35519455) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '50baa1d3-ee40-4657-8699-7bad58d45cde' AND imdb_rating = 5.8 AND curation_tier = 'extended';
-- The Magic Faraway Tree (tt7734244) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '540baafe-09d0-4e4e-b1e8-12a2d1ba462f' AND imdb_rating = 6.2 AND curation_tier = 'extended';
-- Finding Emily (tt32499466) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '5cef67b3-6a5c-499a-a12b-1abe5d955c7a' AND imdb_rating = 6.9 AND curation_tier = 'extended';
-- Satluj (tt28089784) → core
UPDATE films SET imdb_rating = NULL, imdb_votes = 8, curation_tier = 'archive' WHERE id = '617a44ee-e88e-4afb-8396-2d5af3c7af3e' AND imdb_rating = 8.8 AND curation_tier = 'core';
-- Supergirl (tt8814476) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '6892a6cb-b3a7-4ec8-a8ef-6386c7dd62a5' AND imdb_rating = 5.8 AND curation_tier = 'extended';
-- The Love Hypothesis (tt22526100) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '68938f8d-c3ce-4f7f-ae15-0b1ddbc7d3f0' AND imdb_rating = 6.8 AND curation_tier = 'extended';
-- Evil Dead Burn (tt31170389) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '6a1030eb-be74-4f94-85b1-4be991c7ffa6' AND imdb_rating = 6.2 AND curation_tier = 'extended';
-- DC (tt37501035) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '6a360aaf-8089-4b03-809a-82b000d6b1b1' AND imdb_rating = 7.8 AND curation_tier = 'extended';
-- Fuze (tt31189814) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = 166, curation_tier = 'archive' WHERE id = '7098fbaa-7eb4-42c4-a69a-81ab8cde0381' AND imdb_rating = 6.3 AND curation_tier = 'extended';
-- The Mandalorian and Grogu (tt30825738) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '76968536-b9b0-41a5-8fac-ace61541c12f' AND imdb_rating = 6.7 AND curation_tier = 'extended';
-- Venom: Let There Be Carnage (tt7097896) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = 11201, curation_tier = 'archive' WHERE id = '78d1ea94-efd7-41fc-9c87-d9ee32b726d9' AND imdb_rating = 5.9 AND curation_tier = 'extended';
-- Aarya (tt0431619) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = 51, curation_tier = 'archive' WHERE id = '79e8c8b2-ac6d-462a-accf-9c63c23c80ec' AND imdb_rating = 7.8 AND curation_tier = 'extended';
-- I Want Your Sex (tt32332915) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = 0, curation_tier = 'archive' WHERE id = '7b24bc29-97e9-440f-9287-e6c78b1cf697' AND imdb_rating = 5.8 AND curation_tier = 'extended';
-- Jailer 2 (tt33318732) → core
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '7b80abf4-ea55-4200-bace-413564ed0396' AND imdb_rating = 8.2 AND curation_tier = 'core';
-- Insidious: Out of the Further (tt32393988) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '7e7d0c51-5894-451a-aaef-790f7a055a08' AND imdb_rating = 6 AND curation_tier = 'extended';
-- Disclosure Day (tt15047880) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '8241de8f-5157-4a2e-b155-6c9566ce2cff' AND imdb_rating = 6.4 AND curation_tier = 'extended';
-- Marie Antoinette (tt0422720) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '86a06618-d520-4edc-a55a-378a7ca4a8cf' AND imdb_rating = 6.5 AND curation_tier = 'extended';
-- The Invite (tt14173636) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '87f5d122-208a-496b-b904-87eaaa809619' AND imdb_rating = 7.4 AND curation_tier = 'extended';
-- Batman: Knightfall Part 1: Knightfall (tt32333324) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '8aa76c9d-2df4-4132-a614-3e77e1aa7b35' AND imdb_rating = 7.8 AND curation_tier = 'extended';
-- The Transformers: The Movie (tt0092106) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '8bd65ffe-e7eb-4e3f-9ed6-17bb5edea653' AND imdb_rating = 7.2 AND curation_tier = 'extended';
-- Escape Plan (tt1211956) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = 5606, curation_tier = 'archive' WHERE id = '8f860992-c53f-4390-8088-e063bc4465b3' AND imdb_rating = 6.7 AND curation_tier = 'extended';
-- Your Fault: London (tt36958376) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = 101, curation_tier = 'archive' WHERE id = '8fc5012d-f837-4110-95f6-2603bc8b1229' AND imdb_rating = 6 AND curation_tier = 'extended';
-- Tony (tt33095251) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '90ce8b99-bb12-4e18-b4ee-29650cfb0855' AND imdb_rating = 7.3 AND curation_tier = 'extended';
-- Teenage Sex and Death at Camp Miasma (tt35298123) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '90d15469-8293-4aa8-b68a-340029eef910' AND imdb_rating = 6.5 AND curation_tier = 'extended';
-- Satantango (tt0111341) → core
UPDATE films SET imdb_rating = NULL, imdb_votes = 309, curation_tier = 'archive' WHERE id = '96274104-3278-4a0d-ab7a-4ae6816fc335' AND imdb_rating = 8.2 AND curation_tier = 'core';
-- UNABOMBER (tt6933238) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '9860c920-8921-4d80-b571-e93e784ea217' AND imdb_rating = 6.2 AND curation_tier = 'extended';
-- Black Adam (tt6443346) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = 7046, curation_tier = 'archive' WHERE id = 'a0ef0ce9-95fe-44b9-8a09-adccf1a1dad3' AND imdb_rating = 6.1 AND curation_tier = 'extended';
-- Wet Hot American Summer (tt0243655) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = 'a6bd4cd7-461b-4e44-9c79-16c68480cf07' AND imdb_rating = 6.5 AND curation_tier = 'extended';
-- Minions: The Rise of Gru (tt5113044) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = 4025, curation_tier = 'archive' WHERE id = 'a8edc36c-8004-4600-882f-6411e613fdea' AND imdb_rating = 6.5 AND curation_tier = 'extended';
-- Forgotten Island (tt36583977) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = 'aa65ce56-3919-4c8a-a610-bab71a188a94' AND imdb_rating = 7.7 AND curation_tier = 'extended';
-- Mortal Kombat II (tt17490712) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = 'aaa0987f-db4c-4c7e-bbc5-2326032f9d64' AND imdb_rating = 6.3 AND curation_tier = 'extended';
-- Pressure (tt32547691) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = 84, curation_tier = 'archive' WHERE id = 'ab7c342e-00c6-4fb4-8e2e-0fad7ccbd2e8' AND imdb_rating = 7.3 AND curation_tier = 'extended';
-- Masters of the Universe (tt0427340) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = 'af979dbb-643d-45ca-8419-82293280b884' AND imdb_rating = 6.4 AND curation_tier = 'extended';
-- The Uprising (tt36983905) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = 'b0b069f6-c3de-45ae-91f1-1503b2f46fa0' AND imdb_rating = 6.2 AND curation_tier = 'extended';
-- Twisters (tt12584954) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = 3011, curation_tier = 'archive' WHERE id = 'b753c7fb-687e-4136-b1ba-685bb5d1614e' AND imdb_rating = 6.5 AND curation_tier = 'extended';
-- The Furious (tt33311069) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = 'b7d90e62-415c-4b8a-8d30-69ec5388efb9' AND imdb_rating = 7.2 AND curation_tier = 'extended';
-- Coyote vs. Acme (tt1756855) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = 'b7ec9352-9925-4ed0-9211-31b557adb309' AND imdb_rating = 7.3 AND curation_tier = 'extended';
-- Sense and Sensibility (tt13609648) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = 'b8edbb8d-a66e-42d1-872c-f24b47b39076' AND imdb_rating = 7.4 AND curation_tier = 'extended';
-- Don't Say Good Luck (tt36590417) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = 'b9a28006-7759-49ac-80cc-23db121f3218' AND imdb_rating = 6.8 AND curation_tier = 'extended';
-- Uncharted (tt1464335) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = 6903, curation_tier = 'archive' WHERE id = 'b9e76f3b-0e3a-4bde-ac62-f57050fe436d' AND imdb_rating = 6.3 AND curation_tier = 'extended';
-- The Dog Stars (tt21285562) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = 'bd993b34-72bc-4606-a404-13df728229ef' AND imdb_rating = 6.4 AND curation_tier = 'extended';
-- Demon Slayer: Kimetsu no Yaiba - Sibling's Bond (tt14888860) → core
UPDATE films SET imdb_rating = NULL, imdb_votes = 4619, curation_tier = 'archive' WHERE id = 'cd8ef8a3-e7f1-4c96-a6a3-124d7933484a' AND imdb_rating = 8.4 AND curation_tier = 'core';
-- undertone (tt35892608) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = 270, curation_tier = 'archive' WHERE id = 'ceb691a1-18de-4732-be1b-1065541fadbc' AND imdb_rating = 5.9 AND curation_tier = 'extended';
-- The Master and Margarita (tt14536120) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = 'd03ed8d5-21d3-4a8d-96d4-52fc476738e8' AND imdb_rating = 7.1 AND curation_tier = 'extended';
-- No Time to Die (tt2382320) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = 7147, curation_tier = 'archive' WHERE id = 'd0c00c91-6e92-4f0d-8120-c98869601d73' AND imdb_rating = 7.3 AND curation_tier = 'extended';
-- One Night Only (tt37853455) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = 'd1225731-07dd-448e-96ec-e0b1689080f3' AND imdb_rating = 6 AND curation_tier = 'extended';
-- Young Washington (tt32104007) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = 0, curation_tier = 'archive' WHERE id = 'd38ee4d1-02b6-42bb-83bd-9a83999c2585' AND imdb_rating = 6.8 AND curation_tier = 'extended';
-- Normal (tt31195136) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = 281, curation_tier = 'archive' WHERE id = 'd5f468ac-bf0e-475a-affc-92e419bb5502' AND imdb_rating = 6.3 AND curation_tier = 'extended';
-- Hokum (tt35672862) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = 'd6aac9ab-f2b3-4136-93f1-dd407b7e7d3a' AND imdb_rating = 6.6 AND curation_tier = 'extended';
-- Soulm8te (tt32654916) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = 'd6cba55f-37a5-4eaa-8761-2a79986585ff' AND imdb_rating = 5.8 AND curation_tier = 'extended';
-- Carolina Caroline (tt33365126) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = 6, curation_tier = 'archive' WHERE id = 'db45f6d9-5f69-4fde-abda-812fd006f8cc' AND imdb_rating = 6.6 AND curation_tier = 'extended';
-- Lee Cronin's The Mummy (tt32612507) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = 2103, curation_tier = 'archive' WHERE id = 'db75c56b-f627-47e1-96db-866f506e9af1' AND imdb_rating = 6.1 AND curation_tier = 'extended';
-- Voicemails for Isabelle (tt10375624) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = 165, curation_tier = 'archive' WHERE id = 'e1920050-fd1f-44a8-a790-ecc931e24cd4' AND imdb_rating = 7.2 AND curation_tier = 'extended';
-- Ant-Man and the Wasp: Quantumania (tt10954600) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = 5866, curation_tier = 'archive' WHERE id = 'e8b6fa8a-99ea-487b-a382-9ef33b9936bb' AND imdb_rating = 6 AND curation_tier = 'extended';
-- Superman Returns (tt0348150) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = 4590, curation_tier = 'archive' WHERE id = 'e8d34f4e-42c2-4c1f-9f55-f35d601d7c47' AND imdb_rating = 6.1 AND curation_tier = 'extended';
-- I Love Boosters (tt30827810) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = 37, curation_tier = 'archive' WHERE id = 'ee664375-0df5-4b5e-a6d0-aa04bc73495a' AND imdb_rating = 6.6 AND curation_tier = 'extended';
-- Ranabaali (tt32324552) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = 'efe2aa91-f6c3-4970-a7eb-8adccf169037' AND imdb_rating = 7.6 AND curation_tier = 'extended';
-- Fantastic Beasts: The Secrets of Dumbledore (tt4123432) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = 5118, curation_tier = 'archive' WHERE id = 'f02867f3-6675-433c-95f2-7d1a6eec0093' AND imdb_rating = 6.2 AND curation_tier = 'extended';
-- Apex (tt16431404) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = 'f1b48d8c-8d91-44ec-9ca1-836b2e1551a4' AND imdb_rating = 6.1 AND curation_tier = 'extended';
-- Facing El Chapo (tt39390497) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = 'f209fb28-7ec7-4fa1-8d07-14a4a755334a' AND imdb_rating = 6.7 AND curation_tier = 'extended';
-- The Little Mermaid (tt5971474) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = 3330, curation_tier = 'archive' WHERE id = 'f5c7e338-e656-41a5-9901-5ea1665e4d57' AND imdb_rating = 7.2 AND curation_tier = 'extended';
-- The Rivals of Amziah King (tt27706593) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = 0, curation_tier = 'archive' WHERE id = 'f93374e9-ea5a-4a52-8dbb-5b55d2da06a5' AND imdb_rating = 6.6 AND curation_tier = 'extended';
-- Is God Is (tt34379307) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = 69, curation_tier = 'archive' WHERE id = 'fb564a0e-f666-43f5-aa77-188a8724cfb9' AND imdb_rating = 6.5 AND curation_tier = 'extended';

COMMIT;
