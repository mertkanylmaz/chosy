-- MOOD-VEC-2b Faz 1B: 35 arşiv filminin imdb_rating/imdb_votes[/imdb_id] + curation_tier'ı. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Kaynak: IMDb resmi veri dosyası (title.ratings.tsv.gz). Her UPDATE imdb_rating IS NULL ve curation_tier = archive doğrular.
-- Beklenen: 35 UPDATE × 1 satır (0 tanesi imdb_id da yazar). Geri alma: phase1b-rollback.sql.

BEGIN;

-- Yedek: değişecek 35 filmin önceki değerleri. Tablo zaten varsa bu satır hata verir ve işlem durur (üzerine yazma yok).
CREATE TABLE films_phase1b_backup_20261031 AS
  SELECT id, imdb_id, imdb_rating, imdb_votes, curation_tier FROM films WHERE id IN ('024e64eb-7cb2-4076-8729-b73b147263a8', '1d623f94-8769-473c-b74c-b6f71daec231', '1ed485f9-9b4a-4ac5-afa8-a70cef98d376', '2dc0ab07-b53d-4d9b-a1ae-df2b2aee7a98', '33bac263-99cc-48a0-a0ef-c4477f50449a', '3433262f-d0e8-42cb-8d30-74313dd73949', '362b8024-5e47-4a6f-830c-2f15e0362a44', '42f199eb-31c8-496f-8b21-2b269b7562fd', '43cde8b8-7a60-43d3-9237-e0231da2eb65', '4c5db4ec-e6c0-49e9-9ef7-496509e516fc', '6892a6cb-b3a7-4ec8-a8ef-6386c7dd62a5', '68938f8d-c3ce-4f7f-ae15-0b1ddbc7d3f0', '6a1030eb-be74-4f94-85b1-4be991c7ffa6', '76968536-b9b0-41a5-8fac-ace61541c12f', '78d1ea94-efd7-41fc-9c87-d9ee32b726d9', '7b80abf4-ea55-4200-bace-413564ed0396', '7e7d0c51-5894-451a-aaef-790f7a055a08', '8241de8f-5157-4a2e-b155-6c9566ce2cff', '86a06618-d520-4edc-a55a-378a7ca4a8cf', '87f5d122-208a-496b-b904-87eaaa809619', '8bd65ffe-e7eb-4e3f-9ed6-17bb5edea653', '90ce8b99-bb12-4e18-b4ee-29650cfb0855', '90d15469-8293-4aa8-b68a-340029eef910', '9860c920-8921-4d80-b571-e93e784ea217', 'a6bd4cd7-461b-4e44-9c79-16c68480cf07', 'aaa0987f-db4c-4c7e-bbc5-2326032f9d64', 'af979dbb-643d-45ca-8419-82293280b884', 'b0b069f6-c3de-45ae-91f1-1503b2f46fa0', 'b7d90e62-415c-4b8a-8d30-69ec5388efb9', 'b7ec9352-9925-4ed0-9211-31b557adb309', 'bd993b34-72bc-4606-a404-13df728229ef', 'd1225731-07dd-448e-96ec-e0b1689080f3', 'd6aac9ab-f2b3-4136-93f1-dd407b7e7d3a', 'd6cba55f-37a5-4eaa-8761-2a79986585ff', 'f1b48d8c-8d91-44ec-9ca1-836b2e1551a4');
ALTER TABLE films_phase1b_backup_20261031 ENABLE ROW LEVEL SECURITY;

