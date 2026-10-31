-- ============================================================================
-- 144 — mood_parse_cache: parse-mood v2 çıktısı için paylaşımlı önbellek (MOOD-VEC-2d)
--
-- AMAÇ: Aynı mood metni (normalize edilmiş) + aynı schema_version + aynı prompt sürümü için
-- Haiku çağrısı bir kez yapılır; sonrakiler önbellekten döner (parse ~6,6 sn → ~0,1 sn).
--
-- GİZLİLİK: Yalnız parse ÇIKTISI saklanır. Ham mood metni ve kullanıcı kimliği tabloya GİRMEZ;
-- `key` tek yönlü sha256'dır (istemci/sunucu hesabı: _shared/moodParseCache.ts).
--
-- ERİŞİM: RLS açık, policy YOK → yalnız service_role (RLS'i atlar). anon/authenticated'a
-- hiçbir tablo yetkisi verilmez. Okuma/yazma yalnız parse-mood Edge Function'ından.
--
-- TTL: 14 gün, OKURKEN `created_at` ile denetlenir (mood_parse_cache_get). Süresi dolan satır
-- silinmez; aynı anahtara yeni yazım (upsert) satırı tazeler. Temizlik işi bu migration'da YOK.
--
-- GERİ ALMA: DROP FUNCTION public.mood_parse_cache_get(text, integer);
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
GRANT SELECT, INSERT, UPDATE ON TABLE public.mood_parse_cache TO service_role;
