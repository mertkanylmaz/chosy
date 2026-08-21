-- Migration 102: users.referred_by FK'sinde silme davranisi yoktu
--
-- 026 kolonu cascade'siz tanimladi:
--   referred_by UUID REFERENCES auth.users(id)
--
-- Etkisi: davet eden kullanici hesabini silince auth.users DELETE'i bu FK
-- yuzunden RESTRICT ile dusuyor (101 ile ayni belirti, ayni App Review
-- blocker'i). delete-account HTTP 207 donuyordu.
--
-- CASCADE DEGIL, SET NULL: referrer'in hesabini silmesi, onun davet ettigi
-- kullanicilarin hesaplarini silmemeli. Davet zinciri kopar, referred
-- kullanici kalir. `referrals` tablosunun kendi FK'leri zaten
-- ON DELETE CASCADE (026:26-27) — davet KAYDI gider, kullanici kalir.
--
-- Not (bu migration'in kapsami DISINDA, tespit): FK auth.users(id)'yi
-- gosteriyor ama `apply_invite_code` RPC'si (026:132) kolona app
-- `users.id` yaziyor. Iki id uzayi ayni degil; RPC bugune kadar ya hic
-- calismadi ya da FK ihlaliyle dustu. Ayri bir is olarak ele alinmali.
--
-- Geri alma:
--   ALTER TABLE users DROP CONSTRAINT users_referred_by_fkey;
--   ALTER TABLE users
--     ADD CONSTRAINT users_referred_by_fkey
--     FOREIGN KEY (referred_by) REFERENCES auth.users(id);

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_referred_by_fkey;

ALTER TABLE users
  ADD CONSTRAINT users_referred_by_fkey
  FOREIGN KEY (referred_by) REFERENCES auth.users(id) ON DELETE SET NULL;
