-- MOOD-VEC-2b Faz 1B: 79 arşiv filminin imdb_rating/imdb_votes[/imdb_id] + curation_tier'ı. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Kaynak: IMDb resmi veri dosyası (title.ratings.tsv.gz). Her UPDATE imdb_rating IS NULL ve curation_tier = archive doğrular.
-- Beklenen: 79 UPDATE × 1 satır (0 tanesi imdb_id da yazar). Geri alma: phase1b-rollback.sql.

BEGIN;

-- Yedek: değişecek 79 filmin önceki değerleri. Tablo zaten varsa bu satır hata verir ve işlem durur (üzerine yazma yok).
CREATE TABLE films_phase1b_backup_20261031 AS
  SELECT id, imdb_id, imdb_rating, imdb_votes, curation_tier FROM films WHERE id IN ('024e64eb-7cb2-4076-8729-b73b147263a8', '0b219ade-d398-4aad-9daf-386ebba9d905', '1732bea6-ac67-451a-a0b9-b42281912400', '1d623f94-8769-473c-b74c-b6f71daec231', '1ed485f9-9b4a-4ac5-afa8-a70cef98d376', '26b94fcf-4aff-44ff-9f68-d23d1bee9132', '2b25e9be-ffa4-4e3a-a7a9-23ad21e1def0', '2dc0ab07-b53d-4d9b-a1ae-df2b2aee7a98', '33bac263-99cc-48a0-a0ef-c4477f50449a', '3433262f-d0e8-42cb-8d30-74313dd73949', '362b8024-5e47-4a6f-830c-2f15e0362a44', '42f199eb-31c8-496f-8b21-2b269b7562fd', '43cde8b8-7a60-43d3-9237-e0231da2eb65', '45ef5c1e-bdd1-4d5b-8cc1-131247893268', '479f4368-baeb-4cdf-8af6-1122ecda4d07', '4c5db4ec-e6c0-49e9-9ef7-496509e516fc', '50baa1d3-ee40-4657-8699-7bad58d45cde', '540baafe-09d0-4e4e-b1e8-12a2d1ba462f', '5cef67b3-6a5c-499a-a12b-1abe5d955c7a', '617a44ee-e88e-4afb-8396-2d5af3c7af3e', '6892a6cb-b3a7-4ec8-a8ef-6386c7dd62a5', '68938f8d-c3ce-4f7f-ae15-0b1ddbc7d3f0', '6a1030eb-be74-4f94-85b1-4be991c7ffa6', '6a360aaf-8089-4b03-809a-82b000d6b1b1', '7098fbaa-7eb4-42c4-a69a-81ab8cde0381', '76968536-b9b0-41a5-8fac-ace61541c12f', '78d1ea94-efd7-41fc-9c87-d9ee32b726d9', '79e8c8b2-ac6d-462a-accf-9c63c23c80ec', '7b24bc29-97e9-440f-9287-e6c78b1cf697', '7b80abf4-ea55-4200-bace-413564ed0396', '7e7d0c51-5894-451a-aaef-790f7a055a08', '8241de8f-5157-4a2e-b155-6c9566ce2cff', '86a06618-d520-4edc-a55a-378a7ca4a8cf', '87f5d122-208a-496b-b904-87eaaa809619', '8aa76c9d-2df4-4132-a614-3e77e1aa7b35', '8bd65ffe-e7eb-4e3f-9ed6-17bb5edea653', '8f860992-c53f-4390-8088-e063bc4465b3', '8fc5012d-f837-4110-95f6-2603bc8b1229', '90ce8b99-bb12-4e18-b4ee-29650cfb0855', '90d15469-8293-4aa8-b68a-340029eef910', '96274104-3278-4a0d-ab7a-4ae6816fc335', '9860c920-8921-4d80-b571-e93e784ea217', 'a0ef0ce9-95fe-44b9-8a09-adccf1a1dad3', 'a6bd4cd7-461b-4e44-9c79-16c68480cf07', 'a8edc36c-8004-4600-882f-6411e613fdea', 'aa65ce56-3919-4c8a-a610-bab71a188a94', 'aaa0987f-db4c-4c7e-bbc5-2326032f9d64', 'ab7c342e-00c6-4fb4-8e2e-0fad7ccbd2e8', 'af979dbb-643d-45ca-8419-82293280b884', 'b0b069f6-c3de-45ae-91f1-1503b2f46fa0', 'b753c7fb-687e-4136-b1ba-685bb5d1614e', 'b7d90e62-415c-4b8a-8d30-69ec5388efb9', 'b7ec9352-9925-4ed0-9211-31b557adb309', 'b8edbb8d-a66e-42d1-872c-f24b47b39076', 'b9a28006-7759-49ac-80cc-23db121f3218', 'b9e76f3b-0e3a-4bde-ac62-f57050fe436d', 'bd993b34-72bc-4606-a404-13df728229ef', 'cd8ef8a3-e7f1-4c96-a6a3-124d7933484a', 'ceb691a1-18de-4732-be1b-1065541fadbc', 'd03ed8d5-21d3-4a8d-96d4-52fc476738e8', 'd0c00c91-6e92-4f0d-8120-c98869601d73', 'd1225731-07dd-448e-96ec-e0b1689080f3', 'd38ee4d1-02b6-42bb-83bd-9a83999c2585', 'd5f468ac-bf0e-475a-affc-92e419bb5502', 'd6aac9ab-f2b3-4136-93f1-dd407b7e7d3a', 'd6cba55f-37a5-4eaa-8761-2a79986585ff', 'db45f6d9-5f69-4fde-abda-812fd006f8cc', 'db75c56b-f627-47e1-96db-866f506e9af1', 'e1920050-fd1f-44a8-a790-ecc931e24cd4', 'e8b6fa8a-99ea-487b-a382-9ef33b9936bb', 'e8d34f4e-42c2-4c1f-9f55-f35d601d7c47', 'ee664375-0df5-4b5e-a6d0-aa04bc73495a', 'efe2aa91-f6c3-4970-a7eb-8adccf169037', 'f02867f3-6675-433c-95f2-7d1a6eec0093', 'f1b48d8c-8d91-44ec-9ca1-836b2e1551a4', 'f209fb28-7ec7-4fa1-8d07-14a4a755334a', 'f5c7e338-e656-41a5-9901-5ea1665e4d57', 'f93374e9-ea5a-4a52-8dbb-5b55d2da06a5', 'fb564a0e-f666-43f5-aa77-188a8724cfb9');
