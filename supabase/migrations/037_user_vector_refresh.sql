-- Migration 037: user vector refresh tracking
-- Lazy refresh için: signal yazıldığında dirty=true,
-- recommendation request'inde stale ise recompute.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferences_vector_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS preferences_vector_dirty BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_vector_dirty
  ON users(preferences_vector_dirty)
  WHERE preferences_vector_dirty = true;

UPDATE users
SET preferences_vector_updated_at = now()
WHERE preferences_vector IS NOT NULL
  AND preferences_vector_updated_at IS NULL;

COMMENT ON COLUMN users.preferences_vector_updated_at IS
  'Vector son hesaplandığı zaman. NULL = hiç hesaplanmadı.';
COMMENT ON COLUMN users.preferences_vector_dirty IS
  'true = signal yazıldı ama vector henüz refresh olmadı. Lazy refresh trigger.';