-- In the Grey (tt27681354) → extended
UPDATE films SET imdb_rating = 6.3, imdb_votes = 56369, curation_tier = 'extended' WHERE id = '024e64eb-7cb2-4076-8729-b73b147263a8' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Leviticus (tt39143902) → extended
UPDATE films SET imdb_rating = 6.4, imdb_votes = 20399, curation_tier = 'extended' WHERE id = '1d623f94-8769-473c-b74c-b6f71daec231' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- The Death of Robin Hood (tt32273171) → extended
UPDATE films SET imdb_rating = 6, imdb_votes = 24451, curation_tier = 'extended' WHERE id = '1ed485f9-9b4a-4ac5-afa8-a70cef98d376' AND imdb_rating IS NULL AND curation_tier = 'archive';
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
-- Pet Sematary (tt0098084) → extended
UPDATE films SET imdb_rating = 6.5, imdb_votes = 126403, curation_tier = 'extended' WHERE id = '4c5db4ec-e6c0-49e9-9ef7-496509e516fc' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Supergirl (tt8814476) → extended
UPDATE films SET imdb_rating = 5.8, imdb_votes = 118383, curation_tier = 'extended' WHERE id = '6892a6cb-b3a7-4ec8-a8ef-6386c7dd62a5' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- The Love Hypothesis (tt22526100) → extended
UPDATE films SET imdb_rating = 6.8, imdb_votes = 32292, curation_tier = 'extended' WHERE id = '68938f8d-c3ce-4f7f-ae15-0b1ddbc7d3f0' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Evil Dead Burn (tt31170389) → extended
UPDATE films SET imdb_rating = 6.2, imdb_votes = 60984, curation_tier = 'extended' WHERE id = '6a1030eb-be74-4f94-85b1-4be991c7ffa6' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- The Mandalorian and Grogu (tt30825738) → extended
UPDATE films SET imdb_rating = 6.7, imdb_votes = 122379, curation_tier = 'extended' WHERE id = '76968536-b9b0-41a5-8fac-ace61541c12f' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Venom: Let There Be Carnage (tt7097896) → extended
UPDATE films SET imdb_rating = 5.9, imdb_votes = 313417, curation_tier = 'extended' WHERE id = '78d1ea94-efd7-41fc-9c87-d9ee32b726d9' AND imdb_rating IS NULL AND curation_tier = 'archive';
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
-- The Transformers: The Movie (tt0092106) → extended
UPDATE films SET imdb_rating = 7.2, imdb_votes = 45911, curation_tier = 'extended' WHERE id = '8bd65ffe-e7eb-4e3f-9ed6-17bb5edea653' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Tony (tt33095251) → extended
UPDATE films SET imdb_rating = 7.3, imdb_votes = 18730, curation_tier = 'extended' WHERE id = '90ce8b99-bb12-4e18-b4ee-29650cfb0855' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Teenage Sex and Death at Camp Miasma (tt35298123) → extended
UPDATE films SET imdb_rating = 6.5, imdb_votes = 24189, curation_tier = 'extended' WHERE id = '90d15469-8293-4aa8-b68a-340029eef910' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- UNABOMBER (tt6933238) → extended
UPDATE films SET imdb_rating = 6.2, imdb_votes = 35351, curation_tier = 'extended' WHERE id = '9860c920-8921-4d80-b571-e93e784ea217' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Wet Hot American Summer (tt0243655) → extended
UPDATE films SET imdb_rating = 6.5, imdb_votes = 65083, curation_tier = 'extended' WHERE id = 'a6bd4cd7-461b-4e44-9c79-16c68480cf07' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Mortal Kombat II (tt17490712) → extended
UPDATE films SET imdb_rating = 6.3, imdb_votes = 95569, curation_tier = 'extended' WHERE id = 'aaa0987f-db4c-4c7e-bbc5-2326032f9d64' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Masters of the Universe (tt0427340) → extended
UPDATE films SET imdb_rating = 6.4, imdb_votes = 130846, curation_tier = 'extended' WHERE id = 'af979dbb-643d-45ca-8419-82293280b884' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- The Uprising (tt36983905) → extended
UPDATE films SET imdb_rating = 6.2, imdb_votes = 12586, curation_tier = 'extended' WHERE id = 'b0b069f6-c3de-45ae-91f1-1503b2f46fa0' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- The Furious (tt33311069) → extended
UPDATE films SET imdb_rating = 7.2, imdb_votes = 29680, curation_tier = 'extended' WHERE id = 'b7d90e62-415c-4b8a-8d30-69ec5388efb9' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Coyote vs. Acme (tt1756855) → extended
UPDATE films SET imdb_rating = 7.3, imdb_votes = 46897, curation_tier = 'extended' WHERE id = 'b7ec9352-9925-4ed0-9211-31b557adb309' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- The Dog Stars (tt21285562) → extended
UPDATE films SET imdb_rating = 6.4, imdb_votes = 18083, curation_tier = 'extended' WHERE id = 'bd993b34-72bc-4606-a404-13df728229ef' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- One Night Only (tt37853455) → extended
UPDATE films SET imdb_rating = 6, imdb_votes = 17538, curation_tier = 'extended' WHERE id = 'd1225731-07dd-448e-96ec-e0b1689080f3' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Hokum (tt35672862) → extended
UPDATE films SET imdb_rating = 6.6, imdb_votes = 73751, curation_tier = 'extended' WHERE id = 'd6aac9ab-f2b3-4136-93f1-dd407b7e7d3a' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Soulm8te (tt32654916) → extended
UPDATE films SET imdb_rating = 5.8, imdb_votes = 11093, curation_tier = 'extended' WHERE id = 'd6cba55f-37a5-4eaa-8761-2a79986585ff' AND imdb_rating IS NULL AND curation_tier = 'archive';
-- Apex (tt16431404) → extended
UPDATE films SET imdb_rating = 6.1, imdb_votes = 112763, curation_tier = 'extended' WHERE id = 'f1b48d8c-8d91-44ec-9ca1-836b2e1551a4' AND imdb_rating IS NULL AND curation_tier = 'archive';

-- Doğrulama: yedek 35 satır olmalı ve hiçbir film eski tier'da kalmamalı; aksi halde işlem geri alınır.
DO $$
DECLARE _backup INT; _unchanged INT;
BEGIN
  SELECT count(*) INTO _backup FROM films_phase1b_backup_20261031;
  SELECT count(*) INTO _unchanged FROM films f JOIN films_phase1b_backup_20261031 b ON b.id = f.id WHERE f.curation_tier = b.curation_tier;
  IF _backup <> 35 THEN RAISE EXCEPTION 'ABORT: yedek % satır (beklenen 35)', _backup; END IF;
  IF _unchanged <> 0 THEN RAISE EXCEPTION 'ABORT: % film tier degistirmedi (UPDATE 0 satir etkiledi)', _unchanged; END IF;
END $$;

COMMIT;
