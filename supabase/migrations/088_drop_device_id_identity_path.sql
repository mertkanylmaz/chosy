-- ============================================================================
-- 088_drop_device_id_identity_path.sql
-- C.7 — kullanılmayan `device_id` kimlik yolunun şemadan sökülmesi.
--
-- ── Gerekçe ─────────────────────────────────────────────────────────────────
-- 069 iki paralel kimlik yolu tanımlamıştı: doğrulanmış `user_id` ve
-- istemciden gelen serbest metin `device_id`. İkincisi hiç canlıya çıkmadı.
-- 16 Ağu 2026 ölçümü (canlı, service_role):
--
--   choice_events    15 satır · device_id dolu 0 · user_id NULL 0
--   watch_feedback    1 satır · device_id dolu 0 · user_id NULL 0
--   duel_impressions 15 satır · device_id dolu 0 · user_id NULL 0
--   daily_gauntlets  14 satır · device_id dolu 0 ·
--                    scope: personal 4 / global 10 / anonim 0
--
-- Yazan kod da yok: tüm repoda `device_id`ye değen tek satır
-- `generate-global-slot/index.ts:199`'daki literal `device_id: null`.
-- `claim_device_data()` hiçbir yerden çağrılmıyor.
--
-- Anonim kullanıcı sorunu bu kolona ihtiyaç duymadan zaten çözülmüş durumda:
-- anonim oturum Supabase Anonymous Sign-In ile açılıyor (auth ayarlarında
-- `anonymous_users: true`, canlıda 234 auth kimliğinin 170'i anonim) ve
-- `ensureAppUser()` anonim/kayıtlı ayrımı YAPMADAN her oturuma bir
-- `public.users` satırı veriyor. Yani anonim bir oyuncunun da doğrulanmış bir
-- `user_id`si var — `device_id` ikinci ve DOĞRULANAMAYAN bir kimlik yüzeyi.
-- Bu, C.0c'de sökülen `body.user_id` anti-pattern'inin şemadaki eşi.
--
-- ── DAVRANIŞ DEĞİŞİKLİĞİ — bu migration saf temizlik DEĞİL ──────────────────
-- `*_owner_present` kısıtları bugün şunu söylüyor:
--     CHECK (user_id IS NOT NULL OR device_id IS NOT NULL)
-- yani "sahibi user_id VEYA device_id olabilir". `device_id` düşünce bu kısıt
-- `user_id NOT NULL`a dönüşür ve o andan itibaren SAHİPSİZ SATIR YAZMAK
-- İMKÂNSIZ hâle gelir. Bugün 0 satır etkileniyor (üç tabloda da user_id NULL
-- sayısı 0), ama bu bir kural değişikliğidir ve bilinçlidir: gauntlet verisi
-- doğrulanmış bir kimliğe ait olmak ZORUNDADIR.
--
-- Bunun ölü bıraktığı bir kod yolu var: `recompute-taste-vector/index.ts`
-- içindeki `skipped_anonymous_rows` sayacı (`user_id IS NULL` satırları
-- dışlar). Kısıt sonrası o dal kanıtlanabilir biçimde ulaşılamaz. Sayaç bu
-- migration'da SİLİNMİYOR — sıfır dönen bir gözlem sayacı zararsızdır ve
-- kaldırılması ayrı bir kod değişikliğidir (C.7 kod temizliği kalemi).
--
-- ── daily_gauntlets ayrı ele alınır ─────────────────────────────────────────
-- Bu tabloda `user_id` NOT NULL YAPILAMAZ: `scope = 'global'` satırları
-- (canlıda 10 adet) tanımı gereği sahipsizdir — günün herkese açık dörtlüsü.
-- Sahiplik kuralı burada `daily_gauntlets_scope_integrity` içinde yaşıyor;
-- kısıt yeniden yazılır, yalnız `'anonim'` dalı düşer.
--
-- `duel_impressions_user_pair_uniq` (partial, WHERE user_id IS NOT NULL)
-- OLDUĞU GİBİ BIRAKILIR: user_id artık NOT NULL olduğu için predicate
-- gereksizleşir ama davranış birebir aynıdır. Index'i yeniden yaratmak
-- (DROP + CREATE) 15 satır için gereksiz bir kilit ve gereksiz bir risk.
--
-- ── Veri kaybı ──────────────────────────────────────────────────────────────
-- YOK. Dört kolonun dördünde de dolu satır sayısı 0 (yukarıdaki ölçüm).
-- DOWN script kolonları geri getirir, veriyi değil — geri getirecek veri yok.
-- ============================================================================


-- ── 1. claim_device_data ────────────────────────────────────────────────────
-- Anonim cihaz verisini kullanıcıya devreden SECURITY DEFINER fonksiyonu.
-- Devredilecek veri hiç oluşmadı; gövdesinin tamamı device_id'ye dayanıyor.

DROP FUNCTION IF EXISTS public.claim_device_data(TEXT, UUID);


-- ── 2. device_id partial UNIQUE index'leri ──────────────────────────────────

DROP INDEX IF EXISTS duel_impressions_device_pair_uniq;
DROP INDEX IF EXISTS daily_gauntlets_device_date_uniq;


-- ── 3. Sahiplik kısıtları → user_id zorunlu ─────────────────────────────────

ALTER TABLE choice_events
  DROP CONSTRAINT IF EXISTS choice_events_owner_present;
ALTER TABLE watch_feedback
  DROP CONSTRAINT IF EXISTS watch_feedback_owner_present;
ALTER TABLE duel_impressions
  DROP CONSTRAINT IF EXISTS duel_impressions_owner_present;

ALTER TABLE choice_events    ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE watch_feedback   ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE duel_impressions ALTER COLUMN user_id SET NOT NULL;


-- ── 4. daily_gauntlets sahiplik + scope kuralı ──────────────────────────────
-- scope_integrity'nin 'anonim' dalı düşer. 'global' dalı (user_id NULL)
-- korunur — o satırlar kimseye ait değildir, olmamalıdır da.

ALTER TABLE daily_gauntlets
  DROP CONSTRAINT IF EXISTS daily_gauntlets_scope_integrity;

ALTER TABLE daily_gauntlets
  ADD CONSTRAINT daily_gauntlets_scope_integrity CHECK (
       (scope = 'global'   AND user_id IS NULL)
    OR (scope = 'personal' AND user_id IS NOT NULL)
  );

-- 069'daki isimsiz inline CHECK Postgres varsayılan adını almıştı
-- (daily_gauntlets_scope_check). 086'daki gerekçeyle adlandırılmış bir
-- kısıtla değiştirilir ki gelecekte DROP CONSTRAINT IF EXISTS güvenilir olsun.
--
-- ⚠️ 'anonim' değeri enum'dan ÇIKARILIYOR. Gerekçe: scope_integrity'nin
-- 'anonim' dalı yukarıda düştüğü için, değer listede bırakılırsa
-- `scope = 'anonim'` bir satır HİÇBİR dalı sağlayamaz ve her INSERT
-- scope_integrity ihlaliyle patlar. Yani "izin verilen ama daima başarısız"
-- bir değer kalırdı — sökmeye çalıştığımız tuzağın aynısı. İleride anonim
-- scope gerekirse tek satırlık bir ALTER yeter; taşınacak veri yok.

ALTER TABLE daily_gauntlets
  DROP CONSTRAINT IF EXISTS daily_gauntlets_scope_check;

ALTER TABLE daily_gauntlets
  ADD CONSTRAINT daily_gauntlets_scope_check
  CHECK (scope IN ('global','personal'));


-- ── 5. Kolonlar ─────────────────────────────────────────────────────────────

ALTER TABLE choice_events    DROP COLUMN IF EXISTS device_id;
ALTER TABLE watch_feedback   DROP COLUMN IF EXISTS device_id;
ALTER TABLE duel_impressions DROP COLUMN IF EXISTS device_id;
ALTER TABLE daily_gauntlets  DROP COLUMN IF EXISTS device_id;


-- ── 6. Bayat COMMENT'ler ────────────────────────────────────────────────────

COMMENT ON COLUMN daily_gauntlets.scope IS
  'global = herkese açık günlük slot (user_id NULL) · personal = bir '
  'kullanıcının kendi dörtlüsü (user_id NOT NULL). Anonim oyuncunun da '
  'doğrulanmış bir user_id''si vardır (Anonymous Sign-In + ensureAppUser), '
  'bu yüzden ayrı bir anonim scope YOKTUR — 088.';

COMMENT ON TABLE choice_events IS
  'Gauntlet turlarındaki ham seçim olayları. Append-only, cinema_dna''nın '
  'kaynağı. Yazma yalnız service_role (submit-choice). Her satır doğrulanmış '
  'bir user_id''ye aittir — sahipsiz satır yazılamaz (088).';


-- ============================================================================
-- DOWN SCRIPT — geri alma (elle çalıştırılır, migration olarak DEĞİL)
--
-- Kolonları ve kısıtları 069'daki hâline döndürür. VERİYİ geri getirmez —
-- getirilecek veri yoktur (dört kolonda da 0 dolu satır).
--
-- ── 5'in tersi: kolonlar ──
-- ALTER TABLE choice_events    ADD COLUMN IF NOT EXISTS device_id TEXT;
-- ALTER TABLE watch_feedback   ADD COLUMN IF NOT EXISTS device_id TEXT;
-- ALTER TABLE duel_impressions ADD COLUMN IF NOT EXISTS device_id TEXT;
-- ALTER TABLE daily_gauntlets  ADD COLUMN IF NOT EXISTS device_id TEXT;
--
-- ── 4'ün tersi: daily_gauntlets kuralları ──
-- ALTER TABLE daily_gauntlets DROP CONSTRAINT IF EXISTS daily_gauntlets_scope_check;
-- ALTER TABLE daily_gauntlets
--   ADD CONSTRAINT daily_gauntlets_scope_check
--   CHECK (scope IN ('global','personal','anonim'));
--
-- ALTER TABLE daily_gauntlets DROP CONSTRAINT IF EXISTS daily_gauntlets_scope_integrity;
-- ALTER TABLE daily_gauntlets
--   ADD CONSTRAINT daily_gauntlets_scope_integrity CHECK (
--        (scope = 'global'   AND user_id IS NULL     AND device_id IS NULL)
--     OR (scope = 'personal' AND user_id IS NOT NULL AND device_id IS NULL)
--     OR (scope = 'anonim'   AND user_id IS NULL     AND device_id IS NOT NULL)
--   );
--
-- ── 3'ün tersi: sahiplik kısıtları ──
-- ALTER TABLE choice_events    ALTER COLUMN user_id DROP NOT NULL;
-- ALTER TABLE watch_feedback   ALTER COLUMN user_id DROP NOT NULL;
-- ALTER TABLE duel_impressions ALTER COLUMN user_id DROP NOT NULL;
--
-- ALTER TABLE choice_events
--   ADD CONSTRAINT choice_events_owner_present
--   CHECK (user_id IS NOT NULL OR device_id IS NOT NULL);
-- ALTER TABLE watch_feedback
--   ADD CONSTRAINT watch_feedback_owner_present
--   CHECK (user_id IS NOT NULL OR device_id IS NOT NULL);
-- ALTER TABLE duel_impressions
--   ADD CONSTRAINT duel_impressions_owner_present
--   CHECK (user_id IS NOT NULL OR device_id IS NOT NULL);
--
-- ── 2'nin tersi: index'ler ──
-- CREATE UNIQUE INDEX IF NOT EXISTS duel_impressions_device_pair_uniq
--   ON duel_impressions (device_id, pair_key) WHERE device_id IS NOT NULL;
-- CREATE UNIQUE INDEX IF NOT EXISTS daily_gauntlets_device_date_uniq
--   ON daily_gauntlets (device_id, date) WHERE device_id IS NOT NULL AND scope = 'anonim';
--
-- ── 1'in tersi: claim_device_data ──
-- CREATE OR REPLACE FUNCTION public.claim_device_data(
--   p_device_id TEXT,
--   p_user_id   UUID
-- )
--   RETURNS JSONB
--   LANGUAGE plpgsql
--   SECURITY DEFINER
--   SET search_path = public
-- AS $$
-- DECLARE
--   v_choice   INT := 0;
--   v_feedback INT := 0;
--   v_merged   INT := 0;
--   v_moved    INT := 0;
--   v_dropped  INT := 0;
--   v_claimed  INT := 0;
-- BEGIN
--   IF p_device_id IS NULL OR p_user_id IS NULL THEN
--     RAISE EXCEPTION 'claim_device_data: p_device_id ve p_user_id zorunlu';
--   END IF;
--
--   IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
--     RAISE EXCEPTION 'claim_device_data: app user bulunamadi: %', p_user_id;
--   END IF;
--
--   UPDATE choice_events SET user_id = p_user_id
--    WHERE device_id = p_device_id AND user_id IS NULL;
--   GET DIAGNOSTICS v_choice = ROW_COUNT;
--
--   UPDATE watch_feedback SET user_id = p_user_id
--    WHERE device_id = p_device_id AND user_id IS NULL;
--   GET DIAGNOSTICS v_feedback = ROW_COUNT;
--
--   WITH device_rows AS (
--     SELECT id, pair_key, shown_count, shown_at
--       FROM duel_impressions
--      WHERE device_id = p_device_id AND user_id IS NULL
--   ),
--   merged AS (
--     UPDATE duel_impressions u
--        SET shown_count = u.shown_count + d.shown_count,
--            shown_at    = greatest(u.shown_at, d.shown_at)
--       FROM device_rows d
--      WHERE u.user_id = p_user_id
--        AND u.pair_key = d.pair_key
--     RETURNING d.id AS device_row_id
--   )
--   DELETE FROM duel_impressions
--    WHERE id IN (SELECT device_row_id FROM merged);
--   GET DIAGNOSTICS v_merged = ROW_COUNT;
--
--   UPDATE duel_impressions SET user_id = p_user_id
--    WHERE device_id = p_device_id AND user_id IS NULL;
--   GET DIAGNOSTICS v_moved = ROW_COUNT;
--
--   DELETE FROM daily_gauntlets d
--    WHERE d.device_id = p_device_id
--      AND d.scope = 'anonim'
--      AND EXISTS (
--        SELECT 1 FROM daily_gauntlets p
--         WHERE p.user_id = p_user_id AND p.scope = 'personal' AND p.date = d.date
--      );
--   GET DIAGNOSTICS v_dropped = ROW_COUNT;
--
--   UPDATE daily_gauntlets
--      SET user_id = p_user_id, device_id = NULL, scope = 'personal'
--    WHERE device_id = p_device_id AND scope = 'anonim';
--   GET DIAGNOSTICS v_claimed = ROW_COUNT;
--
--   RETURN jsonb_build_object(
--     'choice_events',            v_choice,
--     'watch_feedback',           v_feedback,
--     'duel_impressions_merged',  v_merged,
--     'duel_impressions_moved',   v_moved,
--     'daily_gauntlets_dropped',  v_dropped,
--     'daily_gauntlets_claimed',  v_claimed
--   );
-- END;
-- $$;
--
-- REVOKE ALL     ON FUNCTION public.claim_device_data(TEXT, UUID) FROM PUBLIC;
-- REVOKE EXECUTE ON FUNCTION public.claim_device_data(TEXT, UUID) FROM anon, authenticated;
-- GRANT  EXECUTE ON FUNCTION public.claim_device_data(TEXT, UUID) TO service_role;
-- ============================================================================
