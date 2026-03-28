-- ============================================================
-- MoodFlix — Migration 003: match_films güvenlik düzeltmesi
-- ============================================================
--
-- Sorun: match_films SECURITY INVOKER (varsayılan) olarak çalışıyordu.
--        Supabase'in yeni versiyonlarında anon/authenticated rollerine
--        otomatik EXECUTE yetkisi verilmiyor; bu yüzden RPC çağrısı
--        anonim kullanıcılar için boş veya hata döndürüyordu.
--
-- Çözüm:
--   1. SECURITY DEFINER: fonksiyon sahibi (postgres) yetkileriyle çalışır,
--      RLS'i bypass eder → film_profiles her zaman okunabilir.
--   2. GRANT EXECUTE: anon ve authenticated rollere açıkça izin verilir.
-- ============================================================

CREATE OR REPLACE FUNCTION match_films(
  query_vector vector(384),
  match_count  int DEFAULT 20
)
RETURNS TABLE (
  id            uuid,
  tmdb_id       int,
  title         text,
  year          int,
  poster_url    text,
  backdrop_url  text,
  overview      text,
  genres        text[],
  runtime       int,
  vote_average  float,
  similarity    float,
  dimensions_json jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER          -- postgres yetkileriyle çalışır, RLS bypass
SET search_path = public  -- SECURITY DEFINER için zorunlu güvenlik önlemi
AS $$
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
    1 - (fp.profile_vector <=> query_vector) AS similarity,
    fp.dimensions_json
  FROM film_profiles fp
  JOIN films f ON f.id = fp.film_id
  ORDER BY fp.profile_vector <=> query_vector
  LIMIT match_count;
$$;

-- Anonim ve giriş yapmış kullanıcılara çağırma yetkisi ver
GRANT EXECUTE ON FUNCTION match_films(vector(384), int) TO anon;
GRANT EXECUTE ON FUNCTION match_films(vector(384), int) TO authenticated;
