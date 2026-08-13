-- ============================================================
-- 080 — profile-missing-films cron kaydi (GATE 3)
--
-- Vektorsuz kalan filmleri haftalik olarak profilleyen Edge Function'i
-- zamanlar. 077'nin deseni birebir izlenir: sabit tam URL + Vault'tan
-- okunan service key + `cron.schedule` upsert.
-- ============================================================
--
-- ── Neden bu cron var ───────────────────────────────────────────────────────
-- `sync-trending` her kosumda yeni filmler icin PLACEHOLDER film_profiles
-- satiri aciyor (profile_vector NULL) ve dolduran otomasyon YOKTU. Vektorsuz
-- film `match_films_v*` icin gorunmez, yani gauntlet havuzuna hic girmiyor.
--
-- 13 Agu 2026 olcumu: core+extended+trending 1867 filmin 10'u vektorsuz ve
-- 10'unun tamami `sync-trending`in 9 Agu kosumunda actigi satirlar. Yani
-- kayip teorik degil, olculmus.
--
-- ── ⚠️ weekly-trending-sync ILE BAGIMLILIK YOK ──────────────────────────────
-- Bu cron `weekly-trending-sync`ten TAMAMEN BAGIMSIZ calisir ve onun
-- acilmasini BEKLEMEZ. Zaten birikmis 10 filmi ilk kosumda isler.
--
-- 08:00 saatinin tek gerekcesi ZAMANLAMA CAKISMASINI onlemek: sync 06:00'da
-- kosuyor ve yeni filmler ekliyor; 2 saatlik ara, sync'in yazimi bitmeden
-- profilleyicinin ayni satirlari okumasini engeller. Bu bir sira tercihi,
-- bagimlilik degil. `weekly-trending-sync` hic acilmasa bile bu cron dogru
-- calisir ve dogru sonucu uretir.
--
-- Bu migration `weekly-trending-sync`e HICBIR BICIMDE DOKUNMAZ — o hala
-- active=false ve oyle kalir (079 sonrasi GATE 3 disi bir karar).
--
-- ── Neden active=true ile yaratiliyor ───────────────────────────────────────
-- 077'de dort job `active=false` ile kapatilmisti cunku emekli urun metnini
-- 63 gercek kullaniciya gonderiyorlardi. Bu fonksiyonun kullaniciya bakan
-- hicbir yuzeyi yok: yalnizca eksik `profile_vector` alanlarini doldurur,
-- veri silmez, tier degistirmez, bildirim gondermez. Kapali birakmak
-- olculmus bir kaybi bilerek surdurmek olurdu.
--
-- Maliyet tavani fonksiyonun kendisinde: kosum basina en fazla 50 film
-- (~$0.10). Bugunku hacim 10 film ~ $0.02.
--
-- ── Dogrulama (bu dosya degil, kurucu calistirir) ───────────────────────────
--   SELECT * FROM cron_job_status() WHERE jobname = 'profile-missing-films';
--     -> 0 8 * * 1, active = true
--   SELECT count(*) FROM cron.job WHERE jobname = 'weekly-trending-sync'
--     AND active = false;   -> 1  (dokunulmadigi teyidi)
-- ============================================================

-- Uzantilar (idempotent — 077'de de kurulu)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ----------------------------------------------------------------------------
-- ON KOSUL GUARD — Vault sirri (077 ile ayni gerekce ve ayni kontrol)
--
-- Sir yoksa/bossa/yanlis kusaksa cron `Bearer ` gonderir ve fonksiyonun
-- `requireServiceRole()` kapisindan 401 alir: sessizce olu bir cron daha.
-- LIKE icindeki `\_` kacislari zorunlu — kacissiz `_` tek karakter joker olur.
-- ----------------------------------------------------------------------------
DO $guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'cron_service_role_key'
      AND coalesce(decrypted_secret, '') <> ''
      AND length(decrypted_secret) >= 40
      AND decrypted_secret LIKE 'sb\_secret\_%'
  ) THEN
    RAISE EXCEPTION
      'Vault sirri eksik, bos veya yanlis kusak: cron_service_role_key. '
      'Beklenen: "sb_secret_" ile baslayan yeni kusak service key. '
      '077 ile ayni on kosul — detay: 077_cron_pattern_repair.sql';
  END IF;
END;
$guard$;

