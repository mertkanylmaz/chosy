-- Progressive Milestone Collections — ilerleyen basari koleksiyonlari
-- Her koleksiyon birden fazla seviyeye sahip (Level 1, 2, 3...)

CREATE TABLE IF NOT EXISTS milestone_collections (
  id TEXT PRIMARY KEY,
  name_key TEXT NOT NULL,           -- i18n key (e.g. 'collections.director_hunter')
  description_key TEXT NOT NULL,    -- i18n key for description
  icon TEXT NOT NULL DEFAULT 'trophy',
  levels_json JSONB NOT NULL        -- [{ level: 1, threshold: 5, reward: 'badge' }, ...]
);

CREATE TABLE IF NOT EXISTS user_collection_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  collection_id TEXT NOT NULL REFERENCES milestone_collections(id),
  current_count INTEGER NOT NULL DEFAULT 0,
  current_level INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, collection_id)
);

-- RLS
ALTER TABLE milestone_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read collections" ON milestone_collections FOR SELECT USING (true);

ALTER TABLE user_collection_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own progress" ON user_collection_progress
  FOR SELECT USING (auth.uid() = user_id);
-- Insert/Update via service_role only

-- Seed collections
INSERT INTO milestone_collections (id, name_key, description_key, icon, levels_json) VALUES
  ('director_hunter', 'collections.director_hunter', 'collections.director_hunter_desc', 'film-slate',
   '[{"level":1,"threshold":5,"reward":"badge"},{"level":2,"threshold":15,"reward":"dna_boost"},{"level":3,"threshold":30,"reward":"title"},{"level":4,"threshold":50,"reward":"frame"},{"level":5,"threshold":100,"reward":"crown"}]'),
  ('genre_expert', 'collections.genre_expert', 'collections.genre_expert_desc', 'masks-theater',
   '[{"level":1,"threshold":10,"reward":"badge"},{"level":2,"threshold":25,"reward":"dna_boost"},{"level":3,"threshold":50,"reward":"title"},{"level":4,"threshold":80,"reward":"frame"},{"level":5,"threshold":150,"reward":"crown"}]'),
  ('streak_champion', 'collections.streak_champion', 'collections.streak_champion_desc', 'fire',
   '[{"level":1,"threshold":3,"reward":"badge"},{"level":2,"threshold":7,"reward":"dna_boost"},{"level":3,"threshold":14,"reward":"title"},{"level":4,"threshold":30,"reward":"frame"},{"level":5,"threshold":60,"reward":"crown"}]'),
  ('perfect_solver', 'collections.perfect_solver', 'collections.perfect_solver_desc', 'target',
   '[{"level":1,"threshold":1,"reward":"badge"},{"level":2,"threshold":5,"reward":"dna_boost"},{"level":3,"threshold":15,"reward":"title"},{"level":4,"threshold":30,"reward":"frame"},{"level":5,"threshold":50,"reward":"crown"}]'),
  ('daily_completist', 'collections.daily_completist', 'collections.daily_completist_desc', 'calendar-check',
   '[{"level":1,"threshold":1,"reward":"badge"},{"level":2,"threshold":5,"reward":"dna_boost"},{"level":3,"threshold":14,"reward":"title"},{"level":4,"threshold":30,"reward":"frame"},{"level":5,"threshold":60,"reward":"crown"}]')
ON CONFLICT (id) DO NOTHING;
