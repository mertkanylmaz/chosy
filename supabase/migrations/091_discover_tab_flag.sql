-- Migration 091: discover_tab_enabled (C.9a — bible K-02)
--
-- Discover nav'dan kalkar, app_config flag ile donar, silinmez. Kod (mood.tsx
-- ve içindeki TrendingSection/UpcomingSection/GamesSection/DailyPickSection)
-- SİLİNMEZ — yalnızca tab bar'daki erişim kapanır. Today's Pick de onunla
-- birlikte söner (K-02).
--
-- Geri alma:
--   UPDATE app_config SET value = 'true'::jsonb WHERE key = 'discover_tab_enabled';

INSERT INTO app_config (key, value, description) VALUES (
  'discover_tab_enabled',
  'false'::jsonb,
  'C.9a: Discover tab IA''dan kaldırıldı, kod donduruldu (K-02)'
) ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      description = EXCLUDED.description;
