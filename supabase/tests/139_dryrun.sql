-- ============================================================
-- 139 DRY-RUN (MONEY-1C Faz 2b-f)
-- TEK islem: BEGIN; <139 tam metni>; <testler>; SELECT sonuclar; ROLLBACK. Kalici degisiklik birakmaz
-- (test kullanicilari, kolonlar, indeks, fonksiyonlar ve yetki degisiklikleri ROLLBACK ile gider).
-- Sonuclar TEMP TABLE dryrun_results'a yazilir. Son satir: test='zz_summary', result='ALL PASS' | 'FAILURES'.
-- Sonuclar ayrica DRYRUN_RESULTS hata mesaji olarak doner (beklenen: hata ile biter, islem geri alinir).
-- Kaynak: supabase/migrations/139_mood_search_idempotency.sql (asagiya AYNEN gomulu; fark kontrolu: bkz. rapor).
-- DURUM: canli DB'ye karsi calistirma icin hazir (BEGIN..RAISE EXCEPTION; kalici degisiklik birakmaz). Sonuc: bkz. tasarim belgesi bolum 15 (canli: 15/15 PASS, 25 Eki).
--   Yerelde gercek Postgres motoru (pglite) uzerinde stub sema ile calistirildi; bkz. tasarim belgesi bolum 12.
-- Test edilemeyen: gercek eszamanlilik (tek islem) -> supabase/functions/_shared/moodClaim.concurrency.test.ts
-- ============================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ===================== 139 TAM METNI (baslangic) =====================
-- ============================================================================
-- 139 — mood_searches idempotency: claim-first arama sahiplenme (MONEY-1C Faz 2b-f)
--
-- SORUN: parse-mood kotayı LLM'den ÖNCE tüketir (115). İstemci aynı aramayı
-- yeniden gönderirse (15 sn timeout, ağ hatası, 409 yeniden denemesi, satın alma
-- sonrası otomatik yeniden arama) her deneme ayrı bir hak yakar ve ayrı bir
-- ücretli LLM çağrısı yapar. Ücretsiz hak 3 → 1 inince bu "tek hakkın kaybı".
-- Tasarım ve gerekçe: docs/investigations/MONEY-1C_IDEMPOTENCY.md (onaylı, 25 Eki).
--
-- ŞEMA (mood_searches; eski satırlar için backfill YOK — NULL "idempotency öncesi")
--   client_search_id  uuid         istemcinin ürettiği arama kimliği
--   status            text         'pending' | 'completed' | 'failed' (CHECK)
--   claimed_at        timestamptz  son sahiplenme anı (bayat tespiti + sahiplik belirteci)
--   quota_consumed    boolean      bu satır şu an 1 hak tutuyor mu
--   claim_attempts    int          bayat-pending için bedava yeniden-sahiplenme sayacı
--   kısmi UNIQUE (user_id, client_search_id) WHERE client_search_id IS NOT NULL
--
-- RPC'LER (SECURITY DEFINER, search_path = '', yalnız service_role EXECUTE)
--   claim_mood_search(user, client_search_id, mood_text, stale_seconds) → jsonb
--     result: claimed | replay | in_progress | quota_denied | invalid_args | user_not_found
--   finish_mood_search(search_id, claimed_at, status, profile, error_code,
--                      refund, latency_ms, tokens_in, tokens_out) → jsonb {finished, refunded, refund}
--     sahiplik doğrulamalı: zombi istek geç dönerse finished=false ve İADE YAPILMAZ.
--     refund=true ise iade (refund_quota) sahiplik doğrulanınca aynı işlemde yapılır.
--   mood_quota_snapshot(user) → jsonb  (tüketmeden salt okuma: used/limit/tier)
--
-- DURUM MAKİNESİ (claim, tek işlemde; bkz. tasarım belgesi 4.2)
--   yok              → claimed, kota BİR KEZ tüketilir (yetersizse failed/QUOTA_EXCEEDED)
--   completed        → replay (kayıtlı profil, kota yok, LLM yok)
--   pending + taze   → in_progress
--   pending + bayat  → claimed; hak tutuluyorsa ve claim_attempts ≤ 2 ise TÜKETMEZ,
--                      üçüncü bayat sahiplenmede yeniden tüketir
--   failed           → claimed + yeniden tüketir (satın alma sonrası bekleyen arama)
--
-- YETKİ DARALTMA (onaylı): istemci UPDATE yetkisi yalnız recommended_film_ids,
--   rpc_version, error_code kolonlarına, istemci INSERT yetkisi yalnız user_id kolonuna
--   iner (2.1.0–2.1.3 istemcilerinin yazdığı tek kolonlar; upsert yok). Yeni durum
--   kolonları istemciden yazılamaz (migration-guard K-1: bayat-pending ile kota atlatma).
--
-- BİLİNEN SINIRLAR
--   · PARSE_FAILED iade edilmez (refundPolicy); failed + yeniden sahiplenme yeniden tüketir.
--   · Bayat eşiği (45 sn) Anthropic timeout'una (25 sn) dayanır; parse-mood ile birlikte deploy.
--   · Gün sınırı: CURRENT_DATE (UTC), 136 ile aynı.
--
-- GERİ ALMA: repo dışı kopya (139_rollback.sql) — kolonlar düşer, veri kaybı olur.
-- UYGULAMA: `supabase db push` — bu dosya yazıldı, UYGULANMADI.
-- ============================================================================

ALTER TABLE public.mood_searches
  ADD COLUMN client_search_id uuid,
  ADD COLUMN status           text,
  ADD COLUMN claimed_at       timestamptz,
  ADD COLUMN quota_consumed   boolean NOT NULL DEFAULT false,
  ADD COLUMN claim_attempts   integer NOT NULL DEFAULT 0;

ALTER TABLE public.mood_searches
  ADD CONSTRAINT mood_searches_status_check
  CHECK (status IS NULL OR status IN ('pending', 'completed', 'failed'));

ALTER TABLE public.mood_searches
  ADD CONSTRAINT mood_searches_claim_attempts_check
  CHECK (claim_attempts >= 0);

