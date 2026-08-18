-- ============================================================================
-- Migration 096: public semada varsayilan anon/authenticated erisimi kapatiliyor
-- (kok neden — CTO onayi 18 Agu 2026)
--
-- 093/094/095 uc ayri view'da ayni deseni buldu: migration gecmisinde hic
-- `ALTER DEFAULT PRIVILEGES` yoktu, bu yuzden Supabase'in proje-bootstrap
-- kurali gecerli oluyordu — public semada yaratilan HER YENI nesne
-- (view/tablo) dogustan anon+authenticated'a acik geliyordu. Uc kez elle
-- yakalayip kapattik; kok neden duzelmeden M2/M3/C.9b'nin uretecegi her
-- yeni sema nesnesi ayni riskle gelecek.
--
-- Kural 1'in ("sessiz fallback yasak") veri erisimi tarafi: sessiz
-- ACIKLIK da yasaklanmali. Bu migration'dan sonra yeni bir view/tablo
-- KAPALI DOGAR — erisim isteniyorsa GRANT acikca yazilmali.
--
-- ⚠️ BILINEN KAPSAM DISI RISK — migration-guard denetiminde canli
-- `pg_default_acl` sorgusuyla iki AYRI grantor bulundu: `postgres` VE
-- `supabase_admin`. Bu migration yalniz `postgres` grantor'lu kaydi
-- kapatir. `supabase_admin` icin ayni islemi yapmak DENENDI ve
-- YAPILAMADI: `postgres` rolu superuser degil ve `supabase_admin`'e
-- member degil (pg_has_role('postgres','supabase_admin','MEMBER') =
-- false, dogrulandi 18 Agu 2026) — `ALTER DEFAULT PRIVILEGES FOR ROLE
-- supabase_admin` yetki hatasiyla basarisiz olur. `supabase_admin`
-- grantor'lu nesneler (Supabase'in platform-ici otomasyonlarina ait,
-- bu migration gecmisinde hicbir dosyada YARATILMADI) hala dogustan
-- acik gelmeye devam edecek. Bu boşluğu kapatmak Supabase support/
-- dashboard yetkisi gerektirebilir — CTO'ya ayri bir DUR NOKTASI
-- olarak bildirilecek, bu migration'in kapsami DEGIL.
--
-- ⚠️ SADECE ILERIYE DONUK. Var olan nesneleri (v_posterle_daily_stats,
-- public_daily_puzzles dahil — bilincli acik, dokunulmuyor) ETKILEMEZ —
-- yalniz bu komuttan SONRA ilgili rol tarafindan yaratilacak nesnelere
-- uygulanir. Deploy sonrasi gecici bir test view'i ile (migration
-- disinda, ayri bir doğrulama adiminda) kanitlanacak.
--
-- View'lar Postgres'te ayri bir default privilege sinifi degildir —
-- `ALTER DEFAULT PRIVILEGES ... ON TABLES` view'lari, materialized
-- view'lari ve foreign table'lari da kapsar. Ayri bir ON VIEWS
-- sozdizimi yoktur.
-- ============================================================================

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;

COMMENT ON SCHEMA public IS
  'Yeni tablo/view''lar `postgres` rolu tarafindan yaratildiginda '
  'varsayilan olarak anon/authenticated''a KAPALI dogar (096, 18 Agu '
  '2026 — 093/094/095 sizinti bulgularinin kok neden duzeltmesi, yalniz '
  'postgres grantor''u icin — supabase_admin grantor''u ayri, cozulememis '
  'bir kapsam disi risk, bkz. yukaridaki not). Erisim isteniyorsa '
  'migration''da acikca GRANT yazilmali.';

-- ============================================================================
-- DOWN
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
--   GRANT ALL ON TABLES TO anon, authenticated;
-- (Bu, 093/094/095'in kapattigi acigi proje genelinde YENIDEN ACAR —
--  yalniz bilinen bir Supabase platform davranisina donmek icin, acik
--  bir gerekce olmadan calistirilmamali.)
-- ============================================================================
