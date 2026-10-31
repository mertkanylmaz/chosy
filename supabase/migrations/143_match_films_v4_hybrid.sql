-- ============================================================
-- Chosy — match_films_v4: vektör (V) + tür (A) + önerilen başlık (C) aday kanalları
-- 143_match_films_v4_hybrid.sql  (MOOD-VEC-2c)
--
-- match_films_v3'e DOKUNULMAZ; eski istemci v3'ü çağırmaya devam eder.
--
-- Kanallar (birleşim tekrarsız, en çok match_count=40; kesme ve dönüş sırası: önce kanal
-- önceliği c > v > a, sonra similarity DESC):
--   V  v3'ün vektör mantığı (tier çarpanı, trust, keyword boost, per_director_cap=1), ilk 25.
--   A  genres_include ile kesişen, genres_exclude ile kesişmeyen aktif filmler,
--      imdb_votes DESC, vektör benzerliği >= min_similarity - 0.05, ilk 15.
--   C  suggested_titles katalog eşleşmesi (normalize başlık + |yıl farkı| <= 1), hepsi.
-- Hepsine: genres_exclude ile kesişen film DIŞLANIR (CTO kararı), max_runtime varsa runtime <= max_runtime (SERT; runtime NULL film elenir),
--   reference_titles eşleşmeleri DIŞLANIR, exclude_ids, year <= bu yıl, release_date <= bugün.
-- year_from/year_to/min_rating/countries/directors yalnız V kanalına uygulanır (v3 ile aynı).
--
-- Başlık normalizasyonu: unaccent uzantısı KURULU DEĞİL (list_extensions, 31 Eki 2026);
--   uzantı eklenmedi. Yerine yerleşik translate() ile Latin aksan katlama + noktalama
--   boşluğa indirgenir ("Spider-Man: Far From Home" == "spider man far from home") ve baştaki
--   "the " / "a " / "an " atılır ("Prestige" == "The Prestige"); katalog ve öneri tarafında aynı.
--   Uzantı istenirse: CREATE EXTENSION unaccent WITH SCHEMA extensions (onay gerekir).
--
-- Çıktı: v3 sütunları + channels text[] ('v','a','c'; çoklu olabilir).
--   similarity: V kanalındaysa v3 boosted_similarity, değilse karışık (mood/user) benzerlik.
--   Dönüş sırası: c içeren, sonra v içeren, sonra yalnız a; her grupta similarity DESC.
-- Performans: havuz CTE'si vektör/dimensions_json taşımaz (yalnız skaler blend); bunlar son
--   SELECT'te yalnız seçilen ≤40 satır için film_profiles'tan okunur. refs/sugg boşsa başlık
--   normalizasyonu çalışmaz.
-- Güvenlik: SECURITY DEFINER + search_path=public + anon/authenticated/service_role
--   EXECUTE; v3'ün canlı ACL'iyle aynı desen.
-- Geri alma:
--   DROP FUNCTION public.match_films_v4(vector, vector, double precision, double precision,
--     integer, integer, integer, double precision, text[], text[], uuid[], double precision,
--     integer, boolean, text[], boolean, text[], text[], integer, jsonb, jsonb);
-- ============================================================

