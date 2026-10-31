-- ============================================================
-- 137 DRY-RUN (MONEY-1C)
-- TEK islem: BEGIN; <137 tam metni>; <testler>; SELECT sonuclar; ROLLBACK. Kalici degisiklik birakmaz.
-- Sonuclar TEMP TABLE dryrun_results'a yazilir; ROLLBACK'ten once hata mesaji olarak doner.
-- Son satir: test='zz_summary', result='ALL PASS' | 'FAILURES'.
-- Kaynak: supabase/migrations/137_user_daily_quotas_client_write_lock.sql (asagiya AYNEN gomulu).
-- ============================================================
BEGIN;

-- ===================== 137 TAM METNI (baslangic) =====================
-- ============================================================================
-- 137 — user_daily_quotas: istemci yazımı kapanır (MONEY-1C)
--
-- SORUN (migration-guard, 24 Eki 2026; canlıda doğrulandı):
--   021 "Users can insert own quotas" ve "Users can update own quotas"
--   policy'lerini açtı (UPDATE'te WITH CHECK yok, kolon kısıtı yok) ve
--   anon/authenticated tabloda tam INSERT/UPDATE/DELETE GRANT'ı taşıyor.
--   Giriş yapmış herkes PostgREST ile kendi satırına `searches_used = 0` ya da
--   `bonus_searches_earned = 999` yazıp kotayı atlatabiliyordu. 135'in
--   subscription kolonlarında kapattığı açıkla aynı sınıf.
--
-- KANIT (24 Eki 2026, uygulamadan önce):
--   (a) İstemci kodu (app/ services/ hooks/ components/ contexts/ utils/) bu
--       tabloya hiç değmiyor — grep: yalnız supabase/functions/schedule-notifications
--       (service role, SELECT).
--   (b) Tabloya yazan canlı fonksiyonların hepsi SECURITY DEFINER (sahip postgres):
--       check_and_consume_quota, check_and_consume_game_quota, grant_bonus_searches,
--       refund_quota (136), get_quota_status. REVOKE onları etkilemez.
--       SECURITY INVOKER yazıcı yok; tabloya değen view yok; tetikleyici yok.
--   (c) Policy'ler: SELECT (own), INSERT (own), UPDATE (own). DELETE policy'si yok.
--
-- ÇÖZÜM: iki yazma policy'si düşer (+ savunma amaçlı olası DELETE policy'si),
--   anon/authenticated'dan INSERT/UPDATE/DELETE GRANT'ı alınır. SELECT policy'si
--   ve SELECT izni KALIR. service_role ve DEFINER fonksiyonlar etkilenmez.
--
-- NOT (kapsam dışı, dokunulmadı): anon/authenticated'ta TRUNCATE/TRIGGER/REFERENCES
--   GRANT'ı da duruyor (Supabase varsayılanı); PostgREST'ten erişilemez.
--   get_quota_status anon/authenticated/PUBLIC EXECUTE'li bir DEFINER'dır ve
--   bugünün satırını INSERT eder; ama 109'dan gelen kimlik kontrolü
--   (p_user_id IS DISTINCT FROM auth_user_id() -> 42501) yüzünden çağıran yalnız
--   KENDİ satırını, sıfır değerlerle oluşturabilir — kotayı atlatmaya yaramaz.
--   Dry-run T6 bu yolun 137 sonrası çalıştığını doğrular.
--
-- GERİ ALMA: repo dışı kopya (137_rollback.sql) — açığı yeniden açar.
-- UYGULAMA: `supabase db push`.
-- ============================================================================

DROP POLICY IF EXISTS "Users can insert own quotas" ON public.user_daily_quotas;
DROP POLICY IF EXISTS "Users can update own quotas" ON public.user_daily_quotas;
DROP POLICY IF EXISTS "Users can delete own quotas" ON public.user_daily_quotas;

