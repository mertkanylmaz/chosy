-- ============================================================
-- 079 — trending tier restorasyonu + kalan sema borclari
-- 078'in acik biraktigi kalemler kapatilir:
--   * tmdb_vote_count kolonu
--   * cron_job_status fonksiyonu migration takibine alinir
--   * 3 kurban filmin tier restorasyonu
--   * trending'deki 56 filmin pre_trending_tier backfill'i
--   * curation_tier NOT NULL
--
-- 078'in aksine bu migration CANLIDA VERI DEGISTIRIR (1.3 ve 1.4).
-- ============================================================
--
-- ── Neden bu migration var: tier mandali ────────────────────────────────────
-- sync-trending bir filmi trending'e cikarirken eski curation_tier'ini
-- pre_trending_tier'a saklar, duserken COALESCE(pre_trending_tier,'archive')
-- ile geri yukler. Mandal 80857fc ile onarildi ama GECMISE ISLEMIYOR:
-- bugun trending'deki 56 filmin pre_trending_tier degeri NULL, yani cron
-- acilirsa 56'si da archive'e duserdi. 1.4 o bosluk doldurur.
--
-- Ayni hata gecmiste zaten calisti: trending_added_at dolu olup artik
-- trending olmayan 88 film var ve HEPSI archive'da. Bunlarin 3'u gercekten
-- daha yuksek bir tier'a aitti; 1.3 onlari geri alir.
--
-- ── Tier turetmesi: SAF 045/046, seed katmani DEGIL ─────────────────────────
-- Turetme YALNIZCA su kolonlara bakar: imdb_rating, imdb_votes, year.
--   045A  imdb_rating IS NULL              -> archive
--   045B  imdb_votes  < 10000              -> archive
--   045C  rating >= 7.0 AND votes >= 50000 -> core
--   045D  votes >= 100000 AND rating >= 6.0 -> core
--   046A  core + year < 1990      + votes < 200000 -> extended
--   046B  core + year 1990..1999  + votes < 100000 -> extended
--   hicbir dal eslesmezse -> BELIRSIZ (deger YAZILMAZ)
--
-- scripts/assign-tiers.ts icindeki metascore / auteur listesi / oscar /
-- criterion keyword kriterleri BU TURETMEYE DAHIL DEGILDIR. Onlar seed
-- katmanidir ve tekil bir filme uygulanip uygulanmadigi kayittan
-- dogrulanamaz; migration'a girmeleri kanit degil varsayim olurdu.
--
-- ── A / B sinifi ayrimi (esik: 1 saat) ──────────────────────────────────────
-- trending'deki 56 film ikiye ayrilir:
--   A (46 film)  trending_added_at - created_at > 1 saat
--                film DAHA ONCE katalogdaydi, bir onceki tier'i VARDI
--   B (10 film)  fark <= 1 saat
--                film sync-trending tarafindan o an yaratildi, oncesi YOK
--
-- Esik keyfi degil, olcume dayali: B sinifinin en buyuk farki 0.033 saat,
-- A sinifinin en kucuk farki 152.166 saat. Aradaki bosluk ~4750 kat, yani
-- 1 saatlik esigin nereye konuldugu sonucu degistirmiyor.
--
-- B sinifinin 10'u da pre_trending_tier NULL KALIR. Bu bir eksiklik degil
-- dogru degerdir: oncesi olmayan filmin saklanacak tier'i da yoktur, ve
-- duserken COALESCE(NULL,'archive') = archive dogru sonucu uretir.
--
-- ── BELIRSIZ 2 film — bilerek NULL birakiliyor ──────────────────────────────
--   7c1f2ec5-a3d9-4972-9393-ecb65f97a2d1  The Super Mario Galaxy Movie
--                                         (2026) r=6.4  v=33056
--   340be1ee-6e12-4713-873a-9e43bb85b7e4  The Drama
--                                         (2026) r=7.5  v=26572
--
-- Bu ikisinde saf 045/046'nin HICBIR DALI eslesmiyor: votes degerleri 045B
-- esiginin (10000) USTUNDE oldugu icin archive'a dusmuyorlar, 045C (v>=50000)
-- ve 045D (v>=100000) esiklerinin ALTINDA oldugu icin core da olmuyorlar.
-- Dolayisiyla onceki tier'lari turetilemez. Tahmin migration'a giremez;
-- ikisi de NULL kalir ve duserken archive'a giderler.
--
-- Kayit icin: bu iki UUID burada yaziliyor ki ileride gercek tier'lari
-- baska bir kanittan bulunursa hangi filmlerin acikta kaldigi bilinsin.
--
-- ── Neden archive degerleri de ACIKCA yaziliyor ─────────────────────────────
-- 38 filmin turetmesi zaten 'archive' ve COALESCE varsayilani da 'archive'.
-- Yine de yaziliyorlar, iki gerekce:
--   1. NULL su an IKI ayri sey demek: "onceki tier yok" (B sinifi) ile
--      "onceki tier archive'di" (A sinifi). Acik yazim bu ikisini ayirir.
--   2. sync-trending'in dusurme mantigi COALESCE(pre_trending_tier,'archive')
--      kullaniyor. Varsayilan bir gun degisirse acik deger yazilmis filmler
--      etkilenmez.
-- ============================================================


