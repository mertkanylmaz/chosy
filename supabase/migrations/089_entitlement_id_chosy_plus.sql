-- ─────────────────────────────────────────────────────────────────────────────
-- 089 — subscriptions.entitlement_id: 'premium' → 'chosy_plus'
--
-- CTO kararı (17 Ağu 2026): hedef entitlement adı 'chosy_plus'. Kod sabiti
-- (`constants/subscriptionPlans.ts` → RC_ENTITLEMENT_ID) zaten 'chosy_plus';
-- RevenueCat dashboard'a DOKUNULMUYOR. Yani sapma yalnızca veri tarafındadır:
-- V1'den kalan 3 satır hâlâ eski adı ('premium') taşıyor ve entitlement adına
-- göre eşleşen her sorgu bu satırları ıskalıyor.
--
-- ⚠️ ŞEMA SAPMASI NOTU (bu migration'ın açtığı bir sorun değil, mevcut durum):
-- `subscriptions.entitlement_id` kolonu CANLI veritabanında var ama
-- `supabase/migrations/` altındaki HİÇBİR dosyada tanımlı değil (012'deki
-- CREATE TABLE'da yok, sonraki hiçbir migration eklemiyor). Kolon geçmişte
-- migration hattı dışından eklenmiş. Sonuç: temiz bir `db reset` bu kolonu
-- üretmez ve aşağıdaki UPDATE orada `42703 undefined_column` verir.
-- Bu migration sapmayı GİZLEMEZ (koşullu DO bloğu ile atlamaz) — canlıda
-- doğru çalışır, temiz kurulumda gürültülü şekilde patlar. Kolonun migration
-- hattına geri alınması ayrı bir karar ve ayrı bir migration'dır.
--
-- Etki alanı: WHERE koşulu açıktır (entitlement_id = 'premium'). Kör UPDATE
-- yok; 'chosy_plus' veya başka bir değer taşıyan satıra dokunulmaz.
-- Ölçüm (17 Ağu 2026, sunucu count=exact): subscriptions toplam 3 satır,
-- üçü de entitlement_id = 'premium'. Beklenen etkilenen satır: 3.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE subscriptions
SET entitlement_id = 'chosy_plus'
WHERE entitlement_id = 'premium';

-- Doğrulama: geriye 'premium' kalmamalı. Kalırsa migration sessizce yarım
-- uygulanmış demektir (CLAUDE.md kural 1: sessiz fallback yasak).
DO $$
DECLARE
  leftover INTEGER;
BEGIN
  SELECT count(*) INTO leftover
  FROM subscriptions
  WHERE entitlement_id = 'premium';

  IF leftover > 0 THEN
    RAISE EXCEPTION
      '089: % satır hâlâ entitlement_id = ''premium'' taşıyor — UPDATE eksik uygulandı.',
      leftover;
  END IF;
END $$;
