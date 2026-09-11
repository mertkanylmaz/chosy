-- ============================================================================
-- 111 — FK kimlik uzayı düzeltmesi + RLS service-role politikaları
--
-- Keşif: docs/investigations/LIFETIME_REFERRAL_FK_KESIF.md (D-1, D-2)
-- Emsal: migration 014 — aynı hata sınıfı mood_searches/subscriptions için
--        bir kez teşhis edilip düzeltilmişti; desen 025/026'da tekrarlandı.
--
-- SORUN (D-1):
--   Bu şemada iki AYRIK kullanıcı kimliği uzayı var. Canlı ölçüm (11 Eyl 2026):
--   public.users 260 satır, auth.users 272 satır, id kesişimi **0**. Tek köprü
--   public.users.auth_id (TEXT).
--
--   `lifetime_sales`, `referrals`, `referral_rewards` ve `users.referred_by`
--   FK'leri auth.users(id)'yi hedefliyor; ama bu tablolara yazan SECURITY
--   DEFINER fonksiyonların gövdeleri public.users.id üretiyor:
--     - apply_invite_code: `SELECT id FROM users` → public uzay (109:988-990)
--     - activate_referral: v_referral.referrer_id → public uzay
--     - claim_lifetime_spot: `UPDATE users WHERE id = p_user_id` ve
--       `UPDATE subscriptions WHERE user_id = p_user_id` → public uzay bekliyor
--   Ayrıca 109'un guard'ı (auth_user_id()) public uzay dayatıyor.
--
--   Sonuç ölçümle tutarlı: 260 kullanıcıya karşılık referrals 0, referral_rewards
--   0, users.referred_by dolu 0.
--
-- YÖN (a) seçildi — CTO onaylı: FK'ler public.users(id)'ye çevrilir.
--   Gerekçe: fonksiyon gövdeleri ve 109 guard'ı zaten public uzayı dayatıyor;
--   ters yön (fonksiyonları auth id yazacak şekilde değiştirmek) 109'un guard
--   semantiğini bozar ve claim_lifetime_spot'un tier UPDATE'lerini de kırar.
--
-- VERİ GÜVENLİĞİ: dört hedefin de satır sayısı **0** (11 Eyl 2026 ölçümü).
--   Backfill gerekmiyor, FK swap sırasında hiçbir satır geçersizleşmiyor.
--
-- KAPSAM DIŞI (bilinçli, dokunulmadı):
--   user_collection_progress.user_id — 101'de bilinçli auth'ta bırakıldı,
--     gerekçesi migration başlığında yazılı.
--   winback_queue.user_id — revenuecat-webhook iki uzayı doğru yönetiyor
--     (index.ts:166-167, :718 authUserId yazıyor). FK doğru.
--     (Bu tablonun yalnızca RLS politikası aşağıda düzeltiliyor.)
--
-- SORUN (D-2 — RLS):
--   Üç politika `TO` clause'suz yazılmış. `TO` yokken politika PUBLIC role'e
--   uygulanır, yani anon dahil HERKESE. `USING (true)` / `WITH CHECK (true)`
--   ile birleşince "Service role can ..." adı yanıltıcı: tablo fiilen anon'a
--   açık. 099'da watchlist'te birebir aynı hata yaşandı.
--
--   Ayrıca owner-read politikaları `auth.uid() = user_id` yazıyor; FK swap
--   sonrası kolon public.users.id taşıyacağı için bu karşılaştırma HER ZAMAN
--   false döner (kesişim 0). app_user_id() join'ine çevriliyor — şemadaki
--   hâkim owner-read deseni (choice_events, cinema_dna, arcade_runs, …).
--
-- GERİ ALMA:
--   FK'ler: her ADD CONSTRAINT'i DROP edip REFERENCES auth.users(id) ile
--   yeniden kur (lifetime_sales/referral_rewards/referrals → ON DELETE CASCADE,
--   users.referred_by → ON DELETE SET NULL).
--   Politikalar: aşağıdaki CREATE POLICY'leri DROP edip 025:32-39, 026:47-60,
--   026:84-86, 027:37-40'taki orijinal tanımlarla yeniden kur.
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- (A) FK kimlik uzayı: auth.users(id) → public.users(id)
-- ════════════════════════════════════════════════════════════════════════════

