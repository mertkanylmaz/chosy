-- ============================================================================
-- Migration 077: cron desen onarımı — ölü GUC'ların tasfiyesi
--
-- Faz C.0b. `cron.job` içindeki 7 kayıttan 6'sı HTTP tetikleyicisi; bunların
-- 4'ü aylardır her tetiklemede SQL katmanında düşüyor, 2'si çalışıyor ama
-- kimlik doğrulamasız. Bu migration altısını tek desende birleştirir.
--
-- ── Ölçülen gerçek (8 Ağu 2026, cron.job_run_details + pg_net) ──────────────
--
--   jobid 1  posterle-daily-curation       ERROR: app.settings.supabase_url
--   jobid 3  send-daily-pick-hourly        ERROR: app.supabase_functions_url
--   jobid 4  watchlist-activation-weekend  ERROR: app.supabase_functions_url
--   jobid 5  watchlist-activation-mood-...  ERROR: app.supabase_functions_url
--
-- `pg_net` ömür boyu istek sayısı: **7**. Yani bu dört job HTTP katmanına HİÇ
-- ulaşmadı — hata `net.http_post` çağrılmadan, argüman değerlendirmesinde
-- patlıyor. Aylardır çalışan bir sistem görüntüsü, sıfır iş.
--
-- İkinci katman hata: jobid 3/4/5'in URL'inde `/functions/v1/` segmenti YOK
-- (`current_setting(...) || '/send-daily-pick'`). GUC ayarlanmış olsaydı bile
-- 404 alırlardı. Bu yüzden "GUC'ları ayarla" bir çözüm değildi.
--
-- ── Neden `current_setting` HİÇBİR BİÇİMDE kullanılmıyor (CTO kararı) ───────
-- 019/040/041 deseni bu ortamda kanıtlanmış ölü. GUC'lar hiç kurulmadı ve
-- kurulacaklarının garantisi yok; `ALTER DATABASE ... SET` bir migration'da
-- izlenmiyor, restore/branch işlemlerinde sessizce kaybolur. Taban desen 049
-- (`weekly-trending-sync`) + 075 (`global-slot-daily`): sabit tam URL.
--
-- ── 049'a EKLENEN: Authorization header ─────────────────────────────────────
-- 049 ve 075 header göndermiyor; hedef fonksiyonlar `--no-verify-jwt` ile
-- açıkta. C.0b'de bu fonksiyonlara `requireServiceRole()` geliyor, dolayısıyla
-- cron artık kimliğini ispat etmek zorunda. Sır **Vault'tan runtime okunuyor**;
-- ne bu dosyada ne de `cron.job.command` içinde açık değer bulunuyor.
--
--   ⚠️ Sır adı `cron_service_role_key`. Bu migration ondan yalnızca İSİMLE
--      okur. Değeri kurucu `db push`'tan ÖNCE bir kez elle yazar.
--
-- Fail-closed: sır yoksa header NULL olur ve cron sessizce 401 almaya başlar —
-- güvenli ama görünmez, yani yeni bir sessiz ölü cron. Bu yüzden dosyanın en
-- başında sert bir ön koşul guard'ı var; sır yoksa `db push` patlar.
--
-- ── Neden unschedule DEĞİL, upsert ──────────────────────────────────────────
-- pg_cron 1.6.4'te `cron.schedule()` aynı `jobname` ile çağrıldığında mevcut
-- kaydı GÜNCELLER. `unschedule` + `schedule` job'a yeni bir `jobid` verir ve
-- `cron.job_run_details` geçmişini kayıttan koparır. Geçmiş, bu dosyadaki
-- teşhisin tek kaynağıydı; korunuyor.
--
-- ── Neden alter_job(active := false), unschedule DEĞİL ──────────────────────
-- Dört job'ın içeriği emekli mood-search ürününe ait (ayrıntı: ADIM 0.4
-- denetimi, docs/TEKNIK_BORC.md). Kaldırılmıyorlar çünkü C.2'de içerik
-- gauntlet ritüeline uyarlanacak; envanterde görünür kalsınlar ki tek bayrakla
-- açılabilsinler ve unutulmasınlar.
--
-- ── KAPSAM DIŞI ─────────────────────────────────────────────────────────────
-- jobid 2 `cleanup-rate-limits` saf SQL çalıştırır, HTTP yok, sağlıklı.
-- Bu migration ona hiçbir biçimde dokunmaz.
--
-- ── Doğrulama (bu dosya değil, kurucu çalıştırır) ───────────────────────────
--   select jobid, jobname, schedule, active from cron.job order by jobid;
--     → 7 satır; jobid 2 değişmemiş; 1/3/4/5 active=false; 6/7 active=true
--   select count(*) from cron.job where command ilike '%current_setting%';  → 0
--   select count(*) from cron.job where command ilike '%functions/v1/%';    → 6
--
-- `job_run_details.status = 'succeeded'` KANIT DEĞİLDİR: pg_net
-- fire-and-forget'tir, fonksiyon 401 dönse bile cron komutu başarılı biter.
-- Gerçek kanıt `net._http_response.status_code` ve yan etki satırlarıdır.
-- ============================================================================

