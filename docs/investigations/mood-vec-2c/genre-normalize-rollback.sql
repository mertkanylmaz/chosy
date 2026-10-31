-- MOOD-VEC-2c Adım 1 geri alma: yedekten films.genres'i geri yükler.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.films_genre_backup_20261031') IS NULL THEN
    RAISE EXCEPTION 'yedek tablo yok';
  END IF;
END $$;

UPDATE public.films f
SET genres = b.genres
FROM public.films_genre_backup_20261031 b
WHERE f.id = b.id AND f.genres IS DISTINCT FROM b.genres;

DO $$
DECLARE v_diff int;
BEGIN
  SELECT count(*) INTO v_diff FROM public.films_genre_backup_20261031 b
  JOIN public.films f USING (id) WHERE f.genres IS DISTINCT FROM b.genres;
  IF v_diff <> 0 THEN RAISE EXCEPTION 'geri alma sonrası fark: %', v_diff; END IF;
END $$;

-- Yedek tablo bilinçli olarak silinmez; elle: DROP TABLE public.films_genre_backup_20261031;
COMMIT;
