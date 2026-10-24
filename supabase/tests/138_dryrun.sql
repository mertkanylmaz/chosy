-- ============================================================
-- 138 DRY-RUN (MONEY-1C)
-- TEK islem: BEGIN; <138 tam metni>; <testler>; SELECT sonuclar; ROLLBACK. Kalici degisiklik birakmaz.
-- Test satirlari user_id='dr138-*' ile yazilir; cleanup canli satirlari da siler ama islem geri alinir.
-- Son satir: test='zz_summary', result='ALL PASS' | 'FAILURES'.
-- Kaynak: supabase/migrations/138_rate_limit_daily_retention.sql (asagiya AYNEN gomulu).
-- ============================================================
BEGIN;

-- Oncesi: ACL / sahip / ayarlar (migration SONRASI ile karsilastirilir)
CREATE TEMP TABLE _pre AS
  SELECT proacl::text AS acl, proowner::regrole::text AS owner, prosecdef AS sd
  FROM pg_proc WHERE oid = 'public.cleanup_rate_limits()'::regprocedure;

-- ===================== 138 TAM METNI (baslangic) =====================
-- ============================================================================
-- 138 — cleanup_rate_limits: '*-daily' sayaçları 48 saat saklanır (MONEY-1C)
--
-- SORUN: cleanup_rate_limits() (cron `cleanup-rate-limits`, her saat başı)
--   `window_start < NOW() - 1 saat` satırlarını siliyor. Günlük bir sayaç
--   (pencere = UTC gün başı) 1 saat sonra silinir ve sayaç SIFIRLANIR — günlük
--   limit fiilen "saatte bir sıfırlanan limit" olur. rerank-films günlük sınırı
--   (free 15 / premium+legacy 60) bu yüzden saklama süresini uzatmadan çalışmaz.
--
-- ÇÖZÜM: function_name '-daily' ile BİTEN satırlar 48 saat, diğerleri AYNEN 1 saat.
--   48 saat: pencere UTC gün başında açılır; gün boyunca (24 sa) + gece yarısı
--   sınırı payı için yeterli, tablo şişmez (kimlik × günlük-fonksiyon sayısı).
--
-- SÖZLEŞME: günlük sayaç yazan her kod fonksiyon adını '-daily' ile bitirmek
--   zorundadır (`_shared/rateLimit.ts` checkDailyLimit bunu zorlar).
--
-- DAVRANIŞ DEĞİŞMEZ: 1 saatlik tüm mevcut sayaçlar (parse-mood, rerank-films,
--   recommend, ...) aynı silinir. İmza, sahip ve ACL aynı (CREATE OR REPLACE ACL'i
--   korur). Tek ek: `SET search_path = public, pg_temp` (SECURITY DEFINER
--   sertleştirmesi; gövdede tablo zaten şema nitelemeli, çözümleme değişmez).
--
-- GERİ ALMA: repo dışı kopya (138_rollback.sql) eski gövdeyi geri yazar.
-- UYGULAMA: `supabase db push`.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.api_rate_limits
  WHERE window_start < NOW() - CASE
    WHEN function_name LIKE '%-daily' THEN INTERVAL '48 hours'
    ELSE INTERVAL '1 hour'
  END;
END;
$$;
-- ===================== 138 TAM METNI (bitis) =====================

CREATE TEMP TABLE dryrun_results (test text, result text, detail text);
GRANT ALL ON dryrun_results TO PUBLIC;

