-- Migration 035: app_config (remote feature flags)
--
-- Bu migration'in icerigi Supabase prod'unda zaten manuel calistirildi
-- (Sprint 2 / TASK 2.0). Bu dosya versiyon kontrol icin yaziliyor.
-- IF NOT EXISTS / CONFLICT guards ile idempotent — tekrar calistiribilir.

CREATE TABLE IF NOT EXISTS app_config (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ DEFAULT now(),
  updated_by  TEXT
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Policy: herkes okur (public flags), sadece service_role yazar.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'app_config'
    AND policyname = 'Anyone can read app_config'
  ) THEN
    CREATE POLICY "Anyone can read app_config"
      ON app_config FOR SELECT
      USING (true);
  END IF;
END $$;

INSERT INTO app_config (key, value, description) VALUES
  ('use_match_films_v2', 'true'::jsonb, 'v2 recommendation pipeline. false=v1 rollback')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE app_config IS
  'Remote feature flags. Hot-toggleable from SQL editor without app rebuild.';
