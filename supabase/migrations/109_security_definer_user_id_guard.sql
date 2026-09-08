-- ============================================================================
-- 109 — SECURITY DEFINER fonksiyonlarda p_user_id kimlik doğrulama guard'ı
--
-- SORUN (canlı açık):
--   public şemasındaki SECURITY DEFINER fonksiyonların çoğu `p_user_id`
--   parametresini çağıranın gerçek kimliğine karşı HİÇ doğrulamıyordu.
--   SECURITY DEFINER RLS'i bypass ettiği için, anon EXECUTE yetkisi olan bu
--   fonksiyonlara kimlik doğrulaması olmayan herhangi bir istemci rastgele bir
--   p_user_id vererek BAŞKA kullanıcıların verisini okuyabiliyor/değiştirebiliyordu.
--   claim_lifetime_spot'ta bu doğrudan finansal istismar demekti (1000 kişilik
--   lifetime kontenjanı bedava talep edilebiliyordu).
--
-- İKİ AYRI TEDAVİ — neden tek bir pattern yetmiyor:
--   Fonksiyonların bir kısmı yalnızca Edge Function'lardan service_role ile
--   çağrılıyor. service_role'de `auth.uid()` NULL'dır, dolayısıyla körlemesine
--   eklenen bir guard bu yolları FORBIDDEN'a düşürüp üretimi kırardı.
--   Bu yüzden çağıran haritası çıkarıldı ve iki tedavi uygulandı:
--
--   (A) REVOKE  — yalnızca service_role'den çağrılanlar. İstemcinin bu
--       fonksiyonlara EXECUTE yetkisi hiç olmamalıydı; yetki yüzeyini
--       tamamen kaldırmak guard'dan daha güçlü bir kapatmadır.
--   (B) GUARD   — istemciden çağrılanlar. Hem istemciden hem service_role'den
--       çağrılan iki fonksiyonda (claim_lifetime_spot, apply_invite_code)
--       guard bir service_role baypası ile birlikte gelir.
--
-- `IS DISTINCT FROM` — `!=` DEĞİL:
--   auth_user_id(), eşleşen public.users satırı olmayan çağıran için (oturumsuz
--   veya orphan auth) NULL döner. `p_user_id != NULL` → NULL → IF bloğu HİÇ
--   çalışmaz, yani guard tam olarak hedeflediği kimliksiz saldırgan için
--   sessizce baypas edilirdi. Aynı tuzak migration 100'de (get_watchlist_grouped)
--   yaşandı ve orada da `IS DISTINCT FROM` ile çözüldü.
--
-- REVOKE dahili çağrı zincirlerini KIRMAZ:
--   grant_bonus_searches, istemci-çağrılı grant_streak_rewards içinden PERFORM
--   ile; claim_lifetime_spot ise activate_referral içinden SELECT ile çağrılıyor.
--   Çağıran fonksiyonlar SECURITY DEFINER ve sahipleri `postgres` olduğu için bu
--   iç çağrılar postgres yetkisiyle koşar. REVOKE yalnızca doğrudan PostgREST
--   çağrısını keser.
--
-- KAPSAM DIŞI:
--   get_watchlist_grouped — guard'ı zaten migration 100'de eklendi, dokunulmadı.
--   record_posterle_hint  — p_attempt_id sahipliğini doğrulamıyor (ayrı bulgu,
--                           ayrı iş kalemi olarak açılacak).
--   Hedef-kullanıcı parametresi taşımayan 11 SECURITY DEFINER fonksiyon.
--
-- Fonksiyon gövdeleri, guard bloğu dışında BİREBİR korunmuştur. Tek istisna
-- tonight_pick: LANGUAGE sql olduğu için IF/RAISE kullanamıyordu, davranışı
-- aynı kalacak şekilde plpgsql'e (RETURN QUERY) çevrildi.
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- (A) REVOKE — yalnızca service_role'den çağrılan 6 fonksiyon
-- ════════════════════════════════════════════════════════════════════════════

-- check-quota, parse-mood, parse-taste, slot-mood-filtered,
-- slot-pure-random, slot-triple — hepsi admin/service_role
REVOKE EXECUTE ON FUNCTION public.check_and_consume_quota(uuid, text)
  FROM anon, authenticated;

-- check-quota/index.ts:133 (supabaseAdmin)
REVOKE EXECUTE ON FUNCTION public.check_and_consume_game_quota(uuid, text)
  FROM anon, authenticated;

