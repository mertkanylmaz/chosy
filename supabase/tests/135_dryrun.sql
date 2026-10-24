-- ============================================================
-- 135 DRY-RUN (MONEY-SEC-1)
-- TEK islem: BEGIN; <135 tam metni>; <testler>; SELECT sonuclar; ROLLBACK. Kalici degisiklik birakmaz
-- (tek istisna: claim_lifetime_spot'un nextval'i; lifetime_sale_number sekansinda 1 bosluk kabul edildi).
-- Sonuclar TEMP TABLE dryrun_results'a yazilir; ROLLBACK'ten hemen once SELECT edilir.
-- Beklenen 42501 ic EXCEPTION blogunda yakalanir; islem ROLLBACK'e kadar ilerler.
-- Son satir: test='zz_summary', result='ALL PASS' | 'FAILURES'.
-- Sonuclar ayrica DRYRUN_RESULTS hata mesaji olarak doner (beklenen: hata ile biter, islem geri alinir).
-- Kaynak: supabase/migrations/135_subscription_write_guard.sql (asagiya AYNEN gomulu).
-- ============================================================
BEGIN;

-- ===================== 135 TAM METNI (baslangic) =====================
-- ============================================================
-- 135_subscription_write_guard.sql  (MONEY-SEC-1)
--
-- Sorun: anon/authenticated kendi `users.subscription_tier` ve `subscriptions`
-- satırına doğrudan yazabiliyordu (policy + tam GRANT). Kota RPC'leri ve
-- submit-choice bu kolonu okuduğundan bu "kendini Pro yapma" açığıdır.
--
-- Çözüm:
--  1) subscriptions: istemci INSERT/UPDATE policy'leri düşer, yazma GRANT'ları
--     geri alınır. SELECT policy'si kalır. Yazan: webhook / sync-entitlement
--     (service role) ve claim_lifetime_spot (SECURITY DEFINER; EXEC yalnız service_role/postgres).
--  2) users: abonelik kolonlarını yalnız service_role / SECURITY DEFINER
--     (sahip: postgres) değiştirebilir. Tablo-düzeyi GRANT varken kolon REVOKE
--     işlemediğinden BEFORE tetikleyici kullanılır.
--
-- Engelleme koşulu `current_user IN ('authenticated','anon')`: PostgREST isteği
-- bu rollerle çalışır; SECURITY DEFINER fonksiyon sahibinin (postgres) rolüyle,
-- service_role kendi rolüyle çalışır → ikisi geçer. auth.role() / JWT claim
-- KULLANILMAZ (SECURITY DEFINER RPC'ler JWT claim'ini taşır, bloklanırdı).
--
-- SIRA: revenuecat-webhook (upsert, commit 36a4987) ve sync-entitlement deploy
-- EDİLDİKTEN SONRA uygulanır; aksi halde yeni alıcının subscriptions satırını
-- kimse yaratamaz.
-- Geri alma: docs/rollback/135_rollback.sql
-- ============================================================

-- 1) subscriptions: istemci yazımı kapanır (SELECT policy'si kalır)
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.subscriptions;
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM anon, authenticated;

-- 1b) claim_lifetime_spot: SECURITY DEFINER ve anon/authenticated EXEC'li; kendi id'siyle
--     (p_price=0, ödeme doğrulaması yok) çağıran kendine lifetime tier yazabiliyordu ve
--     DEFINER olduğu için aşağıdaki tetikleyiciden geçerdi. Çağıranlar yalnız sunucuda:
--     process-lifetime-purchase + revenuecat-webhook (service role), apply_invite_code
--     içinden referral akışı (DEFINER, sahip postgres). İstemci doğrudan çağırmaz.
REVOKE EXECUTE ON FUNCTION public.claim_lifetime_spot(uuid, numeric, text) FROM PUBLIC, anon, authenticated;

