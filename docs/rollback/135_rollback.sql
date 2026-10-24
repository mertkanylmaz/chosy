-- ============================================================
-- MONEY-SEC-1 geri alma (135) — yalnız elle, gerekirse çalıştırılır.
-- Durum: policy'ler ve GRANT'lar 24 Eki 2026'da canlıdan ölçüldü (pg_policies,
-- role_table_grants): subscriptions INSERT/UPDATE policy'si `user_id = auth_user_id()`
-- (UPDATE'te WITH CHECK yok, roller {public}); anon + authenticated tam INSERT/UPDATE/DELETE.
--
-- UYARI: Geri alma "kendini Pro yapma" açığını yeniden açar.
-- ============================================================

BEGIN;

DROP TRIGGER IF EXISTS trg_guard_users_subscription_columns ON public.users;
DROP FUNCTION IF EXISTS public.guard_users_subscription_columns();

CREATE POLICY "Users can insert own subscriptions" ON public.subscriptions
  FOR INSERT
  WITH CHECK (user_id = auth_user_id());

CREATE POLICY "Users can update own subscriptions" ON public.subscriptions
  FOR UPDATE
  USING (user_id = auth_user_id());

GRANT INSERT, UPDATE, DELETE ON public.subscriptions TO anon, authenticated;

COMMIT;
