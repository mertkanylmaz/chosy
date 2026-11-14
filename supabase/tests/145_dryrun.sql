-- ============================================================
-- 145 DRY-RUN (güvenlik P0) — görünümler + grant_streak_rewards + search_path
-- TEK işlem: BEGIN; <145 tam metni>; <testler>; RAISE EXCEPTION 'DRYRUN_RESULTS ...'; (işlem düşer = ROLLBACK).
-- Kalıcı değişiklik bırakmaz. Her test dryrun_results'a PASS/FAIL yazar; sonuç istisna mesajında döner.
-- DURUM: 14 Kas 2026 — YAZILDI, HENÜZ KOŞULMADI (Adım 2 onayı bekliyor).
-- ============================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TEMP TABLE dryrun_results (test text, result text, detail text);
GRANT ALL ON dryrun_results TO PUBLIC;

-- Öncesi: anon'un görebildiği satır sayıları (açığın kanıtı; migration sonrası 42501 beklenir)
CREATE TEMP TABLE before_counts AS
SELECT (SELECT count(*) FROM public.mood_history) AS mood_history_total,
       (SELECT count(*) FROM public.user_stats) AS user_stats_total,
       (SELECT count(*) FROM public.public_daily_puzzles) AS pdp_total;
GRANT ALL ON before_counts TO PUBLIC;

-- ===================== 145 TAM METNİ (başlangıç) =====================
ALTER VIEW public.mood_history SET (security_invoker = true);
REVOKE ALL ON public.mood_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.mood_history TO authenticated;

ALTER VIEW public.user_stats SET (security_invoker = true);
REVOKE ALL ON public.user_stats FROM PUBLIC, anon, authenticated;

ALTER VIEW public.v_posterle_daily_stats SET (security_invoker = true);
REVOKE ALL ON public.v_posterle_daily_stats FROM PUBLIC, anon, authenticated;

REVOKE ALL ON public.public_daily_puzzles FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, game_id, puzzle_date) ON public.public_daily_puzzles TO authenticated;

