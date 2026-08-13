-- ============================================================
-- 078 — films sema mutabakati
-- Canlida migration disi olusmus 3 sapma migration takibine alinir.
-- Kaynak tespit edilemedi: 187 commit tarandi, repoda hicbir iz yok.
-- Bu migration CANLIDA davranis degisikligi YARATMAZ; amaci temiz bir
-- ortamda ayni semanin dogmasini saglamaktir.
-- Kurban restorasyonu ve pre_trending_tier backfill'i → 079
-- ============================================================
--
-- ── Sapmalarin tespiti (ADIM 0.7, 13 Agu 2026) ──────────────────────────────
-- films tablosunun canli dokumu migration'larla satir satir karsilastirildi:
--   kolon 35/35 · constraint 5/5 · index 17/17 · trigger 2/2
-- Constraint, index ve trigger tarafinda sapma YOK. Uc sapma kolonlarda:
--
--   1. trailer_url        canlida var, hicbir migration yaratmiyor
--   2. release_date       028 TEXT yaratiyor, canlida date
--   3. pre_trending_tier  canlida var, hicbir migration yaratmiyor, kisitsiz
--
-- Migration'larin urettigi kolon sayisi 33, canlida 35. Fark tam olarak
-- trailer_url + pre_trending_tier. Yani sapma envanteri kapali.
--
-- ── Neden bu migration "hicbir sey yapmiyor" gibi gorunuyor ─────────────────
-- Canlida 1.1 ve 1.2 bilerek NO-OP'tur: kolon zaten var, tip zaten date.
-- Deger uretmedikleri yer canli degil, TEMIZ ortamdir. 001..077 bir sifir
-- veritabanina uygulandiginda trailer_url hic dogmuyor ve release_date text
-- kaliyordu; bu dosya o iki farki kapatir. Yalnizca 1.3 canlida gercek bir
-- islem yapar (kisitsiz kolonu CHECK'li haliyle yeniden yaratir) ve o da
-- veri tasimaz cunku kolon 0/3404 doludur.
-- ============================================================


-- ------------------------------------------------------------------------
-- 1.1 · trailer_url — mutabakat (DROP YOK)
--
-- Kolon app/film/[id].tsx tarafindan okunuyor. DROP EDILEMEZ.
--
-- Olcum (13 Agu 2026): 0/3404 dolu — kolon tamamen bos. Yani koruma
-- gerekcesi VERI degil KOD'dur: DROP edilirse film detay ekrani PostgREST'ten
-- "column does not exist" alir. Veri kaybi riski sifir.
--
-- Burada IF NOT EXISTS DOGRU secim — pre_trending_tier'in aksine bu kolon
-- kullanimda ve canli tanimi biliniyor (text, nullable, default yok).
-- Amac korumak, yeniden yaratmak degil.
-- ------------------------------------------------------------------------
ALTER TABLE films ADD COLUMN IF NOT EXISTS trailer_url text;

COMMENT ON COLUMN films.trailer_url IS
  'Migration disi olusmus, 078 ile mutabakata alindi. Canli tanim: text, nullable, default yok.';


-- ------------------------------------------------------------------------
-- 1.2 · release_date — tip mutabakati, KOSULLU
--
-- Migration 028 satir 21 `release_date TEXT` yaratiyor, canlida kolon `date`.
-- Hicbir migration'da ALTER COLUMN ... TYPE date yok; tip elle degistirilmis.
--
-- Canlida zaten date oldugu icin kosulsuz ALTER TYPE gereksiz is yapar
-- (3404 satirlik tablo yeniden yazilir). Kosullu yazildi: canlida ELSE dali,
-- temiz ortamda THEN dali calisir.
--
-- NULLIF(trim(...), '') ZORUNLU. Gerekcesi varsayimsal degil:
-- sync-trending/index.ts:203 `release_date: detail.release_date ?? ''`
-- yaziyor. Temiz bir ortamda kolon TEXT'ken oraya bos string'ler girer ve
-- ''::date "invalid input syntax for type date" ile push'u patlatirdi.
-- ------------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_name='films' AND column_name='release_date') = 'text' THEN
    ALTER TABLE films
      ALTER COLUMN release_date TYPE date
      USING NULLIF(trim(release_date), '')::date;
    RAISE NOTICE '078: release_date text -> date donusturuldu';
  ELSE
    RAISE NOTICE '078: release_date zaten date, atlandi';
  END IF;
