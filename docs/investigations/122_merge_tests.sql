-- ============================================================================
-- 122 merge_anonymous_user — doğrulama testleri (Sprint 1 / 1b)
--
-- ÖN KOŞUL: migration 122 VE 123 `supabase db push` ile uygulanmış olmalı
--   (T3b/T3c/T3d 123 davranışını sınar; 122 canlıyken T3b FAIL verir).
--
-- ÇALIŞTIRMA: dosyanın tamamı tek seferde (psql ya da Supabase SQL Editor).
--   Sonuç: tek bir SELECT, her test için bir satır → (n, test, result).
--   result = 'PASS' ya da 'FAIL: <ayrıntı>'. RAISE NOTICE kullanılmaz.
--   Editor yalnız son ifadenin sonucunu gösterirse: BEGIN'den son SELECT'e
--   kadar seçip çalıştır, ardından ROLLBACK'i ayrıca çalıştır.
--
-- İZOLASYON (iki katman):
--   1. Her test `t122_isolated` içinde bir alt-transaction'da koşar ve sonunda
--      bilinçli bir istisnayla (SQLSTATE T1220) KENDİNİ GERİ ALIR; sonucu
--      istisna mesajında taşır. Testler birbirinin fixture'ını görmez.
--   2. Dosya BEGIN … ROLLBACK ile sarılıdır — geçici fonksiyonlar dahil hiçbir
--      şey kalıcı olmaz.
--
-- FIXTURE: kullanıcılar rastgele `auth_id` ('t122-' || gen_random_uuid()) ile
--   açılır; gerçek kullanıcılara dokunulmaz. Filmler mevcut `films`'ten
--   yalnız referans olarak okunur (FK RESTRICT — film satırına yazılmaz).
-- ============================================================================

BEGIN;

-- ─── Yardımcılar ────────────────────────────────────────────────────────────

CREATE FUNCTION pg_temp.t122_today() RETURNS date
LANGUAGE sql AS $$ SELECT (now() AT TIME ZONE 'UTC')::date $$;

CREATE FUNCTION pg_temp.t122_user() RETURNS uuid
LANGUAGE sql AS $$
  INSERT INTO public.users (auth_id) VALUES ('t122-' || gen_random_uuid()::text) RETURNING id
$$;

CREATE FUNCTION pg_temp.t122_films() RETURNS uuid[]
LANGUAGE sql AS $$
  SELECT array_agg(id) FROM (SELECT id FROM public.films ORDER BY id LIMIT 4) s
$$;

CREATE FUNCTION pg_temp.t122_gauntlet(p_user uuid, p_date date, p_cycle text DEFAULT 'current')
RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO public.daily_gauntlets
    (user_id, scope, date, film_ids, slot_types, algorithm_version, cycle)
  VALUES
    (p_user, 'personal', p_date, pg_temp.t122_films(),
     ARRAY['t122','t122','t122','t122'], 't122-test', p_cycle)
  RETURNING id
$$;

CREATE FUNCTION pg_temp.t122_event(p_user uuid, p_gauntlet uuid) RETURNS void
LANGUAGE sql AS $$
  INSERT INTO public.choice_events
    (user_id, gauntlet_id, session_id, round, film_a, film_b, winner, outcome, algorithm_version)
  SELECT p_user, p_gauntlet, gen_random_uuid(), 1, f[1], f[2], f[1], 'choice', 't122-test'
    FROM (SELECT pg_temp.t122_films() AS f) x
$$;

-- Satırı tamamlanmış yapar (champion_film_id dolu) — 123 testleri için.
CREATE FUNCTION pg_temp.t122_complete(p_gauntlet uuid) RETURNS void
LANGUAGE sql AS $$
  UPDATE public.daily_gauntlets
     SET champion_film_id = (pg_temp.t122_films())[1]
   WHERE id = p_gauntlet
$$;

CREATE FUNCTION pg_temp.t122_check(p_ok boolean, p_detail text) RETURNS text
LANGUAGE sql AS $$ SELECT CASE WHEN p_ok THEN 'PASS' ELSE 'FAIL: ' || p_detail END $$;

