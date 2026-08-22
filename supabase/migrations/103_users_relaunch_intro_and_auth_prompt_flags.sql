-- ─────────────────────────────────────────────────────────────────────────────
-- 103 — public.users: has_seen_relaunch_intro + auth_prompt_seen
--
-- R-A-2 iki tek-seferlik yüzeyin "gösterildi mi" durumunu kalıcılaştırır:
--
--   has_seen_relaunch_intro  → E-05 "Chosy değişti" köprü ekranı (§6).
--                              Yalnızca relaunch ÖNCESİ hesaplara gösterilir;
--                              kohort ayrımını 090'ın legacy_mood_access kolonu
--                              yapar, bu kolon yalnızca "okundu" işaretidir.
--
--   auth_prompt_seen         → K-13 auth prompt sheet'i (ilk şampiyon sonrası).
--                              "Not now" da true yazar — CTO kararı (R-A-2,
--                              22 Ağu 2026): K-13 prompt'u "atlanabilir" tanımlar,
--                              tekrar sormak atlanabilirliği geri alır. Giriş yolu
--                              kapanmaz; profile → Sign In her zaman açıktır.
--
-- ── Neden AsyncStorage değil ────────────────────────────────────────────────
-- E-08 kararı: bu bayraklar public.users satırına, auth_id üzerinden yazılır.
-- AsyncStorage cihaz-yerel; yeniden kurulumda sıfırlanır ve kullanıcı köprü
-- ekranını ikinci kez görürdü. Yazma yolu mevcut "users: self update"
-- policy'si (001:147) ile zaten açık — yeni policy GEREKMİYOR.
--
-- ── Neden backfill YOK ──────────────────────────────────────────────────────
-- İki kolon da false başlamalı:
--   · Mevcut 63 hesap köprü ekranını HENÜZ görmedi → false doğru başlangıç.
--   · Relaunch sonrası açılan hesaplar köprüyü hiç görmemeli; bunu bu kolon
--     değil, gate'teki `legacy_mood_access = true` koşulu engeller (090 kesme
--     anı 2026-08-17 15:30+00, sonraki hesaplarda false).
--   · auth_prompt_seen yalnızca anonim kullanıcıya sorulur; kayıtlı hesapta
--     tetikleyici hiç çalışmaz, değeri false kalması zararsızdır.
--
-- ── Neden index yok ─────────────────────────────────────────────────────────
-- İki kolon da yalnızca tek satır okumasında (auth_id = …) kullanılır;
-- auth_id zaten UNIQUE (001:16). Düşük kardinaliteli boolean'a index yazmak
-- planner'a fayda sağlamaz.
--
-- Geri alma: ALTER TABLE public.users
--   DROP COLUMN has_seen_relaunch_intro, DROP COLUMN auth_prompt_seen;
-- Veri kaybı riski: yok (yalnızca ADD COLUMN, DEFAULT'lu, NOT NULL).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS has_seen_relaunch_intro BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auth_prompt_seen        BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.has_seen_relaunch_intro IS
  'E-05 "Chosy değişti" köprü ekranı bu hesaba gösterildi mi. Migration 103 '
  '(R-A-2). Yalnızca legacy_mood_access = true olan kohorta gösterilir.';

COMMENT ON COLUMN public.users.auth_prompt_seen IS
  'K-13 auth prompt sheet''i bu hesaba gösterildi mi. Migration 103 (R-A-2). '
  '"Not now" da true yazar — prompt en fazla bir kez görünür.';

-- ── Doğrulama ───────────────────────────────────────────────────────────────
DO $$
DECLARE
  cols INTEGER;
  legacy_pending INTEGER;
BEGIN
  SELECT count(*) INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name IN ('has_seen_relaunch_intro', 'auth_prompt_seen');

  IF cols <> 2 THEN
    RAISE EXCEPTION '103: beklenen 2 kolon, bulunan % — migration eksik uygulandı.', cols;
  END IF;

  -- Köprü ekranını görecek kohortun büyüklüğü (beklenen: 090 backfill sayısı).
  SELECT count(*) INTO legacy_pending
  FROM public.users
  WHERE legacy_mood_access AND NOT has_seen_relaunch_intro;

  RAISE NOTICE '103: köprü ekranı bekleyen hesap sayısı: %', legacy_pending;
END $$;
