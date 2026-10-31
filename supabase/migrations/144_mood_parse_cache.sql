-- ============================================================================
-- 144 — mood_parse_cache: parse-mood v2 çıktısı için paylaşımlı önbellek (MOOD-VEC-2d)
--
-- AMAÇ: Hızlı mood kartları (quick_mood_id) için, aynı metin + aynı schema_version + aynı prompt
-- sürümünde Haiku çağrısı bir kez yapılır; sonrakiler önbellekten döner (parse ~6,6 sn → ~0,1 sn).
-- Serbest metin önbelleğe HİÇ girmez (yalnız quick_mood_id taşıyan v2 istekleri).
--
-- GİZLİLİK: Yalnız parse ÇIKTISI saklanır. Ham mood metni ve kullanıcı kimliği tabloya GİRMEZ;
-- `key` tek yönlü sha256'dır (istemci/sunucu hesabı: _shared/moodParseCache.ts).
--
-- ERİŞİM: RLS açık, policy YOK → yalnız service_role (RLS'i atlar). anon/authenticated'a
-- hiçbir tablo yetkisi verilmez. Okuma/yazma yalnız parse-mood Edge Function'ından.
--
-- TTL: 14 gün, OKURKEN `created_at` ile denetlenir (mood_parse_cache_get). Süresi dolanlar
-- YAZMA sırasında temizlenir (mood_parse_cache_put: en çok 100 satır/yazım); ayrı cron yok.
--
-- GERİ ALMA: DROP FUNCTION public.mood_parse_cache_put(text, integer, text, jsonb);
--            DROP FUNCTION public.mood_parse_cache_get(text, integer);
--            DROP TABLE public.mood_parse_cache;   (yalnız önbellek verisi; kayıp zararsız)
-- ============================================================================

-- IF NOT EXISTS bilerek YOK: tablo başka yoldan (Dashboard) açılmışsa migration yüksek sesle düşsün.
CREATE TABLE public.mood_parse_cache (
  key            text        PRIMARY KEY,
  schema_version integer     NOT NULL,
  prompt_version text        NOT NULL,
  result         jsonb       NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  hit_count      integer     NOT NULL DEFAULT 0,
  CONSTRAINT mood_parse_cache_key_hex CHECK (key ~ '^[0-9a-f]{64}$'),
  CONSTRAINT mood_parse_cache_hit_count_check CHECK (hit_count >= 0),
  CONSTRAINT mood_parse_cache_result_object CHECK (jsonb_typeof(result) = 'object')
);

COMMENT ON TABLE public.mood_parse_cache IS
  'parse-mood v2 çıktı önbelleği (MOOD-VEC-2d). key = sha256(normalize(metin) | schema_version | prompt_version). Kullanıcı verisi içermez; yalnız service_role.';

ALTER TABLE public.mood_parse_cache ENABLE ROW LEVEL SECURITY;

-- Supabase varsayılan yetkileri anon/authenticated'a tablo yetkisi verir; policy olmasa da
-- yetki hiç verilmesin (141 ile aynı ilke).
REVOKE ALL ON TABLE public.mood_parse_cache FROM PUBLIC, anon, authenticated;

-- Okuma + isabet sayacı tek atomik ifadede. SECURITY INVOKER: yetkiyi çağıran rol belirler;
-- yalnız service_role çalıştırabilir. Süresi dolmuş veya olmayan anahtar → NULL.
CREATE FUNCTION public.mood_parse_cache_get(p_key text, p_max_age_seconds integer)
RETURNS jsonb
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  UPDATE public.mood_parse_cache
     SET hit_count = hit_count + 1
   WHERE key = p_key
     AND created_at > now() - make_interval(secs => p_max_age_seconds)
  RETURNING result;
$$;

REVOKE ALL ON FUNCTION public.mood_parse_cache_get(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mood_parse_cache_get(text, integer) TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mood_parse_cache TO service_role;

-- Yazma + süresi dolanların sınırlı temizliği tek işlemde. LIMIT'li alt sorgu: tek yazım en çok
-- 100 eski satırı siler (kilit/süre sınırı). 14 gün = PARSE_CACHE_TTL_SECONDS ile aynı.
CREATE FUNCTION public.mood_parse_cache_put(
  p_key text, p_schema_version integer, p_prompt_version text, p_result jsonb
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.mood_parse_cache AS c (key, schema_version, prompt_version, result)
  VALUES (p_key, p_schema_version, p_prompt_version, p_result)
  ON CONFLICT (key) DO UPDATE
    SET schema_version = EXCLUDED.schema_version,
        prompt_version = EXCLUDED.prompt_version,
        result         = EXCLUDED.result,
        created_at     = now(),
        hit_count      = 0;

  DELETE FROM public.mood_parse_cache
   WHERE key IN (
     SELECT key FROM public.mood_parse_cache
      WHERE created_at < now() - interval '14 days'
      ORDER BY created_at
      LIMIT 100
   );
END;
$$;

REVOKE ALL ON FUNCTION public.mood_parse_cache_put(text, integer, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mood_parse_cache_put(text, integer, text, jsonb) TO service_role;
