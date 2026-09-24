-- ============================================================
-- Chosy — notification_log idempotency anahtari (R-C1)
-- 114_notification_log_rc_event_id.sql
--
-- Baglam: `revenuecat-webhook` BILLING_ISSUE case'i `notification_log`'a
-- yaziyor ve bu yazma IDEMPOTENT DEGIL. Iki ayri carpan var:
--
--   1. RevenueCat "at least once" teslim garantisi veriyor; 200 disi yanitta
--      5/10/20/40/80 dk gecikmeyle 5 kez retry ediyor ve retry AYNI
--      `event.id` ile geliyor.
--   2. BILLING_ISSUE dali insert hatasinda 500 donuyor
--      (`revenuecat-webhook/index.ts` — BILLING_NOTIFICATION_INSERT_FAILED).
--      Yani ilk insert BASARILI olup yanit yolu duserse, retry ayni bildirimi
--      bir daha yazar. Kullanici ayni "Payment issue" push'unu 5 kez alir —
--      zaten odeme sorunu yasayan kullanici icin en kotu an.
--
-- Cozum: migration 107'nin (winback_queue) desenini BIREBIR tekrarla.
-- Iki tablo ayni sagladiyiciya, ayni retry semantigine ve ayni `event.id`
-- anahtarina bakiyor; iki farkli cozum uretmek ileride iki farkli hata
-- uretirdi.
--
-- Neden PARTIAL (WHERE rc_event_id IS NOT NULL), duz UNIQUE degil:
-- Postgres'te duz UNIQUE zaten coklu NULL kabul eder, yani "NULL gelirse
-- idempotency sessizce devre disi" riski iki tasarimda ayni. Fark ileride:
-- RC payload semasi degisip `id` alani tasinir/yeniden adlandirilirsa
-- (saglayici tarafli sessiz sema kaymasi bu projede iki kez oldu — bkz.
-- entitlement_id / plan CHECK dersleri), partial indeks kisitin KENDISINI
-- bozmaz; yalnizca o satirlar korumasiz kalir ve bu Sentry'de gorunur
-- (`RC_EVENT_ID_MISSING` warning, ayni webhook icinde).
--
-- ⚠️ INDEKS TABLO GENELINDE TEKILDIR, BILLING_ISSUE'YA OZEL DEGIL.
-- `revenuecat-webhook` bu tablonun tek yazicisi degil; olcum (24 Eyl 2026,
-- `from('notification_log').insert`):
--   schedule-notifications/index.ts:185,210,243,290
--   send-daily-pick/index.ts:292
--   watchlist-activation/index.ts:245
--   winback-sequencer/index.ts:213
-- (`send-notifications` yalnizca `status` GUNCELLER, insert etmez.)
-- Bu yazicilarin hicbiri `rc_event_id` VERMIYOR, dolayisiyla hepsi NULL
-- birakip indeksin DISINDA kaliyor ve bu kisittan etkilenmiyor. Kolon
-- NULLABLE olmasinin ikinci sebebi budur (birincisi asagida).
--
-- Kolon bilerek NULLABLE: `id` tasimayan bir RC cagrisinda NOT NULL TUM
-- insert'i dusururdu ve kullanici odeme sorunundan hic haberdar olmazdi.
-- Korumasiz satir > kayip satir. Ayni gerekce 107'de de yazili.
--
-- ⚠️ ILERIDE: bir gun ayni `event.id` ile BIRDEN FAZLA farkli bildirim
-- yazilmasi gerekirse (orn. BILLING_ISSUE hem push hem e-posta), bu tekil
-- indeks ikincisini reddeder. O gun anahtar `(rc_event_id, type)` bilesigine
-- tasinmalidir — bugun tek yazici oldugu icin tekil tutuldu.
-- ============================================================

ALTER TABLE notification_log
  ADD COLUMN IF NOT EXISTS rc_event_id TEXT;

COMMENT ON COLUMN notification_log.rc_event_id IS
  'RevenueCat webhook event.id — retry''ler ayni id ile gelir, idempotency anahtari (R-C1). NULL = RC kaynakli olmayan bildirim (schedule-notifications, winback-sequencer, …) VEYA RC payload id tasimamis; her iki durumda satir korumasiz.';

CREATE UNIQUE INDEX IF NOT EXISTS notification_log_rc_event_id_idx
  ON notification_log (rc_event_id)
  WHERE rc_event_id IS NOT NULL;

-- ============================================================
-- DOWN SCRIPT — geri alma (elle calistirilir, migration olarak DEGIL)
--
-- DROP INDEX IF EXISTS notification_log_rc_event_id_idx;
-- ALTER TABLE notification_log DROP COLUMN IF EXISTS rc_event_id;
--
-- ⚠️ Kolonu dusurmek RC kaynakli bildirimlerin idempotency izini de siler;
-- once `revenuecat-webhook` insert'inden `rc_event_id` alani kaldirilmali,
-- aksi halde webhook 42703 (undefined column) ile her BILLING_ISSUE'da
-- 500 doner ve RC sonsuz retry kuyrugu uretir.
-- ============================================================
