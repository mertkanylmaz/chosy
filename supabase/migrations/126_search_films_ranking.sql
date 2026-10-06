-- ============================================================
-- 126 — search_films: kademeli sıralama + başlık normalizasyonu (P-6b)
--
-- ── Neden ────────────────────────────────────────────────────────────────
-- 029'daki sıra: birebir başlık → ts_rank → imdb_rating. Başlıkta geçen her
-- kelime aynı A ağırlığında olduğundan ts_rank ~1.0'da doyuyor, beraberliği
-- IMDb puanı bozuyordu: "The King" → LOTR, The Lion King, The King's Speech
-- (5 Eki'nin Spotlight cevabı) 3. Önek eşleşmesinin sinyali yoktu, "the" tek
-- başına AND terimiydi; kesme işareti ve aksan normalize edilmiyordu
-- ("Kings Speech", "Amelie" → 0 sonuç). Kaynak:
-- docs/investigations/P6_SPOTLIGHT_ARAMA_SONUC_KESIF.md §1.
--
-- ── Çağıranlar (6 Eki 2026, P-6b Adım 0) ──────────────────────────────────
-- Tek zincir: components/games/FilmSearchInput → services/gameService.ts
-- searchFilms → services/searchFilms.ts searchFilmsDb → rpc('search_films').
-- FilmSearchInput: Spotlight (canlı) + 5 dondurulmuş oyun. Canlıdaki 37 Edge
-- Function'ın kaynağı ve pg_proc'taki SQL fonksiyonları tarandı: çağıran yok.
-- İstemci `relevance_rank`'i okumuyor (gameService yalnız id/title/year/poster).
--
-- ── Sözleşme ────────────────────────────────────────────────────────────
-- İmza, dönüş tipi, STABLE, SECURITY INVOKER ve GRANT'lar 029 ile aynı.
-- archive filtresi YOK: editoryal takvimdeki 400 filmin 33'ü archive.
-- `relevance_rank` artık kademe: (5 − kademe) / 5 → 1.0 birebir … 0.0 kişi.
-- Sınırlar (CTO, 6 Eki 2026): sorgu ilk 100 karakter (`left(search_query,
-- 100)`; RPC anon'a açık, kelime sayısı maliyeti çarpar); sonuç en çok 25
-- (`LEAST(result_limit, 25)`; NULL → 25). İstemci bugün 10 istiyor.
--
-- ── Kademeler (küçük önce) ────────────────────────────────────────────────
--   0  birebir başlık (artikel atılmış hâli dahil)          — K0
--   1  başlık öneki, artikel KORUNMUŞ                         — K1a
--   2  başlık öneki, artikel atılmış                          — K1b
--   3  bitişik ifade (başlığın içinde)                        — K2
--   4  tüm kelimeler, son kelime önek                         — K3
--   5  yönetmen / kadro                                       — K4
-- "Başlık" = title, original_title, tr_title; en iyi kademe alınır.
--
-- ── Kademe içi sıra ─────────────────────────────────────────────────────
--   a) tam kelime: sorgunun son kelimesi başlıkta tam kelime (iyelik "s"
--      kabul) — "Beau" → Beau Travail, Beauty and the Beast'ten önce;
--      "The King" → The King's Speech, The Kingdom'dan önce.
--      (DUR 2'de eklendi, CTO onayı 6 Eki 2026: "Beau" kabul kriteri bu
--      olmadan sağlanmıyor — Beauty and the Beast core, Beau Travail extended.)
--   b) curation_tier: core 0 · extended/trending 1 · archive/NULL 2
--   c) imdb_votes DESC NULLS LAST (0 = NULL; kolon OMDb/TMDb karışık)
--   d) imdb_rating DESC NULLS LAST
--   e) title, id (deterministik)
--
-- ── Normalizasyon (uzantısız, inline) ─────────────────────────────────────
-- Adım 1 "anahtar": lower → translate (65 Latin aksanı → ASCII; katalogdaki
-- hepsi; kesme işaretleri ' ’ ` ve U+0307 — lower('İ') = 'i' + U+0307 —
-- SİLİNİR: "King's" → "kings") → æ/ß/œ → ae/ss/oe.
-- Adım 2: [[:alnum:]] dışı → tek boşluk → btrim. [[:alnum:]] (en_US.UTF-8)
-- Japonca/Kiril harfleri korur; özgün başlıklar boşalmaz.
-- Satırlarda adım 2 (regex) yalnız ön elemeyi geçen adaylara uygulanır:
-- anahtar, sorgunun her kelimesini alt dize olarak içermeli (güvenli üst
-- küme — adım 2 yalnız boşluk ekler). Tek geçişli sürüm 300 ms ölçüldü.
-- Baştaki the/a/an yalnız K1b/K2/K3'te atılır; normalize sorgu yalnız
-- artikelse ("The") artikel korunarak eşleşir.
-- Kişi kademesi: yönetmen normalize edilir; kadro mevcut search_vector
-- (D ağırlığı, GIN) üzerinden önek tsquery ile.
--
-- ── Performans (canlı, pg_temp kopyası, 6 Eki 2026, 3 tekrar min/max) ─────
--   029: 14–16 ms · 126: 76–89 ms (tek kelime/iki kelime), "The" 167–173 ms.
--   Daha hızlısı saklı normalize kolon / ifade index'i ister (yeni nesne) —
--   bu migration'ın kapsamı dışında.
--
-- ── Geri alma ───────────────────────────────────────────────────────────
-- 029_search_improvements.sql:60-119 gövdesini yeni bir migration'la
-- CREATE OR REPLACE et. Canlı gövde 6 Eki 2026'da 029 ile birebir aynıydı
-- (pg_proc.prosrc karşılaştırıldı). Özeti:
--   WHERE search_vector @@ websearch_to_tsquery('simple', q)
--      OR title/original_title/tr_title/director ILIKE '%' || q || '%'
--   ORDER BY CASE birebir title/original_title 0, tr_title 1, diğer 2 END,
--            ts_rank(search_vector, websearch_to_tsquery('simple', q)) DESC,
--            imdb_rating DESC NULLS LAST
--   LIMIT result_limit
--
-- ── Kabul sorguları — ÖNCE (029, canlı, 6 Eki 2026, ilk 10) ─────────────────
-- SONRA: aşağıdaki gövdenin pg_temp kopyası, canlı veride (push öncesi).
--   The King     : LOTR: Return of the King · The Lion King · The King's Speech ·
--                  The King of Comedy · The King and I · The Woman King ·
--                  The Lion King (2019) · Mufasa · The Rivals of Amziah King ·
--                  The Man Who Would Be King
--   The Re       : LOTR · Girl with the Red Scarf · The Red Shoes · Raise the Red
--                  Lantern · Under the Red Hood · Friends: The Reunion · The
--                  Revenant · The Red Turtle · First Day of the Rest… · Return of
--                  Don Camillo   (katalogdaki 6 önekten 4'ü)
--   The K        : LOTR · King of the Street Cleaners · The Kid · The King's Speech
--                  · The Killing · The King of Comedy · King and the Mockingbird ·
--                  The Killer · The King and I · The Keeper
--   Kings Speech : 0 sonuç
--   Amelie       : 0 sonuç
--   the kin      : Enter the Dragon (kadro "Sek Kin") · LOTR · Street Cleaners ·
--                  The King's Speech · …
--   the god      : Aguirre, the Wrath of God · The Hand of God · The Godfather · …
--   Beau         : Beau Travail · The Wizards Return · The Nice Guys · Life Is
--                  Beautiful · American Beauty · …
--
-- ── Kabul sorguları — SONRA (126, ilk 10; [k] = kademe) ─────────────────────
--   The King     : The King's Speech · The King of Comedy · The King and I ·
--                  King of the Street Cleaners · King and the Mockingbird ·
--                  King of Laughter · The King's Warden · The Kingdom [1a] ·
--                  King Richard · King of the Doormen [1b]
--                  (The Lion King / LOTR [2] ilk 10'un dışında)
--   The Re       : The Red Shoes · The Red Turtle · The Revenant · Return of Don
--                  Camillo · The Reader · The Real Bros… [1a — 6/6 önek] ·
--                  Return of the Jedi · Reservoir Dogs · Requiem… · Rear Window [1b]
--   The K        : The King's Speech · The Killer (2023) · Keeper of Lost Causes ·
--                  The Kid · King of Comedy · The Killing · The Killer (1989) ·
--                  King and I · Street Cleaners · Killing of a Sacred Deer [1a]
--   Kings Speech : The King's Speech [0]
--   Amelie       : Amélie [0]
--   the kin      : The King's Speech · King of Comedy · King and I · … [1a];
--                  Enter the Dragon ilk 10'da yok (kadro, [4])
--   the god      : The Godfather · Part II · Part III [1a] · God's Own Country …
--                  [1b]; Aguirre ilk 10'da yok ([2])
--   Beau         : Beau Travail · Beauty and the Beast (1991) · Beautiful Boy … [1a]
--   The          : Shawshank · The Dark Knight · The Matrix · The Godfather ·
--                  LOTR ×2 · Dark Knight Rises · Two Towers · Wolf of Wall Street ·
--                  Silence of the Lambs [1a]
-- Bilinen: The Revenant "The Re"de 3. — imdb_votes'ta TMDb sayısı (19.699).
--
-- DELETE yok. Şema değişikliği yok. Yeni nesne yok.
-- ============================================================

CREATE OR REPLACE FUNCTION public.search_films(
  search_query TEXT,
  result_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  tmdb_id INTEGER,
  title TEXT,
  original_title TEXT,
  tr_title TEXT,
  year INTEGER,
  poster_url TEXT,
  director TEXT,
  imdb_rating NUMERIC(3,1),
  relevance_rank FLOAT
)
LANGUAGE plpgsql
STABLE
AS $$
#variable_conflict use_column
DECLARE
  q_raw   TEXT;     -- normalize, artikel korunmuş
  q_core  TEXT;     -- normalize, baştaki the/a/an atılmış ('' = yalnız artikel)
  q_match TEXT;     -- K2/K3/kişi için: q_core, boşsa q_raw
  q_words TEXT[];
  q_n     INT;
  q_any   TEXT[];   -- ön eleme: her kelime alt dize olarak geçmeli ('%w%')
  q_all   TEXT[];   -- K3: tam kelimeler + son kelime önek (' ' || n || ' ' üzerinde)
  q_ts    TSQUERY;  -- kadro: search_vector (GIN) üzerinde, son kelime önek
BEGIN
  -- Normalizasyon iki adım: (1) "anahtar" = lower + translate (aksan → ASCII;
  -- kesme işaretleri ve U+0307 SİLİNİR: hedef dizide karşılıkları yok) + æ/ß/œ.
  -- (2) anahtardaki [[:alnum:]] dışı → tek boşluk. Satırlarda (1) her ada,
  -- (2) yalnız ön elemeyi geçen adaylara uygulanır — sorgu aynı iki adımdan geçer.
  q_raw := btrim(regexp_replace(
             replace(replace(replace(
               translate(lower(left(coalesce(search_query, ''), 100)),
                 'àáâãäåāăąçćčďèéêëēėęěğìíîïīıįłľĺñńňòóôõöøōőřŕśşšșţťțùúûüūůűųýÿźżž''’`' || U&'\0307',
                 'aaaaaaaaacccdeeeeeeeegiiiiiiilllnnnoooooooorrsssstttuuuuuuuuyyzzz'),
               'æ', 'ae'), 'ß', 'ss'), 'œ', 'oe'),
           '[^[:alnum:]]+', ' ', 'g'));

  IF q_raw = '' THEN
    RETURN;
  END IF;

  q_core := CASE
    WHEN q_raw IN ('the', 'a', 'an') THEN ''
    ELSE regexp_replace(q_raw, '^(the|a|an) ', '')
  END;
  q_match := CASE WHEN q_core = '' THEN q_raw ELSE q_core END;

  -- q_match yalnız [[:alnum:]] ve tek boşluk içerir: LIKE/tsquery için güvenli
  -- ('%' ve '_' [[:alnum:]] değil, normalizasyonda boşluğa döner)
  q_words := string_to_array(q_match, ' ');
  q_n := array_length(q_words, 1);
  SELECT array_agg('%' || w || '%') INTO q_any FROM unnest(q_words) AS w;
  SELECT array_agg(CASE WHEN o < q_n THEN '% ' || w || ' %' ELSE '% ' || w || '%' END)
    INTO q_all FROM unnest(q_words) WITH ORDINALITY AS u(w, o);
  q_ts := to_tsquery('simple',
            array_to_string(q_words[1:q_n - 1] || (q_words[q_n] || ':*'), ' & '));

  RETURN QUERY
  WITH keys AS (
    SELECT
      v.film_id,
      v.kind,
      replace(replace(replace(
        translate(lower(v.raw),
          'àáâãäåāăąçćčďèéêëēėęěğìíîïīıįłľĺñńňòóôõöøōőřŕśşšșţťțùúûüūůűųýÿźżž''’`' || U&'\0307',
          'aaaaaaaaacccdeeeeeeeegiiiiiiilllnnnoooooooorrsssstttuuuuuuuuyyzzz'),
        'æ', 'ae'), 'ß', 'ss'), 'œ', 'oe') AS k
    FROM (
      SELECT f.id AS film_id, 't' AS kind, f.title AS raw FROM films f
      UNION ALL
      SELECT f.id, 't', f.original_title FROM films f WHERE f.original_title IS NOT NULL
      UNION ALL
      SELECT f.id, 't', f.tr_title FROM films f WHERE f.tr_title IS NOT NULL
      UNION ALL
      SELECT f.id, 'p', f.director FROM films f WHERE f.director IS NOT NULL
    ) v
    WHERE v.raw IS NOT NULL
  ),
  -- Ön eleme güvenli üst küme: (2) yalnız boşluk ekler, harf silmez/değiştirmez;
  -- bir kelime normalize adda geçiyorsa anahtarda da alt dize olarak geçer.
  names AS (
    SELECT c.film_id, c.kind, c.n, regexp_replace(c.n, '^(the|a|an) ', '') AS core
    FROM (
      SELECT k.film_id, k.kind, btrim(regexp_replace(k.k, '[^[:alnum:]]+', ' ', 'g')) AS n
      FROM keys k
      WHERE k.k LIKE ALL (q_any)
    ) c
    WHERE c.n <> ''
  ),
  scored AS (
    SELECT
      nm.film_id,
      min(CASE
        WHEN nm.kind = 't' AND (nm.n = q_raw OR (q_core <> '' AND nm.core = q_core)) THEN 0
        WHEN nm.kind = 't' AND nm.n LIKE q_raw || '%' THEN 1
        WHEN nm.kind = 't' AND q_core <> '' AND nm.core LIKE q_core || '%' THEN 2
        WHEN nm.kind = 't' AND nm.n LIKE '%' || q_match || '%' THEN 3
        WHEN nm.kind = 't' AND (' ' || nm.n || ' ') LIKE ALL (q_all) THEN 4
        WHEN nm.kind = 'p' AND (nm.n LIKE '%' || q_match || '%'
                                OR (' ' || nm.n || ' ') LIKE ALL (q_all)) THEN 5
      END) AS tier,
      bool_or(nm.kind = 't' AND ((' ' || nm.n || ' ') LIKE '% ' || q_match || ' %'
                                 OR (' ' || nm.n || ' ') LIKE '% ' || q_match || 's %')) AS whole_word
    FROM names nm
    GROUP BY nm.film_id
  ),
  -- Kadro yalnız search_vector'da (D ağırlığı) — GIN index'li
  cast_hits AS (
    SELECT f.id AS film_id FROM films f WHERE f.search_vector @@ q_ts
  ),
  ranked AS (
    -- Kolonlar açıkça: films'e ileride tier/whole_word adlı kolon eklenirse
    -- r.tier belirsizleşmesin (42702)
    SELECT
      f.id, f.tmdb_id, f.title, f.original_title, f.tr_title, f.year,
      f.poster_url, f.director, f.imdb_rating, f.imdb_votes, f.curation_tier,
      COALESCE(s.tier, CASE WHEN ch.film_id IS NOT NULL THEN 5 END) AS tier,
      COALESCE(s.whole_word, false) AS whole_word
    FROM films f
    LEFT JOIN scored s ON s.film_id = f.id
    LEFT JOIN cast_hits ch ON ch.film_id = f.id
    WHERE s.film_id IS NOT NULL OR ch.film_id IS NOT NULL
  )
  SELECT
    r.id,
    r.tmdb_id,
    r.title,
    r.original_title,
    r.tr_title,
    r.year,
    r.poster_url,
    r.director,
    r.imdb_rating,
    ((5 - r.tier) / 5.0)::FLOAT AS relevance_rank
  FROM ranked r
  WHERE r.tier IS NOT NULL
  ORDER BY
    r.tier,
    r.whole_word DESC,
    CASE r.curation_tier
      WHEN 'core' THEN 0
      WHEN 'extended' THEN 1
      WHEN 'trending' THEN 1
      ELSE 2
    END,
    NULLIF(r.imdb_votes, 0) DESC NULLS LAST,
    r.imdb_rating DESC NULLS LAST,
    r.title,
    r.id
  LIMIT LEAST(result_limit, 25);
END;
$$;

-- 029 ile aynı (CREATE OR REPLACE yetkiyi korur; açıkça yinelenir)
GRANT EXECUTE ON FUNCTION public.search_films(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_films(TEXT, INT) TO anon;
