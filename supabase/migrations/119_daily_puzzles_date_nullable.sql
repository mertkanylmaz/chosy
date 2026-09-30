-- ============================================================
-- 119 — daily_puzzles.date NULL kabul eder (acil havuz)
--
-- ── Neden ────────────────────────────────────────────────────────────────
-- generate-puzzles acil havuz satırlarını `date: null` ile ekliyor
-- (fillEmergency) ve ihtiyaç anında tarih atıyor (useEmergency). Ama kolon
-- NOT NULL: her acil ekleme 23502 ile reddedildi ve üretici hatayı yuttu
-- (`if (!error) made++`). 30 Eyl 2026 ölçümü: 10 oyun türünün HİÇBİRİNDE
-- tek bir acil satır yok — mekanizma hiç çalışmamış.
-- Kurucu onayı: 30 Eyl 2026 (AskUserQuestion).
--
-- ── Güvenlik / istemci etkisi ────────────────────────────────────────────
-- * İstemcinin okuduğu tek yüzey `public_daily_puzzles` görünümü ve o zaten
--   `p.date IS NOT NULL AND p.is_emergency_pool = false` ile filtreliyor:
--   tarihsiz acil satırlar istemciye İNMEZ (Spotlight çözüm sızıntısı
--   kuralı etkilenmez).
-- * UNIQUE (date, game_type): Postgres NULL'ları eşit saymaz, oyun başına
--   birden fazla tarihsiz acil satır mümkün — tasarımın istediği bu.
-- * Veri değişmez; yalnız kısıt gevşer.
-- ============================================================

ALTER TABLE public.daily_puzzles
  ALTER COLUMN date DROP NOT NULL;

-- Tarihli bulmacanın tarihsiz kalmasını önleyen koruma: tarihsiz satır
-- YALNIZ acil havuzda olabilir. Mevcut satırların hepsi tarihli, ihlal yok.
ALTER TABLE public.daily_puzzles
  ADD CONSTRAINT daily_puzzles_date_required_unless_emergency
  CHECK (date IS NOT NULL OR is_emergency_pool = true);

-- ============================================================
-- DOWN (ELLE — önce tarihsiz acil satırlar silinmeli ya da tarihlenmeli):
--   ALTER TABLE public.daily_puzzles
--     DROP CONSTRAINT daily_puzzles_date_required_unless_emergency;
--   ALTER TABLE public.daily_puzzles ALTER COLUMN date SET NOT NULL;
-- ============================================================
