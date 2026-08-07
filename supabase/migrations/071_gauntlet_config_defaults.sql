-- ============================================================================
-- Migration 071: generate-gauntlet (B.3) icin app_config varsayilanlari
--
-- B.3 bu dort anahtari LAZY okur. Herhangi biri yoksa Sentry fatal + anlamli
-- hata doner — kod ici sabitle sessizce devam ETMEZ. Bu yuzden anahtarlar
-- fonksiyon yazilmadan once DB'de bulunmak zorunda.
--
-- ── ON CONFLICT DO NOTHING hakkinda ─────────────────────────────────────────
-- Buradaki kullanim IDEMPOTENT SEED'dir: migration ikinci kez calistirilirsa
-- ya da anahtar elle ayarlanmissa mevcut deger KORUNUR. 035/042/044/047/055
-- ayni deseni kullaniyor.
-- Bu, "runtime'da beklenmeyen catismayi yutmak" anlamindaki yasakli sessiz
-- fallback ile AYNI SEY DEGILDIR — orada bir hata gizlenir, burada bir seed
-- tekrari tolere edilir. Iki farkli sinif.
--
-- ── Taninirlik bandi ────────────────────────────────────────────────────────
-- percent_rank(imdb_votes) uzerinde hedef bant. Mutlak oy esigi KULLANILMAZ:
-- imdb_votes dagilimi iki tepeli ve kolon gecmiste kirliydi (OMDb ile TMDb
-- iki farkli metrik ayni kolonda). Olculdu 7 Agu 2026: havuzda imdb_votes = 0
-- olan 0 satir (B.0b hijyeni temizledi), NULL olan 50 satir -> vote_average
-- fallback'i devreye girer.
--
-- ── Sure yayilimi ───────────────────────────────────────────────────────────
-- ORAN DEGIL QUANTILE. Esik, ADIM 1 sonrasi kalan aday havuzunun kendi
-- dagilimindan HER CAGRIDA hesaplanir.
--
-- Neden oran degil (olculdu 7 Agu 2026, havuz 1866 film, runtime 62-566 dk):
--   contextMaxRuntime'i carpan olarak kullanmak iki baglamda cokuyordu.
--   short  (max 110): 110 x 0.55 = 60.5 -> havuzun en kisa filmi 62 dk,
--                     esigin altinda 0 film. 0.50'ye cekince daha da kotu.
--   any    (max 999): 999 x 0.80 = 799 dk'lik film araniyor, havuzun en
--                     uzunu 566. 999 bir tavan degil, "sinirsiz" sentinel'i;
--                     onu carpana sokmak sentinel'i gercek veri saymak olur.
--   Quantile ile olculen esikler: short 96/102 - medium 107/117 - any 109/121
--   any'deki 109/121, spec'in orijinal 110/130 sabitine pratik olarak esdeger.
-- ============================================================================

INSERT INTO app_config (key, value, description) VALUES
  (
    'recognition_band_low',
    '55'::jsonb,
    'Taninirlik hedef bandinin alt yuzdeligi (percent_rank(imdb_votes), imdb_votes > 0). Mutlak oy esigi DEGIL.'
  ),
  (
    'recognition_band_high',
    '80'::jsonb,
    'Taninirlik hedef bandinin ust yuzdeligi. Puan = 1 - |percentile - orta| / yari_genislik, min 0.'
  ),
  (
    'runtime_spread_low_quantile',
    '0.40'::jsonb,
    'Sure yayilimi alt esigi — aday havuzunun runtime quantile''i. Dortluden >=1 film bu esigin ALTINDA olmali.'
  ),
  (
    'runtime_spread_high_quantile',
    '0.60'::jsonb,
    'Sure yayilimi ust esigi — aday havuzunun runtime quantile''i. Dortluden >=1 film bu esigin USTUNDE olmali.'
  )
ON CONFLICT (key) DO NOTHING;


-- ============================================================================
-- DOWN SCRIPT — geri alma (elle calistirilir, migration olarak DEGIL)
--
-- DELETE FROM app_config WHERE key IN (
--   'recognition_band_low',
--   'recognition_band_high',
--   'runtime_spread_low_quantile',
--   'runtime_spread_high_quantile'
-- );
-- ============================================================================
