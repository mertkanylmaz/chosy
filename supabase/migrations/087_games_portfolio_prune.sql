-- Migration 087: oyun portföyü budaması (C.6 — PRODUCT_OS §7.4)
--
-- CTO onayı 16.08.2026 · `supabase db push` uygulandı, canlı değer doğrulandı:
--   {"games": ["spotlight"], "roulette": false}
--
-- Karar: Chosy günlük bir film ritüelidir; iki günlük ritüel olamaz. Tek bonus
-- oyun Spotlight kalır. Diğerleri DONDURULUR — kod, rota, tema tanımı ve
-- üretilmiş bulmacalar SİLİNMEZ (Hard Rule: film/oyun verisinde DELETE yok).
-- Geri açmak bu listeye tek satır eklemekten ibaret.
--
--   cinemetrics · logline · imposter · fadein · detective → dondurulur
--   quoted                                                → zaten dışarıdaydı (065)
--   spotlight                                             → AKTİF kalır
--
-- Ek alan `roulette`: Watchlist Roulette / Slot gauntlet'ı kanibalize ediyor
-- ("bugün ne izlesem" sorusuna ikinci cevap). `games` dizisine EKLENMEDİ —
-- generate-puzzles yalnızca o dizi üzerinde dönüyor ve Roulette'in bulmaca
-- üreteci yok; diziye yazılsaydı her çalışmada hatalı üretim denemesi olurdu.
-- İstemci bu alanı `isRouletteEnabled()` ile lazy okur; alan yoksa da kapalı
-- sayar — bu satır kararı VERİDE de görünür kılmak içindir.
--
-- Geri alma:
--   UPDATE app_config SET value = '{"games":["cinemetrics","logline",
--     "spotlight","imposter","fadein","detective"]}'::jsonb
--   WHERE key = 'games_enabled';

INSERT INTO app_config (key, value, description) VALUES (
  'games_enabled',
  '{
    "games": ["spotlight"],
    "roulette": false
  }'::jsonb,
  'Aktif oyunlar. C.6: tek bonus oyun spotlight; digerleri donduruldu (kod silinmedi). roulette: gauntleti kanibalize ediyor, erisim kapali'
) ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      description = EXCLUDED.description;