END $$;


-- ------------------------------------------------------------------------
-- 1.3 · pre_trending_tier — ciplak kolonun mutabakati
--
-- Kolon canlida var ama KISITSIZ (CHECK yok) ve 0/3404 dolu. IF NOT EXISTS
-- KULLANILMIYOR: bilinmeyen/kisitsiz tanimi oldugu gibi korur ve kalici bir
-- yerel-uzak uzaksamasi birakirdi. Kolon tamamen bos oldugu icin bosaltilip
-- CHECK'li haliyle yeniden yaratmanin veri maliyeti yoktur.
--
-- CHECK bu turda ekleniyor (backfill 079'da) cunku aradaki pencerede kolona
-- yanlis deger yazilmasini engellemesi gerekiyor. Bu bir kisit eklemesidir,
-- davranis degisikligi degil: kolon bos ve hicbir kod yoluna bagli degil.
--
-- ABORT guard'i kasitli: kolonun bos olmasi bu adimin on kosuludur. Dolu
-- gelirse 078 ile 0.6 olcumu arasinda birinin oraya yazdigi anlamina gelir
-- ve DROP sessiz veri kaybi olurdu. O durumda push patlar, insan bakar.
-- ------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM films WHERE pre_trending_tier IS NOT NULL) THEN
    RAISE EXCEPTION
      'ABORT: pre_trending_tier NULL degil. Beklenen durum tamamen bos kolon. Manuel inceleme gerekli.';
  END IF;
END $$;

ALTER TABLE films DROP COLUMN IF EXISTS pre_trending_tier;

ALTER TABLE films ADD COLUMN pre_trending_tier text
  CONSTRAINT films_pre_trending_tier_check
  CHECK (pre_trending_tier IN ('core','extended','archive'));

COMMENT ON COLUMN films.pre_trending_tier IS
  $c$Trending e cikarken saklanan onceki tier. Duserken COALESCE(pre_trending_tier, 'archive') ile geri yuklenir. 'trending' degeri CHECK ile YASAK: cift promosyonda film kendi trending durumunu onceki tier sanip kilitlenir. Migration disi olusmustu, 078 ile bosaltilip yeniden yaratildi.$c$;


-- ============================================================
-- DOWN SCRIPT — geri alma (ELLE calistirilir, migration olarak DEGIL)
-- ============================================================
-- 1.3 · pre_trending_tier
--   ALTER TABLE films DROP COLUMN IF EXISTS pre_trending_tier;
--   NOT: 078 oncesi hali "kisitsiz text kolon" idi. Ona donmek anlamsiz
--   oldugu icin DROP yeterli. Kolon 0/3404 dolu, veri kaybi yok.
--
-- 1.1 · trailer_url — GERI ALINAMAZ
--   DROP EDILMEZ. app/film/[id].tsx kolonu okuyor; DROP edilirse film
--   detay ekrani PostgREST'ten "column does not exist" alir.
--   Bu madde bilincli olarak down kapsaminin disindadir.
--
-- 1.2 · release_date — GERI ALINMAZ
--   date -> text donusumu geri alinabilir ama YAPILMAMALI: canlida kolon
--   zaten date idi, 078 orada NO-OP calisti. Geri cevirmek 078 oncesi
--   duruma donus DEGIL, yeni bir bozulma olurdu.
-- ============================================================


-- ============================================================
-- 078 SONRASI DURUM (kayit)
-- ============================================================
-- films: 3404 satir (archive 1540 · extended 948 · core 860 · trending 56)
-- Sapma: 3/3 mutabakata alindi. Kalan bilinen sapma yok.
--
-- ACIK KALEMLER (079 ve sonrasi):
--   * 3 kurban film tier restorasyonu               -> 079
--   * pre_trending_tier backfill (trending'deki 56) -> 079
--   * tmdb_vote_count kolonu                        -> 079
--   * 4 GAP filmi (rating var, kriter core uretmiyor) -> borc
--   * 10 trending film profile_vector NULL          -> GATE 3
--   * weekly-trending-sync active=false             -> 079+GATE 3 sonrasi acilir
--   * supabase db diff calistirilmadi (Docker yok)  -> C.0e oncesi borc
-- ============================================================
