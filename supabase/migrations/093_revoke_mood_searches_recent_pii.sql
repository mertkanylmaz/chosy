-- ============================================================================
-- Migration 093: v_mood_searches_recent — PII sizintisi kapatiliyor (P0)
--
-- ⚠️ ACİL GÜVENLİK YAMASI — 18 Ağustos 2026
--
-- 032_mood_searches_enrichment.sql'de yaratilan v_mood_searches_recent
-- view'i satir-duzeyinde HICBIR sahiplik filtresi tasimiyordu (yalniz 7
-- gunluk zaman penceresi vardi). Canli GRANT durumu dogrulandi
-- (information_schema.role_table_grants, 18 Agu 2026):
--   anon           → SELECT (+ INSERT/UPDATE/DELETE/TRUNCATE/...)
--   authenticated  → SELECT (+ INSERT/UPDATE/DELETE/TRUNCATE/...)
-- Migration dosyasinin kendisi yalniz `GRANT SELECT ... TO authenticated,
-- service_role` yaziyordu — `anon` orada hic yoktu. Yani canli durum
-- migration dosyasindan DAHA GENIS: proje-bootstrap seviyesinde bir
-- default privilege kurali (migration gecmisinde tanimli degil, Supabase
-- proje olusturma sablonuna ait) yeni public sema nesnelerine otomatik
-- anon+authenticated GRANT'i veriyor ve migration'in kendi GRANT'inin
-- USTUNE binmis.
--
-- Sonuc: kimlik dogrulama GEREKMEDEN (anon key ile bile) herhangi biri
-- TUM kullanicilarin mood_text + user_id + parsed_profile verisini
-- PostgREST uzerinden (`/rest/v1/v_mood_searches_recent`) okuyabiliyordu.
-- Cross-tenant PII sizintisi — proje kodunda bu view'a giden bir cagri
-- olmamasi ONEMSIZ, PostgREST GRANT'i olan her nesneyi otomatik expose
-- eder.
--
-- Bu migration yalnizca erisimi kapatir. View TANIMI degismiyor (D-04
-- desenindeki gibi security_invoker=true KULLANILMIYOR — service_role
-- disi bir rolun RLS filtresine takilip sessizce eksik veri gormesi
-- riski, kural 1 ihlali olurdu). Erisim REVOKE + yalniz service_role'e
-- GRANT ile kapatiliyor — 092'deki v_algorithm_daily ile ayni desen.
-- ============================================================================

REVOKE ALL ON public.v_mood_searches_recent FROM PUBLIC;
REVOKE ALL ON public.v_mood_searches_recent FROM anon, authenticated;
GRANT SELECT ON public.v_mood_searches_recent TO service_role;

COMMENT ON VIEW public.v_mood_searches_recent IS
  'Production debugging (son 7 gun) — satir duzeyinde sahiplik filtresi '
  'YOK, bu yuzden yalniz service_role okur. anon/authenticated erisimi '
  '18 Agu 2026''da PII sizintisi olarak tespit edilip kapatildi (093).';

-- ============================================================================
-- DOWN
-- ⚠️ `TO authenticated` ASLA GERİ VERİLMEZ — bu grant açığın kendisiydi
-- (satır-düzeyi filtresiz view, tüm kullanıcıların PII'sine erişim).
-- Geri dönüş yalnızca service_role'e daraltılmış haliyle mümkündür:
-- GRANT SELECT ON public.v_mood_searches_recent TO service_role;
-- ============================================================================
