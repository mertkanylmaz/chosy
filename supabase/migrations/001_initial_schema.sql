-- ============================================================
-- MoodFlix — Initial Schema Migration
-- 001_initial_schema.sql
-- ============================================================

-- pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- TABLES
-- ============================================================

-- users
CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id      TEXT NOT NULL UNIQUE,
  display_name TEXT,
  preferences_vector vector(384),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- films
CREATE TABLE IF NOT EXISTS films (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tmdb_id       INTEGER NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  year          INTEGER,
  poster_url    TEXT,
  backdrop_url  TEXT,
  overview      TEXT,
  genres        TEXT[],
  runtime       INTEGER,
  vote_average  FLOAT,
  metadata_json JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- film_profiles
CREATE TABLE IF NOT EXISTS film_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  film_id         UUID NOT NULL UNIQUE REFERENCES films(id) ON DELETE CASCADE,
  profile_vector  vector(384),
  dimensions_json JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- sessions
CREATE TABLE IF NOT EXISTS sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  raw_input           TEXT,
  parsed_profile_json JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- swipes
CREATE TABLE IF NOT EXISTS swipes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  film_id    UUID NOT NULL REFERENCES films(id) ON DELETE CASCADE,
  direction  TEXT NOT NULL CHECK (direction IN ('left', 'right', 'up')),
  timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- watchlist
CREATE TABLE IF NOT EXISTS watchlist (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  film_id              UUID NOT NULL REFERENCES films(id) ON DELETE CASCADE,
  added_from_session   UUID REFERENCES sessions(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, film_id)
);

-- ============================================================
-- updated_at AUTO-UPDATE TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_films_updated_at
  BEFORE UPDATE ON films
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_film_profiles_updated_at
  BEFORE UPDATE ON film_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- INDEXES
-- ============================================================

-- IVFFlat index for cosine similarity search on film profile vectors
-- lists=100 makul bir başlangıç; corpus büyüdükçe artırılabilir
CREATE INDEX IF NOT EXISTS idx_film_profiles_vector
  ON film_profiles
  USING ivfflat (profile_vector vector_cosine_ops)
  WITH (lists = 100);

-- IVFFlat index for user preference vectors
CREATE INDEX IF NOT EXISTS idx_users_preferences_vector
  ON users
  USING ivfflat (preferences_vector vector_cosine_ops)
  WITH (lists = 100);

-- Sık sorgulanan FK sütunları için B-tree indexler
CREATE INDEX IF NOT EXISTS idx_sessions_user_id    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_swipes_session_id   ON swipes(session_id);
CREATE INDEX IF NOT EXISTS idx_swipes_film_id      ON swipes(film_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id   ON watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_film_id   ON watchlist(film_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE films        ENABLE ROW LEVEL SECURITY;
ALTER TABLE film_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE swipes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist    ENABLE ROW LEVEL SECURITY;

-- ---- users ----
-- Kullanıcı yalnızca kendi satırını okuyabilir/güncelleyebilir
CREATE POLICY "users: self read"
  ON users FOR SELECT
  USING (auth_id = auth.uid()::text);

CREATE POLICY "users: self insert"
  ON users FOR INSERT
  WITH CHECK (auth_id = auth.uid()::text);

CREATE POLICY "users: self update"
  ON users FOR UPDATE
  USING (auth_id = auth.uid()::text)
  WITH CHECK (auth_id = auth.uid()::text);

-- ---- films ----
-- Filmler herkese açık, yalnızca servis rolü yazabilir
CREATE POLICY "films: public read"
  ON films FOR SELECT
  USING (true);

CREATE POLICY "films: service insert"
  ON films FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "films: service update"
  ON films FOR UPDATE
  USING (auth.role() = 'service_role');

-- ---- film_profiles ----
-- Film profilleri herkese açık, yalnızca servis rolü yazabilir
CREATE POLICY "film_profiles: public read"
  ON film_profiles FOR SELECT
  USING (true);

CREATE POLICY "film_profiles: service insert"
  ON film_profiles FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "film_profiles: service update"
  ON film_profiles FOR UPDATE
  USING (auth.role() = 'service_role');

-- ---- sessions ----
-- Kullanıcı yalnızca kendi session'larına erişebilir
CREATE POLICY "sessions: owner read"
  ON sessions FOR SELECT
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  );

CREATE POLICY "sessions: owner insert"
  ON sessions FOR INSERT
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  );

-- ---- swipes ----
-- Kullanıcı yalnızca kendi session'larına ait swipe'ları okuyabilir/yazabilir
CREATE POLICY "swipes: owner read"
  ON swipes FOR SELECT
  USING (
    session_id IN (
      SELECT s.id FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE u.auth_id = auth.uid()::text
    )
  );

CREATE POLICY "swipes: owner insert"
  ON swipes FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT s.id FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE u.auth_id = auth.uid()::text
    )
  );

-- ---- watchlist ----
-- Kullanıcı yalnızca kendi izleme listesine erişebilir
CREATE POLICY "watchlist: owner read"
  ON watchlist FOR SELECT
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  );

CREATE POLICY "watchlist: owner insert"
  ON watchlist FOR INSERT
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  );

CREATE POLICY "watchlist: owner delete"
  ON watchlist FOR DELETE
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  );
