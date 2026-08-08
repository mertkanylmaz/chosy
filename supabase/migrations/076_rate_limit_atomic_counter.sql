-- ============================================================================
-- Migration 076: api_rate_limits için atomik sayaç RPC'si
--
-- `_shared/rateLimit.ts` bugün sayacı PostgREST upsert'ü ile artırmaya
-- çalışıyor ve HİÇBİR ŞEYİ SINIRLAMIYOR. Sebep şema değil, protokol:
--
--   PostgREST'in `upsert` çağrısı gövdeye SABİT bir satır yazar
--   (`request_count: 1`). Çakışmada `ON CONFLICT DO UPDATE` mevcut sayacın
--   ÜZERİNE 1 yazar. Yani sayaç her istekte 1'e döner; dönen değer hep 1;
--   rateLimit.ts:95'teki `if (data.request_count === 1) return` her istekte
--   erken döner ve `throw new RateLimitError` ULAŞILAMAZ KODDUR.
--
-- Bunu istemci tarafında düzeltmek MÜMKÜN DEĞİL: artırma bir İFADE
-- (`request_count + 1`) gerektirir, PostgREST ise yalnızca sabit değer
-- gönderebilir. Bu yüzden artırma DB'ye taşınıyor.
--
-- ── Neden SECURITY INVOKER (DEFINER DEĞİL) ─────────────────────────────────
-- Çağıran zaten service_role: Edge Function `SUPABASE_SERVICE_ROLE_KEY` ile
-- bağlanıyor ve service_role RLS'i baştan bypass eder. DEFINER yazmak hiçbir
-- yetki KAZANDIRMAZ, sadece fonksiyonu ele geçirilirse yetki yükseltme
-- yüzeyine çevirir. En düşük yetki: INVOKER + PUBLIC'ten EXECUTE alınması.
--
-- ── Pencere semantiği DEĞİŞMİYOR ───────────────────────────────────────────
-- 033'ten beri pencere SABİT (tumbling) bir bucket: çağıran taraf
-- `floor(now / windowMs) * windowMs` hesaplayıp `p_window_start` olarak
-- geçiriyor. Kayan pencere DEĞİL. Bu yüzden fonksiyon kendi `date_trunc`ını
-- YAPMAZ — pencere boyu fonksiyon başına farklı olabilir (rateLimit.ts LIMITS)
-- ve pencereyi burada sabitlemek o konfigürasyonu sessizce ezerdi.
--
-- `cleanup_rate_limits()` (033, saat başı) `window_start < NOW() - 1 hour`
-- olanları siler. Yalnızca çöp toplama — limit semantiğine dokunmaz, bu
-- migration onu değiştirmez.
--
-- ── KAPANIŞ KOŞULU ─────────────────────────────────────────────────────────
-- Fonksiyonun `cron.job`/`pg_proc` içinde görünmesi doğrulama DEĞİLDİR.
-- Doğrulama: aynı (user_id, function_name, window_start) üçlüsüyle ardışık
-- çağrıların 1, 2, 3, ... döndürmesi. Aynı değeri iki kez dönerse artırma
-- çalışmıyordur.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- increment_rate_limit — sayacı atomik artırır, YENİ değeri döner
--
-- Tek ifade: INSERT ... ON CONFLICT DO UPDATE ... RETURNING. Satır kilidi
-- ON CONFLICT tarafından tutulduğu için eşzamanlı çağrılar birbirinin
-- artışını EZEMEZ (read-modify-write yarışı yoktur).
--
-- Dönüş: bu istek dahil, pencere içindeki toplam istek sayısı.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_rate_limit(
  p_user_id       TEXT,
  p_function_name TEXT,
  p_window_start  TIMESTAMPTZ
)
RETURNS INTEGER
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.api_rate_limits (
    user_id, function_name, window_start, request_count, updated_at
  )
  VALUES (p_user_id, p_function_name, p_window_start, 1, NOW())
  ON CONFLICT (user_id, function_name, window_start)
  DO UPDATE SET
    request_count = api_rate_limits.request_count + 1,
    updated_at    = NOW()
  RETURNING request_count;
$$;

COMMENT ON FUNCTION public.increment_rate_limit(TEXT, TEXT, TIMESTAMPTZ) IS
  'Atomik rate-limit sayacı. _shared/rateLimit.ts tarafından service_role ile '
  'çağrılır. Dönüş: bu istek dahil pencere içindeki toplam istek sayısı. '
  'Pencere başlangıcını ÇAĞIRAN hesaplar (sabit/tumbling bucket).';

-- ----------------------------------------------------------------------------
-- Yetkiler — yalnızca service_role
--
-- Postgres yeni fonksiyonlara varsayılan olarak PUBLIC EXECUTE verir. Burada
-- o varsayılan geri alınıyor: aksi halde anon/authenticated rolü kendi
-- sayacını istediği gibi artırabilir ya da başkasının kovasını doldurabilirdi
-- (RLS fonksiyonun İÇİNDEKİ INSERT'i engellerdi ama çağrının kendisini değil —
-- gereksiz bir saldırı yüzeyi).
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.increment_rate_limit(TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_rate_limit(TEXT, TEXT, TIMESTAMPTZ) FROM anon;
REVOKE ALL ON FUNCTION public.increment_rate_limit(TEXT, TEXT, TIMESTAMPTZ) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.increment_rate_limit(TEXT, TEXT, TIMESTAMPTZ) TO service_role;

-- ----------------------------------------------------------------------------
-- DOWN SCRIPT — geri alma (elle çalıştırılır, migration olarak DEĞİL)
--
-- DROP FUNCTION IF EXISTS public.increment_rate_limit(TEXT, TEXT, TIMESTAMPTZ);
--
-- UYARI: Bu fonksiyon düşürülürse `_shared/rateLimit.ts` RPC çağrısı hata
-- döner ve onarılmış limiter FAIL-CLOSED davrandığı için parse-mood,
-- explain-match ve rerank-films 503 vermeye başlar. Geri alma yalnızca
-- rateLimit.ts'in RPC öncesi sürümüyle BİRLİKTE anlamlıdır.
--
-- `api_rate_limits` tablosu (033) ve `cleanup_rate_limits()` bu migration'ın
-- kapsamı dışındadır, geri almada SİLİNMEZ.
-- ----------------------------------------------------------------------------
