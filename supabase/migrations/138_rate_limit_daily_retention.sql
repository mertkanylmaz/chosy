-- ============================================================================
-- 138 — cleanup_rate_limits: '*-daily' sayaçları 48 saat saklanır (MONEY-1C)
--
-- SORUN: cleanup_rate_limits() (cron `cleanup-rate-limits`, her saat başı)
--   `window_start < NOW() - 1 saat` satırlarını siliyor. Günlük bir sayaç
--   (pencere = UTC gün başı) 1 saat sonra silinir ve sayaç SIFIRLANIR — günlük
--   limit fiilen "saatte bir sıfırlanan limit" olur. rerank-films günlük sınırı
--   (free 15 / premium+legacy 60) bu yüzden saklama süresini uzatmadan çalışmaz.
--
-- ÇÖZÜM: function_name '-daily' ile BİTEN satırlar 48 saat, diğerleri AYNEN 1 saat.
--   48 saat: pencere UTC gün başında açılır; gün boyunca (24 sa) + gece yarısı
--   sınırı payı için yeterli, tablo şişmez (kimlik × günlük-fonksiyon sayısı).
--
-- SÖZLEŞME: günlük sayaç yazan her kod fonksiyon adını '-daily' ile bitirmek
--   zorundadır (`_shared/rateLimit.ts` checkDailyLimit bunu zorlar).
--
-- DAVRANIŞ DEĞİŞMEZ: 1 saatlik tüm mevcut sayaçlar (parse-mood, rerank-films,
--   recommend, ...) aynı silinir. İmza, sahip ve ACL aynı (CREATE OR REPLACE ACL'i
--   korur). Tek ek: `SET search_path = public, pg_temp` (SECURITY DEFINER
--   sertleştirmesi; gövdede tablo zaten şema nitelemeli, çözümleme değişmez).
--
-- GERİ ALMA: repo dışı kopya (138_rollback.sql) eski gövdeyi geri yazar.
-- UYGULAMA: `supabase db push`.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.api_rate_limits
  WHERE window_start < NOW() - CASE
    WHEN function_name LIKE '%-daily' THEN INTERVAL '48 hours'
    ELSE INTERVAL '1 hour'
  END;
END;
$$;
