-- Migration 051: daily_puzzles genişletme + güvenlik view'ı
-- Oyun sistemi Faz 1 — çözüm istemciye ASLA inmez
--
-- Mevcut kolonlar korunur (game_type, date, film_id, clues) — eski oyunlar çalışmaya devam eder.
-- Yeni sistem puzzle_data, solution_ref, difficulty, validation_status kullanır.
-- View yalnızca güvenli alanları expose eder.

-- ─── Yeni kolonlar ─────────────────────────────────────────────────────────

ALTER TABLE daily_puzzles
  ADD COLUMN IF NOT EXISTS puzzle_data         JSONB,
  ADD COLUMN IF NOT EXISTS difficulty          SMALLINT CHECK (difficulty BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS solution_ref        UUID REFERENCES films(id),
  ADD COLUMN IF NOT EXISTS validation_status   TEXT NOT NULL DEFAULT 'pending'
    CHECK (validation_status IN ('pending','valid','rejected')),
  ADD COLUMN IF NOT EXISTS is_emergency_pool   BOOLEAN NOT NULL DEFAULT false;

-- date kolonunu nullable yap (acil havuz bulmacaları date=NULL ile yaşar)
ALTER TABLE daily_puzzles ALTER COLUMN date DROP NOT NULL;

-- Eski UNIQUE constraint'i kaldır (NULL date'ler için çalışmaz)
-- ve partial unique index ile değiştir (yalnızca tarihli bulmacalar unique)
ALTER TABLE daily_puzzles DROP CONSTRAINT IF EXISTS daily_puzzles_date_game_type_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_puzzles_date_game_type_unique
  ON daily_puzzles(date, game_type) WHERE date IS NOT NULL;

-- Mevcut bulmacaları 'valid' olarak işaretle (geriye dönük uyumluluk)
UPDATE daily_puzzles SET validation_status = 'valid' WHERE validation_status = 'pending';

-- ─── RLS: daily_puzzles erişimini kapat (yalnızca service_role) ─────────

-- Mevcut policy'leri kaldır
DROP POLICY IF EXISTS "Puzzles are readable by all"      ON daily_puzzles;
DROP POLICY IF EXISTS "Puzzles insertable by authenticated" ON daily_puzzles;

-- Service role zaten RLS bypass eder; ek policy gerekmez.
-- Eğer authenticated'ın doğrudan erişmesi gereken eski oyun kodu varsa,
-- o oyunlar view üzerinden okuyacak.

-- ─── Güvenlik view'ı ───────────────────────────────────────────────────────
-- SECURITY DEFINER: view sahibi (postgres) tabloyu okuyabilir,
-- ama view yalnızca güvenli alanları döner.
-- solution_ref, solution anahtarı ve redaction_words ASLA istemciye gitmez.

CREATE OR REPLACE VIEW public_daily_puzzles AS
  SELECT
    id,
    game_type                                              AS game_id,
    date                                                   AS puzzle_date,
    difficulty,
    COALESCE(
      puzzle_data - 'solution' - 'redaction_words',
      clues                                                -- eski bulmacalar için fallback
    )                                                      AS puzzle_data,
    max_attempts,
    created_at
  FROM daily_puzzles
  WHERE validation_status = 'valid'
    AND is_emergency_pool = false
    AND date IS NOT NULL;

-- View'a authenticated SELECT izni
GRANT SELECT ON public_daily_puzzles TO authenticated;

-- ─── Index: yeni sorgu pattern'leri için ────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_daily_puzzles_game_date
  ON daily_puzzles(game_type, date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_puzzles_solution_ref
  ON daily_puzzles(solution_ref)
  WHERE solution_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_daily_puzzles_validation
  ON daily_puzzles(validation_status, game_type, date);
