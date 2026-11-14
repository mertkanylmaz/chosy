-- ============================================================================
-- 145 — Güvenlik P0: RLS'i atlayan görünümler + grant_streak_rewards + referral sertleştirme
--
-- BULGULAR (14 Kas 2026, canlı; inceleme raporu Bölüm 1):
--
-- 1) Dört görünüm `security_invoker` taşımıyor, sahibi `postgres` → alttaki tabloların RLS'ini
--    atlıyor; dördünde de anon + authenticated tam yetkili (ACL `arwdDxtm`).
--      · mood_history            — anon rolüyle 157 satır: sessions.raw_input (ham mood metni) + user_id
--      · user_stats              — anon rolüyle 355 satır: auth_id, display_name, last_mood
--      · v_posterle_daily_stats  — film_title (günün Posterle cevabı olabilir)
--      · public_daily_puzzles    — çözüm yok ama tüm ipuçları + gelecek günlerin bulmacaları
--    Aynı rolde `users` / `sessions` doğrudan okunduğunda 0 satır dönüyor: sızıntı yalnız görünümlerden.
--
-- 2) grant_streak_rewards(uuid, integer): SECURITY DEFINER, EXECUTE PUBLIC + anon + authenticated.
--    Gövde yalnız `p_user_id = auth_user_id()` bakıyor; seriyi DOĞRULAMIYOR, tekrar koruması YOK.
--    Her çağrı `bonus_searches_earned`'ı artırır (streak_days=100 → +20) → sınırsız mood araması.
--
-- 3) activate_referral / grant_bonus_searches: SECURITY DEFINER, `search_path` sabit değil.
--    (EXECUTE zaten yalnız postgres + service_role.)
--
-- ÖN KOŞUL TARAMASI (release/2.2 = a5c73e2, build 916/917):
--   · mood_history: istemci okuyor — services/profileService.ts:31 ← MoodSearchScreen:246
--     (yalnız `mood_gauntlet_enabled` kapalıyken; eski build'ler de). authenticated SELECT KALIR;
--     security_invoker sonrası okuma `sessions: owner read` + `swipes: owner read` +
--     `films: public read` policy'lerinden geçer. İstemci zaten `.eq('user_id', …)` süzüyor.
--   · user_stats, v_posterle_daily_stats: okuyan yok (istemci, Edge Function, script).
--   · public_daily_puzzles: get-daily-challenge service role ile okur (grant'ı değişmez);
--     istemcide tek okuyan PlayNextBridge — yalnız `id, game_id`, `puzzle_date` süzgeciyle.
--     Görünüm BİLİNÇLİ olarak definer kalır: `daily_puzzles`'ta policy yok, invoker yapılsa
--     istemci okuması boş dönerdi. İstemciye yalnız üç kolon bırakılır; `puzzle_data` kapanır.
--   · grant_streak_rewards: tek çağıran services/gamification.ts:156 (eski mood feed'i), boş
--     catch içinde. Bugüne dek hiç ödül vermedi (en yüksek seri 1, bonus satırı yok). K-33: seri yok.
--
-- Son 7 günün API loglarında bu dört görünüme istemci isteği yok (yalnız Edge runtime →
-- public_daily_puzzles). Geri alma: docs/rollback/145_rollback.sql. Kuru koşu: supabase/tests/145_dryrun.sql.
-- ============================================================================

-- ── 1a. mood_history: çağıranın RLS'i uygulansın; anon kapalı ────────────────
ALTER VIEW public.mood_history SET (security_invoker = true);
REVOKE ALL ON public.mood_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.mood_history TO authenticated;

-- ── 1b. user_stats: okuyan yok ───────────────────────────────────────────────
ALTER VIEW public.user_stats SET (security_invoker = true);
REVOKE ALL ON public.user_stats FROM PUBLIC, anon, authenticated;

-- ── 1c. v_posterle_daily_stats: okuyan yok ───────────────────────────────────
ALTER VIEW public.v_posterle_daily_stats SET (security_invoker = true);
REVOKE ALL ON public.v_posterle_daily_stats FROM PUBLIC, anon, authenticated;

-- ── 1d. public_daily_puzzles: definer KALIR; istemciye yalnız üç kolon ───────
REVOKE ALL ON public.public_daily_puzzles FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, game_id, puzzle_date) ON public.public_daily_puzzles TO authenticated;

-- ── 2. grant_streak_rewards: istemciden çağrılamaz ───────────────────────────
REVOKE EXECUTE ON FUNCTION public.grant_streak_rewards(uuid, integer) FROM PUBLIC, anon, authenticated;

-- ── 3. Referral / bonus zinciri: search_path sabit ───────────────────────────
-- İki gövde de nitelenmemiş adlar kullanıyor (referrals, referral_rewards, user_daily_quotas,
-- claim_lifetime_spot) — hepsi `public`'te; `public, pg_temp` ile çözülür (check_and_consume_quota deseni).
ALTER FUNCTION public.activate_referral(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.grant_bonus_searches(uuid, integer, text) SET search_path = public, pg_temp;