-- winback-sequencer/index.ts:135 (service) + grant_streak_rewards içinden PERFORM
REVOKE EXECUTE ON FUNCTION public.grant_bonus_searches(uuid, integer, text)
  FROM anon, authenticated;

-- send-daily-pick/index.ts:223, schedule-notifications/index.ts:163 (service)
REVOKE EXECUTE ON FUNCTION public.user_notification_count_24h(uuid)
  FROM anon, authenticated;

-- submit-posterle/index.ts:254 (service)
REVOKE EXECUTE ON FUNCTION public.update_posterle_streak(uuid, boolean, date, text)
  FROM anon, authenticated;

-- process-referral/index.ts:125 (service) — BAŞKA bir kullanıcının referee_id'si
-- ile çağrılıyor; buraya guard eklemek semantiği bozardı, doğru tedavi REVOKE.
REVOKE EXECUTE ON FUNCTION public.activate_referral(uuid)
  FROM anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- (B) GUARD — istemciden çağrılan 14 fonksiyon
-- ════════════════════════════════════════════════════════════════════════════

-- ── apply_posterle_freeze ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_posterle_freeze(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_streak posterle_streaks;
BEGIN
  IF p_user_id IS DISTINCT FROM auth_user_id() THEN
    RAISE EXCEPTION 'FORBIDDEN: kullanıcı kimliği eşleşmiyor'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_streak
  FROM posterle_streaks
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_streak.freeze_tokens <= 0 THEN
    RETURN FALSE;
  END IF;

  IF v_streak.last_played_date = CURRENT_DATE THEN
    RETURN FALSE;
  END IF;

  UPDATE posterle_streaks
  SET
    freeze_tokens = freeze_tokens - 1,
    last_played_date = CURRENT_DATE,
    last_freeze_used_at = NOW()
  WHERE user_id = p_user_id;

  RETURN TRUE;
END;
$function$;


-- ── check_milestones ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_milestones(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_swipes   INTEGER;
  v_total_watchlist INTEGER;
  v_total_moods    INTEGER;
  v_milestone      RECORD;
  v_new_ms         JSONB := '[]'::JSONB;
  v_count          INTEGER;
BEGIN
  IF p_user_id IS DISTINCT FROM auth_user_id() THEN
    RAISE EXCEPTION 'FORBIDDEN: kullanıcı kimliği eşleşmiyor'
      USING ERRCODE = '42501';
  END IF;

  -- Toplam swipe sayısı (sessions üzerinden)
  SELECT COUNT(*) INTO v_total_swipes
  FROM swipes sw
  JOIN sessions s ON s.id = sw.session_id
  WHERE s.user_id = p_user_id;

  -- Toplam watchlist sayısı
  SELECT COUNT(*) INTO v_total_watchlist
  FROM watchlist
  WHERE user_id = p_user_id;

  -- Toplam mood session sayısı
  SELECT COUNT(*) INTO v_total_moods
  FROM sessions
  WHERE user_id = p_user_id;

  -- Her kategori için threshold kontrolü
  FOR v_milestone IN
    SELECT m.id, m.slug, m.title, m.icon, m.category, m.threshold
    FROM milestones m
    WHERE NOT EXISTS (
      SELECT 1 FROM user_milestones um
      WHERE um.user_id = p_user_id AND um.milestone_id = m.id
    )
    AND m.category IN ('films', 'watchlist', 'mood')
  LOOP
    -- Kategoriye göre doğru sayacı seç
    CASE v_milestone.category
      WHEN 'films' THEN v_count := v_total_swipes;
      WHEN 'watchlist' THEN v_count := v_total_watchlist;
      WHEN 'mood' THEN v_count := v_total_moods;
      ELSE v_count := 0;
    END CASE;

    IF v_count >= v_milestone.threshold THEN
      INSERT INTO user_milestones (user_id, milestone_id)
      VALUES (p_user_id, v_milestone.id)
      ON CONFLICT (user_id, milestone_id) DO NOTHING;

      v_new_ms := v_new_ms || jsonb_build_object(
        'slug', v_milestone.slug,
        'title', v_milestone.title,
        'icon', v_milestone.icon
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'total_swipes', v_total_swipes,
    'total_watchlist', v_total_watchlist,
    'total_moods', v_total_moods,
    'new_milestones', v_new_ms
  );
END;
$function$;


-- ── get_mood_timeline ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_mood_timeline(p_user_id uuid, p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_items JSONB;
BEGIN
  IF p_user_id IS DISTINCT FROM auth_user_id() THEN
    RAISE EXCEPTION 'FORBIDDEN: kullanıcı kimliği eşleşmiyor'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(item ORDER BY item->>'created_at' DESC), '[]'::JSONB)
  INTO v_items
  FROM (
    SELECT jsonb_build_object(
      'session_id',  s.id,
      'mood_text',   s.raw_input,
      'profile',     s.parsed_profile_json,
      'created_at',  s.created_at,
      'swipe_count', (
        SELECT COUNT(*) FROM swipes sw WHERE sw.session_id = s.id
      ),
      'save_count', (
        SELECT COUNT(*) FROM swipes sw WHERE sw.session_id = s.id AND sw.direction = 'right'
      )
    ) AS item
    FROM sessions s
    WHERE s.user_id = p_user_id
    ORDER BY s.created_at DESC
    LIMIT p_limit
  ) sub;

  RETURN v_items;
END;
$function$;


-- ── get_quota_status ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_quota_status(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_tier TEXT;
  v_today DATE := CURRENT_DATE;
  v_quota_row user_daily_quotas%ROWTYPE;
  v_limits subscription_limits%ROWTYPE;
BEGIN
  IF p_user_id IS DISTINCT FROM auth_user_id() THEN
    RAISE EXCEPTION 'FORBIDDEN: kullanıcı kimliği eşleşmiyor'
      USING ERRCODE = '42501';
  END IF;

  SELECT subscription_tier INTO v_tier FROM users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'USER_NOT_FOUND');
  END IF;

  SELECT * INTO v_limits FROM subscription_limits WHERE tier = v_tier;

  -- Get or create today's row
  INSERT INTO user_daily_quotas (user_id, date)
    VALUES (p_user_id, v_today)
    ON CONFLICT (user_id, date) DO NOTHING;

  SELECT * INTO v_quota_row
    FROM user_daily_quotas
    WHERE user_id = p_user_id AND date = v_today;

  RETURN jsonb_build_object(
    'tier', v_tier,
    'searches', jsonb_build_object(
      'used', v_quota_row.searches_used,
      'limit', v_limits.daily_search_limit,
      'bonus_available', GREATEST(0, v_quota_row.bonus_searches_earned - v_quota_row.bonus_searches_used)
    ),
    'refines', jsonb_build_object(
      'used', v_quota_row.refines_used,
      'limit', v_limits.daily_refine_limit
    ),
    'slots', jsonb_build_object(
      'used', v_quota_row.slot_spins_used,
      'limit', v_limits.daily_slot_limit
    ),
    'games', jsonb_build_object(
      'played', v_quota_row.games_played,
      'limit_per_game', v_limits.daily_game_limit_per_game
    ),
    'reset_at', (v_today + INTERVAL '1 day')::timestamptz
  );
END
$function$;


-- ── get_referral_stats ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_referral_stats(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_total INT;
  v_activated INT;
  v_pending INT;
  v_invite_code TEXT;
  v_rewards JSONB;
  v_next_milestone INT;
  v_next_reward TEXT;
BEGIN
  IF p_user_id IS DISTINCT FROM auth_user_id() THEN
    RAISE EXCEPTION 'FORBIDDEN: kullanıcı kimliği eşleşmiyor'
      USING ERRCODE = '42501';
  END IF;

  -- Counts
  SELECT COUNT(*) INTO v_total
  FROM referrals WHERE referrer_id = p_user_id;

  SELECT COUNT(*) INTO v_activated
  FROM referrals WHERE referrer_id = p_user_id AND status IN ('activated', 'rewarded');

  SELECT COUNT(*) INTO v_pending
  FROM referrals WHERE referrer_id = p_user_id AND status = 'pending';

  -- User's invite code
  SELECT invite_code INTO v_invite_code FROM users WHERE id = p_user_id;

  -- Earned rewards
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'type', reward_type,
    'count', referral_count,
    'granted_at', granted_at
  )), '[]'::jsonb) INTO v_rewards
  FROM referral_rewards WHERE user_id = p_user_id;

  -- Next milestone calculation
  IF v_activated < 1 THEN
    v_next_milestone := 1;
    v_next_reward := 'free_month';
  ELSIF v_activated < 3 THEN
    v_next_milestone := 3;
    v_next_reward := 'slot_tokens';
  ELSIF v_activated < 5 THEN
    v_next_milestone := 5;
    v_next_reward := 'lifetime_upgrade';
  ELSIF v_activated < 10 THEN
    v_next_milestone := 10;
    v_next_reward := 'ambassador_badge';
  ELSE
    v_next_milestone := NULL;
    v_next_reward := NULL;
  END IF;

  RETURN jsonb_build_object(
    'invite_code', v_invite_code,
    'total_referrals', v_total,
    'activated_referrals', v_activated,
    'pending_referrals', v_pending,
    'rewards', v_rewards,
    'next_milestone', v_next_milestone,
    'next_reward', v_next_reward,
    'progress', CASE
      WHEN v_next_milestone IS NOT NULL
        THEN ROUND((v_activated::DECIMAL / v_next_milestone) * 100, 1)
      ELSE 100
    END
  );
