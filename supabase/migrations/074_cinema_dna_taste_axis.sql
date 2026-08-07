-- ============================================================================
-- Migration 074: cinema_dna — ZEVK ekseni kolonlari (B.5)
--
-- ── Neden ayri kolon seti ───────────────────────────────────────────────────
-- PRODUCT_OS §5.1 iki ekseni ayirir:
--   Zevk  — gauntlet secimleri + izleme geri bildirimi  → recompute-taste-vector
--   Bilgi — trivia/oyun performansi (game_scores)       → recompute-cinema-dna
--
-- `cinema_dna` TEK cache tablosu ama IKI fonksiyon yazar. Cakismayi onlemek
-- icin sozlesme kolon bazlidir:
--   recompute-cinema-dna  → knowledge, deduction, auteur_sense, instinct,
--                           consistency, cinema_score, rank_id, identity_title,
--                           total_dailies_completed
--   recompute-taste-vector→ SADECE bu migration'in ekledigi taste_* kolonlari
--                           + user_confidence
-- Iki fonksiyon da digerinin kolonlarina DOKUNMAZ. Bu kural kodda da yazili.
--
-- ── NULL semantigi ──────────────────────────────────────────────────────────
-- taste_computed_at / taste_algorithm_version BILEREK nullable: "hic
-- hesaplanmadi" durumunu mesru olarak temsil ederler. Sentinel tarih ya da
-- '0.0.0' gibi sahte versiyon UYDURULMAZ. Uc-degerli mantik yasagi *belirsiz*
-- NULL'lar icindi; burada NULL'un anlami tek ve net.
--
-- taste_vector de nullable: bu migration calistiginda mevcut kullanicilarin
-- (bugun 135+ satir) satiri zaten var ve vektorleri hesaplanmamis olacak.
-- NOT NULL koymak ya migration'in default bir vektor UYDURMASINI ya da tum
-- tabloyu backfill etmesini gerektirirdi — ikisi de B.5 kapsami disinda.
-- Ilk `recompute-taste-vector` (full mod) cagrisinda dolar.
-- ============================================================================


ALTER TABLE cinema_dna
  ADD COLUMN IF NOT EXISTS taste_vector vector(384),
  ADD COLUMN IF NOT EXISTS user_confidence real NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taste_signal_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taste_computed_at timestamptz,
  ADD COLUMN IF NOT EXISTS taste_algorithm_version text;

-- CHECK'ler neden inline DEGIL: inline yazilsalardi Postgres onlara otomatik
-- ad verirdi (cinema_dna_user_confidence_check gibi) ve DOWN script'teki
-- `DROP CONSTRAINT IF EXISTS <isim>` tutmazdi — geri alma sessizce hicbir sey
-- yapmazdi. Isimli kisit + varlik kontrolu hem tekrar calistirmada guvenli
-- hem de geri alinabilir.
--
-- conrelid filtresi ZORUNLU: pg_constraint.conname global tekil DEGIL,
-- tekillik (conrelid, connamespace, conname) uzerindedir. Filtresiz sorgu
-- baska bir tablodaki ayni adli kisiti gorup "zaten var" der ve kisiti
-- SESSIZCE eklemez — yasakli sessiz fallback'in ta kendisi.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.cinema_dna'::regclass
       AND conname  = 'cinema_dna_user_confidence_range'
  ) THEN
    ALTER TABLE cinema_dna
      ADD CONSTRAINT cinema_dna_user_confidence_range
      CHECK (user_confidence >= 0 AND user_confidence <= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.cinema_dna'::regclass
       AND conname  = 'cinema_dna_taste_signal_count_nonneg'
  ) THEN
    ALTER TABLE cinema_dna
      ADD CONSTRAINT cinema_dna_taste_signal_count_nonneg
      CHECK (taste_signal_count >= 0);
  END IF;
END $$;


COMMENT ON COLUMN cinema_dna.taste_vector IS
  'Zevk ekseni: 384 boyutlu shrinkage uygulanmis vektor (vectorEncoder '
  'VECTOR_LAYOUT ile ayni duzen). Kaynak choice_events + watch_feedback. '
  'CACHE — kaynak degil. NULL = henuz hic hesaplanmadi.';

