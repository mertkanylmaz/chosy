-- ============================================================
-- 121_get_watchlist_grouped_unwatched_only.sql
--
-- B-1 / Fix 6 — gruplu Saved görünümü izlenmiş filmleri göstermesin.
--
-- ─── Sorun ──────────────────────────────────────────────────────────────────
-- "İzlendi"nin tek kaynağı artık watchlist.watched_at. Gauntlet `seen` ve
-- "dün izledin mi?" (loved/ok/abandoned) watchlist'e watched_at DOLU satır
-- açıyor (_shared/gauntletCore.ts markWatched). Bu RPC'nin gövdesinde
-- watched_at filtresi yoktu (100_get_watchlist_grouped_authz.sql:92) — kullanıcı
-- izlediği filmi Saved'in gruplu görünümünde görüyordu.
--
-- ─── Değişiklik ─────────────────────────────────────────────────────────────
-- 1. `AND w.watched_at IS NULL`. Gövdenin geri kalanı 100 ile birebir
--    (canlı prosrc 2 Eki 2026'da 100 ile karşılaştırıldı — aynı).
-- 2. SECURITY DEFINER → SECURITY INVOKER (CTO onayı, Fix 6 karar 5-B).
--    Okunan dört tablonun da sahip-okuma politikası var (ölçüldü 2 Eki 2026):
--      watchlist "owner read" · sessions "owner read" · users "self read"
--      · films "public read" (true)
--    Bu yüzden RLS altında sonuç DEFINER ile aynı. Ek kazanç: başka
--    kullanıcının session'ına işaret eden bir satırın prompt'u artık okunamaz.
--    Gövde içi yetki kontrolü (100) KALIR — INVOKER'da RLS ikinci katman,
--    birincisi değil; yabancı p_user_id yine 42501 alır, boş liste değil.
--
-- watched_source'a göre ayrı dal YOK, bilinçli:
--   gauntlet_feedback / local_sync / manual → markWatched, watchSync ve
--   toggleWatched her yazımda watched_at'i doldurur → filtre hepsini eler.
--   NULL kaynak + dolu watched_at (072 öncesi) → elenir, doğru.
--   Unwatch (Fix 6 karar 4) watched_at + watched_source'u birlikte NULL'lar
--   → satır Saved'e döner, doğru.
--
-- ─── Bu migration'ın YAPMADIKLARI ───────────────────────────────────────────
-- - İmza aynı: get_watchlist_grouped(p_user_id UUID) RETURNS JSONB,
--   plpgsql, VOLATILE, search_path=public. Çağıran (services/watchlist.ts)
--   değişmiyor.
-- - Gövde içi authz (100) değişmedi.
-- - Yetkiler: CREATE OR REPLACE mevcut ACL'yi korur; aşağıdaki REVOKE/GRANT
--   100'ün durumunu idempotent olarak yeniden beyan eder (davranış değişmez).
-- ============================================================

CREATE OR REPLACE FUNCTION get_watchlist_grouped(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- ─── Yetki kontrolü ───────────────────────────────────────────────────────
  -- 100'de DEFINER'dı ve tek katman buydu. INVOKER'da RLS de filtreler, ama
  -- yabancı kimlik sessizce boş liste değil açık 42501 almalı — kontrol kalır.
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
      -- Fix 6: Saved = kaydedilmiş ve henüz izlenmemiş. İzlenenler Profil
      -- "Watched" sayacında (watchlist.watched_at IS NOT NULL).
      AND w.watched_at IS NULL
    GROUP BY w.added_from_session, s.raw_input
  ) sub;

  RETURN v_result;
END;
$$;

-- 100'ün yetki durumu — değişmiyor, idempotent yeniden beyan.
REVOKE EXECUTE ON FUNCTION get_watchlist_grouped(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_watchlist_grouped(UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION get_watchlist_grouped(UUID) TO authenticated;

-- ─── DOĞRULAMA (push sonrası) ───────────────────────────────────────────────
-- select oid::regprocedure, prosecdef, proacl,
--        has_function_privilege('anon', oid, 'EXECUTE') as anon_exec,
--        position('watched_at IS NULL' in prosrc) > 0 as filtered
--   from pg_proc where proname = 'get_watchlist_grouped';
--   → prosecdef=false, anon_exec=false, filtered=true,
--     proacl = {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}

-- ─── DOWN SCRIPT (elle) ─────────────────────────────────────────────────────
-- 100_get_watchlist_grouped_authz.sql'deki CREATE OR REPLACE gövdesini
-- yeniden çalıştırmak (filtre satırı olmadan, SECURITY DEFINER ile).
-- Yetki satırları aynı kalır.
-- ============================================================
