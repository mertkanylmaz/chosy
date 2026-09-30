-- ============================================================
-- 120 — Spotlight bulmaca üretimi haftalık cron (generate-puzzles)
--
-- 080'in deseni birebir: sabit tam URL + Vault'tan okunan service key +
-- `cron.schedule` upsert + açık active teyidi.
--
-- ── Neden ────────────────────────────────────────────────────────────────
-- Spotlight 11 Ağu – 30 Eyl 2026 arası bulmacasızdı: generate-puzzles'ın
-- cron'u hiç yoktu (README "elle tetiklenir"), son elle koşum 29 Tem.
-- Şampiyon ekranındaki bonus kartı 50 gün boyunca NO_PUZZLE (404) açtı.
-- Kurucu onayı: 30 Eyl 2026 (AskUserQuestion — "anahtarı canlandır +
-- haftalık cron").
--
-- ── Kapsam: YALNIZ Spotlight (?game=spotlight) ───────────────────────────
-- Aktif tek bonus oyun Spotlight; diğer altısı app_config ile donuk ve
-- Logline üretimi ücretli Claude çağırır. `?game=` tek oyunla çalıştığında
-- günlük tema adımı atlanır (bkz. generate-puzzles). Spotlight üretimi
-- Claude ÇAĞIRMAZ — koşum maliyeti yok.
--
-- ── Zamanlama ────────────────────────────────────────────────────────────
-- Pazartesi 02:00 UTC. LOOKAHEAD 14 gün: haftalık koşum her zaman 7–14
-- günlük tampon bırakır; bir koşum kaçsa bile bulmaca bitmeden bir hafta
-- daha vardır. 06:00/08:00 (trending, profile-missing-films) ile çakışmaz.
--
-- ── Timeout ──────────────────────────────────────────────────────────────
-- 30 Eyl elle koşumu 77,5 sn sürdü (14 bulmaca + acil havuz). 080'in 30 sn
-- değeri burada isteği keserdi; 150 sn (Edge Function duvar süresi) verildi.
--
-- ── ÖN KOŞUL ─────────────────────────────────────────────────────────────
-- Vault `cron_service_role_key` 31 Ağu 2026'dan beri GEÇERSİZ (gateway 401
-- "Unregistered API key", bkz. docs/investigations/CRON_ANAHTAR_KESIF.md).
-- Bu migration'dan ÖNCE kurucu Dashboard SQL'de sırrı `.env`
-- SUPABASE_SECRET_KEY değeriyle günceller. Aşağıdaki guard yalnız biçimi
-- denetleyebilir (geçerliliği değil) — doğrulama ilk koşumdan sonra
-- net._http_response'tan okunur; job_run_details.succeeded kanıt DEĞİLDİR.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── Ön koşul guard (077/080 ile aynı kontrol) ─────────────────────────────
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
      'Detay: 077_cron_pattern_repair.sql';
  END IF;
END;
$guard$;

-- ── generate-puzzles-spotlight — Pazartesi 02:00 UTC ──────────────────────
SELECT cron.schedule(
  'generate-puzzles-spotlight',
  '0 2 * * 1',
  $CRON$
  SELECT net.http_post(
    url := 'https://xpcwihldlnlmyopjubdc.supabase.co/functions/v1/generate-puzzles?game=spotlight',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'cron_service_role_key'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $CRON$
);

DO $activate$
DECLARE
  target_jobid bigint;
  is_active boolean;
BEGIN
  SELECT jobid, active INTO target_jobid, is_active
  FROM cron.job WHERE jobname = 'generate-puzzles-spotlight';

  IF target_jobid IS NULL THEN
    RAISE EXCEPTION 'ABORT: generate-puzzles-spotlight job bulunamadi — schedule adimi basarisiz.';
  END IF;

  IF NOT is_active THEN
    PERFORM cron.alter_job(target_jobid, active := true);
    RAISE NOTICE '120: generate-puzzles-spotlight active=true yapildi.';
  END IF;
END;
$activate$;

-- ============================================================
-- DOWN (ELLE):
--   SELECT cron.alter_job(jobid, active := false)
--     FROM cron.job WHERE jobname = 'generate-puzzles-spotlight';
-- ya da tamamen: SELECT cron.unschedule('generate-puzzles-spotlight');
--
-- DOĞRULAMA (ilk Pazartesi koşumundan sonra):
--   SELECT status_code, left(content::text, 300), created
--   FROM net._http_response ORDER BY created DESC LIMIT 5;
--   -> 200 ve gövdede "spotlight":{"generated":N  (401 = Vault sırrı ölü)
-- ============================================================