REVOKE INSERT, UPDATE, DELETE ON public.user_daily_quotas FROM anon, authenticated;
-- ===================== 137 TAM METNI (bitis) =====================

CREATE TEMP TABLE dryrun_results (test text, result text, detail text);
GRANT ALL ON dryrun_results TO PUBLIC;

-- -- SETUP (postgres): iki kullanici + bugunun kota satirlari
DO $t$
DECLARE
  v_auth_a text := gen_random_uuid()::text; v_a uuid;
  v_auth_b text := gen_random_uuid()::text; v_b uuid;
BEGIN
  INSERT INTO public.users (auth_id) VALUES (v_auth_a) RETURNING id INTO v_a;
  INSERT INTO public.users (auth_id) VALUES (v_auth_b) RETURNING id INTO v_b;
  INSERT INTO public.user_daily_quotas (user_id, date, searches_used) VALUES (v_a, CURRENT_DATE, 2);
  INSERT INTO public.user_daily_quotas (user_id, date, searches_used) VALUES (v_b, CURRENT_DATE, 1);
  PERFORM set_config('dryrun.auth_a', v_auth_a, true);
  PERFORM set_config('dryrun.a', v_a::text, true);
  PERFORM set_config('dryrun.b', v_b::text, true);
  INSERT INTO dryrun_results VALUES ('00_setup', 'INFO', 'a=' || v_a || ' b=' || v_b);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO dryrun_results VALUES ('00_setup', 'FAIL', SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T1a: authenticated INSERT -> 42501
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', current_setting('dryrun.auth_a'), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', current_setting('dryrun.auth_a'), true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.user_daily_quotas (user_id, date, searches_used) VALUES (current_setting('dryrun.a')::uuid, CURRENT_DATE + 1, 0);
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T1a_auth_insert', 'FAIL', 'INSERT GECTI, 42501 bekleniyordu');
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T1a_auth_insert', 'PASS', '42501');
  END;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T1a_auth_insert', 'FAIL', 'beklenmeyen: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T1b: authenticated UPDATE -> 42501
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', current_setting('dryrun.auth_a'), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', current_setting('dryrun.auth_a'), true);
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE public.user_daily_quotas SET searches_used = 0 WHERE user_id = current_setting('dryrun.a')::uuid;
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T1b_auth_update', 'FAIL', 'UPDATE GECTI, 42501 bekleniyordu');
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T1b_auth_update', 'PASS', '42501');
  END;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T1b_auth_update', 'FAIL', 'beklenmeyen: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T1c: authenticated DELETE -> 42501
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', current_setting('dryrun.auth_a'), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', current_setting('dryrun.auth_a'), true);
  SET LOCAL ROLE authenticated;
  BEGIN
    DELETE FROM public.user_daily_quotas WHERE user_id = current_setting('dryrun.a')::uuid;
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T1c_auth_delete', 'FAIL', 'DELETE GECTI, 42501 bekleniyordu');
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T1c_auth_delete', 'PASS', '42501');
  END;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T1c_auth_delete', 'FAIL', 'beklenmeyen: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T2a: anon INSERT -> 42501
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  SET LOCAL ROLE anon;
  BEGIN
    INSERT INTO public.user_daily_quotas (user_id, date, searches_used) VALUES (current_setting('dryrun.a')::uuid, CURRENT_DATE + 2, 0);
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T2a_anon_insert', 'FAIL', 'INSERT GECTI');
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T2a_anon_insert', 'PASS', '42501');
  END;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T2a_anon_insert', 'FAIL', 'beklenmeyen: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T2b: anon UPDATE -> 42501
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  SET LOCAL ROLE anon;
  BEGIN
    UPDATE public.user_daily_quotas SET searches_used = 0 WHERE user_id = current_setting('dryrun.a')::uuid;
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T2b_anon_update', 'FAIL', 'UPDATE GECTI');
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T2b_anon_update', 'PASS', '42501');
  END;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T2b_anon_update', 'FAIL', 'beklenmeyen: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T2c: anon DELETE -> 42501
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  SET LOCAL ROLE anon;
  BEGIN
    DELETE FROM public.user_daily_quotas WHERE user_id = current_setting('dryrun.a')::uuid;
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T2c_anon_delete', 'FAIL', 'DELETE GECTI');
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T2c_anon_delete', 'PASS', '42501');
  END;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T2c_anon_delete', 'FAIL', 'beklenmeyen: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T3: authenticated SELECT calisir ve YALNIZ kendi satirini gorur (SELECT policy + izni kaldi)
