-- ─────────────────────────────────────────────────────────────────────────────
-- 090 — public.users.legacy_mood_access (grandfathering kolonu)
--
-- Relaunch öncesi açılmış hesaplar mood search erişimini KORUR. Gauntlet
-- pivotunda mood search Pro katmanına taşınıyor; bu kolon "bu hesap eski
-- dünyada mood search kullanabiliyordu" bilgisini kalıcı hale getirir.
--
-- ⚠️ Bu kolon HENÜZ hiçbir ekranda okunmuyor. Mood search gate'i C.9c'de
-- bağlanacak. Bu migration yalnızca kolonu ve veriyi hazırlar.
--
-- ── Neden sabit timestamp, neden now() DEĞİL ────────────────────────────────
-- Backfill koşulu `created_at < now()` yazılsaydı migration her ortamda ve her
-- yeniden koşumda FARKLI bir kümeyi işaretlerdi: staging'de bugün açılan bir
-- hesap da "eski hesap" sayılırdı. Grandfathering tanımı gereği SABİT bir
-- kesme anına bağlıdır. Kesme anı = bu migration'ın yazıldığı an:
--   2026-08-17 15:30:00+00
-- Bu andan SONRA açılan her hesap kolonun DEFAULT'unu (false) alır.
--
-- Ölçüm (17 Ağu 2026, sunucu count=exact):
--   public.users toplam           : 234 satır
--   created_at IS NULL            : 0 satır (kesme koşulu kimseyi ıskalamaz)
--   created_at < 2026-08-17 15:30 : 234 satır  → beklenen backfill: 234
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS legacy_mood_access BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.legacy_mood_access IS
  'Relaunch öncesi (2026-08-17 15:30:00+00) açılmış hesaplar için mood search '
  'grandfathering bayrağı. Migration 090 ile eklendi; gate C.9c''de bağlanacak.';

-- ── Backfill ────────────────────────────────────────────────────────────────
-- Kesme anından ÖNCE oluşmuş her satır true. Koşul açık; kör UPDATE yok.
UPDATE public.users
SET legacy_mood_access = true
WHERE created_at < TIMESTAMPTZ '2026-08-17 15:30:00+00'
  AND legacy_mood_access IS DISTINCT FROM true;

-- Doğrulama: kesme anından önceki hiçbir satır false kalmamalı.
DO $$
DECLARE
  missed INTEGER;
  granted INTEGER;
BEGIN
  SELECT count(*) INTO missed
  FROM public.users
  WHERE created_at < TIMESTAMPTZ '2026-08-17 15:30:00+00'
    AND legacy_mood_access IS DISTINCT FROM true;

  IF missed > 0 THEN
    RAISE EXCEPTION
      '090: kesme anından önceki % satır backfill edilmedi — grandfathering eksik.',
      missed;
  END IF;

  SELECT count(*) INTO granted
  FROM public.users
  WHERE legacy_mood_access;

  RAISE NOTICE '090: legacy_mood_access = true olan satır sayısı: %', granted;
END $$;
