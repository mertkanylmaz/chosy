-- =====================================================================
-- Migration 039: Auto-mark user vector dirty on new taste signal
--
-- Sprint 2 TASK 2.4.D
--
-- When a new row is inserted into user_taste_signals,
-- set users.preferences_vector_dirty = true for that user.
-- The recompute-user-vector Edge Function will pick this up
-- on the next recommendation request (lazy refresh).
--
-- Only fires for meaningful signals (|strength| >= 0.2)
-- to avoid unnecessary dirty flags from trivial impressions.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.mark_user_vector_dirty()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only mark dirty for meaningful signals
  IF ABS(NEW.strength) >= 0.2 THEN
    UPDATE users
    SET preferences_vector_dirty = true
    WHERE id = NEW.user_id
      AND (preferences_vector_dirty = false OR preferences_vector_dirty IS NULL);
  END IF;
  RETURN NEW;
END;
$$;

-- Drop if exists to make migration re-runnable
DROP TRIGGER IF EXISTS trg_mark_user_vector_dirty ON user_taste_signals;

CREATE TRIGGER trg_mark_user_vector_dirty
  AFTER INSERT ON user_taste_signals
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_user_vector_dirty();

COMMENT ON FUNCTION public.mark_user_vector_dirty() IS
  'Sprint 2 TASK 2.4.D: marks users.preferences_vector_dirty = true '
  'when a meaningful taste signal (|strength| >= 0.2) is inserted. '
  'Lazy refresh: recompute-user-vector Edge Function checks this flag.';
