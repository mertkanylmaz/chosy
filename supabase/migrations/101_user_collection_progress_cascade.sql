-- Migration 101: user_collection_progress.user_id FK'sinde ON DELETE CASCADE yoktu
--
-- 061 tabloyu olustururken FK'yi cascade'siz tanimladi:
--   user_id UUID NOT NULL REFERENCES auth.users(id)
-- 067 ayni hata sinifini daily_chest_log icin duzeltmisti; bu tablo atlanmisti.
--
-- Etkisi: delete-account Edge Function'i users satirini siliyor, ardindan
-- auth.users satirini silmeye calisiyor. Bu FK RESTRICT (varsayilan) oldugu
-- icin auth.users DELETE'i basarisiz oluyor; fonksiyon HTTP 207
-- (auth_user_delete_failed) donuyor, client bunu basari sayiyordu.
-- Sonuc: kullanici verisi gidiyor ama auth.users kaydi ayakta kaliyor
-- (K-16 / App Review blocker).
--
-- FK hedefi DEGISTIRILMEZ. Tabloya yazan hicbir servis yok (K-07'de UI
-- kaldirildi, gamification.ts yalnizca okuyor), RLS politikasi
-- `auth.uid() = user_id` yani auth id semantigi bekliyor. Yalnizca silme
-- davranisi eklenir.
--
-- Geri alma:
--   ALTER TABLE user_collection_progress
--     DROP CONSTRAINT user_collection_progress_user_id_fkey;
--   ALTER TABLE user_collection_progress
--     ADD CONSTRAINT user_collection_progress_user_id_fkey
--     FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE user_collection_progress
  DROP CONSTRAINT IF EXISTS user_collection_progress_user_id_fkey;

ALTER TABLE user_collection_progress
  ADD CONSTRAINT user_collection_progress_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