DO $t$
DECLARE v_own int; v_other int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', current_setting('dryrun.auth_a'), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', current_setting('dryrun.auth_a'), true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_own   FROM public.user_daily_quotas WHERE user_id = current_setting('dryrun.a')::uuid;
  SELECT count(*) INTO v_other FROM public.user_daily_quotas WHERE user_id = current_setting('dryrun.b')::uuid;
  RESET ROLE;
  IF v_own = 1 AND v_other = 0 THEN
    INSERT INTO dryrun_results VALUES ('T3_auth_select', 'PASS', 'kendi satiri=1, baskasi=0');
  ELSE
    INSERT INTO dryrun_results VALUES ('T3_auth_select', 'FAIL', 'own=' || v_own || ' other=' || v_other);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T3_auth_select', 'FAIL', 'beklenmeyen: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T3b: anon SELECT hata vermez (izin duruyor), satir gormez
DO $t$
DECLARE v int;
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  SET LOCAL ROLE anon;
  SELECT count(*) INTO v FROM public.user_daily_quotas;
  RESET ROLE;
  IF v = 0 THEN
    INSERT INTO dryrun_results VALUES ('T3b_anon_select', 'PASS', 'hata yok, 0 satir');
  ELSE
    INSERT INTO dryrun_results VALUES ('T3b_anon_select', 'FAIL', 'anon ' || v || ' satir gordu');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T3b_anon_select', 'FAIL', 'beklenmeyen: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T4: service_role -> check_and_consume_quota + refund_quota hala calisir (DEFINER yazici)