END
$function$;


-- ── get_swipe_history ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_swipe_history(p_user_id uuid, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0, p_direction text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_items JSONB;
  v_total INTEGER;
BEGIN
  IF p_user_id IS DISTINCT FROM auth_user_id() THEN
    RAISE EXCEPTION 'FORBIDDEN: kullanıcı kimliği eşleşmiyor'
      USING ERRCODE = '42501';
  END IF;

  -- Toplam kayıt sayısı (sayfalama için)
  SELECT COUNT(*) INTO v_total
  FROM swipes sw
  JOIN sessions s ON s.id = sw.session_id
  WHERE s.user_id = p_user_id
    AND (p_direction IS NULL OR sw.direction = p_direction);

  -- Sayfalanmış sonuçlar
  SELECT COALESCE(jsonb_agg(item ORDER BY item->>'swiped_at' DESC), '[]'::JSONB)
  INTO v_items
  FROM (
    SELECT jsonb_build_object(
      'swipe_id',    sw.id,
      'film_id',     f.id,
      'title',       f.title,
      'year',        f.year,
      'poster_url',  f.poster_url,
      'vote_average',f.vote_average,
      'genres',      f.genres,
      'direction',   sw.direction,
      'swiped_at',   sw.timestamp,
      'mood_text',   s.raw_input
    ) AS item
    FROM swipes sw
    JOIN sessions s ON s.id = sw.session_id
    JOIN films f ON f.id = sw.film_id
    WHERE s.user_id = p_user_id
      AND (p_direction IS NULL OR sw.direction = p_direction)
    ORDER BY sw.timestamp DESC
    LIMIT p_limit
    OFFSET p_offset
  ) sub;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'limit', p_limit,
    'offset', p_offset
  );
