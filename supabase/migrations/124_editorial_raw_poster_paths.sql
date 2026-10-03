-- ============================================================
-- 124 — Editoryal takvimdeki 33 filmin ham poster/backdrop yolunu tam URL'e çevir
--
-- ── Neden ────────────────────────────────────────────────────────────────
-- `scripts/seed-database.ts:283-284` TMDb `poster_path`/`backdrop_path`'i ham
-- (`/abc.jpg`) yazdı (2026-03-09 / 03-20). Ham yol geçerli bir URI değil.
-- Spotlight çözüm havuzu 30 Eyl'den beri `editorial_calendar_films`; bu
-- havuzdaki 33 filmin ikisi de ham. Spotlight yolu normalize etmediği için bu
-- filmler çözüm olduğunda oyun karesi, bonus kartı ve sonuç posteri çizilmez.
-- İlki (Ocean's Eleven) tahminen 2026-10-25 (P-1b §6).
--
-- ── Kapsam: YALNIZ bu 33 satır ──────────────────────────────────────────
-- 948 ham satırın toplu dönüşümü kapsam dışı (P-1c kararı). Her satır id +
-- ESKİ değerle eşlenir; eski değer değiştiyse satır güncellenmez ve guard
-- migration'ı durdurur.
--
-- ── Biçim ───────────────────────────────────────────────────────────────
-- `https://image.tmdb.org/t/p/original` + path — mevcut 2.579 tam-URL
-- satırının biçimi (sync-trending / fetch-films ile aynı). 66 URL'in tamamı
-- 3 Eki 2026'da HEAD 200 döndü (docs/investigations/P1c_ADIM0_KESIF.md §5).
-- Path'lerin hepsi `^/[A-Za-z0-9]+\.jpg$` desenine uyuyor.
--
-- DELETE yok (CLAUDE.md #4). Şema değişikliği yok.
-- ============================================================

CREATE TEMP TABLE _p1c_raw_paths (
  film_id      uuid PRIMARY KEY,
  old_poster   text NOT NULL,
  old_backdrop text NOT NULL
);

INSERT INTO _p1c_raw_paths (film_id, old_poster, old_backdrop) VALUES
    ('ddf32d20-9c85-4f78-98db-ca0cfb417d8d'::uuid, '/hQQCdZrsHtZyR6NbKH2YyCqd2fR.jpg', '/ncoqdHs1poUaBqyKic9YI8ai7MP.jpg'),
    ('4ee7f4f4-41aa-4113-858d-11a54e3b9751'::uuid, '/6Njyz53N417cgxE0d7cBEWHUEjc.jpg', '/23jok5sYloPEBwKd6Bp4V8Y1O9I.jpg'),
    ('4ebd2e6d-960e-465f-b9c4-26656a3a7ef4'::uuid, '/2FC9L9MrjBoGHYjYZjdWQdopVYb.jpg', '/2CisgvF2HcIVnbMZbSjASCtSgEb.jpg'),
    ('2c5a608f-5cb1-45ba-94c6-dd9355337305'::uuid, '/AkJQpZp9WoNdj7pLYSj1L0RcMMN.jpg', '/5jnoAA74Qwb5w6B9FMvnc20n6Ie.jpg'),
    ('f81715cf-84ec-4cd2-907d-b9269ea2bf7a'::uuid, '/g5IoYeudx9XBEfwNL0fHvSckLBz.jpg', '/4jSTo5o597cURiEROqi9pVCCSbg.jpg'),
    ('21acbc8e-d76c-418e-85d1-5154596adb6d'::uuid, '/1NxGNQchGBTHXJ6RShLY1IlZqWn.jpg', '/4oWU9FPOvjCE85DaHm4vo89Whpz.jpg'),
    ('542925e1-ece4-40f6-95e7-d5acf43c832c'::uuid, '/6gt44oqb4nE8vflPElffeGwsHVl.jpg', '/4T2d3Ww0pNRFYS9eWHyDjkJSovq.jpg'),
    ('58e965db-c419-4a90-a183-7496ffe5e292'::uuid, '/tYfijzolzgoMOtegh1Y7j2Enorg.jpg', '/fctQU5MoXgJ5pNMljFzlEFXwfSu.jpg'),
    ('6fbf049a-86a4-498b-a26e-f35ca18f427b'::uuid, '/b3lllDltoBws5uKZzBYVSjpjjJx.jpg', '/a3FaHEGActk76BeCBingyOvEqnm.jpg'),
    ('121918a7-1ad4-4c7d-9086-9e62d12b16ed'::uuid, '/7nW363kSYRCkr4VGOMvuSGwtzKs.jpg', '/p1XSyBriqz7oBWoVcRqYlB6Kve3.jpg'),
    ('f806fed3-4e69-47d7-a2bf-f1d75d16420f'::uuid, '/7ht2IMGynDSVQGvAXhAb83DLET8.jpg', '/5INPBiKVRsyp9kgHfsC0cTfvKFH.jpg'),
    ('c9bad052-079c-4196-b4ca-5fee393c9d11'::uuid, '/aotTZos5KswgCryEzx2rlOjFsm1.jpg', '/b0XkgWgCBurkCZdNXp7kEZdgxEi.jpg'),
    ('74ebfc5e-10a8-48d4-9b33-9da6c03dadeb'::uuid, '/gt3iyguaCIw8DpQZI1LIN5TohM2.jpg', '/mKIkGoyuR71qz6FdiEiOjxvBQcS.jpg'),
    ('e7360d83-4261-4c35-b573-3d84674ef1fb'::uuid, '/6a2HY6UmD7XiDD3NokgaBAXEsD2.jpg', '/mRM2NB0i3wv4HqxXvwIjEVi4Qqq.jpg'),
    ('aa01a9c2-558c-4143-8ba7-59ea2da83b8d'::uuid, '/4yFG6cSPaCaPhyJ1vtGOtMD1lgh.jpg', '/1vXD5HXqkhvsXFHE7KmCPZGPR1e.jpg'),
    ('c6d6654f-ea18-4635-a876-49294e295076'::uuid, '/dxraF0qPr1OEgJk17ltQTO84kQF.jpg', '/7py8kUCYaOdFn1TfVS87BDBySOz.jpg'),
    ('8b75b450-8f43-40c7-aa88-49f5063cae26'::uuid, '/lQcXgb0fFzffnLV5WY0Q0X2WW7E.jpg', '/gFGLwUBhVrq0bq4j9DU08xQDRU2.jpg'),
    ('dd0803f3-57fc-4ef4-bc80-ade33542da88'::uuid, '/1vFhSr7INoulu18smHqicft05i8.jpg', '/jUaZAbdpNl33VHprUl4qEohXn8q.jpg'),
    ('dc7bd17f-80a2-4f43-bad3-17657e4ce894'::uuid, '/yY6ypZPQl67J4RwOA6YBALNS3Wj.jpg', '/tw1IZuR6GVlSL4aqfsmLFfUJAN9.jpg'),
    ('d9b27171-757c-4087-a804-0699b5186c1c'::uuid, '/h7Lcio0c9ohxPhSZg42eTlKIVVY.jpg', '/lgBZlJ1LHQel5nneNQMoesmvc7l.jpg'),
    ('63c9942f-fc1e-4d0d-aac1-ee3275d1d4dd'::uuid, '/aewan59WcFThBimkTVVoNf2o5Vb.jpg', '/9IYyCLf5NNAQFK9pNtqzEU9HWzM.jpg'),
    ('89d7cf26-1b41-441c-b726-2a683e7d69d3'::uuid, '/4wBG5kbfagTQclETblPRRGihk0I.jpg', '/gR1LRuvKTzh2AvxGvfoBNNJHPMq.jpg'),
    ('043911e2-307b-4092-b4df-8f062b5df800'::uuid, '/15rMz5MRXFp7CP4VxhjYw4y0FUn.jpg', '/qiBILuWhv7ipF0pxiEqIJdkQzj8.jpg'),
    ('10f3c8c0-c094-4c2a-bfb4-6f65587cd986'::uuid, '/lMrxYKKhd4lqRzwUHAy5gcx9PSO.jpg', '/mXFmGlMCgTIOyHaGmQG1Hb6Rv2m.jpg'),
    ('80f59a4d-3560-4363-82ce-53006befe6f9'::uuid, '/tYzFuYXmT8LOYASlFCkaPiAFAl0.jpg', '/oVD3ClJBoomSQHtnJPAlMfes8YD.jpg'),
    ('f7455189-ccff-4004-a268-08ad3ad0442b'::uuid, '/zPib4ukTSdXvHP9pxGkFCe34f3y.jpg', '/9rMSCFH9zhv1vILpEZQlUJs9iUm.jpg'),
    ('7fb1905c-676c-423f-887e-2ee9153494a2'::uuid, '/9LTQNCvoLsKXP0LtaKAaYVtRaQL.jpg', '/leehjwM57DKJ79XMUll4oAF0kin.jpg'),
    ('f8d6fa68-f2ce-411f-9338-a9ce2b426bc9'::uuid, '/bCpMIywuNZeWt3i5UMLEIc0VSwM.jpg', '/yFkUPqBuUnbhYbQL8VFpTrAT9za.jpg'),
    ('b5a975e6-a3b9-4e22-8c42-f5669c823432'::uuid, '/pySivdR845Hom4u4T2WNkJxe6Ad.jpg', '/kQGxGXzYiCumY8kmXXpgbZyZQK8.jpg'),
    ('c294c9b2-7bbb-4d1e-b806-ecf5fb70311f'::uuid, '/2BvtvDUyxiMJ4dmKfiQf4qdOHQN.jpg', '/qRwkMMZhQRKM4uDaXpd2XbZZmkE.jpg'),
    ('3a214e4e-9438-4e81-96c7-5ba990d06565'::uuid, '/rHUg2AuIuLSIYMYFgavVwqt1jtc.jpg', '/s0OrExdg7i3RLR7oqzHRk4q2kL4.jpg'),
    ('47c331c3-d808-4fda-b0fd-8c9f301fbea9'::uuid, '/nBM9MMa2WCwvMG4IJ3eiGUdbPe6.jpg', '/4V1yIoAKPMRQwGBaSses8Bp2nsi.jpg'),
    ('9688fcab-7307-43e7-8c30-4a8d316b15fe'::uuid, '/1OJ9vkD5xPt3skC6KguyXAgagRZ.jpg', '/kRVUMsXFzhuXjr20JcCGc6TapxA.jpg');

-- ── Ön guard: 33 satırın tamamı beklenen ham değerde mi ────────────────────
DO $pre$
DECLARE
  matched int;
BEGIN
  SELECT count(*) INTO matched
  FROM films f
  JOIN _p1c_raw_paths r ON r.film_id = f.id
  WHERE f.poster_url = r.old_poster
    AND f.backdrop_url = r.old_backdrop;

  IF matched <> 33 THEN
    RAISE EXCEPTION
      'ABORT 124: beklenen 33 ham satır, eşleşen %. Veri değişmiş — migration uygulanmadı.',
      matched;
  END IF;
END;
$pre$;

-- ── Dönüşüm ──────────────────────────────────────────────────────────────
UPDATE films f
SET poster_url   = 'https://image.tmdb.org/t/p/original' || r.old_poster,
    backdrop_url = 'https://image.tmdb.org/t/p/original' || r.old_backdrop
FROM _p1c_raw_paths r
WHERE f.id = r.film_id
  AND f.poster_url = r.old_poster
  AND f.backdrop_url = r.old_backdrop;

-- ── Son guard: 33 satır tam URL, editoryal takvimde ham yol kalmadı ────────
DO $post$
DECLARE
  converted int;
  remaining int;
BEGIN
  SELECT count(*) INTO converted
  FROM films f
  JOIN _p1c_raw_paths r ON r.film_id = f.id
  WHERE f.poster_url   = 'https://image.tmdb.org/t/p/original' || r.old_poster
    AND f.backdrop_url = 'https://image.tmdb.org/t/p/original' || r.old_backdrop;

  IF converted <> 33 THEN
    RAISE EXCEPTION 'ABORT 124: dönüştürülen % / 33.', converted;
  END IF;

  SELECT count(*) INTO remaining
  FROM editorial_calendar_films e
  JOIN films f ON f.id = e.film_id
  WHERE f.poster_url NOT LIKE 'http%' OR f.backdrop_url NOT LIKE 'http%';

  IF remaining <> 0 THEN
    RAISE EXCEPTION 'ABORT 124: editoryal takvimde % ham yollu film kaldı.', remaining;
  END IF;

  RAISE NOTICE '124: 33 film tam URL''e çevrildi; editoryal takvimde ham yol 0.';
END;
$post$;

DROP TABLE _p1c_raw_paths;

-- ============================================================
-- DOWN (ELLE): aynı 33 satır için ters yön —
--   UPDATE films SET poster_url = substr(poster_url, length('https://image.tmdb.org/t/p/original') + 1),
--                    backdrop_url = substr(backdrop_url, length('https://image.tmdb.org/t/p/original') + 1)
--   WHERE id IN (<yukarıdaki 33 id>);
-- Geri almak ham (geçersiz) URI'yi geri getirir; yalnız bu migration'ı
-- yanlış satıra uyguladığın kanıtlanırsa.
--
-- DOĞRULAMA (push sonrası):
--   SELECT count(*) FROM editorial_calendar_films e JOIN films f ON f.id = e.film_id
--   WHERE f.poster_url NOT LIKE 'http%' OR f.backdrop_url NOT LIKE 'http%';   -- 0
--   SELECT count(*) FROM films WHERE poster_url LIKE '/%';                      -- 915 (948 − 33)
-- ============================================================
