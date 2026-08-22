-- ─────────────────────────────────────────────────────────────────────────────
-- 105 — subscriptions.entitlement_id: migration hattına al + DEFAULT'u düzelt
--
-- SORUN 1 — kolon migration hattında yok
-- `entitlement_id` canlıda var ama hiçbir migration onu TANIMLAMIYOR. Kök neden
-- 22 Ağu 2026'da bulundu: `012_auth_profile_fields.sql:36` `CREATE TABLE
-- **IF NOT EXISTS** subscriptions` kullanıyor ve tablo Dashboard döneminden
-- zaten vardı → CREATE tamamen atlandı. Kolon o dönemden kalma.
-- (Aynı no-op `status`/`plan` CHECK'lerini de yok etti — bkz. 104 ve 106.)
--
-- SORUN 2 — DEFAULT hâlâ eski adı üretiyor  ← BU MIGRATION'IN ASIL SEBEBİ
-- 089 mevcut 3 satırı 'premium' → 'chosy_plus' olarak düzeltti ama kolonun
-- DEFAULT'una DOKUNMADI. Canlı ölçüm (22 Ağu 2026):
--     column_default = 'premium'::text
-- Yani bugün eklenecek her yeni abonelik satırı yine 'premium' alacak ve
-- 089'un kapattığı sapma kendini yeniden üretecekti. Satırları düzeltip
-- kaynağı açık bırakmak, sızıntıyı silip musluğu kapatmamaktır.
--
-- ⚠️ TEMİZ KURULUM HÂLÂ ÇALIŞMIYOR — BİLİNÇLİ KARAR
-- `db reset` sırasında 089 bu dosyadan ÖNCE çalışır ve kolon henüz yokken
-- `UPDATE subscriptions SET entitlement_id = …` yaptığı için `42703
-- undefined_column` ile ölür; 105'e hiç sıra gelmez. CTO kararı (22 Ağu 2026):
-- uygulanmış bir migration dosyası geriye dönük DÜZENLENMEZ. Dolayısıyla bu
-- migration CANLIYI düzeltir, temiz kurulumu düzeltmez. Yeni ortam kurulumu
-- manuel adım ister — bu bilinen ve kabul edilmiş bir borçtur.
-- `ADD COLUMN IF NOT EXISTS` yine de yazılıyor: hattı belgeler ve 089'un
-- ileride onarılması hâlinde bu dosya doğru sırayı zaten taşır.
--
-- ETKİ ALANI
-- Canlıda: kolon zaten var → ADD no-op. Yalnız DEFAULT değişir. Mevcut
-- satırlara DOKUNULMAZ (üçü de zaten 'chosy_plus'). Veri kaybı riski yok.
--
-- GERİ ALMA
-- ALTER TABLE subscriptions ALTER COLUMN entitlement_id SET DEFAULT 'premium';
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Kolonu migration hattına al (canlıda no-op).
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS entitlement_id TEXT;

-- 2) DEFAULT'u kod sabitine hizala.
--    Tek kaynak: constants/subscriptionPlans.ts:128 → RC_ENTITLEMENT_ID
ALTER TABLE subscriptions
  ALTER COLUMN entitlement_id SET DEFAULT 'chosy_plus';

-- 3) Artık kalmış eski değer varsa normalize et (089'un tekrarı — canlıda
--    0 satır etkiler, temiz kurulumda gerçek iş yapar).
UPDATE subscriptions
SET entitlement_id = 'chosy_plus'
WHERE entitlement_id = 'premium';

COMMENT ON COLUMN subscriptions.entitlement_id IS
  'RevenueCat entitlement adı. constants/subscriptionPlans.ts RC_ENTITLEMENT_ID ile ayna — değişirse ikisi birlikte değişir.';

-- Doğrulama: DEFAULT gerçekten değişti mi ve geride 'premium' kaldı mı?
-- Sessiz yarım uygulama yasak (CLAUDE.md kural 1).
DO $$
DECLARE
  v_default TEXT;
  v_leftover INTEGER;
BEGIN
  SELECT column_default INTO v_default
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'subscriptions'
    AND column_name = 'entitlement_id';

  IF v_default IS NULL OR v_default NOT LIKE '%chosy_plus%' THEN
    RAISE EXCEPTION
      '105: entitlement_id DEFAULT beklenen değere ayarlanmadı — mevcut: %',
      coalesce(v_default, '<yok>');
  END IF;

  SELECT count(*) INTO v_leftover
  FROM subscriptions
  WHERE entitlement_id = 'premium';

  IF v_leftover > 0 THEN
    RAISE EXCEPTION
      '105: % satır hâlâ entitlement_id = ''premium'' taşıyor.', v_leftover;
  END IF;
END $$;