CREATE FUNCTION pg_temp.t122_user_exists(p_id uuid) RETURNS boolean
LANGUAGE sql AS $$ SELECT EXISTS (SELECT 1 FROM public.users WHERE id = p_id) $$;

-- Testi alt-transaction'da koşar, sonucunu döner, yaptığı her şeyi geri alır.
CREATE FUNCTION pg_temp.t122_isolated(p_fn text) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  BEGIN
    EXECUTE format('SELECT pg_temp.%I()', p_fn) INTO v;
    RAISE EXCEPTION USING ERRCODE = 'T1220', MESSAGE = COALESCE(v, 'FAIL: test NULL döndü');
  EXCEPTION
    WHEN SQLSTATE 'T1220' THEN RETURN SQLERRM;
    WHEN OTHERS THEN RETURN 'FAIL: beklenmeyen hata ' || SQLSTATE || ': ' || SQLERRM;
  END;
END $$;

-- ─── Testler ────────────────────────────────────────────────────────────────

-- T1: hedefin bugün satırı yok → gauntlet + olay taşınır, anonim users silinir.
CREATE FUNCTION pg_temp.t1() RETURNS text LANGUAGE plpgsql AS $$
DECLARE a uuid := pg_temp.t122_user(); b uuid := pg_temp.t122_user(); g uuid; r jsonb;
BEGIN
  g := pg_temp.t122_gauntlet(a, pg_temp.t122_today());
  PERFORM pg_temp.t122_event(a, g);
  r := public.merge_anonymous_user(a, b);
  RETURN pg_temp.t122_check(
    r->>'status' = 'merged'
    AND (r->>'events_moved')::int = 1
    AND (r->>'moved_gauntlet_id')::uuid = g
    AND NOT pg_temp.t122_user_exists(a)
    AND (SELECT user_id FROM public.daily_gauntlets WHERE id = g) = b
    AND (SELECT count(*) FROM public.choice_events WHERE gauntlet_id = g AND user_id = b) = 1,
    r::text);
END $$;

-- T2: hedefin bugün satırı VAR → hedef kazanır; anonim satır + olay CASCADE ile gider.
CREATE FUNCTION pg_temp.t2() RETURNS text LANGUAGE plpgsql AS $$
DECLARE a uuid := pg_temp.t122_user(); b uuid := pg_temp.t122_user(); ga uuid; gb uuid; r jsonb;
BEGIN
  ga := pg_temp.t122_gauntlet(a, pg_temp.t122_today());
  gb := pg_temp.t122_gauntlet(b, pg_temp.t122_today());
  PERFORM pg_temp.t122_event(a, ga);
  r := public.merge_anonymous_user(a, b);
  RETURN pg_temp.t122_check(
    r->>'status' = 'target_won'
    AND (r->>'dropped_gauntlet_id')::uuid = ga
    AND NOT EXISTS (SELECT 1 FROM public.daily_gauntlets WHERE id = ga)
    AND NOT EXISTS (SELECT 1 FROM public.choice_events WHERE gauntlet_id = ga)
    AND EXISTS (SELECT 1 FROM public.daily_gauntlets WHERE id = gb AND user_id = b)
    AND NOT pg_temp.t122_user_exists(a),
    r::text);
END $$;

-- T3 (= T6b): previous satırı (bugün-1), hedefin hiç kişisel satırı yok → taşınır.
CREATE FUNCTION pg_temp.t3() RETURNS text LANGUAGE plpgsql AS $$
DECLARE a uuid := pg_temp.t122_user(); b uuid := pg_temp.t122_user(); g uuid; r jsonb;
BEGIN
  g := pg_temp.t122_gauntlet(a, pg_temp.t122_today() - 1, 'previous');
  r := public.merge_anonymous_user(a, b);
  RETURN pg_temp.t122_check(
    r->>'status' = 'merged' AND r->>'moved_cycle' = 'previous'
    AND (SELECT user_id FROM public.daily_gauntlets WHERE id = g) = b,
    r::text);
END $$;

