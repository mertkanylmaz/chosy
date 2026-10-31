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
