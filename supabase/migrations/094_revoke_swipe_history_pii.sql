-- ============================================================================
-- Migration 094: user_swipe_history — PII sizintisi kapatiliyor (P0)
--
-- 010_watch_history.sql'de yaratilan view TUM kullanicilarin swipe
-- gecmisini filtresiz sunuyordu: user_id, film_id, direction, timestamp,
-- session_id, mood_text (raw_input). 093'teki v_mood_searches_recent'ten
-- DAHA KOTU — orada en azindan 7 gunluk bir zaman penceresi vardi, burada
-- hic yok (tum tarihce).
--
-- Canli information_schema.role_table_grants ile dogrulandi (18 Agu 2026):
-- anon + authenticated SELECT (+ yazma yetkileri) sahipti. Migration
-- dosyasinda bu view icin hic acik GRANT yazilmamisti — 093'te tespit
-- edilen proje-bootstrap default privilege kurali burada da gecerli.
--
-- Auto-updatable riski KONTROL EDILDI: view iki tabloyu JOIN ediyor
-- (swipes JOIN sessions), information_schema.views.is_insertable_into =
-- 'NO', is_trigger_updatable = 'NO', is_trigger_deletable = 'NO'. 093'teki
-- tek-tablo auto-updatable riski BURADA YOK — yalniz okuma sizintisiydi.
-- ============================================================================

REVOKE ALL ON public.user_swipe_history FROM PUBLIC;
REVOKE ALL ON public.user_swipe_history FROM anon, authenticated;
GRANT SELECT ON public.user_swipe_history TO service_role;

COMMENT ON VIEW public.user_swipe_history IS
  'Swipe gecmisi + mood_text — satir duzeyinde sahiplik filtresi YOK, '
  'zaman penceresi de YOK (tum tarihce). Yalniz service_role okur. '
  'anon/authenticated erisimi 18 Agu 2026''da PII sizintisi olarak '
  'tespit edilip kapatildi (094).';

-- ============================================================================
-- DOWN
-- ⚠️ `TO authenticated` ASLA GERİ VERİLMEZ — bu grant açığın kendisiydi.
-- GRANT SELECT ON public.user_swipe_history TO service_role;
-- ============================================================================
