-- ============================================================
-- 081 — weekly-trending-sync aktivasyonu
--
-- Bu migration SEMA DEGISTIRMEZ, tek bir cron job'in active bayragini
-- gunceller. Migration olarak kaydedilme sebebi: acma karari denetlenebilir
-- olmali — hangi tarihte, hangi kosullar saglandiginda acildigi migration
-- gecmisinde dursun.
--
-- ── Acma kosullari (ucu de saglandi) ────────────────────────────────────
--   1. Kod onarimi        C.0d-2, commit 80857fc, deploy v15 (13 Agu)
--      Tier mandali (pre_trending_tier) + trending_added_at koruma +
--      hata alan filmin arsivlenmemesi duzeltildi.
--   2. Gecmis hasar restorasyonu   079, commit 8fd5f82 (13 Agu)
--      3 kurban film + 44 filmlik pre_trending_tier backfill.
--   3. Otomatik vektor beslemesi   080/GATE 3, commit f1e0163 (13 Agu)
--      profile-missing-films cron'u 0 8 * * 1'de calisiyor (weekly-
--      trending-sync'ten 2 saat sonra), aktif ve dogrulandi.
--
-- ── URL teyidi (13 Agu 2026, Dashboard SQL Editor) ──────────────────────
-- cron.job.command icindeki url degeri:
--   https://xpcwihldlnlmyopjubdc.supabase.co/functions/v1/sync-trending
-- Slug bicimi FONKSIYON VERSIYONU TASIMAZ; her cagri o slug'in guncel
-- ACTIVE deploy'una gider (bugun v15). Uc bilinen sapma sinifi da
-- ELENDI: /functions/v1/ segmenti eksik degil, current_setting(...)
-- kalintisi yok, fonksiyon adi dogru.
--
-- Not: teyit ciktisindaki 'Authorization: [REDACTED]' gorunumu, teyit
-- sorgusunun kendi regexp_replace maskelemesinin eseridir. Canlidaki
-- command metninde boyle bir bozukluk YOKTUR.
--
-- ── Desen secimi ────────────────────────────────────────────────────────
-- Ham `UPDATE cron.job` degil, `cron.alter_job(jobid, active := true)`:
-- 077 ve 080 bu deseni kullaniyor, repoda ham UPDATE ornegi yok.
-- ============================================================

DO $activate$
DECLARE
  target_jobid bigint;
  is_active    boolean;
BEGIN
  SELECT jobid, active INTO target_jobid, is_active
  FROM cron.job
  WHERE jobid = 6 AND jobname = 'weekly-trending-sync';

  IF target_jobid IS NULL THEN
    RAISE EXCEPTION
      'ABORT: jobid=6 / jobname=weekly-trending-sync eslesmesi bulunamadi. '
      'Job silinmis ya da jobid/jobname degismis olabilir — elle bak.';
  END IF;

  IF is_active THEN
    RAISE EXCEPTION
      'ABORT: weekly-trending-sync zaten active=true. 081 bunu beklemiyordu; '
      'baskasi acmis olabilir — durum incelenmeden migration ilerlemez.';
  END IF;

  PERFORM cron.alter_job(target_jobid, active := true);
  RAISE NOTICE '081: weekly-trending-sync aktiflestirildi (jobid=6).';
END;
$activate$;

-- ============================================================
-- DOWN — geri alma (ELLE calistirilir, migration olarak DEGIL)
-- ============================================================
-- SELECT cron.alter_job(jobid, active := false)
--   FROM cron.job WHERE jobname = 'weekly-trending-sync';
-- ============================================================

-- ============================================================
-- 081 SONRASI BEKLENEN DURUM (kayit)
-- ============================================================
-- weekly-trending-sync: active = true, ilk otomatik kosum
--   ilk gelecek Pazartesi 06:00 UTC
-- profile-missing-films: active = true (degismedi), 08:00 UTC
--   -> sync'ten 2 saat sonra, yeni eklenen filmleri profiller
--
-- IZLENECEK — ilk otomatik kosum sonrasi:
--   * films.curation_tier dagilimi beklenmedik sekilde kaymadi mi
--   * pre_trending_tier dogru calisti mi (yeni trending filmler icin)
--   * profile-missing-films 08:00'de calisip yeni filmleri yakaladi mi
-- ============================================================
