-- Migration 066: Daily Chest'i sunucuya taşı
--
-- 060'ta tablo açılmıştı ama hiç yazılmadı: sandık tamamen istemcide "açılıyor",
-- hiçbir ödül gerçekten uygulanmıyordu. Kullanıcıya verilmeyen ödül vaat etmek
-- ölçümü de bozuyor (game_daily_chest_opened gerçek bir kazanıma karşılık gelmiyordu).
--
-- Bu migration ödüllerin yaşayacağı alanları açar; yazım submit-guess'te yapılır.

-- Ertesi güne taşınan XP çarpanı — sandığın "Double XP Tomorrow" ödülü
ALTER TABLE user_streaks
  ADD COLUMN IF NOT EXISTS double_xp_date DATE;

COMMENT ON COLUMN user_streaks.double_xp_date IS
  'Bu tarihte kazanilan XP 2x uygulanir (Daily Chest odulu). submit-guess okur.';

-- Ödül içeriği config'ten okunur (Hard Rule 4). rare_poster ve dna_boost
-- KALDIRILDI: koleksiyon ekranı Faz 2'de, DNA boost recompute akışını
-- değiştirmeyi gerektiriyor. Vaat edilmeyen ödül gösterilmez.
INSERT INTO app_config (key, value, description) VALUES (
  'daily_chest_rewards',
  '{
    "streak_shield_count": 1,
    "double_xp_tomorrow": true
  }'::jsonb,
  'Daily Chest odulleri — hepsi submit-guess tarafindan GERCEKTEN uygulanir'
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