CREATE OR REPLACE FUNCTION public.match_films_v4(
  query_vector vector,
  user_vector vector DEFAULT NULL::vector,
  mood_weight double precision DEFAULT 0.7,
  user_weight double precision DEFAULT 0.3,
  match_count integer DEFAULT 40,
  year_from integer DEFAULT NULL::integer,
  year_to integer DEFAULT NULL::integer,
  min_rating double precision DEFAULT NULL::double precision,
  countries text[] DEFAULT NULL::text[],
  directors text[] DEFAULT NULL::text[],
  exclude_ids uuid[] DEFAULT NULL::uuid[],
  min_similarity double precision DEFAULT NULL::double precision,
  per_director_cap integer DEFAULT 1,
  tier_boost boolean DEFAULT false,
  search_keywords text[] DEFAULT NULL::text[],
  exclude_archive boolean DEFAULT true,
  genres_include text[] DEFAULT NULL::text[],
  genres_exclude text[] DEFAULT NULL::text[],
  max_runtime integer DEFAULT NULL::integer,
  reference_titles jsonb DEFAULT NULL::jsonb,
  suggested_titles jsonb DEFAULT NULL::jsonb
)
RETURNS TABLE(
  id uuid,
  tmdb_id integer,
  title text,
  year integer,
  poster_url text,
  backdrop_url text,
  overview text,
  genres text[],
  runtime integer,
  vote_average double precision,
  director text,
  country text[],
  similarity double precision,
  dimensions_json jsonb,
  curation_tier text,
  mood_similarity double precision,
  user_similarity double precision,
  match_reason text,
  channels text[]
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH
  -- Başlık listeleri: yalnız dizi kabul edilir, en çok 20 öğe, normalize edilmiş başlık.
  refs AS (
    SELECT regexp_replace(btrim(regexp_replace(lower(translate(r.title,
             'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖØòóôõöøÙÚÛÜùúûüÝýÿÑñÇçŞşĞğİı',
             'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOOooooooUUUUuuuuYyyNnCcSsGgIi')),
             '[^a-z0-9]+', ' ', 'g')), '^(the|an|a) ', '') AS nt,
           r.year AS ry
    FROM jsonb_to_recordset(
           CASE WHEN jsonb_typeof(reference_titles) = 'array'
                THEN (SELECT COALESCE(jsonb_agg(e), '[]'::jsonb)
                      FROM (SELECT e FROM jsonb_array_elements(reference_titles) e LIMIT 20) q)
                ELSE '[]'::jsonb END
         ) AS r(title text, year integer)
    WHERE r.title IS NOT NULL
  ),
  sugg AS (
    SELECT regexp_replace(btrim(regexp_replace(lower(translate(s.title,
             'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖØòóôõöøÙÚÛÜùúûüÝýÿÑñÇçŞşĞğİı',
             'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOOooooooUUUUuuuuYyyNnCcSsGgIi')),
             '[^a-z0-9]+', ' ', 'g')), '^(the|an|a) ', '') AS nt,
           s.year AS sy
    FROM jsonb_to_recordset(
           CASE WHEN jsonb_typeof(suggested_titles) = 'array'
                THEN (SELECT COALESCE(jsonb_agg(e), '[]'::jsonb)
                      FROM (SELECT e FROM jsonb_array_elements(suggested_titles) e LIMIT 20) q)
                ELSE '[]'::jsonb END
         ) AS s(title text, year integer)
    WHERE s.title IS NOT NULL
  ),
  title_flag AS (
    SELECT EXISTS (SELECT 1 FROM refs) OR EXISTS (SELECT 1 FROM sugg) AS has_titles
  ),
  -- Ortak havuz: aktif film + "hepsine" filtreleri. Vektör taşınmaz, yalnız blend skoru.
  pool AS (
    SELECT
      fp.film_id,
      f.curation_tier AS tier,
      f.imdb_votes,
      f.imdb_rating,
      f.year AS film_year,
      f.tmdb_keywords,
      f.genres AS film_genres,
      f.vote_average AS film_vote,
      f.country AS film_country,
      f.director AS film_director,
      -- Başlık normalizasyonu yalnız refs/sugg doluysa (aksi halde ~7K translate/regexp atlanır).
      CASE WHEN (SELECT has_titles FROM title_flag) THEN
        regexp_replace(btrim(regexp_replace(lower(translate(f.title,
          'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖØòóôõöøÙÚÛÜùúûüÝýÿÑñÇçŞşĞğİı',
          'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOOooooooUUUUuuuuYyyNnCcSsGgIi')),
          '[^a-z0-9]+', ' ', 'g')), '^(the|an|a) ', '')
      END AS nt,
      CASE WHEN (SELECT has_titles FROM title_flag) THEN
        regexp_replace(btrim(regexp_replace(lower(translate(COALESCE(f.original_title, ''),
          'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖØòóôõöøÙÚÛÜùúûüÝýÿÑñÇçŞşĞğİı',
          'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOOooooooUUUUuuuuYyyNnCcSsGgIi')),
          '[^a-z0-9]+', ' ', 'g')), '^(the|an|a) ', '')
      END AS nt_orig,
      (mood_weight * (1 - (fp.profile_vector <=> query_vector)))
        + (user_weight * CASE
            WHEN user_vector IS NULL THEN 0.0
            ELSE (1 - (fp.profile_vector <=> user_vector))
          END) AS blend
    FROM film_profiles fp
    JOIN films f ON f.id = fp.film_id
    WHERE
      fp.profile_vector IS NOT NULL
      AND (NOT exclude_archive OR f.curation_tier != 'archive')
      AND (f.year IS NULL OR f.year <= EXTRACT(YEAR FROM CURRENT_DATE)::int)
      AND (f.release_date IS NULL OR f.release_date <= CURRENT_DATE)
      AND (max_runtime IS NULL OR (f.runtime IS NOT NULL AND f.runtime <= max_runtime))
      AND (
        genres_exclude IS NULL
        OR cardinality(genres_exclude) = 0
        OR NOT (f.genres && genres_exclude)
      )
      AND (
        exclude_ids IS NULL
        OR cardinality(exclude_ids) = 0
        OR f.id != ALL(exclude_ids)
      )
  ),
  allowed AS (
    SELECT p.*
    FROM pool p
    WHERE NOT EXISTS (
      SELECT 1 FROM refs r
      WHERE r.nt <> ''
        AND (r.nt = p.nt OR r.nt = p.nt_orig)
        AND (r.ry IS NULL OR (p.film_year IS NOT NULL AND abs(p.film_year - r.ry) <= 1))
    )
  ),

  -- ── Kanal V: v3 vektör mantığı ───────────────────────────────────────────
  v_cand AS (
    SELECT a.*
    FROM allowed a
    WHERE (year_from  IS NULL OR a.film_year >= year_from)
      AND (year_to    IS NULL OR a.film_year <= year_to)
      AND (min_rating IS NULL OR a.film_vote >= min_rating)
      AND (countries IS NULL OR cardinality(countries) = 0 OR a.film_country && countries)
      AND (directors IS NULL OR cardinality(directors) = 0 OR a.film_director = ANY(directors))
  ),
  v_prelim AS (
    SELECT
      c.*,
      CASE
        WHEN tier_boost AND c.tier = 'core'     THEN 1.15
        WHEN tier_boost AND c.tier = 'extended' THEN 1.00
        WHEN tier_boost AND c.tier = 'archive'  THEN 0.85
        ELSE 1.0
      END AS tier_multiplier,
      CASE
        WHEN c.imdb_votes IS NULL AND c.imdb_rating IS NULL
             AND c.film_year >= 2024 AND c.tier != 'core'
        THEN 0.5
        ELSE 1.0
      END AS trust_factor
    FROM v_cand c
  ),
  v_shortlist AS (
    SELECT p.*
    FROM v_prelim p
    WHERE (min_similarity IS NULL OR p.blend >= min_similarity)
    ORDER BY (1 - p.blend) / (p.tier_multiplier * p.trust_factor)
    LIMIT 600
  ),
  v_scored AS (
    SELECT
      s.*,
      CASE
        WHEN search_keywords IS NULL OR cardinality(search_keywords) = 0
             OR s.tmdb_keywords IS NULL OR cardinality(s.tmdb_keywords) = 0
        THEN 0
        ELSE (
          SELECT COUNT(*)::int FROM unnest(search_keywords) sk
          WHERE EXISTS (
            SELECT 1 FROM unnest(s.tmdb_keywords) tk
            WHERE strpos(lower(tk), lower(sk)) > 0
               OR strpos(lower(sk), lower(tk)) > 0
          )
        )
      END AS kw_count
    FROM v_shortlist s
  ),
  v_boosted AS (
    SELECT
      b.film_id,
      b.film_director,
      (b.blend + LEAST(b.kw_count * 0.06, 0.20)) * b.tier_multiplier * b.trust_factor AS boosted_similarity,
      (1 - (b.blend + LEAST(b.kw_count * 0.06, 0.20))) / (b.tier_multiplier * b.trust_factor) AS adjusted_sort_key
    FROM v_scored b
  ),
  v_ranked AS (
    SELECT
      o.*,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(o.film_director, 'unknown_' || o.film_id::text)
        ORDER BY o.adjusted_sort_key
      ) AS director_rank
    FROM v_boosted o
  ),
  v_final AS (
    SELECT
      r.film_id, r.boosted_similarity AS sim,
      ROW_NUMBER() OVER (ORDER BY r.adjusted_sort_key) AS rk
    FROM v_ranked r
    WHERE r.director_rank <= per_director_cap OR per_director_cap <= 0
    ORDER BY r.adjusted_sort_key
    LIMIT 25
  ),

  -- ── Kanal A: tür ─────────────────────────────────────────────────────────
  a_final AS (
    SELECT
      a.film_id, a.blend AS sim,
      ROW_NUMBER() OVER (ORDER BY a.imdb_votes DESC NULLS LAST, a.film_id) AS rk
    FROM allowed a
    WHERE genres_include IS NOT NULL
      AND cardinality(genres_include) > 0
      AND a.film_genres && genres_include
      AND (min_similarity IS NULL OR a.blend >= min_similarity - 0.05)
    ORDER BY a.imdb_votes DESC NULLS LAST, a.film_id
    LIMIT 15
  ),

  -- ── Kanal C: önerilen başlıklar ──────────────────────────────────────────
  c_final AS (
    SELECT
      m.film_id, m.blend AS sim,
      ROW_NUMBER() OVER (ORDER BY m.blend DESC, m.film_id) AS rk
    FROM (
      SELECT DISTINCT a.film_id, a.blend
      FROM allowed a
      JOIN sugg s
        ON s.nt <> ''
       AND (s.nt = a.nt OR s.nt = a.nt_orig)
       AND (s.sy IS NULL OR (a.film_year IS NOT NULL AND abs(a.film_year - s.sy) <= 1))
    ) m
  ),

  -- ── Birleşim: öncelik C > V > A, tekrarsız, en çok match_count ────────────
  u AS (
    SELECT film_id, 'c'::text AS ch, rk AS ord, sim FROM c_final
    UNION ALL
    SELECT film_id, 'v', 1000 + rk, sim FROM v_final
    UNION ALL
    SELECT film_id, 'a', 2000 + rk, sim FROM a_final
  ),
  merged AS (
    SELECT
      film_id,
      array_agg(DISTINCT ch ORDER BY ch) AS chs,
      min(ord) AS ord,
      COALESCE(max(sim) FILTER (WHERE ch = 'v'), max(sim)) AS sim
    FROM u
    GROUP BY film_id
  ),
  picked AS (
    SELECT * FROM merged ORDER BY ord LIMIT GREATEST(match_count, 1)
  ),
  vec AS (
    SELECT fp.film_id, fp.profile_vector, fp.dimensions_json
    FROM film_profiles fp
    WHERE fp.film_id IN (SELECT film_id FROM picked)
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
    k.sim AS similarity,
    vec.dimensions_json,
    a.tier AS curation_tier,
    (1 - (vec.profile_vector <=> query_vector)) AS mood_similarity,
    CASE WHEN user_vector IS NULL THEN 0.0
         ELSE (1 - (vec.profile_vector <=> user_vector)) END AS user_similarity,
    CASE
      WHEN search_keywords IS NOT NULL AND cardinality(search_keywords) > 0
           AND a.tmdb_keywords IS NOT NULL AND EXISTS (
             SELECT 1 FROM unnest(search_keywords) sk
             WHERE EXISTS (
               SELECT 1 FROM unnest(a.tmdb_keywords) tk
               WHERE strpos(lower(tk), lower(sk)) > 0
                  OR strpos(lower(sk), lower(tk)) > 0))
      THEN 'Matches: ' || (
        SELECT string_agg(sk, ', ') FROM unnest(search_keywords) sk
        WHERE EXISTS (
          SELECT 1 FROM unnest(a.tmdb_keywords) tk
          WHERE strpos(lower(tk), lower(sk)) > 0
             OR strpos(lower(sk), lower(tk)) > 0))
      WHEN a.tmdb_keywords IS NOT NULL AND cardinality(a.tmdb_keywords) > 0
      THEN array_to_string(a.tmdb_keywords[1:3], ', ')
      ELSE NULL
    END AS match_reason,
    k.chs AS channels
  FROM picked k
  JOIN allowed a ON a.film_id = k.film_id
  JOIN vec ON vec.film_id = k.film_id
  JOIN films f ON f.id = k.film_id
  ORDER BY CASE WHEN 'c' = ANY(k.chs) THEN 0 WHEN 'v' = ANY(k.chs) THEN 1 ELSE 2 END,
           k.sim DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.match_films_v4(
  vector, vector, double precision, double precision, integer, integer, integer,
  double precision, text[], text[], uuid[], double precision, integer, boolean,
  text[], boolean, text[], text[], integer, jsonb, jsonb
) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.match_films_v4 IS
  'MOOD-VEC-2c: V (vektör, v3 mantığı) + A (tür) + C (önerilen başlık) kanalları; '
  'tekrarsız en çok 40 aday, channels sütunu kanal etiketi. v3 değişmedi.';
