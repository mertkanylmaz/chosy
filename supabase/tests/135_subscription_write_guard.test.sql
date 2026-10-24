-- ============================================================
-- 135 testleri (MONEY-SEC-1) — migration 135 uygulandıktan sonra, ŞİMDİ DEĞİL.
-- Çalıştır: bir branch/staging DB'de `supabase db query --linked -f ...` ya da psql.
-- Her şey tek işlemde; sonda ROLLBACK, kalıcı veri bırakmaz.
-- Her test başarısızlıkta RAISE EXCEPTION ile durur; sonunda 'ALL PASS' notice'ı gelir.
-- ============================================================
BEGIN;

DO $$
DECLARE
  v_auth_id  text := 'sec1-test-' || gen_random_uuid()::text;
  v_user_id  uuid;
  v_tier     text;
  v_name     text;
  v_res      jsonb;
BEGIN
  -- Hazırlık (postgres rolü): kullanıcı + abonelik satırı
  INSERT INTO public.users (auth_id) VALUES (v_auth_id) RETURNING id INTO v_user_id;
  INSERT INTO public.subscriptions (user_id, plan, status, entitlement_id, environment)
    VALUES (v_user_id, 'annual', 'active', 'chosy_plus', 'SANDBOX');

  -- Oturumu authenticated kullanıcı gibi kur (PostgREST'in yaptığı)
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_auth_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_auth_id, true);

  -- T1: authenticated doğrudan subscription_tier UPDATE → 42501
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE public.users SET subscription_tier = 'lifetime' WHERE id = v_user_id;
    RAISE EXCEPTION 'T1 FAIL: authenticated subscription_tier UPDATE geçti';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'T1 PASS: subscription_tier UPDATE → 42501';
  END;

  -- T1b: aynı koruma active_until / will_renew için
  BEGIN
    UPDATE public.users SET subscription_active_until = now() + interval '1 year' WHERE id = v_user_id;
    RAISE EXCEPTION 'T1b FAIL: subscription_active_until UPDATE geçti';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'T1b PASS: subscription_active_until UPDATE → 42501';
  END;
  BEGIN
    UPDATE public.users SET subscription_will_renew = false WHERE id = v_user_id;
    RAISE EXCEPTION 'T1c FAIL: subscription_will_renew UPDATE geçti';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'T1c PASS: subscription_will_renew UPDATE → 42501';
  END;

  -- T2: authenticated profil kolonu UPDATE → geçer (abonelik kolonu değişmez)
  UPDATE public.users SET display_name = 'sec1-ok' WHERE id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'T2 FAIL: profil kolonu UPDATE 0 satır etkiledi';
  END IF;
  RAISE NOTICE 'T2 PASS: profil kolonu UPDATE geçti';

  -- T2b: authenticated subscriptions yazımı → yetki yok
  BEGIN
    UPDATE public.subscriptions SET status = 'active', plan = 'lifetime' WHERE user_id = v_user_id;
    RAISE EXCEPTION 'T2b FAIL: authenticated subscriptions UPDATE geçti';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'T2b PASS: subscriptions UPDATE → 42501';
  END;

  -- T3: SECURITY DEFINER RPC (claim_lifetime_spot) tier'ı yazabilir
  v_res := public.claim_lifetime_spot(v_user_id, 0, 'sec1-test-tx');
  RESET ROLE;
  SELECT subscription_tier INTO v_tier FROM public.users WHERE id = v_user_id;
  IF v_tier IS DISTINCT FROM 'lifetime' THEN
    RAISE EXCEPTION 'T3 FAIL: claim_lifetime_spot sonrası tier=% (sonuç=%)', v_tier, v_res;
  END IF;
  RAISE NOTICE 'T3 PASS: SECURITY DEFINER RPC tier yazdı (%).', v_res;

  -- T4: service_role tier + subscriptions yazabilir
  SET LOCAL ROLE service_role;
  UPDATE public.users SET subscription_tier = 'monthly' WHERE id = v_user_id;
  UPDATE public.subscriptions SET status = 'trial' WHERE user_id = v_user_id;
  RESET ROLE;
  SELECT subscription_tier INTO v_tier FROM public.users WHERE id = v_user_id;
  IF v_tier IS DISTINCT FROM 'monthly' THEN
    RAISE EXCEPTION 'T4 FAIL: service_role UPDATE sonrası tier=%', v_tier;
  END IF;
  RAISE NOTICE 'T4 PASS: service_role yazdı';

  -- T5: INSERT'te abonelik kolonu varsayılandan farklıysa reddedilir (anon + authenticated)
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.users (auth_id, subscription_tier) VALUES ('sec1-ins-' || gen_random_uuid()::text, 'lifetime');
    RAISE EXCEPTION 'T5 FAIL: tier=lifetime INSERT geçti';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'T5 PASS: farklı tier ile INSERT → 42501';
  END;
  -- T5b: varsayılanlarla INSERT geçer (auth-utils.ts yalnız auth_id yazar)
  INSERT INTO public.users (auth_id) VALUES ('sec1-ins-ok-' || gen_random_uuid()::text);
  RAISE NOTICE 'T5b PASS: varsayılan INSERT geçti';
  RESET ROLE;

  RAISE NOTICE 'ALL PASS';
END
$$;

ROLLBACK;
