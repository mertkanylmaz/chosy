-- ============================================================================
-- Migration 075: generate-global-slot cron kaydı
--
-- Günün `scope = 'global'` satırını üreten fonksiyonu her gün 00:05 UTC'de
-- tetikler. Şema (069) global slotu baştan destekliyordu; eksik olan üreteç
-- B.3'te kapsam dışı bırakılmıştı, bu migration onun zamanlamasını kuruyor.
--
-- ── Neden 019 deseni DEĞİL (CTO kararı, 7 Ağu 2026) ─────────────────────────
-- 019 ve 040/041 hedef URL'yi `current_setting('app.*')` ile okuyor. Bu GUC'lar
-- bu projede HİÇ KURULMADI. Ölçüldü (7 Ağu 2026, cron.job_run_details):
--
--     unrecognized configuration parameter "app.supabase_functions_url"
--
-- Job'lar `cron.job` içinde kayıtlı, `active = true`, tetikleniyor ve her
-- seferinde bu hatayla düşüyor — aylardır. Dışarıdan sistem çalışıyor görünüyor,
-- yaptığı iş sıfır. `send-daily-pick-hourly` (040), `watchlist-activation-*`
-- (041) ve `posterle-daily-curation` (019) bu şekilde ölü.
-- Ayrıntı: docs/TEKNIK_BORC.md → "pg_cron job'larının çoğu aylardır sessizce ölü".
--
-- 019 desenini tekrarlamak YENİ BİR SESSİZ ÖLÜ CRON üretmek olurdu. Bu yüzden
-- 049 (`weekly-trending-sync`) deseni kullanılıyor: sabit URL + header yok +
-- service-role auth'un fonksiyon içinde `Deno.env`'den çözülmesi. Bu DB'de
-- çalıştığı KANITLI tek desen.
--
-- Ön koşul (bu migration'dan önce):
--     supabase functions deploy generate-global-slot --no-verify-jwt
-- `--no-verify-jwt` olmadan header'sız çağrı 401 döner ve cron yine sessizce
-- hiçbir iş yapmaz.
--
-- ── Zamanlama neden 00:05 UTC ───────────────────────────────────────────────
-- Gün anahtarı `utcDateString()`, yani UTC. Hiçbir istemci 00:00 UTC'den önce
-- "bugünün" satırını isteyemez; global satırın gün dönümünden hemen sonra hazır
-- olması yeterli ve gereklidir. 019 (23:00) ve 049 (Pzt 06:00) ile çakışmıyor.
--
-- ── KAPANIŞ KOŞULU ──────────────────────────────────────────────────────────
-- İki yaygın doğrulama da BURADA YANILTICIDIR:
--
--   ✗ `cron.job` içinde kaydın görünmesi. Ölü job'ların hepsi orada sapasağlam
--     görünüyor — o tablo tam olarak bu yanılgının kaynağı.
--
--   ✗ `cron.job_run_details.status = 'succeeded'`. pg_net FIRE-AND-FORGET'tir:
--     `net.http_post` isteği kuyruğa atar ve anında bir request id döner. Cron
--     komutu HER KOŞULDA başarılı biter — fonksiyon 401, 404 veya 500 dönse,
--     hatta hiç deploy edilmemiş olsa bile. 019'un ölümü görünürdü çünkü hatası
--     SQL katmanındaydı; buradaki her hata HTTP katmanında olacak ve bu tabloya
--     HİÇ yansımayacak. Bu ölçütle kapatmak, farklı mekanizmayla ikinci bir
--     sessiz ölü cron üretmek olurdu.
--
-- Gerçek doğrulama, HTTP yanıtına ve üretilen satıra bakar:
--
--   SELECT status_code, error_msg, created
--     FROM net._http_response ORDER BY created DESC LIMIT 5;
--
--   SELECT id, date, film_ids, algorithm_version
--     FROM daily_gauntlets
--    WHERE scope = 'global' AND date = (now() AT TIME ZONE 'utc')::date;
--
-- İlk gerçek cron çalışması yarın 00:05 UTC. O ana kadar fonksiyon ELLE bir kez
-- doğrudan HTTP ile tetiklenerek üretim yolu doğrulanır. Elle tetikleme yalnız
-- FONKSİYONU kanıtlar, cron'u DEĞİL — bu kalem, ilk cron çalışmasının ürettiği
-- global satır görülene kadar AÇIK kalır.
-- ============================================================================

-- Uzantılar (idempotent — ikisi de zaten aktif)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Aynı isimli önceki kaydı kaldır (idempotent yeniden deploy — 019'dan alınan
-- tek şey bu guard; 049'da yok ve tekrar çalıştırıldığında çakışma üretir).
SELECT cron.unschedule('global-slot-daily')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'global-slot-daily'
  );

SELECT cron.schedule(
  'global-slot-daily',
  '5 0 * * *',
  $$
  SELECT net.http_post(
    -- `timeout_milliseconds` BİLİNÇLİ OLARAK yok: 049'da kullanılmıyor ve
    -- 019'da kullanılsa da o gövde hiç çalışmadığı için bu pg_net sürümünde
    -- desteklendiği KANITLI DEĞİL. Cron gövdesi schedule anında parse edilmez,
    -- yani yanlışsa hata ancak ilk çalışmada çıkardı. Kanıtlı desenden sapma
    -- yapılmıyor.
    url := 'https://xpcwihldlnlmyopjubdc.supabase.co/functions/v1/generate-global-slot',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- ----------------------------------------------------------------------------
-- DOWN SCRIPT — geri alma (elle çalıştırılır, migration olarak DEĞİL)
--
-- SELECT cron.unschedule('global-slot-daily');
--
-- Not: üretilmiş `scope = 'global'` satırları SİLİNMEZ. Türetilmiş veridir ama
-- geçmiş günlerin dışlama penceresini (son 21 gün) besler; silinmesi ertesi
-- günün seçimini sessizce değiştirir.
-- ----------------------------------------------------------------------------
