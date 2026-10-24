-- ============================================================
-- 135 DRY-RUN (MONEY-SEC-1) - CALISTIRILMADI.
-- TEK islem: BEGIN; <135 tam metni>; <testler>; ROLLBACK. Kalici degisiklik birakmaz.
-- Yalniz bir branch/staging DB'de kosulur. Her test RAISE NOTICE ile PASS/FAIL/SKIP yazar;
-- beklenen 42501 EXCEPTION blogunda yakalanir, islem ROLLBACK'e kadar ilerler.
-- Son satir 'ALL PASS' ya da 'FAILURES: n'.
-- Gercek claim_lifetime_spot testi (istege bagli, sequence nextval geri gelmez):
--   oturumda BEGIN'den once  SET dryrun.real_claim = 'on';
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
--     (service role) ve claim_lifetime_spot (SECURITY DEFINER).
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

-- ── SETUP (postgres): test kullanicisi + abonelik satiri + DEFINER karsilastirma fonksiyonu
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
  PERFORM set_config('dryrun.fails', '0', true);
  -- Gercek claim_lifetime_spot yalniz 'on' ise cagrilir (nextval ROLLBACK'te geri GELMEZ).
  PERFORM set_config('dryrun.real_claim', coalesce(nullif(current_setting('dryrun.real_claim', true), ''), 'off'), true);
  -- SECURITY DEFINER (sahip: postgres) karsilastirma fonksiyonu; bu islemde yaratilir, ROLLBACK'te gider.
  EXECUTE $f$
    CREATE FUNCTION public._dryrun_definer_set_tier(p_id uuid, p_tier text) RETURNS void
    LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public
    AS 'UPDATE public.users SET subscription_tier = p_tier, legacy_mood_access = true WHERE id = p_id'
  $f$;
  GRANT EXECUTE ON FUNCTION public._dryrun_definer_set_tier(uuid, text) TO authenticated;
  RAISE NOTICE 'SETUP ok: user=% auth_id=%', v_id, v_auth;
END
$t$;

-- ── T1a authenticated subscription_tier UPDATE
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', current_setting('dryrun.auth_id'), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', current_setting('dryrun.auth_id'), true);
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE public.users SET subscription_tier = 'lifetime' WHERE id = current_setting('dryrun.user_id')::uuid;
    RESET ROLE;
    PERFORM set_config('dryrun.fails', (coalesce(nullif(current_setting('dryrun.fails', true), ''), '0')::int + 1)::text, true);
    RAISE NOTICE 'FAIL T1a: ifade GECTI, 42501 bekleniyordu';
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    RAISE NOTICE 'PASS T1a: 42501';
  END;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('dryrun.fails', (coalesce(nullif(current_setting('dryrun.fails', true), ''), '0')::int + 1)::text, true);
  RAISE NOTICE 'FAIL T1a authenticated subscription_tier UPDATE: beklenmeyen hata % (%)', SQLERRM, SQLSTATE;
END
$t$;

-- ── T1b authenticated subscription_active_until UPDATE
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', current_setting('dryrun.auth_id'), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', current_setting('dryrun.auth_id'), true);
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE public.users SET subscription_active_until = now() + interval '1 year' WHERE id = current_setting('dryrun.user_id')::uuid;
    RESET ROLE;
    PERFORM set_config('dryrun.fails', (coalesce(nullif(current_setting('dryrun.fails', true), ''), '0')::int + 1)::text, true);
    RAISE NOTICE 'FAIL T1b: ifade GECTI, 42501 bekleniyordu';
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    RAISE NOTICE 'PASS T1b: 42501';
  END;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('dryrun.fails', (coalesce(nullif(current_setting('dryrun.fails', true), ''), '0')::int + 1)::text, true);
  RAISE NOTICE 'FAIL T1b authenticated subscription_active_until UPDATE: beklenmeyen hata % (%)', SQLERRM, SQLSTATE;
END
$t$;

-- ── T1c authenticated subscription_will_renew UPDATE
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', current_setting('dryrun.auth_id'), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', current_setting('dryrun.auth_id'), true);
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE public.users SET subscription_will_renew = false WHERE id = current_setting('dryrun.user_id')::uuid;
    RESET ROLE;
    PERFORM set_config('dryrun.fails', (coalesce(nullif(current_setting('dryrun.fails', true), ''), '0')::int + 1)::text, true);
    RAISE NOTICE 'FAIL T1c: ifade GECTI, 42501 bekleniyordu';
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    RAISE NOTICE 'PASS T1c: 42501';
  END;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('dryrun.fails', (coalesce(nullif(current_setting('dryrun.fails', true), ''), '0')::int + 1)::text, true);
  RAISE NOTICE 'FAIL T1c authenticated subscription_will_renew UPDATE: beklenmeyen hata % (%)', SQLERRM, SQLSTATE;
