-- ============================================================
-- 136 DRY-RUN (MONEY-1C)
-- TEK islem: BEGIN; <136 tam metni>; <testler>; SELECT sonuclar; ROLLBACK. Kalici degisiklik birakmaz
-- (sekans/nextval kullanilmaz; test kullanicilari ve fonksiyon ROLLBACK ile gider).
-- Sonuclar TEMP TABLE dryrun_results'a yazilir; ROLLBACK'ten hemen once SELECT edilir.
-- Son satir: test='zz_summary', result='ALL PASS' | 'FAILURES'.
-- Sonuclar ayrica DRYRUN_RESULTS hata mesaji olarak doner (beklenen: hata ile biter, islem geri alinir).
-- Kaynak: supabase/migrations/136_refund_quota.sql (asagiya AYNEN gomulu; fark kontrolu: bkz. rapor).
-- DURUM: HAZIRLANDI, CALISTIRILMADI. Canli DB'ye karsi calistirmak acik onay ister.
-- Test edilemeyen: gercek eszamanlilik (tek islem). FOR UPDATE kilidi consume ile ortak satir kilididir.
-- ============================================================
BEGIN;

-- ===================== 136 TAM METNI (baslangic) =====================
-- ============================================================================
-- 136 — refund_quota: parse-mood kendi hatasıyla düşerse 1 arama hakkı iade
--
-- MONEY-1C Faz 1. Ücretsiz arama günde 1'e inerse, LLM hatası (503/500) veya
-- ayrıştırma hatası hakkı yakmış kalamaz. `check_and_consume_quota` (115) kotayı
-- LLM'den ÖNCE tüketir ve iade yolu yoktu. Bu RPC, parse-mood'un tükettikten
-- sonra KENDİ hatasıyla düştüğü yolda 1 hakkı geri verir.
--
-- ŞEMA DEĞİŞİKLİĞİ YOK: tablo/kolon eklenmez. Yalnız yeni bir fonksiyon.
--
-- DAVRANIŞ
--   · Yalnız 'search' tipi. Diğer tipler INVALID_QUOTA_TYPE döner (refine/slot
--     için iade ihtiyacı yok; genişletmek ayrı karar).
--   · Bugünün (CURRENT_DATE — DB saat dilimi, Supabase'de UTC) satırını
--     FOR UPDATE ile kilitler; `check_and_consume_quota` ile aynı kilidi
--     paylaştığı için eşzamanlı tüketim/iade seri çalışır.
--   · Tüketimin hangi sayaçtan düştüğünü 115 kuralının tersiyle bulur:
--       bonus kullanılmışsa (bonus_searches_used > 0) VE searches_used >= limit
--       ise son tüketim bonus'tandı → bonus_searches_used - 1;
--       aksi halde searches_used - 1.
--     (Bonus yalnız searches_used >= limit iken harcanır ve searches_used
--     iade dışında azalmaz; bu yüzden bonus_used > 0 ⇒ searches_used >= limit.)
--   · Sayaç 0'ın altına inmez: iade edilecek bir şey yoksa refunded=false.
--   · legacy_mood_access (limit -1, sınırsız) için de searches_used düşer —
--     115 bu kohortta sayacı artırmaya devam ediyor.
--
-- DÖNÜŞ (jsonb)
--   { refunded: true,  used, from_bonus }
--   { refunded: false, reason: USER_NOT_FOUND | INVALID_QUOTA_TYPE
--                             | NO_QUOTA_ROW | NOTHING_TO_REFUND
--                             | TIER_NOT_CONFIGURED }
--   Hata FIRLATILMAZ: çağıran (Edge Function) sonucu loglar.
--
-- BİLİNEN SINIRLAR (kasıtlı, rapora yazıldı)
--   · Gece yarısı (UTC) sınırını aşan istek: tüketim dünün, iade bugünün satırına
--     bakar → NO_QUOTA_ROW veya NOTHING_TO_REFUND. Hak iade edilmez; çağıran
--     Sentry'ye yazar. LLM çağrısı ~4 sn olduğundan pencere ~4 sn/gün.
--   · Tüketim ile iade arasında tier değişirse (webhook yükseltmesi) bonus
--     tüketimi searches_used'tan düşülebilir. Pencere saniyeler; sonuç en kötü
--     ihtimalle 1 bonus aramanın iade edilmemesi.
--   · İade idempotent DEĞİL: iki çağrı iki iade yapar (sayaç 0'a kadar). Çağıran
--     tüketim başına en çok bir kez çağırmak zorunda (parse-mood öyle).
--
-- GÜVENLİK: SECURITY DEFINER + sabit search_path; yalnız service_role EXECUTE.
--   Supabase varsayılan ACL'i yeni fonksiyona anon/authenticated EXECUTE verir
--   (109/110/135 aynı yüzden REVOKE eder) — burada açıkça kapatılıyor.
--
-- GERİ ALMA: DROP FUNCTION public.refund_quota(uuid, text);  (repo dışı kopya)
-- UYGULAMA: `supabase db push` — bu dosya yazıldı, UYGULANMADI.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.refund_quota(
  p_user_id UUID,
  p_quota_type TEXT DEFAULT 'search'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tier TEXT;
  v_legacy BOOLEAN;
  v_limit INT;
  v_today DATE := CURRENT_DATE;
  v_row user_daily_quotas%ROWTYPE;
  v_from_bonus BOOLEAN;
BEGIN
  IF p_quota_type IS DISTINCT FROM 'search' THEN
    RETURN jsonb_build_object('refunded', false, 'reason', 'INVALID_QUOTA_TYPE');
  END IF;

  SELECT subscription_tier, COALESCE(legacy_mood_access, false)
    INTO v_tier, v_legacy
    FROM users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('refunded', false, 'reason', 'USER_NOT_FOUND');
  END IF;

  -- Tüketimle aynı kilit: eşzamanlı consume/refund seri çalışır.
  SELECT * INTO v_row
    FROM user_daily_quotas
    WHERE user_id = p_user_id AND date = v_today
    FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('refunded', false, 'reason', 'NO_QUOTA_ROW');
  END IF;

  SELECT daily_search_limit INTO v_limit FROM subscription_limits WHERE tier = v_tier;
  IF v_legacy THEN
    v_limit := -1;
  END IF;
  IF v_limit IS NULL THEN
    -- 115 bu durumda tüketmeden reddeder; iade edilecek tüketim yok.
    RETURN jsonb_build_object('refunded', false, 'reason', 'TIER_NOT_CONFIGURED');
  END IF;

  v_from_bonus := v_limit <> -1
              AND v_row.bonus_searches_used > 0
              AND v_row.searches_used >= v_limit;

  IF v_from_bonus THEN
    UPDATE user_daily_quotas
      SET bonus_searches_used = bonus_searches_used - 1, updated_at = NOW()
      WHERE user_id = p_user_id AND date = v_today AND bonus_searches_used > 0;
  ELSIF v_row.searches_used > 0 THEN
    UPDATE user_daily_quotas
      SET searches_used = searches_used - 1, updated_at = NOW()
      WHERE user_id = p_user_id AND date = v_today AND searches_used > 0;
  ELSE
    RETURN jsonb_build_object('refunded', false, 'reason', 'NOTHING_TO_REFUND');
  END IF;

  RETURN jsonb_build_object(
    'refunded', true,
    'used', CASE WHEN v_from_bonus THEN v_row.searches_used ELSE v_row.searches_used - 1 END,
    'from_bonus', v_from_bonus
  );
END $$;

COMMENT ON FUNCTION public.refund_quota(uuid, text) IS
  'parse-mood kendi hatasıyla düşünce 1 search hakkını iade eder (MONEY-1C). '
  'Bonus/normal sayacı 115 tüketim kuralının tersiyle seçer; 0''ın altına inmez. '
  'Yalnız service_role çağırır.';

REVOKE EXECUTE ON FUNCTION public.refund_quota(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refund_quota(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_quota(uuid, text) TO service_role;
-- ===================== 136 TAM METNI (bitis) =====================

-- -- SETUP (postgres): sonuc tablosu + 4 test kullanicisi (free, bonus, legacy, satirsiz)
CREATE TEMP TABLE dryrun_results (test text, result text, detail text);
GRANT ALL ON dryrun_results TO PUBLIC;

DO $t$
DECLARE
  v_free  uuid; v_bonus uuid; v_legacy uuid; v_norow uuid;
BEGIN
  INSERT INTO public.users (auth_id) VALUES (gen_random_uuid()::text) RETURNING id INTO v_free;
  INSERT INTO public.users (auth_id) VALUES (gen_random_uuid()::text) RETURNING id INTO v_bonus;
  INSERT INTO public.users (auth_id, legacy_mood_access) VALUES (gen_random_uuid()::text, true) RETURNING id INTO v_legacy;
  INSERT INTO public.users (auth_id) VALUES (gen_random_uuid()::text) RETURNING id INTO v_norow;
  PERFORM set_config('dryrun.free',   v_free::text,   true);
  PERFORM set_config('dryrun.bonus',  v_bonus::text,  true);
  PERFORM set_config('dryrun.legacy', v_legacy::text, true);
  PERFORM set_config('dryrun.norow',  v_norow::text,  true);
  INSERT INTO dryrun_results VALUES ('00_setup', 'INFO',
    'free=' || v_free || ' bonus=' || v_bonus || ' legacy=' || v_legacy || ' norow=' || v_norow
    || ' free_limit=' || (SELECT daily_search_limit FROM public.subscription_limits WHERE tier = 'free'));
EXCEPTION WHEN OTHERS THEN
  INSERT INTO dryrun_results VALUES ('00_setup', 'FAIL', SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T1: tuket -> iade -> sayac geri doner (free)
DO $t$
DECLARE
  v_id uuid := current_setting('dryrun.free')::uuid;
  v_c jsonb; v_r jsonb; v_used int;
BEGIN
  SET LOCAL ROLE service_role;
  v_c := public.check_and_consume_quota(v_id, 'search');
  v_r := public.refund_quota(v_id, 'search');
  RESET ROLE;
  SELECT searches_used INTO v_used FROM public.user_daily_quotas WHERE user_id = v_id AND date = CURRENT_DATE;
  IF (v_c->>'allowed')::boolean AND (v_r->>'refunded')::boolean AND v_used = 0 AND (v_r->>'used')::int = 0 THEN
    INSERT INTO dryrun_results VALUES ('T1', 'PASS', 'tuket+iade: searches_used=0');
  ELSE
    INSERT INTO dryrun_results VALUES ('T1', 'FAIL', 'consume=' || v_c || ' refund=' || v_r || ' used=' || coalesce(v_used::text, 'NULL'));
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T1', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T2: iade edilecek bir sey yokken sayac eksiye inmez
DO $t$
DECLARE
  v_id uuid := current_setting('dryrun.free')::uuid;
  v_r jsonb; v_used int;
BEGIN
  SET LOCAL ROLE service_role;
  v_r := public.refund_quota(v_id, 'search');
  RESET ROLE;
  SELECT searches_used INTO v_used FROM public.user_daily_quotas WHERE user_id = v_id AND date = CURRENT_DATE;
  IF NOT (v_r->>'refunded')::boolean AND v_r->>'reason' = 'NOTHING_TO_REFUND' AND v_used = 0 THEN
    INSERT INTO dryrun_results VALUES ('T2', 'PASS', 'NOTHING_TO_REFUND, searches_used=0');
  ELSE
    INSERT INTO dryrun_results VALUES ('T2', 'FAIL', 'refund=' || v_r || ' used=' || coalesce(v_used::text, 'NULL'));
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T2', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T3: limite kadar tuket, bir sonraki RED, iade, tekrar IZIN (iade hakki gercekten geri verir)
DO $t$
DECLARE
  v_id uuid := current_setting('dryrun.free')::uuid;
  v_limit int; i int; v_c jsonb; v_denied jsonb; v_r jsonb; v_again jsonb;
BEGIN
  SELECT daily_search_limit INTO v_limit FROM public.subscription_limits WHERE tier = 'free';
  SET LOCAL ROLE service_role;
  FOR i IN 1..v_limit LOOP
    v_c := public.check_and_consume_quota(v_id, 'search');
  END LOOP;
  v_denied := public.check_and_consume_quota(v_id, 'search');
  v_r := public.refund_quota(v_id, 'search');
  v_again := public.check_and_consume_quota(v_id, 'search');
  RESET ROLE;
  IF (v_c->>'allowed')::boolean
     AND NOT (v_denied->>'allowed')::boolean AND v_denied->>'error' = 'QUOTA_EXCEEDED'
     AND (v_r->>'refunded')::boolean
     AND (v_again->>'allowed')::boolean THEN
    INSERT INTO dryrun_results VALUES ('T3', 'PASS', 'limit=' || v_limit || ': dolu->RED->iade->IZIN');
  ELSE
    INSERT INTO dryrun_results VALUES ('T3', 'FAIL', 'denied=' || v_denied || ' refund=' || v_r || ' again=' || v_again);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T3', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T4: bonus tuketimi bonus sayacindan iade edilir, searches_used'a dokunulmaz
DO $t$
DECLARE
  v_id uuid := current_setting('dryrun.bonus')::uuid;
  v_limit int; v_c jsonb; v_r jsonb; v_s int; v_b int;
BEGIN
  SELECT daily_search_limit INTO v_limit FROM public.subscription_limits WHERE tier = 'free';
  INSERT INTO public.user_daily_quotas (user_id, date, searches_used, bonus_searches_earned, bonus_searches_used)
    VALUES (v_id, CURRENT_DATE, v_limit, 2, 0);
  SET LOCAL ROLE service_role;
  v_c := public.check_and_consume_quota(v_id, 'search');   -- bonus'tan duser
  v_r := public.refund_quota(v_id, 'search');
  RESET ROLE;
  SELECT searches_used, bonus_searches_used INTO v_s, v_b FROM public.user_daily_quotas WHERE user_id = v_id AND date = CURRENT_DATE;
  IF (v_c->>'allowed')::boolean AND (v_r->>'refunded')::boolean AND (v_r->>'from_bonus')::boolean
     AND v_s = v_limit AND v_b = 0 THEN
    INSERT INTO dryrun_results VALUES ('T4', 'PASS', 'from_bonus=true, bonus_used=0, searches_used=' || v_s);
  ELSE
    INSERT INTO dryrun_results VALUES ('T4', 'FAIL', 'consume=' || v_c || ' refund=' || v_r || ' searches_used=' || v_s || ' bonus_used=' || v_b);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T4', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T5: legacy (sinirsiz) kohort: sayac artar, iade geri alir
DO $t$
DECLARE
  v_id uuid := current_setting('dryrun.legacy')::uuid;
  v_c jsonb; v_r jsonb; v_used int;
BEGIN
  SET LOCAL ROLE service_role;
  v_c := public.check_and_consume_quota(v_id, 'search');
  v_r := public.refund_quota(v_id, 'search');
  RESET ROLE;
  SELECT searches_used INTO v_used FROM public.user_daily_quotas WHERE user_id = v_id AND date = CURRENT_DATE;
  IF (v_c->>'limit')::int = 999999 AND (v_r->>'refunded')::boolean AND v_used = 0 THEN
    INSERT INTO dryrun_results VALUES ('T5', 'PASS', 'legacy: limit=999999, iade sonrasi searches_used=0');
  ELSE
    INSERT INTO dryrun_results VALUES ('T5', 'FAIL', 'consume=' || v_c || ' refund=' || v_r || ' used=' || coalesce(v_used::text, 'NULL'));
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T5', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T6: kenar durumlar (kullanici yok / gecersiz tip / bugun satiri yok)
DO $t$
DECLARE
  v_a jsonb; v_b jsonb; v_c jsonb;
BEGIN
  SET LOCAL ROLE service_role;
  v_a := public.refund_quota(gen_random_uuid(), 'search');
  v_b := public.refund_quota(current_setting('dryrun.free')::uuid, 'slot');
  v_c := public.refund_quota(current_setting('dryrun.norow')::uuid, 'search');
  RESET ROLE;
  IF v_a->>'reason' = 'USER_NOT_FOUND' AND v_b->>'reason' = 'INVALID_QUOTA_TYPE' AND v_c->>'reason' = 'NO_QUOTA_ROW'
     AND NOT (v_a->>'refunded')::boolean AND NOT (v_b->>'refunded')::boolean AND NOT (v_c->>'refunded')::boolean THEN
    INSERT INTO dryrun_results VALUES ('T6', 'PASS', 'USER_NOT_FOUND / INVALID_QUOTA_TYPE / NO_QUOTA_ROW');
  ELSE
    INSERT INTO dryrun_results VALUES ('T6', 'FAIL', 'a=' || v_a || ' b=' || v_b || ' c=' || v_c);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T6', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T7a / T7b: authenticated ve anon EXECUTE edemez (42501)
DO $t$
BEGIN
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.refund_quota(current_setting('dryrun.free')::uuid, 'search');
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T7a', 'FAIL', 'authenticated CAGIRABILDI, 42501 bekleniyordu');
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T7a', 'PASS', 'authenticated: 42501');
  END;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T7a', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

DO $t$
BEGIN
  SET LOCAL ROLE anon;
  BEGIN
    PERFORM public.refund_quota(current_setting('dryrun.free')::uuid, 'search');
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T7b', 'FAIL', 'anon CAGIRABILDI, 42501 bekleniyordu');
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    INSERT INTO dryrun_results VALUES ('T7b', 'PASS', 'anon: 42501');
  END;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T7b', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T8: katalog durumu: SECURITY DEFINER, sabit search_path, ACL yalniz postgres + service_role
DO $t$
DECLARE
  v_def boolean; v_cfg text[]; v_acl text;
BEGIN
  SELECT prosecdef, proconfig, proacl::text INTO v_def, v_cfg, v_acl
    FROM pg_proc WHERE oid = 'public.refund_quota(uuid, text)'::regprocedure;
  IF v_def AND v_cfg @> ARRAY['search_path=public, pg_temp']
     AND v_acl LIKE '%service_role=X/%' AND v_acl NOT LIKE '%anon=%' AND v_acl NOT LIKE '%authenticated=%'
     AND v_acl NOT LIKE '{=%' AND v_acl NOT LIKE '%,=X/%' THEN
    INSERT INTO dryrun_results VALUES ('T8', 'PASS', 'prosecdef=true, search_path sabit, acl=' || v_acl);
  ELSE
    INSERT INTO dryrun_results VALUES ('T8', 'FAIL', 'prosecdef=' || v_def || ' config=' || coalesce(v_cfg::text, 'NULL') || ' acl=' || coalesce(v_acl, 'NULL'));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO dryrun_results VALUES ('T8', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
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
