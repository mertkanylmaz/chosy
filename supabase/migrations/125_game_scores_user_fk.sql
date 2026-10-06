-- ============================================================================
-- 125 — game_scores.user_id → public.users(id) FK, ON DELETE CASCADE (K-16)
--
-- Keşif: docs/investigations/K16_GAME_SCORES_SILME_KESIF.md
-- Borç:  docs/TEKNIK_BORC.md "game_scores — 9 sahipsiz satır" (7 Ağu 2026)
--
-- SORUN:
--   016 `game_scores.user_id`'yi FK'siz tanımladı (016:19). Hesap silme FK
--   CASCADE'e dayanıyor: delete-account `public.users` satırını siler
--   (delete-account/index.ts:294), merge_anonymous_user anonim kaynağı siler
--   (122:151; canlı tanım 123:135). İki yol da game_scores satırlarını yetim
--   bırakıyor.
--   Canlı ölçüm (4 Eki 2026): 18 satırın 17'si yetim, 6 kullanıcı; 17'sinin
--   user_id'si ne public.users'ta ne auth.users'ta var.
--
-- KİMLİK UZAYI: game_scores.user_id = public.users.id (app uzayı).
--   Tek yazıcı submit-guess: resolveAppUser → users.id (_shared/gameUtils.ts:100-113,
--   submit-guess/index.ts:212-216, INSERT :292). RLS `user_id = app_user_id()` (070).
--   DB'de game_scores'a yazan fonksiyon/trigger yok (canlı pg_proc/pg_trigger, 4 Eki).
--
-- KARAR (CTO, K-16): yetimler silinir; merge'de anonim kullanıcının skorları
--   bundan sonra CASCADE ile SİLİNİR (taşınmaz — 122 v1 kapsamı kilitli).
--   chosy-conventions §6 ("ham olay silinmez") notu: satırlar silinmiş
--   kullanıcılara ait; hesap silme taahhüdü önce gelir.
--
-- SIRA: tek dosya, tek transaction (supabase db push dosyayı atomik uygular).
--   1. Kilit: game_scores SHARE ROW EXCLUSIVE — DELETE ile FK doğrulaması
--      arasında eşzamanlı INSERT yeni yetim üretemesin. Kilit DO bloğunun
--      İÇİNDE: CLI dosyayı örtük tek transaction'da gönderir; en üst seviyede
--      LOCK TABLE "transaction block" kontrolüne takılabilir (migration-guard
--      TURUNCU 2). lock_timeout 5s transaction-yerel (set_config ..., true):
--      ADD CONSTRAINT public.users'ı da SHARE ROW EXCLUSIVE kilitler; uzun bir
--      users transaction'ı varsa 55P03 ile her şey geri alınır, sakin saatte
--      yeniden denenir (TURUNCU 3).
--      LOCK NOTU: db push ifadeleri ayrı ayrı (otomatik commit) çalıştırırsa
--      kilit DO bloğunun sonunda düşer. O durumda DELETE ile ADD CONSTRAINT
--      arasında yeni yetim oluşursa ADD CONSTRAINT doğrulaması onu görür ve
--      23503 ile GÜVENLE hata verir — FK yarım kurulmaz; yeniden ölç, tekrar push.
--   2. Ön guard: yetim sayısı NOTICE; > 30 → ABORT. Beklenen ~17 (4 Eki 2026);
--      test hesabı sildikçe artar — push öncesi YENİDEN ÖLÇ. Yetimlerden
--      herhangi biri auth.users'ta varsa → ABORT (kimlik uzayı karışması,
--      silinmez).
--   3. DELETE yetimler.
--   4. ADD CONSTRAINT ... ON DELETE CASCADE (doğrulamalı, NOT VALID değil).
--   5. Post guard: yetim = 0, kısıt var ve confdeltype = 'c'.
--   Fonksiyon değişikliği YOK.
--
-- 23503 MARUZİYETİ (FK sonrası):
--   submit-guess INSERT (:292) — resolveAppUser ile INSERT arasında kullanıcı
--   silinirse (eşzamanlı delete-account / merge). createError → logError +
--   Sentry + 500 SCORE_CREATE_FAILED (:322-328). Sessiz değil; bugün aynı
--   durum yetim satır üretiyordu.
--   UPDATE'ler `.eq('id', ...)` ile user_id'ye dokunmuyor → etkilenmez.
--   services/gameService.ts:612 istemci upsert'i ölü kod (submitGameScore
--   hiçbir yerden çağrılmıyor).
--
-- İNDEKS: idx_game_scores_user (016:29) canlıda var → CASCADE silmesi indeksli.
--
-- YEDEK: ham satır dökümü ALINMADI — migration-guard KIRMIZI 1'e bilinçli
--   istisna (CTO, 4 Eki 2026; TEKNIK_BORC). Gerekçe: FK sonrası yetim satır
--   geri yüklenemez (sahibi yok), silinmiş hesabın verisi tutulmaz.
--
-- GERİ ALMA:
--   ALTER TABLE game_scores DROP CONSTRAINT game_scores_user_id_fkey;
--   (Silinen 17 yetim satır geri gelmez.)
-- ============================================================================

