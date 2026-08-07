-- ============================================================================
-- Migration 069: Gauntlet ham olay şeması (B.1)
--
-- Temel prensip: HAM OLAYLARI SAKLA, TÜRETİLMİŞ DURUMU ASLA TEK KAYNAK YAPMA.
-- cinema_dna bir CACHE'tir; kaynağı bu dosyadaki choice_events + watch_feedback.
--
-- ── FK kaynağı ──────────────────────────────────────────────────────────────
-- user_id → public.users(id) (app user), auth.users(id) DEĞİL.
-- Gerekçe (ölçüldü, 6 Ağu 2026): public.users ile auth.users id uzayları
-- tamamen ayrık — 136/136 public.users satırının id'si auth.users'ta yok.
-- Bağ `public.users.auth_id TEXT` üzerinden kurulur. Migration 067 tam olarak
-- bu hatayı geri aldı ("oyun sistemi her yerde app users(id) kullanıyor").
-- cinema_dna, watchlist, user_taste_signals, game_scores hepsi bu uzayda.
-- Şema nitelemesi açık yazılır: migration 012'de `users` yazımı search_path
-- nedeniyle auth.users'a resolve olmuş ve 014'te düzeltilmişti.
--
-- ── Spec'ten sapmalar ───────────────────────────────────────────────────────
-- daily_gauntlets spec'te 4 kolonla tanımlanmıştı; aşağıdaki 2 kolon CTO'nun
-- ürün modeli (C.7 anonim oyun + global slot) tarafından zorunlu kılındı:
--   device_id text  — anonim cihaz oyunu
--   scope text      — global / personal / anonim ayrımı
-- Bunlar olmadan üç mod şemada temsil edilemiyor: global slot user_id IS NULL
-- ile tanımlıydı, öksüz satır koruması da aynı NULL'ı yasaklıyordu.
--
-- duel_impressions'tan `choice` ve `latency_ms` çıkarıldı: ikisi de
-- choice_events'te var, iki tabloda aynı gerçek = ıraksama. Bu tablo ham olay
-- değil, "bu çift gösterildi mi" durumudur → yerine shown_count.
--
-- ── Yazma yolu ──────────────────────────────────────────────────────────────
-- İstemci için RLS SELECT-only. Hiçbir tabloda INSERT/UPDATE/DELETE policy'si
-- yok; tüm yazma service_role üzerinden (generate-gauntlet / submit-choice).
-- Gerekçe: choice_events Cinema DNA'nın tek kaynağı — istemci yazabilirse
-- winner, latency_ms, low_confidence ve algorithm_version sahtelenebilir.
-- ============================================================================


-- ─── Yardımcı: oturumdaki auth kullanıcısının app user id'si ────────────────
-- SECURITY INVOKER (varsayılan) bilinçli: users tablosunun "users: self read"
-- policy'si zaten kendi satırını okutuyor, DEFINER gereksiz yetki yüzeyi açar.

CREATE OR REPLACE FUNCTION public.app_user_id()
  RETURNS UUID
  LANGUAGE sql
  STABLE
  SET search_path = public
AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid()::text LIMIT 1;
$$;

COMMENT ON FUNCTION public.app_user_id() IS
  'Oturumdaki auth.uid() değerine karşılık gelen public.users.id. RLS '
  'policy''lerinde kullanılır — auth.uid() app user id ile DOĞRUDAN '
  'karşılaştırılamaz (ayrı id uzayları, bkz. migration 067).';


-- ─── choice_events ──────────────────────────────────────────────────────────
-- Her turdaki tekil seçim. Cinema DNA'nın birincil kaynağı. Append-only.

CREATE TABLE choice_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES public.users(id) ON DELETE CASCADE,
  device_id           TEXT,
  gauntlet_id         UUID NOT NULL,
  session_id          UUID NOT NULL,
  round               INT  NOT NULL CHECK (round BETWEEN 1 AND 3),
  film_a              UUID NOT NULL REFERENCES public.films(id) ON DELETE RESTRICT,
  film_b              UUID NOT NULL REFERENCES public.films(id) ON DELETE RESTRICT,
  winner              UUID REFERENCES public.films(id) ON DELETE RESTRICT,
  outcome             TEXT NOT NULL CHECK (outcome IN ('choice','neither','seen','timeout')),
  position_of_winner  TEXT CHECK (position_of_winner IN ('left','right')),
  latency_ms          INT,
  low_confidence      BOOLEAN NOT NULL DEFAULT false,
  context             JSONB   NOT NULL DEFAULT '{}'::jsonb,
  algorithm_version   TEXT    NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT choice_events_owner_present
    CHECK (user_id IS NOT NULL OR device_id IS NOT NULL),

  -- Meydan okuyucu her zaman farklı bir filmdir (gauntlet mekaniği).
  CONSTRAINT choice_events_distinct_films
    CHECK (film_a <> film_b),

  -- outcome ile winner tutarlılığı. Bu kısıtı ihlal eden yazım kodlama
  -- hatasıdır: istemciye 400, sunucuda Sentry fatal + 422 (B.4 sözleşmesi).
  CONSTRAINT choice_events_outcome_winner_coherence CHECK (
       (outcome = 'timeout'            AND winner IS NULL)
    OR (outcome = 'neither'            AND winner IS NULL)
    OR (outcome IN ('choice','seen')   AND winner IN (film_a, film_b))
  )
);