-- Uzantılar (idempotent — üçü de aktif: pg_cron 1.6.4, pg_net 0.19.5,
-- supabase_vault 0.3.1)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ----------------------------------------------------------------------------
-- ÖN KOŞUL GUARD — sır yoksa, boşsa veya YANLIŞ KUŞAKSA buradan öteye geçilmez
--
-- `vault.decrypted_secrets` üzerinden bakılır, `vault.secrets` üzerinden DEĞİL:
-- ismin var olması yetmez, cron gövdesinin okuyacağı view'ın gerçekten
-- okunabilir ve değerin boş olmadığı da kanıtlanmalı. Aksi halde guard geçer,
-- cron `Bearer ` gönderir ve önlenmek istenen sessiz 401 aynen oluşur.
--
-- ── Neden `sb_secret_` prefix koşulu ────────────────────────────────────────
-- Bu projede iki anahtar kuşağı yan yana duruyor: Dashboard'da "Legacy API
-- keys" bölümündeki `eyJ...` JWT'ler ve "API keys" bölümündeki `sb_secret_...`
-- değerleri. Edge tarafındaki `requireServiceRole()` C.0a'dan beri YENİ kuşak
-- değerini karşılaştırıyor. Vault'a legacy JWT yazılırsa: guard geçer (uzun ve
-- boş değil), push başarılı olur, sonra altı cron da 401 alır — yani tam olarak
-- bu migration'ın önlemek için var olduğu sessiz ölü kuşak, bu kez altı katlı.
--
-- Prefix kontrolü hem yer tutucu metni hem legacy JWT'yi eler ve niyeti açıkça
-- yazar: cron sırrı yeni kuşak secret key OLMAK ZORUNDA.
--
-- LIKE içindeki `\_` kaçışları gereklidir; kaçışsız `_` tek karakter joker olur
-- ve `sbXsecretY...` gibi değerler de geçerdi.
--
-- ── Guard'ın SINIRI — neyi elemez ──────────────────────────────────────────
-- Bu guard KUŞAK eler, DEĞER elemez. `requireServiceRole()` eşitlik
-- karşılaştırması yapar: doğru biçimde ama YANLIŞ bir `sb_secret_` değeri
-- guard'ı geçer ve altı cron yine 401 alır. Varsayımsal değil — 9 Ağu 2026
-- rotasyonundan sonra `.env` içinde iki ayrı `sb_secret_` değeri bulundu ve
-- yalnızca biri `generate-puzzles` kapısını açtı.
--
-- SQL'den Edge runtime'ın enjekte ettiği değere bakılamaz, dolayısıyla bu
-- kontrol buradan öteye götürülemez. Değer doğruluğunun tek kanıtı canlı
-- çağrıdır; `db push` SONRASI şu ölçüm zorunludur:
--   POST {SUPABASE_URL}/functions/v1/generate-puzzles?force=1
--        -H 'Authorization: Bearer <Vault a yazilan deger>'
--   → 400 FORCE_WITHOUT_DATE  = doğru anahtar (auth geçti, üretim tetiklenmedi)
--   → 401 SERVICE_ROLE_REQUIRED = YANLIŞ anahtar, altı cron ölü kurulmuş
-- Ayrıntı: supabase/functions/generate-puzzles/README.md
--
-- Değer yalnızca bu testlerde kullanılır; hiçbir yere yazılmaz, log'a düşmez,
-- hata mesajında geçmez.
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
      'Beklenen: "sb_secret_" ile baslayan, en az 40 karakterlik yeni kusak '
      'service key (Dashboard > Project Settings > API Keys, "Legacy API keys" '
      'bolumu DEGIL). Legacy "eyJ..." JWT kabul edilmez — Edge taraftaki '
      'requireServiceRole() yeni kusak degeri dogrular, JWT yazilirsa push '
      'gecer ama alti cron da sessizce 401 alir. '
      'Kurucu once dogru sirri yazmali (bir kez, elle), sonra db push.';
  END IF;
END;
$guard$;

