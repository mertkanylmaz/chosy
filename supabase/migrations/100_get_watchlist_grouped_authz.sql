-- ============================================================
-- 100_get_watchlist_grouped_authz.sql
--
-- P0 — get_watchlist_grouped SECURITY DEFINER yetki açığı (E-10).
-- E-09'un (099) devamı: 099 watchlist tablosundaki permissive policy'leri
-- kaldırdı, ama bu fonksiyon RLS'i tamamen bypass ettiği için aynı veri
-- ikinci bir yoldan hâlâ dışarı açıktı.
--
-- ─── Kök neden ──────────────────────────────────────────────────────────────
-- 011_watchlist_session_rpc.sql:13-57 fonksiyonu iki hatayı birlikte taşıyor:
--
--   1. SECURITY DEFINER + `WHERE w.user_id = p_user_id` — filtrelenen kimlik
--      ÇAĞIRANIN kimliği değil, ÇAĞIRANIN VERDİĞİ kimlik. Definer hakkıyla
--      çalıştığı için watchlist RLS'i hiç devreye girmez.
--   2. Hiçbir migration'da REVOKE/GRANT yok → Postgres varsayılanı
--      `EXECUTE TO PUBLIC` yürürlükte. (096_default_privileges_close_public
--      yalnızca tablo/view kapsıyor, fonksiyonlara dokunmuyor.)
--
-- Sonuç: herhangi biri get_watchlist_grouped(<yabancı_user_id>) çağırıp o
-- kullanıcının watchlist'ini okuyabilirdi. 099 ile kapatılan sızıntının
-- (312 satır / 27 benzersiz user_id) yolu değişmiş hali.
--
-- ─── p_user_id ≠ auth.uid() ─────────────────────────────────────────────────
-- Bu projede iki ayrı kimlik var ve karıştırılırsa düzeltme akışı kırar:
--   auth.uid()  → public.users.auth_id  (TEXT, 001_initial_schema.sql:16)
--   p_user_id   → public.users.id       (UUID, services/auth-utils.ts:132)
-- Bu yüzden kontrol doğrudan auth.uid() karşılaştırması DEĞİL; 083'ün owner
-- policy'sindeki eşleme deseninin aynısı kullanılır.
--
-- ─── İki katman (biri yetmez) ───────────────────────────────────────────────
--   a. Gövde içi authz — SECURITY DEFINER olduğu için RLS'e güvenilemez.
--   b. REVOKE EXECUTE FROM PUBLIC — defense in depth; anon rolü fonksiyonu
--      hiç çağıramaz, gövdeye ulaşmadan reddedilir.
--
-- ─── Bu migration'ın YAPMADIKLARI (bilinçli) ────────────────────────────────
-- - İmza değişmedi: ad, p_user_id parametresi ve RETURNS JSONB aynı.
--   Çağıran kod (services/watchlist.ts:375) değişmiyor.
-- - Sorgu gövdesi (SELECT/JOIN/jsonb_build_object) birebir korundu.
-- - Diğer RPC'lere dokunulmadı — şema geneli SECURITY DEFINER taraması
--   ayrı bir iş.
-- ============================================================

CREATE OR REPLACE FUNCTION get_watchlist_grouped(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- ─── Yetki kontrolü ───────────────────────────────────────────────────────
  -- SECURITY DEFINER RLS'i bypass eder; sahiplik burada doğrulanmak ZORUNDA.
  -- IS DISTINCT FROM: eşleşen users satırı yoksa (oturumsuz/orphan auth)
  -- alt sorgu NULL döner ve `!=` NULL üretip kontrolü sessizce atlatırdı.
  IF p_user_id IS DISTINCT FROM (
    SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1
  ) THEN
    RAISE EXCEPTION 'get_watchlist_grouped: yetkisiz erisim'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(grp ORDER BY (grp->>'last_added') DESC), '[]'::JSONB)
  INTO v_result
  FROM (
    SELECT
      jsonb_build_object(
        'session_id',  w.added_from_session,
        'prompt',      s.raw_input,
        'last_added',  MAX(w.created_at),
        'film_count',  COUNT(w.id),
        'films',       jsonb_agg(
          jsonb_build_object(
            'watchlist_id',  w.id,
            'added_at',      w.created_at,
            'match_score',   w.match_score,
            'film_id',       f.id,
            'title',         f.title,
            'year',          f.year,
            'poster_url',    f.poster_url,
            'backdrop_url',  f.backdrop_url,
            'overview',      f.overview,
            'runtime',       f.runtime,
            'vote_average',  f.vote_average,
            'genres',        f.genres
          ) ORDER BY w.created_at DESC
        )
      ) AS grp
    FROM watchlist w
    LEFT JOIN sessions s ON s.id = w.added_from_session
    JOIN films f ON f.id = w.film_id
    WHERE w.user_id = p_user_id
    GROUP BY w.added_from_session, s.raw_input
  ) sub;

  RETURN v_result;
END;
$$;

-- ─── Katman b: EXECUTE yetkisi ──────────────────────────────────────────────
-- PUBLIC varsayılanı çekilir; yalnızca authenticated çağırabilir.
-- anon açıkça REVOKE edilir (PUBLIC üzerinden dolaylı yetki almasın).
REVOKE EXECUTE ON FUNCTION get_watchlist_grouped(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_watchlist_grouped(UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION get_watchlist_grouped(UUID) TO authenticated;

-- ─── DOĞRULAMA (push sonrası) ───────────────────────────────────────────────
-- select proname, prosecdef, proacl from pg_proc
--   where proname = 'get_watchlist_grouped';
--   → proacl içinde authenticated=X olmalı, PUBLIC (=X/ önü boş girdi) OLMAMALI
--
-- Senaryo 1 (anon key, oturumsuz):      → 42501 / permission denied
-- Senaryo 2 (authenticated, yabancı ID): → 42501 yetkisiz erisim
-- Senaryo 3 (authenticated, kendi ID):   → normal veri (regresyon yok)

-- ─── DOWN SCRIPT ────────────────────────────────────────────────────────────
-- YOK — bilinçli. Geri alma, kapatılan P0 açığını aynen yeniden açmak demek.
-- Gerekirse sebebi ayrıca incelenir; kör rollback buraya YAZILMAZ.
-- ============================================================
