-- ============================================================================
-- 086_watch_feedback_skip.sql
-- C.4 "dün izledin mi?" akışı — response CHECK'ine 'skipped' eklenir.
--
-- 'skipped': asked_at yazılır, answered_at NULL kalır, watched_at'e
-- dokunulmaz. tasteVector.ts (_shared) feedback_weights sözlüğünde
-- 'skipped' anahtarı YOKTUR — bu KASITLI: fw undefined olur, satır
-- unknown_feedback_response sayacına düşüp sinyale katkı yapmadan atlanır
-- (NULL response ile aynı yol). Bu yüzden tasteVector.ts'e dokunulmuyor.
--
-- İsimsiz inline CHECK (069) Postgres varsayılan adını almıştı:
-- watch_feedback_response_check. Bu migration onu adlandırılmış bir kısıtla
-- değiştirir ki gelecekte DROP CONSTRAINT IF EXISTS güvenilir olsun (074'teki
-- gerekçeyle aynı).
-- ============================================================================

ALTER TABLE watch_feedback
  DROP CONSTRAINT IF EXISTS watch_feedback_response_check;

ALTER TABLE watch_feedback
  ADD CONSTRAINT watch_feedback_response_check
  CHECK (response IN ('loved','ok','abandoned','not_watched','skipped'));

-- ============================================================================
-- DOWN SCRIPT — geri alma (elle çalıştırılır, migration olarak DEĞİL)
--
-- ALTER TABLE watch_feedback DROP CONSTRAINT IF EXISTS watch_feedback_response_check;
-- ALTER TABLE watch_feedback
--   ADD CONSTRAINT watch_feedback_response_check
--   CHECK (response IN ('loved','ok','abandoned','not_watched'));
-- ============================================================================