-- 2) users: korunan kolonlar açıkça listelenir (yetkiyi etkileyen, istemciden yazılmaması gerekenler)
--    subscription_tier, subscription_active_until, subscription_will_renew
--    legacy_mood_access  — check_and_consume_quota (115) kota muafiyeti + Pro Mode kapısı okur
--    INSERT varsayılanları (canlıda ölçüldü): tier 'free', active_until NULL,
--    will_renew true, legacy_mood_access false.
--    SET search_path: tetikleyici fonksiyonu tanımsız-şema çözümlemesine bağımlı olmasın.
CREATE OR REPLACE FUNCTION public.guard_users_subscription_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.subscription_tier IS DISTINCT FROM 'free'
         OR NEW.subscription_active_until IS NOT NULL
         OR NEW.subscription_will_renew IS DISTINCT FROM true
         OR NEW.legacy_mood_access IS DISTINCT FROM false THEN
        RAISE EXCEPTION 'entitlement columns are server-managed' USING ERRCODE = '42501';
      END IF;
    ELSIF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier
       OR NEW.subscription_active_until IS DISTINCT FROM OLD.subscription_active_until
       OR NEW.subscription_will_renew IS DISTINCT FROM OLD.subscription_will_renew
       OR NEW.legacy_mood_access IS DISTINCT FROM OLD.legacy_mood_access THEN
      RAISE EXCEPTION 'entitlement columns are server-managed' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_guard_users_subscription_columns ON public.users;
CREATE TRIGGER trg_guard_users_subscription_columns
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_users_subscription_columns();
-- ===================== 135 TAM METNI (bitis) =====================

-- -- SETUP (postgres): sonuc tablosu, test kullanicisi, abonelik satiri, DEFINER karsilastirma fonksiyonu
CREATE TEMP TABLE dryrun_results (test text, result text, detail text);
GRANT ALL ON dryrun_results TO PUBLIC;

DO $t$
DECLARE
  v_auth text := 'dryrun-' || gen_random_uuid()::text;
  v_id   uuid;
BEGIN
  INSERT INTO public.users (auth_id) VALUES (v_auth) RETURNING id INTO v_id;
  INSERT INTO public.subscriptions (user_id, plan, status, entitlement_id, environment)
    VALUES (v_id, 'annual', 'active', 'chosy_plus', 'SANDBOX');
  PERFORM set_config('dryrun.auth_id', v_auth, true);
  PERFORM set_config('dryrun.user_id', v_id::text, true);
  -- SECURITY DEFINER (sahip: postgres) karsilastirma fonksiyonu; bu islemde yaratilir, ROLLBACK'te gider.
  EXECUTE $f$
    CREATE FUNCTION public._dryrun_definer_set_tier(p_id uuid, p_tier text) RETURNS void
    LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public
    AS 'UPDATE public.users SET subscription_tier = p_tier, legacy_mood_access = true WHERE id = p_id'
  $f$;
  GRANT EXECUTE ON FUNCTION public._dryrun_definer_set_tier(uuid, text) TO authenticated;
  INSERT INTO dryrun_results VALUES ('00_setup', 'INFO', 'user=' || v_id || ' auth_id=' || v_auth);
END
$t$;

