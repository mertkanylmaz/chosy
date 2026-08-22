-- ─────────────────────────────────────────────────────────────────────────────
-- 104 — subscriptions.plan CHECK kısıtını gerçek plan değerleriyle eşitle
--
-- SORUN
-- 012'deki CREATE TABLE kısıtı: CHECK (plan IN ('weekly','monthly','yearly')).
-- O günden beri kelime dağarcığı iki kez değişti ama kısıt hiç güncellenmedi:
--   • 021 (quota system) 'yearly' tier'ını 'annual' olarak yeniledi
--   • 025 (lifetime tier) 'lifetime' planını ekledi
-- Bugün plan kolonuna 'annual' veya 'lifetime' yazan İKİ çağıran var ve
-- ikisi de kısıt tarafından reddediliyor (23514 check_violation):
--   1. supabase/functions/revenuecat-webhook/index.ts — INITIAL_PURCHASE /
--      RENEWAL / PRODUCT_CHANGE / UNCANCELLATION dalı, plan='annual'
--   2. supabase/migrations/025_lifetime_tier.sql:89 — claim_lifetime_spot()
--      RPC'si, plan='lifetime'
--
-- Her iki çağıranda da hata görünmüyordu: webhook UPDATE'in dönüşünü hiç
-- kontrol etmiyordu (aynı turda düzeltildi), RPC'nin EXCEPTION bloğu ise
-- yalnız unique_violation yakalıyor — check_violation yukarı kaçıp RPC'yi
-- komple düşürüyor ve webhook onu console.error ile yutuyordu.
--
-- KELİME DAĞARCIĞININ KAYNAĞI
-- Bu migration yeni bir sözlük İCAT ETMEZ. Hedef liste, istemcide zaten
-- kilitli olan tipin birebir kendisidir — constants/subscriptionPlans.ts:
--   export type PlanId       = 'monthly' | 'annual' | 'lifetime'
--   export type LegacyPlanId = PlanId | 'weekly' | 'yearly'
-- services/subscriptionService.ts satırları `LegacyPlanId` olarak okuyor.
-- Yani kısıt, kodun aylardır varsaydığı sözleşmeye geri hizalanıyor.
--
-- 'weekly' ve 'yearly' KORUNUR: tarihsel satırlar bu değerleri taşıyor
-- (021:20 ve 021:40 veri göçleri tam olarak bu iki değeri okuyor). Onları
-- listeden çıkarmak mevcut satırları geçersiz kılar ve ALTER'ı düşürür.
--
-- 'free' BİLEREK LİSTEDE YOK: bir abonelik planı değil, revenuecat-webhook'un
-- tanımadığı product_id için ürettiği eşleme boşluğudur. Webhook artık bu
-- durumda satıra dokunmuyor, Sentry'ye PRODUCT_ID_UNMAPPED raporluyor.
-- Kısıta eklemek "ödeme yapan kullanıcı ücretsiz plana düştü" verisini
-- meşrulaştırırdı.
--
-- ETKİ ALANI
-- Yalnızca kısıt değişir. Hiçbir satır UPDATE/DELETE edilmez, veri kaybı
-- riski yok. Kısıt genişliyor (5 değer ⊃ 3 değer), dolayısıyla mevcut hiçbir
-- satır geçersiz hale gelemez — ALTER'ın validasyon taraması kesin geçer.
--
-- GERİ ALMA
-- ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_plan_check;
-- ALTER TABLE subscriptions ADD  CONSTRAINT subscriptions_plan_check
--   CHECK (plan IN ('weekly','monthly','yearly'));
-- ⚠️ Geri alma, bu migration sonrası yazılmış 'annual'/'lifetime' satırları
-- varsa BAŞARISIZ olur — önce onları temizlemek gerekir.
-- ─────────────────────────────────────────────────────────────────────────────

-- 012 kısıtı adsız tanımlandığı için Postgres ona `subscriptions_plan_check`
-- adını üretti. IF EXISTS: temiz kurulumda da, adın farklı üretildiği bir
-- ortamda da migration düşmesin.
ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('weekly', 'monthly', 'yearly', 'annual', 'lifetime'));

COMMENT ON CONSTRAINT subscriptions_plan_check ON subscriptions IS
  'constants/subscriptionPlans.ts LegacyPlanId ile ayna liste. Değişirse ikisi birlikte değişir.';

-- Doğrulama: kısıt gerçekten yeni listeyi taşıyor mu? Sessiz yarım uygulama
-- yasak (CLAUDE.md kural 1).
DO $$
DECLARE
  def TEXT;
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO def
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'subscriptions'
    AND c.conname = 'subscriptions_plan_check';

  IF def IS NULL THEN
    RAISE EXCEPTION '104: subscriptions_plan_check kısıtı oluşmadı.';
  END IF;

  IF def NOT LIKE '%annual%' OR def NOT LIKE '%lifetime%' THEN
    RAISE EXCEPTION
      '104: kısıt beklenen değerleri taşımıyor — mevcut tanım: %', def;
  END IF;
END $$;