DO $t$
DECLARE v_c jsonb; v_r jsonb; v_used int;
BEGIN
  SET LOCAL ROLE service_role;
  v_c := public.check_and_consume_quota(current_setting('dryrun.b')::uuid, 'search');
  v_r := public.refund_quota(current_setting('dryrun.b')::uuid, 'search');
  RESET ROLE;
  SELECT searches_used INTO v_used FROM public.user_daily_quotas WHERE user_id = current_setting('dryrun.b')::uuid AND date = CURRENT_DATE;
  IF (v_c->>'allowed')::boolean AND (v_c->>'used')::int = 2 AND (v_r->>'refunded')::boolean AND v_used = 1 THEN
    INSERT INTO dryrun_results VALUES ('T4_consume_refund', 'PASS', 'consume used=2, refund -> searches_used=1');
  ELSE
    INSERT INTO dryrun_results VALUES ('T4_consume_refund', 'FAIL', 'c=' || v_c || ' r=' || v_r || ' used=' || coalesce(v_used::text, 'NULL'));
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T4_consume_refund', 'FAIL', 'beklenmeyen: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T5: service_role dogrudan yazabilir (Edge yolu); grant_bonus_searches DEFINER calisir
DO $t$
DECLARE v_earned int;
BEGIN
  SET LOCAL ROLE service_role;
  UPDATE public.user_daily_quotas SET searches_used = searches_used WHERE user_id = current_setting('dryrun.b')::uuid;
  PERFORM public.grant_bonus_searches(current_setting('dryrun.b')::uuid, 1, 'dryrun');
  RESET ROLE;
  SELECT bonus_searches_earned INTO v_earned FROM public.user_daily_quotas WHERE user_id = current_setting('dryrun.b')::uuid AND date = CURRENT_DATE;
  IF v_earned >= 1 THEN
    INSERT INTO dryrun_results VALUES ('T5_service_write', 'PASS', 'service_role UPDATE + grant_bonus_searches: bonus_earned=' || v_earned);
  ELSE
    INSERT INTO dryrun_results VALUES ('T5_service_write', 'FAIL', 'earned=' || coalesce(v_earned::text, 'NULL'));
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T5_service_write', 'FAIL', 'beklenmeyen: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T6: authenticated'in cagirabildigi DEFINER get_quota_status (INSERT eden) bozulmadi
DO $t$
DECLARE v_new uuid; v_s jsonb; v_rows int;
BEGIN
  v_new := current_setting('dryrun.a')::uuid;
  DELETE FROM public.user_daily_quotas WHERE user_id = v_new AND date = CURRENT_DATE;  -- postgres: get_quota_status satiri kendi yaratsin
  PERFORM set_config('request.jwt.claims', json_build_object('sub', current_setting('dryrun.auth_a'), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', current_setting('dryrun.auth_a'), true);
  SET LOCAL ROLE authenticated;
  v_s := public.get_quota_status(v_new);
  RESET ROLE;
  SELECT count(*) INTO v_rows FROM public.user_daily_quotas WHERE user_id = v_new AND date = CURRENT_DATE;
  IF v_rows = 1 THEN
    INSERT INTO dryrun_results VALUES ('T6_get_quota_status', 'PASS', 'DEFINER INSERT yolu calisti (satir olustu): ' || left(v_s::text, 80));
  ELSE
    INSERT INTO dryrun_results VALUES ('T6_get_quota_status', 'FAIL', 'satir olusmadi, rows=' || v_rows);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T6_get_quota_status', 'FAIL', 'beklenmeyen: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T7: katalog: yalniz SELECT policy'si; authenticated/anon'da yazma GRANT'i yok, SELECT var
DO $t$
DECLARE v_pol text; v_wr int; v_sel int;
BEGIN
  SELECT string_agg(polname || ':' || polcmd::text, ',' ORDER BY polname) INTO v_pol
    FROM pg_policy WHERE polrelid = 'public.user_daily_quotas'::regclass;
  SELECT count(*) INTO v_wr FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'user_daily_quotas'
      AND grantee IN ('anon', 'authenticated') AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE');
  SELECT count(*) INTO v_sel FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'user_daily_quotas'
      AND grantee IN ('anon', 'authenticated') AND privilege_type = 'SELECT';
  IF v_pol = 'Users can view own quotas:r' AND v_wr = 0 AND v_sel = 2 THEN
    INSERT INTO dryrun_results VALUES ('T7_catalog', 'PASS', 'policy=' || v_pol || ' yazma_grant=0 select_grant=2');
  ELSE
    INSERT INTO dryrun_results VALUES ('T7_catalog', 'FAIL', 'policy=' || coalesce(v_pol, 'NULL') || ' yazma_grant=' || v_wr || ' select_grant=' || v_sel);
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO dryrun_results VALUES ('T7_catalog', 'FAIL', 'beklenmeyen: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

INSERT INTO dryrun_results
SELECT 'zz_summary',
       CASE WHEN count(*) FILTER (WHERE result = 'FAIL') = 0 THEN 'ALL PASS' ELSE 'FAILURES' END,
       count(*) FILTER (WHERE result = 'FAIL') || ' fail / ' || count(*) FILTER (WHERE result = 'PASS') || ' pass'
FROM dryrun_results;

SELECT * FROM dryrun_results ORDER BY test;

DO $$ DECLARE v text; BEGIN
  SELECT string_agg(test || ' | ' || result || ' | ' || coalesce(detail,''), E'\n' ORDER BY test) INTO v
  FROM dryrun_results;
  RAISE EXCEPTION E'DRYRUN_RESULTS\n%', v;
END $$;
ROLLBACK;  -- ikinci emniyet
