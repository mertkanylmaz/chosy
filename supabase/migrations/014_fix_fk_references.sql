-- Migration 014: Foreign Key referanslarını düzelt
-- Sorun: Migration 012'deki mood_searches, subscriptions, trial_claims tabloları
--   `REFERENCES users(id)` yazmış ama Supabase search_path nedeniyle
--   bunu `auth.users(id)` olarak resolve etmiş.
--   Uygulama kodu `public.users.id` gönderiyor → FK violation → insert fail
--   → mood_searches'a kayıt yazılamıyor → kota hep 0 → ödeme bypass!
--
-- Çözüm: FK constraint'leri drop edip `public.users(id)` referansıyla yeniden oluştur.

-- ─── mood_searches ──────────────────────────────────────────────────────────

ALTER TABLE mood_searches
  DROP CONSTRAINT IF EXISTS mood_searches_user_id_fkey;

ALTER TABLE mood_searches
  ADD CONSTRAINT mood_searches_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ─── subscriptions ──────────────────────────────────────────────────────────

ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ─── trial_claims — email bazlı, user_id FK yok ama kontrol edelim ────────
-- trial_claims'da user_id yok (PK: email), ama yanlış FK varsa düzelt

-- trial_claims_user_id_fkey mevcut mu kontrol — varsa drop et
ALTER TABLE trial_claims
  DROP CONSTRAINT IF EXISTS trial_claims_user_id_fkey;
