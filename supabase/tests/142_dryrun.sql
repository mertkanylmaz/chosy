-- ============================================================
-- 142 DRY-RUN (MONEY-1C) — increment_promo_usage EXECUTE daraltma + claim_lifetime_spot search_path
-- TEK islem: BEGIN; <142 tam metni>; <testler>; RAISE EXCEPTION 'DRYRUN_RESULTS ...'; ROLLBACK. Kalici degisiklik birakmaz.
-- claim_lifetime_spot'un TAM yolu (nextval + INSERT + UPDATE users/subscriptions) test edilir. nextval sayaci islemle geri
-- alinmaz (sequence), bu yuzden gercek `lifetime_sale_number` GECICI olarak yeniden adlandirilip yerine islem-ici bir sequence
-- konur (DDL islemseldir; ROLLBACK ile gercek sequence aynen geri gelir, SAYAC TUKETILMEZ).
-- DURUM: 25 Eki 2026 canli DBye karsi (BEGIN...RAISE, kalici degisiklik yok) kosuldu: 5/5 PASS; kosu sonrasi durum oncesiyle ayni.
-- ============================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TEMP TABLE dryrun_results (test text, result text, detail text);
GRANT ALL ON dryrun_results TO PUBLIC;
CREATE TEMP TABLE fn_before AS
SELECT p.proname, p.oid::regprocedure::text AS sig, p.proacl::text AS acl, p.prosecdef, p.proconfig::text AS cfg, pg_get_userbyid(p.proowner) AS owner
FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('increment_promo_usage', 'claim_lifetime_spot', 'activate_referral');
GRANT ALL ON fn_before TO PUBLIC;
CREATE TEMP TABLE seq_before AS SELECT last_value AS lv, is_called FROM public.lifetime_sale_number;