-- ------------------------------------------------------------------------
-- 1.1 · tmdb_vote_count — TMDb oy sayisi icin ayri kolon
--
-- films.imdb_votes gecmiste iki farkli metrigi tasidi: OMDb'nin IMDb oyu ve
-- TMDb'nin vote_count'u. sync-trending artik oraya TMDb sayisi YAZMIYOR
-- (index.ts:268 `imdb_votes: null`), ham TMDb sayisi metadata_json.vote_count
-- icinde tutuluyor. Bu kolon o degerin kalici ve sorgulanabilir evidir.
--
-- Kolon bu turda YALNIZCA yaratiliyor, DOLDURULMUYOR. Hicbir kod yolu
-- yazmiyor/okumuyor (grep: 0 referans). Doldurma ve sync-trending'in buraya
-- yazmasi ayri bir istir; bu migration onu USTLENMEZ.
--
-- IF NOT EXISTS: kolon canlida yok, temiz ortamda da yok. Idempotentlik icin.
-- ------------------------------------------------------------------------
ALTER TABLE films ADD COLUMN IF NOT EXISTS tmdb_vote_count integer;

COMMENT ON COLUMN films.tmdb_vote_count IS
  $c$TMDb vote_count. imdb_votes ile KARISTIRILMAZ: imdb_votes'un tek kaynagi OMDb'dir. 079'da yaratildi, HENUZ DOLDURULMADI (0/3404) ve hicbir kod yolu okumuyor. Doldurma kaynagi: metadata_json.vote_count.$c$;


-- ------------------------------------------------------------------------
-- 1.2 · cron_job_status() — migration disi olusmus fonksiyon
--
-- Fonksiyon canlida VAR ve calisiyor (service_role ile 7 satir donuyor) ama
-- hicbir migration onu yaratmiyor; 078'in kolon sapmalariyla ayni sinifta bir
-- sapma. Temiz bir ortamda 001..078 uygulandiginda bu fonksiyon HIC dogmuyor.
-- 079 ile kontrole aliniyor.
--
-- ⚠️ CREATE OR REPLACE GRANT'LARI SIFIRLAMAZ — mevcut izinler oldugu gibi
-- kalir. Bu yuzden REVOKE/GRANT bloklari ASAGIDA ACIKCA yaziliyor; niyetin
-- kayda gecmesi ve temiz ortamda ayni izin tablosunun dogmasi icin.
--
-- Yetki karari: yalnizca service_role. Fonksiyon operasyonel bir teshis
-- aracidir, urun yuzeyi degil; hicbir istemci kodu cagirmiyor (grep: 0
-- referans). PUBLIC/anon/authenticated'dan ACIKCA geri alinir.
--
-- SECURITY DEFINER gerekcesi: cron.job satirlari sahibine gore filtrelenir;
-- job'larin sahibi postgres oldugu icin service_role invoker olarak BOS kume
-- gorurdu. Canlida 7 satir donmesi fonksiyonun zaten DEFINER oldugunu
-- gosteriyor. `SET search_path = ''` + tam nitelenmis cron.job, DEFINER
-- fonksiyonlarda zorunlu guvenlik desenidir.
--
-- 079 oncesi olculen durum (13 Agu 2026):
--   prosecdef = true, owner = postgres  -> SECURITY DEFINER zaten dogruydu
--   grantee = service_role, postgres (EXECUTE)  -> anon/authenticated hic
--   yoktu, REVOKE bu migration'da bir SIKILASTIRMA DEGIL, mevcut durumun
--   acikca kayda gecirilmesidir.
-- ------------------------------------------------------------------------

