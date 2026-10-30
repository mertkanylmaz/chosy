-- MOOD-VEC-2b Faz 1B: phase1b-apply.sql'in geri alması. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Her UPDATE yalnız uygulanan değerleri taşıyan satırı eski haline (rating NULL, tier archive) döndürür.

BEGIN;

-- In the Grey (tt27681354) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '024e64eb-7cb2-4076-8729-b73b147263a8' AND imdb_rating = 6.3 AND curation_tier = 'extended';
-- Leviticus (tt39143902) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '1d623f94-8769-473c-b74c-b6f71daec231' AND imdb_rating = 6.4 AND curation_tier = 'extended';
-- The Death of Robin Hood (tt32273171) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '1ed485f9-9b4a-4ac5-afa8-a70cef98d376' AND imdb_rating = 6 AND curation_tier = 'extended';
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
-- Pet Sematary (tt0098084) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '4c5db4ec-e6c0-49e9-9ef7-496509e516fc' AND imdb_rating = 6.5 AND curation_tier = 'extended';
-- Supergirl (tt8814476) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '6892a6cb-b3a7-4ec8-a8ef-6386c7dd62a5' AND imdb_rating = 5.8 AND curation_tier = 'extended';
-- The Love Hypothesis (tt22526100) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '68938f8d-c3ce-4f7f-ae15-0b1ddbc7d3f0' AND imdb_rating = 6.8 AND curation_tier = 'extended';
-- Evil Dead Burn (tt31170389) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '6a1030eb-be74-4f94-85b1-4be991c7ffa6' AND imdb_rating = 6.2 AND curation_tier = 'extended';
-- The Mandalorian and Grogu (tt30825738) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '76968536-b9b0-41a5-8fac-ace61541c12f' AND imdb_rating = 6.7 AND curation_tier = 'extended';
-- Venom: Let There Be Carnage (tt7097896) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = 11201, curation_tier = 'archive' WHERE id = '78d1ea94-efd7-41fc-9c87-d9ee32b726d9' AND imdb_rating = 5.9 AND curation_tier = 'extended';
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
-- The Transformers: The Movie (tt0092106) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '8bd65ffe-e7eb-4e3f-9ed6-17bb5edea653' AND imdb_rating = 7.2 AND curation_tier = 'extended';
-- Tony (tt33095251) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '90ce8b99-bb12-4e18-b4ee-29650cfb0855' AND imdb_rating = 7.3 AND curation_tier = 'extended';
-- Teenage Sex and Death at Camp Miasma (tt35298123) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '90d15469-8293-4aa8-b68a-340029eef910' AND imdb_rating = 6.5 AND curation_tier = 'extended';
-- UNABOMBER (tt6933238) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = '9860c920-8921-4d80-b571-e93e784ea217' AND imdb_rating = 6.2 AND curation_tier = 'extended';
-- Wet Hot American Summer (tt0243655) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = 'a6bd4cd7-461b-4e44-9c79-16c68480cf07' AND imdb_rating = 6.5 AND curation_tier = 'extended';
-- Mortal Kombat II (tt17490712) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = 'aaa0987f-db4c-4c7e-bbc5-2326032f9d64' AND imdb_rating = 6.3 AND curation_tier = 'extended';
-- Masters of the Universe (tt0427340) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = 'af979dbb-643d-45ca-8419-82293280b884' AND imdb_rating = 6.4 AND curation_tier = 'extended';
-- The Uprising (tt36983905) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = 'b0b069f6-c3de-45ae-91f1-1503b2f46fa0' AND imdb_rating = 6.2 AND curation_tier = 'extended';
-- The Furious (tt33311069) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = 'b7d90e62-415c-4b8a-8d30-69ec5388efb9' AND imdb_rating = 7.2 AND curation_tier = 'extended';
-- Coyote vs. Acme (tt1756855) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = 'b7ec9352-9925-4ed0-9211-31b557adb309' AND imdb_rating = 7.3 AND curation_tier = 'extended';
-- The Dog Stars (tt21285562) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = 'bd993b34-72bc-4606-a404-13df728229ef' AND imdb_rating = 6.4 AND curation_tier = 'extended';
-- One Night Only (tt37853455) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = 'd1225731-07dd-448e-96ec-e0b1689080f3' AND imdb_rating = 6 AND curation_tier = 'extended';
-- Hokum (tt35672862) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = 'd6aac9ab-f2b3-4136-93f1-dd407b7e7d3a' AND imdb_rating = 6.6 AND curation_tier = 'extended';
-- Soulm8te (tt32654916) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = 'd6cba55f-37a5-4eaa-8761-2a79986585ff' AND imdb_rating = 5.8 AND curation_tier = 'extended';
-- Apex (tt16431404) → extended
UPDATE films SET imdb_rating = NULL, imdb_votes = NULL, curation_tier = 'archive' WHERE id = 'f1b48d8c-8d91-44ec-9ca1-836b2e1551a4' AND imdb_rating = 6.1 AND curation_tier = 'extended';

COMMIT;