-- ----------------------------------------------------------------------------
-- profile-missing-films — Pazartesi 08:00 UTC
--
-- `cron.schedule` ayni jobname ile cagrildiginda mevcut kaydi GUNCELLER
-- (pg_cron 1.6.4). unschedule+schedule jobid'yi ve job_run_details gecmisini
-- koparirdi; 077'deki gerekce burada da gecerli.
-- ----------------------------------------------------------------------------
SELECT cron.schedule(
  'profile-missing-films',
  '0 8 * * 1',
  $CRON$
  SELECT net.http_post(
    url := 'https://xpcwihldlnlmyopjubdc.supabase.co/functions/v1/profile-missing-films',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'cron_service_role_key'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $CRON$
);

-- Yeni job varsayilan olarak active=true dogar; yine de ACIKCA teyit edilir
-- ki bir gun varsayilan degisirse bu migration sessizce kapali bir cron
-- birakmasin.
DO $activate$
DECLARE
  target_jobid bigint;
  is_active boolean;
BEGIN
  SELECT jobid, active INTO target_jobid, is_active
  FROM cron.job WHERE jobname = 'profile-missing-films';

  IF target_jobid IS NULL THEN
    RAISE EXCEPTION 'ABORT: profile-missing-films job bulunamadi — schedule adimi basarisiz.';
  END IF;

  IF NOT is_active THEN
    PERFORM cron.alter_job(target_jobid, active := true);
    RAISE NOTICE '080: profile-missing-films active=true yapildi.';
  ELSE
    RAISE NOTICE '080: profile-missing-films zaten active=true.';
  END IF;
END;
$activate$;

-- ----------------------------------------------------------------------------
-- KAPSAM DISI TEYIDI — weekly-trending-sync'e dokunulmadi
--
-- Bu blok hicbir sey DEGISTIRMEZ; yalnizca 080'in o job'a dokunmadigini
-- kayda gecirir. Durum beklenmedik sekilde degismisse insan baksin diye
-- NOTICE birakir (EXCEPTION DEGIL: o job'in durumu bu migration'in sorumlulugu
-- degil, yalnizca gozlemi).
-- ----------------------------------------------------------------------------
DO $observe$
DECLARE
  sync_active boolean;
BEGIN
  SELECT active INTO sync_active FROM cron.job WHERE jobname = 'weekly-trending-sync';

  IF sync_active IS NULL THEN
    RAISE NOTICE '080: weekly-trending-sync job kaydi yok (beklenmedik, 077 onu yaratmisti).';
  ELSIF sync_active THEN
    RAISE NOTICE '080: weekly-trending-sync active=TRUE — 080 onu acmadi, baskasi acmis.';
  ELSE
    RAISE NOTICE '080: weekly-trending-sync active=false (degismedi, beklenen durum).';
  END IF;
END;
$observe$;


-- ============================================================
-- DOWN SCRIPT — geri alma (ELLE calistirilir, migration olarak DEGIL)
-- ============================================================
--   SELECT cron.unschedule('profile-missing-films');
--
-- Ya da yalnizca duraklatmak icin (jobid ve gecmis korunur — tercih edilen):
--   SELECT cron.alter_job(jobid, active := false)
--     FROM cron.job WHERE jobname = 'profile-missing-films';
--
-- Geri almanin bedeli: vektorsuz filmler yeniden birikmeye baslar ve
-- gauntlet havuzuna giremezler. Edge Function'in kendisi bu geri almanin
-- disindadir (deploy edilmis kalir, elle cagrilabilir).
-- ============================================================


-- ============================================================
-- 080 SONRASI BEKLENEN DURUM (kayit)
-- ============================================================
-- cron.job: 8 kayit (077'deki 7 + profile-missing-films)
--   profile-missing-films  0 8 * * 1  active=true    <- YENI
--   weekly-trending-sync   0 6 * * 1  active=false   <- DEGISMEDI
--
-- Ilk kosumda islenecek: 10 film (~$0.02), hepsi trending tier'inda.
-- Sonrasinda gauntlet havuzu 1857 -> 1867 olmali.
--
-- ACIK KALEMLER (080 kapsaminda DEGIL):
--   * weekly-trending-sync hala kapali            -> ayri karar
--   * MAX_FILMS_PER_RUN sabit kodlu (50)          -> app_config'e tasima borcu
--   * dbRowToRawFilm iki kopya (CLI + Edge)       -> ortak module tasima borcu
-- ============================================================