END
$t$;

-- ── T1d authenticated legacy_mood_access UPDATE
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', current_setting('dryrun.auth_id'), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', current_setting('dryrun.auth_id'), true);
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE public.users SET legacy_mood_access = true WHERE id = current_setting('dryrun.user_id')::uuid;
    RESET ROLE;
    PERFORM set_config('dryrun.fails', (coalesce(nullif(current_setting('dryrun.fails', true), ''), '0')::int + 1)::text, true);
    RAISE NOTICE 'FAIL T1d: ifade GECTI, 42501 bekleniyordu';
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    RAISE NOTICE 'PASS T1d: 42501';
  END;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('dryrun.fails', (coalesce(nullif(current_setting('dryrun.fails', true), ''), '0')::int + 1)::text, true);
  RAISE NOTICE 'FAIL T1d authenticated legacy_mood_access UPDATE: beklenmeyen hata % (%)', SQLERRM, SQLSTATE;
END
$t$;

-- ── T1e korunan kolon AYNI degerle UPDATE
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', current_setting('dryrun.auth_id'), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', current_setting('dryrun.auth_id'), true);
  SET LOCAL ROLE authenticated;
  UPDATE public.users SET subscription_tier = subscription_tier, legacy_mood_access = legacy_mood_access WHERE id = current_setting('dryrun.user_id')::uuid;
  RESET ROLE;
  RAISE NOTICE 'PASS T1e: degismeyen deger gecti';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('dryrun.fails', (coalesce(nullif(current_setting('dryrun.fails', true), ''), '0')::int + 1)::text, true);
  RAISE NOTICE 'FAIL T1e korunan kolon AYNI degerle UPDATE: beklenmeyen hata % (%)', SQLERRM, SQLSTATE;
END
$t$;

-- ── T2 authenticated profil kolonu UPDATE
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', current_setting('dryrun.auth_id'), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', current_setting('dryrun.auth_id'), true);
  SET LOCAL ROLE authenticated;
  UPDATE public.users SET display_name = 'dryrun-ok' WHERE id = current_setting('dryrun.user_id')::uuid;
  IF NOT FOUND THEN
    RESET ROLE;
    PERFORM set_config('dryrun.fails', (coalesce(nullif(current_setting('dryrun.fails', true), ''), '0')::int + 1)::text, true);
    RAISE NOTICE 'FAIL T2: 0 satir etkilendi (RLS/jwt kurulumu)';
  ELSE
    RESET ROLE;
    RAISE NOTICE 'PASS T2: profil kolonu UPDATE gecti';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('dryrun.fails', (coalesce(nullif(current_setting('dryrun.fails', true), ''), '0')::int + 1)::text, true);
  RAISE NOTICE 'FAIL T2 authenticated profil kolonu UPDATE: beklenmeyen hata % (%)', SQLERRM, SQLSTATE;
END
$t$;

-- ── T2b authenticated subscriptions UPDATE
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', current_setting('dryrun.auth_id'), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', current_setting('dryrun.auth_id'), true);
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE public.subscriptions SET plan = 'lifetime' WHERE user_id = current_setting('dryrun.user_id')::uuid;
    RESET ROLE;
    PERFORM set_config('dryrun.fails', (coalesce(nullif(current_setting('dryrun.fails', true), ''), '0')::int + 1)::text, true);
    RAISE NOTICE 'FAIL T2b: ifade GECTI, 42501 bekleniyordu';
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    RAISE NOTICE 'PASS T2b: 42501';
  END;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('dryrun.fails', (coalesce(nullif(current_setting('dryrun.fails', true), ''), '0')::int + 1)::text, true);
  RAISE NOTICE 'FAIL T2b authenticated subscriptions UPDATE: beklenmeyen hata % (%)', SQLERRM, SQLSTATE;
END
$t$;

-- ── T2c authenticated subscriptions INSERT
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', current_setting('dryrun.auth_id'), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', current_setting('dryrun.auth_id'), true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.subscriptions (user_id, plan, status) VALUES (gen_random_uuid(), 'annual', 'active');
    RESET ROLE;
    PERFORM set_config('dryrun.fails', (coalesce(nullif(current_setting('dryrun.fails', true), ''), '0')::int + 1)::text, true);
    RAISE NOTICE 'FAIL T2c: ifade GECTI, 42501 bekleniyordu';
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    RAISE NOTICE 'PASS T2c: 42501';
  END;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('dryrun.fails', (coalesce(nullif(current_setting('dryrun.fails', true), ''), '0')::int + 1)::text, true);
  RAISE NOTICE 'FAIL T2c authenticated subscriptions INSERT: beklenmeyen hata % (%)', SQLERRM, SQLSTATE;
