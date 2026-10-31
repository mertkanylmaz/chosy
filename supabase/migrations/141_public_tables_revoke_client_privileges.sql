-- ============================================================================
-- 141 — public tablolarda istemci rollerinin gereksiz yetkilerini kaldır (MONEY-1C)
--
-- (a) TÜM public tablolar: anon + authenticated'tan TRUNCATE, REFERENCES, TRIGGER.
--     TRUNCATE RLS'i atlar; PostgREST üç yetkiyi de sunmaz → istemci etkisi YOK.
-- (b) app_config, subscription_limits, promo_codes, lifetime_sales: anon + authenticated'tan
--     INSERT, UPDATE, DELETE. İstemci bu dört tabloyu yalnız OKUR (app_config SELECT;
--     2.1.0–2.1.3 tag'lerinde başka erişim yok, 25 Eki taraması). Yazan SECURITY DEFINER
--     fonksiyonlar (claim_lifetime_spot, increment_promo_usage; sahip postgres) ve service_role
--     bu migration'dan ETKİLENMEZ.
--
-- DOKUNULMAYAN: SELECT yetkileri (okuma RLS ile), diğer tabloların INSERT/UPDATE/DELETE yetkileri
-- (anon yazma yetkileri ayrı iş — docs/TEKNIK_BORC.md), service_role, postgres, görünümler (view).
-- Kaynak/gerekçe: docs/investigations/MONEY-1C_GRANTS_AUDIT.md. 140 (mood_searches) ile örtüşme
-- zararsız: REVOKE idempotent.
-- GERİ ALMA: repo dışı kopya (141_rollback.sql) — dört+üç yetkiyi geri verir; veri etkisi yok.
-- ============================================================================

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relkind IN ('r', 'p')
    ORDER BY c.relname
  LOOP
    EXECUTE format('REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM anon, authenticated', r.relname);
  END LOOP;
END
$$;

REVOKE INSERT, UPDATE, DELETE ON public.app_config FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.subscription_limits FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.promo_codes FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.lifetime_sales FROM anon, authenticated;
