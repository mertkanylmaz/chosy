-- ============================================================================
-- Migration 108: record_choice_event — olay yazimi + sampiyon atomik (K-37 R1/R3)
--
-- `submit-choice/index.ts` bugun iki AYRI yazma yapiyor ve bunlar tek
-- transaction DEGIL:
--
--   :773  INSERT INTO choice_events (...)
--   :855  UPDATE daily_gauntlets SET champion_film_id = ...
--
-- Ikisi arasinda herhangi bir hata (Edge timeout, ag kopmasi, aradaki
-- recordImpression/rejectionRate cagrilarindan biri) su durumu birakir:
-- 3 ilerleten olay var, sonuncusu outcome='choice', champion_film_id NULL.
--
-- `deriveProgress` (generate-gauntlet:432) bu durumda THROW eder:
--   "progress turetimi: champion_film_id (null) 3. tur kazananiyla uyusmuyor"
--
-- Sonuc: generate-gauntlet o kullanici + o gun icin HER cagrida 500 doner.
-- Kullanici gunu bir daha acamaz, durum kendini onarmaz (K-37 R1).
-- Aynanin oteki yuzu: olaylar eksik ama champion dolu ise deriveProgress
-- champion_film_id'yi sessizce yok sayar ve gauntlet turda gorunur (K-37 R3).
--
-- ── Olcum (27 Agu 2026) ────────────────────────────────────────────────────
-- Canlida 0 vaka. 8 personal gauntlet'in hepsi tutarli. Bu duzeltme
-- ONLEYICIDIR: yaris kodda gercek, hacim artinca atesler. Duzeltme sonrasi
-- ayni kontrol sorgusu tekrar kosuldu, yine 0.
--
-- ── Neden yeni kolon yok ───────────────────────────────────────────────────
-- K-37 Secenek 1 (turetme modeli, bible D-13). `generation_status` ACILMAZ.
-- Bu migration yalnizca mevcut iki yazmayi tek transaction'a alir; sema
-- degismez, `types/gauntlet.ts` sozlesmesine dokunulmaz.
--
-- ── Neden SECURITY INVOKER (DEFINER DEGIL) ─────────────────────────────────
-- 076'da kurulan gerekce burada birebir gecerli: cagiran zaten service_role
-- (submit-choice `getServiceClient()` ile baglaniyor) ve service_role RLS'i
-- baştan bypass eder. DEFINER hicbir yetki KAZANDIRMAZ, yalnizca fonksiyon
-- ele gecirilirse yetki yukseltme yuzeyi acar. Repo bu hatayi bir kez yasadi
-- (099/100 — dogrulamasiz SECURITY DEFINER RPC anon'a acikti). En dusuk
-- yetki: INVOKER + PUBLIC/anon/authenticated'tan EXECUTE alinmasi.
--
-- ── KAPANIS KOSULU ─────────────────────────────────────────────────────────
-- Fonksiyonun pg_proc'ta gorunmesi dogrulama DEGILDIR. Dogrulama: 3. turu
-- 'choice' ile kapatan bir cagri sonrasi ayni transaction'da hem
-- choice_events satirinin hem daily_gauntlets.champion_film_id'nin yazilmis
-- olmasi; ve R1/R3 kontrol sorgusunun 0 satir dondurmesi.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- record_choice_event — olayi yazar, gerekiyorsa sampiyonu ayni transaction'da
-- isaretler.
--
-- Donus (JSONB):
--   {"status":"inserted","event_id":<uuid>,"champion_set":<bool>}
--   {"status":"duplicate"}   → 072'nin partial UNIQUE index'i devreye girdi
--
-- 'duplicate' bir HATA DEGILDIR: ayni tur icin baska bir istek az once
-- ilerletici olay yazmistir. Yarisin kazanani DB'dir; cagiran mevcut durumu
-- doner (submit-choice'taki 23505 dali bu yola tasindi, davranis birebir ayni).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_choice_event(
  p_user_id            UUID,
  p_gauntlet_id        UUID,
  p_round              INT,
  p_film_a             UUID,
  p_film_b             UUID,
  p_winner             UUID,
  p_outcome            TEXT,
  p_position_of_winner TEXT,
  p_latency_ms         INT,
  p_low_confidence     BOOLEAN,
  p_context            JSONB,
  p_algorithm_version  TEXT,
  p_set_champion       BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  -- Sampiyon yazimi yalnizca 3. turun GERCEK kazanani icin gecerlidir.
  -- Cagiran taraf (advanceFrom) bunu zaten hesapliyor; bu kontrol o kurali
  -- DB'de de zorlar, boylece hatali bir cagri sessizce sampiyon uyduramaz.
  -- Sessiz duzeltme YOK (CLAUDE.md #1): tutarsiz cagri istisna ile reddedilir.
  IF p_set_champion AND (p_round <> 3 OR p_outcome <> 'choice' OR p_winner IS NULL) THEN
    RAISE EXCEPTION
      'record_choice_event: gecersiz sampiyon yazimi (round=%, outcome=%, winner=%)',
      p_round, p_outcome, p_winner
      USING ERRCODE = 'check_violation';
  END IF;

  -- session_id = gauntlet_id. Bir gauntlet tek oturumdur; istemciden oturum
  -- kimligi kabul etmek sahtelenebilir bir alan acardi (submit-choice notu).
  BEGIN
    INSERT INTO public.choice_events (
      user_id, gauntlet_id, session_id, round,
      film_a, film_b, winner, outcome,
      position_of_winner, latency_ms, low_confidence,
      context, algorithm_version
    ) VALUES (
      p_user_id, p_gauntlet_id, p_gauntlet_id, p_round,
      p_film_a, p_film_b, p_winner, p_outcome,
      p_position_of_winner, p_latency_ms, p_low_confidence,
      p_context, p_algorithm_version
    )
    RETURNING id INTO v_event_id;
  EXCEPTION
    -- Yalnizca INSERT'i sarar: sampiyon UPDATE'inin bir unique_violation'i
    -- (bugun mumkun degil, ileride bir index eklenirse olabilir) sessizce
    -- "duplicate" diye raporlanmasin.
    WHEN unique_violation THEN
      RETURN jsonb_build_object('status', 'duplicate');
  END;

  IF p_set_champion THEN
    UPDATE public.daily_gauntlets
       SET champion_film_id = p_winner
     WHERE id = p_gauntlet_id;

    -- Satir yoksa olay da yazilmamali: FOUND kontrolu olmadan INSERT commit
    -- olur ve tam olarak R1 durumu dogar. Istisna → tum blok geri alinir.
    IF NOT FOUND THEN
      RAISE EXCEPTION
        'record_choice_event: daily_gauntlets satiri yok: %', p_gauntlet_id
        USING ERRCODE = 'no_data_found';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'status',       'inserted',
    'event_id',     v_event_id,
    'champion_set', p_set_champion
  );
END $$;

COMMENT ON FUNCTION public.record_choice_event(
  UUID, UUID, INT, UUID, UUID, UUID, TEXT, TEXT, INT, BOOLEAN, JSONB, TEXT, BOOLEAN
) IS
  'choice_events INSERT + (3. tur kazananinda) daily_gauntlets.champion_film_id '
  'UPDATE tek transaction. K-37 R1/R3 yarisini kapatir. submit-choice '
  'tarafindan service_role ile cagrilir. Donus: status=inserted|duplicate.';

-- ----------------------------------------------------------------------------
-- Yetkiler — yalnizca service_role (076 deseni)
--
-- Postgres yeni fonksiyonlara varsayilan olarak PUBLIC EXECUTE verir. Burada
-- o varsayilan geri aliniyor: aksi halde authenticated bir rol baskasinin
-- gauntlet'ine olay yazabilir ya da sampiyon isaretleyebilirdi.
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.record_choice_event(
  UUID, UUID, INT, UUID, UUID, UUID, TEXT, TEXT, INT, BOOLEAN, JSONB, TEXT, BOOLEAN
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_choice_event(
  UUID, UUID, INT, UUID, UUID, UUID, TEXT, TEXT, INT, BOOLEAN, JSONB, TEXT, BOOLEAN
) FROM anon;
REVOKE ALL ON FUNCTION public.record_choice_event(
  UUID, UUID, INT, UUID, UUID, UUID, TEXT, TEXT, INT, BOOLEAN, JSONB, TEXT, BOOLEAN
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_choice_event(
  UUID, UUID, INT, UUID, UUID, UUID, TEXT, TEXT, INT, BOOLEAN, JSONB, TEXT, BOOLEAN
) TO service_role;

-- ----------------------------------------------------------------------------
-- DOWN SCRIPT — geri alma (elle calistirilir, migration olarak DEGIL)
--
-- DROP FUNCTION IF EXISTS public.record_choice_event(
--   UUID, UUID, INT, UUID, UUID, UUID, TEXT, TEXT, INT, BOOLEAN, JSONB, TEXT, BOOLEAN
-- );
--
-- UYARI: Fonksiyon dusurulurse submit-choice'in .rpc() cagrisi hata verir ve
-- HICBIR secim kaydedilemez. Once submit-choice'i iki ayri yazmaya geri al
-- (bu migration oncesi hali), sonra fonksiyonu dusur.
-- ----------------------------------------------------------------------------
