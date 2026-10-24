-- ============================================================
-- 135_subscription_write_guard.sql  (MONEY-SEC-1)
--
-- Sorun: anon/authenticated kendi `users.subscription_tier` ve `subscriptions`
-- satırına doğrudan yazabiliyordu (policy + tam GRANT). Kota RPC'leri ve
-- submit-choice bu kolonu okuduğundan bu "kendini Pro yapma" açığıdır.
--
-- Çözüm:
--  1) subscriptions: istemci INSERT/UPDATE policy'leri düşer, yazma GRANT'ları
--     geri alınır. SELECT policy'si kalır. Yazan: webhook / sync-entitlement
--     (service role) ve claim_lifetime_spot (SECURITY DEFINER).
--  2) users: abonelik kolonlarını yalnız service_role / SECURITY DEFINER
--     (sahip: postgres) değiştirebilir. Tablo-düzeyi GRANT varken kolon REVOKE
--     işlemediğinden BEFORE tetikleyici kullanılır.
--
-- Engelleme koşulu `current_user IN ('authenticated','anon')`: PostgREST isteği
-- bu rollerle çalışır; SECURITY DEFINER fonksiyon sahibinin (postgres) rolüyle,
-- service_role kendi rolüyle çalışır → ikisi geçer. auth.role() / JWT claim
-- KULLANILMAZ (SECURITY DEFINER RPC'ler JWT claim'ini taşır, bloklanırdı).
--
-- SIRA: revenuecat-webhook (upsert, commit 36a4987) ve sync-entitlement deploy
-- EDİLDİKTEN SONRA uygulanır; aksi halde yeni alıcının subscriptions satırını
-- kimse yaratamaz.
-- Geri alma: docs/rollback/135_rollback.sql
-- ============================================================

-- 1) subscriptions: istemci yazımı kapanır (SELECT policy'si kalır)
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.subscriptions;
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM anon, authenticated;

-- 2) users: korunan kolonlar açıkça listelenir
--    subscription_tier, subscription_active_until, subscription_will_renew
--    INSERT varsayılanları (canlıda ölçüldü): tier 'free', active_until NULL, will_renew true.
CREATE OR REPLACE FUNCTION public.guard_users_subscription_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.subscription_tier IS DISTINCT FROM 'free'
         OR NEW.subscription_active_until IS NOT NULL
         OR NEW.subscription_will_renew IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'subscription columns are server-managed' USING ERRCODE = '42501';
      END IF;
    ELSIF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier
       OR NEW.subscription_active_until IS DISTINCT FROM OLD.subscription_active_until
       OR NEW.subscription_will_renew IS DISTINCT FROM OLD.subscription_will_renew THEN
      RAISE EXCEPTION 'subscription columns are server-managed' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_guard_users_subscription_columns ON public.users;
CREATE TRIGGER trg_guard_users_subscription_columns
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_users_subscription_columns();
