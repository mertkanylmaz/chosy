-- ============================================================================
-- Migration 095: detective_daily_scores — erisim daraltildi (P1)
--
-- 059_detective_game.sql'de yaratilan view kullanici bazli oyun verisini
-- (user_id, detective_score, solved, completed_at, xp_awarded,
-- progress_json) filtresiz sunuyordu. PII kadar kritik degil (mood_text
-- gibi serbest metin yok) ama yine de kullaniciyla eslesen davranissal
-- veri — P1.
--
-- ⚠️ İlk taslak detective_percentile()'i SECURITY DEFINER'a ceviriyordu —
-- migration-guard denetimi bunun GEREKSIZ oldugunu kanitladi:
-- supabase/functions/get-daily-challenge/index.ts:254 fonksiyonu YALNIZ
-- service_role client'i (getServiceClient()) ile cagiriyor, anon/
-- authenticated hicbir yerden bu RPC'yi cagirmiyor (tum repo grep'lendi).
-- service_role zaten asagidaki GRANT SELECT'i koruyor, yani fonksiyon
-- INVOKER (varsayilan, 059'daki orijinal hali) kalabilir — DEFINER'a
-- cevirmek 069'daki emsale (app_user_id() icin bilincli INVOKER tercihi,
-- "DEFINER gereksiz yetki yuzeyi acar") aykiri, gereksiz bir yetki
-- yuzeyi acardi. Fonksiyona DOKUNULMUYOR.
--
-- Auto-updatable riski KONTROL EDILDI: view iki tabloyu JOIN ediyor
-- (game_scores JOIN daily_puzzles), is_insertable_into = 'NO',
-- is_trigger_updatable = 'NO', is_trigger_deletable = 'NO'.
-- ============================================================================

REVOKE ALL ON public.detective_daily_scores FROM PUBLIC;
REVOKE ALL ON public.detective_daily_scores FROM anon, authenticated;
GRANT SELECT ON public.detective_daily_scores TO service_role;

COMMENT ON VIEW public.detective_daily_scores IS
  'Gunluk detective skor siralamasi (percentile hesabi icin) — satir '
  'duzeyinde sahiplik filtresi yok. Yalniz service_role okur — tek '
  'cagiran get-daily-challenge Edge Function''i, service_role client''i '
  'ile detective_percentile() RPC''sini cagirir. anon/authenticated '
  'erisimi 18 Agu 2026''da kapatildi (095).';

-- ============================================================================
-- DOWN
-- ⚠️ `TO authenticated` ASLA GERİ VERİLMEZ.
-- GRANT SELECT ON public.detective_daily_scores TO service_role;
-- ============================================================================