-- T3b (123 ile güncellendi): previous + TAMAMLANMIŞ + hedefin geçmişi var (10 gün
--      önce), tarih çakışması yok → merged; gauntlet, olay ve düzeltme taşınır.
CREATE FUNCTION pg_temp.t3b() RETURNS text LANGUAGE plpgsql AS $$
DECLARE a uuid := pg_temp.t122_user(); b uuid := pg_temp.t122_user(); ga uuid; gb uuid; r jsonb;
BEGIN
  ga := pg_temp.t122_gauntlet(a, pg_temp.t122_today() - 1, 'previous');
  PERFORM pg_temp.t122_complete(ga);
  PERFORM pg_temp.t122_event(a, ga);
  INSERT INTO public.context_corrections (user_id, gauntlet_id, predicted, corrected)
  VALUES (a, ga, '{}'::jsonb, '{}'::jsonb);
  gb := pg_temp.t122_gauntlet(b, pg_temp.t122_today() - 10);
  r := public.merge_anonymous_user(a, b);
  RETURN pg_temp.t122_check(
    r->>'status' = 'merged' AND r->>'moved_cycle' = 'previous'
    AND (r->>'events_moved')::int = 1
    AND (r->>'corrections_moved')::int = 1
    AND (SELECT user_id FROM public.daily_gauntlets WHERE id = ga) = b
    AND (SELECT count(*) FROM public.choice_events WHERE gauntlet_id = ga AND user_id = b) = 1
    AND (SELECT count(*) FROM public.context_corrections WHERE gauntlet_id = ga AND user_id = b) = 1
    AND EXISTS (SELECT 1 FROM public.daily_gauntlets WHERE id = gb AND user_id = b)
    AND NOT pg_temp.t122_user_exists(a),
    r::text);
END $$;

-- T3c (123): previous + TAMAMLANMAMIŞ + hedefin geçmişi var → target_won (TURUNCU 2 kalır).
CREATE FUNCTION pg_temp.t3c() RETURNS text LANGUAGE plpgsql AS $$
DECLARE a uuid := pg_temp.t122_user(); b uuid := pg_temp.t122_user(); ga uuid; gb uuid; r jsonb;
BEGIN
  ga := pg_temp.t122_gauntlet(a, pg_temp.t122_today() - 1, 'previous');
  gb := pg_temp.t122_gauntlet(b, pg_temp.t122_today() - 10);
  r := public.merge_anonymous_user(a, b);
  RETURN pg_temp.t122_check(
    r->>'status' = 'target_won'
    AND (r->>'dropped_gauntlet_id')::uuid = ga
    AND NOT EXISTS (SELECT 1 FROM public.daily_gauntlets WHERE id = ga)
    AND EXISTS (SELECT 1 FROM public.daily_gauntlets WHERE id = gb AND user_id = b)
    AND NOT pg_temp.t122_user_exists(a),
    r::text);
END $$;

-- T3d (123): TAMAMLANMIŞ previous + hedefte AYNI tarihte satır var → target_won.
CREATE FUNCTION pg_temp.t3d() RETURNS text LANGUAGE plpgsql AS $$
DECLARE a uuid := pg_temp.t122_user(); b uuid := pg_temp.t122_user(); ga uuid; gb uuid; r jsonb;
BEGIN
  ga := pg_temp.t122_gauntlet(a, pg_temp.t122_today() - 1, 'previous');
  PERFORM pg_temp.t122_complete(ga);
  PERFORM pg_temp.t122_event(a, ga);
  gb := pg_temp.t122_gauntlet(b, pg_temp.t122_today() - 1);
  r := public.merge_anonymous_user(a, b);
  RETURN pg_temp.t122_check(
    r->>'status' = 'target_won'
    AND (r->>'dropped_gauntlet_id')::uuid = ga
    AND NOT EXISTS (SELECT 1 FROM public.daily_gauntlets WHERE id = ga)
    AND NOT EXISTS (SELECT 1 FROM public.choice_events WHERE gauntlet_id = ga)
    AND EXISTS (SELECT 1 FROM public.daily_gauntlets WHERE id = gb AND user_id = b)
    AND NOT pg_temp.t122_user_exists(a),
    r::text);
END $$;