CREATE INDEX choice_events_user_recent ON choice_events (user_id, created_at DESC);
CREATE INDEX choice_events_gauntlet    ON choice_events (gauntlet_id);

COMMENT ON TABLE choice_events IS
  'Gauntlet turlarındaki ham seçim olayları. Append-only, cinema_dna''nın '
  'kaynağı. Yazma yalnız service_role (submit-choice).';


-- ─── watch_feedback ─────────────────────────────────────────────────────────
-- Şampiyon filmin izlenip izlenmediği. Cinema DNA'nın ikinci kaynağı.

CREATE TABLE watch_feedback (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES public.users(id) ON DELETE CASCADE,
  device_id     TEXT,
  film_id       UUID NOT NULL REFERENCES public.films(id) ON DELETE RESTRICT,
  gauntlet_id   UUID,
  response      TEXT CHECK (response IN ('loved','ok','abandoned','not_watched')),
  asked_at      TIMESTAMPTZ,
  answered_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT watch_feedback_owner_present
    CHECK (user_id IS NOT NULL OR device_id IS NOT NULL)
);

CREATE INDEX watch_feedback_user_film ON watch_feedback (user_id, film_id);

-- Aynı gauntlet + film için tek geri bildirim (idempotency)
CREATE UNIQUE INDEX watch_feedback_gauntlet_film_uniq
  ON watch_feedback (gauntlet_id, film_id)
  WHERE gauntlet_id IS NOT NULL;


-- ─── duel_impressions ───────────────────────────────────────────────────────
-- "Bu çift bu kullanıcıya gösterildi mi" durumu. Ham olay DEĞİL — tekrar
-- gösterimi engellemek için tutulur. Seçim/gecikme choice_events'te.

CREATE TABLE duel_impressions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES public.users(id) ON DELETE CASCADE,
  device_id     TEXT,
  film_a_id     UUID NOT NULL REFERENCES public.films(id) ON DELETE RESTRICT,
  film_b_id     UUID NOT NULL REFERENCES public.films(id) ON DELETE RESTRICT,
  pair_key      TEXT GENERATED ALWAYS AS (
                  least(film_a_id::text, film_b_id::text) || '|' ||
                  greatest(film_a_id::text, film_b_id::text)
                ) STORED,
  shown_count   INT  NOT NULL DEFAULT 1,
  shown_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  context_hash  TEXT,

  CONSTRAINT duel_impressions_owner_present
    CHECK (user_id IS NOT NULL OR device_id IS NOT NULL)
);

-- Partial: NULL'lar aksi halde kısıtı sessizce etkisizleştirir
CREATE UNIQUE INDEX duel_impressions_user_pair_uniq
  ON duel_impressions (user_id, pair_key)   WHERE user_id   IS NOT NULL;
CREATE UNIQUE INDEX duel_impressions_device_pair_uniq
  ON duel_impressions (device_id, pair_key) WHERE device_id IS NOT NULL;

COMMENT ON COLUMN duel_impressions.pair_key IS
  'Sıradan bağımsız çift anahtarı (least|greatest). Generated column — '
  'uygulama katmanında ÜRETİLMEZ.';


-- ─── daily_gauntlets ────────────────────────────────────────────────────────
-- Günün 4 filmi. Türetilmiş veri (cache): algoritma çıktısı, kaynak değil.
-- scope üç modu ayırır: global slot / kayıtlı kullanıcı / anonim cihaz.

