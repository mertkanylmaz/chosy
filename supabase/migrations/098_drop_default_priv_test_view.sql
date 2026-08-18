-- ============================================================================
-- Migration 098: gecici test view'inin temizlenmesi
--
-- 096'nin (default privilege kok neden duzeltmesi) dogrulamasi icin
-- canli veritabaninda `test_default_priv` adinda gecici bir view
-- yaratilip GRANT durumu kontrol edildi (anon/authenticated yoktu —
-- 096 dogrulandi), simdi izsiz temizleniyor.
-- ============================================================================

DROP VIEW IF EXISTS public.test_default_priv;

-- ============================================================================
-- DOWN
-- (Yok — gecici dogrulama nesnesinin kalici bir DOWN'i olmaz.)
-- ============================================================================
