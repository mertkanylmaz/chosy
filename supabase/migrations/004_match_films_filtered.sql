-- ============================================================
-- MoodFlix — Migration 004: Filtrelenebilir match_films
-- ============================================================
--
-- Değişiklikler:
--   1. films tablosuna director (TEXT) ve country (TEXT[]) sütunları eklendi
--   2. metadata_json'dan backfill yapıldı
--   3. year, vote_average, director sütunlarına index eklendi
--   4. match_films RPC genişletildi:
--        - year_from / year_to  → SQL WHERE f.year BETWEEN
--        - min_rating           → SQL WHERE f.vote_average >=
--        - countries            → SQL WHERE f.country && countries (dizi overlap)
--        - directors            → SQL WHERE f.director = ANY(directors)
--        - exclude_ids          → SQL WHERE f.id != ALL(exclude_ids)
--      Öncelik: önce WHERE ile havuz daralt, sonra daraltılmış havuzda
--      vektör similarity çalıştır.
-- ============================================================

-- ── 1. Yeni sütunlar ─────────────────────────────────────────────────────────

ALTER TABLE films ADD COLUMN IF NOT EXISTS director TEXT;
ALTER TABLE films ADD COLUMN IF NOT EXISTS country  TEXT[];

-- ── 2. Backfill: metadata_json'dan mevcut verileri doldur ────────────────────

-- director: metadata_json->>'director' (script tarafından doldurulmuş olabilir)
UPDATE films
SET director = metadata_json->>'director'
WHERE metadata_json ? 'director'
  AND director IS NULL;

-- country: TMDb origin_country — ISO 3166-1 alpha-2 dizi ["US","KR",...]
-- Not: origin_country olmayan ama production_countries varsa ilk ülkeyi al
UPDATE films
SET country = ARRAY(
  SELECT jsonb_array_elements_text(metadata_json->'origin_country')
)
WHERE metadata_json ? 'origin_country'
  AND country IS NULL;

UPDATE films
SET country = ARRAY(
  SELECT elem->>'iso_3166_1'
  FROM jsonb_array_elements(metadata_json->'production_countries') AS elem
)
WHERE metadata_json ? 'production_countries'
  AND country IS NULL;

-- ── 3. Filtre indexleri ───────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_films_year
  ON films(year);

CREATE INDEX IF NOT EXISTS idx_films_vote_average
  ON films(vote_average);

CREATE INDEX IF NOT EXISTS idx_films_director
  ON films(director);

-- GIN index: country TEXT[] dizisi için overlap araması hızlanır
CREATE INDEX IF NOT EXISTS idx_films_country
  ON films USING gin(country);

-- ── 4. Eski match_films imzasını kaldır ──────────────────────────────────────
-- Yeni imza ek parametreler içerdiğinden DROP gerekiyor

DROP FUNCTION IF EXISTS match_films(vector(384), int);

-- ── 5. Yeni match_films ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION match_films(
  query_vector  vector(384),
  match_count   int     DEFAULT 20,
  year_from     int     DEFAULT NULL,
  year_to       int     DEFAULT NULL,
  min_rating    float   DEFAULT NULL,
  countries     text[]  DEFAULT NULL,
  directors     text[]  DEFAULT NULL,
  exclude_ids   uuid[]  DEFAULT NULL
)
RETURNS TABLE (
  id              uuid,
  tmdb_id         int,
  title           text,
  year            int,
  poster_url      text,
  backdrop_url    text,
  overview        text,
  genres          text[],
  runtime         int,
  vote_average    float,
  director        text,
  country         text[],
  similarity      float,
  dimensions_json jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER          -- postgres yetkileriyle çalışır, RLS bypass
SET search_path = public  -- SECURITY DEFINER güvenlik zorunluluğu
AS $$
  -- Adım 1: WHERE filtreleriyle aday havuzunu daralt
  -- Adım 2: Daraltılmış havuzda vektör similarity sıralaması yap
  WITH candidates AS (
    SELECT
      fp.film_id,
      fp.profile_vector,
      fp.dimensions_json
    FROM film_profiles fp
    JOIN films f ON f.id = fp.film_id
    WHERE
      -- Yıl aralığı filtresi
      (year_from    IS NULL OR f.year          >= year_from)
      AND (year_to  IS NULL OR f.year          <= year_to)
      -- Minimum IMDb puanı
      AND (min_rating  IS NULL OR f.vote_average >= min_rating)
      -- Ülke/bölge filtresi (dizi overlap: f.country && countries)
      AND (
        countries IS NULL
        OR cardinality(countries) = 0
        OR f.country && countries
      )
      -- Yönetmen filtresi
      AND (
        directors IS NULL
        OR cardinality(directors) = 0
        OR f.director = ANY(directors)
      )
      -- Daha önce gösterilen filmler hariç
      AND (
        exclude_ids IS NULL
        OR cardinality(exclude_ids) = 0
        OR f.id != ALL(exclude_ids)
      )
  )
  SELECT
    f.id,
    f.tmdb_id,
    f.title,
    f.year,
    f.poster_url,
    f.backdrop_url,
    f.overview,
    f.genres,
    f.runtime,
    f.vote_average,
    f.director,
    f.country,
    1 - (c.profile_vector <=> query_vector) AS similarity,
    c.dimensions_json
  FROM candidates c
  JOIN films f ON f.id = c.film_id
  ORDER BY c.profile_vector <=> query_vector
  LIMIT match_count;
$$;

-- Anon ve giriş yapmış kullanıcılara yeni imzayla çağırma yetkisi
GRANT EXECUTE
  ON FUNCTION match_films(vector(384), int, int, int, float, text[], text[], uuid[])
  TO anon;

GRANT EXECUTE
  ON FUNCTION match_films(vector(384), int, int, int, float, text[], text[], uuid[])
  TO authenticated;