-- ===================== 142 TAM METNI (baslangic) =====================
-- ============================================================================
-- 142 — increment_promo_usage EXECUTE daraltma + claim_lifetime_spot search_path (MONEY-1C)
--
-- BULGU (25 Eki, canlı): `increment_promo_usage(p_code text)` SECURITY DEFINER ve EXECUTE yetkisi PUBLIC,
-- anon ve authenticated'da açık (ACL `=X/postgres, anon, authenticated, ...`). Kimliksiz bile herkes
-- herhangi bir promo kodunun `current_uses` sayacını artırıp kodu tüketebilir (doğrulama yok).
-- `claim_lifetime_spot` SECURITY DEFINER ama `search_path` sabit değil (109 deseni: `SET search_path = ''`).
--
-- ÖN KOŞUL TARAMASI (25 Eki): 2.1.0 / 2.1.1 / 2.1.2 / 2.1.3 istemci kodu ve TÜM Edge Function'larda
--   · increment_promo_usage: HİÇ çağrı yok (rpc veya doğrudan SQL) → revoke güvenli.
--   · claim_lifetime_spot: yalnız process-lifetime-purchase ve revenuecat-webhook çağırır, ikisi de
--     service_role istemcisiyle (`createClient(url, SERVICE_ROLE_KEY)`); ayrıca DB içinden activate_referral
--     (SECURITY DEFINER, sahip postgres). authenticated/anon JWT'siyle çağıran YOK. EXECUTE zaten yalnız
--     postgres + service_role (135).
--
-- claim_lifetime_spot: `SET search_path = ''` YALNIZ ALTER ile verilemez — gövde nitelenmemiş adlar kullanıyor
-- (lifetime_sales, users, subscriptions, lifetime_sale_number, auth_user_id). Bu yüzden fonksiyon AYNI imza ve
-- AYNI davranışla yeniden tanımlanır; tek fark: tüm adlar `public.` ile nitelenir. İmza, dönüş, mantık,
-- sahip ve ACL değişmez (CREATE OR REPLACE ACL'i korur).
--
-- GERİ ALMA: repo dışı kopya (142_rollback.sql) — EXECUTE'u geri verir, eski gövdeyi (search_path'siz) kurar.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.increment_promo_usage(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_promo_usage(text) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_lifetime_spot(
  p_user_id uuid,
  p_price numeric DEFAULT 89.99,
  p_rc_transaction_id text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_count INT;
  v_number INT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND p_user_id IS DISTINCT FROM public.auth_user_id() THEN
    RAISE EXCEPTION 'FORBIDDEN: kullanıcı kimliği eşleşmiyor'
      USING ERRCODE = '42501';
  END IF;

  -- Atomic count check
  SELECT COUNT(*) INTO v_count FROM public.lifetime_sales;
  IF v_count >= 1000 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'SOLD_OUT',
      'sold', v_count
    );
  END IF;

  -- Check if user already has lifetime
  IF EXISTS (SELECT 1 FROM public.lifetime_sales WHERE user_id = p_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ALREADY_LIFETIME'
    );
  END IF;

  -- Get next number atomically
  SELECT nextval('public.lifetime_sale_number') INTO v_number;

  -- Insert sale record
  INSERT INTO public.lifetime_sales (user_id, sale_number, price_paid, rc_transaction_id)
    VALUES (p_user_id, v_number, p_price, p_rc_transaction_id);

  -- Update user subscription tier
  UPDATE public.users
  SET subscription_tier = 'lifetime'
  WHERE id = p_user_id;

  -- Update subscriptions table if exists
  UPDATE public.subscriptions
  SET plan = 'lifetime', status = 'active', expires_at = NULL
  WHERE user_id = p_user_id
    AND status IN ('active', 'trial');

  RETURN jsonb_build_object(
    'success', true,
    'sale_number', v_number,
    'total_sold', v_count + 1
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ALREADY_LIFETIME'
    );
END
$function$;

-- ===================== 142 TAM METNI (bitis) =====================

-- T1: increment_promo_usage — PUBLIC, anon, authenticated EXECUTE YOK; service_role VAR
DO $t$
DECLARE o oid := to_regprocedure('public.increment_promo_usage(text)'); pub boolean; bad text := '';
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a WHERE p.oid = o AND a.grantee = 0 AND a.privilege_type = 'EXECUTE') INTO pub;
  IF pub THEN bad := bad || ' PUBLIC'; END IF;
  IF has_function_privilege('anon', o, 'EXECUTE') THEN bad := bad || ' anon'; END IF;
  IF has_function_privilege('authenticated', o, 'EXECUTE') THEN bad := bad || ' authenticated'; END IF;
  IF NOT has_function_privilege('service_role', o, 'EXECUTE') THEN bad := bad || ' -service_role'; END IF;
  INSERT INTO dryrun_results VALUES ('T1', CASE WHEN bad = '' THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN bad = '' THEN 'PUBLIC/anon/authenticated EXECUTE kalkti; service_role duruyor' ELSE 'sorun:' || bad END);
END $t$;

