-- ─────────────────────────────────────────────────────────────────────────────
-- 131 — public.users: ai_consent_at + ai_consent_version
--
-- R-1 third-party AI rızası (Apple 5.1.2(i)). Kullanıcı verisini Anthropic'e
-- (Claude) gönderen ilk eylemden önce just-in-time rıza sheet'i gösterilir;
-- rıza bu iki kolonda saklanır.
--
--   ai_consent_at       → rızanın verildiği an. NULL = rıza yok ya da geri çekildi
--                         (Settings'te "AI önerileri" kapatılınca NULL'a döner).
--   ai_consent_version  → kabul edilen rıza metninin sürümü. Metin esaslı değişince
--                         kodda AI_CONSENT_VERSION artar; eski sürüm "rıza yok"
--                         sayılır ve sheet yeniden gösterilir.
--
-- ── Neden DEFAULT ve CHECK yok ──────────────────────────────────────────────
-- NULL anlamlıdır: "hiç sorulmadı / verilmedi / geri çekildi". DEFAULT bir rıza
-- değeri uydurur. CHECK'e gerek yok: sürüm karşılaştırması istemcide
-- (`ai_consent_version >= AI_CONSENT_VERSION`), sürüm aralığı sabit değil.
--
-- ── Neden backfill YOK ──────────────────────────────────────────────────────
-- Mevcut tüm hesaplar rıza vermemiştir; NULL doğru başlangıçtır. Kimseye
-- geriye dönük rıza yazılmaz.
--
-- ── Yetki ───────────────────────────────────────────────────────────────────
-- Yazma yolu mevcut "users: self update" policy'si (001:147) ile zaten açık
-- (auth_id = auth.uid()::text); yeni policy GEREKMİYOR. İstemci yazarken
-- `.eq('auth_id', user.id)` kullanır.
--
-- ── Bilinen sınır ───────────────────────────────────────────────────────────
-- Sunucu tarafı zorlama (Edge Function 403) bu migration'ın kapsamı DEĞİL:
-- eski istemcileri kilitler. docs/TEKNIK_BORC.md'ye girildi. Bu nedenle kolon
-- istemci beyanıdır; kendi satırını yazabilen kullanıcı değeri değiştirebilir.
--
-- Geri alma: ALTER TABLE public.users
--   DROP COLUMN ai_consent_at, DROP COLUMN ai_consent_version;
-- Veri kaybı riski: yok (yalnızca nullable ADD COLUMN, mevcut satırlar NULL).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS ai_consent_at      timestamptz NULL,
  ADD COLUMN IF NOT EXISTS ai_consent_version smallint    NULL;

COMMENT ON COLUMN public.users.ai_consent_at IS
  'Third-party AI (Anthropic) rızasının verildiği an. NULL = rıza yok ya da '
  'geri çekildi. Migration 131 (R-1).';

COMMENT ON COLUMN public.users.ai_consent_version IS
  'Kabul edilen rıza metni sürümü; istemcide AI_CONSENT_VERSION ile '
  'karşılaştırılır. Migration 131 (R-1).';

-- ── Doğrulama ───────────────────────────────────────────────────────────────
-- IF NOT EXISTS, kolon başka tipte zaten varsa sessizce atlar (bkz. 012 dersi).
-- Tip ve nullability burada açıkça doğrulanır; uyuşmazlık migration'ı düşürür.
DO $$
DECLARE
  bad INTEGER;
  filled INTEGER;
BEGIN
  SELECT count(*) INTO bad
  FROM (VALUES ('ai_consent_at', 'timestamp with time zone'),
               ('ai_consent_version', 'smallint')) AS want(col, typ)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'users'
      AND c.column_name = want.col
      AND c.data_type = want.typ
      AND c.is_nullable = 'YES'
      AND c.column_default IS NULL
  );
  IF bad <> 0 THEN
    RAISE EXCEPTION '131: % kolon beklenen tip/nullability/default ile eşleşmiyor', bad;
  END IF;

  SELECT count(*) INTO filled FROM public.users
  WHERE ai_consent_at IS NOT NULL OR ai_consent_version IS NOT NULL;
  IF filled <> 0 THEN
    RAISE EXCEPTION '131: % mevcut satırda rıza kolonu dolu — backfill olmamalıydı', filled;
  END IF;
END $$;
