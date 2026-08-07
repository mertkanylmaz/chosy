-- ============================================================================
-- Migration 073: suggestSingleFilm minimum orneklem esigi (B.4 gate duzeltmesi)
--
-- ── Neden ───────────────────────────────────────────────────────────────────
-- 072 ile giden submit-choice, rejection_rate'i son 5 gauntlet'in olaylari
-- uzerinden hesapliyordu. B.4 kapanis testinde olculdu (7 Agu 2026): yeni
-- kullanicinin ILK gauntlet'inde n=3 iken 2 red -> oran 0.67, esik 0.5 ->
-- suggestSingleFilm daha ilk turda aciliyor.
--
-- n=3'te 0.67 gurultuden ayrilamaz. Sonuc: nadir olmasi gereken bir dusus
-- yolu (tek-film modu) fiilen VARSAYILAN davranisa donusuyordu.
--
-- PRODUCT_OS §3.5 bu sinyali "bu kullanici icin gauntlet yanlis" olarak
-- tanimlar — kullanicinin GECMISI uzerine bir yargidir, tek bir gauntlet'in
-- ilk uc olayi uzerine degil. Duzeltme iki parcali:
--   a) oran user_id bazinda son N outcome uzerinden hesaplanir (kod tarafi)
--   b) N'in altinda oran HIC hesaplanmaz, suggestSingleFilm false kalir
--
-- ── Neden app_config ────────────────────────────────────────────────────────
-- 20 sayisi bir tahmin. Gercek dagilim gorulunce ayarlanacak — 8.4'teki saglik
-- paneli esikleri gibi veriyle oynatilabilir kalmali. Kod ici sabit olsaydi
-- her ayarlama yeni bir deploy isterdi.
--
-- ON CONFLICT DO NOTHING = idempotent seed (071/072 ile ayni gerekce).
-- ============================================================================

INSERT INTO app_config (key, value, description) VALUES
  (
    'gauntlet_rejection_min_sample',
    '20'::jsonb,
    'suggestSingleFilm icin gereken minimum outcome sayisi (choice+neither+seen, timeout HARIC). Ayni sayi oranin hesaplandigi pencere boyudur. Altinda oran hesaplanmaz, bayrak kapali kalir.'
  )
ON CONFLICT (key) DO NOTHING;


-- ============================================================================
-- DOWN SCRIPT — geri alma (elle calistirilir, migration olarak DEGIL)
--
-- DELETE FROM app_config WHERE key = 'gauntlet_rejection_min_sample';
-- ============================================================================