END;
$function$;


-- ── get_user_stats ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_stats(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_swipes     INTEGER;
  v_right_swipes     INTEGER;
  v_left_swipes      INTEGER;
  v_total_watchlist  INTEGER;
  v_total_sessions   INTEGER;
  v_genre_counts     JSONB;
  v_first_swipe      TIMESTAMPTZ;
  v_streak           RECORD;
BEGIN
  IF p_user_id IS DISTINCT FROM auth_user_id() THEN
    RAISE EXCEPTION 'FORBIDDEN: kullanıcı kimliği eşleşmiyor'
      USING ERRCODE = '42501';
  END IF;

  -- Swipe sayıları
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE sw.direction = 'right'),
    COUNT(*) FILTER (WHERE sw.direction = 'left'),
    MIN(sw.timestamp)
  INTO v_total_swipes, v_right_swipes, v_left_swipes, v_first_swipe
  FROM swipes sw
  JOIN sessions s ON s.id = sw.session_id
  WHERE s.user_id = p_user_id;

  -- Watchlist boyutu
  SELECT COUNT(*) INTO v_total_watchlist
  FROM watchlist WHERE user_id = p_user_id;

  -- Toplam mood session
  SELECT COUNT(*) INTO v_total_sessions
  FROM sessions WHERE user_id = p_user_id;

  -- Tür dağılımı (sağa kaydırılan filmlerden)
  SELECT COALESCE(jsonb_object_agg(genre, cnt), '{}'::JSONB)
  INTO v_genre_counts
  FROM (
    SELECT unnest(f.genres) AS genre, COUNT(*) AS cnt
    FROM swipes sw
    JOIN sessions s ON s.id = sw.session_id
    JOIN films f ON f.id = sw.film_id
    WHERE s.user_id = p_user_id
      AND sw.direction = 'right'
      AND f.genres IS NOT NULL
    GROUP BY genre
    ORDER BY cnt DESC
    LIMIT 10
  ) sub;

  -- Streak bilgisi
  SELECT current_streak, longest_streak, total_active_days, last_active_date
  INTO v_streak
  FROM user_streaks
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'total_swipes',       v_total_swipes,
    'right_swipes',       v_right_swipes,
    'left_swipes',        v_left_swipes,
    'save_rate',          CASE WHEN v_total_swipes > 0
                            THEN ROUND((v_right_swipes::NUMERIC / v_total_swipes) * 100, 1)
                            ELSE 0
                          END,
    'total_watchlist',    v_total_watchlist,
    'total_sessions',     v_total_sessions,
    'first_swipe_at',     v_first_swipe,
    'top_genres',         v_genre_counts,
    'current_streak',     COALESCE(v_streak.current_streak, 0),
    'longest_streak',     COALESCE(v_streak.longest_streak, 0),
    'total_active_days',  COALESCE(v_streak.total_active_days, 0),
    'last_active_date',   v_streak.last_active_date
  );
