-- ============================================================================
-- Migration 097: kasitli-acik view'larin belgelenmesi (dokuman notu)
--
-- 093/094/095 PII sizintisi bulup kapattiktan, 096 kok nedeni (proje-geneli
-- default privilege) duzelttikten sonra: `v_posterle_daily_stats` (018) ve
-- `public_daily_puzzles` (064) BILINCLI olarak anon/authenticated'a acik
-- kalmalidir — ikisi de PII tasimaz (agrege istatistik / cevap alanlari
-- temizlenmis bulmaca verisi).
--
-- 096'dan SONRA bu iki view yeniden yaratilirsa (CREATE OR REPLACE VIEW
-- ile GRANT'lari korunur — ama bir DROP+CREATE ile yeniden kurulursa)
-- yeni bir nesne muamelesi gorup KAPALI DOGARLAR. Bu COMMENT bu riski
-- ilgili DB nesnelerinin uzerinde kalici olarak isaretler — geri alinamaz
-- bir geri alma soz konusu degil, yalniz belge amacli.
--
-- Migration dosyalarinin kendisine (018, 064) DOKUNULMADI — push edilmis
-- bir migration dosyasini degistirmek supabase migration checksum/history
-- takibini bozabilir. Bunun yerine COMMENT ON VIEW ile DB nesnesinin
-- kendisine not dusuldu; bu hem psql \d+ ile gorulur hem git gecmisini
-- etkilemez.
-- ============================================================================

COMMENT ON VIEW public.v_posterle_daily_stats IS
  'KASITLI OLARAK ACIK — agrege istatistik (puzzle_date, difficulty_tier, '
  'film_title bazinda win/loss sayilari), hicbir user_id veya PII yok. '
  '096''dan (default privilege kok neden duzeltmesi) sonra yeniden '
  'yaratilirsa (DROP+CREATE, CREATE OR REPLACE DEGIL) GRANT SELECT TO '
  'anon, authenticated ACIKCA eklenmeli — aksi halde kapali doner ve '
  'posterle istatistik ekrani kirilir.';

COMMENT ON VIEW public.public_daily_puzzles IS
  'KASITLI OLARAK ACIK — 064''te cevap alanlari (solution, film_title vb.) '
  'bilincli olarak temizlendi, hicbir user_id yok. 096''dan (default '
  'privilege kok neden duzeltmesi) sonra yeniden yaratilirsa (DROP+CREATE, '
  'CREATE OR REPLACE DEGIL) GRANT SELECT TO anon, authenticated, '
  'service_role ACIKCA eklenmeli — aksi halde kapali doner ve gunluk '
  'bulmaca akisi kirilir.';

-- ============================================================================
-- DOWN
-- COMMENT ON VIEW public.v_posterle_daily_stats IS NULL;
-- COMMENT ON VIEW public.public_daily_puzzles IS NULL;
-- ============================================================================