END
$t$;

-- ── T2d authenticated kendi subscriptions SELECT
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', current_setting('dryrun.auth_id'), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', current_setting('dryrun.auth_id'), true);
  SET LOCAL ROLE authenticated;
  IF (SELECT count(*) FROM public.subscriptions WHERE user_id = current_setting('dryrun.user_id')::uuid) = 1 THEN
    RESET ROLE;
    RAISE NOTICE 'PASS T2d: SELECT 1 satir';
  ELSE
    RESET ROLE;
    PERFORM set_config('dryrun.fails', (coalesce(nullif(current_setting('dryrun.fails', true), ''), '0')::int + 1)::text, true);
    RAISE NOTICE 'FAIL T2d: kendi abonelik satiri okunamadi';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('dryrun.fails', (coalesce(nullif(current_setting('dryrun.fails', true), ''), '0')::int + 1)::text, true);
  RAISE NOTICE 'FAIL T2d authenticated kendi subscriptions SELECT: beklenmeyen hata % (%)', SQLERRM, SQLSTATE;
END
$t$;

-- ── T3 SECURITY DEFINER fonksiyon tier + legacy_mood_access yazar
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', current_setting('dryrun.auth_id'), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', current_setting('dryrun.auth_id'), true);
  SET LOCAL ROLE authenticated;
  PERFORM public._dryrun_definer_set_tier(current_setting('dryrun.user_id')::uuid, 'lifetime');
  RESET ROLE;
  IF (SELECT subscription_tier || ':' || legacy_mood_access::text FROM public.users WHERE id = current_setting('dryrun.user_id')::uuid) = 'lifetime:true' THEN
    RAISE NOTICE 'PASS T3: DEFINER yazdi';
  ELSE
    PERFORM set_config('dryrun.fails', (coalesce(nullif(current_setting('dryrun.fails', true), ''), '0')::int + 1)::text, true);
    RAISE NOTICE 'FAIL T3: DEFINER yazimi gorunmuyor';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('dryrun.fails', (coalesce(nullif(current_setting('dryrun.fails', true), ''), '0')::int + 1)::text, true);
  RAISE NOTICE 'FAIL T3 SECURITY DEFINER fonksiyon tier + legacy_mood_access yazar: beklenmeyen hata % (%)', SQLERRM, SQLSTATE;
END
$t$;

-- ── T3b gercek claim_lifetime_spot (yalniz dryrun.real_claim=on)
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', current_setting('dryrun.auth_id'), 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', current_setting('dryrun.auth_id'), true);
  IF current_setting('dryrun.real_claim') <> 'on' THEN
    RAISE NOTICE 'SKIP T3b: dryrun.real_claim=off (nextval ROLLBACK edilmez; sale_number boslugu birakir)';
  ELSE
    UPDATE public.users SET subscription_tier = 'free' WHERE id = current_setting('dryrun.user_id')::uuid;
    SET LOCAL ROLE authenticated;
    PERFORM public.claim_lifetime_spot(current_setting('dryrun.user_id')::uuid, 0, 'dryrun-tx');
    RESET ROLE;
    IF (SELECT subscription_tier FROM public.users WHERE id = current_setting('dryrun.user_id')::uuid) = 'lifetime' THEN
      RAISE NOTICE 'PASS T3b: claim_lifetime_spot tier yazdi';
    ELSE
      PERFORM set_config('dryrun.fails', (coalesce(nullif(current_setting('dryrun.fails', true), ''), '0')::int + 1)::text, true);
      RAISE NOTICE 'FAIL T3b: claim_lifetime_spot sonrasi tier lifetime degil';
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('dryrun.fails', (coalesce(nullif(current_setting('dryrun.fails', true), ''), '0')::int + 1)::text, true);
  RAISE NOTICE 'FAIL T3b gercek claim_lifetime_spot (yalniz dryrun.real_claim=on): beklenmeyen hata % (%)', SQLERRM, SQLSTATE;
END
$t$;

