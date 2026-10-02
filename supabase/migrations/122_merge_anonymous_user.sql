-- ============================================================================
-- 122 — merge_anonymous_user: anonim ilerlemeyi mevcut hesaba taşı (Sprint 1 / 1b)
--
-- SENARYO: Anonim kullanıcı Apple ile kaydolmak ister, Apple kimliği zaten
--   başka bir hesaba bağlı (GoTrue `identity_already_exists`). İstemci mevcut
--   hesaba `signInWithIdToken` ile girer ve `merge-anonymous-user` Edge
--   Function'ını çağırır. EF iki JWT'yi de `auth.getUser` ile doğrular, iki
--   `public.users.id`'yi çözer ve bu fonksiyonu service_role ile çağırır.
--
-- KAPSAM (v1, kilitli): yalnız aktif günün `daily_gauntlets` satırı, o
--   gauntlet'in `choice_events`'i ve `context_corrections`'ı taşınır
--   (DUR1 onayı, 2 Eki 2026). Watchlist ve diğer her şey v1 DIŞI.
--
-- NEDEN SECURITY INVOKER (DEFINER DEĞİL): Fonksiyon iki kullanıcıyı etkiler,
--   ama tek çağıran service_role'dür ve service_role RLS'i baştan atlar.
--   DEFINER hiçbir yetki KAZANDIRMAZ, yalnız ele geçirilirse yükseltme yüzeyi
--   açar (076/108 gerekçesi, 099/100 dersi). DUR1'de prompt'taki DEFINER
--   kararı bu gerekçeyle INVOKER'a çevrildi (2 Eki 2026).
--
-- KURAL — hedef kazanır: Hedefin bugün (UTC) kişisel gauntlet'i varsa ya da
--   taşınacak satırın tarihinde satırı varsa anonim satır TAŞINMAZ. Kaynak
--   satır `cycle='previous'` ise hedefin HERHANGİ bir kişisel satırı yeterlidir
--   (previous yalnız sıfır satırlı kullanıcıda oynanabilir — TURUNCU 2).
--
-- K-16 CASCADE: `public.users.auth_id` TEXT'tir, `auth.users`'a FK veya
--   trigger YOKTUR (canlı ölçüm, 2 Eki 2026). `admin.deleteUser` tek başına
--   anonim `public.users` satırını öksüz bırakırdı. Bu yüzden fonksiyon son
--   adımda anonim `public.users` satırını siler; taşınmayan her şey (kaybeden
--   gauntlet, eski günler, watchlist) mevcut ON DELETE CASCADE ile gider.
--   `auth.users` silmesi EF'te, bu transaction commit olduktan SONRA yapılır
--   (delete-account ile aynı sıra: önce public, sonra auth).
--
-- GÜN ANAHTARI: `(now() AT TIME ZONE 'UTC')::date` — generate-gauntlet'in
--   `utcDateString()`'i ile aynı. M2 Faz 2b gün anahtarını kullanıcı tz'sine
--   bağladığında bu fonksiyon da güncellenmeli (TEKNIK_BORC satırı).
--
-- E-21 (118): Sıfır satırlı yeni kullanıcı 18:00 öncesi `cycle='previous'`
--   satırı alır; tarihi önceki döngü anahtarıdır (bugün değil). Anonim kullanıcı
--   tam olarak bu profildir, yani "bugünün satırı" çoğu zaman previous satırdır.
--   Aktif satır: bugün tarihli satır, yoksa son 2 gün içindeki previous satır.
--   Neden 2: previous anahtarı kullanıcının YEREL gününe göre hesaplanır
--   (resolvePreviousCycle). UTC-h diliminde yerel [24-h, 18:00) aralığında UTC
--   günü dönmüştür ve anahtar bugün-2 olur (örn. Los Angeles 17:30 yerel =
--   00:30 UTC → anahtar UTC bugününden 2 gün geride). UTC+14 en fazla bugün
--   anahtarı üretir. 1 günlük pencere bu satırı kaçırıp CASCADE ile silerdi
--   (migration-guard KIRMIZI 1, 2 Eki 2026).
--   Tek satır taşınır.
--
-- EŞZAMANLILIK: İki kullanıcı id'si üzerinde sabit sıralı
--   `pg_advisory_xact_lock` — çift çağrı serileşir, ikincisi `already_merged`
--   döner. Hedefe aynı anda generate-gauntlet bugünün satırını yazarsa
--   UPDATE 23505 ile düşer, transaction geri alınır, EF Sentry'ye yazar ve
--   auth kullanıcısını SİLMEZ.
--
-- GERİ ALMA:
--   DROP FUNCTION IF EXISTS public.merge_anonymous_user(uuid, uuid);
--   (Taşınmış veri geri alınamaz — anonim public.users satırı silinmiştir.)
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
  -- Anahtar ad alanlı hash: başka bir advisory kilit kullanıcısıyla çakışma
  -- en kötü ihtimalle gereksiz serileşmedir, yanlış sonuç değil.
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

  -- Aktif satır: bugün tarihli > son 2 gün içindeki previous (bkz. başlık).
  SELECT id, date, cycle
    INTO v_src
    FROM daily_gauntlets
   WHERE user_id = p_from
     AND scope = 'personal'
     AND (date = v_today OR (cycle = 'previous' AND date >= v_today - 2))
   ORDER BY (date = v_today) DESC, date DESC
   LIMIT 1
   FOR UPDATE;

  IF FOUND THEN
    -- previous satırı yalnız SIFIR kişisel satırlı hedefte oynanabilir:
    -- normal akış bugünün tarihine bakar, previous akışı satırı olan
    -- kullanıcıya PREVIOUS_CYCLE_NOT_ELIGIBLE döner (previousCycle.ts).
    -- Geçmişi olan hedefe taşınsa erişilemez olurdu → hedef kazanır
    -- (migration-guard TURUNCU 2, DUR2 onayı 2 Eki 2026).
    SELECT EXISTS (
      SELECT 1 FROM daily_gauntlets
       WHERE user_id = p_to
         AND scope = 'personal'
         AND (v_src.cycle = 'previous' OR date IN (v_today, v_src.date))
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
  'Sprint 1 / 1b: anonim kullanıcının aktif gauntlet''ini + choice_events / context_corrections''ını '
  'mevcut hesaba taşır (hedef bugün oynadıysa hedef kazanır), sonra anonim '
  'public.users satırını siler (K-16 cascade). Yalnız service_role çağırır '
  '(merge-anonymous-user EF).';

-- Yalnız service_role. PUBLIC varsayılan EXECUTE'u da kapatılır (099/100 dersi).
REVOKE ALL ON FUNCTION public.merge_anonymous_user(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_anonymous_user(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_anonymous_user(uuid, uuid) TO service_role;
