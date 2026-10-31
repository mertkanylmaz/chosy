-- MOOD-VEC-2b Faz 1D: kural B ile arşivde kalan 6 filmin IMDb dosya oyuyla yeniden kontrolü; yalnız 1 film (Burning Days) değişir. HAZIRLANDI, ÇALIŞTIRILMADI.
-- Burning Days: DB 7.5/144 (bayat) → dosya 7.4/15259 → extended. imdb_rating'e dokunulmaz (1C A-kalıbı). Diğer 5 film dosya değeriyle de arşivde kalır (SQL'e girmez).
-- Beklenen: 1 UPDATE × 1 satır. Geri alma: phase1d-rollback.sql.

BEGIN;

-- Yedek: değişecek filmin önceki değerleri. Tablo zaten varsa bu satır hata verir ve işlem durur (üzerine yazma yok).
CREATE TABLE films_phase1d_backup_20261031 AS
  SELECT id, imdb_id, imdb_rating, imdb_votes, curation_tier FROM films WHERE id IN ('937fd106-34d1-49cf-a34a-bb3045c4d91d');
ALTER TABLE films_phase1d_backup_20261031 ENABLE ROW LEVEL SECURITY;

-- Burning Days (2022, A, 7.5/15259; eski DB oyu 144) → extended
UPDATE films SET imdb_votes = 15259, curation_tier = 'extended' WHERE id = '937fd106-34d1-49cf-a34a-bb3045c4d91d' AND curation_tier = 'archive' AND imdb_votes IS NOT DISTINCT FROM 144;

-- Doğrulama: yedek 1 satır olmalı ve hiçbir film eski tier'da kalmamalı; aksi halde işlem geri alınır.
DO $$
DECLARE _backup INT; _unchanged INT;
BEGIN
  SELECT count(*) INTO _backup FROM films_phase1d_backup_20261031;
  SELECT count(*) INTO _unchanged FROM films f JOIN films_phase1d_backup_20261031 b ON b.id = f.id WHERE f.curation_tier = b.curation_tier;
  IF _backup <> 1 THEN RAISE EXCEPTION 'ABORT: yedek % satır (beklenen 1)', _backup; END IF;
  IF _unchanged <> 0 THEN RAISE EXCEPTION 'ABORT: % film tier degistirmedi (UPDATE 0 satir etkiledi)', _unchanged; END IF;
END $$;

COMMIT;
