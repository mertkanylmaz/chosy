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
