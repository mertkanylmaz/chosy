-- Migration 013: mood_searches RLS politikası düzeltmesi
-- Sorun: migration 012'deki IN (SELECT id FROM users WHERE auth_id = auth.uid())
--   subquery'si, users tablosunun kendi RLS politikasına takılarak INSERT'leri bloke ediyordu.
-- Çözüm: SECURITY DEFINER fonksiyon — RLS'yi bypass ederek doğrudan auth_id eşleşmesi yapar.

-- ─── Yardımcı Fonksiyon ───────────────────────────────────────────────────────
-- Mevcut auth.uid()'e karşılık gelen users.id'yi döndürür.
-- SECURITY DEFINER: RLS'yi bypass eder, sadece kendi tablosuna erişir.

CREATE OR REPLACE FUNCTION auth_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- ─── mood_searches RLS — Yeniden oluştur ─────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own mood searches" ON mood_searches;
DROP POLICY IF EXISTS "Users can insert own mood searches" ON mood_searches;

CREATE POLICY "Users can view own mood searches"
  ON mood_searches FOR SELECT
  USING (user_id = auth_user_id());

CREATE POLICY "Users can insert own mood searches"
  ON mood_searches FOR INSERT
  WITH CHECK (user_id = auth_user_id());

-- ─── subscriptions RLS — Aynı fonksiyonu kullansın ──────────────────────────

DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON subscriptions;

CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  USING (user_id = auth_user_id());

CREATE POLICY "Users can insert own subscriptions"
  ON subscriptions FOR INSERT
  WITH CHECK (user_id = auth_user_id());

CREATE POLICY "Users can update own subscriptions"
  ON subscriptions FOR UPDATE
  USING (user_id = auth_user_id());
