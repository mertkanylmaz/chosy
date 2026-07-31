-- 068_dev_reset_allowlist.sql
--
-- dev-reset-games allowlist'ini olusturur.
--
-- SORUN: Fonksiyon (migration 067 doneminde, commit baea89a) allowlist'i
-- `app_config.key = 'dev_reset_user_ids'` satirindan okuyacak sekilde yazildi
-- ve satir yoksa fail-closed davranarak 403 donuyor. O satiri olusturan bir
-- migration hicbir zaman yazilmadi — yani Hub'daki sifirlama butonu dogdugu
-- gunden beri HERKESE 403 veriyordu.
--
-- Fail-closed davranis DOGRU ve korunuyor: `game_scores` uzerinde DELETE
-- politikasi bilincli olarak yok, cunku olsaydi herhangi bir kullanici
-- kaybettigi gunluk bulmacayi silip kazanana kadar tekrar oynayabilirdi.
-- Bu migration yalnizca gelistirici test hesaplarini listeye ekler.
--
-- Listeye yeni hesap eklemek gerekirse: fonksiyon artik 403 yanitinda
-- cagiran hesabin kendi `users.id`'sini donuyor, oradan okunup buraya
-- yeni bir migration ile eklenir.

INSERT INTO app_config (key, value, description)
VALUES (
  'dev_reset_user_ids',
  '{"user_ids": ["c6140c44-2a5c-4780-a79b-ba7aa7af8c0b"]}'::jsonb,
  'dev-reset-games fonksiyonunu kullanabilecek test hesaplari (users.id). Bos veya kayitsizsa fonksiyon herkese kapalidir.'
)
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      description = EXCLUDED.description,
      updated_at = NOW();
