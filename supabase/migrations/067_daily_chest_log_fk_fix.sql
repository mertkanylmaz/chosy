-- Migration 067: daily_chest_log.user_id yanlış tabloya bakıyordu
--
-- 060'ta FK auth.users(id)'ye tanımlanmıştı, ama oyun sistemi her yerde
-- app users(id) kullanıyor (game_scores, cinema_dna, user_streaks aynı).
-- Tablo hiç yazılmadığı için sorun bugüne kadar görünmedi; sunucu tarafı
-- sandık yazımı devreye girince ilk insert FK ihlaliyle düştü.
--
-- Tablo boş olduğu için veri taşıma gerekmez.

ALTER TABLE daily_chest_log
  DROP CONSTRAINT IF EXISTS daily_chest_log_user_id_fkey;

ALTER TABLE daily_chest_log
  ADD CONSTRAINT daily_chest_log_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- RLS politikası da auth.uid() ile app user id'yi karşılaştırıyordu — hiçbir
-- satır eşleşmezdi. Doğru eşleştirme users tablosu üzerinden yapılır
-- (users.auth_id TEXT olduğu için auth.uid() cast edilir — 001'deki desen).
DROP POLICY IF EXISTS "Users read own chests" ON daily_chest_log;

CREATE POLICY "Users read own chests" ON daily_chest_log
  FOR SELECT USING (
    user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()::text)
  );