-- T3e (123, karar 3b): TAMAMLANMIŞ previous + hedefte YALNIZCA bugünkü satır var
--      (tarihler farklı, çakışma yok) → merged; hedefin bugünkü satırı engel değil.
CREATE FUNCTION pg_temp.t3e() RETURNS text LANGUAGE plpgsql AS $$
DECLARE a uuid := pg_temp.t122_user(); b uuid := pg_temp.t122_user(); ga uuid; gb uuid; r jsonb;
BEGIN
  ga := pg_temp.t122_gauntlet(a, pg_temp.t122_today() - 1, 'previous');
  PERFORM pg_temp.t122_complete(ga);
  PERFORM pg_temp.t122_event(a, ga);
  gb := pg_temp.t122_gauntlet(b, pg_temp.t122_today());
  r := public.merge_anonymous_user(a, b);
  RETURN pg_temp.t122_check(
    r->>'status' = 'merged' AND r->>'moved_cycle' = 'previous'
    AND (SELECT user_id FROM public.daily_gauntlets WHERE id = ga) = b
    AND (SELECT count(*) FROM public.choice_events WHERE gauntlet_id = ga AND user_id = b) = 1
    AND EXISTS (SELECT 1 FROM public.daily_gauntlets WHERE id = gb AND user_id = b)
    AND NOT pg_temp.t122_user_exists(a),
    r::text);
END $$;

-- T3f (123): TAMAMLANMIŞ current (bugün) + hedefin eski geçmişi var → merged.
CREATE FUNCTION pg_temp.t3f() RETURNS text LANGUAGE plpgsql AS $$
DECLARE a uuid := pg_temp.t122_user(); b uuid := pg_temp.t122_user(); ga uuid; gb uuid; r jsonb;
BEGIN
  ga := pg_temp.t122_gauntlet(a, pg_temp.t122_today());
  PERFORM pg_temp.t122_complete(ga);
  PERFORM pg_temp.t122_event(a, ga);
  gb := pg_temp.t122_gauntlet(b, pg_temp.t122_today() - 10);
  r := public.merge_anonymous_user(a, b);
  RETURN pg_temp.t122_check(
    r->>'status' = 'merged' AND r->>'moved_cycle' = 'current'
    AND (SELECT user_id FROM public.daily_gauntlets WHERE id = ga) = b
    AND EXISTS (SELECT 1 FROM public.daily_gauntlets WHERE id = gb AND user_id = b)
    AND NOT pg_temp.t122_user_exists(a),
    r::text);
END $$;

-- T3g (123, karar 3a): kaynakta TAMAMLANMIŞ previous (bugün-1) + bugünkü satır →
--      bugünkü taşınır, previous CASCADE ile düşer (v1 "tek satır" kapsamı).
CREATE FUNCTION pg_temp.t3g() RETURNS text LANGUAGE plpgsql AS $$
DECLARE a uuid := pg_temp.t122_user(); b uuid := pg_temp.t122_user();
        gp uuid; gt uuid; r jsonb;
BEGIN
  gp := pg_temp.t122_gauntlet(a, pg_temp.t122_today() - 1, 'previous');
  PERFORM pg_temp.t122_complete(gp);
  PERFORM pg_temp.t122_event(a, gp);
  gt := pg_temp.t122_gauntlet(a, pg_temp.t122_today());
  r := public.merge_anonymous_user(a, b);
  RETURN pg_temp.t122_check(
    r->>'status' = 'merged'
    AND (r->>'moved_gauntlet_id')::uuid = gt
    AND (SELECT user_id FROM public.daily_gauntlets WHERE id = gt) = b
    AND NOT EXISTS (SELECT 1 FROM public.daily_gauntlets WHERE id = gp)
    AND NOT EXISTS (SELECT 1 FROM public.choice_events WHERE gauntlet_id = gp)
    AND NOT pg_temp.t122_user_exists(a),
    r::text);
END $$;