-- T2: claim_lifetime_spot — DEFINER, search_path="" , sahip ve ACL AYNI, imza AYNI; activate_referral dokunulmadi
DO $t$
DECLARE b record; a record; bad text := '';
BEGIN
  SELECT * INTO b FROM fn_before WHERE proname = 'claim_lifetime_spot';
  SELECT p.oid::regprocedure::text AS sig, p.proacl::text AS acl, p.prosecdef,
         (SELECT string_agg(c, ',') FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%') AS cfg, pg_get_userbyid(p.proowner) AS owner
    INTO a FROM pg_proc p WHERE p.oid = to_regprocedure('public.claim_lifetime_spot(uuid,numeric,text)');
  IF a.sig IS DISTINCT FROM b.sig THEN bad := bad || ' imza'; END IF;
  IF a.acl IS DISTINCT FROM b.acl THEN bad := bad || ' acl(' || coalesce(b.acl,'-') || '->' || coalesce(a.acl,'-') || ')'; END IF;
  IF a.owner IS DISTINCT FROM b.owner THEN bad := bad || ' owner'; END IF;
  IF NOT a.prosecdef THEN bad := bad || ' not_definer'; END IF;
  IF a.cfg IS DISTINCT FROM 'search_path=""' THEN bad := bad || ' search_path(' || coalesce(a.cfg,'NULL') || ')'; END IF;
  IF has_function_privilege('anon', to_regprocedure('public.claim_lifetime_spot(uuid,numeric,text)'), 'EXECUTE')
     OR has_function_privilege('authenticated', to_regprocedure('public.claim_lifetime_spot(uuid,numeric,text)'), 'EXECUTE') THEN
    bad := bad || ' istemci_execute_var';
  END IF;
  IF EXISTS (SELECT 1 FROM fn_before f JOIN pg_proc p ON p.proname = f.proname AND p.pronamespace = 'public'::regnamespace
              WHERE f.proname = 'activate_referral' AND p.proacl::text IS DISTINCT FROM f.acl) THEN bad := bad || ' activate_referral_degisti'; END IF;
  INSERT INTO dryrun_results VALUES ('T2', CASE WHEN bad = '' THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN bad = '' THEN 'DEFINER, search_path="", imza/sahip/ACL ayni' ELSE 'sorun:' || bad END);
END $t$;

-- T3: increment_promo_usage fiili: service_role calisir (olmayan kod, 0 satir); authenticated ve anon 42501
DO $t$
DECLARE v_fail text := '';
BEGIN
  SET LOCAL ROLE service_role;
  BEGIN PERFORM public.increment_promo_usage('__dryrun_nonexistent_code__');
  EXCEPTION WHEN OTHERS THEN v_fail := v_fail || ' service_role:' || SQLERRM; END;
  RESET ROLE;
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.increment_promo_usage('__dryrun_nonexistent_code__'); v_fail := v_fail || ' authenticated_ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN NULL; WHEN OTHERS THEN v_fail := v_fail || ' authenticated_other(' || SQLSTATE || ')'; END;
  RESET ROLE;
  SET LOCAL ROLE anon;
  BEGIN PERFORM public.increment_promo_usage('__dryrun_nonexistent_code__'); v_fail := v_fail || ' anon_ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN NULL; WHEN OTHERS THEN v_fail := v_fail || ' anon_other(' || SQLSTATE || ')'; END;
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T3', CASE WHEN v_fail = '' THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN v_fail = '' THEN 'service_role cagirir; authenticated ve anon 42501' ELSE 'sorun:' || v_fail END);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T3', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END $t$;

-- T4: claim_lifetime_spot TAM yol search_path="" ile (nextval + INSERT + UPDATE users + UPDATE subscriptions).
-- Gercek sequence islem-ici bir sequence ile gecici degistirilir (ROLLBACK ile geri gelir; sayac tuketilmez).
DO $t$
DECLARE
  u1 uuid; u2 uuid; r1 jsonb; r2 jsonb; r3 jsonb; v_tier text; v_plan text; v_status text; v_sales int; v_fail text := '';
  v_sub_ok boolean := true; v_sold_before int;
BEGIN
  ALTER SEQUENCE public.lifetime_sale_number RENAME TO lifetime_sale_number__dryrun_orig;
  CREATE SEQUENCE public.lifetime_sale_number START 501;
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  INSERT INTO public.users (auth_id) VALUES (gen_random_uuid()::text) RETURNING id INTO u1;
  INSERT INTO public.users (auth_id) VALUES (gen_random_uuid()::text) RETURNING id INTO u2;
  BEGIN
    INSERT INTO public.subscriptions (user_id, status, plan) VALUES (u1, 'active', 'monthly');
  EXCEPTION WHEN OTHERS THEN v_sub_ok := false; END;
  SELECT count(*) INTO v_sold_before FROM public.lifetime_sales;
  SET LOCAL ROLE service_role;
  r1 := public.claim_lifetime_spot(u1, 89.99, 'dryrun-tx-1');
  r2 := public.claim_lifetime_spot(u1, 89.99, 'dryrun-tx-1');
  r3 := public.claim_lifetime_spot(u2, 0, 'referral_reward');
  RESET ROLE;
  SELECT subscription_tier INTO v_tier FROM public.users WHERE id = u1;
  SELECT count(*) INTO v_sales FROM public.lifetime_sales WHERE user_id IN (u1, u2);
  IF v_sub_ok THEN SELECT plan, status INTO v_plan, v_status FROM public.subscriptions WHERE user_id = u1; END IF;
  IF NOT (r1->>'success')::boolean OR (r1->>'sale_number')::int <> 501 OR (r1->>'total_sold')::int <> v_sold_before + 1 THEN v_fail := v_fail || ' r1=' || r1; END IF;
  IF (r2->>'success')::boolean OR r2->>'error' IS DISTINCT FROM 'ALREADY_LIFETIME' THEN v_fail := v_fail || ' r2=' || r2; END IF;
  IF NOT (r3->>'success')::boolean OR (r3->>'sale_number')::int <> 502 THEN v_fail := v_fail || ' r3=' || r3; END IF;
  IF v_tier IS DISTINCT FROM 'lifetime' THEN v_fail := v_fail || ' tier=' || coalesce(v_tier, 'NULL'); END IF;
  IF v_sales <> 2 THEN v_fail := v_fail || ' sales=' || v_sales; END IF;
  IF v_sub_ok AND (v_plan IS DISTINCT FROM 'lifetime' OR v_status IS DISTINCT FROM 'active') THEN v_fail := v_fail || ' sub=' || coalesce(v_plan,'NULL') || '/' || coalesce(v_status,'NULL'); END IF;
  -- authenticated cagiramaz (EXECUTE yok)
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.claim_lifetime_spot(u2, 0, 'x'); v_fail := v_fail || ' authenticated_ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN NULL; WHEN OTHERS THEN v_fail := v_fail || ' authenticated_other(' || SQLSTATE || ')'; END;
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T4', CASE WHEN v_fail = '' THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN v_fail = '' THEN 'tam yol: success sale_number=501, tekrar=ALREADY_LIFETIME, tier=lifetime, subscriptions ' || CASE WHEN v_sub_ok THEN 'guncellendi' ELSE 'satiri eklenemedi(atlandi)' END
         ELSE 'sorun:' || v_fail END);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T4', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END $t$;

