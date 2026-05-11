-- Migration 015: match_films'e controlled randomness + min_similarity
--
-- Sorunlar:
--   1. Aynı prompt her seferinde aynı sırada aynı filmleri döndürüyordu
--      (ORDER BY cosine distance → deterministik)
--   2. min_similarity parametresi SQL'de yoktu, client tarafında filtreleniyordu
--
-- Çözüm:
--   - Sıralama anahtarına random() * 0.12 noise eklendi
--   - Yüksek similarity filmler hâlâ üstte kalır ama her çağrıda farklı varyasyon
--   - min_similarity parametresi WHERE clause'a eklendi (server-side filtering)
--   - STABLE → VOLATILE (random() kullanıldığı için)

-- Eski imzaları temizle (her iki varyant)
DROP FUNCTION IF EXISTS match_films(vector(384), int, int, int, float, text[], text[], uuid[]);
DROP FUNCTION IF EXISTS match_films(vector, int, float, int, int, float, text[], text[], uuid[]);

CREATE OR REPLACE FUNCTION match_films(
  query_vector  vector(384),
  match_count   int     DEFAULT 20,
  year_from     int     DEFAULT NULL,
  year_to       int     DEFAULT NULL,
  min_rating    float   DEFAULT NULL,
  countries     text[]  DEFAULT NULL,
  directors     text[]  DEFAULT NULL,
  exclude_ids   uuid[]  DEFAULT NULL,
  min_similarity float  DEFAULT NULL
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
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH candidates AS (
    SELECT
      fp.film_id,
      fp.profile_vector,
      fp.dimensions_json
    FROM film_profiles fp
    JOIN films f ON f.id = fp.film_id
    WHERE
      (year_from    IS NULL OR f.year          >= year_from)
      AND (year_to  IS NULL OR f.year          <= year_to)
      AND (min_rating  IS NULL OR f.vote_average >= min_rating)
      AND (
        countries IS NULL
        OR cardinality(countries) = 0
        OR f.country && countries
      )
      AND (
        directors IS NULL
        OR cardinality(directors) = 0
        OR f.director = ANY(directors)
      )
      AND (
        exclude_ids IS NULL
        OR cardinality(exclude_ids) = 0
        OR f.id != ALL(exclude_ids)
      )
  ),
  scored AS (
    SELECT
      c.film_id,
      c.profile_vector,
      c.dimensions_json,
      1 - (c.profile_vector <=> query_vector) AS raw_similarity,
      (c.profile_vector <=> query_vector) + (random() * 0.12) AS sort_key
    FROM candidates c
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
    s.raw_similarity AS similarity,
    s.dimensions_json
  FROM scored s
  JOIN films f ON f.id = s.film_id
  WHERE (min_similarity IS NULL OR s.raw_similarity >= min_similarity)
  ORDER BY s.sort_key
  LIMIT match_count;
$$;

GRANT EXECUTE
  ON FUNCTION match_films(vector(384), int, int, int, float, text[], text[], uuid[], float)
  TO anon;

GRANT EXECUTE
  ON FUNCTION match_films(vector(384), int, int, int, float, text[], text[], uuid[], float)
  TO authenticated;
