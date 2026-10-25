-- ============================================================
-- 141 DRY-RUN (MONEY-1C) — public tablolarda istemci yetki daraltma
-- TEK islem: BEGIN; <141 tam metni>; <testler>; RAISE EXCEPTION 'DRYRUN_RESULTS ...'; ROLLBACK. Kalici degisiklik birakmaz.
-- Kanit: 141 oncesi/sonrasi TUM public tablolar icin (tablo, rol, yetki) karsilastirmasi; yalnizca beklenen YETKI KALDIRMALARI olmali.
-- DURUM: canli DBye karsi BEGIN..RAISE dry-run olarak kosuldu (25 Eki): 5/5 PASS, 306 yetki kaldirildi, ACL md5 oncesi=sonrasi; apply YOK.
-- ============================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TEMP TABLE dryrun_results (test text, result text, detail text);
GRANT ALL ON dryrun_results TO PUBLIC;
CREATE TEMP TABLE priv_before AS
SELECT c.relname AS tbl, r.rolname, p.priv, has_table_privilege(r.rolname, c.oid, p.priv) AS had
FROM pg_class c,
     (VALUES ('anon'), ('authenticated'), ('service_role')) r(rolname),
     (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p(priv)
WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p');
GRANT ALL ON priv_before TO PUBLIC;

-- ===================== 141 TAM METNI (baslangic) =====================
-- ============================================================================
-- 141 — public tablolarda istemci rollerinin gereksiz yetkilerini kaldır (MONEY-1C)
--
-- (a) TÜM public tablolar: anon + authenticated'tan TRUNCATE, REFERENCES, TRIGGER.
--     TRUNCATE RLS'i atlar; PostgREST üç yetkiyi de sunmaz → istemci etkisi YOK.
-- (b) app_config, subscription_limits, promo_codes, lifetime_sales: anon + authenticated'tan
--     INSERT, UPDATE, DELETE. İstemci bu dört tabloyu yalnız OKUR (app_config SELECT;
--     2.1.0–2.1.3 tag'lerinde başka erişim yok, 25 Eki taraması). Yazan SECURITY DEFINER
--     fonksiyonlar (claim_lifetime_spot, increment_promo_usage; sahip postgres) ve service_role
--     bu migration'dan ETKİLENMEZ.
--
-- DOKUNULMAYAN: SELECT yetkileri (okuma RLS ile), diğer tabloların INSERT/UPDATE/DELETE yetkileri
-- (anon yazma yetkileri ayrı iş — docs/TEKNIK_BORC.md), service_role, postgres, görünümler (view).
-- Kaynak/gerekçe: docs/investigations/MONEY-1C_GRANTS_AUDIT.md. 140 (mood_searches) ile örtüşme
-- zararsız: REVOKE idempotent.
-- GERİ ALMA: repo dışı kopya (141_rollback.sql) — dört+üç yetkiyi geri verir; veri etkisi yok.
-- ============================================================================

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relkind IN ('r', 'p')
    ORDER BY c.relname
  LOOP
    EXECUTE format('REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM anon, authenticated', r.relname);
  END LOOP;
END
$$;

REVOKE INSERT, UPDATE, DELETE ON public.app_config FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.subscription_limits FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.promo_codes FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.lifetime_sales FROM anon, authenticated;

-- ===================== 141 TAM METNI (bitis) =====================

CREATE TEMP TABLE priv_after AS
SELECT c.relname AS tbl, r.rolname, p.priv, has_table_privilege(r.rolname, c.oid, p.priv) AS had
FROM pg_class c,
     (VALUES ('anon'), ('authenticated'), ('service_role')) r(rolname),
     (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p(priv)
WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p');

-- T1: hicbir public tabloda anon/authenticated icin TRUNCATE/REFERENCES/TRIGGER kalmadi
DO $t$
DECLARE n int; tot int;
BEGIN
  SELECT count(*) INTO n FROM priv_after WHERE rolname IN ('anon','authenticated') AND priv IN ('TRUNCATE','REFERENCES','TRIGGER') AND had;
  SELECT count(DISTINCT tbl) INTO tot FROM priv_after;
  INSERT INTO dryrun_results VALUES ('T1', CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END, 'kalan=' || n || ' (tablo sayisi ' || tot || ')');
END $t$;

-- T2: 4 tabloda anon/authenticated icin INSERT/UPDATE/DELETE kalmadi; SELECT ayni
DO $t$
DECLARE n int; sel_changed int;
BEGIN
  SELECT count(*) INTO n FROM priv_after
   WHERE tbl IN ('app_config','subscription_limits','promo_codes','lifetime_sales')
     AND rolname IN ('anon','authenticated') AND priv IN ('INSERT','UPDATE','DELETE') AND had;
  SELECT count(*) INTO sel_changed FROM priv_before b JOIN priv_after a USING (tbl, rolname, priv)
   WHERE b.priv = 'SELECT' AND b.had IS DISTINCT FROM a.had;
  INSERT INTO dryrun_results VALUES ('T2', CASE WHEN n = 0 AND sel_changed = 0 THEN 'PASS' ELSE 'FAIL' END,
    'kalan yazma yetkisi=' || n || ', degisen SELECT=' || sel_changed);
END $t$;

-- T3: TAM fark kontrolu: degisen her (tablo, rol, yetki) bir KALDIRMA ve beklenen kumede; service_role degismedi; baska hicbir sey degismedi
DO $t$
DECLARE granted int; unexpected int; svc int; removed int; unexpected_list text;
BEGIN
  SELECT count(*) INTO granted FROM priv_before b JOIN priv_after a USING (tbl, rolname, priv) WHERE NOT b.had AND a.had;
  SELECT count(*) INTO svc FROM priv_before b JOIN priv_after a USING (tbl, rolname, priv) WHERE b.rolname = 'service_role' AND b.had IS DISTINCT FROM a.had;
  SELECT count(*) INTO removed FROM priv_before b JOIN priv_after a USING (tbl, rolname, priv) WHERE b.had AND NOT a.had;
  SELECT count(*), string_agg(tbl || ':' || rolname || ':' || priv, ' ') INTO unexpected, unexpected_list
    FROM priv_before b JOIN priv_after a USING (tbl, rolname, priv)
   WHERE b.had AND NOT a.had
     AND NOT (priv IN ('TRUNCATE','REFERENCES','TRIGGER')
              OR (tbl IN ('app_config','subscription_limits','promo_codes','lifetime_sales') AND priv IN ('INSERT','UPDATE','DELETE')));
  INSERT INTO dryrun_results VALUES ('T3', CASE WHEN granted = 0 AND svc = 0 AND unexpected = 0 THEN 'PASS' ELSE 'FAIL' END,
    'kaldirilan=' || removed || ', yeni verilen=' || granted || ', service_role degisen=' || svc || ', beklenmeyen kaldirma=' || unexpected || coalesce(' [' || unexpected_list || ']', ''));
END $t$;

-- T4: fiili davranis: authenticated app_config OKUYABILIR, YAZAMAZ/SILEMEZ/TRUNCATE EDEMEZ (42501); service_role yazma yetkisi duruyor
DO $t$
DECLARE v_fail text := ''; v_read boolean := false; op text;
BEGIN
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM count(*) FROM public.app_config; v_read := true;
  EXCEPTION WHEN OTHERS THEN v_fail := v_fail || ' read:' || SQLERRM; END;
  FOREACH op IN ARRAY ARRAY['INSERT INTO public.app_config DEFAULT VALUES',
                            'UPDATE public.app_config SET key = key WHERE false',
                            'DELETE FROM public.app_config WHERE false',
                            'TRUNCATE public.app_config',
                            'INSERT INTO public.promo_codes DEFAULT VALUES',
                            'UPDATE public.subscription_limits SET tier = tier WHERE false',
                            'DELETE FROM public.lifetime_sales WHERE false'] LOOP
    BEGIN EXECUTE op; v_fail := v_fail || ' ALLOWED[' || op || ']';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
              WHEN OTHERS THEN v_fail := v_fail || ' other(' || SQLSTATE || ')[' || op || ']'; END;
  END LOOP;
  RESET ROLE;
  SET LOCAL ROLE anon;
  BEGIN EXECUTE 'UPDATE public.app_config SET key = key WHERE false'; v_fail := v_fail || ' ALLOWED_ANON_UPDATE';
  EXCEPTION WHEN insufficient_privilege THEN NULL; WHEN OTHERS THEN v_fail := v_fail || ' anon_other(' || SQLSTATE || ')'; END;
  RESET ROLE;
  SET LOCAL ROLE service_role;
  BEGIN EXECUTE 'UPDATE public.app_config SET key = key WHERE false'; EXECUTE 'DELETE FROM public.promo_codes WHERE false';
  EXCEPTION WHEN OTHERS THEN v_fail := v_fail || ' service_role:' || SQLERRM; END;
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T4', CASE WHEN v_read AND v_fail = '' THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN v_read AND v_fail = '' THEN 'okuma serbest; yazma/silme/TRUNCATE 42501; service_role calisiyor' ELSE 'read=' || v_read || v_fail END);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T4', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END $t$;

-- T5: yazan SECURITY DEFINER fonksiyonlar etkilenmedi (sahip yetkisiyle calisir). Fonksiyon yoksa (stub) atlanir.
DO $t$
DECLARE v_detail text := ''; v_fail text := ''; n bigint;
BEGIN
  IF to_regprocedure('public.increment_promo_usage(text)') IS NOT NULL THEN
    IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = to_regprocedure('public.increment_promo_usage(text)')) THEN
      v_fail := v_fail || ' increment_promo_usage_not_definer';
    END IF;
    PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}', true);
    SET LOCAL ROLE authenticated;
    BEGIN PERFORM public.increment_promo_usage('__dryrun_nonexistent_code__'); v_detail := v_detail || ' increment_promo_usage(ok)';
    EXCEPTION WHEN OTHERS THEN v_fail := v_fail || ' increment_promo_usage:' || SQLERRM; END;
    RESET ROLE;
  ELSE v_detail := v_detail || ' increment_promo_usage(yok-atlandi)'; END IF;
  IF to_regprocedure('public.claim_lifetime_spot(uuid,numeric,text)') IS NOT NULL THEN
    IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = to_regprocedure('public.claim_lifetime_spot(uuid,numeric,text)')) THEN
      v_fail := v_fail || ' claim_lifetime_spot_not_definer';
    END IF;
    v_detail := v_detail || ' claim_lifetime_spot(definer)';
  ELSE v_detail := v_detail || ' claim_lifetime_spot(yok-atlandi)'; END IF;
  INSERT INTO dryrun_results VALUES ('T5', CASE WHEN v_fail = '' THEN 'PASS' ELSE 'FAIL' END, trim(v_detail || v_fail));
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T5', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
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
