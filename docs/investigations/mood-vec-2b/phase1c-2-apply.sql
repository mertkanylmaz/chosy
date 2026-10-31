-- MOOD-VEC-2b Faz 1C-2: 28 arşiv filminin imdb_votes[/imdb_rating] + curation_tier'ı (oy: IMDb veri dosyası). HAZIRLANDI, ÇALIŞTIRILMADI.
-- Her UPDATE filmin hâlâ archive olduğunu ve imdb_votes'un hazırlık anındaki değerde olduğunu doğrular (kayma varsa 0 satır).
-- Beklenen: 28 UPDATE × 1 satır. Geri alma: phase1c-2-rollback.sql.

BEGIN;

-- Yedek: değişecek 28 filmin önceki değerleri. Tablo zaten varsa bu satır hata verir ve işlem durur (üzerine yazma yok).
CREATE TABLE films_phase1c2_backup_20261031 AS
  SELECT id, imdb_id, imdb_rating, imdb_votes, curation_tier FROM films WHERE id IN ('a14861e1-4635-4e9f-89a9-ecd515dfcc09', 'a521ad34-9fb2-4d7d-89c5-40259b937bd5', 'a8edc36c-8004-4600-882f-6411e613fdea', 'ab7c342e-00c6-4fb4-8e2e-0fad7ccbd2e8', 'b753c7fb-687e-4136-b1ba-685bb5d1614e', 'b979604c-f128-4efb-83d9-46e20a0f2d73', 'b9e76f3b-0e3a-4bde-ac62-f57050fe436d', 'c519ef4c-6301-45c1-8bc3-012f8c4fbe76', 'c53664d2-7fa8-480d-9957-73c305ea4276', 'cb5c6eb1-04d7-46e2-a95e-addd78a251cd', 'ceb691a1-18de-4732-be1b-1065541fadbc', 'cebb3fab-8f9d-4046-9ead-e03a4d0d4209', 'd0c00c91-6e92-4f0d-8120-c98869601d73', 'd38ee4d1-02b6-42bb-83bd-9a83999c2585', 'd5f468ac-bf0e-475a-affc-92e419bb5502', 'd7e06127-f8e0-419a-b7b3-aed90b37ceaa', 'db75c56b-f627-47e1-96db-866f506e9af1', 'e1920050-fd1f-44a8-a790-ecc931e24cd4', 'e2f1bd3d-a52d-41ed-b82d-8de5e2b3debf', 'e41ed28b-15e4-4687-854d-353f5d0ee736', 'e8b6fa8a-99ea-487b-a382-9ef33b9936bb', 'e8d34f4e-42c2-4c1f-9f55-f35d601d7c47', 'ec585efd-cbbe-4dac-a6b3-d2ba3976002f', 'ed756f87-3d74-4c3f-a603-7acc801589d7', 'f02867f3-6675-433c-95f2-7d1a6eec0093', 'f5c7e338-e656-41a5-9901-5ea1665e4d57', 'f6b353bf-b61d-4eac-be05-a05ab9a45258', 'f7d4c3e7-7362-4118-bde8-797274c40127');
ALTER TABLE films_phase1c2_backup_20261031 ENABLE ROW LEVEL SECURITY;

