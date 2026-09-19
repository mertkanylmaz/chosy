-- ============================================================================
-- 112 — editorial_calendar (E-19): 100 günlük editoryal takvim
--
-- Keşif: docs/investigations/E19_SCHEMA_VE_INGEST_TASARIM.md (DUR NOKTASI b)
-- Karar: Seçenek B (normalize, FK'lı) — CTO onayı 19 Eyl 2026.
-- Ürün dayanağı: docs/os/7_CHOSY_V1_KAPSAM_KILIDI.md §E-19 (v1.12)
--
-- NE İŞE YARAR
--   İlk 100 günün gauntlet'i algoritmik havuzdan değil, elle kurgulanmış bu
--   takvimden gelir: gün başına 4 ana film (sıra = bracket) + en fazla 2 yedek.
--
-- SIRA ANLAMLIDIR (ölçüldü: generate-gauntlet/index.ts:826-827,
-- GauntletShell/index.tsx:130-131,334):
--   position 1 → defender            · position 2 → tur-1 challenger
--   position 3 → tur-2 challenger    · position 4 → tur-3 challenger
-- Yani sıralı 4'lü dizi günün ÜÇ eşleşmesini tamamen belirler; ayrı bir
-- "matchups" tablosu gerekmez.
--
-- position 5-6 = YEDEK KULÜBESİ (K-23). submit-choice'ın `neither`/`seen`
-- dalı iki filmi birden eler ve yerine film ister; editoryal günde o yedek
-- algoritmik havuzdan gelmemeli, günün kurgusunu kırar. Yedek bandı ana
-- sıradan AYRI bir CHECK ile ifade edilir ki iki bandın anlamı şemadan
-- okunabilsin.
--
-- DATE KOLONU YOK — bilinçli.
--   date = launch_date + (day_number - 1), okuma anında hesaplanır.
--   launch_date taşıyıcısı `app_config` (lazy getter, anahtar yoksa throw).
--   Gerekçe: Bible §E-19.2b — Gün 1 gerçek yayın tarihinin HAFTA GÜNÜNE
--   hizalanır; yayın kayarsa tek bir app_config değeri güncellenir, 100 satır
--   değil.
--
-- RLS: ENABLE + HİÇ POLICY YOK.
--   service_role RLS'i baypas eder, istemci hiçbir satır göremez. Gerekçe
--   069'daki scope='anonim' kararının aynısı: istemci YARININ filmlerini
--   önceden görmemeli. İstemci günün dörtlüsünü daily_gauntlets üzerinden alır.
-- ============================================================================

-- ─── editorial_calendar_days ────────────────────────────────────────────────

CREATE TABLE editorial_calendar_days (
  day_number   INT  PRIMARY KEY CHECK (day_number BETWEEN 1 AND 100),
  -- Haftalık gün-teması tablosu (Bible §E-19.2). KALICI yapısal kural:
  -- 100 gün bitince de yürürlükte kalır, §6.4 sert filtresine bağlanır.
  theme        TEXT NOT NULL CHECK (theme IN (
                 'arthouse',   -- Pazartesi · Arthouse / Bağımsız
                 'cult',       -- Salı      · Kültler
                 'cozy',       -- Çarşamba  · Animasyon / Cozy
                 'discovery',  -- Perşembe  · Modern keşif / gizli cevher
                 'popcorn',    -- Cuma      · Popcorn & gişe
                 'epic',       -- Cumartesi · Epik anlatı & uzun metraj
                 'prestige'    -- Pazar     · Prestij & akademi
               )),
  editor_note  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── editorial_calendar_films ───────────────────────────────────────────────

CREATE TABLE editorial_calendar_films (
  day_number  INT  NOT NULL
                REFERENCES editorial_calendar_days(day_number) ON DELETE CASCADE,
  position    INT  NOT NULL,
  -- ON DELETE RESTRICT: film verisinde DELETE zaten yasak (CLAUDE.md #4,
  -- arşivleme curation_tier ile yapılır). Bu kısıt o kuralın DB tarafındaki
  -- karşılığı — takvimde duran bir film silinemez.
  film_id     UUID NOT NULL REFERENCES public.films(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (day_number, position),

  -- İki bant AYRI yazılır: 1-4 günün bracket'i, 5-6 K-23 yedek kulübesi.
  CONSTRAINT editorial_calendar_films_position_band CHECK (
       (position BETWEEN 1 AND 4)   -- ana sıra: defender + 3 challenger
    OR (position BETWEEN 5 AND 6)   -- yedek kulübesi (K-23 ret merdiveni)
  )
);

-- Bible §E-19.1 "400 benzersiz film" kuralının veri seviyesindeki karşılığı.
-- TÜM pozisyonları kapsar: bir film ne ana sırada ne yedek olarak ikinci kez
-- kullanılamaz.
CREATE UNIQUE INDEX editorial_calendar_films_film_uniq
  ON editorial_calendar_films (film_id);

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- SELECT policy'si BİLİNÇLİ OLARAK YOK (yukarıdaki gerekçe).

ALTER TABLE editorial_calendar_days  ENABLE ROW LEVEL SECURITY;
ALTER TABLE editorial_calendar_films ENABLE ROW LEVEL SECURITY;

-- ─── COMMENT ON (S-06 deseni: 069_gauntlet_events.sql) ──────────────────────

COMMENT ON TABLE editorial_calendar_days IS
  'E-19 · İlk 100 günün editoryal takvimi, gün başına bir satır. Takvim '
  'tarihi SAKLANMAZ: date = app_config launch_date + (day_number - 1).';

COMMENT ON COLUMN editorial_calendar_days.theme IS
  'Haftalık gün-teması (Bible §E-19.2). Pzt arthouse · Sal cult · Çar cozy · '
  'Per discovery · Cum popcorn · Cmt epic · Paz prestige. 100 gün sonrası '
  'algoritmik fazda da KALICI — §6.4 sert filtresine gün bazlı ağırlık olur.';

COMMENT ON COLUMN editorial_calendar_days.editor_note IS
  'CTO''nun o günün kurgusuna dair notu. Kullanıcıya gösterilmez.';

COMMENT ON TABLE editorial_calendar_films IS
  'E-19 · Günün filmleri. UNIQUE(film_id) tüm pozisyonları kapsar — 400 film '
  'benzersizdir, bir film ikinci bir güne (ana ya da yedek) konulamaz.';

COMMENT ON COLUMN editorial_calendar_films.position IS
  'SIRA ANLAMLIDIR. 1 = defender · 2 = tur-1 challenger · 3 = tur-2 '
  'challenger · 4 = tur-3 challenger. 5-6 = K-23 yedek kulübesi: neither/seen '
  'dalı iki filmi birden elediğinde algoritmik havuz yerine buradan çekilir.';
