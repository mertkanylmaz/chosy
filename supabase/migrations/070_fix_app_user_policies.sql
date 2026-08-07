-- ============================================================================
-- Migration 070: auth.uid() ile app user id karsilastiran bozuk policy'ler
--
-- Sorun: public.users.id ile auth.users.id AYRI id uzaylari (olculdu 6 Agu 2026:
-- 136/136 public.users satiri auth.users'ta yok). Asagidaki tablolarin user_id
-- kolonu app user id tutuyor, ama policy'leri `auth.uid() = user_id` yaziyor.
-- Sonuc: policy hicbir kullanici icin hicbir satir dondurmuyor — syntax hatasi
-- vermeden, sessizce. Migration 067 ayni hatayi daily_chest_log icin duzeltmisti;
-- bu dosya kalan tablolari ayni desene getirir.
--
-- Dogru desen (067 / 001 / 009): app user id, users.auth_id uzerinden cozulur.
-- 069'daki public.app_user_id() helper'i kullanilir, yeniden yazilmaz.
--
-- ── Kapsam ──────────────────────────────────────────────────────────────────
-- Sema DEGISMEZ. Yalniz policy DROP+CREATE, bir de paywall_events'e FK ekleme
-- (tablo bos, ADD CONSTRAINT validasyon maliyeti yok).
--
-- Veri tasima gerekmiyor:
--   cinema_dna    1 satir, 0 orphan
--   arcade_runs   0 satir
--   paywall_events 0 satir
--   game_scores   12 satir, 9'u orphan — ama bu 9 satir ne public.users'ta ne
--                 auth.users'ta var (olu satirlar, cevrilebilir degil).
--                 Bilincli olarak dokunulmuyor, bkz. docs/TEKNIK_BORC.md.
--
-- ── Kapsam disi ─────────────────────────────────────────────────────────────
-- trial_claims: A4 listesinde vardi, CIKARILDI. Tabloda user_id kolonu yok
--   (012:69 — PK email), policy'si `email = (SELECT email FROM auth.users ...)`
--   ile dogru calisiyor. Bu hata sinifina girmiyor.
-- user_streaks: policy'si zaten dogru desende (009:95), 0 orphan.
-- lifetime_sales, referral_rewards, referrals, user_collection_progress:
--   FK ve policy dogru.
-- ============================================================================


-- ─── cinema_dna ─────────────────────────────────────────────────────────────
-- 053:42 — FK users(id) ama policy auth.uid() = user_id

DROP POLICY "cinema_dna: owner read" ON cinema_dna;

CREATE POLICY "cinema_dna: owner read" ON cinema_dna
  FOR SELECT USING (user_id = (SELECT public.app_user_id()));


-- ─── game_scores ────────────────────────────────────────────────────────────
-- 016:46/50/54 — uc policy de auth.uid() = user_id

DROP POLICY "Users see own scores" ON game_scores;

CREATE POLICY "Users see own scores" ON game_scores
  FOR SELECT USING (user_id = (SELECT public.app_user_id()));

DROP POLICY "Users insert own scores" ON game_scores;

CREATE POLICY "Users insert own scores" ON game_scores
  FOR INSERT WITH CHECK (user_id = (SELECT public.app_user_id()));

DROP POLICY "Users update own scores" ON game_scores;

CREATE POLICY "Users update own scores" ON game_scores
  FOR UPDATE USING (user_id = (SELECT public.app_user_id()));


-- ─── arcade_runs ────────────────────────────────────────────────────────────
-- 054:28 — FK users(id) ama policy auth.uid() = user_id

DROP POLICY "arcade_runs: owner read" ON arcade_runs;

CREATE POLICY "arcade_runs: owner read" ON arcade_runs
  FOR SELECT USING (user_id = (SELECT public.app_user_id()));


-- ─── paywall_events ─────────────────────────────────────────────────────────
-- 023:8 — user_id UUID NOT NULL ama FK YOK. Tablo bos, FK simdi eklenir.

ALTER TABLE paywall_events
  ADD CONSTRAINT paywall_events_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

DROP POLICY "Users can read own paywall events" ON paywall_events;

CREATE POLICY "Users can read own paywall events" ON paywall_events
  FOR SELECT USING (user_id = (SELECT public.app_user_id()));

DROP POLICY "Users can insert own paywall events" ON paywall_events;

CREATE POLICY "Users can insert own paywall events" ON paywall_events
  FOR INSERT WITH CHECK (user_id = (SELECT public.app_user_id()));


-- ============================================================================
-- DOWN SCRIPT — geri alma (elle calistirilir, migration olarak DEGIL)
-- Eski (bozuk) ifadelere donuldugunu bilerek: bu policy'ler 0 satir dondurur.
--
-- ALTER TABLE paywall_events
--   DROP CONSTRAINT IF EXISTS paywall_events_user_id_fkey;
--
-- DROP POLICY "Users can insert own paywall events" ON paywall_events;
-- CREATE POLICY "Users can insert own paywall events" ON paywall_events
--   FOR INSERT WITH CHECK (auth.uid() = user_id);
--
-- DROP POLICY "Users can read own paywall events" ON paywall_events;
-- CREATE POLICY "Users can read own paywall events" ON paywall_events
--   FOR SELECT USING (auth.uid() = user_id);
--
-- DROP POLICY "arcade_runs: owner read" ON arcade_runs;
-- CREATE POLICY "arcade_runs: owner read" ON arcade_runs
--   FOR SELECT USING (auth.uid() = user_id);
--
-- DROP POLICY "Users update own scores" ON game_scores;
-- CREATE POLICY "Users update own scores" ON game_scores
--   FOR UPDATE USING (auth.uid() = user_id);
--
-- DROP POLICY "Users insert own scores" ON game_scores;
-- CREATE POLICY "Users insert own scores" ON game_scores
--   FOR INSERT WITH CHECK (auth.uid() = user_id);
--
-- DROP POLICY "Users see own scores" ON game_scores;
-- CREATE POLICY "Users see own scores" ON game_scores
--   FOR SELECT USING (auth.uid() = user_id);
--
-- DROP POLICY "cinema_dna: owner read" ON cinema_dna;
-- CREATE POLICY "cinema_dna: owner read" ON cinema_dna
--   FOR SELECT USING (auth.uid() = user_id);
-- ============================================================================
