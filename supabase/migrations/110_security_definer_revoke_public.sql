-- ============================================================================
-- 110 — 109'daki REVOKE'u tamamlar: PUBLIC grant'i de kaldırılır
--
-- SORUN:
--   109, service-role-only 6 fonksiyondan `REVOKE EXECUTE ... FROM anon,
--   authenticated` yaptı. Push sonrası doğrulamada anon ve authenticated'ın
--   EXECUTE yetkisinin HÂLÂ true olduğu görüldü.
--
-- SEBEP:
--   Postgres `CREATE FUNCTION`'da EXECUTE'u varsayılan olarak PUBLIC'e verir.
--   ACL'deki başlıksız `=X/postgres` girdisi budur. anon ve authenticated
--   PUBLIC'in üyesi olduğu için, kendilerine ait açık grant kaldırılsa bile
--   PUBLIC üzerinden EXECUTE etmeye devam ederler.
--
--   109 sonrası ACL (check_and_consume_quota):
--     =X/postgres | postgres=X/postgres | service_role=X/postgres
--      ^^^^^^^^^^ PUBLIC — açık kalan delik burasıydı
--
--   Karşılaştırma için guard alan get_user_stats'ın ACL'i, açık grant'lerin
--   gerçekten kaldırıldığını doğruluyor:
--     =X/postgres | postgres=X/postgres | anon=X/postgres |
--     authenticated=X/postgres | service_role=X/postgres
--
-- service_role ve postgres'in AYRI açık grant'leri var, dolayısıyla PUBLIC'ten
-- REVOKE Edge Function çağrılarını etkilemez.
--
-- Guard alan fonksiyonlara DOKUNULMAZ: onların anon/authenticated EXECUTE
-- yetkisi olmak zorunda (istemci çağırıyor), koruma guard'dan geliyor.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.check_and_consume_quota(uuid, text)
  FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.check_and_consume_game_quota(uuid, text)
  FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.grant_bonus_searches(uuid, integer, text)
  FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.user_notification_count_24h(uuid)
  FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.update_posterle_streak(uuid, boolean, date, text)
  FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.activate_referral(uuid)
  FROM PUBLIC;
