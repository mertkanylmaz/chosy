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
--   rpc_version, error_code kolonlarına iner (recommendations.ts'in yazdığı tek
--   kolonlar). Yeni durum kolonları istemciden yazılamaz. INSERT yetkisine DOKUNULMADI
--   (onay kapsamı dışı; bkz. belge): istemci kendi adına satır ekleyebilir ama bu
--   yalnız kendi arama kimliğini etkiler, kota ayrı tabloda ve 137 ile kilitli.
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
-- RLS UPDATE policy'si (032) DEĞİŞMEZ; SELECT/INSERT yetkileri DEĞİŞMEZ.
-- ----------------------------------------------------------------------------
REVOKE UPDATE ON public.mood_searches FROM anon, authenticated;
GRANT UPDATE (recommended_film_ids, rpc_version, error_code) ON public.mood_searches TO authenticated;