END;
$function$;


-- ── grant_streak_rewards ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.grant_streak_rewards(p_user_id uuid, p_streak_days integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_reward RECORD;
  v_granted JSONB := '{"bonus_searches": 0, "slot_tokens": 0, "special_reward": null}'::jsonb;
BEGIN
  IF p_user_id IS DISTINCT FROM auth_user_id() THEN
    RAISE EXCEPTION 'FORBIDDEN: kullanıcı kimliği eşleşmiyor'
      USING ERRCODE = '42501';
  END IF;

  -- Tam eşleşen streak reward var mı?
  SELECT * INTO v_reward
    FROM streak_rewards
    WHERE streak_days = p_streak_days;

  IF NOT FOUND THEN
    RETURN v_granted;
  END IF;

  -- Bonus searches
  IF v_reward.bonus_searches > 0 THEN
    PERFORM grant_bonus_searches(
      p_user_id,
      v_reward.bonus_searches,
      'streak_' || p_streak_days || '_day'
    );
  END IF;

  -- Notification queue for reward
  INSERT INTO notification_log (user_id, type, title, body, data, status, scheduled_for)
  VALUES (
    p_user_id,
    'streak_reward',
    'Streak Reward!',
    p_streak_days || '-day streak bonus: +' || v_reward.bonus_searches || ' searches',
    jsonb_build_object(
      'streak_days', p_streak_days,
      'bonus_searches', v_reward.bonus_searches,
      'slot_tokens', v_reward.slot_tokens,
      'special_reward', v_reward.special_reward
    ),
    'queued',
    NOW()
  );

  v_granted := jsonb_build_object(
    'bonus_searches', v_reward.bonus_searches,
    'slot_tokens', v_reward.slot_tokens,
    'special_reward', v_reward.special_reward
  );

  RETURN v_granted;
END;
$function$;


-- ── is_founding_member ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_founding_member(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_sale lifetime_sales%ROWTYPE;
BEGIN
  IF p_user_id IS DISTINCT FROM auth_user_id() THEN
    RAISE EXCEPTION 'FORBIDDEN: kullanıcı kimliği eşleşmiyor'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_sale FROM lifetime_sales WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('is_member', false);
  END IF;

  RETURN jsonb_build_object(
    'is_member', true,
    'sale_number', v_sale.sale_number,
    'purchased_at', v_sale.purchased_at
  );
END
$function$;


-- ── save_push_token ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.save_push_token(p_user_id uuid, p_push_token text, p_timezone text DEFAULT 'UTC'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_user_id IS DISTINCT FROM auth_user_id() THEN
    RAISE EXCEPTION 'FORBIDDEN: kullanıcı kimliği eşleşmiyor'
      USING ERRCODE = '42501';
  END IF;

  UPDATE users SET
    push_token = p_push_token,
    timezone = COALESCE(p_timezone, 'UTC'),
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$function$;


-- ── toggle_push_notifications ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.toggle_push_notifications(p_user_id uuid, p_enabled boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_user_id IS DISTINCT FROM auth_user_id() THEN
    RAISE EXCEPTION 'FORBIDDEN: kullanıcı kimliği eşleşmiyor'
      USING ERRCODE = '42501';
  END IF;

  UPDATE users SET
    push_enabled = p_enabled,
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$function$;


-- ── tonight_pick ────────────────────────────────────────────────────────────
-- LANGUAGE sql idi; IF/RAISE kullanabilmek için plpgsql'e çevrildi.
-- Dönüş tipi, STABLE volatilitesi, search_path ve sorgu birebir korundu.
CREATE OR REPLACE FUNCTION public.tonight_pick(p_user_id uuid)
 RETURNS TABLE(id uuid, tmdb_id integer, title text, year integer, poster_url text, backdrop_url text, overview text, genres text[], runtime integer, vote_average double precision, director text, similarity double precision)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_user_id IS DISTINCT FROM auth_user_id() THEN
    RAISE EXCEPTION 'FORBIDDEN: kullanıcı kimliği eşleşmiyor'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    f.id, f.tmdb_id, f.title, f.year, f.poster_url, f.backdrop_url,
    f.overview, f.genres, f.runtime, f.vote_average, f.director,
    1 - (fp.profile_vector <=> u.preferences_vector) AS similarity
  FROM users u
  JOIN film_profiles fp ON true
  JOIN films f ON f.id = fp.film_id
  WHERE u.id = p_user_id
    AND u.preferences_vector IS NOT NULL
    AND f.id NOT IN (SELECT w.film_id FROM watchlist w WHERE w.user_id = p_user_id)
  ORDER BY fp.profile_vector <=> u.preferences_vector
  LIMIT 1;
END;
$function$;


-- ── touch_user_activity ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_user_activity(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_user_id IS DISTINCT FROM auth_user_id() THEN
    RAISE EXCEPTION 'FORBIDDEN: kullanıcı kimliği eşleşmiyor'
      USING ERRCODE = '42501';
  END IF;

  UPDATE users SET
    last_activity_at = NOW(),
    winback_stage = NULL  -- Re-engaged: clear winback stage
  WHERE id = p_user_id;
END;
$function$;


-- ── update_streak ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_streak(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_today         DATE := CURRENT_DATE;
  v_yesterday     DATE := CURRENT_DATE - INTERVAL '1 day';
  v_streak        RECORD;
  v_new_streak    INTEGER;
  v_longest       INTEGER;
  v_total_days    INTEGER;
  v_freeze_used   BOOLEAN := false;
  v_freezes_left  INTEGER := 0;
  v_result        JSONB := '{"streak_updated": false, "new_milestones": []}'::JSONB;
  v_new_ms        JSONB := '[]'::JSONB;
  v_milestone     RECORD;
  -- Freeze grant
  v_freeze_cfg    JSONB;
  v_dna_cfg       JSONB;
  v_rank_index    INTEGER;
  v_user_dna_avg  NUMERIC;
  v_user_dailies  INTEGER;
  v_rank_thresholds JSONB;
  v_rank_min_dailies JSONB;
  v_month_start   DATE;
BEGIN
  IF p_user_id IS DISTINCT FROM auth_user_id() THEN
    RAISE EXCEPTION 'FORBIDDEN: kullanıcı kimliği eşleşmiyor'
      USING ERRCODE = '42501';
  END IF;

  -- Streak kaydını al veya oluştur
  SELECT * INTO v_streak FROM user_streaks WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_active_date, total_active_days)
    VALUES (p_user_id, 1, 1, v_today, 1);

    v_new_streak := 1;
    v_longest := 1;
    v_total_days := 1;
    v_freezes_left := 0;
  ELSE
    -- Bugün zaten aktifse bir şey yapma
    IF v_streak.last_active_date = v_today THEN
      v_result := jsonb_build_object(
        'streak_updated', false,
        'current_streak', v_streak.current_streak,
        'longest_streak', v_streak.longest_streak,
        'freeze_used', false,
        'freezes_remaining', v_streak.streak_freezes_remaining,
        'new_milestones', '[]'::JSONB
      );
      RETURN v_result;
    END IF;

    -- Dün aktifse streak devam eder
    IF v_streak.last_active_date = v_yesterday THEN
      v_new_streak := v_streak.current_streak + 1;
    -- Dün aktif değilse: freeze var mı?
    ELSIF v_streak.streak_freezes_remaining > 0 AND v_streak.current_streak > 0 THEN
      -- Freeze kullan — streak korunur
      v_new_streak := v_streak.current_streak + 1;
      v_freeze_used := true;
      v_freezes_left := v_streak.streak_freezes_remaining - 1;
    ELSE
      -- Streak kırılır
      v_new_streak := 1;
    END IF;

    IF NOT v_freeze_used THEN
      v_freezes_left := v_streak.streak_freezes_remaining;
    END IF;

    v_longest := GREATEST(v_streak.longest_streak, v_new_streak);
    v_total_days := v_streak.total_active_days + 1;

    UPDATE user_streaks SET
      current_streak = v_new_streak,
      longest_streak = v_longest,
      last_active_date = v_today,
      total_active_days = v_total_days,
      streak_freezes_remaining = v_freezes_left
    WHERE user_id = p_user_id;
  END IF;

  -- ─── Aylık freeze grant kontrolü ──────────────────────────────────────
  v_month_start := date_trunc('month', v_today)::DATE;

  SELECT * INTO v_streak FROM user_streaks WHERE user_id = p_user_id;

  IF v_streak.last_freeze_grant IS NULL OR v_streak.last_freeze_grant < v_month_start THEN
    -- Kullanıcının rank'ını hesapla
    SELECT value INTO v_freeze_cfg FROM app_config WHERE key = 'streak_freeze_config';
    SELECT value INTO v_dna_cfg FROM app_config WHERE key = 'dna_config';

    IF v_freeze_cfg IS NOT NULL AND v_dna_cfg IS NOT NULL THEN
      v_rank_thresholds := v_dna_cfg->'rank_thresholds';
      v_rank_min_dailies := v_dna_cfg->'rank_min_dailies';

      -- DNA ortalaması
      SELECT COALESCE(
        (knowledge + deduction + visual_sense + auteur_sense + instinct) / 5.0,
        0
      ) INTO v_user_dna_avg
      FROM cinema_dna WHERE user_id = p_user_id;

      -- Tamamlanan günlük sayısı
      SELECT COUNT(DISTINCT puzzle_id) INTO v_user_dailies
      FROM game_scores
      WHERE user_id = p_user_id AND completed_at IS NOT NULL;

      v_user_dna_avg := COALESCE(v_user_dna_avg, 0);
      v_user_dailies := COALESCE(v_user_dailies, 0);

      -- Rank index hesapla (en yüksek eşiği geçen)
      v_rank_index := 0;
      FOR i IN 0..5 LOOP
        IF v_user_dna_avg >= (v_rank_thresholds->>i)::NUMERIC
           AND v_user_dailies >= (v_rank_min_dailies->>i)::INTEGER THEN
          v_rank_index := i;
        END IF;
      END LOOP;

      -- Yeterli rank'ta mı?
      IF v_rank_index >= (v_freeze_cfg->>'min_rank_index')::INTEGER THEN
        v_freezes_left := LEAST(
          v_freezes_left + (v_freeze_cfg->>'freezes_per_month')::INTEGER,
          (v_freeze_cfg->>'max_freezes')::INTEGER
        );

        UPDATE user_streaks SET
          streak_freezes_remaining = v_freezes_left,
          last_freeze_grant = v_today
        WHERE user_id = p_user_id;
      END IF;
    END IF;
  END IF;

  -- ─── Milestone kontrolü ───────────────────────────────────────────────
  FOR v_milestone IN
    SELECT m.id, m.slug, m.title, m.icon, m.threshold
    FROM milestones m
    WHERE m.category = 'streak'
      AND m.threshold <= v_new_streak
      AND NOT EXISTS (
        SELECT 1 FROM user_milestones um
        WHERE um.user_id = p_user_id AND um.milestone_id = m.id
      )
  LOOP
    INSERT INTO user_milestones (user_id, milestone_id)
    VALUES (p_user_id, v_milestone.id)
    ON CONFLICT (user_id, milestone_id) DO NOTHING;

    v_new_ms := v_new_ms || jsonb_build_object(
      'slug', v_milestone.slug,
      'title', v_milestone.title,
      'icon', v_milestone.icon
    );
  END LOOP;

  v_result := jsonb_build_object(
    'streak_updated', true,
    'current_streak', v_new_streak,
    'longest_streak', v_longest,
    'total_active_days', v_total_days,
    'freeze_used', v_freeze_used,
    'freezes_remaining', v_freezes_left,
    'new_milestones', v_new_ms
  );

  RETURN v_result;
END;
$function$;


-- ════════════════════════════════════════════════════════════════════════════
-- (C) HİBRİT GUARD — hem istemciden hem service_role'den çağrılan 2 fonksiyon
--
-- service_role baypası ŞART: bu iki fonksiyon Edge Function'lardan da
-- çağrılıyor ve orada auth.uid() NULL'dır. Baypas olmadan RevenueCat
-- webhook'u ve process-referral akışı FORBIDDEN'a düşerdi.
-- ════════════════════════════════════════════════════════════════════════════

-- ── claim_lifetime_spot ─────────────────────────────────────────────────────
-- Çağıranlar: services/lifetimeService.ts:105 (client, kendi id'si)
--             supabase/functions/revenuecat-webhook/index.ts:429 (service_role)
--             supabase/functions/process-lifetime-purchase/index.ts:108 (service_role)
--             public.activate_referral içinden SELECT (dahili, postgres yetkisi)
CREATE OR REPLACE FUNCTION public.claim_lifetime_spot(p_user_id uuid, p_price numeric DEFAULT 89.99, p_rc_transaction_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_count INT;
  v_number INT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND p_user_id IS DISTINCT FROM auth_user_id() THEN
    RAISE EXCEPTION 'FORBIDDEN: kullanıcı kimliği eşleşmiyor'
      USING ERRCODE = '42501';
  END IF;

  -- Atomic count check
  SELECT COUNT(*) INTO v_count FROM lifetime_sales;
  IF v_count >= 1000 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'SOLD_OUT',
      'sold', v_count
    );
  END IF;

  -- Check if user already has lifetime
  IF EXISTS (SELECT 1 FROM lifetime_sales WHERE user_id = p_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ALREADY_LIFETIME'
    );
  END IF;

  -- Get next number atomically
  SELECT nextval('lifetime_sale_number') INTO v_number;

  -- Insert sale record
  INSERT INTO lifetime_sales (user_id, sale_number, price_paid, rc_transaction_id)
    VALUES (p_user_id, v_number, p_price, p_rc_transaction_id);

  -- Update user subscription tier
  UPDATE users
  SET subscription_tier = 'lifetime'
  WHERE id = p_user_id;

  -- Update subscriptions table if exists
  UPDATE subscriptions
  SET plan = 'lifetime', status = 'active', expires_at = NULL
  WHERE user_id = p_user_id
    AND status IN ('active', 'trial');

  RETURN jsonb_build_object(
    'success', true,
    'sale_number', v_number,
    'total_sold', v_count + 1
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'ALREADY_LIFETIME'
    );
END
$function$;


-- ── apply_invite_code ───────────────────────────────────────────────────────
-- Çağıranlar: services/referralService.ts:133 (client, kendi id'si)
--             supabase/functions/process-referral/index.ts:62 (service_role)
CREATE OR REPLACE FUNCTION public.apply_invite_code(p_referee_id uuid, p_invite_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_referrer_id UUID;
  v_referrer_code TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND p_referee_id IS DISTINCT FROM auth_user_id() THEN
    RAISE EXCEPTION 'FORBIDDEN: kullanıcı kimliği eşleşmiyor'
      USING ERRCODE = '42501';
  END IF;

  -- Find referrer by invite code
  SELECT id, invite_code INTO v_referrer_id, v_referrer_code
  FROM users
  WHERE invite_code = UPPER(p_invite_code);

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CODE');
  END IF;

  -- Self-referral block
  IF v_referrer_id = p_referee_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'SELF_REFERRAL');
  END IF;

  -- Already referred check
  IF EXISTS (SELECT 1 FROM referrals WHERE referee_id = p_referee_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_REFERRED');
  END IF;

  -- Already has this referrer
  IF EXISTS (SELECT 1 FROM referrals WHERE referrer_id = v_referrer_id AND referee_id = p_referee_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE');
  END IF;

  -- Create referral record
  INSERT INTO referrals (referrer_id, referee_id, invite_code, status)
    VALUES (v_referrer_id, p_referee_id, v_referrer_code, 'pending');

  -- Update referee's referred_by
  UPDATE users SET referred_by = v_referrer_id WHERE id = p_referee_id;

  RETURN jsonb_build_object(
    'success', true,
    'referrer_id', v_referrer_id
  );
END
$function$;