-- T5: gercek sequence DOKUNULMADI (rename islem icinde yapildi; ROLLBACK geri alir) -- islem ici gozlem: orijinal duruyor mu
DO $t$
DECLARE lv bigint;
BEGIN
  EXECUTE 'SELECT last_value FROM public.lifetime_sale_number__dryrun_orig' INTO lv;
  INSERT INTO dryrun_results VALUES ('T5', CASE WHEN lv = (SELECT s.lv FROM seq_before s) THEN 'PASS' ELSE 'FAIL' END,
    'gercek sequence last_value=' || lv || ' (oncesi ' || (SELECT s.lv FROM seq_before s) || ') — nextval tuketmedi');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO dryrun_results VALUES ('T5', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (T4 DDL geri alinmis olabilir)');
END $t$;

-- OZET
INSERT INTO dryrun_results
SELECT 'zz_summary', CASE WHEN count(*) FILTER (WHERE result = 'FAIL') = 0 THEN 'ALL PASS' ELSE 'FAILURES' END,
       count(*) FILTER (WHERE result = 'FAIL') || ' fail / ' || count(*) FILTER (WHERE result = 'PASS') || ' pass'
FROM dryrun_results;

DO $$ DECLARE v text; BEGIN
  SELECT string_agg(test || ' | ' || result || ' | ' || coalesce(detail,''), E'\n' ORDER BY test) INTO v FROM dryrun_results;
  RAISE EXCEPTION E'DRYRUN_RESULTS\n%', v;
END $$;
ROLLBACK;  -- ikinci emniyet
