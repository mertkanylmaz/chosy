-- ============================================================================
-- 123 — merge_anonymous_user: TAMAMLANMIŞ previous satırı taşınır (Sprint 9)
--
-- SORUN (canlıda doğrulandı): Anonim kullanıcı tamamlanmış (champion seçilmiş)
--   bir `previous` gauntlet'i oynayıp mevcut hesaba girince 122'nin TURUNCU 2
--   kuralı (kaynak cycle='previous' VE hedefin herhangi bir personal satırı
--   varsa → target_won) satırı silip kaybettiriyordu. Kuralın gerekçesi
--   ("previous, geçmişi olan hedefte oynanamaz") yalnız TAMAMLANMAMIŞ satır için
--   geçerlidir: tamamlanmış satırın oynanması gerekmez, yalnız görünmesi gerekir.
--
-- KEŞİF (2 Eki 2026, streak şişirme riski YOK):
--   a) Streak/milestone daily_gauntlets'ten TÜRETİLMEZ. `user_streaks` yalnız
--      `update_streak(p_user_id)` RPC'siyle (009 → 058 → 109:711) `last_active_date`
--      üzerinden yazılır; `check_milestones` (109:128) aynı tablolara bakar.
--      Gauntlet yolları (generate-gauntlet, submit-choice, get-archive-status,
--      previousCycle) `user_streaks`'e dokunmaz — previousCycle.test.ts:247 (3c)
--      bunu kaynak taramasıyla zorlar. Taşınan satır hedefin streak'ini DEĞİŞTİRMEZ.
--      Ritüel halkası (`getChampionDatesSince`, gauntletService.ts:796) tarihleri
--      satırlardan okur ama yalnız haftalık görsel doluluktur, sayaç değildir.
--   b) `getLastChampion` (gauntletService.ts:760) tarih filtresiz, en yeni
--      şampiyonlu satırı döner. Taşınan satır hedefin daha yeni şampiyonu yoksa
--      "son şampiyon" olarak görünür — istenen davranış (kullanıcı onu gerçekten seçti).
--
-- KURAL (122'den fark yalnız burada):
--   * Kaynak TAMAMLANMIŞSA (champion_film_id IS NOT NULL): hedefte TAM v_src.date
--     tarihli satır YOKSA taşınır — hedefin geçmişi ve bugünkü satırı engel değil.
--   * Kaynak TAMAMLANMAMIŞ `previous` ise 122 kuralı aynen: hedefin HERHANGİ bir
--     personal satırı varsa hedef kazanır.
--   * Tamamlanmamış `current`/bugün: yalnız v_src.date çakışması hedefi kazandırır.
--   Diğer her şey 122 ile aynı (imza, INVOKER, search_path, kilit, K-16 silme,
--   REVOKE/GRANT).
--
-- BİLİNEN SINIR (v1 "tek satır" kapsamı): kaynakta hem tamamlanmış previous hem
--   bugünkü satır varsa bugünkü taşınır, previous CASCADE ile düşer (TEKNIK_BORC).
--
-- GERİ ALMA: SQL Editor'da DEĞİL (CLAUDE.md kural 3) — 122_merge_anonymous_user.sql'deki
--   CREATE OR REPLACE FUNCTION gövdesini VE 122'nin COMMENT ON FUNCTION ifadesini
--   içeren yeni bir migration (124) yazılıp `supabase db push` ile uygulanır
--   (CREATE OR REPLACE GRANT'leri korur). Taşınmış veri geri alınamaz.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.merge_anonymous_user(p_from uuid, p_to uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today              date := (now() AT TIME ZONE 'UTC')::date;
  v_src                record;
  v_target_wins        boolean := false;
  v_events_moved       integer := 0;
  v_corrections_moved  integer := 0;
  v_moved_id       uuid;
  v_dropped_id     uuid;
BEGIN
  IF p_from IS NULL OR p_to IS NULL THEN
    RAISE EXCEPTION 'merge_anonymous_user: NULL argüman' USING ERRCODE = '22004';
  END IF;
  IF p_from = p_to THEN
    RAISE EXCEPTION 'merge_anonymous_user: kaynak ve hedef aynı (%)', p_from
      USING ERRCODE = '22023';
  END IF;

  -- İki kullanıcı üzerinde transaction-advisory kilit, SABİT sırayla (küçük
  -- uuid önce) → A→B ile B→A eşzamanlı gelse de deadlock olmaz; aynı çift
  -- için ikinci çağrı birincinin commit'ini bekler ve `already_merged` görür.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('merge_anonymous_user:' || LEAST(p_from, p_to)::text, 0));
  PERFORM pg_advisory_xact_lock(
    hashtextextended('merge_anonymous_user:' || GREATEST(p_from, p_to)::text, 0));

  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_to) THEN
    RAISE EXCEPTION 'merge_anonymous_user: hedef kullanıcı yok (%)', p_to
      USING ERRCODE = 'P0002';
  END IF;

  -- İdempotent: kaynak zaten silinmişse (önceki başarılı çağrı) iş yok.
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_from) THEN
    RETURN jsonb_build_object('status', 'already_merged');
  END IF;

  -- Aktif satır: bugün tarihli > son 2 gün içindeki previous (bkz. 122 başlığı).
  -- `completed` 123'te eklendi: kural kaynağın tamamlanıp tamamlanmadığına bakar.
  SELECT id, date, cycle, (champion_film_id IS NOT NULL) AS completed
    INTO v_src
    FROM daily_gauntlets
   WHERE user_id = p_from
     AND scope = 'personal'
     AND (date = v_today OR (cycle = 'previous' AND date >= v_today - 2))
   ORDER BY (date = v_today) DESC, date DESC
   LIMIT 1
   FOR UPDATE;

  IF FOUND THEN
    -- Tarih çakışması (hedefte tam v_src.date tarihli satır) HER durumda hedefi
    -- kazandırır (daily_gauntlets_user_date_uniq). Hedefin bugünkü satırı tek
    -- başına engel DEĞİL: tarihler farklıysa çakışma yok. Geçmiş-var kuralı
    -- (TURUNCU 2) yalnız TAMAMLANMAMIŞ previous için kalır: oynanamaz satırı
    -- taşımak anlamsız. Tamamlanmış satır oynanmaz, yalnız görünür.
    SELECT EXISTS (
      SELECT 1 FROM daily_gauntlets
       WHERE user_id = p_to
         AND scope = 'personal'
         AND (
           date = v_src.date
           OR (v_src.cycle = 'previous' AND NOT v_src.completed)
         )
    ) INTO v_target_wins;

    IF v_target_wins THEN
      -- Hedef kazanır: anonim satır ve olayları aşağıdaki users silmesiyle
      -- CASCADE gider. Ayrıca silinmez — tek silme yolu, tek kural.
      v_dropped_id := v_src.id;
    ELSE
      UPDATE daily_gauntlets SET user_id = p_to WHERE id = v_src.id;

      UPDATE choice_events
         SET user_id = p_to
       WHERE gauntlet_id = v_src.id
         AND user_id = p_from;
      GET DIAGNOSTICS v_events_moved = ROW_COUNT;

      UPDATE context_corrections
         SET user_id = p_to
       WHERE gauntlet_id = v_src.id
         AND user_id = p_from;
      GET DIAGNOSTICS v_corrections_moved = ROW_COUNT;

      v_moved_id := v_src.id;
    END IF;
  END IF;

  -- K-16: anonim app kullanıcısı + taşınmayan her şey (CASCADE).
  DELETE FROM users WHERE id = p_from;

  RETURN jsonb_build_object(
    'status',               CASE
                              WHEN v_moved_id   IS NOT NULL THEN 'merged'
                              WHEN v_dropped_id IS NOT NULL THEN 'target_won'
                              ELSE 'nothing_to_move'
                            END,
    'moved_gauntlet_id',    v_moved_id,
    'dropped_gauntlet_id',  v_dropped_id,
    'moved_cycle',          CASE WHEN v_moved_id IS NOT NULL THEN v_src.cycle END,
    'events_moved',         v_events_moved,
    'corrections_moved',    v_corrections_moved
  );
END;
$$;

COMMENT ON FUNCTION public.merge_anonymous_user(uuid, uuid) IS
  'Sprint 1 / 1b + Sprint 9: anonim kullanıcının aktif gauntlet''ini + choice_events / context_corrections''ını '
  'mevcut hesaba taşır (hedefte aynı tarihli satır varsa ya da kaynak tamamlanmamış previous ve hedefin '
  'geçmişi varsa hedef kazanır; tamamlanmış satır geçmişe rağmen taşınır), sonra anonim '
  'public.users satırını siler (K-16 cascade). Yalnız service_role çağırır '
  '(merge-anonymous-user EF).';

-- Yalnız service_role. PUBLIC varsayılan EXECUTE'u da kapatılır (099/100 dersi).
REVOKE ALL ON FUNCTION public.merge_anonymous_user(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_anonymous_user(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_anonymous_user(uuid, uuid) TO service_role;