-- I Can Quit Whenever I Want (2014, A, 7/10447; eski DB oyu 9764) → extended
UPDATE films SET imdb_votes = 10447, curation_tier = 'extended' WHERE id = 'a14861e1-4635-4e9f-89a9-ecd515dfcc09' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 9764;
-- The Children's Train (2024, A, 7.4/10564; eski DB oyu 8916) → extended
UPDATE films SET imdb_votes = 10564, curation_tier = 'extended' WHERE id = 'a521ad34-9fb2-4d7d-89c5-40259b937bd5' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 8916;
-- Minions: The Rise of Gru (2022, B, 6.5/110037; eski DB oyu 4025) → extended
UPDATE films SET imdb_votes = 110037, imdb_rating = 6.5, curation_tier = 'extended' WHERE id = 'a8edc36c-8004-4600-882f-6411e613fdea' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 4025 AND imdb_rating IS NULL;
-- Pressure (2026, B, 7.3/40947; eski DB oyu 84) → extended
UPDATE films SET imdb_votes = 40947, imdb_rating = 7.3, curation_tier = 'extended' WHERE id = 'ab7c342e-00c6-4fb4-8e2e-0fad7ccbd2e8' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 84 AND imdb_rating IS NULL;
-- Twisters (2024, B, 6.5/201771; eski DB oyu 3011) → extended
UPDATE films SET imdb_votes = 201771, imdb_rating = 6.5, curation_tier = 'extended' WHERE id = 'b753c7fb-687e-4136-b1ba-685bb5d1614e' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 3011 AND imdb_rating IS NULL;
-- Last Train from Gun Hill (1959, A, 7.3/10004; eski DB oyu 9071) → extended
UPDATE films SET imdb_votes = 10004, curation_tier = 'extended' WHERE id = 'b979604c-f128-4efb-83d9-46e20a0f2d73' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 9071;
-- Uncharted (2022, B, 6.3/309869; eski DB oyu 6903) → extended
UPDATE films SET imdb_votes = 309869, imdb_rating = 6.3, curation_tier = 'extended' WHERE id = 'b9e76f3b-0e3a-4bde-ac62-f57050fe436d' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 6903 AND imdb_rating IS NULL;
-- The Wonderful Story of Henry Sugar and Three More (2024, A, 7.1/13762; eski DB oyu 8675) → core
UPDATE films SET imdb_votes = 13762, curation_tier = 'core' WHERE id = 'c519ef4c-6301-45c1-8bc3-012f8c4fbe76' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 8675;
-- Scenes from a Marriage (1974, A, 8.3/10743; eski DB oyu 9576) → core
UPDATE films SET imdb_votes = 10743, curation_tier = 'core' WHERE id = 'c53664d2-7fa8-480d-9957-73c305ea4276' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 9576;
-- Senso (1954, A, 7.4/10214; eski DB oyu 9511) → extended
UPDATE films SET imdb_votes = 10214, curation_tier = 'extended' WHERE id = 'cb5c6eb1-04d7-46e2-a95e-addd78a251cd' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 9511;
-- undertone (2026, B, 5.9/36970; eski DB oyu 270) → extended
UPDATE films SET imdb_votes = 36970, imdb_rating = 5.9, curation_tier = 'extended' WHERE id = 'ceb691a1-18de-4732-be1b-1065541fadbc' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 270 AND imdb_rating IS NULL;
-- Le Notti Bianche (1957, A, 7.8/10580; eski DB oyu 9351) → extended
UPDATE films SET imdb_votes = 10580, curation_tier = 'extended' WHERE id = 'cebb3fab-8f9d-4046-9ead-e03a4d0d4209' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 9351;
-- No Time to Die (2021, B, 7.3/496644; eski DB oyu 7147) → extended
UPDATE films SET imdb_votes = 496644, imdb_rating = 7.3, curation_tier = 'extended' WHERE id = 'd0c00c91-6e92-4f0d-8120-c98869601d73' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 7147 AND imdb_rating IS NULL;
-- Young Washington (2026, B, 6.8/14809; eski DB oyu 0) → extended
UPDATE films SET imdb_votes = 14809, imdb_rating = 6.8, curation_tier = 'extended' WHERE id = 'd38ee4d1-02b6-42bb-83bd-9a83999c2585' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 0 AND imdb_rating IS NULL;
-- Normal (2026, B, 6.3/38151; eski DB oyu 281) → extended
UPDATE films SET imdb_votes = 38151, imdb_rating = 6.3, curation_tier = 'extended' WHERE id = 'd5f468ac-bf0e-475a-affc-92e419bb5502' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 281 AND imdb_rating IS NULL;
-- Barefoot Gen (1983, A, 8/10685; eski DB oyu 9988) → core
UPDATE films SET imdb_votes = 10685, curation_tier = 'core' WHERE id = 'd7e06127-f8e0-419a-b7b3-aed90b37ceaa' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 9988;
-- Lee Cronin's The Mummy (2026, B, 6.1/76670; eski DB oyu 2103) → extended
UPDATE films SET imdb_votes = 76670, imdb_rating = 6.1, curation_tier = 'extended' WHERE id = 'db75c56b-f627-47e1-96db-866f506e9af1' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 2103 AND imdb_rating IS NULL;
-- Voicemails for Isabelle (2026, B, 7.2/58367; eski DB oyu 165) → extended
UPDATE films SET imdb_votes = 58367, imdb_rating = 7.2, curation_tier = 'extended' WHERE id = 'e1920050-fd1f-44a8-a790-ecc931e24cd4' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 165 AND imdb_rating IS NULL;
-- Othello (1951, A, 7.5/10343; eski DB oyu 9676) → core
UPDATE films SET imdb_votes = 10343, curation_tier = 'core' WHERE id = 'e2f1bd3d-a52d-41ed-b82d-8de5e2b3debf' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 9676;
-- Colors of Evil: Red (2024, A, 6.4/11064; eski DB oyu 7707) → extended
UPDATE films SET imdb_votes = 11064, curation_tier = 'extended' WHERE id = 'e41ed28b-15e4-4687-854d-353f5d0ee736' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 7707;
-- Ant-Man and the Wasp: Quantumania (2023, B, 6/281719; eski DB oyu 5866) → extended
UPDATE films SET imdb_votes = 281719, imdb_rating = 6, curation_tier = 'extended' WHERE id = 'e8b6fa8a-99ea-487b-a382-9ef33b9936bb' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 5866 AND imdb_rating IS NULL;
-- Superman Returns (2006, B, 6.1/305461; eski DB oyu 4590) → extended
UPDATE films SET imdb_votes = 305461, imdb_rating = 6.1, curation_tier = 'extended' WHERE id = 'e8d34f4e-42c2-4c1f-9f55-f35d601d7c47' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 4590 AND imdb_rating IS NULL;
-- The Shadow's Edge (2025, A, 7.1/15211; eski DB oyu 8806) → extended
UPDATE films SET imdb_votes = 15211, curation_tier = 'extended' WHERE id = 'ec585efd-cbbe-4dac-a6b3-d2ba3976002f' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 8806;
-- Sword Art Online the Movie: Ordinal Scale (2017, A, 7.3/10362; eski DB oyu 9966) → extended
UPDATE films SET imdb_votes = 10362, curation_tier = 'extended' WHERE id = 'ed756f87-3d74-4c3f-a603-7acc801589d7' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 9966;
-- Fantastic Beasts: The Secrets of Dumbledore (2022, B, 6.2/196505; eski DB oyu 5118) → extended
UPDATE films SET imdb_votes = 196505, imdb_rating = 6.2, curation_tier = 'extended' WHERE id = 'f02867f3-6675-433c-95f2-7d1a6eec0093' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 5118 AND imdb_rating IS NULL;
-- The Little Mermaid (2023, B, 7.2/180872; eski DB oyu 3330) → extended
UPDATE films SET imdb_votes = 180872, imdb_rating = 7.2, curation_tier = 'extended' WHERE id = 'f5c7e338-e656-41a5-9901-5ea1665e4d57' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 3330 AND imdb_rating IS NULL;
-- The Witch: Part 2 - The Other One (2022, A, 6.3/10083; eski DB oyu 9285) → extended
UPDATE films SET imdb_votes = 10083, curation_tier = 'extended' WHERE id = 'f6b353bf-b61d-4eac-be05-a05ab9a45258' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 9285;
-- Kuroneko (1968, A, 7.7/10163; eski DB oyu 9798) → extended
UPDATE films SET imdb_votes = 10163, curation_tier = 'extended' WHERE id = 'f7d4c3e7-7362-4118-bde8-797274c40127' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 9798;

-- Doğrulama: yedek 28 satır olmalı ve hiçbir film eski tier'da kalmamalı; aksi halde işlem geri alınır.
DO $$
DECLARE _backup INT; _unchanged INT;
BEGIN
  SELECT count(*) INTO _backup FROM films_phase1c2_backup_20261031;
  SELECT count(*) INTO _unchanged FROM films f JOIN films_phase1c2_backup_20261031 b ON b.id = f.id WHERE f.curation_tier = b.curation_tier;
  IF _backup <> 28 THEN RAISE EXCEPTION 'ABORT: yedek % satır (beklenen 28)', _backup; END IF;
  IF _unchanged <> 0 THEN RAISE EXCEPTION 'ABORT: % film tier degistirmedi (UPDATE 0 satir etkiledi)', _unchanged; END IF;
END $$;

COMMIT;