-- T4a: anonimin gauntlet'i yok → nothing_to_move, anonim users yine silinir.
CREATE FUNCTION pg_temp.t4a() RETURNS text LANGUAGE plpgsql AS $$
DECLARE a uuid := pg_temp.t122_user(); b uuid := pg_temp.t122_user(); r jsonb;
BEGIN
  r := public.merge_anonymous_user(a, b);
  RETURN pg_temp.t122_check(
    r->>'status' = 'nothing_to_move' AND NOT pg_temp.t122_user_exists(a), r::text);
END $$;

-- T4b: idempotent — kaynak yok (önceki çağrı sildi) → already_merged.
CREATE FUNCTION pg_temp.t4b() RETURNS text LANGUAGE plpgsql AS $$
DECLARE b uuid := pg_temp.t122_user(); r jsonb;
BEGIN
  r := public.merge_anonymous_user(gen_random_uuid(), b);
  RETURN pg_temp.t122_check(r->>'status' = 'already_merged', r::text);
END $$;

-- T4c: p_from = p_to → SQLSTATE 22023.
CREATE FUNCTION pg_temp.t4c() RETURNS text LANGUAGE plpgsql AS $$
DECLARE b uuid := pg_temp.t122_user();
BEGIN
  BEGIN
    PERFORM public.merge_anonymous_user(b, b);
    RETURN 'FAIL: hata beklenirdi (22023), çağrı başarılı döndü';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    RETURN 'PASS';
  END;
END $$;

-- T4d: hedef yok → SQLSTATE P0002, kaynak SİLİNMEZ (transaction geri alınır).
CREATE FUNCTION pg_temp.t4d() RETURNS text LANGUAGE plpgsql AS $$
DECLARE a uuid := pg_temp.t122_user();
BEGIN
  BEGIN
    PERFORM public.merge_anonymous_user(a, gen_random_uuid());
    RETURN 'FAIL: hata beklenirdi (P0002), çağrı başarılı döndü';
  EXCEPTION WHEN SQLSTATE 'P0002' THEN
    RETURN pg_temp.t122_check(pg_temp.t122_user_exists(a), 'kaynak hata sonrası silinmiş');
  END;
END $$;

-- T5: taşınan gauntlet'in context_corrections satırı da taşınır.
CREATE FUNCTION pg_temp.t5() RETURNS text LANGUAGE plpgsql AS $$
DECLARE a uuid := pg_temp.t122_user(); b uuid := pg_temp.t122_user(); g uuid; r jsonb;
BEGIN
  g := pg_temp.t122_gauntlet(a, pg_temp.t122_today());
  INSERT INTO public.context_corrections (user_id, gauntlet_id, predicted, corrected)
  VALUES (a, g, '{}'::jsonb, '{}'::jsonb);
  r := public.merge_anonymous_user(a, b);
  RETURN pg_temp.t122_check(
    (r->>'corrections_moved')::int = 1
    AND (SELECT count(*) FROM public.context_corrections WHERE gauntlet_id = g AND user_id = b) = 1,
    r::text);
END $$;

-- T6a: UTC gün sınırı — 23:50 UTC'de üretilmiş current satır (dün tarihli),
--      00:10 UTC'de merge. now() sabitlenemediği için tarihle simüle edilir.
--      Aktif satır değil → nothing_to_move, satır CASCADE ile gider.
CREATE FUNCTION pg_temp.t6a() RETURNS text LANGUAGE plpgsql AS $$
DECLARE a uuid := pg_temp.t122_user(); b uuid := pg_temp.t122_user(); g uuid; r jsonb;
BEGIN
  g := pg_temp.t122_gauntlet(a, pg_temp.t122_today() - 1);
  PERFORM pg_temp.t122_event(a, g);
  r := public.merge_anonymous_user(a, b);
  RETURN pg_temp.t122_check(
    r->>'status' = 'nothing_to_move'
    AND NOT EXISTS (SELECT 1 FROM public.daily_gauntlets WHERE id = g)
    AND NOT EXISTS (SELECT 1 FROM public.choice_events WHERE gauntlet_id = g),
    r::text);
END $$;

