-- Strip imposter_actor_id from public_daily_puzzles view
-- so the imposter solution never reaches the client.

CREATE OR REPLACE VIEW public_daily_puzzles AS
  SELECT
    id,
    game_type                                              AS game_id,
    date                                                   AS puzzle_date,
    difficulty,
    COALESCE(
      puzzle_data - 'solution' - 'redaction_words' - 'imposter_actor_id',
      clues
    )                                                      AS puzzle_data,
    max_attempts,
    created_at
  FROM daily_puzzles
  WHERE validation_status = 'valid'
    AND is_emergency_pool = false
    AND date IS NOT NULL;