-- ----------------------------------------------------------------------------
-- 1) posterle-daily-curation — Posterle günlük bulmaca üretimi
--    Önce: current_setting('app.settings.supabase_url') → ölü
-- ----------------------------------------------------------------------------
SELECT cron.schedule(
  'posterle-daily-curation',
  '0 23 * * *',
  $CRON$
  SELECT net.http_post(
    url := 'https://xpcwihldlnlmyopjubdc.supabase.co/functions/v1/curate-posterle',
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

-- ----------------------------------------------------------------------------
-- 2) send-daily-pick-hourly — günlük film bildirimi (saatlik tarama)
--    Önce: current_setting('app.supabase_functions_url') || '/send-daily-pick'
--    → hem GUC yok hem '/functions/v1/' eksik
-- ----------------------------------------------------------------------------
SELECT cron.schedule(
  'send-daily-pick-hourly',
  '0 * * * *',
  $CRON$
  SELECT net.http_post(
    url := 'https://xpcwihldlnlmyopjubdc.supabase.co/functions/v1/send-daily-pick',
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

-- ----------------------------------------------------------------------------
-- 3) watchlist-activation-weekend — Cuma 15:00 UTC
--    body korunuyor: {"pattern":"weekend_pick"}
-- ----------------------------------------------------------------------------
SELECT cron.schedule(
  'watchlist-activation-weekend',
  '0 15 * * 5',
  $CRON$
  SELECT net.http_post(
    url := 'https://xpcwihldlnlmyopjubdc.supabase.co/functions/v1/watchlist-activation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'cron_service_role_key'
      )
    ),
    body := '{"pattern":"weekend_pick"}'::jsonb,
    timeout_milliseconds := 30000
  );
  $CRON$
);

-- ----------------------------------------------------------------------------
-- 4) watchlist-activation-mood-recall — Çarşamba 17:00 UTC
--    body korunuyor: {"pattern":"mood_recall"}
-- ----------------------------------------------------------------------------
SELECT cron.schedule(
  'watchlist-activation-mood-recall',
  '0 17 * * 3',
  $CRON$
  SELECT net.http_post(
    url := 'https://xpcwihldlnlmyopjubdc.supabase.co/functions/v1/watchlist-activation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'cron_service_role_key'
      )
    ),
    body := '{"pattern":"mood_recall"}'::jsonb,
    timeout_milliseconds := 30000
  );
  $CRON$
);

