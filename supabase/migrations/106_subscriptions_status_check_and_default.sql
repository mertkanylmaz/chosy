-- ─────────────────────────────────────────────────────────────────────────────
-- 106 — subscriptions.status: CHECK kısıtını geri getir + DEFAULT'u düzelt
--
-- SORUN
-- `012_auth_profile_fields.sql:40` şunu tanımlıyor:
--     status TEXT NOT NULL DEFAULT 'active'
--       CHECK (status IN ('free','trial','active','expired','cancelled'))
-- Ama 012 `CREATE TABLE IF NOT EXISTS` kullanıyor ve tablo Dashboard
-- döneminden zaten vardı → CREATE atlandı, kısıt hiç oluşmadı, DEFAULT da
-- Dashboard'daki hâliyle kaldı. Canlı ölçüm (22 Ağu 2026):
--     CHECK kısıtı      : YOK
--     column_default    : 'inactive'::text   ← 012 'active' diyor
-- (Aynı no-op `plan` CHECK'ini de yok etmişti — 104 onu kapattı.)
--
-- ⚠️ İKİSİ AYRILAMAZ — DEFAULT ÖNCE
-- 'inactive' değeri hedef listede YOKTUR. Yalnızca CHECK eklenip DEFAULT
-- olduğu gibi bırakılsaydı, `status` vermeden yapılan HER INSERT DEFAULT'tan
-- 'inactive' alıp kısıta takılır ve `23514` ile patlardı. Bu yüzden DEFAULT
-- düzeltmesi CHECK'ten ÖNCE ve aynı migration içinde yapılır.
--
-- KELİME DAĞARCIĞININ KAYNAĞI
-- Yeni sözlük İCAT EDİLMİYOR. Liste, istemcide zaten kilitli olan tipin
-- birebir kendisi — `constants/subscriptionPlans.ts:27`:
--     export type SubscriptionStatus =
--       'free' | 'trial' | 'active' | 'expired' | 'cancelled'
-- 012'nin listesiyle de birebir aynı. Yani kısıt, kodun aylardır varsaydığı
-- sözleşmeye geri hizalanıyor.
--
-- 'inactive' BİLEREK LİSTEDE YOK: hiçbir kod bu değeri üretmiyor
-- (`services/subscriptionService.ts` her yazmada `SubscriptionStatus` geçirir)
-- ve canlıda bu değeri taşıyan satır yok. Listeye eklemek, yalnızca yanlış
-- bir Dashboard DEFAULT'unu kalıcılaştırmak olurdu.
--
-- ETKİ ALANI
-- Canlı ölçüm (22 Ağu 2026): 3 satır — 2× 'trial', 1× 'active'. İkisi de
-- hedef listede, dolayısıyla ADD CONSTRAINT'in doğrulama taraması geçer.
-- Hiçbir satır UPDATE/DELETE edilmez, veri kaybı riski yok.
-- Liste dışı bir satır çıkarsa ALTER **gürültülü şekilde patlar** — kısıt
-- koşullu eklenmez, sapma gizlenmez (CLAUDE.md kural 1).
--
-- GERİ ALMA
-- ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_status_check;
-- ALTER TABLE subscriptions ALTER COLUMN status SET DEFAULT 'inactive';
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) DEFAULT'u önce düzelt (yukarıdaki gerekçe).
ALTER TABLE subscriptions
  ALTER COLUMN status SET DEFAULT 'active';

-- 2) CHECK'i (yeniden) kur. Adsız tanımlansaydı Postgres bu adı üretirdi;
--    açıkça adlandırıyoruz ki gelecekteki DROP hedefi belirsiz olmasın.
ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('free', 'trial', 'active', 'expired', 'cancelled'));

COMMENT ON CONSTRAINT subscriptions_status_check ON subscriptions IS
  'constants/subscriptionPlans.ts SubscriptionStatus ile ayna liste. Değişirse ikisi birlikte değişir.';

-- Doğrulama: hem kısıt hem DEFAULT beklenen hâlde mi?
DO $$
DECLARE
  v_def     TEXT;
  v_default TEXT;
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO v_def
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'subscriptions'
    AND c.conname = 'subscriptions_status_check';

  IF v_def IS NULL THEN
    RAISE EXCEPTION '106: subscriptions_status_check kısıtı oluşmadı.';
  END IF;

  IF v_def NOT LIKE '%cancelled%' OR v_def NOT LIKE '%trial%' THEN
    RAISE EXCEPTION
      '106: kısıt beklenen değerleri taşımıyor — mevcut tanım: %', v_def;
  END IF;

  SELECT column_default INTO v_default
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'subscriptions'
    AND column_name = 'status';

  -- ⚠️ Tırnaklar şart: `LIKE '%active%'` yanlış geçerdi, çünkü hatalı
  -- DEFAULT olan 'inactive' de 'active' alt dizesini içerir. Tırnaklı
  -- literal aranınca `'inactive'::text` eşleşmez.
  IF v_default IS NULL OR v_default NOT LIKE '%''active''%' THEN
    RAISE EXCEPTION
      '106: status DEFAULT ''active'' olarak ayarlanmadı — mevcut: %',
      coalesce(v_default, '<yok>');
  END IF;
END $$;