-- ── lifetime_sales.user_id (025:12) ─────────────────────────────────────────
ALTER TABLE lifetime_sales
  DROP CONSTRAINT IF EXISTS lifetime_sales_user_id_fkey;

ALTER TABLE lifetime_sales
  ADD CONSTRAINT lifetime_sales_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ── referral_rewards.user_id (026:67) ───────────────────────────────────────
ALTER TABLE referral_rewards
  DROP CONSTRAINT IF EXISTS referral_rewards_user_id_fkey;

ALTER TABLE referral_rewards
  ADD CONSTRAINT referral_rewards_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ── referrals.referrer_id (026:26) ──────────────────────────────────────────
ALTER TABLE referrals
  DROP CONSTRAINT IF EXISTS referrals_referrer_id_fkey;

ALTER TABLE referrals
  ADD CONSTRAINT referrals_referrer_id_fkey
  FOREIGN KEY (referrer_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ── referrals.referee_id (026:27) ───────────────────────────────────────────
ALTER TABLE referrals
  DROP CONSTRAINT IF EXISTS referrals_referee_id_fkey;

ALTER TABLE referrals
  ADD CONSTRAINT referrals_referee_id_fkey
  FOREIGN KEY (referee_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ── users.referred_by (026:11, silme davranışı 102'de SET NULL yapıldı) ─────
-- ON DELETE SET NULL korunuyor: referrer hesabını silince davet ettiklerinin
-- hesapları silinmemeli (102'nin gerekçesi aynen geçerli).
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_referred_by_fkey;

ALTER TABLE users
  ADD CONSTRAINT users_referred_by_fkey
  FOREIGN KEY (referred_by) REFERENCES public.users(id) ON DELETE SET NULL;


-- ════════════════════════════════════════════════════════════════════════════
-- (B) RLS — service-role politikalarını PUBLIC'ten kapat
-- ════════════════════════════════════════════════════════════════════════════
--
-- `TO service_role` tek başına yeterli kapatmadır; `auth.role()` kontrolü
-- ikinci katman olarak ekleniyor (politika ileride yanlışlıkla başka bir role
-- genişletilirse gövde hâlâ reddeder).

-- ── lifetime_sales ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Service role can insert lifetime sales" ON lifetime_sales;

CREATE POLICY "Service role can insert lifetime sales"
  ON lifetime_sales FOR INSERT
  TO service_role
  WITH CHECK (auth.role() = 'service_role');

-- ── referrals ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Service role can manage referrals" ON referrals;

CREATE POLICY "Service role can manage referrals"
  ON referrals FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── winback_queue ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Service role manages winback queue" ON winback_queue;

CREATE POLICY "Service role manages winback queue"
  ON winback_queue FOR ALL
  TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ════════════════════════════════════════════════════════════════════════════
-- (C) RLS — owner-read politikalarını public.users uzayına çevir
-- ════════════════════════════════════════════════════════════════════════════
--
-- app_user_id() (069:41) oturumdaki auth.uid()'in public.users.id karşılığını
-- döner. `(SELECT app_user_id())` sarmalı bilinçli: satır başına değil sorgu
-- başına bir kez değerlendirilir (şemadaki mevcut owner-read deseni).

-- ── lifetime_sales (025:32-34) ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own lifetime sale" ON lifetime_sales;

CREATE POLICY "Users can view own lifetime sale"
  ON lifetime_sales FOR SELECT
  TO authenticated
  USING (user_id = (SELECT app_user_id()));

-- ── referrals (026:47-54) ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own referrals as referrer" ON referrals;

CREATE POLICY "Users can view own referrals as referrer"
  ON referrals FOR SELECT
  TO authenticated
  USING (referrer_id = (SELECT app_user_id()));

DROP POLICY IF EXISTS "Users can view own referral as referee" ON referrals;

CREATE POLICY "Users can view own referral as referee"
  ON referrals FOR SELECT
  TO authenticated
  USING (referee_id = (SELECT app_user_id()));

-- ── referral_rewards (026:84-86) ────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own rewards" ON referral_rewards;

CREATE POLICY "Users can view own rewards"
  ON referral_rewards FOR SELECT
  TO authenticated
  USING (user_id = (SELECT app_user_id()));
