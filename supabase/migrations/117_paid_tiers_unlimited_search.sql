-- ============================================================================
-- 117 — subscription_limits: ücretli tierlarda Pro Mode araması sınırsız
--
-- KARAR: CTO onayı, 27 Eylül 2026. Plus (monthly / annual / lifetime) için
--   Pro Mode arama limiti SINIRSIZ. Free (3) değişmiyor.
--
-- NEDEN: BM v2 (05.08.2026) eski "mood-search kotası" monetizasyonunu
--   emekli etti (2_CHOSY_BUSINESS_MODEL.md §12), ama `subscription_limits`
--   eski değerleri taşımaya devam etti: monthly 15 · annual 25 · lifetime 50
--   (canlı ölçüm, 27 Eyl 2026). Sonuç: ücretli abone Pro Mode'da günlük
--   limite takılıp `parse-mood`'dan 429 QUOTA_EXCEEDED alıyor ve abone
--   olduğu hâlde "yükselt" paywall'ı görüyordu.
--
-- YAKLAŞIM — 115 ile aynı `-1 = sınırsız` yolu:
--   `check_and_consume_quota` (115 gövdesi) `v_limit = -1`'i zaten sınırsız
--   sayıyor ve `limit: 999999` dönüyor. 115'in bonus-arama koruması
--   (`v_limit != -1 AND …`) bu tierlarda da geçerli olur, bonus boşuna
--   yakılmaz. Sayaçlar (`user_daily_quotas.searches_used`) ARTMAYA devam
--   eder: kullanım ölçülmeye devam ediyor (E-03).
--   Fonksiyon gövdesine DOKUNULMUYOR — yalnız veri.
--
-- KAPSAM DIŞI (bilinçli):
--   · `weekly_legacy` (14) — CTO kararı monthly/annual/lifetime'ı adlandırdı.
--   · `daily_refine_limit` / `daily_slot_limit` — bu tierlarda zaten -1.
--
-- DİĞER OKUYUCULAR (aynı turda ele alındı):
--   · `schedule-notifications` `searches_used >= limit` karşılaştırması
--     -1'de her zaman doğru olurdu → `limit !== -1` koruması eklendi.
--   · `get_quota_status` RPC'sinin istemci/fonksiyon çağıranı yok (grep).
--
-- GÜVENLİK: Tam olarak 3 satır güncellenmezse migration HATA verir.
--   Sessiz kısmi güncelleme yok (tier adı değişmiş/eksikse push düşer).
--
-- GERİ ALMA:
--   UPDATE subscription_limits SET daily_search_limit = 15 WHERE tier = 'monthly';
--   UPDATE subscription_limits SET daily_search_limit = 25 WHERE tier = 'annual';
--   UPDATE subscription_limits SET daily_search_limit = 50 WHERE tier = 'lifetime';
--   Şema değişikliği yok, kolon/tablo/fonksiyon eklenmiyor.
-- ============================================================================

DO $$
DECLARE
  v_updated INT;
BEGIN
  UPDATE subscription_limits
     SET daily_search_limit = -1
   WHERE tier IN ('monthly', 'annual', 'lifetime');

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 3 THEN
    RAISE EXCEPTION '117: 3 tier bekleniyordu, % satır güncellendi', v_updated;
  END IF;
END $$;
