-- ============================================================
-- Chosy — winback_queue idempotency anahtari
-- 107_winback_queue_rc_event_id.sql
--
-- Baglam: `revenuecat-webhook` EXPIRATION case'i `winback_queue`'ya
-- yaziyor ve bu yazma IDEMPOTENT DEGIL. RevenueCat "at least once"
-- teslim garantisi veriyor; 200 disi yanitta 5/10/20/40/80 dk
-- gecikmeyle 5 kez retry ediyor ve retry AYNI `event.id` ile geliyor.
-- Tekil kisit olmadigi icin her retry mukerrer churn satiri uretir.
--
-- Cozum: RC event kimligini sakla + kismi tekil indeks.
--
-- Neden PARTIAL (WHERE rc_event_id IS NOT NULL), duz UNIQUE degil:
-- Postgres'te duz UNIQUE zaten coklu NULL kabul eder, yani "NULL
-- gelirse idempotency sessizce devre disi" riski iki tasarimda ayni.
-- Fark ileride: RC payload semasi degisip `id` alani tasinir/yeniden
-- adlandirilirsa (bkz. entitlement_id / plan CHECK dersleri —
-- saglayici tarafli sessiz sema kaymasi bu projede iki kez oldu),
-- partial indeks kisitin KENDISINI bozmaz; yalnizca o satirlar
-- korumasiz kalir ve bu Sentry'de gorunur hale getirilir
-- (`rc_event_id` yokken warning — ayni sprint, ayri commit).
--
-- Kolon bilerek NULLABLE: canlida 0 satir var ama NOT NULL kurmak,
-- `id` tasimayan bir cagride TUM insert'i dusururdu ve churn kaydi
-- tamamen kaybolurdu. Korumasiz satir > kayip satir.
-- ============================================================

ALTER TABLE winback_queue
  ADD COLUMN IF NOT EXISTS rc_event_id TEXT;

COMMENT ON COLUMN winback_queue.rc_event_id IS
  'RevenueCat webhook event.id — retry''ler ayni id ile gelir, idempotency anahtari. NULL = RC payload id tasimamis, satir korumasiz.';

CREATE UNIQUE INDEX IF NOT EXISTS winback_queue_rc_event_id_idx
  ON winback_queue (rc_event_id)
  WHERE rc_event_id IS NOT NULL;
