-- social_daily_lineup(): günün (UTC) editoryal dörtlüsü, chosy-social video hattı için.
-- SECURITY DEFINER: editorial_calendar_* tabloları yalnız service_role. Parametresiz ve yalnız
-- BUGÜN döner, gelecek günler sızamaz. Takvim dışı gün -> NULL. Gün anahtarı generate-gauntlet
-- ile aynı (UTC); M2 Faz 2b'de birlikte güncellenir.

CREATE OR REPLACE FUNCTION public.social_daily_lineup()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH today AS (
    SELECT (now() AT TIME ZONE 'utc')::date AS d
  ),
  launch AS (
    SELECT (value #>> '{}')::date AS d FROM public.app_config WHERE key = 'launch_date'
  ),
  day AS (
    SELECT t.d AS date, (t.d - l.d) + 1 AS n FROM today t CROSS JOIN launch l
  )
  SELECT jsonb_build_object(
    'date', day.date,
    'day_number', day.n,
    'theme', cd.theme,
    'films', (
      SELECT jsonb_agg(jsonb_build_object(
               'position', cf.position, 'title', f.title, 'year', f.year,
               'director', f.director, 'poster_url', f.poster_url,
               'dominant_color', f.dominant_color) ORDER BY cf.position)
      FROM public.editorial_calendar_films cf
      JOIN public.films f ON f.id = cf.film_id
      WHERE cf.day_number = day.n AND cf.position BETWEEN 1 AND 4
    )
  )
  FROM day
  JOIN public.editorial_calendar_days cd ON cd.day_number = day.n;
$$;

COMMENT ON FUNCTION public.social_daily_lineup() IS
  'chosy-social icin bugunun (UTC) editoryal dortlusu. Yalniz public alanlar, yalniz bugun. Takvim disi gun -> NULL.';

REVOKE EXECUTE ON FUNCTION public.social_daily_lineup() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.social_daily_lineup() TO anon, authenticated;