-- -- T1a
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', current_setting('dryrun.auth_id'), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', current_setting('dryrun.auth_id'), true);
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE public.users SET subscription_tier = 'lifetime' WHERE id = current_setting('dryrun.user_id')::uuid;
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T1a', 'FAIL', 'ifade GECTI, 42501 bekleniyordu');
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T1a', 'PASS', '42501');
  END;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T1a', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T1b
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', current_setting('dryrun.auth_id'), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', current_setting('dryrun.auth_id'), true);
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE public.users SET subscription_active_until = now() + interval '1 year' WHERE id = current_setting('dryrun.user_id')::uuid;
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T1b', 'FAIL', 'ifade GECTI, 42501 bekleniyordu');
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T1b', 'PASS', '42501');
  END;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T1b', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T1c
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', current_setting('dryrun.auth_id'), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', current_setting('dryrun.auth_id'), true);
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE public.users SET subscription_will_renew = false WHERE id = current_setting('dryrun.user_id')::uuid;
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T1c', 'FAIL', 'ifade GECTI, 42501 bekleniyordu');
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T1c', 'PASS', '42501');
  END;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T1c', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T1d
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', current_setting('dryrun.auth_id'), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', current_setting('dryrun.auth_id'), true);
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE public.users SET legacy_mood_access = true WHERE id = current_setting('dryrun.user_id')::uuid;
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T1d', 'FAIL', 'ifade GECTI, 42501 bekleniyordu');
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T1d', 'PASS', '42501');
  END;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T1d', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T1e
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', current_setting('dryrun.auth_id'), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', current_setting('dryrun.auth_id'), true);
  SET LOCAL ROLE authenticated;
  UPDATE public.users SET subscription_tier = subscription_tier, legacy_mood_access = legacy_mood_access WHERE id = current_setting('dryrun.user_id')::uuid;
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T1e', 'PASS', 'degismeyen deger gecti');
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T1e', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T2
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', current_setting('dryrun.auth_id'), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', current_setting('dryrun.auth_id'), true);
  SET LOCAL ROLE authenticated;
  UPDATE public.users SET display_name = 'dryrun-ok' WHERE id = current_setting('dryrun.user_id')::uuid;
  IF NOT FOUND THEN
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T2', 'FAIL', '0 satir etkilendi (RLS/jwt kurulumu)');
  ELSE
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T2', 'PASS', 'profil kolonu UPDATE gecti');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T2', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T2b
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', current_setting('dryrun.auth_id'), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', current_setting('dryrun.auth_id'), true);
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE public.subscriptions SET plan = 'lifetime' WHERE user_id = current_setting('dryrun.user_id')::uuid;
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T2b', 'FAIL', 'ifade GECTI, 42501 bekleniyordu');
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T2b', 'PASS', '42501');
  END;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T2b', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T2c
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', current_setting('dryrun.auth_id'), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', current_setting('dryrun.auth_id'), true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.subscriptions (user_id, plan, status) VALUES (gen_random_uuid(), 'annual', 'active');
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T2c', 'FAIL', 'ifade GECTI, 42501 bekleniyordu');
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T2c', 'PASS', '42501');
  END;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T2c', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T2d
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', current_setting('dryrun.auth_id'), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', current_setting('dryrun.auth_id'), true);
  SET LOCAL ROLE authenticated;
  IF (SELECT count(*) FROM public.subscriptions WHERE user_id = current_setting('dryrun.user_id')::uuid) = 1 THEN
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T2d', 'PASS', 'kendi satiri okundu');
  ELSE
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T2d', 'FAIL', 'kendi abonelik satiri okunamadi');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T2d', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T3
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', current_setting('dryrun.auth_id'), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', current_setting('dryrun.auth_id'), true);
  SET LOCAL ROLE authenticated;
  PERFORM public._dryrun_definer_set_tier(current_setting('dryrun.user_id')::uuid, 'lifetime');
  RESET ROLE;
  IF (SELECT subscription_tier || ':' || legacy_mood_access::text FROM public.users WHERE id = current_setting('dryrun.user_id')::uuid) = 'lifetime:true' THEN
    INSERT INTO dryrun_results VALUES ('T3', 'PASS', 'DEFINER tier + legacy_mood_access yazdi');
  ELSE
    INSERT INTO dryrun_results VALUES ('T3', 'FAIL', 'DEFINER yazimi gorunmuyor');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T3', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T6a
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', current_setting('dryrun.auth_id'), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', current_setting('dryrun.auth_id'), true);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.claim_lifetime_spot(current_setting('dryrun.user_id')::uuid, 0, 'dryrun-tx');
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T6a', 'FAIL', 'ifade GECTI, 42501 bekleniyordu');
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T6a', 'PASS', '42501');
  END;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T6a', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T6b