REVOKE EXECUTE ON FUNCTION public.grant_streak_rewards(uuid, integer) FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.activate_referral(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.grant_bonus_searches(uuid, integer, text) SET search_path = public, pg_temp;
-- ===================== 145 TAM METNİ (bitiş) =====================

-- Yardımcı: verilen rolde bir sorguyu çalıştırır; 'OK:<n>' ya da 'ERR:<sqlstate>' döner.
CREATE FUNCTION pg_temp.try_as(p_role text, p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_n bigint;
BEGIN
  EXECUTE format('SET LOCAL ROLE %I', p_role);
  BEGIN
    EXECUTE p_sql INTO v_n;
    RESET ROLE;
    RETURN 'OK:' || COALESCE(v_n::text, 'null');
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    RETURN 'ERR:' || SQLSTATE;
  END;
END $$;

DO $$
DECLARE
  r text;
  v_auth_id text;
  v_user_id uuid;
  v_own bigint;
  v_seen bigint;
  v_foreign bigint;
BEGIN
  -- T1–T4: anon dört görünümü de okuyamaz
  r := pg_temp.try_as('anon', 'select count(*) from public.mood_history');
  INSERT INTO dryrun_results VALUES ('T1 anon mood_history', CASE WHEN r = 'ERR:42501' THEN 'PASS' ELSE 'FAIL' END, r);
  r := pg_temp.try_as('anon', 'select count(*) from public.user_stats');
  INSERT INTO dryrun_results VALUES ('T2 anon user_stats', CASE WHEN r = 'ERR:42501' THEN 'PASS' ELSE 'FAIL' END, r);
  r := pg_temp.try_as('anon', 'select count(*) from public.v_posterle_daily_stats');
  INSERT INTO dryrun_results VALUES ('T3 anon v_posterle_daily_stats', CASE WHEN r = 'ERR:42501' THEN 'PASS' ELSE 'FAIL' END, r);
  r := pg_temp.try_as('anon', 'select count(*) from public.public_daily_puzzles');
  INSERT INTO dryrun_results VALUES ('T4 anon public_daily_puzzles', CASE WHEN r = 'ERR:42501' THEN 'PASS' ELSE 'FAIL' END, r);

  -- T5–T6: authenticated user_stats / v_posterle okuyamaz
  r := pg_temp.try_as('authenticated', 'select count(*) from public.user_stats');
  INSERT INTO dryrun_results VALUES ('T5 authenticated user_stats', CASE WHEN r = 'ERR:42501' THEN 'PASS' ELSE 'FAIL' END, r);
  r := pg_temp.try_as('authenticated', 'select count(*) from public.v_posterle_daily_stats');
  INSERT INTO dryrun_results VALUES ('T6 authenticated v_posterle_daily_stats', CASE WHEN r = 'ERR:42501' THEN 'PASS' ELSE 'FAIL' END, r);

  -- T7: authenticated, JWT'siz → mood_history 0 satır (RLS; hata değil)
  PERFORM set_config('request.jwt.claims', NULL, true);
  r := pg_temp.try_as('authenticated', 'select count(*) from public.mood_history');
  INSERT INTO dryrun_results VALUES ('T7 authenticated (JWT yok) mood_history = 0', CASE WHEN r = 'OK:0' THEN 'PASS' ELSE 'FAIL' END, r);

  -- T8: gerçek bir kullanıcının JWT'siyle mood_history yalnız KENDİ satırlarını döner
  --     (eski MoodSearchScreen "son aramalar" akışının bozulmadığının kanıtı)
  SELECT u.auth_id, u.id, count(*) INTO v_auth_id, v_user_id, v_own
    FROM public.sessions s JOIN public.users u ON u.id = s.user_id
   GROUP BY u.auth_id, u.id ORDER BY count(*) DESC LIMIT 1;
  IF v_auth_id IS NULL THEN
    INSERT INTO dryrun_results VALUES ('T8 sahibi mood_history', 'SKIP', 'sessions boş');
  ELSE
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_auth_id, 'role', 'authenticated')::text, true);
    r := pg_temp.try_as('authenticated', 'select count(*) from public.mood_history');
    v_seen := NULLIF(split_part(r, ':', 2), '')::bigint;
    r := pg_temp.try_as('authenticated',
      format('select count(*) from public.mood_history where user_id <> %L', v_user_id));
    v_foreign := NULLIF(split_part(r, ':', 2), '')::bigint;
    INSERT INTO dryrun_results VALUES ('T8 sahibi mood_history: kendi satırları, başkası yok',
      CASE WHEN v_seen = v_own AND v_foreign = 0 THEN 'PASS' ELSE 'FAIL' END,
      format('own=%s seen=%s foreign=%s total_before=%s', v_own, v_seen, v_foreign,
             (SELECT mood_history_total FROM before_counts)));
    PERFORM set_config('request.jwt.claims', NULL, true);
  END IF;

  -- T9: PlayNextBridge sorgusu (id, game_id + puzzle_date süzgeci) authenticated ile çalışır
  r := pg_temp.try_as('authenticated',
    'select count(*) from (select id, game_id from public.public_daily_puzzles where puzzle_date = current_date) q');
  INSERT INTO dryrun_results VALUES ('T9 authenticated PlayNextBridge sorgusu', CASE WHEN r LIKE 'OK:%' THEN 'PASS' ELSE 'FAIL' END, r);

  -- T10: authenticated puzzle_data okuyamaz (ipuçları / gelecek bulmacalar kapalı)
  r := pg_temp.try_as('authenticated', 'select count(puzzle_data) from public.public_daily_puzzles');
  INSERT INTO dryrun_results VALUES ('T10 authenticated puzzle_data', CASE WHEN r = 'ERR:42501' THEN 'PASS' ELSE 'FAIL' END, r);

  -- T11: get-daily-challenge yolu — service_role `select *` ile TÜM satırları okur (öncesiyle aynı sayı)
  r := pg_temp.try_as('service_role', 'select count(*) from (select * from public.public_daily_puzzles) q');
  INSERT INTO dryrun_results VALUES ('T11 service_role public_daily_puzzles select *',
    CASE WHEN r = 'OK:' || (SELECT pdp_total FROM before_counts) THEN 'PASS' ELSE 'FAIL' END,
    r || ' beklenen=' || (SELECT pdp_total FROM before_counts));

  -- T12: service_role bugünün spotlight bulmacasını puzzle_data ile okur (get-daily-challenge sorgusu)
  r := pg_temp.try_as('service_role',
    $q$select count(*) from public.public_daily_puzzles where game_id = 'spotlight' and puzzle_date = current_date and puzzle_data is not null$q$);
  INSERT INTO dryrun_results VALUES ('T12 service_role bugünün spotlight satırı', CASE WHEN r LIKE 'OK:%' THEN 'PASS' ELSE 'FAIL' END, r);

  -- T13–T14: grant_streak_rewards anon / authenticated çağıramaz
  r := pg_temp.try_as('anon', $q$select 1 from public.grant_streak_rewards('00000000-0000-0000-0000-000000000000'::uuid, 100)$q$);
  INSERT INTO dryrun_results VALUES ('T13 anon grant_streak_rewards', CASE WHEN r = 'ERR:42501' THEN 'PASS' ELSE 'FAIL' END, r);
  r := pg_temp.try_as('authenticated', $q$select 1 from public.grant_streak_rewards('00000000-0000-0000-0000-000000000000'::uuid, 100)$q$);
  INSERT INTO dryrun_results VALUES ('T14 authenticated grant_streak_rewards', CASE WHEN r = 'ERR:42501' THEN 'PASS' ELSE 'FAIL' END, r);

  -- T15: yetki tablosu — service_role EXECUTE korur; PUBLIC kapalı
  INSERT INTO dryrun_results
  SELECT 'T15 grant_streak_rewards ACL',
         CASE WHEN NOT has_function_privilege('anon', p.oid, 'execute')
               AND NOT has_function_privilege('authenticated', p.oid, 'execute')
               AND has_function_privilege('service_role', p.oid, 'execute')
              THEN 'PASS' ELSE 'FAIL' END,
         p.proacl::text
    FROM pg_proc p WHERE p.oid = 'public.grant_streak_rewards(uuid,integer)'::regprocedure;

  -- T16: görünüm seçenekleri
  INSERT INTO dryrun_results
  SELECT 'T16 reloptions',
         CASE WHEN bool_and(CASE WHEN c.relname = 'public_daily_puzzles'
                                 THEN c.reloptions IS NULL
                                 ELSE c.reloptions @> ARRAY['security_invoker=true'] END)
              THEN 'PASS' ELSE 'FAIL' END,
         string_agg(c.relname || '=' || COALESCE(c.reloptions::text, 'NULL'), ' ')
    FROM pg_class c
   WHERE c.relnamespace = 'public'::regnamespace
     AND c.relname IN ('mood_history', 'user_stats', 'v_posterle_daily_stats', 'public_daily_puzzles');

  -- T17: search_path sabitlendi
  INSERT INTO dryrun_results
  SELECT 'T17 search_path',
         CASE WHEN bool_and(p.proconfig @> ARRAY['search_path=public, pg_temp']) THEN 'PASS' ELSE 'FAIL' END,
         string_agg(p.proname || '=' || COALESCE(p.proconfig::text, 'NULL'), ' ')
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('activate_referral', 'grant_bonus_searches');

  -- T18: activate_referral sabit search_path ile gövdesini çözebiliyor (bekleyen referral yok → NO_PENDING_REFERRAL)
  r := pg_temp.try_as('service_role',
    $q$select count(*) from (select public.activate_referral('00000000-0000-0000-0000-000000000000'::uuid) j) q where j->>'error' = 'NO_PENDING_REFERRAL'$q$);
  INSERT INTO dryrun_results VALUES ('T18 activate_referral çalışır', CASE WHEN r = 'OK:1' THEN 'PASS' ELSE 'FAIL' END, r);
END $$;

DO $$
DECLARE v text;
BEGIN
  SELECT string_agg(test || ' => ' || result || ' [' || COALESCE(detail, '') || ']', E'\n' ORDER BY test) INTO v FROM dryrun_results;
  RAISE EXCEPTION E'DRYRUN_RESULTS (%/% PASS)\n%',
    (SELECT count(*) FROM dryrun_results WHERE result = 'PASS'), (SELECT count(*) FROM dryrun_results), v;
END $$;

ROLLBACK;