-- ── T4 service_role users + subscriptions yazar
DO $t$
BEGIN
  SET LOCAL ROLE service_role;
  UPDATE public.users SET subscription_tier = 'monthly', subscription_will_renew = false, legacy_mood_access = false WHERE id = current_setting('dryrun.user_id')::uuid;
  UPDATE public.subscriptions SET status = 'trial' WHERE user_id = current_setting('dryrun.user_id')::uuid;
  RESET ROLE;
  IF (SELECT subscription_tier FROM public.users WHERE id = current_setting('dryrun.user_id')::uuid) = 'monthly'
     AND (SELECT status FROM public.subscriptions WHERE user_id = current_setting('dryrun.user_id')::uuid) = 'trial' THEN
    RAISE NOTICE 'PASS T4: service_role yazdi';
  ELSE
    PERFORM set_config('dryrun.fails', (coalesce(nullif(current_setting('dryrun.fails', true), ''), '0')::int + 1)::text, true);
    RAISE NOTICE 'FAIL T4: service_role yazimi gorunmuyor';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('dryrun.fails', (coalesce(nullif(current_setting('dryrun.fails', true), ''), '0')::int + 1)::text, true);
  RAISE NOTICE 'FAIL T4 service_role users + subscriptions yazar: beklenmeyen hata % (%)', SQLERRM, SQLSTATE;
END
$t$;

-- ── T5a authenticated INSERT tier != free
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'dryrun-ins-a', 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', 'dryrun-ins-a', true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.users (auth_id, subscription_tier) VALUES ('dryrun-ins-a', 'lifetime');
    RESET ROLE;
    PERFORM set_config('dryrun.fails', (coalesce(nullif(current_setting('dryrun.fails', true), ''), '0')::int + 1)::text, true);
    RAISE NOTICE 'FAIL T5a: ifade GECTI, 42501 bekleniyordu';
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    RAISE NOTICE 'PASS T5a: 42501';
  END;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('dryrun.fails', (coalesce(nullif(current_setting('dryrun.fails', true), ''), '0')::int + 1)::text, true);
  RAISE NOTICE 'FAIL T5a authenticated INSERT tier != free: beklenmeyen hata % (%)', SQLERRM, SQLSTATE;
END
$t$;

-- ── T5b authenticated INSERT legacy_mood_access = true
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'dryrun-ins-b', 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', 'dryrun-ins-b', true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.users (auth_id, legacy_mood_access) VALUES ('dryrun-ins-b', true);
    RESET ROLE;
    PERFORM set_config('dryrun.fails', (coalesce(nullif(current_setting('dryrun.fails', true), ''), '0')::int + 1)::text, true);
    RAISE NOTICE 'FAIL T5b: ifade GECTI, 42501 bekleniyordu';
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    RAISE NOTICE 'PASS T5b: 42501';
  END;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('dryrun.fails', (coalesce(nullif(current_setting('dryrun.fails', true), ''), '0')::int + 1)::text, true);
  RAISE NOTICE 'FAIL T5b authenticated INSERT legacy_mood_access = true: beklenmeyen hata % (%)', SQLERRM, SQLSTATE;
END
$t$;

-- ── T5c authenticated INSERT varsayilanlarla (auth-utils.ts yolu)
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'dryrun-ins-c', 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', 'dryrun-ins-c', true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.users (auth_id) VALUES ('dryrun-ins-c');
  RESET ROLE;
  RAISE NOTICE 'PASS T5c: varsayilan INSERT gecti';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('dryrun.fails', (coalesce(nullif(current_setting('dryrun.fails', true), ''), '0')::int + 1)::text, true);
  RAISE NOTICE 'FAIL T5c authenticated INSERT varsayilanlarla (auth-utils.ts yolu): beklenmeyen hata % (%)', SQLERRM, SQLSTATE;
END
$t$;

-- ── T5d authenticated UPSERT yalniz auth_id (ON CONFLICT yolu)
DO $t$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'dryrun-ins-c', 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', 'dryrun-ins-c', true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.users (auth_id) VALUES ('dryrun-ins-c') ON CONFLICT (auth_id) DO UPDATE SET auth_id = EXCLUDED.auth_id;
  RESET ROLE;
  RAISE NOTICE 'PASS T5d: upsert gecti';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('dryrun.fails', (coalesce(nullif(current_setting('dryrun.fails', true), ''), '0')::int + 1)::text, true);
  RAISE NOTICE 'FAIL T5d authenticated UPSERT yalniz auth_id (ON CONFLICT yolu): beklenmeyen hata % (%)', SQLERRM, SQLSTATE;
END
$t$;

-- ── OZET
DO $t$
BEGIN
  IF current_setting('dryrun.fails')::int = 0 THEN
    RAISE NOTICE 'ALL PASS';
  ELSE
    RAISE NOTICE 'FAILURES: %', current_setting('dryrun.fails');
  END IF;
END
$t$;

ROLLBACK;