DO $t$
DECLARE
  v_res jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', current_setting('dryrun.auth_id'), 'role', 'service_role')::text, true);
  PERFORM set_config('request.jwt.claim.sub', current_setting('dryrun.auth_id'), true);
  UPDATE public.users SET subscription_tier = 'free', legacy_mood_access = false WHERE id = current_setting('dryrun.user_id')::uuid;
  SET LOCAL ROLE service_role;
  v_res := public.claim_lifetime_spot(current_setting('dryrun.user_id')::uuid, 0, 'dryrun-tx');
  RESET ROLE;
  IF (v_res->>'success')::boolean IS TRUE
     AND (SELECT subscription_tier FROM public.users WHERE id = current_setting('dryrun.user_id')::uuid) = 'lifetime' THEN
    INSERT INTO dryrun_results VALUES ('T6b', 'PASS', 'service_role claim_lifetime_spot: ' || v_res::text);
  ELSE
    INSERT INTO dryrun_results VALUES ('T6b', 'FAIL', 'sonuc: ' || coalesce(v_res::text, 'NULL'));
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T6b', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T4
DO $t$
BEGIN
  UPDATE public.subscriptions SET status = 'active' WHERE user_id = current_setting('dryrun.user_id')::uuid;
  SET LOCAL ROLE service_role;
  UPDATE public.users SET subscription_tier = 'monthly', subscription_will_renew = false, legacy_mood_access = false WHERE id = current_setting('dryrun.user_id')::uuid;
  UPDATE public.subscriptions SET status = 'trial' WHERE user_id = current_setting('dryrun.user_id')::uuid;
  RESET ROLE;
  IF (SELECT subscription_tier FROM public.users WHERE id = current_setting('dryrun.user_id')::uuid) = 'monthly'
     AND (SELECT status FROM public.subscriptions WHERE user_id = current_setting('dryrun.user_id')::uuid) = 'trial' THEN
    INSERT INTO dryrun_results VALUES ('T4', 'PASS', 'service_role users + subscriptions yazdi');
  ELSE
    INSERT INTO dryrun_results VALUES ('T4', 'FAIL', 'service_role yazimi gorunmuyor');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T4', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T5a
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'dryrun-ins-a', 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', 'dryrun-ins-a', true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.users (auth_id, subscription_tier) VALUES ('dryrun-ins-a', 'lifetime');
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T5a', 'FAIL', 'ifade GECTI, 42501 bekleniyordu');
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T5a', 'PASS', '42501');
  END;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T5a', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T5b
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'dryrun-ins-b', 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', 'dryrun-ins-b', true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.users (auth_id, legacy_mood_access) VALUES ('dryrun-ins-b', true);
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T5b', 'FAIL', 'ifade GECTI, 42501 bekleniyordu');
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T5b', 'PASS', '42501');
  END;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T5b', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T5c
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'dryrun-ins-c', 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', 'dryrun-ins-c', true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.users (auth_id) VALUES ('dryrun-ins-c');
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T5c', 'PASS', 'varsayilan INSERT gecti (auth-utils.ts yolu)');
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T5c', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T5d
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'dryrun-ins-c', 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', 'dryrun-ins-c', true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.users (auth_id) VALUES ('dryrun-ins-c') ON CONFLICT (auth_id) DO UPDATE SET auth_id = EXCLUDED.auth_id;
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T5d', 'PASS', 'upsert yolu gecti');
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T5d', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- OZET satiri
INSERT INTO dryrun_results
SELECT 'zz_summary',
       CASE WHEN count(*) FILTER (WHERE result = 'FAIL') = 0 THEN 'ALL PASS' ELSE 'FAILURES' END,
       count(*) FILTER (WHERE result = 'FAIL') || ' fail / ' || count(*) FILTER (WHERE result = 'PASS') || ' pass'
FROM dryrun_results;

SELECT * FROM dryrun_results ORDER BY test;

-- Cikti kanali: tool yalniz son ifadeyi / hatayi gosterebilir. Sonuclar hata mesajinda
-- gorunsun; EXCEPTION islemi iptal eder, asagidaki ROLLBACK ikinci emniyettir.
DO $$ DECLARE v text; BEGIN
  SELECT string_agg(test || ' | ' || result || ' | ' || coalesce(detail,''), E'\n' ORDER BY test) INTO v
  FROM dryrun_results;
  RAISE EXCEPTION E'DRYRUN_RESULTS\n%', v;
END $$;
ROLLBACK;  -- ikinci emniyet
