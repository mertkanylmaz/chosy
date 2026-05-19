-- ============================================================
-- Chosy.ai — Auth & Profile Fields Migration
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

-- Migration 012: Subscription & Mood Quota tabloları
-- P9 Payment system altyapısı

-- ─── Subscriptions ───────────────────────────────────────────────────────────
-- Kullanıcı abonelik durumunu takip eder.
-- RevenueCat ana kaynak, bu tablo lokal cache + kota motoru için kullanılır.

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('weekly', 'monthly', 'yearly')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('free', 'trial', 'active', 'expired', 'cancelled')),
  trial_used BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  rc_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Kullanıcı başına aktif abonelik hızlı sorgusu
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status
  ON subscriptions(user_id, status);

-- ─── Mood Searches ───────────────────────────────────────────────────────────
-- Her mood arama kaydı. Kota motoru bu tablodan sayaç okur.

CREATE TABLE IF NOT EXISTS mood_searches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) NOT NULL,
  searched_at TIMESTAMPTZ DEFAULT now()
);

-- Günlük/haftalık sayaç sorguları için composite index
CREATE INDEX IF NOT EXISTS idx_mood_searches_user_date
  ON mood_searches(user_id, searched_at);

-- ─── Trial Claims ────────────────────────────────────────────────────────────
-- Email bazlı free trial tekrar engeli.
-- Aynı email ile ikinci kez trial başlatılamaz.

CREATE TABLE IF NOT EXISTS trial_claims (
  email TEXT PRIMARY KEY,
  claimed_at TIMESTAMPTZ DEFAULT now()
);

-- ─── RLS Politikaları ────────────────────────────────────────────────────────

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mood_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE trial_claims ENABLE ROW LEVEL SECURITY;

-- subscriptions: kullanıcı sadece kendi aboneliğini görebilir
CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()::text));

CREATE POLICY "Users can insert own subscriptions"
  ON subscriptions FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()::text));

CREATE POLICY "Users can update own subscriptions"
  ON subscriptions FOR UPDATE
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()::text));

-- mood_searches: kullanıcı sadece kendi aramalarını görebilir/ekleyebilir
CREATE POLICY "Users can view own mood searches"
  ON mood_searches FOR SELECT
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()::text));

CREATE POLICY "Users can insert own mood searches"
  ON mood_searches FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()::text));

-- trial_claims: kullanıcı sadece kendi email'ini sorgulayabilir
-- (service_role ile yönetilir, client'tan sadece okuma)
CREATE POLICY "Users can view own trial claim"
  ON trial_claims FOR SELECT
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert own trial claim"
  ON trial_claims FOR INSERT
  WITH CHECK (email = (SELECT email FROM auth.users WHERE id = auth.uid()));