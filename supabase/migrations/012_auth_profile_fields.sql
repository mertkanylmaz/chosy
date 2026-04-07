-- ============================================================
-- MoodFlix — Auth & Profile Fields Migration
-- 012_auth_profile_fields.sql
-- P5.1: Social auth desteği için users tablosuna yeni kolonlar.
-- ============================================================

-- username: kullanıcının seçtiği takma ad (setup-profile adımı)
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;

-- avatar_url: seçilen emoji veya CDN URL (setup-profile adımı)
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- archetype_id: P5.2'de hesaplanacak film arketipi (şimdi NULL kalır)
ALTER TABLE users ADD COLUMN IF NOT EXISTS archetype_id INTEGER;

-- auth_provider: 'anonymous' | 'apple' | 'google'
-- Mevcut kayıtlar DEFAULT ile 'anonymous' alır
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'anonymous';

-- username tekil olmalı (NULL'lar hariç — partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique
  ON users (username)
  WHERE username IS NOT NULL;

-- auth_provider üzerinde index — provider bazlı sorgular için
CREATE INDEX IF NOT EXISTS idx_users_auth_provider
  ON users (auth_provider);