-- -- SETUP: yas/fonksiyon kombinasyonlari
INSERT INTO public.api_rate_limits (user_id, function_name, window_start, request_count) VALUES
  ('dr138-a', 'rerank-films-daily', now() - interval '47 hours', 3),   -- KALIR
  ('dr138-b', 'rerank-films-daily', now() - interval '49 hours', 3),   -- SILINIR
  ('dr138-c', 'rerank-films-daily', now() - interval '2 hours',  3),   -- KALIR (gunluk, 2 sa < 48 sa)
  ('dr138-d', 'parse-mood',         now() - interval '30 minutes', 1), -- KALIR
  ('dr138-e', 'parse-mood',         now() - interval '2 hours',  1),   -- SILINIR
  ('dr138-f', 'rerank-films',       now() - interval '2 hours',  1),   -- SILINIR (dakikalik, '-daily' degil)
  ('dr138-g', 'x-daily-extra',      now() - interval '2 hours',  1),   -- SILINIR ('-daily' ile BITMIYOR)
  ('dr138-h', 'foo-daily',          now() - interval '49 hours', 1);   -- SILINIR (herhangi '-daily' son eki, 48 sa asildi)

SELECT public.cleanup_rate_limits();

-- -- T1: saklama kurali
DO $t$
DECLARE v_left text; v_expect text := 'dr138-a,dr138-c,dr138-d';
BEGIN
  SELECT string_agg(user_id, ',' ORDER BY user_id) INTO v_left
    FROM public.api_rate_limits WHERE user_id LIKE 'dr138-%';
  IF v_left = v_expect THEN
    INSERT INTO dryrun_results VALUES ('T1_retention', 'PASS', 'kalan=' || v_left);
  ELSE
    INSERT INTO dryrun_results VALUES ('T1_retention', 'FAIL', 'kalan=' || coalesce(v_left, 'NULL') || ' beklenen=' || v_expect);
  END IF;
END
$t$;

-- -- T2: increment_rate_limit '-daily' adiyla gunluk pencerede artar
DO $t$
DECLARE v_ws timestamptz := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'; v1 int; v2 int;
BEGIN
  v1 := public.increment_rate_limit('dr138-z', 'rerank-films-daily', v_ws);
  v2 := public.increment_rate_limit('dr138-z', 'rerank-films-daily', v_ws);
  PERFORM public.cleanup_rate_limits();
  IF v1 = 1 AND v2 = 2
     AND (SELECT request_count FROM public.api_rate_limits WHERE user_id = 'dr138-z' AND function_name = 'rerank-films-daily') = 2 THEN
    INSERT INTO dryrun_results VALUES ('T2_daily_counter', 'PASS', 'sayac 1,2; cleanup sonrasi satir duruyor');
  ELSE
    INSERT INTO dryrun_results VALUES ('T2_daily_counter', 'FAIL', 'v1=' || v1 || ' v2=' || v2);
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO dryrun_results VALUES ('T2_daily_counter', 'FAIL', 'beklenmeyen: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T3: imza/sahip/ACL ayni, SECURITY DEFINER, search_path sabit
DO $t$
DECLARE v_acl text; v_owner text; v_sd boolean; v_cfg text[]; p _pre%ROWTYPE;
BEGIN
  SELECT * INTO p FROM _pre;
  SELECT proacl::text, proowner::regrole::text, prosecdef, proconfig INTO v_acl, v_owner, v_sd, v_cfg
    FROM pg_proc WHERE oid = 'public.cleanup_rate_limits()'::regprocedure;
  IF v_acl IS NOT DISTINCT FROM p.acl AND v_owner = p.owner AND v_sd AND v_cfg @> ARRAY['search_path=public, pg_temp'] THEN
    INSERT INTO dryrun_results VALUES ('T3_catalog', 'PASS', 'owner=' || v_owner || ' acl degismedi, search_path sabit');
  ELSE
    INSERT INTO dryrun_results VALUES ('T3_catalog', 'FAIL', 'acl_ayni=' || (v_acl IS NOT DISTINCT FROM p.acl) || ' owner=' || v_owner || ' sd=' || v_sd || ' cfg=' || coalesce(v_cfg::text, 'NULL'));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO dryrun_results VALUES ('T3_catalog', 'FAIL', 'beklenmeyen: ' || SQLERRM || ' (' || SQLSTATE || ')');
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
