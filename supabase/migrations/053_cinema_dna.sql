-- Migration 053: cinema_dna tablosu
-- 6 boyutlu sinema kimliği — EWMA ile güncellenir, yalnızca Edge Function yazar

CREATE TABLE IF NOT EXISTS cinema_dna (
  user_id                  UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  knowledge                REAL NOT NULL DEFAULT 0,
  deduction                REAL NOT NULL DEFAULT 0,
  auteur_sense             REAL NOT NULL DEFAULT 0,
  instinct                 REAL NOT NULL DEFAULT 0,
  consistency              REAL NOT NULL DEFAULT 0,
  visual_sense             REAL NOT NULL DEFAULT 0,
  cinema_score             SMALLINT NOT NULL DEFAULT 0,
  rank_id                  SMALLINT NOT NULL DEFAULT 1,
  identity_title           TEXT,
  total_dailies_completed  INTEGER NOT NULL DEFAULT 0,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- cinema_score trigger ile hesaplanır (ağırlıklar app_config'ten değişebilir,
-- bu yüzden GENERATED ALWAYS yerine trigger tercih edildi)
CREATE OR REPLACE FUNCTION update_cinema_dna_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cinema_dna_updated_at
  BEFORE UPDATE ON cinema_dna
  FOR EACH ROW
  EXECUTE FUNCTION update_cinema_dna_timestamp();

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Kullanıcı yalnızca kendi satırını okuyabilir.
-- INSERT/UPDATE yalnızca service_role (Edge Function üzerinden).

ALTER TABLE cinema_dna ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cinema_dna: owner read"
  ON cinema_dna FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT/UPDATE policy yok → authenticated INSERT/UPDATE yapamaz.
-- service_role RLS'i bypass eder, bu yüzden Edge Function yazabilir.