-- ── Kilit + ön guard ─────────────────────────────────────────────────────────
DO $$
DECLARE
  v_orphans    integer;
  v_users      integer;
  v_auth_space integer;
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);  -- transaction-yerel
  LOCK TABLE public.game_scores IN SHARE ROW EXCLUSIVE MODE;

  SELECT count(*), count(DISTINCT gs.user_id)
    INTO v_orphans, v_users
  FROM public.game_scores gs
  WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = gs.user_id);

  SELECT count(*) INTO v_auth_space
  FROM public.game_scores gs
  WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = gs.user_id)
    AND EXISTS (SELECT 1 FROM auth.users au WHERE au.id = gs.user_id);

  RAISE NOTICE '125: yetim game_scores satiri = % (% kullanici)', v_orphans, v_users;

  IF v_auth_space > 0 THEN
    RAISE EXCEPTION
      '125: % yetim satirin user_id''si auth.users''ta var — kimlik uzayi karismasi, silme yapilmadi', v_auth_space;
  END IF;

  IF v_orphans > 30 THEN
    RAISE EXCEPTION
      '125: yetim sayisi % > 30 — beklenen ~17 (4 Eki 2026). Durduruldu, yeniden olc.', v_orphans;
  END IF;
END $$;

-- ── Yetimleri sil ───────────────────────────────────────────────────────────
DELETE FROM public.game_scores gs
WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = gs.user_id);

-- ── FK ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.game_scores
  ADD CONSTRAINT game_scores_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ── Post guard ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_orphans integer;
  v_deltype "char";
BEGIN
  SELECT count(*) INTO v_orphans
  FROM public.game_scores gs
  WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = gs.user_id);

  IF v_orphans <> 0 THEN
    RAISE EXCEPTION '125: FK sonrasi hala % yetim satir var', v_orphans;
  END IF;

  SELECT c.confdeltype INTO v_deltype
  FROM pg_constraint c
  WHERE c.conrelid = 'public.game_scores'::regclass
    AND c.conname = 'game_scores_user_id_fkey'
    AND c.contype = 'f'
    AND c.confrelid = 'public.users'::regclass;

  IF v_deltype IS NULL THEN
    RAISE EXCEPTION '125: game_scores_user_id_fkey olusmadi';
  END IF;

  IF v_deltype <> 'c' THEN
    RAISE EXCEPTION '125: game_scores_user_id_fkey ON DELETE CASCADE degil (confdeltype=%)', v_deltype;
  END IF;

  RAISE NOTICE '125: FK kuruldu (ON DELETE CASCADE), yetim = 0';
END $$;
