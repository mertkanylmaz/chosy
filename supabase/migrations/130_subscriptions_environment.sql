-- ─────────────────────────────────────────────────────────────────────────────
-- 130 — subscriptions.environment: SANDBOX / PRODUCTION ayrımı
--
-- SORUN
-- `subscriptions` sandbox (TestFlight) ve production satırlarını ayırt
-- edemiyor. 8 Eki 2026 TRANSFER vakasında sandbox verisi ile gerçek satış
-- aynı tabloda, aynı biçimde duruyordu; süresi 4 Eki'de dolmuş bir sandbox
-- satırı hâlâ status='active' görünüyor.
--
-- DEĞİŞİKLİK
-- 1) Kolon: environment TEXT NOT NULL DEFAULT 'PRODUCTION'
--    CHECK (environment IN ('PRODUCTION','SANDBOX')).
--    CHECK ile DEFAULT aynı ifadede eklenir (106 dersi: DEFAULT'u kısıt
--    listesi dışında bırakmak environment vermeyen her INSERT'i 23514'e
--    düşürürdü). 'PRODUCTION' listede.
-- 2) Backfill: Mertkan'ın onayladığı varsayıma göre (App Store production'da
--    gerçek IAP satışı YOK, tüm satın almalar TestFlight/sandbox) mevcut 5
--    satır SANDBOX'a çekilir. TOPLU WHERE YOK: her satır auth_id ile açıkça
--    listelenir; sayı beklenenden farklıysa migration GÜRÜLTÜLÜ patlar.
--
-- ETKİ ALANI
-- Canlı ölçüm (9 Eki 2026): subscriptions 5 satır. Kolon yok. Webhook bu
-- kolonu 130'dan SONRA deploy edilecek fonksiyon yazar (push → deploy sırası).
-- Eski (kolonu bilmeyen) fonksiyon sürümü kolonu yazmaz → DEFAULT 'PRODUCTION'
-- devreye girer; bu yüzden deploy gecikirse yeni sandbox satırları yanlış
-- etiketlenebilir. İstemci `upsertSubscription` kolonu yazmaz (aynı DEFAULT).
--
-- GERİ ALMA
-- ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_environment_check;
-- ALTER TABLE subscriptions DROP COLUMN environment;
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Kolon + CHECK (DEFAULT birlikte).
ALTER TABLE subscriptions
  ADD COLUMN environment TEXT NOT NULL DEFAULT 'PRODUCTION';

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_environment_check
  CHECK (environment IN ('PRODUCTION', 'SANDBOX'));

COMMENT ON COLUMN subscriptions.environment IS
  'RevenueCat event.environment. Webhook yazar; eksikse webhook 500 döner (varsayılan yazılmaz).';

-- 2) Backfill — 5 satır, auth_id ile açık liste (public.users.auth_id TEXT).
DO $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE subscriptions s
     SET environment = 'SANDBOX'
    FROM users u
   WHERE u.id = s.user_id
     AND u.auth_id IN (
       'de1e4b55-eab4-42b6-a360-0418a6ed9ec6',  -- weekly/trial,   13 May
       '74c91b9d-411b-4992-ac27-3eabddc79aba',  -- monthly/active, 13 May
       'd3cc124c-f3fd-417f-95c3-95ee3e12dbff',  -- weekly/trial,   17 May
       'fef6209b-0682-4f4c-9b3b-23cf8899fb96',  -- annual/active,  26 Eyl (tier=lifetime uyumsuz)
       '0e1c26e4-09c7-4185-9740-e5306b0e493e'   -- annual/active,  1 Eki (expires 4 Eki, hâlâ active)
     );
  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count <> 5 THEN
    RAISE EXCEPTION '130 backfill: 5 satır bekleniyordu, % güncellendi — durduruldu', updated_count;
  END IF;
END
$$;
