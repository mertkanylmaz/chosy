-- 084_films_dominant_color.sql
--
-- Isik sizmasi backend katmani.
-- Kaynak: docs/os/3_CHOSY_DESIGN_OS.md §5.2 (BLEED_CONSTRAINTS) + §5.4
-- CTO onayi: 04.08.2026 (veri sekli) · 14.08.2026 (backend clamp karari)
--
-- Karar: renk BACKEND'de hesaplanir ve KISITLANMIS haliyle saklanir.
-- Istemci hicbir hesaplama yapmaz; okudugu {l,c,h} dogrudan render edilebilir.
-- Clamp'i script uygulamazsa asagidaki CHECK kisiti INSERT/UPDATE'i reddeder --
-- tip sistemi bu hatayi yakalayamaz, veritabani yakalar.
--
-- Uc kolon da nullable ve DEFAULT'suz: mevcut satirlar icin tablo yeniden
-- yazilmaz, mevcut hicbir kolona dokunulmaz. Poster indirilemeyen/bozuk filmde
-- poster_quality_ok = false, dominant_color = null -- satir SILINMEZ.

alter table public.films
  add column if not exists dominant_color jsonb,
  add column if not exists dominant_color_computed_at timestamptz,
  add column if not exists poster_quality_ok boolean;

comment on column public.films.dominant_color is
  'OKLCH {l,c,h}. types/gauntlet.ts OklchColor sozlesmesiyle birebir ayni sekil. '
  'BLEED_CONSTRAINTS uygulanmis (clamped) deger -- ham deger saklanmaz.';

comment on column public.films.dominant_color_computed_at is
  'dominant_color en son ne zaman hesaplandi. NULL = hic hesaplanmadi. '
  'Yeniden hesaplama (kisit degisirse) bu alana gore secilir.';

comment on column public.films.poster_quality_ok is
  'Poster indirilip cozulebildi mi. false = indirilemedi/bozuk/decode edilemedi, '
  'dominant_color NULL kalir. NULL = henuz denenmedi.';

-- Sekil + clamp kisiti.
-- jsonb_typeof kontrolu once gelir; sayisal oldugu garantilendikten sonra
-- ::numeric cast guvenlidir (AND kisa devre yapar).
alter table public.films
  drop constraint if exists films_dominant_color_shape;

alter table public.films
  add constraint films_dominant_color_shape check (
    dominant_color is null or (
      jsonb_typeof(dominant_color -> 'l') = 'number'
      and jsonb_typeof(dominant_color -> 'c') = 'number'
      and jsonb_typeof(dominant_color -> 'h') = 'number'
      -- BLEED_CONSTRAINTS tavanlari (3_CHOSY_DESIGN_OS §5.2)
      and (dominant_color ->> 'l')::numeric <= 0.22   -- maxLightness: asla parlamaz
      and (dominant_color ->> 'c')::numeric <= 0.08   -- maxChroma: doygunluk tavani
      -- anlamli aralik alt sinirlari
      and (dominant_color ->> 'l')::numeric >= 0
      and (dominant_color ->> 'c')::numeric >= 0
      and (dominant_color ->> 'h')::numeric >= 0
      and (dominant_color ->> 'h')::numeric < 360
    )
  );
