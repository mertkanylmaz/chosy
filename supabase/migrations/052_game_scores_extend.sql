-- Migration 052: game_scores genişletme
-- Oyun durumu (progress_json), DNA sinyalleri, XP, hard mode ve anti-cheat flag'i

ALTER TABLE game_scores
  ADD COLUMN IF NOT EXISTS progress_json  JSONB,
  ADD COLUMN IF NOT EXISTS dna_signals    JSONB,
  ADD COLUMN IF NOT EXISTS xp_awarded     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_hard_mode   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flagged        BOOLEAN NOT NULL DEFAULT false;

-- UNIQUE(user_id, puzzle_id) zaten migration 016'da mevcut — doğrulama:
-- Constraint yoksa ekle (idempotent guard)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'game_scores'::regclass
    AND contype = 'u'
    AND conname LIKE '%user_id%puzzle_id%'
  ) THEN
    ALTER TABLE game_scores ADD CONSTRAINT game_scores_user_puzzle_unique
      UNIQUE (user_id, puzzle_id);
  END IF;
END $$;

-- completed_at'ı nullable yap (oyun devam ederken NULL olabilir)
ALTER TABLE game_scores ALTER COLUMN completed_at DROP NOT NULL;
ALTER TABLE game_scores ALTER COLUMN completed_at DROP DEFAULT;
