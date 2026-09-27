-- ============================================================================
-- 118 — daily_gauntlets.cycle: önceki döngü satırının izi (E-21)
--
-- KARAR: E-21 (7_CHOSY_V1_KAPSAM_KILIDI.md, 27 Eyl 2026) + V-1 Tur 4 onayı
--   (27 Eyl 2026, "Satır izi → Yeni kolon"). Sıfır kişisel satırı olan kullanıcı
--   18:00 öncesi açarsa etkin (önceki) döngünün gauntlet'ini alır; satırın
--   `date`'i o döngünün anahtarıdır, bugün değil.
--
-- NEDEN KOLON: Önceki döngü satırı tarihten ayırt edilemiyor.
--   · get-archive-status anchor'ı ilk kişisel satırdır → dün tarihli yarım
--     satır "ilk kaçırma bedava" hakkını tüketirdi (K-46).
--   · generate-gauntlet uygunluk kontrolü "kendi önceki döngü satırını sürdür"
--     ile "tek satırı olan mevcut kullanıcının dünkü yarım oyunu"nu ayıramazdı.
--   `generated_at` türetmesi UTC+ bölgelerde yerel 00:00–03:00 kurulumunu
--   göremiyor; context JSONB etiketi choice_events.context'e kopyalanıyor.
--
-- ETKİ: Sabit DEFAULT → PG11+ metadata-only; tablo yeniden yazılmaz. Tüm
--   mevcut satırlar (global dahil) 'current' olur — doğru değer. RLS ve
--   unique index'ler (069) değişmez. Eski fonksiyonlar kolonu hiç yazmaz →
--   default 'current' ile davranışları aynen sürer.
--
-- GERİ ALMA (elle, yalnız kolonu okuyan fonksiyonlar geri alındıktan sonra):
--   ALTER TABLE daily_gauntlets DROP CONSTRAINT daily_gauntlets_cycle_check;
--   ALTER TABLE daily_gauntlets DROP COLUMN cycle;
-- ============================================================================

-- Tek ALTER → tek ACCESS EXCLUSIVE kilidi (migration-guard önerisi).
-- İkinci CHECK: önceki döngü yalnız kişisel satırda anlamlıdır; global slot
-- her zaman current.
ALTER TABLE daily_gauntlets
  ADD COLUMN cycle TEXT NOT NULL DEFAULT 'current',
  ADD CONSTRAINT daily_gauntlets_cycle_check
    CHECK (cycle IN ('current', 'previous')),
  ADD CONSTRAINT daily_gauntlets_cycle_personal_only
    CHECK (cycle = 'current' OR scope = 'personal');

COMMENT ON COLUMN daily_gauntlets.cycle IS
  'E-21: current = normal akış; previous = sıfır satırlı yeni kullanıcıya 18:00 öncesi verilen etkin döngü gauntlet''i. Arşiv hesabına girmez.';
