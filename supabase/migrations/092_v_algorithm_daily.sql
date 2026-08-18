-- ============================================================================
-- Migration 092: v_algorithm_daily (D-04)
--
-- Admin UI insa edilmez (D-04 karari) — bunun yerine bir SQL view +
-- PostHog dashboard. View, choice_events + daily_gauntlets'ten gunluk
-- algoritma saglik ozetini turetir.
--
-- ⚠️ generation_status kolonu semada YOK — K-37'nin backend state machine'i
-- (GENERATING → READY → STARTED → ROUND_1 → ROUND_2 → FINAL → COMPLETED →
-- WATCH_PENDING → WATCHED) hic implement edilmemis (M1 Faz 2 sema
-- dogrulamasi, 18 Agu 2026). Bu view `champion_film_id IS NOT NULL`
-- sinyalini "tamamlandi" icin VEKIL olarak kullanir — gercek state
-- machine yazilirsa bu view guncellenmeli.
--
-- JOIN notu: daily_gauntlets'in PK'si `id`dir, `gauntlet_id` DEGIL.
-- choice_events.gauntlet_id semantik olarak daily_gauntlets.id'ye isaret
-- eder (FK constraint tanimli degil, submit-choice/index.ts'in sorgu
-- deseniyle dogrulandi).
--
-- Gun kolonu: dg.generated_at YERINE dg.date kullanilir. generated_at
-- sunucu TZ'sinde (UTC) kesilirse urunun "gun" tanimi (yerel aksam
-- ritueli) ile UTC gun siniri kayabilir; date kolonu zaten urun gunudur
-- ve daily_gauntlets_scope_date index'inin ilk kolonuyla ortusur.
--
-- ⚠️ RLS: Bu view'i yaratan rol (migration runner, tipik olarak `postgres`)
-- choice_events/daily_gauntlets'in SAHIBIDIR. FORCE ROW LEVEL SECURITY
-- hicbir tabloda tanimli degil, bu yuzden sahip RLS'ten muaftir ve view
-- security_invoker=false varsayilaniyla TUM kullanicilarin agrege
-- verisini gorur. Supabase'in public sema bootstrap'i anon/authenticated
-- rollerine ortuk SELECT verdigi icin (bkz. migration-guard denetimi,
-- 18 Agu 2026 — 018'deki v_posterle_daily_stats emsali) bu view REVOKE
-- edilmezse istemci tarafindan sorgulanabilir hale gelirdi. Satir duzeyi
-- PII yok (view GROUP BY ile agrege) ama D-04'un "yalnizca internal/
-- PostHog analogu" tanimina aykiri olurdu. security_invoker=true
-- KULLANILMADI — o durumda service_role disindaki bir rol RLS filtresine
-- takilip sessizce eksik sayi gorurdu (kural 1 ihlali). Bunun yerine
-- erisim REVOKE + yalniz service_role'e GRANT ile kapatiliyor.
-- ============================================================================

CREATE OR REPLACE VIEW v_algorithm_daily AS
SELECT
  dg.date AS day,
  dg.algorithm_version,
  count(DISTINCT dg.id) AS gauntlets_generated,
  count(DISTINCT dg.id) FILTER (WHERE dg.champion_film_id IS NOT NULL) AS gauntlets_completed,
  count(ce.id) AS choices_submitted,
  avg(ce.latency_ms) AS avg_choice_latency_ms,
  (count(ce.id) FILTER (WHERE ce.outcome = 'neither'))::numeric
    / NULLIF(count(ce.id), 0) AS neither_rate
FROM daily_gauntlets dg
LEFT JOIN choice_events ce ON ce.gauntlet_id = dg.id
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

COMMENT ON VIEW v_algorithm_daily IS
  'D-04: gunluk algoritma saglik ozeti. Admin UI yerine SQL view + '
  'PostHog dashboard. gauntlets_completed champion_film_id IS NOT NULL '
  'VEKILIYLE hesaplanir — K-37 state machine kolonu semada yok (092). '
  'Yalniz service_role okur — REVOKE/GRANT asagida, ayni migration''da.';

-- View sahibi (migration runner) RLS'ten muaf oldugu icin bu view'i
-- anon/authenticated'a birakmak K-40'in "choice_events cinema_dna'nin
-- tek kaynagi, istemci okumamali/sahtelemez olmali" prensibiyle celisir.
REVOKE ALL ON public.v_algorithm_daily FROM PUBLIC;
REVOKE ALL ON public.v_algorithm_daily FROM anon, authenticated;
GRANT SELECT ON public.v_algorithm_daily TO service_role;

-- ============================================================================
-- DOWN
-- DROP VIEW IF EXISTS v_algorithm_daily;
-- ============================================================================
