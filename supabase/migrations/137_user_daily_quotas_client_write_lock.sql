-- ============================================================================
-- 137 — user_daily_quotas: istemci yazımı kapanır (MONEY-1C)
--
-- SORUN (migration-guard, 24 Eki 2026; canlıda doğrulandı):
--   021 "Users can insert own quotas" ve "Users can update own quotas"
--   policy'lerini açtı (UPDATE'te WITH CHECK yok, kolon kısıtı yok) ve
--   anon/authenticated tabloda tam INSERT/UPDATE/DELETE GRANT'ı taşıyor.
--   Giriş yapmış herkes PostgREST ile kendi satırına `searches_used = 0` ya da
--   `bonus_searches_earned = 999` yazıp kotayı atlatabiliyordu. 135'in
--   subscription kolonlarında kapattığı açıkla aynı sınıf.
--
-- KANIT (24 Eki 2026, uygulamadan önce):
--   (a) İstemci kodu (app/ services/ hooks/ components/ contexts/ utils/) bu
--       tabloya hiç değmiyor — grep: yalnız supabase/functions/schedule-notifications
--       (service role, SELECT).
--   (b) Tabloya yazan canlı fonksiyonların hepsi SECURITY DEFINER (sahip postgres):
--       check_and_consume_quota, check_and_consume_game_quota, grant_bonus_searches,
--       refund_quota (136), get_quota_status. REVOKE onları etkilemez.
--       SECURITY INVOKER yazıcı yok; tabloya değen view yok; tetikleyici yok.
--   (c) Policy'ler: SELECT (own), INSERT (own), UPDATE (own). DELETE policy'si yok.
--
-- ÇÖZÜM: iki yazma policy'si düşer (+ savunma amaçlı olası DELETE policy'si),
--   anon/authenticated'dan INSERT/UPDATE/DELETE GRANT'ı alınır. SELECT policy'si
--   ve SELECT izni KALIR. service_role ve DEFINER fonksiyonlar etkilenmez.
--
-- NOT (kapsam dışı, dokunulmadı): anon/authenticated'ta TRUNCATE/TRIGGER/REFERENCES
--   GRANT'ı da duruyor (Supabase varsayılanı); PostgREST'ten erişilemez.
--   get_quota_status anon/authenticated/PUBLIC EXECUTE'li bir DEFINER'dır ve
--   bugünün satırını INSERT eder; ama 109'dan gelen kimlik kontrolü
--   (p_user_id IS DISTINCT FROM auth_user_id() -> 42501) yüzünden çağıran yalnız
--   KENDİ satırını, sıfır değerlerle oluşturabilir — kotayı atlatmaya yaramaz.
--   Dry-run T6 bu yolun 137 sonrası çalıştığını doğrular.
--
-- GERİ ALMA: repo dışı kopya (137_rollback.sql) — açığı yeniden açar.
-- UYGULAMA: `supabase db push`.
-- ============================================================================

DROP POLICY IF EXISTS "Users can insert own quotas" ON public.user_daily_quotas;
DROP POLICY IF EXISTS "Users can update own quotas" ON public.user_daily_quotas;
DROP POLICY IF EXISTS "Users can delete own quotas" ON public.user_daily_quotas;

REVOKE INSERT, UPDATE, DELETE ON public.user_daily_quotas FROM anon, authenticated;