-- Imza on kontrolu: CREATE OR REPLACE bir fonksiyonun DONUS TIPINI
-- degistiremez. Canlidaki tip beklenenden farkliysa asagidaki CREATE
-- "cannot change return type of existing function" ile patlardi; bu guard
-- ayni durumu ANLASILIR bir mesajla ve daha erken bildirir.
DO $sig$
DECLARE
  existing_result text;
BEGIN
  SELECT pg_get_function_result(p.oid) INTO existing_result
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'cron_job_status'
    AND p.pronargs = 0;

  IF existing_result IS NULL THEN
    RAISE NOTICE '079: cron_job_status yok (temiz ortam) — yeni yaratilacak.';
  ELSIF existing_result <> 'TABLE(jobid bigint, jobname text, schedule text, active boolean)' THEN
    RAISE EXCEPTION
      'ABORT: cron_job_status() donus tipi beklenenden farkli: %. '
      'Beklenen: TABLE(jobid bigint, jobname text, schedule text, active boolean). '
      'CREATE OR REPLACE donus tipini degistiremez. Once canlidaki tanim '
      'incelenmeli; DROP + CREATE gerekiyorsa bu ayri bir karardir.',
      existing_result;
  ELSE
    RAISE NOTICE '079: cron_job_status imzasi eslesti, REPLACE ediliyor.';
  END IF;
END;
$sig$;

