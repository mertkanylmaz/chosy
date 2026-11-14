-- ============================================================
-- 145 geri alma (güvenlik P0) — yalnız elle, gerekirse çalıştırılır.
-- Önceki durum 14 Kas 2026'da canlıdan ölçüldü (pg_class.relacl / reloptions, pg_proc.proacl / proconfig):
--   · dört görünüm: reloptions NULL; ACL anon + authenticated + service_role = arwdDxtm
--   · grant_streak_rewards(uuid,integer): ACL `=X` (PUBLIC) + anon + authenticated + service_role
--   · activate_referral / grant_bonus_searches: proconfig NULL
--
-- UYARI: Tam geri alma, anon'un ham mood metnini ve auth_id'leri okuyabildiği açığı ve
-- sınırsız bonus arama açığını YENİDEN AÇAR. Bir akış kırıldıysa önce aşağıdaki
-- "kısmi" bloklardan yalnız ilgilisini çalıştırın.
-- ============================================================

-- ── Kısmi A: yalnız mood_history okuması bozulduysa (eski MoodSearchScreen "son aramalar") ──
-- BEGIN;
-- ALTER VIEW public.mood_history RESET (security_invoker);
-- GRANT SELECT ON public.mood_history TO authenticated;   -- anon KAPALI kalır
-- COMMIT;

-- ── Kısmi B: yalnız PlayNextBridge / public_daily_puzzles okuması bozulduysa ──
-- BEGIN;
-- GRANT SELECT ON public.public_daily_puzzles TO authenticated;   -- anon KAPALI kalır
-- COMMIT;

-- ── Tam geri alma ───────────────────────────────────────────────────────────
BEGIN;

ALTER VIEW public.mood_history RESET (security_invoker);
GRANT ALL ON public.mood_history TO anon, authenticated;

ALTER VIEW public.user_stats RESET (security_invoker);
GRANT ALL ON public.user_stats TO anon, authenticated;

ALTER VIEW public.v_posterle_daily_stats RESET (security_invoker);
GRANT ALL ON public.v_posterle_daily_stats TO anon, authenticated;

REVOKE SELECT (id, game_id, puzzle_date) ON public.public_daily_puzzles FROM authenticated;
GRANT ALL ON public.public_daily_puzzles TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.grant_streak_rewards(uuid, integer) TO PUBLIC, anon, authenticated;

ALTER FUNCTION public.activate_referral(uuid) RESET search_path;
ALTER FUNCTION public.grant_bonus_searches(uuid, integer, text) RESET search_path;

COMMIT;
