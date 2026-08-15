-- 085_fix_dominant_color_shape_null_gap.sql
--
-- 084'teki films_dominant_color_shape kisitinin NULL bosllugunu kapatir.
--
-- Hata: `jsonb_typeof(dominant_color -> 'h') = 'number'` ifadesi, 'h' anahtari
-- HIC YOKSA `->` NULL dondurur, jsonb_typeof(NULL) NULL olur ve karsilastirma
-- NULL uretir. CHECK kisiti yalnizca FALSE'ta reddeder, NULL'da GECIRIR.
-- Sonuc: {l, c} gibi eksik sekilli bir jsonb kisiti asiyordu.
-- Dogrulama ciktisi: "4) h alani eksik denemesi -> KABUL EDILDI".
--
-- Duzeltme: `is not distinct from` ile NULL'i FALSE'a cevir + ust seviye
-- jsonb'nin gercekten object oldugunu dogrula (skaler/array girisleri icin).
-- Clamp tavanlari 084 ile ayni: maxLightness 0.22 / maxChroma 0.08.

alter table public.films
  drop constraint if exists films_dominant_color_shape;

alter table public.films
  add constraint films_dominant_color_shape check (
    dominant_color is null or (
      jsonb_typeof(dominant_color) = 'object'
      -- uc anahtar da VAR ve sayisal (eksik anahtar artik FALSE uretir)
      and jsonb_typeof(dominant_color -> 'l') is not distinct from 'number'
      and jsonb_typeof(dominant_color -> 'c') is not distinct from 'number'
      and jsonb_typeof(dominant_color -> 'h') is not distinct from 'number'
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