CREATE OR REPLACE FUNCTION public.cron_job_status()
RETURNS TABLE(jobid bigint, jobname text, schedule text, active boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT j.jobid, j.jobname, j.schedule, j.active
  FROM cron.job j
  ORDER BY j.jobid;
$fn$;

COMMENT ON FUNCTION public.cron_job_status() IS
  $c$cron.job envanterinin salt-okunur ozeti. Migration disi olusmustu, 079 ile kontrole alindi. Operasyonel teshis aracidir; hicbir istemci kodu cagirmaz. Yetki: yalnizca service_role.$c$;

-- Izinler ACIKCA yazilir — CREATE OR REPLACE mevcut grant'lari korudugu icin
-- bu bloklar olmadan canlidaki izin durumu bilinmez ve kayitsiz kalirdi.
REVOKE ALL ON FUNCTION public.cron_job_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cron_job_status() FROM anon;
REVOKE ALL ON FUNCTION public.cron_job_status() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cron_job_status() TO service_role;


-- ------------------------------------------------------------------------
-- 1.3 · 3 kurban filmin tier restorasyonu
--
-- Bu uc film katalogda gercek bir tier'a sahipken trending'e cikarildi,
-- sonra mandal calismadigi icin archive'a dusuruldu. Turetmeleri saf
-- 045/046 ile yeniden hesaplandi ve canlidaki imdb_rating / imdb_votes /
-- year degerleriyle dogrulandi.
--
-- Her UPDATE, filmin HALA archive oldugunu kosul olarak tasir. Aradan
-- gecen surede biri tier'i elle duzelttiyse UPDATE 0 satir eder ve guard
-- patlar — sessizce uzerine yazmaz.
--
-- pre_trending_tier bu uc film icin NULL BIRAKILIR: artik trending
-- degiller, saklanacak bir "onceki tier" durumlari yok.
-- ------------------------------------------------------------------------
DO $restore$
DECLARE
  n integer;
BEGIN
  -- 045C · r=7.8 v=243676 y=1971
  -- 046A UYGULANMAZ: votes 243676 >= 200000 esigi
  UPDATE films SET curation_tier = 'core'
  WHERE id = '03b083bb-acb3-44ac-ad70-bb1a8ed70b9c'  -- Willy Wonka & the Chocolate Factory
    AND curation_tier = 'archive';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'ABORT: Willy Wonka restore % satir etkiledi (beklenen 1). Film archive degil ya da id degismis.', n;
  END IF;

  -- 045C · r=7.3 v=168453 y=2025
  -- 046A/046B uygulanmaz: year >= 2000
  UPDATE films SET curation_tier = 'core'
  WHERE id = 'f15f6104-8c49-43ac-9522-757801b47592'  -- Avatar: Fire and Ash
    AND curation_tier = 'archive';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'ABORT: Avatar Fire and Ash restore % satir etkiledi (beklenen 1).', n;
  END IF;

  -- 045C -> 046B · r=8.1 v=75102 y=1997
  -- 046B UYGULANIR: year 1990..1999 araliginda ve votes 75102 < 100000
  -- Bu yuzden core DEGIL extended.
  UPDATE films SET curation_tier = 'extended'
  WHERE id = '05ca31a0-19db-4a6e-b3fc-ccd461f93548'  -- Neon Genesis Evangelion: The End of Evangelion
    AND curation_tier = 'archive';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'ABORT: End of Evangelion restore % satir etkiledi (beklenen 1).', n;
  END IF;

  RAISE NOTICE '079 · 1.3: 3 kurban restore edildi (2 core, 1 extended).';
END;
$restore$;


-- ------------------------------------------------------------------------
-- 1.4 · pre_trending_tier backfill — 44 satir
--
-- Kapsam: trending'deki 56 filmden A sinifi olan ve turetmesi belirli
-- olan 44'u. Dagilim: 38 archive + 6 core. ('extended' turetmesi cikan
-- film YOK — 046A/046B dallari bu kumede hicbir filme uymuyor.)
--
-- YAZILMAYAN 12 film:
--   10 B sinifi   — oncesi yok, NULL dogru deger
--    2 BELIRSIZ   — turetilemez, tahmin yazilmaz (UUID'ler dosya basinda)
--
-- WHERE kosullari kasitli: film HALA trending olmali ve pre_trending_tier
-- HALA NULL olmali. Aradan gecen surede biri deger yazdiysa bu UPDATE onu
-- ezmez; satir sayisi 44'un altina duser ve guard patlar.
-- ------------------------------------------------------------------------
DO $backfill$
DECLARE
  n integer;
BEGIN
  UPDATE films f
  SET pre_trending_tier = v.tier
  FROM (VALUES
    ('b1e6b75b-b955-44fe-ac0b-c85eaea6c858', 'core'),      -- 045C  La La Land
    ('fabadbde-efe9-4340-bdb8-6d4a07d7d43a', 'core'),      -- 045C  Your Name.
    ('6d3ee8a0-3463-4f48-99f7-24646a5b2b17', 'core'),      -- 045C  Train to Busan
    ('39d09ad9-d132-4cb5-9199-0a4fe93aa4a2', 'core'),      -- 045C  Project Hail Mary
    ('5dea0d10-f04c-42ba-8e54-b060ef951202', 'core'),      -- 045C  Demon Slayer: Infinity Castle
    ('67a4d8a6-5c35-45c1-bcf8-6753cefbca08', 'core'),      -- 045C  Michael
    ('479f4368-baeb-4cdf-8af6-1122ecda4d07', 'archive'),   -- 045A  The Sheep Detectives
    ('49a2d105-c8b4-4571-818e-e9ad641d1a12', 'archive'),   -- 045A  Obsession
    ('76968536-b9b0-41a5-8fac-ace61541c12f', 'archive'),   -- 045A  The Mandalorian and Grogu
    ('1d623f94-8769-473c-b74c-b6f71daec231', 'archive'),   -- 045A  Leviticus
    ('90ce8b99-bb12-4e18-b4ee-29650cfb0855', 'archive'),   -- 045A  Tony
    ('d9ac9935-1517-4d48-acdf-fc1f365798ef', 'archive'),   -- 045A  Avengers: Doomsday
    ('87f5d122-208a-496b-b904-87eaaa809619', 'archive'),   -- 045A  The Invite
    ('6a38c190-2c3a-4b76-b937-43e91d19d695', 'archive'),   -- 045A  Spider-Man: Brand New Day
    ('d6cba55f-37a5-4eaa-8761-2a79986585ff', 'archive'),   -- 045A  Soulm8te
    ('7c48567b-dd01-43d0-8db2-d189f18f9c10', 'archive'),   -- 045A  The Odyssey
    ('8241de8f-5157-4a2e-b155-6c9566ce2cff', 'archive'),   -- 045A  Disclosure Day
    ('43cde8b8-7a60-43d3-9237-e0231da2eb65', 'archive'),   -- 045A  Avatar Aang: The Last Airbender
    ('6a1030eb-be74-4f94-85b1-4be991c7ffa6', 'archive'),   -- 045A  Evil Dead Burn
    ('47cdeced-fd81-4185-a693-a0be789cf506', 'archive'),   -- 045A  Backrooms
    ('34611398-2d9c-42d3-b0ab-3ab1e72228d1', 'archive'),   -- 045A  Scary Movie
    ('af979dbb-643d-45ca-8419-82293280b884', 'archive'),   -- 045A  Masters of the Universe
    ('5cb3cc6f-4b50-4105-8f4d-4eed83117b7a', 'archive'),   -- 045A  The End of Oak Street
    ('6dcd3901-ff58-49b8-aad4-1198f00cc003', 'archive'),   -- 045A  Toy Story 5
    ('563aabf1-bd0a-4410-838f-db58beb84d25', 'archive'),   -- 045A  The Devil's Mouth
    ('1ed485f9-9b4a-4ac5-afa8-a70cef98d376', 'archive'),   -- 045A  The Death of Robin Hood
    ('362b8024-5e47-4a6f-830c-2f15e0362a44', 'archive'),   -- 045A  The Devil Wears Prada 2
    ('15b6105b-1a73-49cd-a1d0-782872470e12', 'archive'),   -- 045A  Moana
    ('d1225731-07dd-448e-96ec-e0b1689080f3', 'archive'),   -- 045A  One Night Only
    ('6892a6cb-b3a7-4ec8-a8ef-6386c7dd62a5', 'archive'),   -- 045A  Supergirl
    ('7e7d0c51-5894-451a-aaef-790f7a055a08', 'archive'),   -- 045A  Insidious: Out of the Further
    ('7aae7fba-cd7f-4067-a15d-2b789db8bc7f', 'archive'),   -- 045A  PAW Patrol: The Dino Movie
    ('42f199eb-31c8-496f-8b21-2b269b7562fd', 'archive'),   -- 045A  Minions & Monsters
    ('b7d90e62-415c-4b8a-8d30-69ec5388efb9', 'archive'),   -- 045A  The Furious
    ('90d15469-8293-4aa8-b68a-340029eef910', 'archive'),   -- 045A  Teenage Sex and Death at Camp Miasma
    ('9d54b8a2-a576-4be2-9b1e-fcab994e3a73', 'archive'),   -- 045A  Mutiny
    ('540baafe-09d0-4e4e-b1e8-12a2d1ba462f', 'archive'),   -- 045A  The Magic Faraway Tree
    ('d511dfcc-57ce-477c-ae6f-2ff48b305657', 'archive'),   -- 045A  Toxic
    ('55645cec-858a-4ed5-91d3-9e073987ea05', 'archive'),   -- 045A  Spa Weekend
    ('024e64eb-7cb2-4076-8729-b73b147263a8', 'archive'),   -- 045A  In the Grey
    ('f82060d0-a2f9-455c-afcc-2a22b3c6966b', 'archive'),   -- 045A  Ice Cream Man
    ('8e529f7f-26d6-4d85-a4dc-4cd13952fdbf', 'archive'),   -- 045A  72 HOURS
    ('bf6e14b6-1139-433e-b065-2e6238b88357', 'archive'),   -- 045A  Colony
    ('7a354fe0-a680-41bc-9a66-735d182718ae', 'archive')    -- 045A  Nimrods
  ) AS v(id, tier)
  WHERE f.id = v.id::uuid
    AND f.curation_tier = 'trending'
    AND f.pre_trending_tier IS NULL;

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 44 THEN
    RAISE EXCEPTION
      'ABORT: pre_trending_tier backfill % satir etkiledi (beklenen 44). '
      'Filmlerden biri artik trending degil ya da pre_trending_tier zaten dolu. '
      'Uzerine yazilmadi, manuel inceleme gerekli.', n;
  END IF;

  RAISE NOTICE '079 · 1.4: 44 film backfill edildi (38 archive, 6 core).';
END;
$backfill$;


-- ------------------------------------------------------------------------
-- 1.5 · curation_tier NOT NULL
--
-- Kolon bugun 0/3404 NULL ve zaten 'extended' DEFAULT'u var; NULL bir
-- curation_tier hicbir kod yolunda anlamli degil. Kisit, gelecekte NULL
-- yazan bir yolun sessizce filmi tum tier filtrelerinin disina
-- dusurmesini engeller.
--
-- Guard once NULL var mi diye bakar: varsa SET NOT NULL zaten patlardi
-- ama mesaji anlasilmaz olurdu. Bu bloktan gecerse islem risksizdir.
-- ------------------------------------------------------------------------
DO $notnull$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM films WHERE curation_tier IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION
      'ABORT: curation_tier NULL olan % film var. NOT NULL eklenemez; '
      'once bu satirlarin tier''i belirlenmeli.', n;
  END IF;
END;
$notnull$;

ALTER TABLE films ALTER COLUMN curation_tier SET NOT NULL;


-- ============================================================
-- DOWN SCRIPT — geri alma (ELLE calistirilir, migration olarak DEGIL)
-- ============================================================
-- 1.5 · curation_tier
--   ALTER TABLE films ALTER COLUMN curation_tier DROP NOT NULL;
--
-- 1.4 · pre_trending_tier backfill
--   UPDATE films SET pre_trending_tier = NULL WHERE curation_tier = 'trending';
--   ⚠️ Bu geri alma trending'deki TUM filmleri temizler. 079 oncesi durum
--   zaten "56/56 NULL" oldugu icin sonuc dogrudur.
--
-- 1.3 · 3 kurban restore
--   UPDATE films SET curation_tier = 'archive'
--    WHERE id IN ('03b083bb-acb3-44ac-ad70-bb1a8ed70b9c',
--                 'f15f6104-8c49-43ac-9522-757801b47592',
--                 '05ca31a0-19db-4a6e-b3fc-ccd461f93548');
--   ⚠️ Bu geri alma uc filmi BOZUK duruma dondurur. Yalnizca restore'un
--   kendisi hatali bulunursa anlamlidir.
--
-- 1.2 · cron_job_status — GERI ALINMAZ
--   Fonksiyon 079 oncesi de canlida VARDI (migration disi olusmustu).
--   DROP etmek 079 oncesi duruma donus DEGIL, yeni bir bozulma olurdu.
--   Yalnizca izinler geri alinmak istenirse ilgili GRANT'lar elle yazilir.
--
-- 1.1 · tmdb_vote_count
--   ALTER TABLE films DROP COLUMN IF EXISTS tmdb_vote_count;
--   Kolon 0/3404 dolu ve hicbir kod yolu okumuyor; veri kaybi riski sifir.
-- ============================================================


-- ============================================================
-- 079 SONRASI BEKLENEN DURUM (kayit)
-- ============================================================
-- films: 3404 satir
--   archive 1537 · core 862 · extended 949 · trending 56
--   (078 sonrasi 1540/860/948/56 idi; fark tam olarak 3 kurban)
--
-- pre_trending_tier (trending 56 icinde):
--   archive 38 · core 6 · NULL 12  (10 B sinifi + 2 BELIRSIZ)
--
-- Gauntlet havuzu (core+extended+trending, vektor + poster dolu):
--   1854 -> 1857  (+3 kurban)
--
-- ACIK KALEMLER (079 kapsaminda DEGIL):
--   * tmdb_vote_count doldurulmadi, sync-trending oraya yazmiyor  -> borc
--   * 4 GAP filmi (rating var, 045C/D esigi altinda)              -> borc
--     Hoppers · Ready or Not: Here I Come ·
--     Neon Genesis Evangelion: Death and Rebirth · Shelter
--   * 2 BELIRSIZ film pre_trending_tier NULL                      -> borc
--   * 10 trending film profile_vector NULL                        -> GATE 3
--   * weekly-trending-sync active=false                           -> GATE 3 sonrasi
--   * supabase db diff calistirilmadi (Docker yok)                -> C.0e oncesi
-- ============================================================
