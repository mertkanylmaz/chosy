-- Kullanıcı profil öğrenme: toplam etkileşim sayacı
-- updateUserVector fonksiyonunun EMA alpha hesabı için kullanılır.
-- DEFAULT 0: mevcut satırlar da dahil tüm kayıtlar 0 ile başlar.

ALTER TABLE users ADD COLUMN IF NOT EXISTS total_interactions int DEFAULT 0;
