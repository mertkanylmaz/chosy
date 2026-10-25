-- ============================================================
-- 140 DRY-RUN (MONEY-1C) — mood_searches gereksiz tablo yetkileri
-- TEK islem: BEGIN; <140 tam metni>; <testler>; RAISE EXCEPTION 'DRYRUN_RESULTS ...'; ROLLBACK. Kalici degisiklik birakmaz.
-- 139dan bagimsiz: 139 uygulanmamisken de uygulanmisken de gecmeli (SELECT/INSERT/UPDATE yetkileri 140 oncesi/sonrasi AYNI olmali).
-- DURUM: HAZIRLANDI, CANLI DBye KARSI CALISTIRILMADI (acik onay ister).
-- ============================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TEMP TABLE dryrun_results (test text, result text, detail text);
GRANT ALL ON dryrun_results TO PUBLIC;
-- 140 oncesi anlik goruntu: 140 disindaki yetkiler degismemeli
CREATE TEMP TABLE priv_before AS
SELECT r.rolname, p.priv, has_table_privilege(r.rolname, 'public.mood_searches', p.priv) AS had
FROM (VALUES ('anon'), ('authenticated'), ('service_role')) r(rolname),
     (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p(priv);
GRANT ALL ON priv_before TO PUBLIC;
CREATE TEMP TABLE colpriv_before AS
SELECT r.rolname, c.column_name, o.priv, has_column_privilege(r.rolname, 'public.mood_searches', c.column_name, o.priv) AS had
FROM (VALUES ('anon'), ('authenticated')) r(rolname),
     (SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'mood_searches') c,
     (VALUES ('INSERT'), ('UPDATE')) o(priv);

-- ===================== 140 TAM METNI (baslangic) =====================
-- ============================================================================
-- 140 — mood_searches: istemci rollerinden gereksiz tablo yetkileri (MONEY-1C)
--
-- BULGU (25 Eki, canlı): `anon` ve `authenticated` public tablolarda Supabase varsayılan
-- yetkileriyle DELETE, TRUNCATE, REFERENCES, TRIGGER taşıyor. RLS yalnız satır erişimini
-- (SELECT/INSERT/UPDATE/DELETE) süzer; TRUNCATE RLS'i ATLAR. PostgREST TRUNCATE sunmaz, yani
-- bugün istismar yolu yok — ama yetki hiçbir istemciye gerekmiyor (derinlemesine savunma).
--
-- KAPSAM: yalnız public.mood_searches. Diğer tablolar için öneri raporu:
--   docs/investigations/MONEY-1C_GRANTS_AUDIT.md (karar bekler; bu migration onlara DOKUNMAZ).
--
-- DOĞRULAMA: 2.1.0–2.1.3 istemcileri mood_searches'te yalnız SELECT/INSERT/UPDATE kullanır
-- (delete yok). Hesap silme (delete-account) service_role ile çalışır; service_role ve postgres
-- yetkileri DEĞİŞMEZ. users → mood_searches FK'sinin ON DELETE CASCADE'i tablo sahibi
-- yetkisiyle çalışır, etkilenmez.
--
-- 139'dan BAĞIMSIZ: INSERT/UPDATE/SELECT yetkilerine dokunmaz (139 onları daraltır).
-- GERİ ALMA: repo dışı kopya (140_rollback.sql) — dört yetkiyi geri verir; veri etkisi yok.
-- ============================================================================

REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.mood_searches FROM anon, authenticated;

-- ===================== 140 TAM METNI (bitis) =====================

-- T1: anon/authenticated icin dort yetki GITTI (tablo duzeyi)
DO $t$
DECLARE r text; p text; bad text := '';
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    FOREACH p IN ARRAY ARRAY['DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
      IF has_table_privilege(r, 'public.mood_searches', p) THEN bad := bad || ' ' || r || ':' || p; END IF;
    END LOOP;
  END LOOP;
  INSERT INTO dryrun_results VALUES ('T1', CASE WHEN bad = '' THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN bad = '' THEN '8/8 yetki kalkti (anon, authenticated x DELETE/TRUNCATE/REFERENCES/TRIGGER)' ELSE 'kalan:' || bad END);
END $t$;

-- T2: 140 disindaki yetkiler DEGISMEDI (tablo + kolon duzeyi), service_role dahil
DO $t$
DECLARE bad text := ''; rec record;
BEGIN
  FOR rec IN SELECT * FROM priv_before WHERE priv IN ('SELECT','INSERT','UPDATE') OR rolname = 'service_role' LOOP
    IF has_table_privilege(rec.rolname, 'public.mood_searches', rec.priv) IS DISTINCT FROM rec.had THEN
      bad := bad || ' ' || rec.rolname || ':' || rec.priv;
    END IF;
  END LOOP;
  FOR rec IN SELECT * FROM colpriv_before LOOP
    IF has_column_privilege(rec.rolname, 'public.mood_searches', rec.column_name, rec.priv) IS DISTINCT FROM rec.had THEN
      bad := bad || ' ' || rec.rolname || ':' || rec.priv || ':' || rec.column_name;
    END IF;
  END LOOP;
  INSERT INTO dryrun_results VALUES ('T2', CASE WHEN bad = '' THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN bad = '' THEN 'SELECT/INSERT/UPDATE (tablo+kolon) ve service_role degismedi' ELSE 'degisen:' || bad END);
END $t$;

-- T3: authenticated fiilen DELETE / TRUNCATE yapamaz (42501); eski istemci sekilleri (insert{user_id}, update 2 kolon) CALISIR
DO $t$
DECLARE
  u uuid; v_id uuid; v_n int; v_fail text := ''; v_del boolean := false; v_trunc boolean := false;
BEGIN
  INSERT INTO public.users (auth_id) VALUES (gen_random_uuid()::text) RETURNING id INTO u;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', (SELECT auth_id FROM public.users WHERE id = u), 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO public.mood_searches (user_id) VALUES (u) RETURNING id INTO v_id;
    UPDATE public.mood_searches SET recommended_film_ids = ARRAY[]::uuid[], rpc_version = 'v1' WHERE id = v_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 1 THEN v_fail := v_fail || ' update_rows=' || v_n; END IF;
  EXCEPTION WHEN OTHERS THEN v_fail := v_fail || ' old_client:' || SQLERRM;
  END;
  BEGIN DELETE FROM public.mood_searches WHERE id = v_id; v_fail := v_fail || ' delete_ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN v_del := true; END;
  BEGIN TRUNCATE public.mood_searches; v_fail := v_fail || ' truncate_ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN v_trunc := true; END;
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T3', CASE WHEN v_fail = '' AND v_del AND v_trunc THEN 'PASS' ELSE 'FAIL' END,
    CASE WHEN v_fail = '' AND v_del AND v_trunc THEN 'eski istemci insert/update calisti; DELETE ve TRUNCATE 42501' ELSE v_fail || ' del=' || v_del || ' trunc=' || v_trunc END);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T3', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END $t$;

-- T4: service_role hala siler (delete-account); kullanici silinince FK CASCADE mood_searches satirlarini siler
DO $t$
DECLARE u uuid; u2 uuid; a int; b int; c int;
BEGIN
  INSERT INTO public.users (auth_id) VALUES (gen_random_uuid()::text) RETURNING id INTO u;
  INSERT INTO public.users (auth_id) VALUES (gen_random_uuid()::text) RETURNING id INTO u2;
  INSERT INTO public.mood_searches (user_id) VALUES (u), (u2);
  SET LOCAL ROLE service_role;
  DELETE FROM public.mood_searches WHERE user_id = u;
  GET DIAGNOSTICS a = ROW_COUNT;
  RESET ROLE;
  DELETE FROM public.users WHERE id = u2;
  SELECT count(*) INTO b FROM public.mood_searches WHERE user_id = u2;
  SELECT count(*) INTO c FROM public.mood_searches WHERE user_id = u;
  INSERT INTO dryrun_results VALUES ('T4', CASE WHEN a = 1 AND b = 0 AND c = 0 THEN 'PASS' ELSE 'FAIL' END,
    'service_role sildi=' || a || ', cascade kalan=' || b || ', kalan(u)=' || c);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T4', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
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