ALTER TABLE films_phase1b_backup_20261031 ENABLE ROW LEVEL SECURITY;

-- In the Grey (tt27681354) → extended
UPDATE films SET imdb_rating = 6.3, imdb_votes = 56369, curation_tier = 'extended' WHERE id = '024e64eb-7cb2-4076-8729-b73b147263a8' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Heartstopper Forever (tt36619926) → extended
UPDATE films SET imdb_rating = 6.9, imdb_votes = 9153, curation_tier = 'extended' WHERE id = '0b219ade-d398-4aad-9daf-386ebba9d905' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Drishyam: The Conclusion (tt27050858) → extended
UPDATE films SET imdb_rating = 7.7, imdb_votes = 7412, curation_tier = 'extended' WHERE id = '1732bea6-ac67-451a-a0b9-b42281912400' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Leviticus (tt39143902) → extended
UPDATE films SET imdb_rating = 6.4, imdb_votes = 20399, curation_tier = 'extended' WHERE id = '1d623f94-8769-473c-b74c-b6f71daec231' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- The Death of Robin Hood (tt32273171) → extended
UPDATE films SET imdb_rating = 6, imdb_votes = 24451, curation_tier = 'extended' WHERE id = '1ed485f9-9b4a-4ac5-afa8-a70cef98d376' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- It Ends with Us (tt10655524) → extended
UPDATE films SET imdb_rating = 6.3, imdb_votes = 106254, curation_tier = 'extended' WHERE id = '26b94fcf-4aff-44ff-9f68-d23d1bee9132' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- The Social Reckoning (tt37510326) → extended
UPDATE films SET imdb_rating = 6.7, imdb_votes = 9297, curation_tier = 'extended' WHERE id = '2b25e9be-ffa4-4e3a-a7a9-23ad21e1def0' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- The Dink (tt33499146) → extended
UPDATE films SET imdb_rating = 6.1, imdb_votes = 12297, curation_tier = 'extended' WHERE id = '2dc0ab07-b53d-4d9b-a1ae-df2b2aee7a98' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Heart of the Beast (tt7526136) → extended
UPDATE films SET imdb_rating = 7.2, imdb_votes = 31095, curation_tier = 'extended' WHERE id = '33bac263-99cc-48a0-a0ef-c4477f50449a' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- The Whisper Man (tt11561116) → extended
UPDATE films SET imdb_rating = 6.2, imdb_votes = 69219, curation_tier = 'extended' WHERE id = '3433262f-d0e8-42cb-8d30-74313dd73949' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- The Devil Wears Prada 2 (tt33612209) → extended
UPDATE films SET imdb_rating = 6.3, imdb_votes = 121686, curation_tier = 'extended' WHERE id = '362b8024-5e47-4a6f-830c-2f15e0362a44' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Minions & Monsters (tt32890033) → extended
UPDATE films SET imdb_rating = 6.3, imdb_votes = 35688, curation_tier = 'extended' WHERE id = '42f199eb-31c8-496f-8b21-2b269b7562fd' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Avatar Aang: The Last Airbender (tt18259538) → extended
UPDATE films SET imdb_rating = 7.7, imdb_votes = 31566, curation_tier = 'extended' WHERE id = '43cde8b8-7a60-43d3-9237-e0231da2eb65' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- The Secret Woman (tt37275992) → extended
UPDATE films SET imdb_rating = 6, imdb_votes = 7487, curation_tier = 'extended' WHERE id = '45ef5c1e-bdd1-4d5b-8cc1-131247893268' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- The Sheep Detectives (tt32565993) → extended
UPDATE films SET imdb_rating = 7.4, imdb_votes = 123542, curation_tier = 'extended' WHERE id = '479f4368-baeb-4cdf-8af6-1122ecda4d07' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Pet Sematary (tt0098084) → extended
UPDATE films SET imdb_rating = 6.5, imdb_votes = 126403, curation_tier = 'extended' WHERE id = '4c5db4ec-e6c0-49e9-9ef7-496509e516fc' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- It Ends (tt35519455) → extended
UPDATE films SET imdb_rating = 5.8, imdb_votes = 9852, curation_tier = 'extended' WHERE id = '50baa1d3-ee40-4657-8699-7bad58d45cde' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- The Magic Faraway Tree (tt7734244) → extended
UPDATE films SET imdb_rating = 6.2, imdb_votes = 6464, curation_tier = 'extended' WHERE id = '540baafe-09d0-4e4e-b1e8-12a2d1ba462f' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Finding Emily (tt32499466) → extended
UPDATE films SET imdb_rating = 6.9, imdb_votes = 6928, curation_tier = 'extended' WHERE id = '5cef67b3-6a5c-499a-a12b-1abe5d955c7a' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Satluj (tt28089784) → core
UPDATE films SET imdb_rating = 8.8, imdb_votes = 106958, curation_tier = 'core' WHERE id = '617a44ee-e88e-4afb-8396-2d5af3c7af3e' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Supergirl (tt8814476) → extended
UPDATE films SET imdb_rating = 5.8, imdb_votes = 118383, curation_tier = 'extended' WHERE id = '6892a6cb-b3a7-4ec8-a8ef-6386c7dd62a5' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- The Love Hypothesis (tt22526100) → extended
UPDATE films SET imdb_rating = 6.8, imdb_votes = 32292, curation_tier = 'extended' WHERE id = '68938f8d-c3ce-4f7f-ae15-0b1ddbc7d3f0' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Evil Dead Burn (tt31170389) → extended
UPDATE films SET imdb_rating = 6.2, imdb_votes = 60984, curation_tier = 'extended' WHERE id = '6a1030eb-be74-4f94-85b1-4be991c7ffa6' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- DC (tt37501035) → extended
UPDATE films SET imdb_rating = 7.8, imdb_votes = 9770, curation_tier = 'extended' WHERE id = '6a360aaf-8089-4b03-809a-82b000d6b1b1' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Fuze (tt31189814) → extended
UPDATE films SET imdb_rating = 6.3, imdb_votes = 19848, curation_tier = 'extended' WHERE id = '7098fbaa-7eb4-42c4-a69a-81ab8cde0381' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- The Mandalorian and Grogu (tt30825738) → extended
UPDATE films SET imdb_rating = 6.7, imdb_votes = 122379, curation_tier = 'extended' WHERE id = '76968536-b9b0-41a5-8fac-ace61541c12f' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Venom: Let There Be Carnage (tt7097896) → extended
UPDATE films SET imdb_rating = 5.9, imdb_votes = 313417, curation_tier = 'extended' WHERE id = '78d1ea94-efd7-41fc-9c87-d9ee32b726d9' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Aarya (tt0431619) → extended
UPDATE films SET imdb_rating = 7.8, imdb_votes = 9370, curation_tier = 'extended' WHERE id = '79e8c8b2-ac6d-462a-accf-9c63c23c80ec' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- I Want Your Sex (tt32332915) → extended
UPDATE films SET imdb_rating = 5.8, imdb_votes = 8503, curation_tier = 'extended' WHERE id = '7b24bc29-97e9-440f-9287-e6c78b1cf697' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Jailer 2 (tt33318732) → core
UPDATE films SET imdb_rating = 8.2, imdb_votes = 15326, curation_tier = 'core' WHERE id = '7b80abf4-ea55-4200-bace-413564ed0396' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Insidious: Out of the Further (tt32393988) → extended
UPDATE films SET imdb_rating = 6, imdb_votes = 27819, curation_tier = 'extended' WHERE id = '7e7d0c51-5894-451a-aaef-790f7a055a08' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Disclosure Day (tt15047880) → extended
UPDATE films SET imdb_rating = 6.4, imdb_votes = 176870, curation_tier = 'extended' WHERE id = '8241de8f-5157-4a2e-b155-6c9566ce2cff' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Marie Antoinette (tt0422720) → extended
UPDATE films SET imdb_rating = 6.5, imdb_votes = 134234, curation_tier = 'extended' WHERE id = '86a06618-d520-4edc-a55a-378a7ca4a8cf' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- The Invite (tt14173636) → extended
UPDATE films SET imdb_rating = 7.4, imdb_votes = 91139, curation_tier = 'extended' WHERE id = '87f5d122-208a-496b-b904-87eaaa809619' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Batman: Knightfall Part 1: Knightfall (tt32333324) → extended
UPDATE films SET imdb_rating = 7.8, imdb_votes = 9781, curation_tier = 'extended' WHERE id = '8aa76c9d-2df4-4132-a614-3e77e1aa7b35' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- The Transformers: The Movie (tt0092106) → extended
UPDATE films SET imdb_rating = 7.2, imdb_votes = 45911, curation_tier = 'extended' WHERE id = '8bd65ffe-e7eb-4e3f-9ed6-17bb5edea653' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Escape Plan (tt1211956) → extended
UPDATE films SET imdb_rating = 6.7, imdb_votes = 273173, curation_tier = 'extended' WHERE id = '8f860992-c53f-4390-8088-e063bc4465b3' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Your Fault: London (tt36958376) → extended
UPDATE films SET imdb_rating = 6, imdb_votes = 5913, curation_tier = 'extended' WHERE id = '8fc5012d-f837-4110-95f6-2603bc8b1229' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Tony (tt33095251) → extended
UPDATE films SET imdb_rating = 7.3, imdb_votes = 18730, curation_tier = 'extended' WHERE id = '90ce8b99-bb12-4e18-b4ee-29650cfb0855' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Teenage Sex and Death at Camp Miasma (tt35298123) → extended
UPDATE films SET imdb_rating = 6.5, imdb_votes = 24189, curation_tier = 'extended' WHERE id = '90d15469-8293-4aa8-b68a-340029eef910' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Satantango (tt0111341) → core
UPDATE films SET imdb_rating = 8.2, imdb_votes = 14693, curation_tier = 'core' WHERE id = '96274104-3278-4a0d-ab7a-4ae6816fc335' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- UNABOMBER (tt6933238) → extended
UPDATE films SET imdb_rating = 6.2, imdb_votes = 35351, curation_tier = 'extended' WHERE id = '9860c920-8921-4d80-b571-e93e784ea217' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Black Adam (tt6443346) → extended
UPDATE films SET imdb_rating = 6.1, imdb_votes = 310189, curation_tier = 'extended' WHERE id = 'a0ef0ce9-95fe-44b9-8a09-adccf1a1dad3' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Wet Hot American Summer (tt0243655) → extended
UPDATE films SET imdb_rating = 6.5, imdb_votes = 65083, curation_tier = 'extended' WHERE id = 'a6bd4cd7-461b-4e44-9c79-16c68480cf07' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Minions: The Rise of Gru (tt5113044) → extended
UPDATE films SET imdb_rating = 6.5, imdb_votes = 110037, curation_tier = 'extended' WHERE id = 'a8edc36c-8004-4600-882f-6411e613fdea' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Forgotten Island (tt36583977) → extended
UPDATE films SET imdb_rating = 7.7, imdb_votes = 7573, curation_tier = 'extended' WHERE id = 'aa65ce56-3919-4c8a-a610-bab71a188a94' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Mortal Kombat II (tt17490712) → extended
UPDATE films SET imdb_rating = 6.3, imdb_votes = 95569, curation_tier = 'extended' WHERE id = 'aaa0987f-db4c-4c7e-bbc5-2326032f9d64' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Pressure (tt32547691) → extended
UPDATE films SET imdb_rating = 7.3, imdb_votes = 40947, curation_tier = 'extended' WHERE id = 'ab7c342e-00c6-4fb4-8e2e-0fad7ccbd2e8' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Masters of the Universe (tt0427340) → extended
UPDATE films SET imdb_rating = 6.4, imdb_votes = 130846, curation_tier = 'extended' WHERE id = 'af979dbb-643d-45ca-8419-82293280b884' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- The Uprising (tt36983905) → extended
UPDATE films SET imdb_rating = 6.2, imdb_votes = 12586, curation_tier = 'extended' WHERE id = 'b0b069f6-c3de-45ae-91f1-1503b2f46fa0' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Twisters (tt12584954) → extended
UPDATE films SET imdb_rating = 6.5, imdb_votes = 201771, curation_tier = 'extended' WHERE id = 'b753c7fb-687e-4136-b1ba-685bb5d1614e' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- The Furious (tt33311069) → extended
UPDATE films SET imdb_rating = 7.2, imdb_votes = 29680, curation_tier = 'extended' WHERE id = 'b7d90e62-415c-4b8a-8d30-69ec5388efb9' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Coyote vs. Acme (tt1756855) → extended
UPDATE films SET imdb_rating = 7.3, imdb_votes = 46897, curation_tier = 'extended' WHERE id = 'b7ec9352-9925-4ed0-9211-31b557adb309' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Sense and Sensibility (tt13609648) → extended
UPDATE films SET imdb_rating = 7.4, imdb_votes = 5520, curation_tier = 'extended' WHERE id = 'b8edbb8d-a66e-42d1-872c-f24b47b39076' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Don't Say Good Luck (tt36590417) → extended
UPDATE films SET imdb_rating = 6.8, imdb_votes = 9310, curation_tier = 'extended' WHERE id = 'b9a28006-7759-49ac-80cc-23db121f3218' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Uncharted (tt1464335) → extended
UPDATE films SET imdb_rating = 6.3, imdb_votes = 309869, curation_tier = 'extended' WHERE id = 'b9e76f3b-0e3a-4bde-ac62-f57050fe436d' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- The Dog Stars (tt21285562) → extended
UPDATE films SET imdb_rating = 6.4, imdb_votes = 18083, curation_tier = 'extended' WHERE id = 'bd993b34-72bc-4606-a404-13df728229ef' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Demon Slayer: Kimetsu no Yaiba - Sibling's Bond (tt14888860) → core
UPDATE films SET imdb_rating = 8.4, imdb_votes = 5335, curation_tier = 'core' WHERE id = 'cd8ef8a3-e7f1-4c96-a6a3-124d7933484a' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- undertone (tt35892608) → extended
UPDATE films SET imdb_rating = 5.9, imdb_votes = 36970, curation_tier = 'extended' WHERE id = 'ceb691a1-18de-4732-be1b-1065541fadbc' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- The Master and Margarita (tt14536120) → extended
UPDATE films SET imdb_rating = 7.1, imdb_votes = 7482, curation_tier = 'extended' WHERE id = 'd03ed8d5-21d3-4a8d-96d4-52fc476738e8' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- No Time to Die (tt2382320) → extended
UPDATE films SET imdb_rating = 7.3, imdb_votes = 496644, curation_tier = 'extended' WHERE id = 'd0c00c91-6e92-4f0d-8120-c98869601d73' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- One Night Only (tt37853455) → extended
UPDATE films SET imdb_rating = 6, imdb_votes = 17538, curation_tier = 'extended' WHERE id = 'd1225731-07dd-448e-96ec-e0b1689080f3' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Young Washington (tt32104007) → extended
UPDATE films SET imdb_rating = 6.8, imdb_votes = 14809, curation_tier = 'extended' WHERE id = 'd38ee4d1-02b6-42bb-83bd-9a83999c2585' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Normal (tt31195136) → extended
UPDATE films SET imdb_rating = 6.3, imdb_votes = 38151, curation_tier = 'extended' WHERE id = 'd5f468ac-bf0e-475a-affc-92e419bb5502' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Hokum (tt35672862) → extended
UPDATE films SET imdb_rating = 6.6, imdb_votes = 73751, curation_tier = 'extended' WHERE id = 'd6aac9ab-f2b3-4136-93f1-dd407b7e7d3a' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Soulm8te (tt32654916) → extended
UPDATE films SET imdb_rating = 5.8, imdb_votes = 11093, curation_tier = 'extended' WHERE id = 'd6cba55f-37a5-4eaa-8761-2a79986585ff' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Carolina Caroline (tt33365126) → extended
UPDATE films SET imdb_rating = 6.6, imdb_votes = 7724, curation_tier = 'extended' WHERE id = 'db45f6d9-5f69-4fde-abda-812fd006f8cc' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Lee Cronin's The Mummy (tt32612507) → extended
UPDATE films SET imdb_rating = 6.1, imdb_votes = 76670, curation_tier = 'extended' WHERE id = 'db75c56b-f627-47e1-96db-866f506e9af1' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Voicemails for Isabelle (tt10375624) → extended
UPDATE films SET imdb_rating = 7.2, imdb_votes = 58367, curation_tier = 'extended' WHERE id = 'e1920050-fd1f-44a8-a790-ecc931e24cd4' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Ant-Man and the Wasp: Quantumania (tt10954600) → extended
UPDATE films SET imdb_rating = 6, imdb_votes = 281719, curation_tier = 'extended' WHERE id = 'e8b6fa8a-99ea-487b-a382-9ef33b9936bb' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Superman Returns (tt0348150) → extended
UPDATE films SET imdb_rating = 6.1, imdb_votes = 305461, curation_tier = 'extended' WHERE id = 'e8d34f4e-42c2-4c1f-9f55-f35d601d7c47' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- I Love Boosters (tt30827810) → extended
UPDATE films SET imdb_rating = 6.6, imdb_votes = 9561, curation_tier = 'extended' WHERE id = 'ee664375-0df5-4b5e-a6d0-aa04bc73495a' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Ranabaali (tt32324552) → extended
UPDATE films SET imdb_rating = 7.6, imdb_votes = 5787, curation_tier = 'extended' WHERE id = 'efe2aa91-f6c3-4970-a7eb-8adccf169037' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Fantastic Beasts: The Secrets of Dumbledore (tt4123432) → extended
UPDATE films SET imdb_rating = 6.2, imdb_votes = 196505, curation_tier = 'extended' WHERE id = 'f02867f3-6675-433c-95f2-7d1a6eec0093' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Apex (tt16431404) → extended
UPDATE films SET imdb_rating = 6.1, imdb_votes = 112763, curation_tier = 'extended' WHERE id = 'f1b48d8c-8d91-44ec-9ca1-836b2e1551a4' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Facing El Chapo (tt39390497) → extended
UPDATE films SET imdb_rating = 6.7, imdb_votes = 9653, curation_tier = 'extended' WHERE id = 'f209fb28-7ec7-4fa1-8d07-14a4a755334a' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- The Little Mermaid (tt5971474) → extended
UPDATE films SET imdb_rating = 7.2, imdb_votes = 180872, curation_tier = 'extended' WHERE id = 'f5c7e338-e656-41a5-9901-5ea1665e4d57' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- The Rivals of Amziah King (tt27706593) → extended
UPDATE films SET imdb_rating = 6.6, imdb_votes = 8450, curation_tier = 'extended' WHERE id = 'f93374e9-ea5a-4a52-8dbb-5b55d2da06a5' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Is God Is (tt34379307) → extended
UPDATE films SET imdb_rating = 6.5, imdb_votes = 7994, curation_tier = 'extended' WHERE id = 'fb564a0e-f666-43f5-aa77-188a8724cfb9' AND imdb_rating IS NULL AND curation_tier = 'archive';

-- Doğrulama: yedek 79 satır olmalı ve hiçbir film eski tier'da kalmamalı; aksi halde işlem geri alınır.
DO $$
DECLARE _backup INT; _unchanged INT;
BEGIN
  SELECT count(*) INTO _backup FROM films_phase1b_backup_20261031;
  SELECT count(*) INTO _unchanged FROM films f JOIN films_phase1b_backup_20261031 b ON b.id = f.id WHERE f.curation_tier = b.curation_tier;
  IF _backup <> 79 THEN RAISE EXCEPTION 'ABORT: yedek % satır (beklenen 79)', _backup; END IF;
  IF _unchanged <> 0 THEN RAISE EXCEPTION 'ABORT: % film tier degistirmedi (UPDATE 0 satir etkiledi)', _unchanged; END IF;
END $$;

COMMIT;