COMMENT ON COLUMN cinema_dna.user_confidence IS
  'Shrinkage agirligi w = min(1, taste_signal_count / N). Istemcideki '
  '"Seni %35 taniyorum" gostergesi bu kolonu okur. 0..1.';

COMMENT ON COLUMN cinema_dna.taste_signal_count IS
  'taste_vector''e katki yapan sinyal sayisi (outcome=''choice'' olaylari + '
  'sifir-olmayan agirlikli watch_feedback satirlari). Ham olay sayisi DEGIL.';

COMMENT ON COLUMN cinema_dna.taste_computed_at IS
  'Son basarili zevk hesaplamasi. NULL = hic hesaplanmadi (sentinel tarih '
  'UYDURULMAZ). Fonksiyon bu durumu tam gecmis hesabina yukseltir.';

-- NOT: 053'teki trg_cinema_dna_updated_at her UPDATE'te tetiklenir, dolayisiyla
-- bu migration'dan sonra `updated_at` HER IKI eksenin yazimiyla ilerler ve
-- artik "BILGI ekseni ne zaman guncellendi" anlamina GELMEZ. Zevk ekseninin
-- kendi zaman damgasi taste_computed_at'tir. Bugun updated_at'i okuyan kod yok.
COMMENT ON COLUMN cinema_dna.taste_algorithm_version IS
  'taste_vector''u ureten algoritma surumu. Degistiginde --full ile gecmis '
  'yeniden kurulur. NULL = hic hesaplanmadi.';


-- ─── app_config: zevk vektoru parametreleri ─────────────────────────────────
--
-- CLAUDE.md kural 6: kod ici sabit YASAK, istek basina LAZY okunur.
-- Agirlik siralamasi B.3/B.4'te kilitlendi; buradaki degerler o siralamanin
-- birebir yansimasi:
--   round_weights          — tur 1 (meydan okuyucu) 1.0 > 1. savunma 0.9 >
--                            2. savunma 0.8
--   low_confidence_mult    — choice_events.low_confidence = true olan olay
--   low_intent_mult        — oturum low_intent (son N olay da dusuk guvenli);
--                            submit-choice ile AYNI kural, yeni kolon YOK
--   feedback_weights       — watch_feedback.response agirliklari
--   full_confidence_signals— w = min(1, sinyal / bu deger)
--
-- ON CONFLICT DO NOTHING = idempotent seed (071/072 gerekcesi aynen gecerli).

INSERT INTO app_config (key, value, description) VALUES
  (
    'taste_vector_config',
    '{
      "round_weights": { "1": 1.0, "2": 0.9, "3": 0.8 },
      "low_confidence_multiplier": 0.3,
      "low_intent_multiplier": 0.1,
      "low_intent_streak": 3,
      "feedback_weights": {
        "loved": 3.0,
        "ok": 0.5,
        "abandoned": -3.0,
        "not_watched": 0
      },
      "full_confidence_signals": 50
    }'::jsonb,
    'recompute-taste-vector agirliklari. round_weights anahtarlari choice_events.round degerleridir (1-3). low_intent_streak submit-choice''taki LOW_INTENT_STREAK ile ayni anlama gelir. full_confidence_signals: user_confidence 1.0''e ulasmak icin gereken sinyal sayisi.'
  )
ON CONFLICT (key) DO NOTHING;


-- ============================================================================
-- DOWN SCRIPT — geri alma (elle calistirilir, migration olarak DEGIL)
--
-- ALTER TABLE cinema_dna DROP CONSTRAINT IF EXISTS cinema_dna_user_confidence_range;
-- ALTER TABLE cinema_dna DROP CONSTRAINT IF EXISTS cinema_dna_taste_signal_count_nonneg;
--
-- ALTER TABLE cinema_dna
--   DROP COLUMN IF EXISTS taste_vector,
--   DROP COLUMN IF EXISTS user_confidence,
--   DROP COLUMN IF EXISTS taste_signal_count,
--   DROP COLUMN IF EXISTS taste_computed_at,
--   DROP COLUMN IF EXISTS taste_algorithm_version;
--
-- DELETE FROM app_config WHERE key = 'taste_vector_config';
-- ============================================================================
