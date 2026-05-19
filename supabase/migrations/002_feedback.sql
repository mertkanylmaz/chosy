-- ============================================================
-- MoodFlix — Feedback Migration
-- 002_feedback.sql
-- ============================================================

-- watchlist'e izlenme zamanı ekle
ALTER TABLE watchlist ADD COLUMN IF NOT EXISTS watched_at TIMESTAMPTZ;

-- ============================================================
-- feedback tablosu
-- ============================================================

CREATE TABLE IF NOT EXISTS feedback (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  film_id     UUID NOT NULL REFERENCES films(id) ON DELETE CASCADE,
  star_rating INTEGER NOT NULL CHECK (star_rating BETWEEN 1 AND 5),
  on_point    BOOLEAN NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, film_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_film_id ON feedback(film_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback: owner read"
  ON feedback FOR SELECT
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  );

CREATE POLICY "feedback: owner insert"
  ON feedback FOR INSERT
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  );

CREATE POLICY "feedback: owner update"
  ON feedback FOR UPDATE
  USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid()::text LIMIT 1)
  );
create or replace function match_films(

  query_vector vector(384),

  match_count int default 20

)

returns table (

  id uuid,

  tmdb_id int,

  title text,

  year int,

  poster_url text,

  backdrop_url text,

  overview text,

  genres text[],

  runtime int,

  vote_average float,

  similarity float,

  dimensions_json jsonb

)

language sql stable

as $$

  select

    f.id, f.tmdb_id, f.title, f.year, f.poster_url,

    f.backdrop_url, f.overview, f.genres, f.runtime,

    f.vote_average,

    1 - (fp.profile_vector <=> query_vector) as similarity,

    fp.dimensions_json

  from film_profiles fp

  join films f on f.id = fp.film_id

  order by fp.profile_vector <=> query_vector

  limit match_count;

$$;