CREATE TABLE daily_gauntlets (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID REFERENCES public.users(id) ON DELETE CASCADE,
  device_id          TEXT,
  scope              TEXT NOT NULL DEFAULT 'personal'
                       CHECK (scope IN ('global','personal','anonim')),
  date               DATE   NOT NULL,
  film_ids           UUID[] NOT NULL CHECK (array_length(film_ids, 1) = 4),
  slot_types         TEXT[] NOT NULL CHECK (array_length(slot_types, 1) = 4),
  champion_film_id   UUID REFERENCES public.films(id) ON DELETE RESTRICT,
  context            JSONB,
  relaxed            BOOLEAN NOT NULL DEFAULT false,
  algorithm_version  TEXT    NOT NULL,
  generated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Deterministik: her scope değeri sahiplik kolonlarını tam olarak belirler.
  -- Öksüz satır koruması bu kısıtın içinde — ayrı CHECK gerekmez.
  CONSTRAINT daily_gauntlets_scope_integrity CHECK (
       (scope = 'global'   AND user_id IS NULL     AND device_id IS NULL)
    OR (scope = 'personal' AND user_id IS NOT NULL AND device_id IS NULL)
    OR (scope = 'anonim'   AND user_id IS NULL     AND device_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX daily_gauntlets_user_date_uniq
  ON daily_gauntlets (user_id, date)   WHERE user_id   IS NOT NULL AND scope = 'personal';
CREATE UNIQUE INDEX daily_gauntlets_device_date_uniq
  ON daily_gauntlets (device_id, date) WHERE device_id IS NOT NULL AND scope = 'anonim';
CREATE UNIQUE INDEX daily_gauntlets_global_date_uniq
  ON daily_gauntlets (date)            WHERE scope = 'global';

CREATE INDEX daily_gauntlets_scope_date ON daily_gauntlets (scope, date);

-- B.3'teki "son 21 gün gösterilen filmler" filtresi için
CREATE INDEX daily_gauntlets_film_ids_gin ON daily_gauntlets USING GIN (film_ids);

COMMENT ON COLUMN daily_gauntlets.scope IS
  'global = herkese açık slot (user_id/device_id NULL) · personal = kayıtlı '
  'kullanıcı · anonim = cihaz. claim_device_data anonim → personal çevirir.';


-- ─── context_patterns ───────────────────────────────────────────────────────
-- Bağlam tahmininin öğrenilmiş dağılımı. Yalnız kayıtlı kullanıcı.

CREATE TABLE context_patterns (
  user_id            UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  day_type           TEXT NOT NULL,
  hour_bucket        INT  NOT NULL,
  companion          TEXT,
  duration_pref      TEXT,
  energy             TEXT,
  observation_count  INT  NOT NULL DEFAULT 1,
  last_seen          TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, day_type, hour_bucket)
);


-- ─── context_corrections ────────────────────────────────────────────────────
-- Kullanıcının tahmini düzeltmesi. Tahmin kalitesinin ölçüm kaynağı.

CREATE TABLE context_corrections (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES public.users(id) ON DELETE CASCADE,
  gauntlet_id  UUID,
  predicted    JSONB,
  corrected    JSONB,
  at           TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================================
-- RLS — istemci için SELECT-only
-- INSERT/UPDATE/DELETE policy'si BİLİNÇLİ OLARAK YOK. Yazma service_role.
-- ============================================================================

ALTER TABLE choice_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_feedback       ENABLE ROW LEVEL SECURITY;
ALTER TABLE duel_impressions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_gauntlets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_patterns     ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_corrections  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "choice_events_own_read" ON choice_events
  FOR SELECT USING (user_id = (SELECT public.app_user_id()));

CREATE POLICY "watch_feedback_own_read" ON watch_feedback
  FOR SELECT USING (user_id = (SELECT public.app_user_id()));

CREATE POLICY "duel_impressions_own_read" ON duel_impressions
  FOR SELECT USING (user_id = (SELECT public.app_user_id()));

CREATE POLICY "context_patterns_own_read" ON context_patterns
  FOR SELECT USING (user_id = (SELECT public.app_user_id()));

CREATE POLICY "context_corrections_own_read" ON context_corrections
  FOR SELECT USING (user_id = (SELECT public.app_user_id()));

CREATE POLICY "daily_gauntlets_personal_read" ON daily_gauntlets
  FOR SELECT USING (
    scope = 'personal' AND user_id = (SELECT public.app_user_id())
  );

CREATE POLICY "daily_gauntlets_global_read" ON daily_gauntlets
  FOR SELECT USING (scope = 'global');

-- scope = 'anonim' için SELECT policy'si YOK: istemci başka bir cihazın
-- açılmamış gauntlet'ını görmemeli. claim_device_data ile 'personal'e
-- çevrildikten sonra okunur.


-- ============================================================================
-- claim_device_data — anonim → kayıtlı devir (C.7 ön koşulu)
--
-- Şema kilitlendikten sonra eklenemez, bu yüzden B.1'de tanımlanır.
-- SECURITY DEFINER: RLS'i aşarak device satırlarına dokunur; yalnız
-- service_role çağırabilir (aşağıda REVOKE).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.claim_device_data(
  p_device_id TEXT,
  p_user_id   UUID
)
  RETURNS JSONB
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_choice   INT := 0;
  v_feedback INT := 0;
  v_merged   INT := 0;
  v_moved    INT := 0;
  v_dropped  INT := 0;
  v_claimed  INT := 0;
BEGIN
  IF p_device_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'claim_device_data: p_device_id ve p_user_id zorunlu';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'claim_device_data: app user bulunamadi: %', p_user_id;
  END IF;

  -- ── choice_events / watch_feedback: unique kısıt yok, düz devir ──────────
  UPDATE choice_events SET user_id = p_user_id
   WHERE device_id = p_device_id AND user_id IS NULL;
  GET DIAGNOSTICS v_choice = ROW_COUNT;

  UPDATE watch_feedback SET user_id = p_user_id
   WHERE device_id = p_device_id AND user_id IS NULL;
  GET DIAGNOSTICS v_feedback = ROW_COUNT;

  -- ── duel_impressions ─────────────────────────────────────────────────────
  -- SIRA ÖNEMLİ: önce çakışanlar birleştirilip silinir, sonra kalanlar
  -- devredilir. Ters sırada toplu UPDATE partial UNIQUE index'i ihlal eder.
  WITH device_rows AS (
    SELECT id, pair_key, shown_count, shown_at
      FROM duel_impressions
     WHERE device_id = p_device_id AND user_id IS NULL
  ),
  merged AS (
    UPDATE duel_impressions u
       SET shown_count = u.shown_count + d.shown_count,
           shown_at    = greatest(u.shown_at, d.shown_at)
      FROM device_rows d
     WHERE u.user_id = p_user_id
       AND u.pair_key = d.pair_key
    RETURNING d.id AS device_row_id
  )
  DELETE FROM duel_impressions
   WHERE id IN (SELECT device_row_id FROM merged);
  GET DIAGNOSTICS v_merged = ROW_COUNT;

  UPDATE duel_impressions SET user_id = p_user_id
   WHERE device_id = p_device_id AND user_id IS NULL;
  GET DIAGNOSTICS v_moved = ROW_COUNT;

  -- ── daily_gauntlets ──────────────────────────────────────────────────────
  -- Türetilmiş veri: aynı gün kullanıcıda zaten varsa cihaz satırı atılır.
  DELETE FROM daily_gauntlets d
   WHERE d.device_id = p_device_id
     AND d.scope = 'anonim'
     AND EXISTS (
       SELECT 1 FROM daily_gauntlets p
        WHERE p.user_id = p_user_id AND p.scope = 'personal' AND p.date = d.date
     );
  GET DIAGNOSTICS v_dropped = ROW_COUNT;

  UPDATE daily_gauntlets
     SET user_id = p_user_id, device_id = NULL, scope = 'personal'
   WHERE device_id = p_device_id AND scope = 'anonim';
  GET DIAGNOSTICS v_claimed = ROW_COUNT;

  RETURN jsonb_build_object(
    'choice_events',            v_choice,
    'watch_feedback',           v_feedback,
    'duel_impressions_merged',  v_merged,
    'duel_impressions_moved',   v_moved,
    'daily_gauntlets_dropped',  v_dropped,
    'daily_gauntlets_claimed',  v_claimed
  );
END;
$$;

REVOKE ALL     ON FUNCTION public.claim_device_data(TEXT, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_device_data(TEXT, UUID) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.claim_device_data(TEXT, UUID) TO service_role;

COMMENT ON FUNCTION public.claim_device_data(TEXT, UUID) IS
  'Anonim cihaz verisini kayıtlı kullanıcıya devreder (C.7). Yalnız '
  'service_role çağırabilir. duel_impressions çakışmalarında shown_count '
  'toplanır, daily_gauntlets çakışmalarında cihaz satırı atılır (türetilmiş).';


-- ============================================================================
-- DOWN SCRIPT — geri alma (elle çalıştırılır, migration olarak DEĞİL)
--
-- DROP FUNCTION IF EXISTS public.claim_device_data(TEXT, UUID);
--
-- DROP TABLE IF EXISTS context_corrections CASCADE;
-- DROP TABLE IF EXISTS context_patterns    CASCADE;
-- DROP TABLE IF EXISTS daily_gauntlets     CASCADE;
-- DROP TABLE IF EXISTS duel_impressions    CASCADE;
-- DROP TABLE IF EXISTS watch_feedback      CASCADE;
-- DROP TABLE IF EXISTS choice_events       CASCADE;
--
-- DROP FUNCTION IF EXISTS public.app_user_id();
-- ============================================================================
