-- Migration 065: games_enabled — hub'da hangi oyunlar görünsün
--
-- Quoted'ın replik havuzu tükendi: toplam 11 bulmaca üretilebildi, acil havuz
-- boş ve Hard Rule 7 yeni replik eklemeyi yasaklıyor. Hub'da kart görünüyor
-- ama açılınca "bugünün bulmacası hazır değil" hatası geliyordu.
--
-- Kod ve mevcut bulmacalar SİLİNMEZ — havuz tazelenirse bu listeye tek satır
-- eklenerek geri gelir. generate-puzzles de listede olmayan oyun için üretim
-- denemez (her çalışmada 13 gereksiz hata + Sentry kaydı üretiyordu).

INSERT INTO app_config (key, value, description) VALUES (
  'games_enabled',
  '{
    "games": ["cinemetrics", "logline", "spotlight", "imposter", "fadein", "detective"]
  }'::jsonb,
  'Hub''da gorunen ve uretilen oyunlar. quoted: replik havuzu tukendi (Hard Rule 7)'
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
