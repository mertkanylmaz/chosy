-- ============================================================
-- Chosy — match_films_v3: önce vektörle aday kısa listesi, keyword yalnız onlara
-- 133_match_films_v3_vector_first.sql  (PRO-FIX-2)
--
-- Problem: keyword skoru (unnest × unnest × çift yönlü ILIKE) tüm havuz (~3.6K
--   vektörlü film) için hesaplanıyordu. search_keywords varken çağrı 3.3-3.8 sn,
--   yokken 116 ms (docs/investigations/PRO-FIX-2_KESIF.md).
--
-- Çözüm:
--   1. `shortlist` CTE: filtreler (aynı) + min_similarity (aynı) sonrası, vektör
--      skoruyla (blended_sim, tier/trust çarpanlarıyla — keyword boost'suz) ilk
--      N=600 aday. keyword_match_count yalnız bunlar için hesaplanır.
--   2. Kısa liste uzunluğu max(600, match_count × per_director_cap × 3): keyword'süz
--      yolda ilk match_count satırı 050 ile aynı sıralama anahtarından gelir (aynı sonuç).
--   2b. Keyword eşleşmesi ILIKE yerine strpos (aynı koşul, joker karaktersiz): canlı
--      veride 774.669 (tmdb_keyword × arama kelimesi) çiftinde 0 uyuşmazlık; TMDb
--      keyword'lerinde %, _ ve \ yok. ILIKE deseni her karşılaştırmada yeniden
--      derliyordu (49K karşılaştırma ≈ 0.6 sn).
--   3. Geri kalan boru hattı (blended → boosted → oversampled → capped) ve çıktı
--      şeması 050 ile aynıdır; imza değişmez (16 argüman).
--
-- Ayrıca 043'ten kalan 15 argümanlı overload düşürülür. 050 yeni imza ekleyince
-- `CREATE OR REPLACE` eski fonksiyonu silmedi; iki overload da aynı adlandırılmış
-- argümanlara uyduğu için send-daily-pick'in çağrısı (exclude_archive göndermiyor)
-- `42725 function match_films_v3(...) is not unique` ile düşüyordu. İstemci
-- (services/recommendations.ts) 16 argümanlıyı exclude_archive göndererek çağırır;
-- etkilenmez.
--
-- Davranış notu: keyword boost (+0.06/eşleşme, üst sınır +0.20) artık yalnız
-- vektörle ilk 600'e girebilmiş filmleri yukarı taşıyabilir. Kısa liste dışında
-- kalıp çok güçlü keyword eşleşmesi olan film artık görünmez (ölçüm tablosu
-- PR/rapor açıklamasında).
-- ============================================================

CREATE OR REPLACE FUNCTION public.match_films_v3(
  query_vector vector,
  user_vector vector DEFAULT NULL::vector,
  mood_weight double precision DEFAULT 0.7,
  user_weight double precision DEFAULT 0.3,
  match_count integer DEFAULT 20,
  year_from integer DEFAULT NULL::integer,
  year_to integer DEFAULT NULL::integer,
  min_rating double precision DEFAULT NULL::double precision,
  countries text[] DEFAULT NULL::text[],
  directors text[] DEFAULT NULL::text[],
  exclude_ids uuid[] DEFAULT NULL::uuid[],
  min_similarity double precision DEFAULT NULL::double precision,
  per_director_cap integer DEFAULT 2,
  tier_boost boolean DEFAULT false,
  search_keywords text[] DEFAULT NULL::text[],
  exclude_archive boolean DEFAULT true
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
  match_reason text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH candidates AS (
    SELECT
      fp.film_id,
      fp.profile_vector,
      fp.dimensions_json,
      f.curation_tier AS tier,
      f.imdb_votes,
      f.imdb_rating,
      f.year AS film_year,
      f.tmdb_keywords
    FROM film_profiles fp
    JOIN films f ON f.id = fp.film_id
    WHERE
      fp.profile_vector IS NOT NULL
      AND (NOT exclude_archive OR f.curation_tier != 'archive')
      AND (f.year IS NULL OR f.year <= EXTRACT(YEAR FROM CURRENT_DATE)::int)
      AND (year_from   IS NULL OR f.year          >= year_from)
      AND (year_to     IS NULL OR f.year          <= year_to)
      AND (min_rating  IS NULL OR f.vote_average  >= min_rating)
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
  -- PRO-FIX-2: vektör-only ön skor (keyword boost'suz). 050'deki adjusted_sort_key
  -- ile aynı formül, keyword_boost = 0.
  prelim AS (
    SELECT
      c.film_id,
      c.profile_vector,
      c.dimensions_json,
      c.tier,
      c.imdb_votes,
      c.imdb_rating,
      c.film_year,
      c.tmdb_keywords,
      (mood_weight * (1 - (c.profile_vector <=> query_vector)))
        + (user_weight * CASE
            WHEN user_vector IS NULL THEN 0.0
            ELSE (1 - (c.profile_vector <=> user_vector))
          END) AS pre_sim,
      CASE
        WHEN tier_boost AND c.tier = 'core'     THEN 1.15
        WHEN tier_boost AND c.tier = 'extended' THEN 1.00
        WHEN tier_boost AND c.tier = 'archive'  THEN 0.85
        ELSE 1.0
      END AS pre_tier_multiplier,
      CASE
        WHEN c.imdb_votes IS NULL
             AND c.imdb_rating IS NULL
             AND c.film_year >= 2024
             AND c.tier != 'core'
        THEN 0.5
        ELSE 1.0
      END AS pre_trust_factor
    FROM candidates c
  ),
  shortlist AS (
    SELECT
      p.film_id,
      p.profile_vector,
      p.dimensions_json,
      p.tier,
      p.imdb_votes,
      p.imdb_rating,
      p.film_year,
      p.tmdb_keywords
    FROM prelim p
    WHERE (min_similarity IS NULL OR p.pre_sim >= min_similarity)
    ORDER BY (1 - p.pre_sim) / (p.pre_tier_multiplier * p.pre_trust_factor)
    -- İlk 600 aday; oversampled'ın ihtiyacından (match_count × cap × 3) küçük olamaz.
    LIMIT GREATEST(600, match_count * GREATEST(per_director_cap, 1) * 3)
  ),
  scored AS (
    SELECT
      c.film_id,
      c.profile_vector,
      c.dimensions_json,
      c.tier,
      c.tmdb_keywords,
      -- Mood similarity (always computed)
      (1 - (c.profile_vector <=> query_vector)) AS mood_sim,
      -- User similarity (NULL-safe: 0 if no user vector)
      CASE
        WHEN user_vector IS NULL THEN 0.0
        ELSE (1 - (c.profile_vector <=> user_vector))
      END AS user_sim,
      -- Spam penalty (unchanged from v2)
      CASE
        WHEN c.imdb_votes IS NULL
             AND c.imdb_rating IS NULL
             AND c.film_year >= 2024
             AND c.tier != 'core'
        THEN 0.5
        ELSE 1.0
      END AS trust_factor,
      -- Tier boost (unchanged from v2)
      CASE
        WHEN tier_boost AND c.tier = 'core'     THEN 1.15
        WHEN tier_boost AND c.tier = 'extended' THEN 1.00
        WHEN tier_boost AND c.tier = 'archive'  THEN 0.85
        ELSE 1.0
      END AS tier_multiplier,
      -- Keyword overlap boost (migration 043) — artık yalnız kısa liste için
      CASE
        WHEN search_keywords IS NULL OR cardinality(search_keywords) = 0
             OR c.tmdb_keywords IS NULL OR cardinality(c.tmdb_keywords) = 0
        THEN 0
        ELSE (
          SELECT COUNT(*)::int FROM unnest(search_keywords) sk
          WHERE EXISTS (
            SELECT 1 FROM unnest(c.tmdb_keywords) tk
            WHERE strpos(lower(tk), lower(sk)) > 0
               OR strpos(lower(sk), lower(tk)) > 0
          )
        )
      END AS keyword_match_count
    FROM shortlist c
  ),
  blended AS (
    SELECT
      s.*,
      (mood_weight * s.mood_sim) + (user_weight * s.user_sim) AS blended_sim,
      -- Scaled keyword boost: +0.06 per match, capped at +0.20
      LEAST(s.keyword_match_count * 0.06, 0.20) AS keyword_boost
    FROM scored s
  ),
  boosted AS (
    SELECT
      b.*,
      -- Final score = blended_sim + keyword_boost (additive, not multiplicative)
      (b.blended_sim + b.keyword_boost) * b.tier_multiplier * b.trust_factor AS boosted_similarity,
      (1 - (b.blended_sim + b.keyword_boost)) + (random() * 0.12) AS sort_key,
      (1 - (b.blended_sim + b.keyword_boost)) / (b.tier_multiplier * b.trust_factor) AS adjusted_sort_key
    FROM blended b
    WHERE (min_similarity IS NULL OR b.blended_sim >= min_similarity)
  ),
  oversampled AS (
    SELECT
      b.*,
      f.director AS film_director,
      f.title AS film_title
    FROM boosted b
    JOIN films f ON f.id = b.film_id
    ORDER BY b.adjusted_sort_key
    LIMIT match_count * GREATEST(per_director_cap, 1) * 3
  ),
  ranked AS (
    SELECT
      o.*,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(o.film_director, 'unknown_' || o.film_id::text)
        ORDER BY o.adjusted_sort_key
      ) AS director_rank
    FROM oversampled o
  ),
  capped AS (
    SELECT *
    FROM ranked
    WHERE director_rank <= per_director_cap
       OR per_director_cap <= 0
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
    c.boosted_similarity AS similarity,
    c.dimensions_json,
    c.tier AS curation_tier,
    c.mood_sim AS mood_similarity,
    c.user_sim AS user_similarity,
    -- match_reason: keyword matches first, then fallback to tmdb_keywords
    CASE
      WHEN c.keyword_match_count > 0 THEN
        'Matches: ' || (
          SELECT string_agg(sk, ', ')
          FROM unnest(search_keywords) sk
          WHERE EXISTS (
            SELECT 1 FROM unnest(c.tmdb_keywords) tk
            WHERE strpos(lower(tk), lower(sk)) > 0
               OR strpos(lower(sk), lower(tk)) > 0
          )
        )
      WHEN c.tmdb_keywords IS NOT NULL AND cardinality(c.tmdb_keywords) > 0
      THEN array_to_string(c.tmdb_keywords[1:3], ', ')
      ELSE NULL
    END AS match_reason
  FROM capped c
  JOIN films f ON f.id = c.film_id
  ORDER BY c.adjusted_sort_key
  LIMIT match_count;
$function$;

-- 043'ten kalan 15 argümanlı overload (exclude_archive yok). Yukarıdaki 16 argümanlı
-- sürüm exclude_archive için DEFAULT true taşıdığından eski çağrılar onu çözer.
DROP FUNCTION IF EXISTS public.match_films_v3(
  vector, vector, double precision, double precision, integer, integer, integer,
  double precision, text[], text[], uuid[], double precision, integer, boolean, text[]
);
