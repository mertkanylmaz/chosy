-- Migration 020: Onboarding completed flag — DB source of truth
-- BUG #1 fix: AsyncStorage alone was unreliable (reinstall wipes it)

-- Onboarding tamamlandi zaman damgasi — NULL = henuz tamamlanmadi
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Hizli sorgu: tamamlanmamis onboarding'leri bulmak icin
CREATE INDEX IF NOT EXISTS idx_users_onboarding
  ON users(onboarding_completed_at)
  WHERE onboarding_completed_at IS NULL;