-- T6c: UTC-batısı — Los Angeles 17:30 yerel = 00:30 UTC, previous anahtarı
--      bugün-2 → pencere içinde, taşınır (migration-guard KIRMIZI 1).
CREATE FUNCTION pg_temp.t6c() RETURNS text LANGUAGE plpgsql AS $$
DECLARE a uuid := pg_temp.t122_user(); b uuid := pg_temp.t122_user(); g uuid; r jsonb;
BEGIN
  g := pg_temp.t122_gauntlet(a, pg_temp.t122_today() - 2, 'previous');
  r := public.merge_anonymous_user(a, b);
  RETURN pg_temp.t122_check(
    r->>'status' = 'merged' AND r->>'moved_cycle' = 'previous'
    AND (SELECT user_id FROM public.daily_gauntlets WHERE id = g) = b,
    r::text);
END $$;

-- T6d: previous anahtarı bugün-3 → hiçbir dilimde aktif değil, pencere dışı.
CREATE FUNCTION pg_temp.t6d() RETURNS text LANGUAGE plpgsql AS $$
DECLARE a uuid := pg_temp.t122_user(); b uuid := pg_temp.t122_user(); g uuid; r jsonb;
BEGIN
  g := pg_temp.t122_gauntlet(a, pg_temp.t122_today() - 3, 'previous');
  r := public.merge_anonymous_user(a, b);
  RETURN pg_temp.t122_check(
    r->>'status' = 'nothing_to_move'
    AND NOT EXISTS (SELECT 1 FROM public.daily_gauntlets WHERE id = g),
    r::text);
END $$;

-- T7: yetki ve güvenlik özellikleri (salt okunur).
CREATE FUNCTION pg_temp.t7() RETURNS text LANGUAGE plpgsql AS $$
DECLARE fn regprocedure := 'public.merge_anonymous_user(uuid,uuid)'::regprocedure;
BEGIN
  RETURN pg_temp.t122_check(
    NOT has_function_privilege('anon', fn, 'EXECUTE')
    AND NOT has_function_privilege('authenticated', fn, 'EXECUTE')
    AND has_function_privilege('service_role', fn, 'EXECUTE')
    AND (SELECT NOT prosecdef FROM pg_proc WHERE oid = fn)
    AND (SELECT array_to_string(proconfig, ';') FROM pg_proc WHERE oid = fn)
        ~ '^search_path=public,\s*pg_temp$'
    AND pg_get_functiondef(fn) ~ 'pg_advisory_xact_lock',
    'grant/prosecdef/search_path/advisory lock beklenenden farklı');
END $$;

-- ─── Sonuç ──────────────────────────────────────────────────────────────────

SELECT t.n, t.test, pg_temp.t122_isolated(t.fn) AS result
  FROM (VALUES
    (1,  'T1  merged (bugün, hedef boş)',              't1'),
    (2,  'T2  target_won (ikisi de bugün)',            't2'),
    (3,  'T3  merged previous (= T6b, bugün-1)',       't3'),
    (4,  'T3b merged tamamlanmış previous + geçmiş',   't3b'),
    (5,  'T3c target_won tamamlanmamış previous',      't3c'),
    (6,  'T3d target_won tamamlanmış + aynı tarih',    't3d'),
    (7,  'T4a nothing_to_move',                        't4a'),
    (8,  'T4b already_merged (idempotent)',            't4b'),
    (9,  'T4c p_from = p_to → 22023',                  't4c'),
    (10, 'T4d hedef yok → P0002, kaynak korunur',      't4d'),
    (11, 'T5  context_corrections taşınır',            't5'),
    (12, 'T6a UTC sınırı: dünkü current taşınmaz',     't6a'),
    (13, 'T6c UTC-batısı previous bugün-2 taşınır',    't6c'),
    (14, 'T6d previous bugün-3 pencere dışı',          't6d'),
    (15, 'T7  grant / INVOKER / search_path / kilit',  't7'),
    (16, 'T3e merged tamamlanmış previous + hedefte yalnız bugün', 't3e'),
    (17, 'T3f merged tamamlanmış current + hedef geçmişi',         't3f'),
    (18, 'T3g bugünkü taşınır, tamamlanmış previous düşer',        't3g')
  ) AS t(n, test, fn)
 ORDER BY t.n;

ROLLBACK;