-- ----------------------------------------------------------------------------
-- 5) weekly-trending-sync — Pazartesi 06:00 UTC  (ÇALIŞAN JOB)
--    049 deseni zaten sağlıklıydı; EKLENEN tek şey Authorization header.
--    active=true kalır.
-- ----------------------------------------------------------------------------
SELECT cron.schedule(
  'weekly-trending-sync',
  '0 6 * * 1',
  $CRON$
  SELECT net.http_post(
    url := 'https://xpcwihldlnlmyopjubdc.supabase.co/functions/v1/sync-trending',
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

-- ----------------------------------------------------------------------------
-- 6) global-slot-daily — her gün 00:05 UTC  (ÇALIŞAN JOB)
--    075 deseni sağlıklıydı; EKLENEN tek şey Authorization header.
--    `timeout_milliseconds` 075'te "desteklendiği kanıtlı değil" gerekçesiyle
--    dışlanmıştı; imza ölçüldü (pg_net 0.19.5:
--    url, body, params, headers, timeout_milliseconds DEFAULT 5000) → destekleniyor.
--    active=true kalır.
-- ----------------------------------------------------------------------------
SELECT cron.schedule(
  'global-slot-daily',
  '5 0 * * *',
  $CRON$
  SELECT net.http_post(
    url := 'https://xpcwihldlnlmyopjubdc.supabase.co/functions/v1/generate-global-slot',
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

-- ----------------------------------------------------------------------------
-- İÇERİĞİ EMEKLİ ÜRÜNE AİT OLAN DÖRT JOB KAPATILIR
--
-- Desenleri onarıldı ama gönderdikleri metin mood-search ürününe ait:
-- `mood_recall` kullanıcıya `mood_searches.mood_text` serbest metnini geri
-- gösteriyor — Chosy'de artık serbest metin girdisi YOK. `weekend_pick` ve
-- `send-daily-pick` ritüel-nötr ama gauntlet'i hiç anmıyor. `curate-posterle`
-- dondurulmuş bonus oyuna ait.
--
-- Metinler bu migration'da DEĞİŞTİRİLMİYOR (C.2'nin işi). Kapatılıyorlar ki
-- onarılmış desen 135 gerçek kullanıcıya emekli ürün metni göndermesin.
--
-- unschedule değil alter_job: kayıt envanterde kalsın, jobid ve geçmiş
-- korunsun, C.2'de tek bayrakla açılsın.
-- ----------------------------------------------------------------------------
DO $deactivate$
DECLARE
  target text;
  target_jobid bigint;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'posterle-daily-curation',
    'send-daily-pick-hourly',
    'watchlist-activation-weekend',
    'watchlist-activation-mood-recall'
  ] LOOP
    SELECT jobid INTO target_jobid FROM cron.job WHERE jobname = target;

    IF target_jobid IS NULL THEN
      -- Az önce schedule edildiler; yoksa bir şey temelden yanlış demektir.
      -- Sessizce geçmek, kapalı sanılan bir job'ın canlı kalması olurdu.
      RAISE EXCEPTION 'Job bulunamadi: % — 077 schedule adimi basarisiz.', target;
    END IF;

    PERFORM cron.alter_job(target_jobid, active := false);
  END LOOP;
END;
$deactivate$;

-- ============================================================================
-- DOWN SCRIPT — geri alma (ELLE çalıştırılır, migration olarak DEĞİL)
--
-- ⚠️ UYARI: bu geri alma dört job'ı ÖLÜ desene döndürür. `current_setting`
-- GUC'ları bu ortamda kurulu olmadığı için jobid 1/3/4/5 geri döndükleri anda
-- yine her tetiklemede hata verir — 077 öncesi durum tam olarak buydu.
-- Geri alınabilirliğin bedeli budur; "çalışır hale döner" beklenmemeli.
-- 6 ve 7 ise header'sız 049/075 desenine döner: bu ikisi çalışır, ama
-- `requireServiceRole()` eklenmiş fonksiyonlardan 401 alırlar. Yani down
-- script yalnızca ADIM 3 fonksiyon deploy'u da geri alınırsa anlamlıdır.
--
-- SELECT cron.schedule('posterle-daily-curation', '0 23 * * *', $CRON$
--   SELECT net.http_post(
--     url := current_setting('app.settings.supabase_url') || '/functions/v1/curate-posterle',
--     headers := jsonb_build_object('Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
--     body := '{}'::jsonb, timeout_milliseconds := 30000) AS request_id;
-- $CRON$);
--
-- SELECT cron.schedule('send-daily-pick-hourly', '0 * * * *', $CRON$
--   SELECT net.http_post(
--     url := current_setting('app.supabase_functions_url') || '/send-daily-pick',
--     headers := jsonb_build_object('Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.service_role_key')),
--     body := '{}'::jsonb);
-- $CRON$);
--
-- SELECT cron.schedule('watchlist-activation-weekend', '0 15 * * 5', $CRON$
--   SELECT net.http_post(
--     url := current_setting('app.supabase_functions_url') || '/watchlist-activation',
--     headers := jsonb_build_object('Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.service_role_key')),
--     body := '{"pattern":"weekend_pick"}'::jsonb);
-- $CRON$);
--
-- SELECT cron.schedule('watchlist-activation-mood-recall', '0 17 * * 3', $CRON$
--   SELECT net.http_post(
--     url := current_setting('app.supabase_functions_url') || '/watchlist-activation',
--     headers := jsonb_build_object('Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.service_role_key')),
--     body := '{"pattern":"mood_recall"}'::jsonb);
-- $CRON$);
--
-- SELECT cron.schedule('weekly-trending-sync', '0 6 * * 1', $CRON$
--   SELECT net.http_post(
--     url := 'https://xpcwihldlnlmyopjubdc.supabase.co/functions/v1/sync-trending',
--     headers := '{"Content-Type": "application/json"}'::jsonb,
--     body := '{}'::jsonb);
-- $CRON$);
--
-- SELECT cron.schedule('global-slot-daily', '5 0 * * *', $CRON$
--   SELECT net.http_post(
--     url := 'https://xpcwihldlnlmyopjubdc.supabase.co/functions/v1/generate-global-slot',
--     headers := '{"Content-Type": "application/json"}'::jsonb,
--     body := '{}'::jsonb);
-- $CRON$);
--
-- -- active bayrakları 077 öncesi haline (hepsi true):
-- SELECT cron.alter_job(jobid, active := true) FROM cron.job
--  WHERE jobname IN ('posterle-daily-curation', 'send-daily-pick-hourly',
--                    'watchlist-activation-weekend', 'watchlist-activation-mood-recall');
--
-- jobid 2 `cleanup-rate-limits` bu geri almanın da dışındadır.
-- ============================================================================