CREATE UNIQUE INDEX mood_searches_user_client_search_uq
  ON public.mood_searches (user_id, client_search_id)
  WHERE client_search_id IS NOT NULL;

COMMENT ON COLUMN public.mood_searches.client_search_id IS
  'İstemcinin ürettiği arama kimliği (idempotency). NULL = idempotency öncesi / eski istemci.';
COMMENT ON COLUMN public.mood_searches.status IS
  'pending | completed | failed. NULL = idempotency öncesi satır. failed satırında error_code dolu.';
COMMENT ON COLUMN public.mood_searches.claimed_at IS
  'Son sahiplenme anı: bayat tespiti ve finish_mood_search sahiplik belirteci.';
COMMENT ON COLUMN public.mood_searches.quota_consumed IS
  'En son sahiplenme denemesi 1 hak tutuyor mu (iade edildiyse veya tüketim reddedildiyse false). '
  'Hak SAYISI değildir: üçüncü bayat sahiplenmede eski hak kaybolur, yenisi tüketilir (belge 4.3).';
COMMENT ON COLUMN public.mood_searches.claim_attempts IS
  'Bayat-pending için bedava yeniden-sahiplenme sayısı; 2''den sonra yeniden tüketir.';

-- ----------------------------------------------------------------------------
-- mood_quota_snapshot: kotayı TÜKETMEDEN okur (check_and_consume_quota çıktısının
-- used/limit/tier şekli). Satır/limit yoksa NULL — çağıran alanları atlar.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mood_quota_snapshot(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tier   text;
  v_legacy boolean;
  v_limit  integer;
  v_q      public.user_daily_quotas%ROWTYPE;
  v_bonus  integer;
BEGIN
  SELECT subscription_tier, COALESCE(legacy_mood_access, false)
    INTO v_tier, v_legacy
    FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT daily_search_limit INTO v_limit
    FROM public.subscription_limits WHERE tier = v_tier;
  IF v_legacy THEN
    v_limit := -1;
  END IF;
  IF v_limit IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_q
    FROM public.user_daily_quotas
    WHERE user_id = p_user_id AND date = CURRENT_DATE;
  v_bonus := COALESCE(v_q.bonus_searches_earned, 0) - COALESCE(v_q.bonus_searches_used, 0);

  RETURN jsonb_build_object(
    'used', COALESCE(v_q.searches_used, 0),
    'limit', CASE WHEN v_limit = -1 THEN 999999 ELSE v_limit + GREATEST(v_bonus, 0) END,
    'tier', v_tier
  );
END $$;

-- ----------------------------------------------------------------------------
-- claim_mood_search
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_mood_search(
  p_user_id         uuid,
  p_client_search_id uuid,
  p_mood_text       text,
  p_stale_seconds   integer DEFAULT 45
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c_free_reclaims CONSTANT integer := 2;
  c_retry_after   CONSTANT integer := 5;
  v_now      timestamptz := clock_timestamp();
  v_stale    integer := GREATEST(COALESCE(p_stale_seconds, 45), 1);
  v_id       uuid;
  v_row      public.mood_searches%ROWTYPE;
  v_consume  boolean := true;
  v_attempts integer := 0;
  v_quota    jsonb;
BEGIN
  IF p_user_id IS NULL OR p_client_search_id IS NULL THEN
    RETURN jsonb_build_object('result', 'invalid_args');
  END IF;

  PERFORM 1 FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('result', 'user_not_found');
  END IF;

  -- Atomik sahiplenme: ilk gelen satırı ekler, diğerleri unique indeksinde bekler
  -- ve bu işlem commit olunca DO NOTHING ile düşer.
  INSERT INTO public.mood_searches
    (user_id, client_search_id, mood_text, status, claimed_at, quota_consumed, claim_attempts)
  VALUES
    (p_user_id, p_client_search_id, left(p_mood_text, 500), 'pending', v_now, false, 0)
  ON CONFLICT (user_id, client_search_id) WHERE client_search_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    -- Mevcut satır: kilitle, yeniden sahiplenmeler seri çalışsın.
    SELECT * INTO v_row
      FROM public.mood_searches
      WHERE user_id = p_user_id AND client_search_id = p_client_search_id
      FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'claim_mood_search: cakisan satir bulunamadi (user %, id %)',
        p_user_id, p_client_search_id USING ERRCODE = 'XX000';
    END IF;

    IF v_row.status = 'completed' THEN
      RETURN jsonb_build_object(
        'result', 'replay',
        'search_id', v_row.id,
        'profile', v_row.parsed_profile,
        'quota', public.mood_quota_snapshot(p_user_id)
      );
    END IF;

    IF v_row.status = 'pending'
       AND v_row.claimed_at > v_now - make_interval(secs => v_stale) THEN
      RETURN jsonb_build_object(
        'result', 'in_progress',
        'search_id', v_row.id,
        'retry_after', c_retry_after
      );
    END IF;

    IF v_row.status = 'pending' THEN
      -- Bayat pending: hak hâlâ tutuluyorsa ve bedava hak bitmediyse tüketme.
      v_attempts := v_row.claim_attempts + 1;
      v_consume := NOT (v_row.quota_consumed AND v_attempts <= c_free_reclaims);
    ELSE
      -- failed (veya status NULL bir satır): yeni deneme yeni hak ister.
      v_attempts := 0;
      v_consume := true;
    END IF;

    v_id := v_row.id;
    UPDATE public.mood_searches
      SET status = 'pending',
          claimed_at = v_now,
          claim_attempts = v_attempts,
          error_code = NULL,
          parsed_profile = NULL,
          mood_text = left(p_mood_text, 500),
          updated_at = now()
      WHERE id = v_id;
  END IF;

  IF v_consume THEN
    v_quota := public.check_and_consume_quota(p_user_id, 'search');
    IF COALESCE((v_quota ->> 'allowed')::boolean, false) IS NOT TRUE THEN
      UPDATE public.mood_searches
        SET status = 'failed',
            error_code = COALESCE(v_quota ->> 'error', 'QUOTA_UNAVAILABLE'),
            quota_consumed = false,
            updated_at = now()
        WHERE id = v_id;
      RETURN jsonb_build_object('result', 'quota_denied', 'search_id', v_id, 'quota', v_quota);
    END IF;
    UPDATE public.mood_searches
      SET quota_consumed = true, updated_at = now()
      WHERE id = v_id;
  ELSE
    v_quota := public.mood_quota_snapshot(p_user_id);
  END IF;

  RETURN jsonb_build_object(
    'result', 'claimed',
    'search_id', v_id,
    'claimed_at', v_now,
    'claim_attempts', v_attempts,
    'quota', v_quota
  );
END $$;

-- ----------------------------------------------------------------------------
-- finish_mood_search: sahiplik doğrulamalı sonuç yazımı
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finish_mood_search(
  p_search_id  uuid,
  p_claimed_at timestamptz,
  p_status     text,
  p_profile    jsonb,
  p_error_code text,
  p_refund     boolean,
  p_latency_ms integer,
  p_tokens_in  integer,
  p_tokens_out integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user     uuid;
  v_consumed boolean;
  v_refund   jsonb;
  v_refunded boolean := false;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('completed', 'failed') THEN
    RAISE EXCEPTION 'finish_mood_search: gecersiz status %', p_status USING ERRCODE = '22023';
  END IF;
  IF p_status = 'completed' AND p_profile IS NULL THEN
    RAISE EXCEPTION 'finish_mood_search: completed icin profile zorunlu' USING ERRCODE = '22023';
  END IF;

  UPDATE public.mood_searches
    SET status = p_status,
        parsed_profile = CASE WHEN p_status = 'completed' THEN p_profile ELSE NULL END,
        error_code = CASE WHEN p_status = 'completed' THEN NULL
                          ELSE COALESCE(p_error_code, 'UNKNOWN_ERROR') END,
        latency_ms = p_latency_ms,
        llm_tokens_in = p_tokens_in,
        llm_tokens_out = p_tokens_out,
        tier_used = CASE WHEN p_status = 'completed' THEN 3 ELSE tier_used END,
        cache_hit = false,
        updated_at = now()
    WHERE id = p_search_id
      AND status = 'pending'
      AND claimed_at = p_claimed_at
    RETURNING user_id, quota_consumed INTO v_user, v_consumed;

  IF NOT FOUND THEN
    -- Sahiplik yok (zombi istek): sonuç da İADE de yazılmaz.
    RETURN jsonb_build_object('finished', false, 'refunded', false);
  END IF;

  -- İade YALNIZ sahiplik doğrulandıktan sonra ve satır hak tutuyorsa, aynı işlemde:
  -- zombi + yeniden sahiplenen isteğin ikisi de iade edemez.
  IF p_status = 'failed' AND COALESCE(p_refund, false) AND v_consumed THEN
    v_refund := public.refund_quota(v_user, 'search');
    v_refunded := COALESCE((v_refund ->> 'refunded')::boolean, false);
    IF v_refunded THEN
      UPDATE public.mood_searches SET quota_consumed = false WHERE id = p_search_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('finished', true, 'refunded', v_refunded, 'refund', v_refund);
END $$;

COMMENT ON FUNCTION public.mood_quota_snapshot(uuid) IS
  'Arama kotasını TÜKETMEDEN okur (used/limit/tier). claim_mood_search replay/bedava yeniden sahiplenme için. '
  'Yalnız service_role çağırır.';
COMMENT ON FUNCTION public.claim_mood_search(uuid, uuid, text, integer) IS
  'parse-mood idempotent sahiplenme (MONEY-1C, 139): claimed | replay | in_progress | quota_denied. '
  'Kotayı aynı (user, client_search_id) için en fazla bir kez tüketir. Yalnız service_role çağırır.';
COMMENT ON FUNCTION public.finish_mood_search(uuid, timestamptz, text, jsonb, text, boolean, integer, integer, integer) IS
  'claim_mood_search ile sahiplenilmiş pending satırı sonuçlandırır; claimed_at eşleşmezse (zombi) false. '
  'Yalnız service_role çağırır.';

REVOKE EXECUTE ON FUNCTION public.mood_quota_snapshot(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mood_quota_snapshot(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mood_quota_snapshot(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.claim_mood_search(uuid, uuid, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_mood_search(uuid, uuid, text, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_mood_search(uuid, uuid, text, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.finish_mood_search(uuid, timestamptz, text, jsonb, text, boolean, integer, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finish_mood_search(uuid, timestamptz, text, jsonb, text, boolean, integer, integer, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_mood_search(uuid, timestamptz, text, jsonb, text, boolean, integer, integer, integer) TO service_role;

-- ----------------------------------------------------------------------------
-- İstemci UPDATE yetkisi: tüm kolonlar → üç kolon (recommendations.ts yalnız bunları yazar).
-- RLS UPDATE policy'si (032) DEĞİŞMEZ; SELECT yetkisi DEĞİŞMEZ.
-- ----------------------------------------------------------------------------
REVOKE UPDATE ON public.mood_searches FROM anon, authenticated;
GRANT UPDATE (recommended_film_ids, rpc_version, error_code) ON public.mood_searches TO authenticated;

-- ----------------------------------------------------------------------------
-- İstemci INSERT yetkisi (migration-guard K-1): tüm kolonlar → yalnız user_id.
-- Aksi halde istemci status/claimed_at/quota_consumed ile bayat bir `pending` satır ekleyip
-- kota düşmeden ücretli LLM çağrısı alabilir (claim_mood_search "serbest yeniden sahiplenme").
-- Doğrulama (25 Eki): 2.1.0 / 2.1.1 / 2.1.2 / 2.1.3 istemcileri mood_searches'e YALNIZ
--   insert({ user_id })  — services/quotaEngine.ts recordMoodSearch
--   update({ recommended_film_ids, rpc_version [, error_code] }).eq('id').select('id') — services/recommendations.ts
-- yazar; upsert yok → yeni yetkiler eski istemcilerin yazdığı kolonların üst kümesidir.
-- ----------------------------------------------------------------------------
REVOKE INSERT ON public.mood_searches FROM anon, authenticated;
GRANT INSERT (user_id) ON public.mood_searches TO authenticated;

-- ===================== 139 TAM METNI (bitis) =====================

-- -- SETUP: sonuc tablosu + 8 test kullanicisi
CREATE TEMP TABLE dryrun_results (test text, result text, detail text);
GRANT ALL ON dryrun_results TO PUBLIC;

DO $t$
DECLARE
  v uuid; i int;
BEGIN
  FOR i IN 1..8 LOOP
    INSERT INTO public.users (auth_id) VALUES (gen_random_uuid()::text) RETURNING id INTO v;
    PERFORM set_config('dryrun.u' || i, v::text, true);
  END LOOP;
  INSERT INTO dryrun_results VALUES ('00_setup', 'INFO',
    'free_limit=' || (SELECT daily_search_limit FROM public.subscription_limits WHERE tier = 'free'));
EXCEPTION WHEN OTHERS THEN
  INSERT INTO dryrun_results VALUES ('00_setup', 'FAIL', SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T1: ayni (user, id) icin 10 ardisik claim -> 1 claimed, 9 in_progress; kota TAM 1; tek satir
DO $t$
DECLARE
  u uuid := current_setting('dryrun.u1')::uuid; c uuid := gen_random_uuid();
  r jsonb; i int; n_claimed int := 0; n_prog int := 0; n_other int := 0; v_used int; v_rows int; v_retry int;
BEGIN
  SET LOCAL ROLE service_role;
  FOR i IN 1..10 LOOP
    r := public.claim_mood_search(u, c, 'hello', 45);
    IF r->>'result' = 'claimed' THEN n_claimed := n_claimed + 1;
    ELSIF r->>'result' = 'in_progress' THEN n_prog := n_prog + 1; v_retry := (r->>'retry_after')::int;
    ELSE n_other := n_other + 1; END IF;
  END LOOP;
  RESET ROLE;
  SELECT searches_used INTO v_used FROM public.user_daily_quotas WHERE user_id = u AND date = CURRENT_DATE;
  SELECT count(*) INTO v_rows FROM public.mood_searches WHERE user_id = u AND client_search_id = c;
  IF n_claimed = 1 AND n_prog = 9 AND n_other = 0 AND v_used = 1 AND v_rows = 1 AND v_retry = 5 THEN
    INSERT INTO dryrun_results VALUES ('T1', 'PASS', '1 claimed / 9 in_progress, searches_used=1, rows=1');
  ELSE
    INSERT INTO dryrun_results VALUES ('T1', 'FAIL', 'claimed=' || n_claimed || ' prog=' || n_prog || ' other=' || n_other || ' used=' || coalesce(v_used::text,'NULL') || ' rows=' || v_rows);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T1', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T2: completed -> replay: kota/LLM yok, kayitli profil, guncel remaining alanlari
DO $t$
DECLARE
  u uuid := current_setting('dryrun.u2')::uuid; c uuid := gen_random_uuid();
  r1 jsonb; f jsonb; r2 jsonb; v_used int; v_lim int;
BEGIN
  SELECT daily_search_limit INTO v_lim FROM public.subscription_limits WHERE tier = 'free';
  SET LOCAL ROLE service_role;
  r1 := public.claim_mood_search(u, c, 'hello', 45);
  f := public.finish_mood_search((r1->>'search_id')::uuid, (r1->>'claimed_at')::timestamptz,
         'completed', '{"profile_name":"x"}'::jsonb, NULL, false, 1200, 10, 20);
  r2 := public.claim_mood_search(u, c, 'hello', 45);
  RESET ROLE;
  SELECT searches_used INTO v_used FROM public.user_daily_quotas WHERE user_id = u AND date = CURRENT_DATE;
  IF (f->>'finished')::boolean AND r2->>'result' = 'replay' AND r2->>'search_id' = r1->>'search_id'
     AND r2->'profile'->>'profile_name' = 'x' AND v_used = 1
     AND (r2->'quota'->>'used')::int = 1 AND (r2->'quota'->>'limit')::int = v_lim THEN
    INSERT INTO dryrun_results VALUES ('T2', 'PASS', 'replay: profil geri geldi, searches_used=1, quota.limit=' || v_lim);
  ELSE
    INSERT INTO dryrun_results VALUES ('T2', 'FAIL', 'finish=' || f || ' r2=' || r2 || ' used=' || coalesce(v_used::text,'NULL'));
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T2', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T3: bayat pending: hak tutuluyorsa 2 kez TUKETMEDEN sahiplenir, ucuncude tuketir
DO $t$
DECLARE
  u uuid := current_setting('dryrun.u3')::uuid; c uuid := gen_random_uuid();
  r jsonb; a1 int; a2 int; a3 int; u1 int; u2 int; u3 int; res1 text; res2 text; res3 text;
BEGIN
  SET LOCAL ROLE service_role;
  r := public.claim_mood_search(u, c, 'hello', 45);
  RESET ROLE;
  UPDATE public.mood_searches SET claimed_at = claimed_at - interval '100 seconds' WHERE user_id = u AND client_search_id = c;
  SET LOCAL ROLE service_role;
  r := public.claim_mood_search(u, c, 'hello', 45); res1 := r->>'result'; a1 := (r->>'claim_attempts')::int;
  RESET ROLE;
  SELECT searches_used INTO u1 FROM public.user_daily_quotas WHERE user_id = u AND date = CURRENT_DATE;
  UPDATE public.mood_searches SET claimed_at = claimed_at - interval '100 seconds' WHERE user_id = u AND client_search_id = c;
  SET LOCAL ROLE service_role;
  r := public.claim_mood_search(u, c, 'hello', 45); res2 := r->>'result'; a2 := (r->>'claim_attempts')::int;
  RESET ROLE;
  SELECT searches_used INTO u2 FROM public.user_daily_quotas WHERE user_id = u AND date = CURRENT_DATE;
  UPDATE public.mood_searches SET claimed_at = claimed_at - interval '100 seconds' WHERE user_id = u AND client_search_id = c;
  SET LOCAL ROLE service_role;
  r := public.claim_mood_search(u, c, 'hello', 45); res3 := r->>'result'; a3 := (r->>'claim_attempts')::int;
  RESET ROLE;
  SELECT searches_used INTO u3 FROM public.user_daily_quotas WHERE user_id = u AND date = CURRENT_DATE;
  IF res1 = 'claimed' AND res2 = 'claimed' AND res3 = 'claimed' AND a1 = 1 AND a2 = 2 AND a3 = 3
     AND u1 = 1 AND u2 = 1 AND u3 = 2 THEN
    INSERT INTO dryrun_results VALUES ('T3', 'PASS', 'attempts 1,2 bedava (used=1,1); 3. tuketir (used=2)');
  ELSE
    INSERT INTO dryrun_results VALUES ('T3', 'FAIL', 'res=' || res1 || ',' || res2 || ',' || res3 || ' attempts=' || a1 || ',' || a2 || ',' || a3 || ' used=' || u1 || ',' || u2 || ',' || u3);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T3', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T4: kota dolu -> quota_denied (satir failed/QUOTA_EXCEEDED, hak yok); sonra ayni id -> yeniden sahiplen + tuket
DO $t$
DECLARE
  u uuid := current_setting('dryrun.u4')::uuid; c uuid := gen_random_uuid();
  v_lim int; i int; r_denied jsonb; r_again jsonb; st text; ec text; qc boolean; v_used int; v_att int; ec2 text; st2 text;
BEGIN
  SELECT daily_search_limit INTO v_lim FROM public.subscription_limits WHERE tier = 'free';
  SET LOCAL ROLE service_role;
  FOR i IN 1..v_lim LOOP PERFORM public.check_and_consume_quota(u, 'search'); END LOOP;
  r_denied := public.claim_mood_search(u, c, 'hello', 45);
  RESET ROLE;
  SELECT status, error_code, quota_consumed INTO st, ec, qc FROM public.mood_searches WHERE user_id = u AND client_search_id = c;
  UPDATE public.user_daily_quotas SET searches_used = 0 WHERE user_id = u AND date = CURRENT_DATE;  -- "satin alma sonrasi" hak
  SET LOCAL ROLE service_role;
  r_again := public.claim_mood_search(u, c, 'hello', 45);
  RESET ROLE;
  SELECT searches_used INTO v_used FROM public.user_daily_quotas WHERE user_id = u AND date = CURRENT_DATE;
  SELECT status, error_code, claim_attempts INTO st2, ec2, v_att FROM public.mood_searches WHERE user_id = u AND client_search_id = c;
  IF r_denied->>'result' = 'quota_denied' AND r_denied->'quota'->>'error' = 'QUOTA_EXCEEDED'
     AND st = 'failed' AND ec = 'QUOTA_EXCEEDED' AND qc = false
     AND r_again->>'result' = 'claimed' AND v_used = 1 AND st2 = 'pending' AND ec2 IS NULL AND v_att = 0 THEN
    INSERT INTO dryrun_results VALUES ('T4', 'PASS', 'denied->failed/QUOTA_EXCEEDED; ayni id yeniden sahiplendi, used=1');
  ELSE
    INSERT INTO dryrun_results VALUES ('T4', 'FAIL', 'denied=' || r_denied || ' row=' || coalesce(st,'?') || '/' || coalesce(ec,'?') || '/' || coalesce(qc::text,'?') || ' again=' || r_again || ' used=' || coalesce(v_used::text,'NULL'));
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T4', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T5: zombi finish: yeniden sahiplenilmis satira gec donen finish -> false, veri degismez
DO $t$
DECLARE
  u uuid := current_setting('dryrun.u5')::uuid; c uuid := gen_random_uuid();
  r1 jsonb; r2 jsonb; f_old jsonb; st_mid text; prof_mid jsonb; f_new jsonb; st_end text;
BEGIN
  SET LOCAL ROLE service_role;
  r1 := public.claim_mood_search(u, c, 'hello', 45);
  RESET ROLE;
  UPDATE public.mood_searches SET claimed_at = claimed_at - interval '100 seconds' WHERE user_id = u AND client_search_id = c;
  SET LOCAL ROLE service_role;
  r2 := public.claim_mood_search(u, c, 'hello', 45);
  f_old := public.finish_mood_search((r1->>'search_id')::uuid, (r1->>'claimed_at')::timestamptz,
             'completed', '{"zombie":true}'::jsonb, NULL, false, 1, 1, 1);
  RESET ROLE;
  SELECT status, parsed_profile INTO st_mid, prof_mid FROM public.mood_searches WHERE user_id = u AND client_search_id = c;
  SET LOCAL ROLE service_role;
  f_new := public.finish_mood_search((r2->>'search_id')::uuid, (r2->>'claimed_at')::timestamptz,
             'completed', '{"ok":true}'::jsonb, NULL, false, 1, 1, 1);
  RESET ROLE;
  SELECT status INTO st_end FROM public.mood_searches WHERE user_id = u AND client_search_id = c;
  IF (f_old->>'finished')::boolean = false AND st_mid = 'pending' AND prof_mid IS NULL AND (f_new->>'finished')::boolean AND st_end = 'completed' THEN
    INSERT INTO dryrun_results VALUES ('T5', 'PASS', 'zombi finish=false, veri degismedi; sahip finish=true');
  ELSE
    INSERT INTO dryrun_results VALUES ('T5', 'FAIL', 'f_old=' || f_old || ' mid=' || coalesce(st_mid,'?') || ' f_new=' || f_new || ' end=' || coalesce(st_end,'?'));
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T5', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T6: iade yolu: saglayici hatasi -> quota_consumed=false, kota geri; PARSE_FAILED -> iade yok, yeniden sahiplenme yeniden tuketir
DO $t$
DECLARE
  u uuid := current_setting('dryrun.u6')::uuid; c1 uuid := gen_random_uuid(); c2 uuid := gen_random_uuid();
  r jsonb; f1 jsonb; f2 jsonb; qc1 boolean; u1 int; qc2 boolean; u2 int; ec2 text; r3 jsonb; u3 int; att3 int; ec3 text;
BEGIN
  SET LOCAL ROLE service_role;
  r := public.claim_mood_search(u, c1, 'hello', 45);
  f1 := public.finish_mood_search((r->>'search_id')::uuid, (r->>'claimed_at')::timestamptz, 'failed', NULL, 'SERVICE_UNAVAILABLE', true, 5, NULL, NULL);
  RESET ROLE;
  SELECT quota_consumed INTO qc1 FROM public.mood_searches WHERE user_id = u AND client_search_id = c1;
  SELECT searches_used INTO u1 FROM public.user_daily_quotas WHERE user_id = u AND date = CURRENT_DATE;

  SET LOCAL ROLE service_role;
  r := public.claim_mood_search(u, c2, 'hello', 45);
  f2 := public.finish_mood_search((r->>'search_id')::uuid, (r->>'claimed_at')::timestamptz, 'failed', NULL, 'PARSE_FAILED', false, 5, 1, 1);
  RESET ROLE;
  SELECT quota_consumed, error_code INTO qc2, ec2 FROM public.mood_searches WHERE user_id = u AND client_search_id = c2;
  SELECT searches_used INTO u2 FROM public.user_daily_quotas WHERE user_id = u AND date = CURRENT_DATE;

  SET LOCAL ROLE service_role;
  r3 := public.claim_mood_search(u, c2, 'hello', 45);
  RESET ROLE;
  SELECT searches_used INTO u3 FROM public.user_daily_quotas WHERE user_id = u AND date = CURRENT_DATE;
  SELECT claim_attempts, error_code INTO att3, ec3 FROM public.mood_searches WHERE user_id = u AND client_search_id = c2;
  IF (f1->>'refunded')::boolean AND (f2->>'finished')::boolean AND NOT (f2->>'refunded')::boolean AND qc1 = false AND u1 = 0
     AND qc2 = true AND ec2 = 'PARSE_FAILED' AND u2 = 1
     AND r3->>'result' = 'claimed' AND u3 = 2 AND att3 = 0 AND ec3 IS NULL THEN
    INSERT INTO dryrun_results VALUES ('T6', 'PASS', 'iade: used 0, consumed=false; PARSE_FAILED: used 1, consumed=true; yeniden sahiplenme used 2');
  ELSE
    INSERT INTO dryrun_results VALUES ('T6', 'FAIL', 'f1=' || f1 || ' f2=' || f2 || ' qc1=' || coalesce(qc1::text,'?') || ' u1=' || coalesce(u1::text,'?') || ' qc2=' || coalesce(qc2::text,'?') || ' u2=' || coalesce(u2::text,'?') || ' r3=' || r3 || ' u3=' || coalesce(u3::text,'?'));
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T6', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T7: eski istemci satirlari (client_search_id NULL) kisitlamaz; (user,id) tekil; baska kullanici ayni id'yi kullanabilir
DO $t$
DECLARE
  u7 uuid := current_setting('dryrun.u7')::uuid; u8 uuid := current_setting('dryrun.u8')::uuid; c uuid := gen_random_uuid();
  r7 jsonb; r8 jsonb; n_null int; v_dup boolean := false; v_st text;
BEGIN
  INSERT INTO public.mood_searches (user_id, mood_text) VALUES (u7, 'legacy-1'), (u7, 'legacy-2');
  SELECT count(*), max(status) INTO n_null, v_st FROM public.mood_searches WHERE user_id = u7 AND client_search_id IS NULL;
  SET LOCAL ROLE service_role;
  r7 := public.claim_mood_search(u7, c, 'hello', 45);
  r8 := public.claim_mood_search(u8, c, 'hello', 45);
  RESET ROLE;
  BEGIN
    INSERT INTO public.mood_searches (user_id, client_search_id) VALUES (u7, c);
  EXCEPTION WHEN unique_violation THEN v_dup := true;
  END;
  IF n_null = 2 AND v_st IS NULL AND r7->>'result' = 'claimed' AND r8->>'result' = 'claimed' AND v_dup THEN
    INSERT INTO dryrun_results VALUES ('T7', 'PASS', 'NULL id satirlari serbest (status NULL); ayni id iki kullanicida claimed; (user,id) tekrari 23505');
  ELSE
    INSERT INTO dryrun_results VALUES ('T7', 'FAIL', 'n_null=' || n_null || ' r7=' || r7 || ' r8=' || r8 || ' dup=' || v_dup);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T7', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T8: gecersiz argumanlar ve bilinmeyen kullanici; gecersiz finish girdisi
DO $t$
DECLARE
  u uuid := current_setting('dryrun.u1')::uuid; r_null jsonb; r_nouser jsonb; e1 boolean := false; e2 boolean := false;
BEGIN
  SET LOCAL ROLE service_role;
  r_null := public.claim_mood_search(u, NULL, 'x', 45);
  r_nouser := public.claim_mood_search(gen_random_uuid(), gen_random_uuid(), 'x', 45);
  BEGIN
    PERFORM public.finish_mood_search(gen_random_uuid(), now(), 'bogus', NULL, NULL, false, 1, 1, 1);
  EXCEPTION WHEN invalid_parameter_value THEN e1 := true;
  END;
  BEGIN
    PERFORM public.finish_mood_search(gen_random_uuid(), now(), 'completed', NULL, NULL, false, 1, 1, 1);
  EXCEPTION WHEN invalid_parameter_value THEN e2 := true;
  END;
  RESET ROLE;
  IF r_null->>'result' = 'invalid_args' AND r_nouser->>'result' = 'user_not_found' AND e1 AND e2 THEN
    INSERT INTO dryrun_results VALUES ('T8', 'PASS', 'invalid_args, user_not_found, finish 22023 x2');
  ELSE
    INSERT INTO dryrun_results VALUES ('T8', 'FAIL', 'null=' || r_null || ' nouser=' || r_nouser || ' e1=' || e1 || ' e2=' || e2);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T8', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T9: CHECK kisiti
DO $t$
DECLARE v_bad boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.mood_searches (user_id, status) VALUES (current_setting('dryrun.u1')::uuid, 'bogus');
  EXCEPTION WHEN check_violation THEN v_bad := true;
  END;
  IF v_bad THEN INSERT INTO dryrun_results VALUES ('T9', 'PASS', 'status CHECK: bogus 23514');
  ELSE INSERT INTO dryrun_results VALUES ('T9', 'FAIL', 'gecersiz status kabul edildi'); END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO dryrun_results VALUES ('T9', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T10: anon ve authenticated uc RPC'yi de CAGIRAMAZ (42501)
DO $t$
DECLARE
  rl text; fn int; denied int := 0; total int := 0;
BEGIN
  FOREACH rl IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    FOR fn IN 1..3 LOOP
      total := total + 1;
      BEGIN
        EXECUTE 'SET LOCAL ROLE ' || rl;
        IF fn = 1 THEN PERFORM public.claim_mood_search(current_setting('dryrun.u1')::uuid, gen_random_uuid(), 'x', 45);
        ELSIF fn = 2 THEN PERFORM public.finish_mood_search(gen_random_uuid(), now(), 'failed', NULL, 'X', false, 1, 1, 1);
        ELSE PERFORM public.mood_quota_snapshot(current_setting('dryrun.u1')::uuid); END IF;
        RESET ROLE;
      EXCEPTION WHEN insufficient_privilege THEN
        RESET ROLE; denied := denied + 1;
      END;
    END LOOP;
  END LOOP;
  IF denied = total THEN INSERT INTO dryrun_results VALUES ('T10', 'PASS', denied || '/' || total || ' reddedildi (42501)');
  ELSE INSERT INTO dryrun_results VALUES ('T10', 'FAIL', denied || '/' || total || ' reddedildi'); END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T10', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T11: istemci UPDATE yetkisi yalniz recommended_film_ids, rpc_version, error_code
DO $t$
DECLARE
  c text; bad text := ''; ok_cols text[] := ARRAY['recommended_film_ids', 'rpc_version', 'error_code'];
  deny_cols text[] := ARRAY['status', 'client_search_id', 'claimed_at', 'quota_consumed', 'claim_attempts',
                            'parsed_profile', 'mood_text', 'user_id', 'llm_tokens_in', 'latency_ms'];
  v_upd_status boolean := false; v_upd_ok boolean := true; v_anon boolean := false;
BEGIN
  FOREACH c IN ARRAY ok_cols LOOP
    IF NOT has_column_privilege('authenticated', 'public.mood_searches', c, 'UPDATE') THEN bad := bad || ' -' || c; END IF;
  END LOOP;
  FOREACH c IN ARRAY deny_cols LOOP
    IF has_column_privilege('authenticated', 'public.mood_searches', c, 'UPDATE') THEN bad := bad || ' +' || c; END IF;
  END LOOP;
  FOREACH c IN ARRAY (ok_cols || deny_cols) LOOP
    IF has_column_privilege('anon', 'public.mood_searches', c, 'UPDATE') THEN v_anon := true; END IF;
  END LOOP;
  BEGIN
    SET LOCAL ROLE authenticated;
    UPDATE public.mood_searches SET status = 'completed' WHERE false;
    RESET ROLE;
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE; v_upd_status := true;
  END;
  BEGIN
    SET LOCAL ROLE authenticated;
    UPDATE public.mood_searches SET recommended_film_ids = '{}', rpc_version = 'x', error_code = NULL WHERE false;
    RESET ROLE;
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE; v_upd_ok := false;
  END;
  IF bad = '' AND NOT v_anon AND v_upd_status AND v_upd_ok
     AND has_table_privilege('authenticated', 'public.mood_searches', 'SELECT')
     AND has_column_privilege('authenticated', 'public.mood_searches', 'user_id', 'INSERT')
     AND NOT has_column_privilege('authenticated', 'public.mood_searches', 'status', 'INSERT')
     AND NOT has_column_privilege('anon', 'public.mood_searches', 'user_id', 'INSERT') THEN
    INSERT INTO dryrun_results VALUES ('T11', 'PASS', 'UPDATE 3 kolon; status UPDATE 42501; anon yok; SELECT duruyor; INSERT yalniz user_id (anon yok)');
  ELSE
    INSERT INTO dryrun_results VALUES ('T11', 'FAIL', 'bad=' || bad || ' anon=' || v_anon || ' upd_status_denied=' || v_upd_status || ' upd_ok=' || v_upd_ok);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T11', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T12: katalog: SECURITY DEFINER, search_path bos, ACL yalniz postgres + service_role
DO $t$
DECLARE
  fns text[] := ARRAY['public.claim_mood_search(uuid, uuid, text, integer)',
                      'public.finish_mood_search(uuid, timestamptz, text, jsonb, text, boolean, integer, integer, integer)',
                      'public.mood_quota_snapshot(uuid)'];
  f text; v_def boolean; v_cfg text[]; v_acl text; bad text := '';
BEGIN
  FOREACH f IN ARRAY fns LOOP
    SELECT prosecdef, proconfig, proacl::text INTO v_def, v_cfg, v_acl FROM pg_proc WHERE oid = f::regprocedure;
    IF NOT (v_def AND v_cfg @> ARRAY['search_path=""']
            AND v_acl LIKE '%service_role=X/%' AND v_acl NOT LIKE '%anon=%' AND v_acl NOT LIKE '%authenticated=%'
            AND v_acl NOT LIKE '{=%' AND v_acl NOT LIKE '%,=X/%') THEN
      bad := bad || ' ' || f || ' def=' || v_def || ' cfg=' || coalesce(v_cfg::text, 'NULL') || ' acl=' || coalesce(v_acl, 'NULL');
    END IF;
  END LOOP;
  IF bad = '' THEN INSERT INTO dryrun_results VALUES ('T12', 'PASS', '3 fonksiyon: DEFINER, search_path="", ACL yalniz service_role');
  ELSE INSERT INTO dryrun_results VALUES ('T12', 'FAIL', bad); END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO dryrun_results VALUES ('T12', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T13: O-1 zombi + yeniden sahiplenen ikisi de iade ister -> TEK iade (zombi iade edemez)
DO $t$
DECLARE
  u uuid := current_setting('dryrun.u2')::uuid; c uuid := gen_random_uuid();
  r1 jsonb; r2 jsonb; fz jsonb; fo jsonb; v_before int; v_after int;
BEGIN
  SET LOCAL ROLE service_role;
  r1 := public.claim_mood_search(u, c, 'hello', 45);
  RESET ROLE;
  UPDATE public.mood_searches SET claimed_at = claimed_at - interval '100 seconds' WHERE user_id = u AND client_search_id = c;
  SET LOCAL ROLE service_role;
  r2 := public.claim_mood_search(u, c, 'hello', 45);
  RESET ROLE;
  SELECT searches_used INTO v_before FROM public.user_daily_quotas WHERE user_id = u AND date = CURRENT_DATE;
  SET LOCAL ROLE service_role;
  fz := public.finish_mood_search((r1->>'search_id')::uuid, (r1->>'claimed_at')::timestamptz, 'failed', NULL, 'SERVICE_UNAVAILABLE', true, 1, NULL, NULL);
  fo := public.finish_mood_search((r2->>'search_id')::uuid, (r2->>'claimed_at')::timestamptz, 'failed', NULL, 'SERVICE_UNAVAILABLE', true, 1, NULL, NULL);
  RESET ROLE;
  SELECT searches_used INTO v_after FROM public.user_daily_quotas WHERE user_id = u AND date = CURRENT_DATE;
  IF NOT (fz->>'finished')::boolean AND NOT (fz->>'refunded')::boolean
     AND (fo->>'finished')::boolean AND (fo->>'refunded')::boolean AND v_after = v_before - 1 THEN
    INSERT INTO dryrun_results VALUES ('T13', 'PASS', 'zombi iade yok; sahip tek iade: used ' || v_before || '->' || v_after);
  ELSE
    INSERT INTO dryrun_results VALUES ('T13', 'FAIL', 'fz=' || fz || ' fo=' || fo || ' before=' || v_before || ' after=' || v_after);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T13', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T14: claim_attempts CHECK (>= 0)
DO $t$
DECLARE v_bad boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.mood_searches (user_id, claim_attempts) VALUES (current_setting('dryrun.u1')::uuid, -5);
  EXCEPTION WHEN check_violation THEN v_bad := true;
  END;
  IF v_bad THEN INSERT INTO dryrun_results VALUES ('T14', 'PASS', 'claim_attempts < 0 reddedildi');
  ELSE INSERT INTO dryrun_results VALUES ('T14', 'FAIL', 'negatif claim_attempts kabul edildi'); END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO dryrun_results VALUES ('T14', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- T15 (guard K-1): istemci yetkileri — eski istemci sekilleri GECMELI, yeni kolonlar yazilamamali.
-- Eski istemci (2.1.0-2.1.3): insert({user_id}); update({recommended_film_ids, rpc_version[, error_code]}).eq('id').select('id')
DO $t$
DECLARE
  u uuid := current_setting('dryrun.u3')::uuid;
  v_id uuid; v_n int; v_fail text := '';
  c text;
BEGIN
  -- Canli RLS (user_id = auth_user_id()) icin istemci kimligi: JWT sub = users.auth_id (stub semada RLS yok, zararsiz).
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', (SELECT auth_id FROM public.users WHERE id = u), 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  -- eski INSERT sekli
  BEGIN
    INSERT INTO public.mood_searches (user_id) VALUES (u) RETURNING id INTO v_id;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail || ' old_insert:' || SQLERRM;
  END;
  -- eski UPDATE sekilleri (2 ve 3 kolon, WHERE id)
  BEGIN
    UPDATE public.mood_searches SET recommended_film_ids = ARRAY[]::uuid[], rpc_version = 'v1' WHERE id = v_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 1 THEN v_fail := v_fail || ' old_update2_rows=' || v_n; END IF;
    UPDATE public.mood_searches SET recommended_film_ids = ARRAY[]::uuid[], rpc_version = 'v1', error_code = 'X' WHERE id = v_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> 1 THEN v_fail := v_fail || ' old_update3_rows=' || v_n; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail || ' old_update:' || SQLERRM;
  END;
  -- yeni kolonlarla INSERT reddedilmeli
  FOREACH c IN ARRAY ARRAY['client_search_id','status','claimed_at','quota_consumed','claim_attempts'] LOOP
    BEGIN
      EXECUTE format('INSERT INTO public.mood_searches (user_id, %I) VALUES ($1, %s)', c,
        CASE c WHEN 'client_search_id' THEN 'gen_random_uuid()' WHEN 'status' THEN '''pending''' WHEN 'claimed_at' THEN 'now()' WHEN 'quota_consumed' THEN 'true' ELSE '0' END) USING u;
      v_fail := v_fail || ' insert_' || c || '_ALLOWED';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END LOOP;
  -- yeni kolonlarla UPDATE reddedilmeli
  FOREACH c IN ARRAY ARRAY['client_search_id','status','claimed_at','quota_consumed','claim_attempts','user_id'] LOOP
    BEGIN
      EXECUTE format('UPDATE public.mood_searches SET %I = %s WHERE id = $1', c,
        CASE c WHEN 'client_search_id' THEN 'gen_random_uuid()' WHEN 'status' THEN '''completed''' WHEN 'claimed_at' THEN 'now()' WHEN 'quota_consumed' THEN 'false' WHEN 'user_id' THEN '$1' ELSE '0' END) USING v_id;
      v_fail := v_fail || ' update_' || c || '_ALLOWED';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
              WHEN datatype_mismatch OR undefined_column THEN NULL;
    END;
  END LOOP;
  RESET ROLE;
  IF v_fail = '' THEN
    INSERT INTO dryrun_results VALUES ('T15', 'PASS', 'eski istemci insert/update sekilleri gecti; status/claimed_at/quota_consumed/claim_attempts/client_search_id/user_id istemciden yazilamaz');
  ELSE
    INSERT INTO dryrun_results VALUES ('T15', 'FAIL', v_fail);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO dryrun_results VALUES ('T15', 'FAIL', 'beklenmeyen hata: ' || SQLERRM || ' (' || SQLSTATE || ')');
END
$t$;

-- -- OZET satiri
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
