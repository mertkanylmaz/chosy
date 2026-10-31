-- MOOD-VEC-2c Adım 1: films.genres TR -> TMDb en-US (tüm tier'lar)
-- Uygulama: supabase db push (migration'a taşınırken). Tek transaction.
BEGIN;

-- 1) Yedek (yalnız etkilenen satırlar)
CREATE TABLE public.films_genre_backup_20261031 AS
SELECT f.id, f.genres
FROM public.films f
WHERE f.genres && ARRAY['Komedi','Aksiyon','Gerilim','Macera','Romantik','Fantezi','Suç',
  'Bilim Kurgu','Aile','Korku','Animasyon','Gizem','Tarih','Savaş','Müzik']::text[];

ALTER TABLE public.films_genre_backup_20261031 ADD PRIMARY KEY (id);
ALTER TABLE public.films_genre_backup_20261031 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.films_genre_backup_20261031 FROM anon, authenticated;

-- 2) Dönüşüm: sıra korunur (ilk görülme), dizi içi tekrar silinir
WITH map(tr, en) AS (VALUES
  ('Bilim Kurgu','Science Fiction'), ('Romantik','Romance'), ('Fantezi','Fantasy'),
  ('Suç','Crime'), ('Aile','Family'), ('Korku','Horror'), ('Animasyon','Animation'),
  ('Gizem','Mystery'), ('Tarih','History'), ('Savaş','War'), ('Müzik','Music'),
  ('Aksiyon','Action'), ('Komedi','Comedy'), ('Gerilim','Thriller'), ('Macera','Adventure')
),
mapped AS (
  SELECT f.id, COALESCE(m.en, x.g) AS g, x.o
  FROM public.films_genre_backup_20261031 b
  JOIN public.films f ON f.id = b.id
  CROSS JOIN LATERAL unnest(f.genres) WITH ORDINALITY AS x(g, o)
  LEFT JOIN map m ON m.tr = x.g
),
firsts AS (
  SELECT id, g, min(o) AS o FROM mapped GROUP BY id, g
),
rebuilt AS (
  SELECT id, array_agg(g ORDER BY o) AS genres FROM firsts GROUP BY id
)
UPDATE public.films f
SET genres = r.genres
FROM rebuilt r
WHERE f.id = r.id AND f.genres IS DISTINCT FROM r.genres;

-- 3) Doğrulama
DO $$
DECLARE v_left int; v_dup int; v_bk int; v_len int;
BEGIN
  SELECT count(*) INTO v_left FROM public.films
  WHERE genres && ARRAY['Komedi','Aksiyon','Gerilim','Macera','Romantik','Fantezi','Suç',
    'Bilim Kurgu','Aile','Korku','Animasyon','Gizem','Tarih','Savaş','Müzik']::text[];
  IF v_left <> 0 THEN RAISE EXCEPTION 'TR etiket kalan film: %', v_left; END IF;

  SELECT count(*) INTO v_dup FROM public.films f
  WHERE cardinality(f.genres) <> (SELECT count(DISTINCT g) FROM unnest(f.genres) g);
  IF v_dup <> 0 THEN RAISE EXCEPTION 'dizi içi tekrar: %', v_dup; END IF;

  SELECT count(*) INTO v_bk FROM public.films_genre_backup_20261031;
  SELECT count(*) INTO v_len FROM public.films_genre_backup_20261031 b
  JOIN public.films f USING (id) WHERE cardinality(f.genres) > cardinality(b.genres);
  IF v_len <> 0 THEN RAISE EXCEPTION 'dizi uzadı: %', v_len; END IF;
  RAISE NOTICE 'genre-normalize OK, yedeklenen=%', v_bk;
END $$;

COMMIT;
