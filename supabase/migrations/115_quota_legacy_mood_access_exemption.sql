-- ============================================================================
-- 115 — check_and_consume_quota: legacy_mood_access muafiyeti
--
-- KARAR: CTO onayı, 24 Eylül 2026 (bible v1.15, §2.7 "K-46 eki").
--   Grandfathered kohort (migration 090, `public.users.legacy_mood_access`,
--   bugün 234 satır) mood search erişimini korur. Erişimi bırakıp kotayla
--   kesmek aynı sözü iki kez bozardı — bu kohort için kota duvarı kalkar.
--
-- İSTEMCİ TARAFI ZATEN KALKTI (aynı turda):
--   `useProModeAccess.quotaExempt` → MoodSearchScreen + discover.
--   Ancak `parse-mood`, `parse-taste`, `slot-*` ve `check-quota` Edge
--   Function'ları bu RPC'yi SUNUCUDA çağırıyor; istemci kapısını açmak tek
--   başına yetmiyordu. Bu migration o yarıyı kapatır.
--
-- YAKLAŞIM — "izin ver ama SAYMAYA devam et":
--   Muafiyet, mevcut `-1 = sınırsız` yoluna bağlanarak veriliyor
--   (`v_limit := -1`). Böylece:
--     · dönüş sözleşmesi DEĞİŞMİYOR — `allowed/used/limit/tier` aynı şekil,
--       `limit` sınırsız tierlardaki gibi 999999 dönüyor;
--     · `user_daily_quotas` sayaçları ARTMAYA devam ediyor. Kullanımı
--       ölçmeden kesmemek ile ölçmeyi hiç bırakmak aynı şey değil —
--       E-03 (altyapı birim maliyet modeli) bu kohortun gerçek arama
--       hacmini bilmek zorunda.
--
-- KAPSAM: Fonksiyonun üç kota tipi de (`search` · `refine` · `slot`) muaf.
--   Ayrım yapmak, `legacy_mood_access` kohortuna "erişimin var ama yarısı"
--   demek olurdu. Oyun kotası (`check_and_consume_game_quota`) AYRI bir
--   fonksiyondur ve bu migration ona DOKUNMAZ.
--
-- ⚠️ TABAN ALINAN GÖVDE: migration 021. 021 sonrası bu fonksiyonu yeniden
--   tanımlayan başka migration YOK (109 ve 110 yalnızca ACL'e dokunuyor:
--   REVOKE ... FROM anon, authenticated, PUBLIC). Gövde 021'den birebir
--   kopyalanmış, yalnız aşağıda "115" diye işaretli üç blok eklenmiştir.
--   Dashboard'dan elle yapılmış kayıt dışı bir değişiklik varsa bu
--   CREATE OR REPLACE onu geri alır (CLAUDE.md kural 3 zaten SQL editor
--   migration'larını yasaklıyor).
--
-- GERİ ALMA: 021'deki gövdeyi CREATE OR REPLACE ile geri yazmak yeterlidir.
--   Şema değişikliği yok, veri değişikliği yok, kolon eklenmiyor.
-- ============================================================================

CREATE OR REPLACE FUNCTION check_and_consume_quota(
  p_user_id UUID,
  p_quota_type TEXT -- 'search' | 'refine' | 'slot'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier TEXT;
  v_limit INT;
  v_used INT;
  v_bonus INT;
  v_today DATE := CURRENT_DATE;
  v_quota_row user_daily_quotas%ROWTYPE;
  -- 115: grandfathering bayrağı
  v_legacy BOOLEAN;
BEGIN
  -- Get user tier
  -- 115: aynı okumada legacy bayrağı da alınıyor (ek sorgu yok)
  SELECT subscription_tier, COALESCE(legacy_mood_access, false)
    INTO v_tier, v_legacy
    FROM users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'USER_NOT_FOUND');
  END IF;

  -- Upsert today's quota row (atomic)
  INSERT INTO user_daily_quotas (user_id, date)
    VALUES (p_user_id, v_today)
    ON CONFLICT (user_id, date) DO NOTHING;

  -- Lock and read
  SELECT * INTO v_quota_row
    FROM user_daily_quotas
    WHERE user_id = p_user_id AND date = v_today
    FOR UPDATE;

  -- Get limit based on quota type
  CASE p_quota_type
    WHEN 'search' THEN
      SELECT daily_search_limit INTO v_limit FROM subscription_limits WHERE tier = v_tier;
      v_used := v_quota_row.searches_used;
      v_bonus := v_quota_row.bonus_searches_earned - v_quota_row.bonus_searches_used;
    WHEN 'refine' THEN
      SELECT daily_refine_limit INTO v_limit FROM subscription_limits WHERE tier = v_tier;
      v_used := v_quota_row.refines_used;
      v_bonus := 0;
    WHEN 'slot' THEN
      SELECT daily_slot_limit INTO v_limit FROM subscription_limits WHERE tier = v_tier;
      v_used := v_quota_row.slot_spins_used;
      v_bonus := 0;
    ELSE
      RETURN jsonb_build_object('allowed', false, 'error', 'INVALID_QUOTA_TYPE');
  END CASE;

  -- ── 115: Grandfathering muafiyeti ─────────────────────────────────────────
  -- Geçersiz kota tipi YUKARIDA zaten reddedildi; muafiyet ondan sonra gelir.
  -- TIER_NOT_CONFIGURED kontrolünden ÖNCE gelir: bu kohortun izni tier
  -- konfigürasyonunun sağlamlığına bağlı olmamalı.
  IF v_legacy THEN
    v_limit := -1;
  END IF;

  -- If limit not found (tier missing from config), deny
  IF v_limit IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'TIER_NOT_CONFIGURED', 'tier', v_tier);
  END IF;

  -- Check (-1 = unlimited)
  IF v_limit != -1 AND v_used >= (v_limit + GREATEST(v_bonus, 0)) THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'QUOTA_EXCEEDED',
      'used', v_used,
      'limit', v_limit + GREATEST(v_bonus, 0),
      'tier', v_tier,
      'reset_at', (v_today + INTERVAL '1 day')::timestamptz
    );
  END IF;

  -- Increment (use bonus first if available for search)
  CASE p_quota_type
    WHEN 'search' THEN
      -- 115: `v_limit != -1` koruması eklendi. Sınırsızda `v_used >= -1`
      -- HER ZAMAN doğrudur; korumasız bırakılsaydı muaf kullanıcı bonus
      -- aramalarını boşuna yakar ve `bonus_searches_used` metriği şişerdi.
      -- Mevcut tierların hiçbirinde search limiti -1 değil, dolayısıyla bu
      -- koşul onların davranışını DEĞİŞTİRMEZ.
      IF v_limit != -1 AND v_bonus > 0 AND v_used >= v_limit THEN
        UPDATE user_daily_quotas
          SET bonus_searches_used = bonus_searches_used + 1, updated_at = NOW()
          WHERE user_id = p_user_id AND date = v_today;
      ELSE
        UPDATE user_daily_quotas
          SET searches_used = searches_used + 1, updated_at = NOW()
          WHERE user_id = p_user_id AND date = v_today;
      END IF;
    WHEN 'refine' THEN
      UPDATE user_daily_quotas
        SET refines_used = refines_used + 1, updated_at = NOW()
        WHERE user_id = p_user_id AND date = v_today;
    WHEN 'slot' THEN
      UPDATE user_daily_quotas
        SET slot_spins_used = slot_spins_used + 1, updated_at = NOW()
        WHERE user_id = p_user_id AND date = v_today;
  END CASE;

  RETURN jsonb_build_object(
    'allowed', true,
    'used', v_used + 1,
    'limit', CASE WHEN v_limit = -1 THEN 999999 ELSE v_limit + GREATEST(v_bonus, 0) END,
    'tier', v_tier
  );
END $$;

COMMENT ON FUNCTION public.check_and_consume_quota(uuid, text) IS
  'Atomik kota kontrolü + tüketim. 115: legacy_mood_access = true olan '
  'grandfathered kohort (migration 090) sınırsızdır; sayaçlar yine de artar. '
  'Yalnız service_role çağırır (109/110).';

-- ─── ACL teyidi ─────────────────────────────────────────────────────────────
-- CREATE OR REPLACE mevcut ACL'i korur, yani 109/110'un REVOKE'ları düşmez.
-- Yine de idempotent olarak tekrarlanıyor: bu fonksiyon yalnızca Edge
-- Function'lardan (service_role) çağrılır, istemciye hiçbir koşulda açılmaz.
REVOKE EXECUTE ON FUNCTION public.check_and_consume_quota(uuid, text)
  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_and_consume_quota(uuid, text)
  FROM PUBLIC;
