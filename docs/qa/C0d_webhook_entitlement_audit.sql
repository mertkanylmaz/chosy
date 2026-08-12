-- ============================================================================
-- C.0d — Dogrulamasiz webhook donemi entitlement denetimi
-- YAZILDI, CALISTIRILMADI. Read-only: yalnizca SELECT.
--
-- ONEMLI BULGU: `webhook_events` TABLOSU YOK.
--   docs/os/2_CHOSY_BUSINESS_MODEL.md satir 232 idempotency icin
--   `webhook_events` tablosunu sart kosuyor, ancak supabase/migrations/
--   altinda boyle bir tablo hicbir yerde olusturulmuyor (076'ya kadar
--   tarandi). Yani RevenueCat webhook'larinin ham kaydi TUTULMUYOR:
--   hangi istegin geldigi, hangi auth header'i tasidigi, kac kez tekrar
--   geldigi hicbir yerde yazili degil.
--
--   Sonuc: "dogrulamasiz gecmis kayit" sorusu webhook log'undan
--   CEVAPLANAMAZ. Asagidaki sorgular ikinci en iyi kanita bakiyor —
--   webhook'un YAN ETKILERINE (lifetime koltugu, tier atlamasi) — ve
--   sahte entitlement izini oradan ariyor.
--
-- Sema kaynagi: 025_lifetime_tier.sql, 027_webhook_columns.sql
-- Zaman penceresi: kod tarafinda fail-open kalibi bastan beri vardi; alt
--   sinir olarak lifetime altyapisinin devreye girisi (025) alinmali.
--   Asagida acik tarih yerine tum tablo taraniyor — hacim kucuk.
-- ============================================================================


-- ── 1. Lifetime satislari: RevenueCat transaction id'si OLMAYAN kayitlar ─────
-- Gercek bir Apple/RevenueCat satisi her zaman transaction_id tasir. NULL veya
-- bos transaction_id = ya elle acilmis koltuk ya da sahte payload. Fail-open
-- doneminde bir saldirganin en ucuz hedefi tam olarak burasiydi:
-- process-lifetime-purchase'a auth'suz POST → bedava Founding Member.
SELECT
  ls.id,
  ls.user_id,
  ls.sale_number,
  ls.purchased_at,
  ls.price_paid,
  ls.rc_transaction_id,
  u.email,
  CASE
    WHEN ls.rc_transaction_id IS NULL THEN 'TRANSACTION_ID_YOK'
    WHEN btrim(ls.rc_transaction_id) = '' THEN 'TRANSACTION_ID_BOS'
  END AS supheli_neden
FROM lifetime_sales ls
LEFT JOIN auth.users u ON u.id = ls.user_id
WHERE ls.rc_transaction_id IS NULL
   OR btrim(ls.rc_transaction_id) = ''
ORDER BY ls.purchased_at DESC;


-- ── 2. Varsayilan fiyatla yazilmis lifetime satislari ────────────────────────
-- Iki Edge Function da `event.price || 89.99` / `price_in_purchased_currency
-- || 89.99` yaziyor. Yani payload'da fiyat YOKSA 89.99 uyduruluyor. Gercek bir
-- RevenueCat event'i fiyati her zaman tasir; 89.99 + transaction_id yoklugu
-- birlikte gorunuyorsa payload elle uydurulmus demektir.
SELECT
  ls.user_id,
  ls.sale_number,
  ls.purchased_at,
  ls.price_paid,
  ls.rc_transaction_id
FROM lifetime_sales ls
WHERE ls.price_paid = 89.99
ORDER BY ls.purchased_at DESC;


-- ── 3. Ucretli tier'i olup lifetime/subscription karsiligi olmayan kullanici ──
-- revenuecat-webhook INITIAL_PURCHASE/RENEWAL'da dogrudan
-- `users.subscription_tier` yaziyor. Dogrulamasiz bir POST ile bir kullanici
-- 'annual' yapilabilirdi. Bu sorgu tier'i ucretli olup arkasinda ne lifetime
-- satisi ne de subscriptions kaydi olan yetim entitlement'lari bulur.
SELECT
  u.id,
  u.subscription_tier,
  u.subscription_active_until,
  u.subscription_will_renew,
  u.updated_at,
  au.email,
  au.created_at AS hesap_olusturma
FROM users u
LEFT JOIN auth.users au ON au.id = u.id
LEFT JOIN lifetime_sales ls ON ls.user_id = u.id
LEFT JOIN subscriptions s ON s.user_id = u.id
WHERE u.subscription_tier IS DISTINCT FROM 'free'
  AND ls.user_id IS NULL
  AND s.user_id IS NULL
ORDER BY u.updated_at DESC NULLS LAST;


-- ── 4. Tier 'lifetime' ama lifetime_sales'te koltugu olmayan kullanicilar ─────
-- claim_lifetime_spot her zaman satir yazar. Tier 'lifetime' olup satis kaydi
-- yoksa entitlement RPC disindan gelmis demektir.
SELECT
  u.id,
  u.subscription_tier,
  u.subscription_active_until,
  u.updated_at,
  au.email
FROM users u
LEFT JOIN auth.users au ON au.id = u.id
WHERE u.subscription_tier = 'lifetime'
  AND NOT EXISTS (SELECT 1 FROM lifetime_sales ls WHERE ls.user_id = u.id)
ORDER BY u.updated_at DESC NULLS LAST;


-- ── 5. Tersi: lifetime koltugu var ama tier duser durumda ────────────────────
-- Butunluk kontrolu. Kayit tutarsizligi, webhook'un yarim calistigina
-- (ornegin RPC gecti, users update'i dustu) isaret eder.
SELECT
  ls.user_id,
  ls.sale_number,
  ls.purchased_at,
  u.subscription_tier
FROM lifetime_sales ls
LEFT JOIN users u ON u.id = ls.user_id
WHERE u.subscription_tier IS DISTINCT FROM 'lifetime'
ORDER BY ls.purchased_at DESC;


-- ── 6. Zaman kumelenmesi: ayni gun icinde anormal lifetime yogunlugu ─────────
-- Otomatize edilmis bir istismar tek tek degil, toplu iz birakir. Gunluk 1-2
-- satis normal; tek gunde onlarca satis dogrulamasiz POST dongusu demektir.
SELECT
  date_trunc('day', ls.purchased_at) AS gun,
  COUNT(*) AS satis_adedi,
  COUNT(*) FILTER (WHERE ls.rc_transaction_id IS NULL) AS transaction_id_yok
FROM lifetime_sales ls
GROUP BY 1
HAVING COUNT(*) > 2
ORDER BY 1 DESC;


-- ── 7. Winback ve billing bildirimleri: kullanicisi olmayan yan etkiler ──────
-- EXPIRATION ve BILLING_ISSUE dallari da dogrulamasiz tetiklenebiliyordu.
-- Bunlar entitlement vermez ama sahte trafigin parmak izini tasir.
SELECT
  'winback_queue' AS kaynak,
  wq.user_id,
  wq.churned_at AS olay_zamani
FROM winback_queue wq
LEFT JOIN users u ON u.id = wq.user_id
WHERE u.id IS NULL
UNION ALL
SELECT
  'notification_log' AS kaynak,
  nl.user_id,
  nl.created_at AS olay_zamani
FROM notification_log nl
LEFT JOIN users u ON u.id = nl.user_id
WHERE nl.type = 'billing_issue'
  AND u.id IS NULL
ORDER BY olay_zamani DESC;
